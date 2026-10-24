import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useFeedback } from '../../components/Toast';
import { Button, Card, Field, Input, PageHeader, Spinner } from '../../components/ui';
import { supabase } from '../../lib/supabase';

interface Settings {
  id: number;
  platform_fee_percentage: number | string;
  delivery_fee_per_km: number;
  min_delivery_fee: number;
  max_delivery_fee: number;
  promotion_cost_per_day: number;
  company_vehicle_rider_percentage: number;
  personal_vehicle_rider_percentage: number;
  pro_monthly_price: number;
  pro_yearly_price: number;
  free_recommendation_limit: number;
}

type FormState = Record<Exclude<keyof Settings, 'id'>, string>;

const FIELDS: { section: string; items: { key: keyof FormState; label: string; hint?: string; min: number; max?: number }[] }[] = [
  {
    section: 'Commission',
    items: [{ key: 'platform_fee_percentage', label: 'Platform commission (%)', hint: 'Taken from each order subtotal; the rest goes to the vendor', min: 0, max: 100 }],
  },
  {
    section: 'Delivery',
    items: [
      { key: 'delivery_fee_per_km', label: 'Fee per km (₦)', min: 10 },
      { key: 'min_delivery_fee', label: 'Minimum delivery fee (₦)', min: 100 },
      { key: 'max_delivery_fee', label: 'Maximum delivery fee (₦)', min: 100 },
      { key: 'company_vehicle_rider_percentage', label: 'Rider share, company vehicle (%)', min: 0, max: 100 },
      { key: 'personal_vehicle_rider_percentage', label: 'Rider share, own vehicle (%)', min: 0, max: 100 },
    ],
  },
  {
    section: 'Vendor promotions',
    items: [{ key: 'promotion_cost_per_day', label: 'Cost per day (₦)', min: 100 }],
  },
  {
    section: 'Vesphe Pro',
    items: [
      { key: 'pro_monthly_price', label: 'Monthly price (₦)', min: 100 },
      { key: 'pro_yearly_price', label: 'Yearly price (₦)', min: 100 },
      { key: 'free_recommendation_limit', label: 'Free recommendations shown', hint: 'Per meal time, for customers without Pro', min: 0, max: 20 },
    ],
  },
];

export function AdminSettings() {
  const { profile } = useAuth();
  const { toast } = useFeedback();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) return toast(error.message, 'error');
        const s = data as Settings;
        setSettings(s);
        setForm(Object.fromEntries(FIELDS.flatMap(g => g.items).map(f => [f.key, String(s[f.key] ?? '')])) as FormState);
      });
  }, [toast]);

  if (!form || !settings) return <Spinner label="Loading settings…" />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const values: Record<string, number> = {};
    for (const field of FIELDS.flatMap(g => g.items)) {
      const n = Number(form[field.key]);
      if (!Number.isFinite(n) || n < field.min || (field.max !== undefined && n > field.max)) {
        return toast(`${field.label}: enter a number${field.max !== undefined ? ` between ${field.min} and ${field.max}` : ` of at least ${field.min}`}`, 'error');
      }
      values[field.key] = n;
    }
    if (values.max_delivery_fee <= values.min_delivery_fee) return toast('Maximum delivery fee must be above the minimum', 'error');

    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({ ...values, updated_by: profile?.id, updated_at: new Date().toISOString() })
      .eq('id', settings.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast('Settings saved — they apply to new orders and purchases');
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader title="Platform settings" subtitle="Changes apply to new orders, promotions and Pro purchases." actions={<Button type="submit" loading={saving}>Save settings</Button>} />
      {FIELDS.map(group => (
        <Card key={group.section} className="p-6">
          <h2 className="mb-4 font-semibold">{group.section}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map(f => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <Input
                  type="number"
                  step="any"
                  min={f.min}
                  max={f.max}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Card>
      ))}
    </form>
  );
}
