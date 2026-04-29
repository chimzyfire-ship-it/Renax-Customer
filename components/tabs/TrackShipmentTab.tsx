// TrackShipmentTab.tsx — Live tracking with Supabase Realtime + Leaflet map
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Search, Truck, Clock, MapPin, Navigation, AlertCircle,
  CheckCircle, Circle, Radio, Map, Bike
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../supabase';
import TrackingMap from '../maps/TrackingMap';
import { shipmentStatusFromStage, stageColor, stageLabel, stageProgress } from '../../utils/routingService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ─── Component ────────────────────────────────────────────────────────────────
type TrackShipmentTabProps = {
  initialTrackingId?: string;
  autoTrackSignal?: number;
};

export default function TrackShipmentTab({ initialTrackingId = '', autoTrackSignal = 0 }: TrackShipmentTabProps) {
  useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;
  const isCompact = width < 640;

  const [searchQuery, setSearchQuery]     = useState('');
  const [shipmentData, setShipmentData]   = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState('');
  const [showMap, setShowMap]             = useState(false);
  const [terminalSummary, setTerminalSummary] = useState<{ source?: any; destination?: any }>({});
  const channelRef = useRef<any>(null);

  // ─── Track handler ────────────────────────────────────────────────────────
  const runTrackQuery = async (trackingId: string) => {
    const id = trackingId.trim();
    if (!id) { setError('Please enter an Order ID.'); return; }
    setError('');
    setIsLoading(true);
    setShipmentData(null);
    setTimelineEvents([]);
    setShowMap(false);

    try {
      const { data: shipment, error: err } = await supabase
        .from('shipments')
        .select('*')
        .eq('tracking_id', id)
        .single();

      if (err || !shipment) { setError('Shipment not found. Check the Order ID and try again.'); setIsLoading(false); return; }
      setShipmentData(shipment);

      if (shipment.source_terminal_id || shipment.destination_terminal_id) {
        const terminalIds = [shipment.source_terminal_id, shipment.destination_terminal_id].filter(Boolean);
        const { data: terminals } = await supabase.from('terminals').select('*').in('id', terminalIds);
        setTerminalSummary({
          source: terminals?.find((terminal: any) => terminal.id === shipment.source_terminal_id),
          destination: terminals?.find((terminal: any) => terminal.id === shipment.destination_terminal_id),
        });
      } else {
        setTerminalSummary({});
      }

      // Fetch timeline events
      const { data: events } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at', { ascending: true });
      setTimelineEvents(events || []);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrack = async () => {
    await runTrackQuery(searchQuery);
  };

  useEffect(() => {
    if (initialTrackingId) {
      setSearchQuery(initialTrackingId);
    }
  }, [initialTrackingId]);

  useEffect(() => {
    if (initialTrackingId && autoTrackSignal > 0) {
      runTrackQuery(initialTrackingId);
    }
  }, [autoTrackSignal, initialTrackingId]);

  // ─── Realtime subscription — auto-updates without refresh ─────────────────
  useEffect(() => {
    if (!shipmentData?.id) return;

    channelRef.current = supabase
      .channel(`track-${shipmentData.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shipments',
        filter: `id=eq.${shipmentData.id}`,
      }, (payload: any) => {
        setShipmentData(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'shipment_events',
        filter: `shipment_id=eq.${shipmentData.id}`,
      }, (payload: any) => {
        setTimelineEvents(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [shipmentData?.id]);

  // ─── Derived values ───────────────────────────────────────────────────────
  const currentStage = shipmentData?.dispatch_stage || 'pending_routing';
  const currentRoutingMode = shipmentData?.routing_mode || 'last_mile_local';
  const displayStatus = shipmentData ? shipmentStatusFromStage(currentStage, currentRoutingMode) : 'Pending Routing';
  const statusColor = shipmentData ? stageColor(currentStage) : '#F59E0B';
  const progress = shipmentData ? stageProgress(currentStage, currentRoutingMode) : 0;
  const hasCoords   = shipmentData?.pickup_lat && shipmentData?.delivery_lat;
  const isDelivered = currentStage === 'delivered' || shipmentData?.status?.toLowerCase() === 'delivered';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: isCompact ? 16 : isMobile ? 20 : 32, paddingBottom: 60 }}>

      {/* ── Header ── */}
      <View style={[styles.header, isCompact && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>
            {shipmentData ? `Tracking ${shipmentData.tracking_id}` : 'Shipment Tracking'}
          </Text>
          <Text style={styles.pageSub}>
            {shipmentData
              ? `${shipmentData.pickup_address?.split(',')[0]} → ${shipmentData.delivery_address?.split(',')[0]}`
              : 'Enter your Order ID below to see live shipment status'}
          </Text>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, isCompact && styles.searchBarCompact]}>
          <Search color="#004d3d" size={18} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Enter Order ID e.g. RNX-345525"
            placeholderTextColor="#aaa"
            onSubmitEditing={handleTrack}
          />
          <Pressable style={styles.searchBtn} onPress={handleTrack} disabled={isLoading}>
            {isLoading
              ? <ActivityIndicator color="#002B22" size="small" />
              : <Text style={styles.searchBtnText}>TRACK</Text>
            }
          </Pressable>
        </View>
      </View>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBanner}>
          <AlertCircle color="#DC2626" size={18} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Empty state */}
      {!shipmentData && !isLoading && !error && (
        <View style={styles.emptyState}>
          <Radio color="#ccfd3a" size={40} strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>Ready to Track</Text>
          <Text style={styles.emptySub}>Enter your RENAX Order ID above to see real-time shipment status, route, and live rider location.</Text>
        </View>
      )}

      {/* ── Results ── */}
      {shipmentData && (
        <Animated.View entering={FadeInDown.duration(500)}>

          {/* ── Stat Cards ── */}
          <View style={[styles.statRow, isMobile && { flexWrap: 'wrap' }]}>
            {[
              { label: 'Status', value: displayStatus, accent: true, icon: Truck },
              { label: 'Distance', value: shipmentData.distance_km ? `${shipmentData.distance_km} km` : 'N/A', icon: MapPin },
              { label: 'Routing', value: currentRoutingMode === 'relay_terminal' ? 'Terminal Relay' : currentRoutingMode === 'manual_review' ? 'Manual Review' : 'Local Delivery', icon: Navigation },
              { label: 'Amount', value: shipmentData.estimated_price ? `₦${Number(shipmentData.estimated_price).toLocaleString()}` : 'N/A', icon: Clock },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <Animated.View key={card.label} entering={FadeInDown.delay(i * 80).duration(400)} style={[styles.statCard, isCompact && styles.statCardCompact]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{card.label}</Text>
                    <Text style={[styles.statValue, card.accent && { color: statusColor }]}>{card.value}</Text>
                  </View>
                  <Icon color="#ccfd3a" size={28} strokeWidth={1.5} />
                </Animated.View>
              );
            })}
          </View>

          {/* ── Progress bar ── */}
          <View style={[styles.progressWrap, isCompact && styles.progressWrapCompact]}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: statusColor }]} />
            </View>
            <Text style={styles.progressLabel}>{progress}% Complete</Text>
          </View>

          {/* ── Realtime badge ── */}
          <View style={styles.realtimeBadge}>
            <View style={styles.realtimeDot} />
            <Text style={styles.realtimeText}>LIVE — Auto-updates when status changes</Text>
          </View>

          {/* ── Main grid ── */}
          <View style={[styles.mainGrid, isMobile && { flexDirection: 'column' }]}>

            {/* Map card */}
            <View style={styles.mapCard}>
              <View style={styles.mapCardHeader}>
                <Text style={styles.mapCardTitle}>Live Route Map</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {currentRoutingMode === 'relay_terminal' && (
                    <View style={styles.interStatePill}>
                      <Text style={styles.interStatePillText}>TERMINAL RELAY</Text>
                    </View>
                  )}
                  {currentRoutingMode === 'last_mile_local' && (
                    <View style={[styles.interStatePill, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' }]}>
                      <Text style={[styles.interStatePillText, { color: '#10B981' }]}>LOCAL DELIVERY</Text>
                    </View>
                  )}
                  {hasCoords && (
                    <Pressable
                      style={[styles.viewMapBtn, showMap && { backgroundColor: '#EF4444' }]}
                      onPress={() => setShowMap(v => !v)}
                    >
                      <Text style={styles.viewMapBtnText}>{showMap ? 'CLOSE MAP' : 'VIEW MAP'}</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Actual map */}
              {showMap && hasCoords ? (
                <View style={{ height: 380 }}>
                  <TrackingMap
                    pickupLat={shipmentData.pickup_lat}
                    pickupLon={shipmentData.pickup_lon}
                    deliveryLat={shipmentData.delivery_lat}
                    deliveryLon={shipmentData.delivery_lon}
                    riderLat={shipmentData.rider_lat}
                    riderLon={shipmentData.rider_lon}
                    status={displayStatus}
                    shipmentType={shipmentData.shipment_type}
                    trackingId={shipmentData.tracking_id}
                    pickupAddress={shipmentData.pickup_address}
                    deliveryAddress={shipmentData.delivery_address}
                  />
                </View>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Map color="#ccfd3a" size={40} />
                  <Text style={styles.mapPlaceholderTitle}>
                    {hasCoords ? 'Tap VIEW MAP to see the live route' : 'Map not available — no coordinates saved'}
                  </Text>
                  <Text style={styles.mapPlaceholderSub}>
                    {hasCoords
                      ? 'Route, rider position, and ETA will appear on the map'
                      : 'Address coordinates were not saved with this shipment'}
                  </Text>
                </View>
              )}

              {/* Timeline */}
              <View style={styles.timeline}>
                <Text style={styles.timelineTitle}>Status Timeline</Text>
                {timelineEvents.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <Circle color="#F59E0B" size={18} />
                    <View>
                      <Text style={styles.tlEvent}>Order Created — Pending</Text>
                      <Text style={styles.tlDate}>{formatDate(shipmentData.created_at)}</Text>
                    </View>
                  </View>
                ) : (
                  timelineEvents.map((event, i) => (
                    <View key={i} style={styles.tlRow}>
                      <View style={styles.tlLeft}>
                        <View style={[styles.tlDot, { backgroundColor: stageColor(event.stage || event.status || currentStage) }]} />
                        {i < timelineEvents.length - 1 && <View style={styles.tlLine} />}
                      </View>
                      <View style={styles.tlBody}>
                        <Text style={styles.tlEvent}>{stageLabel(event.stage || event.status || 'pending_routing')}</Text>
                        <Text style={styles.tlNote}>
                          {event.notes || event.description || event.location_name || event.title || 'Shipment update recorded.'}
                        </Text>
                        <Text style={styles.tlDate}>{formatDate(event.created_at)}</Text>
                      </View>
                      <View style={[styles.tlBadge, { borderColor: stageColor(event.stage || event.status || currentStage) + '44' }]}>
                        <Text style={[styles.tlBadgeText, { color: stageColor(event.stage || event.status || currentStage) }]}>
                          {stageLabel(event.stage || event.status || 'pending_routing')}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Details panel */}
            <View style={[styles.detailsCard, isCompact && styles.detailsCardCompact]}>
              <Text style={styles.detailsTitle}>Shipment Info</Text>
              <View style={styles.detailsGrid}>
                {[
                  { label: 'Order ID',     value: shipmentData.tracking_id },
                  { label: 'Sender',       value: shipmentData.sender_name },
                  { label: 'Pickup',       value: shipmentData.pickup_address?.split(',').slice(0,2).join(',') },
                  { label: 'Landmark',     value: shipmentData.pickup_landmark || 'N/A' },
                  { label: 'Recipient',    value: shipmentData.recipient_name },
                  { label: 'Delivery',     value: shipmentData.delivery_address?.split(',').slice(0,2).join(',') },
                  { label: 'Package',      value: `${shipmentData.weight_kg}kg · ${shipmentData.package_category}` },
                  { label: 'Payment',      value: shipmentData.payment_method },
                  { label: 'Routing',      value: currentRoutingMode === 'relay_terminal' ? 'Terminal Relay' : currentRoutingMode === 'manual_review' ? 'Manual Review' : 'Local Delivery' },
                  { label: 'Dispatch Stage', value: stageLabel(currentStage) },
                  { label: 'Source Hub',   value: terminalSummary.source?.name || 'N/A' },
                  { label: 'Destination Hub', value: terminalSummary.destination?.name || 'N/A' },
                  { label: 'Created',      value: formatDate(shipmentData.created_at) },
                ].map(d => (
                  <View key={d.label} style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{d.label}</Text>
                    <Text style={styles.detailValue}>{d.value || 'N/A'}</Text>
                  </View>
                ))}
              </View>

              {/* Status pill */}
              <View style={[styles.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '44' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusPillText, { color: statusColor }]}>{displayStatus}</Text>
              </View>

              {/* Rider info if assigned */}
              {shipmentData.assigned_rider_id && (
                <View style={styles.riderCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Bike color="#004d3d" size={16} />
                    <Text style={styles.riderCardTitle}>Rider Assigned</Text>
                  </View>
                  <Text style={styles.riderCardSub}>A rider has accepted your shipment and is on the way.</Text>
                  {shipmentData.rider_lat && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <MapPin color="#004d3d" size={12} />
                      <Text style={styles.riderCardLoc}>Last known location updated live</Text>
                    </View>
                  )}
                </View>
              )}

              {isDelivered && (
                <View style={styles.deliveredBanner}>
                  <CheckCircle color="#047857" size={18} style={{ marginRight: 8 }} />
                  <Text style={styles.deliveredText}>Delivered Successfully!</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#111', marginBottom: 4 },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingLeft: 14, borderWidth: 1, borderColor: '#e0e0e0', gap: 8, minWidth: 340 },
  searchBarCompact: { minWidth: 0, width: '100%' },
  searchInput: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333', paddingVertical: 10 },
  searchBtn: { backgroundColor: '#004d3d', paddingHorizontal: 16, paddingVertical: 12, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  searchBtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#ccfd3a', letterSpacing: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#991b1b', flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#111' },
  emptySub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#888', textAlign: 'center', maxWidth: 400, lineHeight: 22 },
  statRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  statCard: { flex: 1, minWidth: 160, backgroundColor: '#004d3d', borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statCardCompact: { minWidth: '100%' as any },
  statLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  statValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#fff' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  progressWrapCompact: { flexWrap: 'wrap' },
  progressTrack: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontFamily: 'Outfit_6', fontSize: 13, color: '#555', minWidth: 90 },
  realtimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  realtimeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  realtimeText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#10B981', letterSpacing: 0.5 },
  mainGrid: { flexDirection: 'row', gap: 20 },
  mapCard: { flex: 2, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  mapCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  mapCardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111' },
  interStatePill: { backgroundColor: 'rgba(180,83,9,0.1)', borderWidth: 1, borderColor: 'rgba(180,83,9,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  interStatePillText: { fontFamily: 'Outfit_6', fontSize: 11, color: '#B45309', letterSpacing: 0.5 },
  viewMapBtn: { backgroundColor: '#004d3d', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  viewMapBtnText: { fontFamily: 'Outfit_7', fontSize: 12, color: '#ccfd3a', letterSpacing: 1 },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10, backgroundColor: '#041910', margin: 16, borderRadius: 12 },
  mapPlaceholderTitle: { fontFamily: 'PlusJakartaSans_6', fontSize: 15, color: '#fff', textAlign: 'center' },
  mapPlaceholderSub: { fontFamily: 'Outfit_4', fontSize: 13, color: 'rgba(200,255,220,0.5)', textAlign: 'center', lineHeight: 20 },
  timeline: { padding: 20 },
  timelineTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 15, color: '#111', marginBottom: 16 },
  tlRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  tlLeft: { alignItems: 'center', width: 16 },
  tlDot: { width: 12, height: 12, borderRadius: 6 },
  tlLine: { width: 2, flex: 1, backgroundColor: '#e0e0e0', marginVertical: 4 },
  tlBody: { flex: 1, paddingBottom: 18 },
  tlEvent: { fontFamily: 'Outfit_6', fontSize: 14, color: '#222' },
  tlNote: { fontFamily: 'Outfit_4', fontSize: 12, color: '#666', marginTop: 2 },
  tlDate: { fontFamily: 'Outfit_4', fontSize: 12, color: '#999', marginTop: 3 },
  tlBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  tlBadgeText: { fontFamily: 'Outfit_6', fontSize: 11 },
  detailsCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, minWidth: 260 },
  detailsCardCompact: { minWidth: 0, padding: 18 },
  detailsTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 20 },
  detailsGrid: { gap: 14, marginBottom: 24 },
  detailItem: { gap: 3 },
  detailLabel: { fontFamily: 'Outfit_4', fontSize: 11, color: '#aaa', letterSpacing: 0.5, textTransform: 'uppercase' },
  detailValue: { fontFamily: 'Outfit_6', fontSize: 14, color: '#222' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontFamily: 'Outfit_7', fontSize: 13, letterSpacing: 0.5 },
  riderCard: { backgroundColor: 'rgba(204,253,58,0.08)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(204,253,58,0.25)', marginBottom: 12 },
  riderCardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 15, color: '#004d3d' },
  riderCardSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#555' },
  riderCardLoc: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
  deliveredBanner: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deliveredText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#047857' },
});
