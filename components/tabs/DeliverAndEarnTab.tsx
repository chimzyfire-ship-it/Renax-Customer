import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
  Car,
  CheckCircle2,
  Clock,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import {
  createDeliverAndEarnPreviewSnapshot,
  fetchDeliverAndEarnSnapshot,
  submitDeliverAndEarnApplication,
  type DeliverAndEarnApplicationPayload,
  type DeliverAndEarnSnapshot,
  type DeliverAndEarnVehicle,
} from '../../utils/deliverAndEarn';

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

const DEMO_PREVIEW_MESSAGE =
  'This tab cannot see an active RENAX login session yet. You do not need a new account; refresh this page or sign back into the same RENAX account if submission does not continue.';

const REVIEW_WORKFLOW = [
  'Application submitted',
  'Identity, licence, and contact review',
  'Vehicle, insurance, and roadworthiness validation',
  'Payout readiness check',
  'Approval unlocks Rider app access',
];

const RIDER_APP_URL = process.env.EXPO_PUBLIC_RIDER_APP_URL || 'https://renax-rider-deploy-real.vercel.app';

type DeliverAndEarnTabProps = {
  customerId?: string | null;
};

type ActionFeedback = {
  tone: 'success' | 'warning' | 'error';
  text: string;
  nextSteps?: string[];
};

const clean = (value: string) => value.trim();

function validateApplicationForm(form: DeliverAndEarnApplicationPayload, submit: boolean) {
  if (!submit) return '';

  if (!clean(form.fullName)) return 'Enter your legal full name before submitting for review.';
  if (!clean(form.phoneNumber)) return 'Enter a reachable phone number before submitting for review.';
  if (!clean(form.operatingState)) return 'Choose the Nigerian state where this car will operate.';
  if (!clean(form.operatingCity)) return 'Enter the city where this car will operate.';
  if (!clean(form.make)) return 'Enter the vehicle make before submitting for review.';
  if (!clean(form.model)) return 'Enter the vehicle model before submitting for review.';
  if (!clean(form.plateNumber)) return 'Enter the plate number before submitting for review.';

  const year = Number(clean(form.vehicleYear));
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) {
    return `Enter a valid vehicle year between 1990 and ${currentYear + 1}.`;
  }

  const capacity = Number(clean(form.capacityKg));
  if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 1000) {
    return 'Enter a realistic vehicle capacity in KG.';
  }

  return '';
}

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

const SNAPSHOT_LOAD_TIMEOUT_MS = 10000;

