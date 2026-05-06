// TrackShipmentTab.tsx — Live tracking with Supabase Realtime + Leaflet map
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, useWindowDimensions, ActivityIndicator, Linking, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Search, Truck, Clock, MapPin, Navigation, AlertCircle,
  CheckCircle, Circle, Radio, Map, Bike, AlertTriangle, ShieldCheck,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../supabase';
import TrackingMap from '../maps/TrackingMap';
import { shipmentStatusLabel, stageColor, stageLabel, stageProgress, stageProofLabel } from '../../utils/routingService';
import { getTrustBand, TRUST_BAND_LABELS, TRUST_BAND_COLORS, ARRIVED_AT_DISPLAY_MODEL } from '../../utils/stageRules';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── Exception messaging map ────────────────────────────────────────────────────
type ExceptionContext = {
  icon: string;
  title: string;
  body: string;
  color: string;
};

function getExceptionContext(stage: string, notes?: string): ExceptionContext | null {
  const n = (notes || '').toLowerCase();
  if (stage !== 'exception') return null;

  if (n.includes('delay') || n.includes('traffic') || n.includes('weather')) {
    return { icon: 'delayed', title: 'Shipment Delayed', body: 'Your shipment is experiencing a delay. We are working to get it moving as soon as possible.', color: '#F59E0B' };
  }
  if (n.includes('reroute') || n.includes('redirect') || n.includes('alternate')) {
    return { icon: 'rerouted', title: 'Shipment Rerouted', body: 'Your shipment has been redirected to an alternate route. Estimated delivery may be affected.', color: '#7C3AED' };
  }
  if (n.includes('hub') || n.includes('terminal') || n.includes('intake') || n.includes('awaiting')) {
    return { icon: 'hub', title: 'Awaiting Hub Intake', body: 'Your shipment is waiting to be checked in at the hub. No action required from you.', color: '#3B82F6' };
  }
  if (n.includes('failed') || n.includes('undeliverable') || n.includes('absent') || n.includes('no access')) {
    return { icon: 'failed', title: 'Failed Delivery Attempt', body: 'A delivery attempt was made but was unsuccessful. Our team will try again or contact you shortly.', color: '#DC2626' };
  }
  // Generic exception
  return { icon: 'exception', title: 'Shipment Exception', body: 'Your shipment has encountered an issue. A RENAX agent is reviewing and will update the status shortly.', color: '#DC2626' };
}

