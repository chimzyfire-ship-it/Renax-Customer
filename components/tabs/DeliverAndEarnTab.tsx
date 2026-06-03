import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  AlertCircle,
  Banknote,
  Car,
  CheckCircle2,
  Clock,
  FileCheck2,
  Power,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react-native';
import {
  fetchDeliverAndEarnSnapshot,
  requestDeliverAndEarnPayout,
  setDeliverAndEarnOnline,
  submitDeliverAndEarnApplication,
  summarizeDeliverAndEarnMoney,
  type DeliverAndEarnApplicationPayload,
  type DeliverAndEarnSnapshot,
  type DeliverAndEarnVehicle,
} from '../../utils/deliverAndEarn';

const formatAmount = (value: number) =>
  `₦${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const VEHICLE_TYPES: { value: DeliverAndEarnVehicle['vehicle_type']; label: string }[] = [
  { value: 'car', label: 'Car' },
  { value: 'suv', label: 'SUV' },
  { value: 'wagon', label: 'Wagon' },
  { value: 'small_van', label: 'Small Van' },
];

const initialForm: DeliverAndEarnApplicationPayload = {
  fullName: '',
  phoneNumber: '',
  operatingState: 'Lagos',
  operatingCity: 'Ikeja',
  vehicleType: 'car',
  make: '',
  model: '',
  vehicleYear: '',
  color: '',
  plateNumber: '',
  ownershipType: 'owned',
  capacityKg: '25',
  submit: false,
};

function statusLabel(value?: string | null) {
  if (!value) return 'Not started';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(value?: string | null) {
  if (value === 'approved' || value === 'active' || value === 'verified' || value === 'completed') return '#047857';
  if (value === 'rejected' || value === 'suspended' || value === 'failed' || value === 'expired') return '#DC2626';
  if (value === 'needs_correction' || value === 'in_review' || value === 'submitted') return '#B45309';
  return '#4B5563';
}

export default function DeliverAndEarnTab() {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const [snapshot, setSnapshot] = useState<DeliverAndEarnSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(initialForm);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDeliverAndEarnSnapshot();
      setSnapshot(data);
      setMessage('');
    } catch (error) {
      console.error('Failed to load Deliver & Earn data', error);
      setMessage('Deliver & Earn is waiting for its foundation migration to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!snapshot?.profile) return;
    const vehicle = snapshot.vehicles[0];
    setForm((current) => ({
      ...current,
      operatingState: snapshot.profile?.operating_state || current.operatingState,
      operatingCity: snapshot.profile?.operating_city || current.operatingCity,
      vehicleType: vehicle?.vehicle_type || current.vehicleType,
      make: vehicle?.make || current.make,
      model: vehicle?.model || current.model,
      vehicleYear: vehicle?.vehicle_year ? String(vehicle.vehicle_year) : current.vehicleYear,
      color: vehicle?.color || current.color,
      plateNumber: vehicle?.plate_number || current.plateNumber,
      ownershipType: vehicle?.ownership_type || current.ownershipType,
      capacityKg: vehicle?.capacity_kg ? String(vehicle.capacity_kg) : current.capacityKg,
    }));
  }, [snapshot?.profile, snapshot?.vehicles]);

  const money = useMemo(
    () => summarizeDeliverAndEarnMoney(snapshot?.earnings ?? []),
    [snapshot?.earnings],
  );

  const profile = snapshot?.profile ?? null;
  const primaryVehicle = snapshot?.vehicles[0] ?? null;
  const isApproved = profile?.application_status === 'approved' && profile.operator_status === 'active';
  const isOnline = Boolean(snapshot?.availability?.is_online);

  const updateField = (key: keyof DeliverAndEarnApplicationPayload, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (submit: boolean) => {
    setSaving(true);
    setMessage('');
    try {
      await submitDeliverAndEarnApplication({ ...form, submit });
      setMessage(submit ? 'Deliver & Earn application submitted for RENAX review.' : 'Draft saved.');
      await loadSnapshot();
    } catch (error) {
      console.error('Deliver & Earn application failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not save Deliver & Earn application.');
    } finally {
      setSaving(false);
    }
  };

  const handleOnlineToggle = async () => {
    if (!isApproved) return;
    setBusyAction('online');
    setMessage('');
    try {
      await setDeliverAndEarnOnline(!isOnline, primaryVehicle?.id);
      await loadSnapshot();
    } catch (error) {
      console.error('Deliver & Earn online toggle failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not update online status.');
    } finally {
      setBusyAction('');
    }
  };

  const handlePayout = async () => {
    setBusyAction('payout');
    setMessage('');
    try {
      await requestDeliverAndEarnPayout();
      setMessage('Payout request submitted for RENAX finance review.');
      await loadSnapshot();
    } catch (error) {
      console.error('Deliver & Earn payout failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not request payout.');
    } finally {
      setBusyAction('');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color="#004d3d" size="large" />
        <Text style={styles.centerText}>Loading Deliver & Earn...</Text>
      </View>
    );
  }

  if (!snapshot?.userId) {
    return (
      <View style={styles.centerState}>
        <ShieldCheck color="#004d3d" size={38} />
        <Text style={styles.centerTitle}>Sign in required</Text>
        <Text style={styles.centerText}>Deliver & Earn applications need a real RENAX account for identity, vehicle, and payout verification.</Text>
      </View>
    );
  }

  const statCards = [
    { label: 'Available', value: formatAmount(money.available), icon: Wallet, color: '#047857' },
    { label: 'Pending', value: formatAmount(money.pending), icon: Clock, color: '#B45309' },
    { label: 'Paid', value: formatAmount(money.paid), icon: Banknote, color: '#004d3d' },
    { label: 'Completed', value: String(profile?.total_completed_shipments ?? 0), icon: CheckCircle2, color: '#2563EB' },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Deliver & Earn</Text>
          <Text style={styles.pageSub}>Register your personal car with RENAX, pass validation, and earn from approved intra-state shipments.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={loadSnapshot}>
          <RefreshCw size={16} color="#004d3d" />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </Animated.View>

      {message ? (
        <View style={styles.notice}>
          <AlertCircle size={16} color="#92400E" />
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}

      <View style={[styles.statusGrid, isCompact && styles.stack]}>
        <View style={styles.statusPanel}>
          <Text style={styles.panelEyebrow}>Application</Text>
          <Text style={[styles.statusValue, { color: statusColor(profile?.application_status) }]}>
            {statusLabel(profile?.application_status)}
          </Text>
          <Text style={styles.panelText}>
            {profile?.approval_notes || 'RENAX reviews identity, licence, car documents, insurance, roadworthiness, and payout readiness before dispatch access.'}
          </Text>
        </View>
        <View style={styles.statusPanel}>
          <Text style={styles.panelEyebrow}>Operator State</Text>
          <Text style={[styles.statusValue, { color: statusColor(profile?.operator_status) }]}>
            {statusLabel(profile?.operator_status)}
          </Text>
          <Text style={styles.panelText}>
            {isApproved ? `Approved for ${profile?.operating_state || 'your state'} Deliver & Earn jobs.` : 'Submit and pass validation before you can go online.'}
          </Text>
        </View>
        <View style={styles.statusPanel}>
          <Text style={styles.panelEyebrow}>Vehicle</Text>
          <Text style={[styles.statusValue, { color: statusColor(primaryVehicle?.vehicle_status) }]}>
            {primaryVehicle ? statusLabel(primaryVehicle.vehicle_status) : 'Not Registered'}
          </Text>
          <Text style={styles.panelText}>
            {primaryVehicle ? `${primaryVehicle.plate_number} ${primaryVehicle.make || ''} ${primaryVehicle.model || ''}` : 'Add your car details below.'}
          </Text>
        </View>
      </View>

      {isApproved ? (
        <>
          <View style={[styles.statsRow, isCompact && styles.stack]}>
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Animated.View key={card.label} entering={FadeInDown.delay(index * 60).duration(300)} style={styles.statCard}>
                  <View>
                    <Text style={styles.statLabel}>{card.label}</Text>
                    <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                  </View>
                  <View style={[styles.statIcon, { backgroundColor: `${card.color}16` }]}>
                    <Icon color={card.color} size={20} />
                  </View>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.operatorPanel}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.panelTitle}>Live Dispatch Access</Text>
              <Text style={styles.panelText}>
                {isOnline ? 'You are online for eligible Deliver & Earn jobs in your approved state.' : 'Go online when your car is ready for RENAX intra-state deliveries.'}
              </Text>
            </View>
            <Pressable
              style={[styles.onlineBtn, isOnline && styles.onlineBtnActive]}
              onPress={handleOnlineToggle}
              disabled={busyAction === 'online'}
            >
              {busyAction === 'online' ? <ActivityIndicator color={isOnline ? '#fff' : '#002B22'} /> : <Power size={18} color={isOnline ? '#fff' : '#002B22'} />}
              <Text style={[styles.onlineBtnText, isOnline && styles.onlineBtnTextActive]}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
            </Pressable>
          </View>

          <View style={styles.operatorPanel}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.panelTitle}>Available Balance</Text>
              <Text style={styles.balanceText}>{formatAmount(money.available)}</Text>
              <Text style={styles.panelText}>Payouts are reviewed by RENAX finance before bank transfer.</Text>
            </View>
            <Pressable
              style={[styles.payoutBtn, money.available <= 0 && styles.disabledBtn]}
              onPress={handlePayout}
              disabled={money.available <= 0 || busyAction === 'payout'}
            >
              {busyAction === 'payout' ? <ActivityIndicator color="#002B22" /> : <Banknote size={18} color="#002B22" />}
              <Text style={styles.payoutBtnText}>Request Payout</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={[styles.mainGrid, isCompact && styles.stack]}>
        <View style={styles.formPanel}>
          <View style={styles.sectionHeader}>
            <FileCheck2 color="#004d3d" size={20} />
            <View>
              <Text style={styles.panelTitle}>Application Details</Text>
              <Text style={styles.panelText}>These details start your RENAX validation.</Text>
            </View>
          </View>

          <Field label="Full Name" value={form.fullName} onChangeText={(value) => updateField('fullName', value)} placeholder="Legal full name" />
          <Field label="Phone Number" value={form.phoneNumber} onChangeText={(value) => updateField('phoneNumber', value)} placeholder="+234..." keyboardType="phone-pad" />
          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Operating State" value={form.operatingState} onChangeText={(value) => updateField('operatingState', value)} placeholder="Lagos" />
            <Field label="Operating City" value={form.operatingCity} onChangeText={(value) => updateField('operatingCity', value)} placeholder="Ikeja" />
          </View>

          <View style={styles.vehicleTypeRow}>
            {VEHICLE_TYPES.map((option) => {
              const active = form.vehicleType === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.vehicleTypeChip, active && styles.vehicleTypeChipActive]}
                  onPress={() => setForm((current) => ({ ...current, vehicleType: option.value }))}
                >
                  <Car size={15} color={active ? '#002B22' : '#004d3d'} />
                  <Text style={[styles.vehicleTypeText, active && styles.vehicleTypeTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.formPanel}>
          <View style={styles.sectionHeader}>
            <Car color="#004d3d" size={20} />
            <View>
              <Text style={styles.panelTitle}>Personal Car</Text>
              <Text style={styles.panelText}>RENAX validates the car before jobs are enabled.</Text>
            </View>
          </View>

          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Make" value={form.make} onChangeText={(value) => updateField('make', value)} placeholder="Toyota" />
            <Field label="Model" value={form.model} onChangeText={(value) => updateField('model', value)} placeholder="Corolla" />
          </View>
          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Year" value={form.vehicleYear} onChangeText={(value) => updateField('vehicleYear', value.replace(/[^0-9]/g, ''))} placeholder="2018" keyboardType="numeric" />
            <Field label="Color" value={form.color} onChangeText={(value) => updateField('color', value)} placeholder="Black" />
          </View>
          <Field label="Plate Number" value={form.plateNumber} onChangeText={(value) => updateField('plateNumber', value.toUpperCase())} placeholder="ABC-123-XY" autoCapitalize="characters" />
          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Ownership Type" value={form.ownershipType} onChangeText={(value) => updateField('ownershipType', value)} placeholder="owned" />
            <Field label="Capacity KG" value={form.capacityKg} onChangeText={(value) => updateField('capacityKg', value.replace(/[^0-9.]/g, ''))} placeholder="25" keyboardType="numeric" />
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.saveBtn} onPress={() => handleSubmit(false)} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={() => handleSubmit(true)} disabled={saving}>
              <ShieldCheck size={17} color="#002B22" />
              <Text style={styles.submitBtnText}>{saving ? 'Submitting...' : 'Submit For Review'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'sentences' }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 36, paddingBottom: 90, gap: 18 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  centerTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#111827' },
  centerText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 4 },
  pageTitle: { fontFamily: 'PlusJakartaSans_8', fontSize: 30, color: '#111827' },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 15, color: '#6B7280', lineHeight: 22, maxWidth: 760, marginTop: 4 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  refreshBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 8, padding: 12 },
  noticeText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#92400E', flex: 1 },
  stack: { flexDirection: 'column' },
  statusGrid: { flexDirection: 'row', gap: 14 },
  statusPanel: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 18, gap: 6 },
  panelEyebrow: { fontFamily: 'Outfit_6', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 22 },
  panelText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#6B7280', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 16 },
  statCard: { flex: 1, minHeight: 92, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 18 },
  statLabel: { fontFamily: 'Outfit_6', fontSize: 12, color: '#6B7280' },
  statValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, marginTop: 5 },
  statIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  operatorPanel: { marginTop: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  panelTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111827' },
  balanceText: { fontFamily: 'PlusJakartaSans_8', fontSize: 28, color: '#004d3d', marginTop: 6 },
  onlineBtn: { minWidth: 136, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: '#ccfd3a', paddingHorizontal: 16, paddingVertical: 13 },
  onlineBtnActive: { backgroundColor: '#004d3d' },
  onlineBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#002B22' },
  onlineBtnTextActive: { color: '#fff' },
  payoutBtn: { minWidth: 156, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: '#ccfd3a', paddingHorizontal: 16, paddingVertical: 13 },
  payoutBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#002B22' },
  disabledBtn: { opacity: 0.45 },
  mainGrid: { flexDirection: 'row', gap: 16, marginTop: 18 },
  formPanel: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 18, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontFamily: 'Outfit_6', fontSize: 12, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Outfit_4', fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  vehicleTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  vehicleTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  vehicleTypeChipActive: { backgroundColor: '#ccfd3a', borderColor: '#ccfd3a' },
  vehicleTypeText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  vehicleTypeTextActive: { color: '#002B22' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 2, flexWrap: 'wrap' },
  saveBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff' },
  saveBtnText: { fontFamily: 'Outfit_7', color: '#374151', fontSize: 14 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ccfd3a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 13 },
  submitBtnText: { fontFamily: 'Outfit_7', color: '#002B22', fontSize: 14 },
});
