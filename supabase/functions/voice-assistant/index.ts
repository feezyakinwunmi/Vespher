// supabase/functions/voice-assistant/index.ts
// "Hey Vesphe" voice ordering. The app turns speech into text, sends the conversation
// here, speaks the reply, and carries out cart/checkout actions on the phone.
//
// Tools that read data (menu search, recommendations) run here. Tools that change the
// customer's cart or place the order are returned to the app ("actions"); the app runs
// them and sends the results back as the next request. The conversation history lives
// in the app, so this function is stateless.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno npm import
import Anthropic from 'npm:@anthropic-ai/sdk';
import { getCaller, handler, json, readJson, HttpError } from '../_shared/http.ts';
import type { Caller } from '../_shared/http.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const MODEL = 'claude-haiku-5-5'; // fast replies matter more than depth in a voice chat
const MAX_HISTORY = 40;
const MAX_BODY_CHARS = 80_000;
const MAX_SERVER_STEPS = 5;

// ---------------------------------------------------------------------------
// Health rules (server-side, so recommendations never depend on the app)
// ---------------------------------------------------------------------------
const ALLERGY_RULES: Record<string, { allergens: string[]; words: string[]; label: string }> = {
  nut_allergy: { allergens: ['contains_nuts', 'contains_peanuts'], words: ['peanut', 'groundnut', 'cashew', 'almond', 'walnut', 'nut butter', 'yaji', 'suya spice'], label: 'nut allergy' },
  peanut_allergy: { allergens: ['contains_peanuts'], words: ['peanut', 'groundnut', 'yaji', 'suya spice'], label: 'peanut allergy' },
  tree_nut_allergy: { allergens: ['contains_nuts'], words: ['cashew', 'almond', 'walnut', 'hazelnut', 'pistachio'], label: 'tree nut allergy' },
  dairy_allergy: { allergens: ['contains_dairy'], words: ['milk', 'cheese', 'butter', 'cream', 'yoghurt', 'yogurt'], label: 'dairy allergy' },
  lactose_intolerant: { allergens: ['contains_dairy'], words: ['milk', 'cheese', 'cream', 'yoghurt', 'yogurt'], label: 'lactose intolerance' },
  egg_allergy: { allergens: ['contains_eggs'], words: ['egg'], label: 'egg allergy' },
  shellfish_allergy: { allergens: ['contains_shellfish'], words: ['crayfish', 'shrimp', 'prawn', 'periwinkle', 'crab', 'lobster'], label: 'shellfish allergy' },
  fish_allergy: { allergens: ['contains_fish'], words: ['fish', 'stockfish', 'croaker', 'mackerel', 'tilapia', 'catfish'], label: 'fish allergy' },
  soy_allergy: { allergens: ['contains_soy'], words: ['soy', 'soya'], label: 'soy allergy' },
  sesame_allergy: { allergens: ['contains_sesame'], words: ['sesame', 'beniseed'], label: 'sesame allergy' },
  celiac: { allergens: ['contains_gluten'], words: ['wheat', 'flour', 'bread', 'pasta', 'spaghetti', 'noodles'], label: 'coeliac disease' },
  celiac_disease: { allergens: ['contains_gluten'], words: ['wheat', 'flour', 'bread', 'pasta', 'spaghetti', 'noodles'], label: 'coeliac disease' },
};

