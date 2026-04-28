// CreateAgroShipmentTab.tsx — RENAX Agro Module
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, FlatList, Switch, ActivityIndicator,
} from 'react-native';
import { ChevronDown, Check, Truck, Thermometer, ShieldCheck, FileText, X, Leaf } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../supabase';
import OSMAutocomplete from '../OSMAutocomplete';
import { resolveRouting, logShipmentEvent } from '../../utils/routingService';
import { DEMO_CUSTOMER_ID } from '../../utils/customerData';

const PRODUCE_CATEGORIES = [
  'Grains & Cereals (Rice, Maize, Millet, Sorghum)',
  'Tubers & Roots (Yam, Cassava, Cocoyam, Potatoes)',
  'Leafy Vegetables (Ugwu, Waterleaf, Bitter Leaf)',
  'Fruiting Vegetables (Tomatoes, Pepper, Okra)',
  'Tropical Fruits (Plantain, Banana, Mango, Citrus)',
  'Livestock — Poultry (Live Chickens, Eggs)',
  'Livestock — Cattle & Goats',
  'Fish & Seafood (Fresh, Smoked, Dried)',
  'Agro-Inputs (Fertilizer, Seeds, Chemicals)',
  'Processed Foods (Palm Oil, Groundnut, Flour)',
  'Mixed Perishables',
];

const VEHICLE_TYPES = [
  { id: 'motorcycle_box',    label: 'Motorcycle + Box',      note: 'Small loads, fast delivery, <100kg' },
  { id: 'pickup_van',        label: 'Pickup / Mini Van',      note: 'Up to 1 tonne, local farm runs' },
  { id: 'covered_van',       label: 'Covered Truck',          note: '1–5 tonnes, rain-protected' },
  { id: 'open_truck',        label: 'Open Flatbed Truck',     note: '5–10 tonnes, tubers & bulk grains' },
  { id: 'refrigerated_truck',label: 'Refrigerated Truck',     note: 'Cold-chain for fish, dairy, perishables' },
  { id: 'flatbed_trailer',   label: 'Flatbed Articulated',    note: '10–30 tonnes, long-haul bulk haulage' },
];

