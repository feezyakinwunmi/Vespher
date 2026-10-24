// supabase/functions/suggest-dish-info/index.ts
// Helps vendors list a dish quickly: from the dish name (and optional description)
// Claude suggests typical ingredients, allergens, health tags, meal times and a short
// description. The vendor reviews and edits before saving; admins still approve.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno npm import
import Anthropic from 'npm:@anthropic-ai/sdk';
import { getCaller, handler, json, readJson, HttpError } from '../_shared/http.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const ALLERGEN_IDS = [
  'contains_peanuts', 'contains_nuts', 'contains_dairy', 'contains_eggs', 'contains_gluten',
  'contains_shellfish', 'contains_fish', 'contains_soy', 'contains_sesame',
];
const MEAL_TIMES = ['breakfast', 'lunch', 'dinner', 'snack'];

interface Body {
  name?: string;
  description?: string;
  category?: string;
  // Health tag ids the app offers (from health_tags_reference), so suggestions match them.
  allowed_health_tags?: string[];
}

const SYSTEM_PROMPT = `You help restaurant vendors on a Nigerian food delivery app describe their dishes.
Given a dish name (and sometimes a description or category), return how the dish is typically prepared in Nigeria.

- ingredients: the main ingredients a customer would care about, as short lowercase names (e.g. "rice", "tomato", "crayfish", "palm oil", "seasoning cube"). Include common hidden allergen sources such as crayfish, stockfish, groundnut, egg, milk or wheat flour when the dish usually contains them. 4 to 15 items.
- allergens: only ids from the allowed list that the typical recipe contains.
- health_tags: only ids from the allowed list that clearly apply.
- meal_times: when Nigerians usually eat this dish.
- description: one or two appetising, factual sentences a customer would read. No prices, no health claims.

If the name is ambiguous, describe the most common Nigerian version. Vendors will review and edit your suggestion.`;

serve(handler(async (req) => {
  const caller = await getCaller(req);
  if (caller.role !== 'vendor' && caller.role !== 'admin') {
    throw new HttpError(403, 'Only vendors can use dish suggestions');
  }

  const body = await readJson<Body>(req);
  const name = String(body.name || '').trim().slice(0, 120);
  if (name.length < 2) throw new HttpError(400, 'Enter the dish name first');
  const description = String(body.description || '').trim().slice(0, 500);
  const category = String(body.category || '').trim().slice(0, 60);
  const healthTagIds = (Array.isArray(body.allowed_health_tags) ? body.allowed_health_tags : [])
    .filter((t): t is string => typeof t === 'string' && /^[a-z0-9_]{2,40}$/.test(t))
    .filter(t => !ALLERGEN_IDS.includes(t))
    .slice(0, 60);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new HttpError(503, 'AI suggestions are not configured');

  const schema = {
    type: 'object',
    properties: {
      ingredients: { type: 'array', items: { type: 'string' } },
      allergens: { type: 'array', items: { type: 'string', enum: ALLERGEN_IDS } },
      health_tags: healthTagIds.length
        ? { type: 'array', items: { type: 'string', enum: healthTagIds } }
        : { type: 'array', items: { type: 'string' } },
      meal_times: { type: 'array', items: { type: 'string', enum: MEAL_TIMES } },
      description: { type: 'string' },
    },
    required: ['ingredients', 'allergens', 'health_tags', 'meal_times', 'description'],
    additionalProperties: false,
  };

  const client = new Anthropic({ apiKey });

  let response;
  try {
    // Haiku: listing typical ingredients is a simple extraction task, ~40x cheaper than Opus.
    response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema },
      },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Dish name: ${name}`,
          description && `Vendor description: ${description}`,
          category && `Category: ${category}`,
          `Allowed health_tags: ${healthTagIds.length ? healthTagIds.join(', ') : '(none - return an empty list)'}`,
        ].filter(Boolean).join('\n'),
      }],
    } as any);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Too many requests, try again shortly');
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', (error as any).status, (error as any).message);
      throw new HttpError(502, 'AI suggestion service is unavailable');
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'Could not generate suggestions for this dish');
  }

  // deno-lint-ignore no-explicit-any
  const text = response.content.find((b: any) => b.type === 'text')?.text;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text || '');
  } catch {
    throw new HttpError(502, 'AI returned an unexpected response');
  }

  const strings = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : [])
      .filter((s): s is string => typeof s === 'string')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, max);

  return json({
    status: true,
    data: {
      ingredients: strings(parsed.ingredients, 20).map(s => s.toLowerCase().slice(0, 40)),
      allergens: strings(parsed.allergens, 10).filter(a => ALLERGEN_IDS.includes(a)),
      health_tags: strings(parsed.health_tags, 10).filter(t => !healthTagIds.length || healthTagIds.includes(t)),
      meal_times: strings(parsed.meal_times, 4).filter(m => MEAL_TIMES.includes(m)),
      description: String(parsed.description || '').trim().slice(0, 400),
      source: 'ai',
    },
  });
}));