const DIET_RULES: Record<string, { tags: string[]; words: string[]; good: string[]; label: string }> = {
  diabetic_type1: { tags: ['high_sugar'], words: ['sweet', 'sugar', 'sugary', 'cake', 'soda', 'juice', 'syrup', 'puff-puff', 'chin chin'], good: ['low_carb', 'fibre_rich', 'high_protein', 'whole_grain'], label: 'type 1 diabetes' },
  diabetic_type2: { tags: ['high_sugar'], words: ['sweet', 'sugar', 'sugary', 'cake', 'soda', 'juice', 'syrup', 'puff-puff', 'chin chin'], good: ['low_carb', 'fibre_rich', 'high_protein', 'whole_grain'], label: 'type 2 diabetes' },
  pre_diabetic: { tags: ['high_sugar'], words: ['sweet', 'sugar', 'sugary', 'soda', 'juice'], good: ['low_carb', 'fibre_rich', 'whole_grain'], label: 'pre-diabetes' },
  hypertensive: { tags: ['high_sodium'], words: ['salted', 'salty'], good: ['low_sodium', 'heart_healthy'], label: 'high blood pressure' },
  heart_disease: { tags: ['high_sodium', 'high_fat', 'fried'], words: ['fried'], good: ['heart_healthy', 'grilled', 'low_sodium'], label: 'heart disease' },
  high_cholesterol: { tags: ['high_fat', 'fried'], words: ['fried'], good: ['heart_healthy', 'grilled', 'fibre_rich'], label: 'high cholesterol' },
  kidney_disease: { tags: ['high_sodium'], words: ['salted'], good: ['low_sodium'], label: 'kidney disease' },
  pregnant: { tags: [], words: ['raw fish', 'sushi', 'liver', 'alcohol'], good: ['iron_rich', 'high_protein', 'vitamin_rich'], label: 'pregnancy' },
  acid_reflux: { tags: ['spicy'], words: ['pepper soup'], good: [], label: 'acid reflux' },
  obesity: { tags: ['fried', 'high_sugar'], words: ['fried'], good: ['low_carb', 'grilled', 'high_protein'], label: 'weight management' },
};

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  ingredients: string[] | null;
  allergens: string[] | null;
  health_tags: string[] | null;
  meal_times: string[] | null;
  is_popular: boolean | null;
  preparation_time: string | null;
  vendor: { id: string; name: string; is_open: boolean | null; delivery_time: string | null } | null;
}

function healthWarnings(d: Dish, conditions: string[]): string[] {
  const text = `${d.name} ${d.description || ''} ${(d.ingredients || []).join(' ')}`.toLowerCase();
  const tags = d.health_tags || [];
  const out: string[] = [];
  for (const c of conditions) {
    const a = ALLERGY_RULES[c];
    if (a && (a.allergens.some(x => (d.allergens || []).includes(x)) || a.words.some(w => text.includes(w)))) {
      out.push(`not safe with your ${a.label}`);
    }
    const r = DIET_RULES[c];
    if (r && (r.tags.some(t => tags.includes(t)) || r.words.some(w => text.includes(w)))) {
      out.push(`not ideal for your ${r.label}`);
    }
  }
  return [...new Set(out)];
}

function goodFor(d: Dish, conditions: string[]): number {
  const tags = d.health_tags || [];
  return conditions.reduce((s, c) => s + (DIET_RULES[c]?.good.filter(g => tags.includes(g)).length || 0), 0);
}

const lagosNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

function currentMealTime(d = lagosNow()) {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 22) return 'dinner';
  return 'snack';
}

const DISH_SELECT =
  'id, name, description, price, category, ingredients, allergens, health_tags, meal_times, is_popular, preparation_time, vendor:vendor_id!inner(id, name, is_open, delivery_time, is_approved, is_suspended)';

// deno-lint-ignore no-explicit-any
function baseDishQuery(admin: any) {
  return admin
    .from('products')
    .select(DISH_SELECT)
    .eq('is_available', true)
    .eq('approval_status', 'approved')
    .eq('vendor.is_approved', true)
    .eq('vendor.is_suspended', false);
}

function presentDish(d: Dish, conditions: string[]) {
  return {
    id: d.id,
    name: d.name,
    price_naira: d.price,
    vendor: d.vendor?.name,
    vendor_id: d.vendor?.id,
    vendor_open: d.vendor?.is_open !== false,
    about: (d.description || '').slice(0, 160),
    main_ingredients: (d.ingredients || []).slice(0, 8),
    contains: (d.allergens || []).map(a => a.replace('contains_', '')),
    tags: (d.health_tags || []).filter(t => !t.startsWith('contains_')),
    meal_times: d.meal_times || [],
    prep_time: d.preparation_time,
    health_warnings: healthWarnings(d, conditions),
  };
}

const clean = (s: unknown, max = 60) => String(s ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, max);

