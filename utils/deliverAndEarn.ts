import { supabase } from '../supabase';

export type DeliverAndEarnApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type DeliverAndEarnOperatorStatus =
  | 'not_active'
  | 'active'
  | 'suspended'
  | 'deactivated';

export type DeliverAndEarnProfile = {
  profile_id: string;
  application_status: DeliverAndEarnApplicationStatus;
  operator_status: DeliverAndEarnOperatorStatus;
  trust_tier: 'starter' | 'standard' | 'trusted' | 'restricted';
  operating_state: string;
  operating_city: string | null;
  training_status: string;
  identity_status: string;
  licence_status: string;
  bank_status: string;
  risk_score: number;
  total_completed_shipments: number;
  total_incidents: number;
  approval_notes: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
};

export type DeliverAndEarnVehicle = {
  id: string;
  operator_id: string;
  vehicle_type: 'car' | 'suv' | 'wagon' | 'small_van' | 'other';
  make: string | null;
  model: string | null;
  vehicle_year: number | null;
  color: string | null;
  plate_number: string;
  ownership_type: string;
  capacity_kg: number | null;
  max_parcel_count: number | null;
  roadworthiness_expires_at: string | null;
  insurance_expires_at: string | null;
  registration_expires_at: string | null;
  vehicle_status: string;
  inspection_status: string;
};

export type DeliverAndEarnAvailability = {
  operator_id: string;
  vehicle_id: string | null;
  is_online: boolean;
  current_shipment_id: string | null;
  state: string | null;
  city: string | null;
  last_seen: string;
};

export type DeliverAndEarnOffer = {
  id: string;
  shipment_id: string;
  operator_id: string;
  vehicle_id: string | null;
  offer_status: string;
  offer_rank: number;
  score: number;
  expires_at: string;
  created_at: string;
  shipments?: {
    tracking_id: string | null;
    pickup_address: string | null;
    delivery_address: string | null;
    package_category: string | null;
    estimated_price: number | null;
    carrier_commission_amount: number | null;
  } | null;
};

export type DeliverAndEarnEarning = {
  id: string;
  shipment_id: string;
  operator_id: string;
  gross_delivery_fee: number;
  operator_amount: number;
  renax_platform_amount: number;
  insurance_reserve_amount: number;
  payment_tax_admin_reserve_amount: number;
  status: string;
  eligible_at: string | null;
  available_at: string | null;
  created_at: string;
};

export type DeliverAndEarnPayout = {
  id: string;
  operator_id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  paid_at: string | null;
};

export type DeliverAndEarnSnapshot = {
  userId: string | null;
  isDemoPreview: boolean;
  profile: DeliverAndEarnProfile | null;
  vehicles: DeliverAndEarnVehicle[];
  availability: DeliverAndEarnAvailability | null;
  offers: DeliverAndEarnOffer[];
  earnings: DeliverAndEarnEarning[];
  payouts: DeliverAndEarnPayout[];
};

export type DeliverAndEarnApplicationPayload = {
  fullName: string;
  phoneNumber: string;
  operatingState: string;
  operatingCity: string;
  vehicleType: DeliverAndEarnVehicle['vehicle_type'];
  make: string;
  model: string;
  vehicleYear: string;
  color: string;
  plateNumber: string;
  ownershipType: string;
  capacityKg: string;
  submit: boolean;
};

export type DeliverAndEarnApplicationResult = {
  profile_id?: string;
  application_status?: string;
  operator_status?: string;
  vehicle_id?: string | null;
  vehicle_status?: string | null;
  next_steps?: string[];
};

const EMPTY_SNAPSHOT: DeliverAndEarnSnapshot = {
  userId: null,
  isDemoPreview: false,
  profile: null,
  vehicles: [],
  availability: null,
  offers: [],
  earnings: [],
  payouts: [],
};

export const LOCAL_DELIVER_AND_EARN_PREVIEW_ID = 'local-deliver-and-earn-preview';

export function createDeliverAndEarnPreviewSnapshot(userId?: string | null): DeliverAndEarnSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    userId: userId || LOCAL_DELIVER_AND_EARN_PREVIEW_ID,
    isDemoPreview: true,
  };
}

export function createDeliverAndEarnSignedInSnapshot(userId: string): DeliverAndEarnSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    userId,
    isDemoPreview: false,
  };
}

export async function getCurrentDeliverAndEarnUserId() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user?.id) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user?.id ?? session.user.id;
}

