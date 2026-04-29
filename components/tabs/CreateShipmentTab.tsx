// CreateShipmentTab.tsx — fully functional with Supabase integration
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  useWindowDimensions, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import {
  ChevronDown, MapPin, Phone, RotateCcw, X, Bike, Truck, Package, Check, CheckCircle2, Download, FileText
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../supabase';
import OSMAutocomplete from '../OSMAutocomplete';
import { getActualDrivingDistance } from '../../utils/mapService';
import { chargeWalletForShipment, DEMO_CUSTOMER_ID } from '../../utils/customerData';
import { logShipmentEvent, resolveRouting } from '../../utils/routingService';

// ─── Constants ────────────────────────────────────────────────────────────────
const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
];

const detectShipmentType = (pickup: string, delivery: string): 'intra_state' | 'inter_state' => {
  const getState = (addr: string) => NIGERIAN_STATES.find(s => addr.toLowerCase().includes(s.toLowerCase())) || '';
  const ps = getState(pickup);
  const ds = getState(delivery);
  return ps && ds && ps === ds ? 'intra_state' : 'inter_state';
};

const STEPS = ['Sender', 'Recipient', 'Package & Service'];

const SERVICES = [
  { id: 'Express Bike',    label: 'Express Bike Delivery',   icon: Bike,    sub: 'Service Level • Fast speed' },
  { id: 'Standard Van',   label: 'Standard Van Freight',    icon: Truck,   sub: 'Service Level • Standard speed' },
  { id: 'Priority Cargo', label: 'Priority Cargo Haulage',  icon: Package, sub: 'Service Level • Heavy loads' },
];

const PACKAGE_CATEGORIES = [
  'Document',
  'Small Box (1-5kg)',
  'Medium Box (5-15kg)',
  'Large Freight (15kg+)',
  'Fragile/Sensitive',
];

const PAYMENT_METHODS = [
  'RENAX Wallet',
  'Credit/Debit Card',
  'Pay on Delivery',
];

const PRICING_FACTORS = {
  baseFare: 1500,
  perKg: 200,
  fuelSurcharge: 500, // Dynamic factor admin can change
  serviceMultipliers: {
    'Express Bike': 1.0,
    'Standard Van': 1.5,
    'Priority Cargo': 2.5,
  } as Record<string, number>,
};