async function searchMenu(caller: Caller, conditions: string[], input: Record<string, unknown>) {
  let q = baseDishQuery(caller.admin);
  const words = clean(input.query).toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 5);
  if (words.length) {
    q = q.or(words.flatMap(w => [`name.ilike.%${w}%`, `description.ilike.%${w}%`, `category.ilike.%${w}%`]).join(','));
  }
  const mealTime = clean(input.meal_time, 12);
  if (['breakfast', 'lunch', 'dinner', 'snack'].includes(mealTime)) q = q.contains('meal_times', [mealTime]);
  const maxPrice = Number(input.max_price_naira);
  if (maxPrice > 0) q = q.lte('price', maxPrice);
  const vendor = clean(input.vendor_name);
  if (vendor) q = q.ilike('vendor.name', `%${vendor}%`);
  const { data, error } = await q.order('is_popular', { ascending: false }).limit(30);
  if (error) return { error: 'Menu search failed' };
  let dishes = ((data as Dish[]) || []).map(d => presentDish(d, conditions));
  if (input.only_safe_for_me !== false) dishes = dishes.filter(d => d.health_warnings.length === 0 || words.length > 0);
  dishes = dishes.sort((a, b) => Number(b.vendor_open) - Number(a.vendor_open)).slice(0, 8);
  return dishes.length ? { dishes } : { dishes: [], note: 'Nothing matched. Suggest something close or ask what else they like.' };
}

