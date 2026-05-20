// CreateShipmentTab.tsx — fully functional with Supabase integration
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  useWindowDimensions, Modal, FlatList, ActivityIndicator, Share, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronDown, MapPin, Phone, RotateCcw, X, Bike, Truck, Package, Check, CheckCircle2, Download, FileText
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../supabase';
import OSMAutocomplete from '../OSMAutocomplete';
import QRCodeCard from '../QRCodeCard';
import { buildShipmentQrPayload } from '../../utils/qrPayload';
import { getActualDrivingDistance } from '../../utils/mapService';
import { chargeWalletForShipment } from '../../utils/customerData';
import { generateVerificationCode, logShipmentEvent, resolveRouting } from '../../utils/routingService';

// ─── Constants ────────────────────────────────────────────────────────────────
const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
];

const detectShipmentType = (pickup: string, delivery: string): 'intra_state' | 'inter_state' | 'unknown' => {
  const getState = (addr: string) => NIGERIAN_STATES.find(s => addr.toLowerCase().includes(s.toLowerCase())) || '';
  const ps = getState(pickup);
  const ds = getState(delivery);
  if (!ps || !ds) return 'unknown';
  return ps === ds ? 'intra_state' : 'inter_state';
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

const RELAY_PICKUP_OPTIONS = [
  {
    id: 'customer_dropoff',
    title: 'I will drop this off at a RENAX terminal',
    body: 'Best for scheduled inter-state shipments. Terminal staff receives it directly and moves it into the relay queue.',
  },
  {
    id: 'renax_pickup',
    title: 'RENAX should pick this up for terminal processing',
    body: 'RENAX sends a first-mile pickup vehicle to collect it and take it to the source terminal before linehaul.',
  },
] as const;

const RELAY_LAST_MILE_OPTIONS = [
  {
    id: 'recipient_pickup',
    title: 'Recipient will collect from the RENAX destination terminal',
    body: 'Best when the receiver can come to the hub. Ops will hold the parcel at the terminal until pickup is confirmed.',
  },
  {
    id: 'renax_delivery',
    title: 'RENAX should deliver from terminal to the recipient',
    body: 'Best when the receiver wants door delivery after the parcel reaches the destination terminal.',
  },
] as const;

const assignmentCopy = (shipmentType: 'intra_state' | 'inter_state' | 'unknown', relayStrategy: 'customer_dropoff' | 'renax_pickup') => {
  if (shipmentType === 'inter_state' && relayStrategy === 'renax_pickup') {
    return {
      searchingTitle: 'Searching RENAX first-mile pickup vehicles...',
      searchingSub: 'Waiting for the closest available RENAX pickup vehicle to accept and move this parcel to the source terminal.',
      retryLabel: 'REFRESH PICKUP SEARCH',
      retryHint: 'We now wait up to 90 seconds for a RENAX pickup vehicle to accept before closing this terminal-pickup request.',
      createCta: 'MATCHING PICKUP VEHICLE...',
      noMatchError: 'No RENAX pickup vehicle accepted this inter-state terminal pickup request yet. This request was closed and removed from rider screens until you refresh it.',
    };
  }

  return {
    searchingTitle: 'Searching live riders across Lagos state...',
    searchingSub: 'Waiting for the closest available rider to accept.',
    retryLabel: 'REFRESH LIVE RIDER SEARCH',
    retryHint: 'We now wait up to 90 seconds for a rider to accept before failing this same-city request.',
    createCta: 'MATCHING LIVE RIDER...',
    noMatchError: 'No rider accepted this intra-state shipment yet. This request was closed and removed from rider screens until you refresh it.',
  };
};

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

async function hasLiveLocalRider(params: { pickupState: string; pickupCity: string }) {
  const recentCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('rider_locations')
    .select('rider_id, last_seen, current_shipment_id, metadata')
    .eq('is_online', true)
    .is('current_shipment_id', null)
    .gte('last_seen', recentCutoff);

  if (error || !data) return false;

  const targetState = params.pickupState.trim().toLowerCase();

  return data.some((row: any) => {
    const riderState = String(row?.metadata?.state || '').trim().toLowerCase();

    if (!riderState || riderState !== targetState) return false;
    return true;
  });
}

function hasShipmentBeenAccepted(data: any) {
  if (!data) return false;

  return Boolean(
    data.assigned_rider_id ||
    data.final_mile_rider_id ||
    ['awaiting_source_terminal', 'out_for_delivery', 'delivered'].includes(data.dispatch_stage)
  );
}

async function fetchShipmentAssignmentState(shipmentId: string) {
  const { data, error } = await supabase
    .from('shipments')
    .select('assigned_rider_id, final_mile_rider_id, dispatch_stage, status')
    .eq('id', shipmentId)
    .maybeSingle();

  if (error) return null;
  return data;
}

async function waitForLocalRiderAcceptance(shipmentId: string, timeoutMs = 90000, pollMs = 1500) {
  const initialState = await fetchShipmentAssignmentState(shipmentId);
  if (hasShipmentBeenAccepted(initialState)) {
    return { matched: true, data: initialState };
  }

  return await new Promise<{ matched: boolean; data: any | null }>((resolve) => {
    let settled = false;
    let latestData = initialState;

    const finish = (result: { matched: boolean; data: any | null }) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      supabase.removeChannel(channel);
      resolve(result);
    };

    const inspectState = (nextData: any) => {
      latestData = nextData;
      if (hasShipmentBeenAccepted(nextData)) {
        finish({ matched: true, data: nextData });
      }
    };

    const channel = supabase
      .channel(`customer-match-${shipmentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shipments',
        filter: `id=eq.${shipmentId}`,
      }, (payload: any) => {
        inspectState(payload.new);
      })
      .subscribe();

    const pollTimer = setInterval(async () => {
      const nextData = await fetchShipmentAssignmentState(shipmentId);
      if (nextData) {
        inspectState(nextData);
      }
    }, pollMs);

    const timeoutTimer = setTimeout(async () => {
      const finalState = await fetchShipmentAssignmentState(shipmentId);
      if (hasShipmentBeenAccepted(finalState)) {
        finish({ matched: true, data: finalState });
        return;
      }
      finish({ matched: false, data: finalState || latestData || null });
    }, timeoutMs);
  });
}

async function cancelUnassignedLocalShipment(shipmentId: string) {
  const latestState = await fetchShipmentAssignmentState(shipmentId);
  if (hasShipmentBeenAccepted(latestState)) {
    return { cancelled: false, accepted: true, data: latestState };
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      status: 'cancelled',
      dispatch_stage: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId)
    .eq('dispatch_stage', 'awaiting_rider_acceptance')
    .is('assigned_rider_id', null)
    .is('final_mile_rider_id', null);

  if (error) {
    const refreshedState = await fetchShipmentAssignmentState(shipmentId);
    if (hasShipmentBeenAccepted(refreshedState)) {
      return { cancelled: false, accepted: true, data: refreshedState };
    }
  }

  return { cancelled: true, accepted: false, data: null };
}

async function createManagedFirstMilePickupRequest(shipmentId: string) {
  const { data, error } = await supabase.rpc('create_first_mile_pickup_request', {
    p_payload: {
      shipment_id: shipmentId,
      priority: 'normal',
    },
  });

  if (error) {
    throw new Error(`First-mile pickup queue failed: ${error.message}`);
  }

  return data as string | null;
}

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
  const [relayFirstMileStrategy, setRelayFirstMileStrategy] = useState<'customer_dropoff' | 'renax_pickup'>('customer_dropoff');
  const [relayLastMileStrategy, setRelayLastMileStrategy] = useState<'recipient_pickup' | 'renax_delivery'>('renax_delivery');

  // Modals & Submit State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRelayPlanModal, setShowRelayPlanModal] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [pickupOtp, setPickupOtp] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [formError, setFormError] = useState('');
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const [queueInsertFailed, setQueueInsertFailed] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState<'pickup' | 'delivery' | null>(null);
  // Rider search state
  const [searchingRiders, setSearchingRiders] = useState(false);
  const [noRidersFound, setNoRidersFound] = useState(false);
  const [matchCountdown, setMatchCountdown] = useState(90);
  const [pendingLocalMatch, setPendingLocalMatch] = useState<{
    shipmentId: string;
    trackingId: string;
    pickupOtp: string;
    deliveryOtp: string;
    customerId?: string;
  } | null>(null);

  // Pickers visibility
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker]   = useState(false);
  const [lastPromptedInterstateKey, setLastPromptedInterstateKey] = useState('');

  // Submit state
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!searchingRiders) return;
    setMatchCountdown(90);
    const timer = setInterval(() => {
      setMatchCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [searchingRiders]);

  const retryPendingLocalMatch = async () => {
    if (!pendingLocalMatch) return;

    setFormError('');
    setNoRidersFound(false);
    setSearchingRiders(true);
    setLoading(true);

    await supabase
      .from('shipments')
      .update({
        status: 'pending',
        dispatch_stage: 'awaiting_rider_acceptance',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingLocalMatch.shipmentId);

    const acceptance = await waitForLocalRiderAcceptance(pendingLocalMatch.shipmentId);
    setSearchingRiders(false);
    setLoading(false);

    if (!acceptance.matched) {
      const cancellation = await cancelUnassignedLocalShipment(pendingLocalMatch.shipmentId);
      if (cancellation.accepted) {
        setCreatedOrderId(pendingLocalMatch.trackingId);
        setPickupOtp(pendingLocalMatch.pickupOtp);
        setDeliveryOtp(pendingLocalMatch.deliveryOtp);
        setPendingLocalMatch(null);
        setNoRidersFound(false);
        setFormError('');
        setShowReceiptModal(true);
        return;
      }

      setNoRidersFound(true);
      setFormError('No rider accepted this intra-state shipment yet. This request was closed and removed from rider screens until you refresh it.');
      return;
    }

    setCreatedOrderId(pendingLocalMatch.trackingId);
    setPickupOtp(pendingLocalMatch.pickupOtp);
    setDeliveryOtp(pendingLocalMatch.deliveryOtp);
    setPendingLocalMatch(null);
    setNoRidersFound(false);
    setFormError('');
    setShowReceiptModal(true);
  };

  // ── Derived State & Calculations ─────────────────────────────────────────────
  const isStep1Complete = !!(senderName && senderPhone && pickupData);
  const isStep2Complete = !!(recipientName && recipientPhone && deliveryData && deliveryLandmark);
  const isStep3Complete = !!(weight && category && serviceSelected && payMethod && packageDescription);
  const shipmentType = detectShipmentType(
    pickupData?.address || '',
    deliveryData?.address || ''
  );
  const isInterStateShipment = shipmentType === 'inter_state';
  const assignmentUiCopy = assignmentCopy(shipmentType, relayFirstMileStrategy);
  const interstateRouteKey = isInterStateShipment && pickupData?.address && deliveryData?.address
    ? `${pickupData.address}__${deliveryData.address}`
    : '';

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

  React.useEffect(() => {
    if (isInterStateShipment && interstateRouteKey && interstateRouteKey !== lastPromptedInterstateKey) {
      setShowRelayPlanModal(true);
      setLastPromptedInterstateKey(interstateRouteKey);
      return;
    }

    if (!isInterStateShipment) {
      setShowRelayPlanModal(false);
    }
  }, [interstateRouteKey, isInterStateShipment, lastPromptedInterstateKey]);

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

      if (!resolvedCustomerId) {
        throw new Error('Please sign in with a real customer account before creating a shipment.');
      }

      if (payMethod === 'RENAX Wallet' && estimatedPrice <= 0) {
        throw new Error('This shipment cannot be charged to wallet until pricing is available.');
      }

      const routing = await resolveRouting(
        pickupData?.address || '',
        deliveryData?.address || '',
        {
          relayFirstMileStrategy,
          relayLastMileStrategy,
        }
      );

      const isManagedFirstMilePickup =
        routing.routing_mode === 'relay_terminal' &&
        relayFirstMileStrategy === 'renax_pickup';
      const requiresImmediateAssignment =
        routing.routing_mode === 'last_mile_local' &&
        routing.dispatch_stage === 'awaiting_rider_acceptance';

      if (requiresImmediateAssignment) {
        setSearchingRiders(true);
        setNoRidersFound(false);
      } else {
        setSearchingRiders(false);
        setNoRidersFound(false);
      }

      // Generate Order ID
      const generatedId = `RNX-${Math.floor(100000 + Math.random() * 900000)}`;
      const pickupVerificationCode = generateVerificationCode();
      const deliveryVerificationCode = generateVerificationCode();

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
          status:            'pending',
          pickup_otp:        pickupVerificationCode,
          delivery_otp:      deliveryVerificationCode,
          routing_mode:      routing.routing_mode,
          relay_first_mile_strategy: routing.routing_mode === 'relay_terminal' ? relayFirstMileStrategy : null,
          relay_last_mile_strategy: routing.routing_mode === 'relay_terminal' ? relayLastMileStrategy : null,
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

        if (isManagedFirstMilePickup) {
          const pickupRequestId = await createManagedFirstMilePickupRequest(createdShipment.id);
          await logShipmentEvent(
            createdShipment.id,
            routing.dispatch_stage,
            'RENAX First-Mile Orchestration',
            resolvedCustomerId,
            'customer',
            `First-mile pickup request ${pickupRequestId || 'created'} queued for ops assignment.`
          );
        }

        const notificationRows = [
          senderPhone && pickupVerificationCode
            ? {
                shipment_id: createdShipment.id,
                customer_id: resolvedCustomerId,
                channel: 'sms',
                recipient: senderPhone,
                template_key: 'pickup_otp',
                title: 'RENAX Pickup OTP',
                body: `Your RENAX pickup verification code for ${generatedId} is ${pickupVerificationCode}.`,
                payload: {
                  tracking_id: generatedId,
                  otp: pickupVerificationCode,
                  role: 'sender',
                },
              }
            : null,
          recipientPhone && deliveryVerificationCode
            ? {
                shipment_id: createdShipment.id,
                customer_id: resolvedCustomerId,
                channel: 'sms',
                recipient: recipientPhone,
                template_key: 'delivery_otp',
                title: 'RENAX Delivery OTP',
                body: `Your RENAX delivery verification code for ${generatedId} is ${deliveryVerificationCode}.`,
                payload: {
                  tracking_id: generatedId,
                  otp: deliveryVerificationCode,
                  role: 'recipient',
                },
              }
            : null,
        ].filter(Boolean);

        if (notificationRows.length > 0) {
          try {
            const { error: queueErr } = await supabase
              .from('notification_delivery_queue')
              .insert(notificationRows);
            if (queueErr) setQueueInsertFailed(true);
          } catch {
            setQueueInsertFailed(true);
          }
        }
      }

      // Same-state shipments remain provisional until a live rider accepts.
      if (requiresImmediateAssignment && createdShipment?.id) {
        setPendingLocalMatch({
          shipmentId: createdShipment.id,
          trackingId: createdShipment.tracking_id || generatedId,
          pickupOtp: pickupVerificationCode,
          deliveryOtp: deliveryVerificationCode,
          customerId: resolvedCustomerId,
        });
        setSearchingRiders(true);
        setNoRidersFound(false);

        const acceptance = await waitForLocalRiderAcceptance(createdShipment.id);
        setSearchingRiders(false);

        if (!acceptance.matched) {
          const cancellation = await cancelUnassignedLocalShipment(createdShipment.id);
          if (cancellation.accepted) {
            setSearchingRiders(false);
          } else {
            setNoRidersFound(true);
            setFormError(assignmentUiCopy.noMatchError);
            setLoading(false);
            return;
          }
        }
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
      setPickupOtp(pickupVerificationCode);
      setDeliveryOtp(deliveryVerificationCode);
      setPendingLocalMatch(null);
      setNoRidersFound(false);
      setSearchingRiders(false);
      setResendSuccess(false);
      setShowReceiptModal(true);
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
      <Modal visible={showRelayPlanModal} transparent animationType="fade" onRequestClose={() => setShowRelayPlanModal(false)}>
        <Pressable style={styles.relayPlanOverlay} onPress={() => setShowRelayPlanModal(false)}>
          <Pressable style={styles.relayPlanModal} onPress={() => {}}>
            <View style={styles.relayPlanHeader}>
              <Text style={styles.relayPlanEyebrow}>RENAX Terminal Routing</Text>
              <Text style={styles.relayPlanHeading}>This shipment is inter-state</Text>
              <Text style={styles.relayPlanBody}>
                Choose the first-mile intake and the destination handoff now so ops, riders, and the customer all follow one clear plan from the start.
              </Text>
            </View>
            <View style={styles.relayPlanGrid}>
              {RELAY_PICKUP_OPTIONS.map((option) => {
                const active = relayFirstMileStrategy === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.relayPlanCard, active && styles.relayPlanCardActive]}
                    onPress={() => setRelayFirstMileStrategy(option.id)}
                  >
                    <View style={[styles.relayPlanCheck, active && styles.relayPlanCheckActive]}>
                      {active ? <Check color="#002B22" size={14} /> : null}
                    </View>
                    <Text style={[styles.relayPlanCardTitle, active && styles.relayPlanCardTitleActive]}>
                      {option.title}
                    </Text>
                    <Text style={styles.relayPlanCardBody}>{option.body}</Text>
                    {option.id === 'renax_pickup' ? (
                      <Text style={styles.relayPlanChargeNote}>
                        Note: RENAX pickup to terminal can add a small first-mile pickup charge based on distance and vehicle type.
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.relayPlanGrid}>
              {RELAY_LAST_MILE_OPTIONS.map((option) => {
                const active = relayLastMileStrategy === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.relayPlanCard, active && styles.relayPlanCardActive]}
                    onPress={() => setRelayLastMileStrategy(option.id)}
                  >
                    <View style={[styles.relayPlanCheck, active && styles.relayPlanCheckActive]}>
                      {active ? <Check color="#002B22" size={14} /> : null}
                    </View>
                    <Text style={[styles.relayPlanCardTitle, active && styles.relayPlanCardTitleActive]}>
                      {option.title}
                    </Text>
                    <Text style={styles.relayPlanCardBody}>{option.body}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.relayPlanActions}>
              <Pressable style={styles.relayPlanDismissBtn} onPress={() => setShowRelayPlanModal(false)}>
                <Text style={styles.relayPlanDismissText}>Continue</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
            onClear={() => setPickupData(null)}
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
            onClear={() => setDeliveryData(null)}
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
          {isInterStateShipment ? (
            <>
              <Text style={styles.summaryLine}>
                First Mile: {relayFirstMileStrategy === 'customer_dropoff' ? 'Customer Drop-Off To Terminal' : 'RENAX Pickup To Terminal'}
              </Text>
              <Text style={styles.summaryLine}>
                Destination Handoff: {relayLastMileStrategy === 'recipient_pickup' ? 'Recipient Pickup At Terminal' : 'RENAX Delivery From Terminal'}
              </Text>
            </>
          ) : null}
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
      {searchingRiders ? (
        <View style={styles.matchingBanner}>
          <ActivityIndicator color="#B45309" size="small" />
          <View style={{ flex: 1 }}>
            <Text style={styles.matchingBannerTitle}>{assignmentUiCopy.searchingTitle}</Text>
            <Text style={styles.matchingBannerSub}>
              {assignmentUiCopy.searchingSub} Time left: {Math.floor(matchCountdown / 60)}:{String(matchCountdown % 60).padStart(2, '0')}
            </Text>
          </View>
        </View>
      ) : null}
      {noRidersFound && !loading ? (
        <View style={{ marginBottom: 16 }}>
          <Pressable
            style={[styles.retryBtn, searchingRiders && { opacity: 0.7 }]}
            onPress={() => {
              if (pendingLocalMatch) {
                retryPendingLocalMatch();
                return;
              }
              setFormError('');
              setNoRidersFound(false);
              handleCreateShipment();
            }}
            disabled={searchingRiders}
          >
            <RotateCcw color="#004d3d" size={16} />
            <Text style={styles.retryBtnText}>{assignmentUiCopy.retryLabel}</Text>
          </Pressable>
          <Text style={styles.retryHint}>{assignmentUiCopy.retryHint}</Text>
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
            {loading ? (searchingRiders ? assignmentUiCopy.createCta : 'CREATING...') : 'CREATE SHIPMENT & GET ORDER ID'}
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
          <View style={[styles.receiptModal, { maxHeight: '90%' }]}>
            <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 10, paddingBottom: 20 }} showsVerticalScrollIndicator={true} indicatorStyle="black">
              <CheckCircle2 color="#10B981" size={50} style={{ marginBottom: 12 }} />
              <Text style={styles.receiptTitle}>Shipment Created!</Text>
              <Text style={styles.receiptSub}>Saved live to the RENAX system.</Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(0, 77, 61, 0.05)', borderRadius: 20 }}>
                <Text style={{ fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' }}>Scroll down for actions & QR codes</Text>
                <ChevronDown color="#004d3d" size={14} />
              </View>

        <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginVertical: 12, borderWidth: 1, borderColor: '#bbf7d0', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Outfit_6', color: '#047857', marginBottom: 2 }}>Tracking / Order ID</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#004d3d', letterSpacing: 2 }}>{createdOrderId}</Text>
                <View style={{ marginTop: 6, backgroundColor: detectShipmentType(pickupData?.address || '', deliveryData?.address || '') === 'intra_state' ? '#004d3d' : '#B45309', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: 'Outfit_6', fontSize: 11, color: '#ccfd3a', letterSpacing: 1 }}>
                    {detectShipmentType(pickupData?.address || '', deliveryData?.address || '') === 'intra_state' ? 'INTRA-STATE - LIVE TRACKING' : 'INTER-STATE - TERMINAL RELAY'}
                  </Text>
                </View>
              </View>

              {detectShipmentType(pickupData?.address || '', deliveryData?.address || '') === 'inter_state' ? (
                <View style={styles.receiptPlanBanner}>
                  <Text style={styles.receiptPlanTitle}>
                    {relayFirstMileStrategy === 'customer_dropoff'
                      ? 'Customer Drop-Off To Source Terminal'
                      : 'RENAX First-Mile Pickup Requested'}
                  </Text>
                  <Text style={styles.receiptPlanSub}>
                    {relayFirstMileStrategy === 'customer_dropoff'
                      ? 'This inter-state shipment will wait for source-terminal drop-off and then move into the relay hub workflow.'
                      : 'This inter-state shipment will be offered only to the first-mile pickup queue so RENAX can collect it and move it into the source terminal workflow.'}
                  </Text>
                  <Text style={[styles.receiptPlanSub, { marginTop: 8 }]}>
                    {relayLastMileStrategy === 'recipient_pickup'
                      ? 'Destination plan: the receiver will pick up at the RENAX destination terminal after ops confirms arrival.'
                      : 'Destination plan: RENAX ops will release this shipment into the final-mile delivery queue after destination-terminal arrival.'}
                  </Text>
                </View>
              ) : null}

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

              <View style={[styles.receiptBody, { width: '100%', marginBottom: 12 }]}>
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
              </View>

              {/* ── OTP / QR Section ── */}
              {pickupOtp && deliveryOtp ? (
                <View style={{ width: '100%', marginBottom: 14 }}>

                  {/* Queue insert failed — fallback banner */}
                  {queueInsertFailed && (
                    <View style={styles.queueFailBanner}>
                      <Text style={styles.queueFailTitle}>SMS Notification Queued Offline</Text>
                      <Text style={styles.queueFailSub}>
                        Your shipment was created successfully, but we could not queue the SMS at this moment.
                        Your OTP codes are shown below — please share them manually.
                      </Text>
                    </View>
                  )}

                  {/* Resend success */}
                  {resendSuccess && (
                    <View style={styles.resendSuccessBanner}>
                      <Text style={styles.resendSuccessText}>OTP SMS re-queued successfully!</Text>
                    </View>
                  )}

                  {/* QR Grid */}
                  <View style={styles.qrGrid}>
                    <QRCodeCard
                      label="Pickup QR"
                      value={pickupOtp}
                      payload={buildShipmentQrPayload({
                        type: 'pickup',
                        otp: pickupOtp,
                        trackingId: createdOrderId,
                      })}
                      note="Rider scans this from the sender phone at pickup."
                      size={124}
                    />
                    <QRCodeCard
                      label="Delivery QR"
                      value={deliveryOtp}
                      payload={buildShipmentQrPayload({
                        type: 'delivery',
                        otp: deliveryOtp,
                        trackingId: createdOrderId,
                      })}
                      note="Rider scans this from the recipient phone at delivery."
                      size={124}
                    />
                  </View>

                  {/* OTP Action Row — Pickup */}
                  <View style={styles.otpActionBlock}>
                    <View style={styles.otpLabelRow}>
                      <Text style={styles.otpLabel}>PICKUP OTP</Text>
                      <Text style={styles.otpCode}>{pickupOtp}</Text>
                    </View>
                    <View style={styles.otpActionRow}>
                      <Pressable
                        style={styles.otpActionBtn}
                        onPress={async () => {
                          await Clipboard.setStringAsync(pickupOtp);
                          setCopiedOtp('pickup');
                          setTimeout(() => setCopiedOtp(null), 2000);
                        }}
                      >
                        <Text style={styles.otpActionBtnText}>
                          {copiedOtp === 'pickup' ? '✓ Copied!' : 'Copy OTP'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.otpActionBtn, styles.otpShareBtn]}
                        onPress={() => Share.share({
                          message: `Your RENAX pickup OTP for order ${createdOrderId} is: ${pickupOtp}. Show this to the rider at pickup.`,
                          title: 'RENAX Pickup OTP',
                        })}
                      >
                        <Text style={[styles.otpActionBtnText, { color: '#004d3d' }]}>Share OTP</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* OTP Action Row — Delivery */}
                  <View style={styles.otpActionBlock}>
                    <View style={styles.otpLabelRow}>
                      <Text style={styles.otpLabel}>DELIVERY OTP</Text>
                      <Text style={styles.otpCode}>{deliveryOtp}</Text>
                    </View>
                    <View style={styles.otpActionRow}>
                      <Pressable
                        style={styles.otpActionBtn}
                        onPress={async () => {
                          await Clipboard.setStringAsync(deliveryOtp);
                          setCopiedOtp('delivery');
                          setTimeout(() => setCopiedOtp(null), 2000);
                        }}
                      >
                        <Text style={styles.otpActionBtnText}>
                          {copiedOtp === 'delivery' ? '✓ Copied!' : 'Copy OTP'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.otpActionBtn, styles.otpShareBtn]}
                        onPress={() => Share.share({
                          message: `Your RENAX delivery OTP for order ${createdOrderId} is: ${deliveryOtp}. Show this to the rider at delivery.`,
                          title: 'RENAX Delivery OTP',
                        })}
                      >
                        <Text style={[styles.otpActionBtnText, { color: '#004d3d' }]}>Share OTP</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Resend OTP Button */}
                  <Pressable
                    style={[styles.resendOtpBtn, resendingOtp && { opacity: 0.7 }]}
                    disabled={resendingOtp}
                    onPress={async () => {
                      if (!createdOrderId) return;
                      setResendingOtp(true);
                      setResendSuccess(false);
                      try {
                        const customerId = pendingLocalMatch?.customerId ?? null;
                        const rows = [
                          senderPhone ? {
                            channel: 'sms',
                            recipient: senderPhone,
                            template_key: 'pickup_otp_resend',
                            title: 'RENAX Pickup OTP (Resent)',
                            body: `Resent: Your RENAX pickup OTP for ${createdOrderId} is ${pickupOtp}.`,
                            payload: { tracking_id: createdOrderId, otp: pickupOtp, role: 'sender' },
                            ...(customerId ? { customer_id: customerId } : {}),
                          } : null,
                          recipientPhone ? {
                            channel: 'sms',
                            recipient: recipientPhone,
                            template_key: 'delivery_otp_resend',
                            title: 'RENAX Delivery OTP (Resent)',
                            body: `Resent: Your RENAX delivery OTP for ${createdOrderId} is ${deliveryOtp}.`,
                            payload: { tracking_id: createdOrderId, otp: deliveryOtp, role: 'recipient' },
                            ...(customerId ? { customer_id: customerId } : {}),
                          } : null,
                        ].filter(Boolean);
                        const { error } = await supabase
                          .from('notification_delivery_queue')
                          .insert(rows);
                        if (!error) {
                          setResendSuccess(true);
                          setQueueInsertFailed(false);
                        }
                      } finally {
                        setResendingOtp(false);
                      }
                    }}
                  >
                    {resendingOtp
                      ? <ActivityIndicator color="#004d3d" size="small" />
                      : <Text style={styles.resendOtpBtnText}>Resend OTP via SMS</Text>
                    }
                  </Pressable>

                </View>
              ) : null}

              <Pressable style={[styles.receiptConfirmBtn, { width: '100%', marginBottom: 10 }]} onPress={downloadPDF}>
                <Download color="#ccfd3a" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.receiptConfirmText}>DOWNLOAD PDF RECEIPT</Text>
              </Pressable>
              <Pressable style={[styles.receiptCancelBtn, { width: '100%' }]} onPress={() => {
                setQueueInsertFailed(false);
                setResendSuccess(false);
                setCopiedOtp(null);
                setShowReceiptModal(false);
                setCreatedOrderId('');
                setPickupOtp('');
                setDeliveryOtp('');
                setSearchingRiders(false);
                setNoRidersFound(false);
                setPendingLocalMatch(null);
                
                // Clear form state
                setSenderName('');
                setSenderPhone('');
                setPickupData(null);
                setPickupLandmark('');
                setShowPickupLandmark(false);
                setRecipientName('');
                setRecipientPhone('');
                setDeliveryData(null);
                setDeliveryLandmark('');
                setWeight('');
                setDims('');
                setCategory('');
                setServiceSelected('Standard Van');
                setPayMethod('');
                setPackageDescription('');
                setActualDistance(null);
              }}>
                <Text style={styles.receiptCancelText}>Done / Create Another</Text>
              </Pressable>
            </ScrollView>
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
  matchingBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 },
  matchingBannerTitle: { fontFamily: 'Outfit_7', fontSize: 14, color: '#9A3412' },
  matchingBannerSub: { marginTop: 2, fontFamily: 'Outfit_4', fontSize: 12, color: '#7C2D12' },
  ctaRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  createBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#004d3d', borderRadius: 12, paddingVertical: 18 },
  createBtnText: { fontFamily: 'Outfit_7', fontSize: 15, color: '#ccfd3a', letterSpacing: 0.5 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18 },
  retryBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d', letterSpacing: 0.4 },
  retryHint: { marginTop: 8, textAlign: 'center', fontFamily: 'Outfit_4', fontSize: 12, color: '#4B5563' },
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
  relayPlanOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  relayPlanModal: { width: '100%', maxWidth: 560, backgroundColor: '#fff', borderRadius: 22, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24 },
  relayPlanHeader: { marginBottom: 16 },
  relayPlanEyebrow: { fontFamily: 'Outfit_7', fontSize: 11, letterSpacing: 1.2, color: '#1D4ED8', marginBottom: 6 },
  relayPlanHeading: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#0F172A', marginBottom: 8 },
  relayPlanBody: { fontFamily: 'Outfit_4', fontSize: 14, lineHeight: 22, color: '#475569' },
  relayPlanGrid: { gap: 12 },
  relayPlanCard: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 16, paddingLeft: 52, position: 'relative' },
  relayPlanCardActive: { borderColor: '#004d3d', backgroundColor: '#F0FDF4' },
  relayPlanCheck: { position: 'absolute', top: 18, left: 18, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#94A3B8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  relayPlanCheckActive: { backgroundColor: '#ccfd3a', borderColor: '#ccfd3a' },
  relayPlanCardTitle: { fontFamily: 'Outfit_7', fontSize: 15, color: '#0F172A', marginBottom: 6 },
  relayPlanCardTitleActive: { color: '#004d3d' },
  relayPlanCardBody: { fontFamily: 'Outfit_4', fontSize: 13, color: '#475569', lineHeight: 20 },
  relayPlanChargeNote: { marginTop: 10, fontFamily: 'Outfit_6', fontSize: 12, color: '#B45309', lineHeight: 18 },
  relayPlanActions: { marginTop: 18 },
  relayPlanDismissBtn: { backgroundColor: '#004d3d', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  relayPlanDismissText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a', letterSpacing: 0.3 },
  // Form Cards
  formCardComplete: { borderColor: '#10B981', borderWidth: 1 },
  // Receipt Modal
  receiptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  receiptModal: { backgroundColor: '#fff', width: '90%', maxWidth: 500, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  receiptTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#111', marginBottom: 4, textAlign: 'center' },
  receiptSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  receiptBody: { maxHeight: 400 },
  receiptPlanBanner: { width: '100%', backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', padding: 14, marginBottom: 14 },
  receiptPlanTitle: { fontFamily: 'Outfit_7', fontSize: 13, color: '#1D4ED8', marginBottom: 4 },
  receiptPlanSub: { fontFamily: 'Outfit_4', fontSize: 12, color: '#1E3A8A', lineHeight: 18 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
  receiptLabel: { fontFamily: 'Outfit_4', fontSize: 13, color: '#666', flex: 1 },
  receiptValue: { fontFamily: 'Outfit_6', fontSize: 14, color: '#222', flex: 2, textAlign: 'right' },
  qrGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 14, marginBottom: 8 },
  receiptDivider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  receiptActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  receiptCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  receiptCancelText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#666' },
  receiptConfirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#004d3d', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  receiptConfirmText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a' },
  // OTP Actions
  otpActionBlock: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10 },
  otpLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  otpLabel: { fontFamily: 'Outfit_6', fontSize: 11, color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' },
  otpCode: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#004d3d', letterSpacing: 4 },
  otpActionRow: { flexDirection: 'row', gap: 10 },
  otpActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#004d3d', alignItems: 'center' },
  otpActionBtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#ccfd3a' },
  otpShareBtn: { backgroundColor: '#ccfd3a' },
  resendOtpBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#004d3d', marginTop: 6 },
  resendOtpBtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#004d3d' },
  queueFailBanner: { backgroundColor: '#FFF7ED', borderRadius: 10, borderWidth: 1, borderColor: '#FED7AA', padding: 14, marginBottom: 12 },
  queueFailTitle: { fontFamily: 'Outfit_7', fontSize: 13, color: '#92400E', marginBottom: 4 },
  queueFailSub: { fontFamily: 'Outfit_4', fontSize: 12, color: '#78350F', lineHeight: 18 },
  resendSuccessBanner: { backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', padding: 12, marginBottom: 10, alignItems: 'center' },
  resendSuccessText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#047857' },
});