export default function DeliverAndEarnTab({ customerId }: DeliverAndEarnTabProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const [snapshot, setSnapshot] = useState<DeliverAndEarnSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [form, setForm] = useState(initialForm);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Promise.race([
        fetchDeliverAndEarnSnapshot(customerId),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Deliver & Earn data load timed out. Refresh this tab or sign in again if the session is stale.')), SNAPSHOT_LOAD_TIMEOUT_MS);
        }),
      ]);
      setSnapshot(data);
      setMessage('');
    } catch (error) {
      console.error('Failed to load Deliver & Earn data', error);
      setSnapshot((current) => current || createDeliverAndEarnPreviewSnapshot(customerId));
      setMessage('Deliver & Earn could not confirm the active login session in this tab. Refresh the page or sign back into the same account.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

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

  const profile = snapshot?.profile ?? null;
  const primaryVehicle = snapshot?.vehicles[0] ?? null;
  const isApproved = profile?.application_status === 'approved' && profile.operator_status === 'active';
  const isDemoPreview = Boolean(snapshot?.isDemoPreview);
  const applicationLocked = ['approved', 'in_review'].includes(profile?.application_status || '');

  const updateField = (key: keyof DeliverAndEarnApplicationPayload, value: string) => {
    setActionFeedback(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (submit: boolean) => {
    const validationError = validateApplicationForm(form, submit);
    if (validationError) {
      setActionFeedback({ tone: 'error', text: validationError });
      return;
    }

    if (isDemoPreview) {
      setActionFeedback({
        tone: 'warning',
        text: submit
          ? 'This tab cannot see your active RENAX login session. You do not need to create another account; refresh this page or sign out and sign back into this same account, then submit again.'
          : 'This tab cannot save to RENAX yet because the active login session is not visible here. Refresh or sign back into this same account.',
      });
      return;
    }

    setSaving(true);
    setMessage('');
    setActionFeedback({
      tone: 'warning',
      text: submit ? 'Submitting your Deliver & Earn application to RENAX review...' : 'Saving your Deliver & Earn draft...',
    });

    try {
      const result = await submitDeliverAndEarnApplication({ ...form, submit });
      setActionFeedback({
        tone: 'success',
        text: submit
          ? `Application submitted. Status: ${statusLabel(result.application_status)}. Vehicle: ${statusLabel(result.vehicle_status)}.`
          : 'Draft saved. You can return and submit it for review when the car details are complete.',
        nextSteps: submit ? result.next_steps || REVIEW_WORKFLOW.slice(1) : undefined,
      });
      await loadSnapshot();
    } catch (error) {
      console.error('Deliver & Earn application failed', error);
      setActionFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not save Deliver & Earn application.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !snapshot) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color="#004d3d" size="large" />
        <Text style={styles.centerText}>Loading Deliver & Earn...</Text>
      </View>
    );
  }

  const actionNoticeStyle = actionFeedback?.tone === 'success'
    ? styles.successNotice
    : actionFeedback?.tone === 'error'
      ? styles.errorNotice
      : styles.warningNotice;
  const actionNoticeTextStyle = actionFeedback?.tone === 'success'
    ? styles.successNoticeText
    : actionFeedback?.tone === 'error'
      ? styles.errorNoticeText
      : styles.warningNoticeText;

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

      {isDemoPreview ? (
        <View style={styles.previewNotice}>
          <ShieldCheck size={16} color="#004d3d" />
          <Text style={styles.previewNoticeText}>{DEMO_PREVIEW_MESSAGE}</Text>
        </View>
      ) : null}

      {message ? (
        <View style={styles.notice}>
          <AlertCircle size={16} color="#92400E" />
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.refreshingPill}>
          <ActivityIndicator color="#004d3d" size="small" />
          <Text style={styles.refreshingText}>Refreshing Deliver & Earn...</Text>
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
            {isApproved ? `Approved for ${profile?.operating_state || 'your state'}. Delivery work now happens in the Rider app.` : 'Submit and pass validation before Rider app access is enabled.'}
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

      <View style={styles.workflowPanel}>
        <View style={styles.workflowHeader}>
          <ShieldCheck size={18} color="#004d3d" />
          <Text style={styles.workflowTitle}>Registration Workflow</Text>
        </View>
        <View style={[styles.workflowSteps, isCompact && styles.stack]}>
          {REVIEW_WORKFLOW.map((step, index) => (
            <View key={step} style={styles.workflowStep}>
              <View style={[styles.workflowBadge, index === 0 && styles.workflowBadgeActive]}>
                <Text style={[styles.workflowBadgeText, index === 0 && styles.workflowBadgeTextActive]}>{index + 1}</Text>
              </View>
              <Text style={styles.workflowStepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      {isApproved ? (
        <View style={styles.handoffPanel}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.panelTitle}>Rider App Handoff</Text>
            <Text style={styles.panelText}>
              Your customer application is approved. RENAX operations will issue a secure Rider app invite, and that Rider login will show only Deliver & Earn tools for this personal car.
            </Text>
          </View>
          <Pressable style={styles.riderAppBtn} onPress={() => Linking.openURL(RIDER_APP_URL)}>
            <Car size={18} color="#002B22" />
            <Text style={styles.riderAppBtnText}>Open Rider App</Text>
          </Pressable>
        </View>
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

          <Field label="Full Name" value={form.fullName} onChangeText={(value) => updateField('fullName', value)} placeholder="Legal full name" editable={!applicationLocked} />
          <Field label="Phone Number" value={form.phoneNumber} onChangeText={(value) => updateField('phoneNumber', value)} placeholder="+234..." keyboardType="phone-pad" editable={!applicationLocked} />
          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Operating State" value={form.operatingState} onChangeText={(value) => updateField('operatingState', value)} placeholder="Lagos" editable={!applicationLocked} />
            <Field label="Operating City" value={form.operatingCity} onChangeText={(value) => updateField('operatingCity', value)} placeholder="Ikeja" editable={!applicationLocked} />
          </View>

          <View style={styles.vehicleTypeRow}>
            {VEHICLE_TYPES.map((option) => {
              const active = form.vehicleType === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.vehicleTypeChip, active && styles.vehicleTypeChipActive]}
                  disabled={applicationLocked}
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
            <Field label="Make" value={form.make} onChangeText={(value) => updateField('make', value)} placeholder="Toyota" editable={!applicationLocked} />
            <Field label="Model" value={form.model} onChangeText={(value) => updateField('model', value)} placeholder="Corolla" editable={!applicationLocked} />
          </View>
          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Year" value={form.vehicleYear} onChangeText={(value) => updateField('vehicleYear', value.replace(/[^0-9]/g, ''))} placeholder="2018" keyboardType="numeric" editable={!applicationLocked} />
            <Field label="Color" value={form.color} onChangeText={(value) => updateField('color', value)} placeholder="Black" editable={!applicationLocked} />
          </View>
          <Field label="Plate Number" value={form.plateNumber} onChangeText={(value) => updateField('plateNumber', value.toUpperCase())} placeholder="ABC-123-XY" autoCapitalize="characters" editable={!applicationLocked} />
          <View style={[styles.fieldRow, isCompact && styles.stack]}>
            <Field label="Ownership Type" value={form.ownershipType} onChangeText={(value) => updateField('ownershipType', value)} placeholder="owned" editable={!applicationLocked} />
            <Field label="Capacity KG" value={form.capacityKg} onChangeText={(value) => updateField('capacityKg', value.replace(/[^0-9.]/g, ''))} placeholder="25" keyboardType="numeric" editable={!applicationLocked} />
          </View>

          {!applicationLocked ? (
            <View style={styles.actionRow}>
              <Pressable style={styles.saveBtn} onPress={() => handleSubmit(false)} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
              </Pressable>
              <Pressable style={[styles.submitBtn, saving && styles.disabledBtn]} onPress={() => handleSubmit(true)} disabled={saving}>
                {saving ? <ActivityIndicator color="#002B22" size="small" /> : <ShieldCheck size={17} color="#002B22" />}
                <Text style={styles.submitBtnText}>{saving ? 'Submitting...' : 'Submit For Review'}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.lockedNotice}>
              <ShieldCheck size={16} color="#047857" />
              <Text style={styles.lockedNoticeText}>This application is locked while RENAX review or approved Rider access is active.</Text>
            </View>
          )}
          {actionFeedback ? (
            <View style={[styles.actionNotice, actionNoticeStyle]}>
              {actionFeedback.tone === 'success' ? (
                <CheckCircle2 size={17} color="#047857" />
              ) : actionFeedback.tone === 'error' ? (
                <AlertCircle size={17} color="#DC2626" />
              ) : (
                <Clock size={17} color="#B45309" />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.actionNoticeText, actionNoticeTextStyle]}>{actionFeedback.text}</Text>
                {actionFeedback.nextSteps?.length ? (
                  <View style={styles.nextStepsList}>
                    {actionFeedback.nextSteps.map((step) => (
                      <Text key={step} style={styles.nextStepText}>• {step}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
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
  editable?: boolean;
};

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', editable = true }: FieldProps) {
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
        editable={editable}
        style={[styles.input, !editable && styles.inputReadonly]}
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
  previewNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, padding: 12 },
  previewNoticeText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#004d3d', flex: 1, lineHeight: 19 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 8, padding: 12 },
  noticeText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#92400E', flex: 1 },
  refreshingPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  refreshingText: { fontFamily: 'Outfit_7', color: '#047857', fontSize: 12 },
  stack: { flexDirection: 'column' },
  statusGrid: { flexDirection: 'row', gap: 14 },
  statusPanel: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 18, gap: 6 },
  panelEyebrow: { fontFamily: 'Outfit_6', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 22 },
  panelText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#6B7280', lineHeight: 20 },
  workflowPanel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 8, padding: 16, gap: 12 },
  workflowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  workflowTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111827' },
  workflowSteps: { flexDirection: 'row', gap: 10 },
  workflowStep: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  workflowBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  workflowBadgeActive: { backgroundColor: '#ccfd3a' },
  workflowBadgeText: { fontFamily: 'Outfit_7', fontSize: 11, color: '#4B5563' },
  workflowBadgeTextActive: { color: '#002B22' },
  workflowStepText: { flex: 1, fontFamily: 'Outfit_6', fontSize: 12, color: '#374151', lineHeight: 17 },
  handoffPanel: { marginTop: 16, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  panelTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111827' },
  riderAppBtn: { minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: '#ccfd3a', paddingHorizontal: 16, paddingVertical: 13 },
  riderAppBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#002B22' },
  disabledBtn: { opacity: 0.45 },
  mainGrid: { flexDirection: 'row', gap: 16, marginTop: 18 },
  formPanel: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 18, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontFamily: 'Outfit_6', fontSize: 12, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Outfit_4', fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  inputReadonly: { backgroundColor: '#F3F4F6', color: '#6B7280' },
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
  actionNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 2 },
  warningNotice: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  successNotice: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  errorNotice: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  actionNoticeText: { fontFamily: 'Outfit_6', fontSize: 13, lineHeight: 19 },
  warningNoticeText: { color: '#92400E' },
  successNoticeText: { color: '#047857' },
  errorNoticeText: { color: '#DC2626' },
  nextStepsList: { marginTop: 8, gap: 4 },
  nextStepText: { fontFamily: 'Outfit_4', fontSize: 12, color: '#374151', lineHeight: 18 },
  lockedNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, padding: 12 },
  lockedNoticeText: { flex: 1, fontFamily: 'Outfit_6', fontSize: 13, color: '#047857', lineHeight: 19 },
});