async function recommend(caller: Caller, conditions: string[], input: Record<string, unknown>) {
  const mealTime = ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(input.meal_time)) ? String(input.meal_time) : currentMealTime();
  const { data, error } = await baseDishQuery(caller.admin).eq('vendor.is_open', true).limit(200);
  if (error) return { error: 'Could not load recommendations' };
  const day = lagosNow().getDate();
  const scored = ((data as Dish[]) || [])
    .filter(d => healthWarnings(d, conditions).length === 0)
    .map(d => {
      let score = 0;
      if ((d.meal_times || []).includes(mealTime)) score += 4;
      if (d.is_popular) score += 2;
      score += goodFor(d, conditions) * 2;
      if (Number(input.max_price_naira) > 0 && d.price > Number(input.max_price_naira)) score -= 10;
      // Small daily variety so the same list isn't read out every time.
      score += ((d.id.charCodeAt(0) + d.id.charCodeAt(1) + day) % 7) / 7;
      return { d, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(x => presentDish(x.d, conditions));
  return { meal_time: mealTime, dishes: scored };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
const SERVER_TOOLS = new Set(['search_menu', 'recommend_dishes']);

const TOOLS = [
  {
    name: 'search_menu',
    description:
      'Search dishes that are on sale right now. Use for anything the customer names (a dish, ingredient, cuisine, vendor or budget). Results include each dish id, price, vendor and health_warnings for this customer.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to match, e.g. "jollof", "chicken", "pepper soup".' },
        meal_time: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        max_price_naira: { type: 'number' },
        vendor_name: { type: 'string' },
        only_safe_for_me: { type: 'boolean', description: 'Default true: hide dishes that clash with their health profile unless they named the dish.' },
      },
    },
  },
  {
    name: 'recommend_dishes',
    description: 'Pick good dishes for this customer right now, based on the time of day, their health profile and what is popular. Use when they ask what to eat or for suggestions.',
    input_schema: {
      type: 'object',
      properties: {
        meal_time: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        max_price_naira: { type: 'number' },
      },
    },
  },
  {
    name: 'add_to_cart',
    description: 'Add a dish (by id from search results) to the cart. One order can only contain dishes from one vendor.',
    input_schema: {
      type: 'object',
      properties: { dish_id: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 20 } },
      required: ['dish_id', 'quantity'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove a dish from the cart, or set a lower quantity.',
    input_schema: {
      type: 'object',
      properties: { dish_id: { type: 'string' }, quantity: { type: 'integer', minimum: 0, description: 'New quantity; 0 removes it.' } },
      required: ['dish_id'],
    },
  },
  {
    name: 'clear_cart',
    description: 'Empty the cart (e.g. to switch vendor). Only after the customer agrees.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_checkout_summary',
    description:
      'Get the cart, delivery address, delivery fee, discounts, total and payment options (cash, saved cards). Always call this before asking the customer to confirm an order.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'place_order',
    description:
      'Place the order. Only call after you read the items, total, delivery address and payment method to the customer and they clearly said yes in their latest message.',
    input_schema: {
      type: 'object',
      properties: {
        payment: { type: 'string', enum: ['cash', 'saved_card'] },
        card_id: { type: 'string', description: 'Required for saved_card: id from get_checkout_summary.' },
        note_for_vendor: { type: 'string' },
        customer_confirmed: { type: 'boolean', description: 'Must be true: the customer said yes to this exact order and total.' },
      },
      required: ['payment', 'customer_confirmed'],
    },
  },
  {
    name: 'end_conversation',
    description: 'Stop listening, e.g. when the customer says bye, stop, cancel or that is all.',
    input_schema: { type: 'object', properties: {} },
  },
];

const STATIC_PROMPT = `You are Vesphe, the voice assistant of Vesphe, a food delivery app in Nigeria. Customers talk to you hands-free, often while busy, so everything you say is read aloud.

How you speak:
- Warm, friendly and quick. One to three short sentences per reply. Plain spoken English, Nigerian-friendly, no slang overload.
- No lists, markdown, emojis or symbols. Say prices like "4,500 naira". Mention at most three dishes at a time, with price and vendor.
- Ask one question at a time.

How you help:
- Only talk about dishes returned by search_menu or recommend_dishes in this conversation. Never invent dishes, prices or vendors.
- Health comes first. If a dish has health_warnings, say so plainly and suggest a safer option. Only add it if the customer insists after hearing the warning.
- When they are unsure, use recommend_dishes and suggest something that fits the time of day and their health.
- If a vendor is closed (vendor_open false), say so and offer an open alternative.
- One order can only have dishes from one vendor. If they want another vendor, ask before clearing the cart.
- To check out: call get_checkout_summary, then read back the items, the total, the delivery address and the payment method (cash on delivery or their saved card ending in the last four digits) and ask "Shall I place the order?". Call place_order only after a clear yes.
- If there is no delivery address or the cart is empty, explain what is needed. If something must be done on screen (adding an address, adding a new card), tell them to tap it in the app.
- After an order is placed, tell them it is on its way to the vendor and end with a short goodbye, then call end_conversation.
- If they say stop, cancel, bye or nothing else, say a short goodbye and call end_conversation.
- If you did not catch what they said, ask them to repeat.`;

interface Body {
  messages?: Anthropic.MessageParam[];
  context?: {
    cart?: { dish_id: string; name: string; quantity: number; price: number; vendor_name?: string }[];
    address?: string | null;
    saved_cards?: { id: string; brand?: string | null; last4: string }[];
  };
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join(' ')
    .trim();
}

serve(handler(async (req) => {
  const caller = await getCaller(req);
  if (caller.role !== 'customer') throw new HttpError(403, 'Voice ordering is for customers');

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) throw new HttpError(413, 'Conversation is too long. Start a new one.');
  let body: Body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    throw new HttpError(400, 'Invalid request');
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_HISTORY) : [];
  if (!messages.length || messages[0].role !== 'user') throw new HttpError(400, 'Say something first');

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new HttpError(503, 'Voice ordering is not set up yet');

  const { admin } = caller;
  // Pro Max, or a free-trial customer with voice orders left.
  const { data: access } = await admin.rpc('voice_access', { p_user: caller.userId });
  if (!access?.allowed) {
    const reason = access?.reason;
    return json(
      {
        status: false,
        code: reason === 'disabled' ? 'disabled' : reason === 'monthly_limit' ? 'monthly_limit' : 'pro_max_required',
        message:
          reason === 'disabled'
            ? 'Voice ordering is turned off right now.'
            : reason === 'monthly_limit'
            ? "You've used this month's voice ordering. It resets on the 1st. You can still order by tapping."
            : 'Your free voice orders are used up. Upgrade to Vesphe Pro Max to keep ordering by voice.',
      },
      402
    );
  }
  const { data: settings } = await admin
    .from('platform_settings')
    .select('voice_daily_turn_limit')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: allowed } = await admin.rpc('claim_voice_turn', {
    p_user: caller.userId,
    p_limit: Number(settings?.voice_daily_turn_limit) || 120,
  });
  if (allowed === false) throw new HttpError(429, "You've reached today's voice limit. You can still order by tapping.");

  const [{ data: profile }, { data: health }] = await Promise.all([
    admin.from('users').select('name').eq('id', caller.userId).maybeSingle(),
    admin.from('customer_health_profiles').select('conditions, enable_warnings').eq('user_id', caller.userId).maybeSingle(),
  ]);
  const conditions: string[] = health?.enable_warnings === false ? [] : ((health?.conditions as string[]) || []);
  const firstName = String(profile?.name || '').split(' ')[0] || 'there';
  const now = lagosNow();
  const ctx = body.context || {};
  const cart = (ctx.cart || []).slice(0, 30);

  const dynamicPrompt = [
    `Customer: ${firstName}.`,
    `Now in Lagos: ${now.toLocaleDateString('en-NG', { weekday: 'long' })}, ${now.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })} (${currentMealTime(now)} time).`,
    conditions.length
      ? `Health profile: ${conditions.map(c => ALLERGY_RULES[c]?.label || DIET_RULES[c]?.label || c.replace(/_/g, ' ')).join(', ')}.`
      : 'Health profile: none set.',
    cart.length
      ? `Cart now: ${cart.map(i => `${i.quantity} x ${i.name} (${i.price} naira each${i.vendor_name ? `, ${i.vendor_name}` : ''}) [id ${i.dish_id}]`).join('; ')}.`
      : 'Cart now: empty.',
    `Delivery address: ${ctx.address || 'none set'}.`,
    `Saved cards: ${(ctx.saved_cards || []).map(c => `${c.brand || 'card'} ending ${c.last4} [id ${c.id}]`).join('; ') || 'none'}.`,
    access.pro_max
      ? 'Plan: Vesphe Pro Max (voice ordering included).'
      : `Plan: free voice trial, ${access.trial_orders_left} voice order(s) left. After placing an order, mention once how many free voice orders remain and that Vesphe Pro Max keeps voice ordering going.`,
  ].join('\n');

  const client = new Anthropic({ apiKey });
  const convo: Anthropic.MessageParam[] = [...messages];
  let say = '';
  let inputTokens = 0;
  let outputTokens = 0;
  // Metered for Reports → Voice ordering (AI cost vs Pro Max revenue).
  const finish = async (body: Record<string, unknown>) => {
    await admin.rpc('record_voice_usage', { p_user: caller.userId, p_input: inputTokens, p_output: outputTokens });
    return json(body);
  };

  for (let step = 0; step < MAX_SERVER_STEPS; step++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      // Haiku 5.5 thinks by default; a spoken reply needs to be quick, not deliberated.
      thinking: { type: 'disabled' },
      system: [
        { type: 'text', text: STATIC_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicPrompt },
      ],
      tools: TOOLS as Anthropic.Tool[],
      messages: convo,
    });

    const u = response.usage;
    inputTokens += (u?.input_tokens || 0) + (u?.cache_read_input_tokens || 0) + (u?.cache_creation_input_tokens || 0);
    outputTokens += u?.output_tokens || 0;
    convo.push({ role: 'assistant', content: response.content });
    const spoken = textOf(response.content);
    if (spoken) say = say ? `${say} ${spoken}` : spoken;

    if (response.stop_reason === 'refusal') {
      return finish({ messages: convo, say: say || "Sorry, I can't help with that. What would you like to eat?", actions: [], results: [] });
    }
    if (response.stop_reason !== 'tool_use') {
      return finish({ messages: convo, say: say || 'Sorry, could you say that again?', actions: [], results: [] });
    }

    const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls.filter(c => SERVER_TOOLS.has(c.name))) {
      const input = (call.input || {}) as Record<string, unknown>;
      const result = call.name === 'search_menu' ? await searchMenu(caller, conditions, input) : await recommend(caller, conditions, input);
      results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) });
    }

    const appCalls = calls.filter(c => !SERVER_TOOLS.has(c.name));
    if (appCalls.length) {
      // The app runs these, then sends back one user turn with `results` + its own results.
      return finish({
        messages: convo,
        say,
        actions: appCalls.map(c => ({ id: c.id, name: c.name, input: c.input })),
        results,
      });
    }
    convo.push({ role: 'user', content: results });
  }

  return finish({ messages: convo, say: say || 'Sorry, that took too long. What would you like?', actions: [], results: [] });
}));