function PickerModal({ visible, title, options, onSelect, onClose }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={i => i}
            renderItem={({ item }) => (
              <Pressable style={s.option} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={s.optionText}>{item}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CreateAgroShipmentTab({ customerId }: { customerId?: string | null }) {
  const [senderName, setSenderName]   = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pickupData, setPickupData]   = useState<{ address: string; lat: number; lon: number } | null>(null);
  const [recipientName, setRecipientName]   = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryData, setDeliveryData]     = useState<{ address: string; lat: number; lon: number } | null>(null);

  const [produceCategory, setProduceCategory] = useState('');
  const [tonnage, setTonnage]                 = useState('');
  const [vehicleType, setVehicleType]         = useState('');
  const [insured, setInsured]                 = useState(false);
  const [coldChain, setColdChain]             = useState(false);
  const [handlingNotes, setHandlingNotes]     = useState('');

  const [showProduce, setShowProduce]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState('');
  const [error, setError]               = useState('');

  const handleSubmit = async () => {
    if (!senderName || !pickupData || !recipientName || !deliveryData || !produceCategory || !vehicleType || !tonnage) {
      setError('Please fill all required fields.'); return;
    }
    setError(''); setLoading(true);
    try {
      let cid = customerId;
      if (!cid) { const { data: { user } } = await supabase.auth.getUser(); cid = user?.id ?? DEMO_CUSTOMER_ID; }
      const routing = await resolveRouting(pickupData.address, deliveryData.address);
      const trackId = `RNX-AG-${Math.floor(100000 + Math.random() * 900000)}`;
      const tons = parseFloat(tonnage) || 0;
      // Force manual_review for heavy bulk loads (>5 tonnes needs linehaul coordination)
      const finalRouting = tons > 5 ? { ...routing, routing_mode: 'manual_review' as const, dispatch_stage: 'pending_routing' as const } : routing;

      const { data: ship, error: dbErr } = await supabase.from('shipments').insert({
        customer_id: cid, tracking_id: trackId,
        sender_name: senderName, sender_phone: senderPhone,
        pickup_address: pickupData.address, pickup_lat: pickupData.lat, pickup_lon: pickupData.lon,
        recipient_name: recipientName, recipient_phone: recipientPhone,
        delivery_address: deliveryData.address, delivery_lat: deliveryData.lat, delivery_lon: deliveryData.lon,
        status: 'Pending', routing_mode: finalRouting.routing_mode, dispatch_stage: finalRouting.dispatch_stage,
        pickup_state: finalRouting.pickup_state, delivery_state: finalRouting.delivery_state,
        source_terminal_id: finalRouting.source_terminal_id, destination_terminal_id: finalRouting.destination_terminal_id,
        is_agro_shipment: true, agro_produce_category: produceCategory, agro_vehicle_type: vehicleType,
        agro_tonnage: tons, agro_insured: insured, requires_cold_chain: coldChain,
        agro_handling_notes: handlingNotes || null,
        package_category: 'Agro Produce', service_level: vehicleType, estimated_price: 0,
      }).select('id').single();

      if (dbErr) throw dbErr;
      if (ship?.id) await logShipmentEvent(ship.id, finalRouting.dispatch_stage, undefined, cid, 'customer', `Agro booking: ${produceCategory}`);
      setSuccess(trackId);
    } catch (e: any) {
      setError(e?.message || 'Booking failed. Try again.');
    } finally { setLoading(false); }
  };

  if (success) return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.successBox}>
      <ShieldCheck color="#ccfd3a" size={48} />
      <Text style={s.successTitle}>Agro Booking Confirmed</Text>
      <Text style={s.successId}>{success}</Text>
      <Text style={s.successSub}>Your produce is registered in the RENAX system. A coordinator will confirm vehicle assignment.</Text>
      <Pressable style={s.btn} onPress={() => setSuccess('')}>
        <Text style={s.btnText}>Book Another</Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 28, paddingBottom: 80 }}>
      <PickerModal visible={showProduce} title="Select Produce Category" options={PRODUCE_CATEGORIES} onSelect={setProduceCategory} onClose={() => setShowProduce(false)} />

      <Animated.View entering={FadeInDown.duration(400)} style={s.heroBadge}>
        <Leaf color="#ccfd3a" size={20} />
        <Text style={s.heroText}>RENAX AGRO — Agricultural Produce Transit</Text>
      </Animated.View>
      <Text style={s.pageTitle}>New Agro Booking</Text>
      <Text style={s.pageSub}>Safe, reliable haulage for Nigerian farmers & agric dealers.</Text>

      {/* Sender */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.card}>
        <Text style={s.cardTitle}>1. Pickup Details</Text>
        <TextInput style={s.input} placeholder="Sender / Farm Name" placeholderTextColor="#aaa" onChangeText={setSenderName} />
        <TextInput style={s.input} placeholder="Phone Number" placeholderTextColor="#aaa" keyboardType="phone-pad" onChangeText={setSenderPhone} />
        <Text style={s.label}>Pickup / Farm Location</Text>
        <OSMAutocomplete placeholder="Search farm or warehouse address..." onSelect={setPickupData} />
      </Animated.View>

      {/* Recipient */}
      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.card}>
        <Text style={s.cardTitle}>2. Delivery Details</Text>
        <TextInput style={s.input} placeholder="Buyer / Dealer Name" placeholderTextColor="#aaa" onChangeText={setRecipientName} />
        <TextInput style={s.input} placeholder="Phone Number" placeholderTextColor="#aaa" keyboardType="phone-pad" onChangeText={setRecipientPhone} />
        <Text style={s.label}>Delivery / Market Address</Text>
        <OSMAutocomplete placeholder="Search market or buyer address..." onSelect={setDeliveryData} />
      </Animated.View>

      {/* Produce Details */}
      <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.card}>
        <Text style={s.cardTitle}>3. Produce & Vehicle Details</Text>

        <Text style={s.label}>Produce Category</Text>
        <Pressable style={s.select} onPress={() => setShowProduce(true)}>
          <Text style={[s.selectText, !produceCategory && { color: '#aaa' }]} numberOfLines={1}>{produceCategory || 'Select produce type...'}</Text>
          <ChevronDown color="#666" size={16} />
        </Pressable>

        <Text style={s.label}>Estimated Weight / Tonnage</Text>
        <TextInput style={s.input} placeholder="e.g. 2.5 (in metric tonnes)" placeholderTextColor="#aaa" keyboardType="numeric" onChangeText={setTonnage} />

        <Text style={s.label}>Vehicle Type</Text>
        {VEHICLE_TYPES.map(v => (
          <Pressable key={v.id} style={[s.vehicleCard, vehicleType === v.id && s.vehicleCardActive]} onPress={() => setVehicleType(v.id)}>
            <Truck color={vehicleType === v.id ? '#ccfd3a' : '#666'} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[s.vehicleLabel, vehicleType === v.id && { color: '#ccfd3a' }]}>{v.label}</Text>
              <Text style={s.vehicleNote}>{v.note}</Text>
            </View>
            {vehicleType === v.id && <Check color="#ccfd3a" size={16} />}
          </Pressable>
        ))}
      </Animated.View>

      {/* Options */}
      <Animated.View entering={FadeInDown.delay(320).duration(400)} style={s.card}>
        <Text style={s.cardTitle}>4. Safety & Handling Options</Text>

        <View style={s.toggleRow}>
          <Thermometer color={coldChain ? '#ccfd3a' : '#999'} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Requires Cold Chain</Text>
            <Text style={s.toggleSub}>For fish, dairy, fresh vegetables</Text>
          </View>
          <Switch value={coldChain} onValueChange={setColdChain} trackColor={{ true: '#004d3d' }} thumbColor={coldChain ? '#ccfd3a' : '#ccc'} />
        </View>

        <View style={s.toggleRow}>
          <ShieldCheck color={insured ? '#ccfd3a' : '#999'} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Agro-Transit Insurance</Text>
            <Text style={s.toggleSub}>Cargo covered against spoilage & damage</Text>
          </View>
          <Switch value={insured} onValueChange={setInsured} trackColor={{ true: '#004d3d' }} thumbColor={insured ? '#ccfd3a' : '#ccc'} />
        </View>

        <Text style={s.label}>Special Handling Instructions (Optional)</Text>
        <TextInput
          style={[s.input, { height: 70, textAlignVertical: 'top' }]}
          placeholder="e.g. Handle with care, do not stack more than 2 bags high"
          placeholderTextColor="#aaa"
          multiline
          onChangeText={setHandlingNotes}
        />
      </Animated.View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#002B22" /> : <FileText color="#002B22" size={18} />}
        <Text style={s.btnText}>{loading ? 'BOOKING...' : 'CONFIRM AGRO BOOKING'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#004d3d', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', marginBottom: 16 },
  heroText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#ccfd3a', letterSpacing: 0.5 },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 6 },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 22 },
  card: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111', marginBottom: 16 },
  label: { fontFamily: 'Outfit_6', fontSize: 12, color: '#555', marginBottom: 6, marginTop: 12, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontFamily: 'Outfit_4', fontSize: 14, color: '#222', backgroundColor: '#fafafa', marginBottom: 8 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, backgroundColor: '#fafafa' },
  selectText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#222', flex: 1, marginRight: 8 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, padding: 14, marginTop: 8, backgroundColor: '#fafafa' },
  vehicleCardActive: { borderColor: '#004d3d', backgroundColor: 'rgba(0,77,61,0.06)' },
  vehicleLabel: { fontFamily: 'Outfit_6', fontSize: 14, color: '#333' },
  vehicleNote: { fontFamily: 'Outfit_4', fontSize: 12, color: '#888', marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  toggleLabel: { fontFamily: 'Outfit_6', fontSize: 14, color: '#222' },
  toggleSub: { fontFamily: 'Outfit_4', fontSize: 12, color: '#888' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#ccfd3a', borderRadius: 14, paddingVertical: 18, marginTop: 8 },
  btnText: { fontFamily: 'PlusJakartaSans_7', fontSize: 15, color: '#002B22' },
  error: { fontFamily: 'Outfit_6', fontSize: 13, color: '#DC2626', textAlign: 'center', marginBottom: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '75%' },
  handle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 17, color: '#111', marginBottom: 12 },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  optionText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#333' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  successTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#004d3d' },
  successId: { fontFamily: 'PlusJakartaSans_7', fontSize: 28, color: '#111', letterSpacing: 2 },
  successSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
});
