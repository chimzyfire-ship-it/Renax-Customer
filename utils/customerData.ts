import { supabase } from '../supabase';

export const DEMO_CUSTOMER_ID = '123e4567-e89b-12d3-a456-426614174000';
const COMPANY_BANK_NAME = 'RENAX Settlement Bank';
const COMPANY_BANK_ACCOUNT = '2034567890';
const SHOWCASE_WALLET_BALANCE = 1_000_000;

export type ShipmentRecord = {
  id: string;
  tracking_id: string | null;
  status: string | null;
  dispatch_stage?: string | null;
  routing_mode?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  delivery_address: string | null;
  pickup_address?: string | null;
  pickup_state?: string | null;
  pickup_city?: string | null;
  delivery_state?: string | null;
  delivery_city?: string | null;
  source_terminal_id?: string | null;
  destination_terminal_id?: string | null;
  estimated_price: number | null;
  payment_method?: string | null;
  service_level?: string | null;
  distance_km?: number | null;
  shipment_type?: string | null;
};

export type ShipmentEventRecord = {
  id: string;
  shipment_id: string;
  stage?: string | null;
  location_name?: string | null;
  actor_role?: string | null;
  notes?: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

export type CustomerProfileRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  state?: string | null;
  role?: string | null;
};

export type CustomerSettingsRecord = {
  customer_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_notifications: boolean;
  language_code: string;
  region: string;
  two_factor_enabled: boolean;
};

export type PaymentMethodRecord = {
  id: string;
  customer_id: string;
  type: 'card' | 'bank_transfer' | 'momo';
  provider_name: string;
  label: string;
  account_name: string | null;
  last4: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  status: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type BankAccountRecord = {
  id: string;
  customer_id: string;
  bank_name: string;
  account_name: string;
  account_number_last4: string;
  recipient_code: string | null;
  is_default: boolean;
  created_at: string;
};

export type WalletRecord = {
  customer_id: string;
  balance: number;
  pending_balance: number;
  total_funded: number;
  total_spent: number;
  total_withdrawn: number;
  currency: string;
  updated_at: string;
};

export type WalletTransactionRecord = {
  id: string;
  customer_id: string;
  type: string;
  amount: number;
  status: string;
  reference: string;
  method: string | null;
  description: string | null;
  related_shipment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type WalletWithdrawalRecord = {
  id: string;
  customer_id: string;
  bank_account_id: string | null;
  amount: number;
  status: string;
  reference: string;
  notes: string | null;
  created_at: string;
};

export type DashboardMetrics = {
  inTransitCount: number;
  pendingCount: number;
  deliveredCount: number;
  totalBookings: number;
  outstandingPayments: number;
  recentBookings: ShipmentRecord[];
  activeShipment: ShipmentRecord | null;
  wallet: WalletRecord | null;
};

const defaultSettings = (customerId: string): CustomerSettingsRecord => ({
  customer_id: customerId,
  email_notifications: true,
  sms_notifications: false,
  push_notifications: true,
  marketing_notifications: false,
  language_code: 'en',
  region: 'Nigeria',
  two_factor_enabled: false,
});

const defaultWallet = (customerId: string): WalletRecord => ({
  customer_id: customerId,
  balance: SHOWCASE_WALLET_BALANCE,
  pending_balance: 0,
  total_funded: SHOWCASE_WALLET_BALANCE,
  total_spent: 0,
  total_withdrawn: 0,
  currency: 'NGN',
  updated_at: new Date().toISOString(),
});

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return 0;
};

const buildReference = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

export async function resolveCustomerId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? DEMO_CUSTOMER_ID;
}

export async function fetchCurrentProfile(customerId?: string | null) {
  const resolvedCustomerId = customerId ?? await resolveCustomerId();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone_number, state, role')
    .eq('id', resolvedCustomerId)
    .maybeSingle();

  if (error) throw error;
  return (data as CustomerProfileRecord | null) ?? null;
}