export async function fetchDeliverAndEarnSnapshot(previewUserId?: string | null): Promise<DeliverAndEarnSnapshot> {
  const userId = await getCurrentDeliverAndEarnUserId();
  if (!userId) {
    return createDeliverAndEarnPreviewSnapshot(previewUserId);
  }

  const [profileResult, vehiclesResult, availabilityResult, offersResult, earningsResult, payoutsResult] = await Promise.all([
    supabase
      .from('deliver_and_earn_profiles')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle(),
    supabase
      .from('deliver_and_earn_vehicles')
      .select('*')
      .eq('operator_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('deliver_and_earn_availability')
      .select('*')
      .eq('operator_id', userId)
      .maybeSingle(),
    supabase
      .from('deliver_and_earn_job_offers')
      .select('*, shipments(tracking_id, pickup_address, delivery_address, package_category, estimated_price, carrier_commission_amount)')
      .eq('operator_id', userId)
      .in('offer_status', ['offered', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('deliver_and_earn_earnings_ledger')
      .select('*')
      .eq('operator_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('deliver_and_earn_payouts')
      .select('*')
      .eq('operator_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const queryErrors = [
    profileResult.error,
    vehiclesResult.error,
    availabilityResult.error,
    offersResult.error,
    earningsResult.error,
    payoutsResult.error,
  ].filter(Boolean);

  if (queryErrors.length) {
    console.warn('Deliver & Earn snapshot loaded with partial data', queryErrors);
  }

  return {
    userId,
    isDemoPreview: false,
    profile: profileResult.error ? null : (profileResult.data as DeliverAndEarnProfile | null) ?? null,
    vehicles: vehiclesResult.error ? [] : (vehiclesResult.data as DeliverAndEarnVehicle[] | null) ?? [],
    availability: availabilityResult.error ? null : (availabilityResult.data as DeliverAndEarnAvailability | null) ?? null,
    offers: offersResult.error ? [] : (offersResult.data as DeliverAndEarnOffer[] | null) ?? [],
    earnings: earningsResult.error ? [] : (earningsResult.data as DeliverAndEarnEarning[] | null) ?? [],
    payouts: payoutsResult.error ? [] : (payoutsResult.data as DeliverAndEarnPayout[] | null) ?? [],
  };
}

export async function submitDeliverAndEarnApplication(payload: DeliverAndEarnApplicationPayload) {
  const userId = await getCurrentDeliverAndEarnUserId();
  if (!userId) {
    throw new Error('Your RENAX login session is not active. Please sign out, sign in again, and submit your Deliver & Earn application.');
  }

  const { data, error } = await supabase.rpc('submit_deliver_and_earn_application', {
    p_payload: {
      full_name: payload.fullName.trim(),
      phone_number: payload.phoneNumber.trim(),
      operating_state: payload.operatingState.trim(),
      operating_city: payload.operatingCity.trim(),
      submit: payload.submit,
      vehicle: {
        vehicle_type: payload.vehicleType,
        make: payload.make.trim(),
        model: payload.model.trim(),
        vehicle_year: payload.vehicleYear.trim(),
        color: payload.color.trim(),
        plate_number: payload.plateNumber.trim().toUpperCase(),
        ownership_type: payload.ownershipType.trim().toLowerCase().replace(/\s+/g, '_'),
        capacity_kg: payload.capacityKg.trim(),
        max_parcel_count: '8',
      },
    },
  });

  if (error) throw error;
  return data as DeliverAndEarnApplicationResult;
}

export async function setDeliverAndEarnOnline(isOnline: boolean, vehicleId?: string | null) {
  const { data, error } = await supabase.rpc('set_deliver_and_earn_online_status', {
    p_payload: {
      is_online: isOnline,
      vehicle_id: vehicleId || null,
      metadata: { source: 'customer_deliver_and_earn_tab' },
    },
  });

  if (error) throw error;
  return data as { operator_id?: string; vehicle_id?: string | null; is_online?: boolean; state?: string };
}

export async function requestDeliverAndEarnPayout(amount?: number) {
  const { data, error } = await supabase.rpc('request_deliver_and_earn_payout', {
    p_payload: {
      amount: amount && amount > 0 ? amount : null,
    },
  });

  if (error) throw error;
  return data as string;
}

export function summarizeDeliverAndEarnMoney(earnings: DeliverAndEarnEarning[]) {
  return earnings.reduce(
    (summary, earning) => {
      const amount = Number(earning.operator_amount || 0);
      if (earning.status === 'available') summary.available += amount;
      if (earning.status === 'pending_delivery' || earning.status === 'pending_dispute_window') summary.pending += amount;
      if (earning.status === 'paid') summary.paid += amount;
      if (earning.status === 'held') summary.held += amount;
      summary.total += amount;
      return summary;
    },
    { available: 0, pending: 0, paid: 0, held: 0, total: 0 },
  );
}