// ── Trust label helpers ────────────────────────────────────────────────────────
function proofTrustTag(proof: any): { label: string; color: string; bg: string } {
  const type = proof?.proof_type || '';
  const role = proof?.verified_by_role || 'system';
  if (type === 'geofence_auto' || role === 'system') {
    return { label: 'Suggested', color: '#B45309', bg: 'rgba(245,158,11,0.1)' };
  }
  if (type === 'manual_admin' || role === 'admin') {
    return { label: 'Admin Verified', color: '#047857', bg: 'rgba(16,185,129,0.1)' };
  }
  if (type === 'otp' || type === 'pickup_otp' || type === 'delivery_otp') {
    return { label: 'OTP Verified', color: '#004d3d', bg: 'rgba(0,77,61,0.08)' };
  }
  if (type === 'photo' || type === 'signature') {
    return { label: 'Photo Verified', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' };
  }
  return { label: 'System', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
}

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
  const [proofRecords, setProofRecords]   = useState<any[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState('');
  const [showMap, setShowMap]             = useState(false);
  const [terminalSummary, setTerminalSummary] = useState<{ source?: any; destination?: any }>({});
  const [arrivedAtSuggestions, setArrivedAtSuggestions] = useState<string[]>([]); // active arrived_at suggestion stages
  const channelRef = useRef<any>(null);

  const resolveProofMediaUrls = async (proofs: any[]) => {
    const resolved = await Promise.all((proofs || []).map(async (proof) => {
      const mediaPath = String(proof?.media_url || '').trim();
      if (!mediaPath || mediaPath.startsWith('data:') || mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
        return proof;
      }

      const { data, error } = await supabase.storage.from('shipment-proofs').createSignedUrl(mediaPath, 60 * 30);
      if (error || !data?.signedUrl) return { ...proof, media_url: null };
      return { ...proof, media_url: data.signedUrl };
    }));

    return resolved;
  };

  const resolveProofMediaUrl = async (proof: any) => {
    const [resolved] = await resolveProofMediaUrls([proof]);
    return resolved;
  };

  // ─── Track handler ────────────────────────────────────────────────────────
  const runTrackQuery = async (trackingId: string) => {
    const id = trackingId.trim();
    if (!id) { setError('Please enter an Order ID.'); return; }
    setError('');
    setIsLoading(true);
    setShipmentData(null);
    setTimelineEvents([]);
    setProofRecords([]);
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

      const { data: proofs } = await supabase
        .from('shipment_stage_proofs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at', { ascending: false });
      setProofRecords(await resolveProofMediaUrls(proofs || []));
      // Fetch arrived_at suggestions (suggestion-only stages for customer display)
      const { data: suggestions } = await supabase
        .from('shipment_stage_suggestions')
        .select('suggested_stage, suggestion_status')
        .eq('shipment_id', shipment.id)
        .eq('suggestion_status', 'pending')
        .in('suggested_stage', ['arrived_at_pickup', 'arrived_at_delivery']);
      setArrivedAtSuggestions((suggestions || []).map((s: any) => s.suggested_stage));
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'shipment_stage_proofs',
        filter: `shipment_id=eq.${shipmentData.id}`,
      }, async (payload: any) => {
        const resolvedProof = await resolveProofMediaUrl(payload.new);
        setProofRecords(prev => [resolvedProof, ...prev]);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'shipment_stage_suggestions',
        filter: `shipment_id=eq.${shipmentData.id}`,
      }, (payload: any) => {
        const s = payload.new;
        if (['arrived_at_pickup', 'arrived_at_delivery'].includes(s.suggested_stage) && s.suggestion_status === 'pending') {
          setArrivedAtSuggestions(prev => [...new Set([...prev, s.suggested_stage])]);
        }
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
  const displayStatus = shipmentData ? shipmentStatusLabel(currentStage, currentRoutingMode) : 'Pending Routing';
  const statusColor = shipmentData ? stageColor(currentStage) : '#F59E0B';
  const progress = shipmentData ? stageProgress(currentStage, currentRoutingMode) : 0;
  const hasCoords   = shipmentData?.pickup_lat && shipmentData?.delivery_lat;
  const isDelivered = currentStage === 'delivered' || shipmentData?.status?.toLowerCase() === 'delivered';
  const trustScore = Number(shipmentData?.latest_stage_confidence ?? 0.5);
  const trustBand = getTrustBand(trustScore);
  const trustLabel = TRUST_BAND_LABELS[trustBand];
  const trustColor = TRUST_BAND_COLORS[trustBand];
  const isException = currentStage === 'exception';
  const latestExceptionNote = timelineEvents.filter(e => e.stage === 'exception' || e.status === 'exception').slice(-1)[0]?.notes;
  const exceptionCtx = isException ? getExceptionContext(currentStage, latestExceptionNote) : null;
  const photoProofs = proofRecords.filter((p: any) => p.media_url);
  const nonPhotoProofs = proofRecords.filter((p: any) => !p.media_url);
  // Arrived-at pills: filter by current routing mode
  const arrivedAtPills = ARRIVED_AT_DISPLAY_MODEL.filter(
    m => arrivedAtSuggestions.includes(m.stage) && m.routingModes.includes(currentRoutingMode as any)
  );

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

          {/* ── Arrived-at suggestion pills (suggestion-only stages) ── */}
          {arrivedAtPills.length > 0 && (
            <View style={{ gap: 10, marginBottom: 14 }}>
              {arrivedAtPills.map(pill => (
                <Animated.View key={pill.stage} entering={FadeInDown.duration(400)} style={styles.arrivedAtPill}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Navigation color="#B45309" size={15} />
                    <Text style={styles.arrivedAtPillTitle}>{pill.label}</Text>
                    <View style={styles.arrivedAtBadge}>
                      <Text style={styles.arrivedAtBadgeText}>Suggested</Text>
                    </View>
                  </View>
                  <Text style={styles.arrivedAtPillBody}>{pill.description}</Text>
                </Animated.View>
              ))}
            </View>
          )}

          {/* ── Realtime badge ── */}
          <View style={styles.realtimeBadge}>
            <View style={styles.realtimeDot} />
            <Text style={styles.realtimeText}>LIVE — Auto-updates when status changes</Text>
          </View>


          {/* ── Trust Banner ── */}
          <View style={[styles.trustBanner, { borderColor: trustColor + '44', backgroundColor: trustColor + '0d' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldCheck color={trustColor} size={16} />
              <Text style={[styles.trustBannerTitle, { color: trustColor }]}>{trustLabel}</Text>
            </View>
            <Text style={styles.trustBannerSub}>
              {shipmentData?.latest_stage_proof_summary
                ? `Latest milestone was backed by ${shipmentData.latest_stage_proof_summary.toLowerCase()}.`
                : 'This shipment is still waiting on proof-backed milestone evidence.'}
            </Text>
          </View>

          {/* ── Exception Banner ── */}
          {exceptionCtx && (
            <Animated.View entering={FadeInDown.duration(400)} style={[styles.exceptionBanner, { borderColor: exceptionCtx.color + '55', backgroundColor: exceptionCtx.color + '10' }]}>
              <AlertTriangle color={exceptionCtx.color} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.exceptionTitle, { color: exceptionCtx.color }]}>{exceptionCtx.title}</Text>
                <Text style={styles.exceptionBody}>{exceptionCtx.body}</Text>
              </View>
            </Animated.View>
          )}

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

              {/* ── Stage Evidence & Photo Gallery ── */}
              <View style={styles.proofCard}>
                <Text style={styles.proofCardTitle}>Stage Evidence</Text>

                {/* Photo Gallery */}
                {photoProofs.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={styles.proofGalleryLabel}>Proof Photos ({photoProofs.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {photoProofs.map((proof: any, index: number) => {
                          const tag = proofTrustTag(proof);
                          return (
                            <Pressable
                              key={`photo-${proof.id || index}`}
                              style={styles.proofPhotoCard}
                              onPress={() => Linking.openURL(proof.media_url)}
                            >
                              <Image
                                source={{ uri: proof.media_url }}
                                style={styles.proofPhotoThumb}
                                resizeMode="cover"
                              />
                              <View style={[styles.proofTrustTag, { backgroundColor: tag.bg }]}>
                                <Text style={[styles.proofTrustTagText, { color: tag.color }]}>{tag.label}</Text>
                              </View>
                              <Text style={styles.proofPhotoStage}>{stageLabel(proof.stage || currentStage)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Evidence list */}
                {nonPhotoProofs.length === 0 && photoProofs.length === 0 ? (
                  <Text style={styles.proofCardSub}>No verification proofs have been attached yet.</Text>
                ) : (
                  nonPhotoProofs.slice(0, 6).map((proof: any, index: number) => {
                    const tag = proofTrustTag(proof);
                    return (
                      <View key={`${proof.id || proof.created_at}-${index}`} style={styles.proofRow}>
                        <View style={[styles.proofDot, { backgroundColor: tag.color }]} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <Text style={styles.proofType}>{stageProofLabel(proof.proof_type)}</Text>
                            <View style={[styles.proofTrustTag, { backgroundColor: tag.bg }]}>
                              <Text style={[styles.proofTrustTagText, { color: tag.color }]}>{tag.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.proofStage}>{stageLabel(proof.stage || currentStage)}</Text>
                          <Text style={styles.proofMeta}>
                            {(proof.verified_by_role || 'system').replace(/_/g, ' ')} • {formatDate(proof.created_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
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
  arrivedAtPill: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: 14, padding: 14 },
  arrivedAtPillTitle: { fontFamily: 'Outfit_7', fontSize: 14, color: '#92400E', flex: 1 },
  arrivedAtPillBody: { fontFamily: 'Outfit_4', fontSize: 13, color: '#78350F', lineHeight: 20 },
  arrivedAtBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  arrivedAtBadgeText: { fontFamily: 'Outfit_6', fontSize: 10, color: '#B45309', letterSpacing: 0.5 },
  realtimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  realtimeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  realtimeText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#10B981', letterSpacing: 0.5 },
  trustBanner: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  trustBannerTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 15, marginBottom: 4 },
  trustBannerSub: { fontFamily: 'Outfit_4', fontSize: 13, lineHeight: 20, color: '#444' },
  exceptionBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  exceptionTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 15, marginBottom: 4 },
  exceptionBody: { fontFamily: 'Outfit_4', fontSize: 13, lineHeight: 20, color: '#444' },
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
  proofCard: { backgroundColor: '#fcfffa', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#d9f99d', marginBottom: 14 },
  proofCardTitle: { fontFamily: 'Outfit_7', fontSize: 13, color: '#365314', marginBottom: 8 },
  proofCardSub: { fontFamily: 'Outfit_4', fontSize: 12, lineHeight: 18, color: '#4b5563' },
  proofGalleryLabel: { fontFamily: 'Outfit_6', fontSize: 12, color: '#365314', letterSpacing: 0.5 },
  proofPhotoCard: { width: 110, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#d9f99d', backgroundColor: '#f0fdf4' },
  proofPhotoThumb: { width: 110, height: 80 },
  proofPhotoStage: { fontFamily: 'Outfit_4', fontSize: 11, color: '#365314', paddingHorizontal: 8, paddingBottom: 6, marginTop: 4 },
  proofTrustTag: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginHorizontal: 8, marginTop: 4 },
  proofTrustTagText: { fontFamily: 'Outfit_7', fontSize: 10, letterSpacing: 0.5 },
  proofRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#ecfccb' },
  proofDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  proofType: { fontFamily: 'Outfit_7', fontSize: 13, color: '#1f2937' },
  proofStage: { fontFamily: 'Outfit_4', fontSize: 12, color: '#365314', marginTop: 2 },
  proofMeta: { fontFamily: 'Outfit_4', fontSize: 11, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' },
  proofLink: { fontFamily: 'Outfit_6', fontSize: 12, color: '#047857', marginTop: 6 },
  riderCard: { backgroundColor: 'rgba(204,253,58,0.08)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(204,253,58,0.25)', marginBottom: 12 },
  riderCardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 15, color: '#004d3d' },
  riderCardSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#555' },
  riderCardLoc: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
  deliveredBanner: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deliveredText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#047857' },
});
