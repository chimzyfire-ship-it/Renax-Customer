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

export type DeliverAndEarnWalletSummary = {
  available_balance: number;
  pending_balance: number;
  payout_requested_balance: number;
  paid_balance: number;
  held_balance: number;
  total_balance: number;
};

export type DeliverAndEarnInvite = {
  id: string;
  profile_id: string;
  invite_code: string;
  invite_status: 'issued' | 'accepted' | 'expired' | 'revoked';
  rider_app_url: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type DeliverAndEarnSnapshot = {
  userId: string | null;
  isDemoPreview: boolean;
  profile: DeliverAndEarnProfile | null;
  vehicles: DeliverAndEarnVehicle[];
  latestInvite: DeliverAndEarnInvite | null;
  availability: DeliverAndEarnAvailability | null;
  offers: DeliverAndEarnOffer[];
  earnings: DeliverAndEarnEarning[];
  payouts: DeliverAndEarnPayout[];
  walletSummary: DeliverAndEarnWalletSummary | null;
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
  latestInvite: null,
  availability: null,
  offers: [],
  earnings: [],
  payouts: [],
  walletSummary: null,
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

const SNAPSHOT_QUERY_TIMEOUT_MS = 6000;

async function safeSnapshotQuery<T>(label: string, queryFn: () => PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  try {
    const timeoutResult = new Promise<{ data: T | null; error: any }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: null,
          error: new Error(`${label} query timed out after ${SNAPSHOT_QUERY_TIMEOUT_MS / 1000} seconds`),
        });
      }, SNAPSHOT_QUERY_TIMEOUT_MS);
    });

    const { data, error } = await Promise.race([queryFn(), timeoutResult]);
    if (error) {
      console.warn(`[DeliverAndEarn] ${label} query error:`, error.message || error);
      return null;
    }
    return data;
  } catch (error) {
    console.warn(`[DeliverAndEarn] ${label} query threw:`, error);
    return null;
  }
}

export async function fetchDeliverAndEarnSnapshot(previewUserId?: string | null): Promise<DeliverAndEarnSnapshot> {
  const userId = await getCurrentDeliverAndEarnUserId();
  if (!userId) {
    return createDeliverAndEarnPreviewSnapshot(previewUserId);
  }

  const [profile, vehicles, invites] = await Promise.all([
    safeSnapshotQuery<DeliverAndEarnProfile>('profile', () =>
      supabase
      .from('deliver_and_earn_profiles')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle()
    ),
    safeSnapshotQuery<DeliverAndEarnVehicle[]>('vehicles', () =>
      supabase
      .from('deliver_and_earn_vehicles')
      .select('*')
      .eq('operator_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5)
    ),
    safeSnapshotQuery<DeliverAndEarnInvite[]>('invites', () =>
      supabase
      .from('deliver_and_earn_operator_invites')
      .select('id, profile_id, invite_code, invite_status, rider_app_url, expires_at, accepted_at, created_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    ),
  ]);

  return {
    userId,
    isDemoPreview: false,
    profile: profile ?? null,
    vehicles: vehicles ?? [],
    latestInvite: invites?.[0] ?? null,
    availability: null,
    offers: [],
    earnings: [],
    payouts: [],
    walletSummary: null,
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

export function summarizeDeliverAndEarnMoney(earnings: DeliverAndEarnEarning[], walletSummary?: DeliverAndEarnWalletSummary | null) {
  if (walletSummary) {
    return {
      available: Number(walletSummary.available_balance || 0),
      pending: Number(walletSummary.pending_balance || 0) + Number(walletSummary.payout_requested_balance || 0),
      paid: Number(walletSummary.paid_balance || 0),
      held: Number(walletSummary.held_balance || 0),
      total: Number(walletSummary.total_balance || 0),
    };
  }

  return earnings.reduce(
    (summary, earning) => {
      const amount = Number(earning.operator_amount || 0);
      if (earning.status === 'available') summary.available += amount;
      if (earning.status === 'pending_delivery' || earning.status === 'pending_dispute_window' || earning.status === 'payout_requested') summary.pending += amount;
      if (earning.status === 'paid') summary.paid += amount;
      if (earning.status === 'held') summary.held += amount;
      summary.total += amount;
      return summary;
    },
    { available: 0, pending: 0, paid: 0, held: 0, total: 0 },
  );
}