// ─── Reusable Modal Picker ─────────────────────────────────────────────────────
interface PickerModalProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, selected, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                style={styles.modalOption}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[styles.modalOptionText, item === selected && styles.modalOptionActive]}>
                  {item}
                </Text>
                {item === selected && <Check color="#004d3d" size={16} />}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CreateShipmentTab({ customerId }: { customerId?: string | null }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;

  // Sender
  const [senderName, setSenderName]         = useState('');
  const [senderPhone, setSenderPhone]       = useState('');
  const [pickupData, setPickupData]         = useState<{ address: string; lat: number; lon: number } | null>(null);
  const [pickupLandmark, setPickupLandmark] = useState('');
  const [showPickupLandmark, setShowPickupLandmark] = useState(false);

  // Recipient
  const [recipientName, setRecipientName]       = useState('');
  const [recipientPhone, setRecipientPhone]     = useState('');
  const [deliveryData, setDeliveryData]         = useState<{ address: string; lat: number; lon: number } | null>(null);
  const [deliveryLandmark, setDeliveryLandmark] = useState('');

  // Package & Service
  const [weight, setWeight]             = useState('');
  const [dims, setDims]                 = useState('');
  const [category, setCategory]         = useState('');
  const [serviceSelected, setServiceSelected] = useState('Standard Van');
  const [payMethod, setPayMethod]       = useState('');
  const [packageDescription, setPackageDescription] = useState('');

  // Modals & Submit State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [formError, setFormError] = useState('');
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  // Rider search state
  const [searchingRiders, setSearchingRiders] = useState(false);
  const [noRidersFound, setNoRidersFound] = useState(false);

  // Pickers visibility
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker]   = useState(false);

  // Submit state
  const [loading, setLoading] = useState(false);

  // ── Derived State & Calculations ─────────────────────────────────────────────
  const isStep1Complete = !!(senderName && senderPhone && pickupData);
  const isStep2Complete = !!(recipientName && recipientPhone && deliveryData && deliveryLandmark);
  const isStep3Complete = !!(weight && category && serviceSelected && payMethod && packageDescription);

  let currentStep = 0;
  if (isStep1Complete) currentStep = 1;
  if (isStep1Complete && isStep2Complete) currentStep = 2;

  // Fetch actual distance when both addresses are selected
  React.useEffect(() => {
    const fetchDistance = async () => {
      if (pickupData && deliveryData) {
        setIsCalculating(true);
        const distance = await getActualDrivingDistance(pickupData, deliveryData);
        setActualDistance(distance);
        setIsCalculating(false);
      } else {
        setActualDistance(null);
      }
    };
    fetchDistance();
  }, [pickupData, deliveryData]);

  const estimatedPrice = React.useMemo(() => {
    let price = PRICING_FACTORS.baseFare + PRICING_FACTORS.fuelSurcharge;
    
    if (actualDistance !== null) {
      price += actualDistance * 100; // e.g. ₦100 per km
    }

    const w = parseFloat(weight) || 0;
    price += (w * PRICING_FACTORS.perKg);
    price *= (PRICING_FACTORS.serviceMultipliers[serviceSelected] || 1);
    
    if (category === 'Fragile/Sensitive') price += 1000;
    if (category === 'Large Freight (15kg+)') price += 2000;
    
    return Math.round(price);
  }, [weight, category, serviceSelected, actualDistance]);

  const handleRecalculate = async () => {
    setIsCalculating(true);
    if (pickupData && deliveryData) {
      const distance = await getActualDrivingDistance(pickupData, deliveryData);
      setActualDistance(distance);
    }
    setTimeout(() => setIsCalculating(false), 600);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreateShipment = async () => {
    setFormError('');
    // Validate required fields explicitly so the user knows what is missing
    if (!isStep1Complete) {
      setFormError('Please complete all required Sender Details (Step 1).');
      return;
    }
    if (!isStep2Complete) {
      setFormError('Please complete all required Recipient Details, including Delivery Landmark (Step 2).');
      return;
    }
    if (!isStep3Complete) {
      setFormError('Please complete all required Package Details, including Package Description (Step 3).');
      return;
    }

    setLoading(true);
    try {
      // Waterfall auth: prop → live session → dev mock
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId) {
        const { data: { user } } = await supabase.auth.getUser();
        resolvedCustomerId = user?.id ?? null;
      }
      // Final fallback for porous/dev auth — use a stable test UUID
      if (!resolvedCustomerId) {
        resolvedCustomerId = DEMO_CUSTOMER_ID;
      }

      if (payMethod === 'RENAX Wallet' && estimatedPrice <= 0) {
        throw new Error('This shipment cannot be charged to wallet until pricing is available.');
      }

      const routing = await resolveRouting(
        pickupData?.address || '',
        deliveryData?.address || ''
      );

      // Generate Order ID
      const generatedId = `RNX-${Math.floor(100000 + Math.random() * 900000)}`;
      const shipmentType = detectShipmentType(
        pickupData?.address || '',
        deliveryData?.address || ''
      );
      
      const { data: createdShipment, error } = await supabase
        .from('shipments')
        .insert({
          customer_id:       resolvedCustomerId,
          tracking_id:       generatedId,
          sender_name:       senderName,
          sender_phone:      senderPhone,
          pickup_address:    pickupData?.address || '',
          pickup_landmark:   pickupLandmark,
          pickup_lat:        pickupData?.lat || null,
          pickup_lon:        pickupData?.lon || null,
          recipient_name:    recipientName,
          recipient_phone:   recipientPhone,
          delivery_address:  deliveryData?.address || '',
          delivery_landmark: deliveryLandmark,
          delivery_lat:      deliveryData?.lat || null,
          delivery_lon:      deliveryData?.lon || null,
          distance_km:       actualDistance || null,
          weight_kg:         parseFloat(weight),
          dimensions_cm:     dims || null,
          package_category:  category,
          service_level:     serviceSelected,
          payment_method:    payMethod,
          estimated_price:   estimatedPrice,
          shipment_type:     shipmentType,
          status:            'Pending',
          routing_mode:      routing.routing_mode,
          dispatch_stage:    routing.dispatch_stage,
          pickup_state:      routing.pickup_state,
          pickup_city:       routing.pickup_city,
          delivery_state:    routing.delivery_state,
          delivery_city:     routing.delivery_city,
          source_terminal_id: routing.source_terminal_id,
          destination_terminal_id: routing.destination_terminal_id,
          package_description: packageDescription,
        })
        .select('id, tracking_id, routing_mode, dispatch_stage')
        .single();

      if (error) throw error;

      if (createdShipment?.id) {
        await logShipmentEvent(
          createdShipment.id,
          routing.dispatch_stage,
          routing.routing_mode === 'relay_terminal'
            ? 'RENAX Routing Engine'
            : pickupData?.address || null || undefined,
          resolvedCustomerId,
          'customer',
          routing.reason
        );
      }

      if (payMethod === 'RENAX Wallet' && createdShipment?.id) {
        await chargeWalletForShipment(
          resolvedCustomerId,
          createdShipment.id,
          createdShipment.tracking_id || generatedId,
          estimatedPrice
        );
      }

      setCreatedOrderId(generatedId);
      setShowReceiptModal(true);

      // Only search for riders when the routing engine sends the job to the local marketplace.
      if (routing.routing_mode === 'last_mile_local') {
        setSearchingRiders(true);
        setNoRidersFound(false);
        setTimeout(async () => {
          const { data } = await supabase
            .from('shipments')
            .select('assigned_rider_id, dispatch_stage')
            .eq('tracking_id', generatedId)
            .single();
          setSearchingRiders(false);
          if (!data?.assigned_rider_id && data?.dispatch_stage === 'awaiting_rider_acceptance') {
            setNoRidersFound(true);
          }
        }, 30000);
      }
    } catch (err: any) {
      console.error("Database Insert Error:", err);
      setFormError(`Database Error: ${err?.message || 'Failed to connect. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const shipType = detectShipmentType(pickupData?.address || '', deliveryData?.address || '');
    const isIntra = shipType === 'intra_state';
    const dateStr = new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>RENAX Receipt - ${createdOrderId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; display: flex; justify-content: center; padding: 40px 20px; }
    .receipt { background: #fff; width: 600px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
    .header { background: #004d3d; padding: 32px; text-align: center; }
    .logo-text { color: #ccfd3a; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
    .logo-sub { color: rgba(204,253,58,0.6); font-size: 12px; letter-spacing: 4px; margin-top: 4px; }
    .order-box { background: #ccfd3a; margin: 28px; border-radius: 12px; padding: 20px; text-align: center; }
    .order-label { color: #004d3d; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
    .order-id { color: #002B22; font-size: 28px; font-weight: 900; letter-spacing: 3px; margin: 6px 0; }
    .type-badge { display: inline-block; background: ${isIntra ? '#004d3d' : '#B45309'}; color: #ccfd3a; font-size: 10px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 20px; margin-top: 6px; }
    .section { padding: 0 28px 20px; }
    .section-title { font-size: 11px; font-weight: 700; color: #aaa; letter-spacing: 2px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
    .row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #f8f8f8; }
    .row-label { font-size: 13px; color: #777; }
    .row-value { font-size: 13px; color: #222; font-weight: 600; text-align: right; max-width: 55%; }
    .total-row { display: flex; justify-content: space-between; padding: 16px 28px; background: #f0fdf4; margin: 0 0; }
    .total-label { font-size: 15px; font-weight: 700; color: #222; }
    .total-value { font-size: 22px; font-weight: 900; color: #004d3d; }
    .footer { background: #004d3d; padding: 20px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.5); font-size: 11px; line-height: 1.8; }
    .footer strong { color: #ccfd3a; }
    @media print { body { background: white; padding: 0; } .receipt { box-shadow: none; border-radius: 0; width: 100%; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo-text">RENAX</div>
      <div class="logo-sub">LOGISTICS</div>
    </div>
    <div class="order-box">
      <div class="order-label">TRACKING / ORDER ID</div>
      <div class="order-id">${createdOrderId}</div>
      <div class="type-badge">${isIntra ? 'INTRA-STATE — LIVE TRACKING' : 'INTER-STATE — TERMINAL RELAY'}</div>
    </div>
    <div class="section">
      <div class="section-title">SENDER DETAILS</div>
      <div class="row"><span class="row-label">Name</span><span class="row-value">${senderName}</span></div>
      <div class="row"><span class="row-label">Phone</span><span class="row-value">${senderPhone}</span></div>
      <div class="row"><span class="row-label">Pickup Address</span><span class="row-value">${pickupData?.address || ''}</span></div>
      ${pickupLandmark ? `<div class="row"><span class="row-label">Pickup Landmark</span><span class="row-value">${pickupLandmark}</span></div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">RECIPIENT DETAILS</div>
      <div class="row"><span class="row-label">Name</span><span class="row-value">${recipientName}</span></div>
      <div class="row"><span class="row-label">Phone</span><span class="row-value">${recipientPhone}</span></div>
      <div class="row"><span class="row-label">Delivery Address</span><span class="row-value">${deliveryData?.address || ''}</span></div>
      <div class="row"><span class="row-label">Delivery Landmark</span><span class="row-value">${deliveryLandmark}</span></div>
    </div>
    <div class="section">
      <div class="section-title">SHIPMENT DETAILS</div>
      <div class="row"><span class="row-label">Package</span><span class="row-value">${weight}kg — ${category}</span></div>
      <div class="row"><span class="row-label">Description</span><span class="row-value">${packageDescription}</span></div>
      <div class="row"><span class="row-label">Service Level</span><span class="row-value">${serviceSelected}</span></div>
      <div class="row"><span class="row-label">Distance</span><span class="row-value">${actualDistance ? actualDistance + ' km' : 'N/A'}</span></div>
      <div class="row"><span class="row-label">Payment Method</span><span class="row-value">${payMethod}</span></div>
      <div class="row"><span class="row-label">Date</span><span class="row-value">${dateStr}</span></div>
    </div>
    <div class="total-row">
      <span class="total-label">Total Amount</span>
      <span class="total-value">&#8358;${estimatedPrice.toLocaleString()}</span>
    </div>
    <div class="footer">
      <p><strong>RENAX Logistics</strong><br/>Thank you for shipping with us.<br/>For support: support@renax.ng | +234 800 RENAX</p>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  // ── Step indicator ───────────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((s, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.stepDotWrap}>
              <View style={[styles.stepDot, isCompleted && styles.stepDotActive, isCurrent && styles.stepDotCurrent]}>
                {isCompleted && <Check color="#fff" size={14} />}
              </View>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive]}>{s}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[styles.stepLine, isCompleted && styles.stepLineDone]} />}
          </View>
        );
      })}
    </View>
  );

  // ── Smart Input Wrapper ──────────────────────────────────────────────────────
  const renderSmartInput = (props: any, value: string, icon?: React.ReactNode, extraStyle?: any) => (
    <View style={[styles.inputWrap, value ? styles.inputWrapFilled : null, extraStyle]}>
      <TextInput
        placeholderTextColor="#aaa"
        style={styles.input}
        value={value}
        {...props}
      />
      {icon}
      {value ? <CheckCircle2 color="#10B981" size={16} style={{ marginLeft: 6 }} /> : null}
    </View>
  );

  // ── SelectBox (tap to open modal) ────────────────────────────────────────────
  const SelectBox = ({ value, placeholder, onPress }: { value: string; placeholder: string; onPress: () => void }) => (
    <Pressable style={styles.select} onPress={onPress}>
      <Text style={[styles.selectText, !value && { color: '#aaa' }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <ChevronDown color="#666" size={16} />
    </Pressable>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 100 }}>
      {/* Modals */}
      <PickerModal
        visible={showCategoryPicker}
        title="Package Category"
        options={PACKAGE_CATEGORIES}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />
      <PickerModal
        visible={showPaymentPicker}
        title="Payment Method"
        options={PAYMENT_METHODS}
        selected={payMethod}
        onSelect={setPayMethod}
        onClose={() => setShowPaymentPicker(false)}
      />

      {/* Page header */}
      <Text style={styles.pageTitle}>Create New Shipment</Text>
      <View style={styles.stepRow}>
        <Text style={styles.stepCrumb}>Step {currentStep + 1} of 3: {STEPS[currentStep]}</Text>
        {renderStepIndicator()}
      </View>
      <Text style={styles.orderType}>Create New Shipment (Single Order)</Text>

      {/* ── Sender & Recipient ── */}
      <View style={[styles.formGrid, isMobile && { flexDirection: 'column' }]}>
        {/* Sender */}
        <View style={[styles.formCard, isStep1Complete && styles.formCardComplete]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>1. Sender Details</Text>
            {isStep1Complete && <CheckCircle2 color="#10B981" size={20} />}
          </View>
          <View style={styles.row}>
            {renderSmartInput({
              placeholder: "Sender Full Name",
              onChangeText: setSenderName,
            }, senderName, null, { flex: 1 })}
            {renderSmartInput({
              placeholder: "Phone Number",
              onChangeText: setSenderPhone,
              keyboardType: "phone-pad"
            }, senderPhone, <Phone color="#004d3d" size={16} />, { maxWidth: 180 })}
          </View>
          <Text style={styles.fieldNoteTitle}>Pickup Address (Autofill Predictive Input)</Text>
          <Text style={styles.fieldNote}>Courier needs landmark near your location.</Text>
          <OSMAutocomplete
            placeholder="Search Pickup Address..."
            onSelect={setPickupData}
            icon={<MapPin color="#004d3d" size={16} />}
          />
          
          <Pressable style={styles.landmarkBtn} onPress={() => setShowPickupLandmark(v => !v)}>
            <Text style={styles.landmarkBtnText}>+ ADD pickup LANDMARK (optional)</Text>
          </Pressable>
          {showPickupLandmark && renderSmartInput({
            placeholder: "e.g. Near GTBank, Rumuola junction",
            onChangeText: setPickupLandmark,
          }, pickupLandmark, null, { marginTop: 8 })}
        </View>

        {/* Recipient */}
        <View style={[styles.formCard, isStep2Complete && styles.formCardComplete]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>2. Recipient Details</Text>
            {isStep2Complete && <CheckCircle2 color="#10B981" size={20} />}
          </View>
          <View style={styles.row}>
            {renderSmartInput({
              placeholder: "Full Name",
              onChangeText: setRecipientName,
            }, recipientName, null, { flex: 1 })}
            {renderSmartInput({
              placeholder: "Phone Number",
              onChangeText: setRecipientPhone,
              keyboardType: "phone-pad"
            }, recipientPhone, <Phone color="#004d3d" size={16} />, { flex: 1 })}
          </View>
          <Text style={styles.fieldNoteTitle}>Delivery Address (Autofill Input)</Text>
          <OSMAutocomplete
            placeholder="Search Delivery Address..."
            onSelect={setDeliveryData}
            icon={<MapPin color="#004d3d" size={16} />}
          />
          
          <View style={[styles.landmarkRequiredBox, deliveryLandmark ? { borderColor: '#10B981', backgroundColor: '#F0FDF4' } : null]}>
            <Text style={[styles.landmarkReqTitle, deliveryLandmark ? { color: '#047857' } : null]}>ADD DELIVERY LANDMARK (Required)</Text>
            <TextInput
              placeholder="e.g. near PH Refinery, specific address landmark needed"
              placeholderTextColor={deliveryLandmark ? "#047857" : "#c2862e"}
              style={[styles.input, { marginTop: 4, color: deliveryLandmark ? '#064E3B' : '#92400E' }]}
              value={deliveryLandmark}
              onChangeText={setDeliveryLandmark}
            />
          </View>
        </View>
      </View>

      {/* ── Package & Service ── */}
      <View style={[styles.formGrid, isMobile && { flexDirection: 'column' }]}>
        <View style={[styles.formCard, isStep3Complete && styles.formCardComplete]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>3. Package &amp; Service Details</Text>
            {isStep3Complete && <CheckCircle2 color="#10B981" size={20} />}
          </View>
          <View style={styles.packageMetaGrid}>
            <View style={styles.packageMetaField}>
              <Text style={styles.fieldNoteTitle}>Weight (kg)</Text>
              {renderSmartInput({
                placeholder: "kg",
                onChangeText: setWeight,
                keyboardType: "numeric",
              }, weight)}
            </View>
            <View style={[styles.packageMetaField, styles.packageMetaFieldWide]}>
              <Text style={styles.fieldNoteTitle}>Dimensions (cm) - Optional</Text>
              {renderSmartInput({
                placeholder: "L x W x H cm",
                onChangeText: setDims,
              }, dims)}
            </View>
            <View style={styles.packageMetaField}>
              <Text style={styles.fieldNoteTitle}>Package Category</Text>
              <SelectBox
                value={category}
                placeholder="Select category..."
                onPress={() => setShowCategoryPicker(true)}
              />
            </View>
          </View>
          
          <Text style={[styles.fieldNoteTitle, { marginTop: 8 }]}>Package Description (Required)</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap, packageDescription ? styles.inputWrapFilled : null]}>
            <TextInput
              placeholder="Manually type in package description (e.g. 2 Laptops, 1 Printer)"
              placeholderTextColor="#aaa"
              style={[styles.input, styles.textAreaInput]}
              value={packageDescription}
              onChangeText={setPackageDescription}
              multiline
            />
          </View>
        </View>

        {/* Service Selector */}
        <View style={[styles.formCard, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Service Selector</Text>
          <View style={styles.serviceRow}>
            {SERVICES.map(s => {
              const Icon = s.icon;
              const active = serviceSelected === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setServiceSelected(s.id)}
                  style={[styles.serviceCard, active && styles.serviceCardActive]}
                >
                  <Icon color={active ? '#ccfd3a' : '#666'} size={28} />
                  <Text style={[styles.serviceLabel, active && { color: '#ccfd3a' }]}>{s.label}</Text>
                  <Text style={styles.serviceSub}>{s.sub}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.pmRow}>
            <Text style={styles.fieldNoteTitle}>Payment Method</Text>
            <SelectBox
              value={payMethod}
              placeholder="Select payment method..."
              onPress={() => setShowPaymentPicker(true)}
            />
          </View>
        </View>
      </View>

      {/* ── Summary Bar ── */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>Shipment Summary &amp; Price</Text>
          <Text style={styles.summaryLine}>
            {pickupData ? pickupData.address.split(',')[0] : 'Pickup Address'} → {deliveryData ? deliveryData.address.split(',')[0] : 'Delivery Address'}
          </Text>
          {actualDistance && <Text style={[styles.summaryLine, { color: '#004d3d', marginTop: 4, fontFamily: 'Outfit_6' }]}>Actual Distance: {actualDistance} km</Text>}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.summaryLine}>Service Level: {serviceSelected}</Text>
          {category ? <Text style={styles.summaryLine}>Category: {category}</Text> : null}
          {payMethod ? <Text style={styles.summaryLine}>Payment: {payMethod}</Text> : null}
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Estimated Price:</Text>
          {isCalculating ? (
            <ActivityIndicator color="#004d3d" size="small" style={{ marginVertical: 4 }} />
          ) : (
            <Text style={styles.priceValue}>₦{estimatedPrice.toLocaleString()}</Text>
          )}
        </View>
        <Pressable style={[styles.recalcBtn, isCalculating && { opacity: 0.7 }]} onPress={handleRecalculate} disabled={isCalculating}>
          <RotateCcw color="#004d3d" size={16} />
          <Text style={styles.recalcText}>RECALCULATE PRICE</Text>
        </Pressable>
      </Animated.View>

      {/* ── CTA Row ── */}
      {formError ? (
        <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' }}>
          <Text style={{ color: '#DC2626', textAlign: 'center', fontFamily: 'Outfit_6', fontSize: 14 }}>
            {formError}
          </Text>
        </View>
      ) : null}
      <View style={styles.ctaRow}>
        <Pressable
          style={[styles.createBtn, loading && { opacity: 0.7 }]}
          onPress={handleCreateShipment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ccfd3a" size="small" />
          ) : (
            <FileText color="#fff" size={18} />
          )}
          <Text style={styles.createBtnText}>
            {loading ? 'CREATING...' : 'CREATE SHIPMENT & GET ORDER ID'}
          </Text>
        </Pressable>
        <Pressable style={styles.cancelBtn}>
          <X color="#666" size={16} />
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
      </View>

            {/* -- Receipt & Confirmation Modal -- */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptModal}>
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <CheckCircle2 color="#10B981" size={50} style={{ marginBottom: 12 }} />
              <Text style={styles.receiptTitle}>Shipment Created!</Text>
              <Text style={styles.receiptSub}>Saved live to the RENAX system.</Text>

              <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginVertical: 12, borderWidth: 1, borderColor: '#bbf7d0', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Outfit_6', color: '#047857', marginBottom: 2 }}>Tracking / Order ID</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#004d3d', letterSpacing: 2 }}>{createdOrderId}</Text>
                <View style={{ marginTop: 6, backgroundColor: detectShipmentType(pickupData?.address || '', deliveryData?.address || '') === 'intra_state' ? '#004d3d' : '#B45309', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: 'Outfit_6', fontSize: 11, color: '#ccfd3a', letterSpacing: 1 }}>
                    {detectShipmentType(pickupData?.address || '', deliveryData?.address || '') === 'intra_state' ? 'INTRA-STATE - LIVE TRACKING' : 'INTER-STATE - TERMINAL RELAY'}
                  </Text>
                </View>
              </View>

              {searchingRiders && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', width: '100%', marginBottom: 10 }}>
                  <ActivityIndicator color="#B45309" size="small" />
                  <Text style={{ fontFamily: 'Outfit_6', fontSize: 13, color: '#92400E', flex: 1 }}>Searching for available riders nearby...</Text>
                </View>
              )}
              {noRidersFound && (
                <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5', width: '100%', marginBottom: 10 }}>
                  <Text style={{ fontFamily: 'Outfit_7', fontSize: 13, color: '#DC2626', marginBottom: 4 }}>No Riders Available Right Now</Text>
                  <Text style={{ fontFamily: 'Outfit_4', fontSize: 12, color: '#7F1D1D' }}>Your shipment is queued. A rider will be assigned as soon as one comes online.</Text>
                </View>
              )}

              <ScrollView style={[styles.receiptBody, { width: '100%', maxHeight: 200, marginBottom: 12 }]}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Sender</Text>
                  <Text style={styles.receiptValue}>{senderName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Recipient</Text>
                  <Text style={styles.receiptValue}>{recipientName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Distance</Text>
                  <Text style={styles.receiptValue}>{actualDistance ? `${actualDistance} km` : 'N/A'}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Service</Text>
                  <Text style={styles.receiptValue}>{serviceSelected}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Package</Text>
                  <Text style={styles.receiptValue}>{weight}kg - {category}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment</Text>
                  <Text style={styles.receiptValue}>{payMethod}</Text>
                </View>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabel, { fontSize: 15, color: '#111' }]}>Total</Text>
                  <Text style={[styles.receiptValue, { fontSize: 18, color: '#004d3d', fontFamily: 'PlusJakartaSans_7' }]}>
                    {'\u20a6'}{estimatedPrice.toLocaleString()}
                  </Text>
                </View>
              </ScrollView>

              <Pressable style={[styles.receiptConfirmBtn, { width: '100%', marginBottom: 10 }]} onPress={downloadPDF}>
                <Download color="#ccfd3a" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.receiptConfirmText}>DOWNLOAD PDF RECEIPT</Text>
              </Pressable>
              <Pressable style={[styles.receiptCancelBtn, { width: '100%' }]} onPress={() => {
                setShowReceiptModal(false);
                setCreatedOrderId('');
                setSearchingRiders(false);
                setNoRidersFound(false);
              }}>
                <Text style={styles.receiptCancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  stepCrumb: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepDotWrap: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#004d3d' },
  stepDotCurrent: { backgroundColor: '#004d3d', borderWidth: 3, borderColor: '#ccfd3a' },
  stepLine: { width: 80, height: 2, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#004d3d' },
  stepLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: '#999' },
  stepLabelActive: { fontFamily: 'Outfit_7', color: '#004d3d' },
  orderType: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#222', marginBottom: 20 },
  formGrid: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  formCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' },
  select: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fafafa', height: 48 },
  selectText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#333', flex: 1 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fafafa', height: 48 },
  inputWrapFilled: { borderColor: '#10B981', backgroundColor: '#f0fdf4' },
  input: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333', height: '100%' },
  packageMetaGrid: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' },
  packageMetaField: { flexGrow: 1, flexBasis: 180, minWidth: 180 },
  packageMetaFieldWide: { flexBasis: 220 },
  textAreaWrap: { minHeight: 104, height: 'auto', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 },
  textAreaInput: { textAlignVertical: 'top', height: 80 },
  fieldNoteTitle: { fontFamily: 'Outfit_6', fontSize: 13, color: '#333', marginBottom: 4 },
  fieldNote: { fontFamily: 'Outfit_4', fontSize: 12, color: '#888', marginBottom: 8 },
  landmarkBtn: { borderWidth: 1, borderColor: '#ccfd3a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 10 },
  landmarkBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  landmarkRequiredBox: { backgroundColor: '#FEF9E7', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#F2C94C', marginTop: 8 },
  landmarkReqTitle: { fontFamily: 'Outfit_7', fontSize: 13, color: '#B45309', marginBottom: 4 },
  serviceRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  serviceCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa' },
  serviceCardActive: { borderColor: '#004d3d', backgroundColor: '#004d3d' },
  serviceLabel: { fontFamily: 'Outfit_7', fontSize: 13, color: '#333', textAlign: 'center' },
  serviceSub: { fontFamily: 'Outfit_4', fontSize: 11, color: '#999', textAlign: 'center' },
  pmRow: { gap: 8 },
  summaryBar: { backgroundColor: '#fff', borderRadius: 16, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  summaryTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111', marginBottom: 6 },
  summaryLine: { fontFamily: 'Outfit_4', fontSize: 13, color: '#555' },
  priceBox: { alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eee' },
  priceLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: '#777', marginBottom: 4 },
  priceValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 28, color: '#004d3d' },
  recalcBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ccfd3a', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10 },
  recalcText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#002B22' },
  ctaRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  createBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#004d3d', borderRadius: 12, paddingVertical: 18 },
  createBtnText: { fontFamily: 'Outfit_7', fontSize: 15, color: '#ccfd3a', letterSpacing: 0.5 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  cancelBtnText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#666' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingBottom: 40, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalOptionText: { fontFamily: 'Outfit_4', fontSize: 15, color: '#333' },
  modalOptionActive: { fontFamily: 'Outfit_7', color: '#004d3d' },
  // Form Cards
  formCardComplete: { borderColor: '#10B981', borderWidth: 1 },
  // Receipt Modal
  receiptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  receiptModal: { backgroundColor: '#fff', width: '90%', maxWidth: 500, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  receiptTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#111', marginBottom: 4, textAlign: 'center' },
  receiptSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  receiptBody: { maxHeight: 400 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
  receiptLabel: { fontFamily: 'Outfit_4', fontSize: 13, color: '#666', flex: 1 },
  receiptValue: { fontFamily: 'Outfit_6', fontSize: 14, color: '#222', flex: 2, textAlign: 'right' },
  receiptDivider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  receiptActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  receiptCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  receiptCancelText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#666' },
  receiptConfirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#004d3d', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  receiptConfirmText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a' },
});
