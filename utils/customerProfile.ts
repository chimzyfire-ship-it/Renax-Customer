import { supabase } from '../supabase';

type CustomerProfileInput = {
  user: any;
  fullName?: string | null;
  phoneNumber?: string | null;
  state?: string | null;
  city?: string | null;
};

const clean = (value?: string | null) => {
  const next = String(value || '').trim();
  return next || null;
};

export async function ensureCustomerProfileForUser({
  user,
  fullName,
  phoneNumber,
  state,
  city,
}: CustomerProfileInput) {
  const userId = user?.id;
  if (!userId) return null;

  const fallbackName = clean(fullName) || clean(user?.user_metadata?.full_name) || clean(user?.email?.split('@')[0]) || 'Customer';
  const nextState = clean(state) || 'Lagos';
  const nextCity = clean(city);
  const nextPhone = clean(phoneNumber);

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone_number, state, city')
    .eq('id', userId)
    .maybeSingle();

  if (readError) throw readError;

  if (existing?.id) {
    const patch: Record<string, any> = {
      full_name: existing.full_name || fallbackName,
      state: existing.state || nextState,
      city: existing.city || nextCity,
    };

    if (!existing.phone_number && nextPhone) {
      patch.phone_number = nextPhone;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('id, role, full_name, phone_number, state, city')
      .maybeSingle();

    if (error) throw error;
    return data || existing;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: clean(user?.email),
      role: 'customer',
      full_name: fallbackName,
      phone_number: nextPhone,
      state: nextState,
      city: nextCity,
    }, { onConflict: 'id' })
    .select('id, role, full_name, phone_number, state, city')
    .maybeSingle();

  if (error) throw error;
  return data;
}