export async function upsertCustomerProfile(
  customerId: string,
  updates: Partial<CustomerProfileRecord> & { full_name?: string | null; email?: string | null; phone_number?: string | null; state?: string | null }
) {
  const payload = {
    id: customerId,
    role: 'customer',
    ...updates,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, email, full_name, phone_number, state, role')
    .single();

  if (error) throw error;
  return data as CustomerProfileRecord;
}

export async function ensureCustomerSettings(customerId: string) {
  const { data, error } = await supabase
    .from('customer_settings')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as CustomerSettingsRecord;

  const { data: inserted, error: insertError } = await supabase
    .from('customer_settings')
    .upsert(defaultSettings(customerId), { onConflict: 'customer_id' })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted as CustomerSettingsRecord;
}

export async function updateCustomerSettings(customerId: string, updates: Partial<CustomerSettingsRecord>) {
  const { data, error } = await supabase
    .from('customer_settings')
    .upsert({ ...defaultSettings(customerId), ...updates, customer_id: customerId }, { onConflict: 'customer_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as CustomerSettingsRecord;
}

export async function ensureWallet(customerId: string) {
  const { data, error } = await supabase
    .from('customer_wallets')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const normalizedWallet = {
      ...data,
      balance: toNumber(data.balance),
      pending_balance: toNumber(data.pending_balance),
      total_funded: toNumber(data.total_funded),
      total_spent: toNumber(data.total_spent),
      total_withdrawn: toNumber(data.total_withdrawn),
    } as WalletRecord;

    // Showcase mode: keep enough dummy balance in the RENAX wallet so demo
    // shipments can be created without real card/bank funding.
    if (normalizedWallet.balance < SHOWCASE_WALLET_BALANCE) {
      const toppedUpWallet = {
        ...normalizedWallet,
        balance: SHOWCASE_WALLET_BALANCE,
        total_funded: Math.max(normalizedWallet.total_funded, SHOWCASE_WALLET_BALANCE),
        updated_at: new Date().toISOString(),
      };

      const { error: topUpError } = await supabase
        .from('customer_wallets')
        .update({
          balance: toppedUpWallet.balance,
          total_funded: toppedUpWallet.total_funded,
          updated_at: toppedUpWallet.updated_at,
        })
        .eq('customer_id', customerId);

      if (topUpError) throw topUpError;
      return toppedUpWallet;
    }

    return normalizedWallet;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('customer_wallets')
    .upsert(defaultWallet(customerId), { onConflict: 'customer_id' })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return {
    ...inserted,
    balance: toNumber(inserted.balance),
    pending_balance: toNumber(inserted.pending_balance),
    total_funded: toNumber(inserted.total_funded),
    total_spent: toNumber(inserted.total_spent),
    total_withdrawn: toNumber(inserted.total_withdrawn),
  } as WalletRecord;
}

async function appendWalletTransaction(input: {
  customerId: string;
  type: string;
  amount: number;
  status: string;
  reference: string;
  method?: string | null;
  description?: string | null;
  relatedShipmentId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert({
      customer_id: input.customerId,
      type: input.type,
      amount: input.amount,
      status: input.status,
      reference: input.reference,
      method: input.method ?? null,
      description: input.description ?? null,
      related_shipment_id: input.relatedShipmentId ?? null,
      metadata: input.metadata ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as WalletTransactionRecord;
}

export async function fetchWalletSnapshot(customerId: string) {
  const wallet = await ensureWallet(customerId);

  const [{ data: transactions, error: transactionError }, { data: methods, error: methodsError }, { data: bankAccounts, error: bankAccountsError }, { data: withdrawals, error: withdrawalsError }] = await Promise.all([
    supabase
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('payment_methods')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('bank_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('wallet_withdrawals')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (transactionError) throw transactionError;
  if (methodsError) throw methodsError;
  if (bankAccountsError) throw bankAccountsError;
  if (withdrawalsError) throw withdrawalsError;

  return {
    wallet,
    transactions: ((transactions ?? []) as WalletTransactionRecord[]).map((tx) => ({ ...tx, amount: toNumber(tx.amount) })),
    methods: (methods ?? []) as PaymentMethodRecord[],
    bankAccounts: (bankAccounts ?? []) as BankAccountRecord[],
    withdrawals: ((withdrawals ?? []) as WalletWithdrawalRecord[]).map((item) => ({ ...item, amount: toNumber(item.amount) })),
  };
}

export async function savePaymentMethod(customerId: string, input: {
  id?: string;
  type: PaymentMethodRecord['type'];
  provider_name: string;
  label: string;
  account_name?: string | null;
  last4?: string | null;
  expiry_month?: number | null;
  expiry_year?: number | null;
  is_default?: boolean;
  metadata?: Record<string, unknown> | null;
}) {
  const payload = {
    id: input.id,
    customer_id: customerId,
    type: input.type,
    provider_name: input.provider_name,
    label: input.label,
    account_name: input.account_name ?? null,
    last4: input.last4 ?? null,
    expiry_month: input.expiry_month ?? null,
    expiry_year: input.expiry_year ?? null,
    is_default: input.is_default ?? false,
    status: 'active',
    metadata: input.metadata ?? null,
  };

  const { data, error } = await supabase
    .from('payment_methods')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as PaymentMethodRecord;
}

export async function deletePaymentMethod(customerId: string, methodId: string) {
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('customer_id', customerId)
    .eq('id', methodId);

  if (error) throw error;
}

export async function saveBankAccount(customerId: string, input: {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  recipient_code?: string | null;
  is_default?: boolean;
}) {
  const payload = {
    id: input.id,
    customer_id: customerId,
    bank_name: input.bank_name,
    account_name: input.account_name,
    account_number_last4: input.account_number.slice(-4),
    recipient_code: input.recipient_code ?? null,
    is_default: input.is_default ?? false,
  };

  const { data, error } = await supabase
    .from('bank_accounts')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as BankAccountRecord;
}

export async function deleteBankAccount(customerId: string, bankAccountId: string) {
  const { error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('customer_id', customerId)
    .eq('id', bankAccountId);

  if (error) throw error;
}

export async function topUpWalletByCard(customerId: string, amount: number, method: PaymentMethodRecord) {
  if (!amount || amount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  const wallet = await ensureWallet(customerId);
  const nextBalance = wallet.balance + amount;

  const { error } = await supabase
    .from('customer_wallets')
    .update({
      balance: nextBalance,
      total_funded: wallet.total_funded + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId);

  if (error) throw error;

  const reference = buildReference('WLTOP');
  await appendWalletTransaction({
    customerId,
    type: 'deposit',
    amount,
    status: 'success',
    reference,
    method: `card:${method.provider_name}`,
    description: `Wallet funded with ${method.label}`,
    metadata: { payment_method_id: method.id },
  });

  return {
    reference,
    balance: nextBalance,
  };
}

export async function createBankTransferTopUp(customerId: string, amount: number) {
  if (!amount || amount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  const reference = buildReference('BANKTOP');
  await appendWalletTransaction({
    customerId,
    type: 'deposit',
    amount,
    status: 'pending',
    reference,
    method: 'bank_transfer',
    description: 'Awaiting customer bank transfer confirmation',
    metadata: {
      company_bank_name: COMPANY_BANK_NAME,
      company_bank_account: COMPANY_BANK_ACCOUNT,
    },
  });

  return {
    reference,
    bankName: COMPANY_BANK_NAME,
    accountNumber: COMPANY_BANK_ACCOUNT,
  };
}

export async function requestWalletWithdrawal(customerId: string, amount: number, bankAccount: BankAccountRecord, notes?: string) {
  if (!amount || amount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  const wallet = await ensureWallet(customerId);
  if (wallet.balance < amount) {
    throw new Error('Insufficient wallet balance.');
  }

  const reference = buildReference('WDR');
  const nextBalance = wallet.balance - amount;
  const nextPending = wallet.pending_balance + amount;

  const { error: walletError } = await supabase
    .from('customer_wallets')
    .update({
      balance: nextBalance,
      pending_balance: nextPending,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId);

  if (walletError) throw walletError;

  const { error: withdrawalError } = await supabase
    .from('wallet_withdrawals')
    .insert({
      customer_id: customerId,
      bank_account_id: bankAccount.id,
      amount,
      status: 'pending',
      reference,
      notes: notes ?? null,
    });

  if (withdrawalError) throw withdrawalError;

  await appendWalletTransaction({
    customerId,
    type: 'withdrawal',
    amount,
    status: 'pending',
    reference,
    method: `bank:${bankAccount.bank_name}`,
    description: `Withdrawal requested to ${bankAccount.bank_name} •••• ${bankAccount.account_number_last4}`,
    metadata: { bank_account_id: bankAccount.id },
  });

  return { reference };
}

export async function chargeWalletForShipment(customerId: string, shipmentId: string, trackingId: string, amount: number) {
  if (!amount || amount <= 0) {
    throw new Error('Wallet charge amount must be greater than zero.');
  }

  const wallet = await ensureWallet(customerId);
  if (wallet.balance < amount) {
    throw new Error('Your RENAX wallet balance is too low for this shipment.');
  }

  const nextBalance = wallet.balance - amount;

  const { error } = await supabase
    .from('customer_wallets')
    .update({
      balance: nextBalance,
      total_spent: wallet.total_spent + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId);

  if (error) throw error;

  await appendWalletTransaction({
    customerId,
    type: 'payment',
    amount,
    status: 'success',
    reference: buildReference('WLPAY'),
    method: 'wallet',
    description: `Shipment payment for ${trackingId}`,
    relatedShipmentId: shipmentId,
    metadata: { tracking_id: trackingId },
  });
}

export async function fetchCustomerBookings(customerId: string) {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ShipmentRecord[];
}

export async function fetchShipmentDetails(shipmentId: string) {
  const [{ data: shipment, error: shipmentError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from('shipments').select('*').eq('id', shipmentId).single(),
    supabase.from('shipment_events').select('*').eq('shipment_id', shipmentId).order('created_at', { ascending: true }),
  ]);

  if (shipmentError) throw shipmentError;
  if (eventsError) throw eventsError;

  return {
    shipment: shipment as ShipmentRecord,
    events: (events ?? []) as ShipmentEventRecord[],
  };
}

export async function fetchDashboardMetrics(customerId: string): Promise<DashboardMetrics> {
  const [bookings, wallet] = await Promise.all([
    fetchCustomerBookings(customerId),
    ensureWallet(customerId).catch(() => null),
  ]);

  const inTransitCount = bookings.filter((booking) => {
    const stage = booking.dispatch_stage ?? '';
    return ['awaiting_rider_acceptance', 'awaiting_source_terminal', 'received_at_source_terminal', 'linehaul_in_transit', 'received_at_destination_terminal', 'awaiting_final_mile_rider', 'out_for_delivery'].includes(stage);
  }).length;
  const pendingCount = bookings.filter((booking) => {
    const stage = booking.dispatch_stage ?? '';
    const status = booking.status?.toLowerCase() ?? '';
    return stage === 'pending_routing' || status === 'pending';
  }).length;
  const deliveredCount = bookings.filter((booking) => {
    const stage = booking.dispatch_stage ?? '';
    const status = booking.status?.toLowerCase() ?? '';
    return stage === 'delivered' || status === 'delivered';
  }).length;
  const outstandingPayments = bookings.reduce((total, booking) => {
    const status = booking.status?.toLowerCase() ?? '';
    const stage = booking.dispatch_stage ?? '';
    if (stage === 'delivered' || status === 'delivered' || booking.payment_method === 'RENAX Wallet') {
      return total;
    }
    return total + toNumber(booking.estimated_price);
  }, 0);

  const activeShipment = bookings.find((booking) => {
    const stage = booking.dispatch_stage ?? '';
    const status = booking.status?.toLowerCase() ?? '';
    return !['delivered', 'cancelled', 'exception'].includes(stage) && status !== 'delivered' && status !== 'cancelled';
  }) ?? null;

  return {
    inTransitCount,
    pendingCount,
    deliveredCount,
    totalBookings: bookings.length,
    outstandingPayments,
    recentBookings: bookings.slice(0, 5),
    activeShipment,
    wallet,
  };
}
