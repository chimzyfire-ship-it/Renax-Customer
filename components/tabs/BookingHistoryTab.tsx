import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown, FileText, Navigation2, RefreshCw, X } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  fetchCustomerBookings,
  fetchShipmentDetails,
  resolveCustomerId,
  ShipmentEventRecord,
  ShipmentRecord,
} from '../../utils/customerData';
import { shipmentStatusFromStage, stageLabel } from '../../utils/routingService';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Delivered: { bg: '#004d3d', text: '#ccfd3a' },
  'In Transit': { bg: '#F59E0B', text: '#fff' },
  Pending: { bg: '#F59E0B', text: '#fff' },
  'Pending Routing': { bg: '#F59E0B', text: '#fff' },
  'Awaiting Rider': { bg: '#F59E0B', text: '#fff' },
  'Awaiting First-Mile Rider': { bg: '#F59E0B', text: '#fff' },
  'En Route to Source Hub': { bg: '#2563EB', text: '#fff' },
  'At Source Hub': { bg: '#7C3AED', text: '#fff' },
  'Linehaul In Transit': { bg: '#6D28D9', text: '#fff' },
  'At Destination Hub': { bg: '#2563EB', text: '#fff' },
  'Awaiting Final-Mile Rider': { bg: '#0EA5E9', text: '#fff' },
  Cancelled: { bg: '#EF4444', text: '#fff' },
  'Out For Delivery': { bg: '#2563EB', text: '#fff' },
  'Out for Delivery': { bg: '#2563EB', text: '#fff' },
  'Rider Assigned': { bg: '#2563EB', text: '#fff' },
  Exception: { bg: '#EF4444', text: '#fff' },
};

const DATE_OPTIONS = ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last 3 Months'];
const STATUS_OPTIONS = ['All Status', 'Delivered', 'In Transit', 'Pending', 'Cancelled'];

type BookingHistoryTabProps = {
  customerId?: string | null;
  onTrackShipment?: (trackingId: string) => void;
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatAmount = (price: number | null | undefined) =>
  `₦${Number(price ?? 0).toLocaleString('en-US')}`;

function FilterSelect({
  label,
  value,
  options,
  open,
  onOpen,
  onClose,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <>
      <Pressable onPress={onOpen} style={styles.filterBtn}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>{label}</Text>
          <Text style={styles.filterBtnText}>{value}</Text>
        </View>
        <ChevronDown color="#444" size={16} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.selectModal} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.selectTitle}>{label}</Text>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <X color="#444" size={16} />
              </Pressable>
            </View>

            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
                style={[styles.selectOption, value === option && styles.selectOptionActive]}
              >
                <Text style={[styles.selectOptionText, value === option && styles.selectOptionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function BookingHistoryTab({ customerId, onTrackShipment }: BookingHistoryTabProps) {
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId ?? null);
  const [bookings, setBookings] = useState<ShipmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [openFilter, setOpenFilter] = useState<'date' | 'status' | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ShipmentRecord | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ShipmentEventRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (customerId) {
      setResolvedCustomerId(customerId);
      return;
    }

    resolveCustomerId()
      .then(setResolvedCustomerId)
      .catch((error) => {
        console.error('Failed to resolve customer id', error);
        setErrorMessage('Could not resolve the current customer profile.');
      });
  }, [customerId]);

  const loadBookings = useCallback(async (showRefreshing = false) => {
    if (!resolvedCustomerId) return;

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await fetchCustomerBookings(resolvedCustomerId);
      setBookings(data);
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setErrorMessage('Booking history is unavailable until the customer tables are migrated.');
      setBookings([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [resolvedCustomerId]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    const now = Date.now();
    return bookings.filter((booking) => {
      const statusMatch =
        statusFilter === 'All Status' ||
        (booking.status ?? '').toLowerCase() === statusFilter.toLowerCase();

      if (!statusMatch) return false;
      if (dateFilter === 'All Time') return true;

      const createdAt = booking.created_at ? new Date(booking.created_at).getTime() : 0;
      const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);

      if (dateFilter === 'Last 7 Days') return diffDays <= 7;
      if (dateFilter === 'Last 30 Days') return diffDays <= 30;
      if (dateFilter === 'Last 3 Months') return diffDays <= 90;
      return true;
    });
  }, [bookings, dateFilter, statusFilter]);

  const handleViewDetails = async (booking: ShipmentRecord) => {
    setSelectedBooking(booking);
    setTimelineEvents([]);
    setDetailLoading(true);

    try {
      const { shipment, events } = await fetchShipmentDetails(booking.id);
      setSelectedBooking(shipment);
      setTimelineEvents(events);
    } catch (error) {
      console.error('Failed to fetch booking details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTrack = (booking: ShipmentRecord) => {
    const trackingId = booking.tracking_id || booking.id;
    if (trackingId) {
      onTrackShipment?.(trackingId);
    }
  };

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>
        <Text style={styles.pageTitle}>Booking History</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.cardTitle}>Your Past Bookings</Text>
              <Text style={styles.cardSub}>Track, review, and inspect every shipment placed from this account.</Text>
            </View>
            <Pressable style={styles.refreshBtn} onPress={() => loadBookings(true)}>
              <RefreshCw color="#004d3d" size={16} />
              <Text style={styles.refreshBtnText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </Pressable>
          </View>

          <View style={styles.filtersRow}>
            <FilterSelect
              label="Date Range"
              value={dateFilter}
              options={DATE_OPTIONS}
              open={openFilter === 'date'}
              onOpen={() => setOpenFilter('date')}
              onClose={() => setOpenFilter(null)}
              onSelect={setDateFilter}
            />
            <FilterSelect
              label="Shipment Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              open={openFilter === 'status'}
              onOpen={() => setOpenFilter('status')}
              onClose={() => setOpenFilter(null)}
              onSelect={setStatusFilter}
            />
          </View>

          <View style={styles.tableHeader}>
            {['Date', 'Order ID', 'Destination', 'Status', 'Amount (₦)', 'Actions'].map((header, index) => (
              <Text key={header} style={[styles.thCell, index === 5 && { textAlign: 'right' }]}>
                {header}
              </Text>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#004d3d" size="large" />
              <Text style={styles.centerStateText}>Loading bookings...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : filteredBookings.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.centerStateText}>No bookings found for the selected filters.</Text>
            </View>
          ) : (
            <>
              {filteredBookings.slice(0, 50).map((booking, index) => {
                const derivedStatus = shipmentStatusFromStage(booking.dispatch_stage || 'pending_routing', booking.routing_mode || 'last_mile_local');
                const statusKey = booking.status || derivedStatus;
                const statusStyle = STATUS_STYLE[statusKey] ?? STATUS_STYLE.Pending;

                return (
                  <Animated.View
                    key={booking.id}
                    entering={FadeInDown.delay(index * 50).duration(300)}
                    style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                  >
                    <Text style={styles.tdCell}>{formatDate(booking.created_at)}</Text>
                    <Text style={[styles.tdCell, styles.orderId]}>{booking.tracking_id || booking.id}</Text>
                    <Text style={styles.tdCell}>{booking.delivery_address || 'N/A'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{statusKey}</Text>
                    </View>
                    <Text style={[styles.tdCell, styles.amountCell]}>{formatAmount(booking.estimated_price)}</Text>
                    <View style={styles.actionsCell}>
                      <Pressable style={styles.actionBtn} onPress={() => handleViewDetails(booking)}>
                        <FileText color="#002B22" size={14} />
                        <Text style={styles.actionBtnText}>View Details</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnOutline} onPress={() => handleTrack(booking)}>
                        <Navigation2 color="#004d3d" size={14} />
                        <Text style={styles.actionBtnOutlineText}>Track</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })}

              <Text style={styles.footNote}>
                Displaying {Math.min(filteredBookings.length, 50)} of {filteredBookings.length} booking{filteredBookings.length === 1 ? '' : 's'}.
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedBooking} transparent animationType="slide" onRequestClose={() => setSelectedBooking(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedBooking(null)}>
          <Pressable style={styles.detailsModal} onPress={() => {}}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.detailsTitle}>Booking Details</Text>
                <Text style={styles.detailsSub}>{selectedBooking?.tracking_id || selectedBooking?.id}</Text>
              </View>
              <Pressable onPress={() => setSelectedBooking(null)} style={styles.iconBtn}>
                <X color="#444" size={16} />
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.centerState}>
                <ActivityIndicator color="#004d3d" />
                <Text style={styles.centerStateText}>Loading shipment details...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Created</Text>
                    <Text style={styles.detailsValue}>{formatDateTime(selectedBooking?.created_at)}</Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Status</Text>
                    <Text style={styles.detailsValue}>
                      {shipmentStatusFromStage(selectedBooking?.dispatch_stage || 'pending_routing', selectedBooking?.routing_mode || 'last_mile_local')}
                    </Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Dispatch Stage</Text>
                    <Text style={styles.detailsValue}>{stageLabel(selectedBooking?.dispatch_stage || 'pending_routing')}</Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Routing</Text>
                    <Text style={styles.detailsValue}>
                      {selectedBooking?.routing_mode === 'relay_terminal'
                        ? 'Terminal Relay'
                        : selectedBooking?.routing_mode === 'manual_review'
                          ? 'Manual Review'
                          : 'Local Delivery'}
                    </Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Pickup</Text>
                    <Text style={styles.detailsValue}>{selectedBooking?.pickup_address || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Destination</Text>
                    <Text style={styles.detailsValue}>{selectedBooking?.delivery_address || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Service</Text>
                    <Text style={styles.detailsValue}>{selectedBooking?.service_level || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Payment</Text>
                    <Text style={styles.detailsValue}>{selectedBooking?.payment_method || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Distance</Text>
                    <Text style={styles.detailsValue}>
                      {selectedBooking?.distance_km ? `${selectedBooking.distance_km} km` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Amount</Text>
                    <Text style={styles.detailsValue}>{formatAmount(selectedBooking?.estimated_price)}</Text>
                  </View>
                </View>

                <Text style={styles.timelineTitle}>Shipment Timeline</Text>
                {timelineEvents.length === 0 ? (
                  <Text style={styles.timelineEmpty}>No timeline events have been logged for this booking yet.</Text>
                ) : (
                  timelineEvents.map((event) => (
                    <View key={event.id} style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineEventTitle}>{stageLabel(event.stage || event.status || 'pending_routing')}</Text>
                        <Text style={styles.timelineEventText}>{event.notes || event.description || event.location_name || event.title || 'Timeline update recorded.'}</Text>
                        <Text style={styles.timelineEventDate}>{formatDateTime(event.created_at)}</Text>
                      </View>
                    </View>
                  ))
                )}

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      if (selectedBooking) {
                        handleTrack(selectedBooking);
                      }
                      setSelectedBooking(null);
                    }}
                  >
                    <Navigation2 color="#002B22" size={14} />
                    <Text style={styles.actionBtnText}>Track Shipment</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111', marginBottom: 4 },
  cardSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#777' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f2f7f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  refreshBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  filtersRow: { flexDirection: 'row', gap: 14, marginBottom: 24, flexWrap: 'wrap' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    minWidth: 220,
  },
  filterLabel: { fontFamily: 'Outfit_6', fontSize: 11, color: '#888', marginBottom: 2, textTransform: 'uppercase' },
  filterBtnText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#333' },
  tableHeader: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: '#f0f0f0', marginBottom: 4 },
  thCell: { flex: 1, fontFamily: 'Outfit_7', fontSize: 13, color: '#555', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f8f8f8' },
  tableRowAlt: { backgroundColor: '#fafcfb' },
  tdCell: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333' },
  orderId: { color: '#004d3d', fontFamily: 'Outfit_6' },
  amountCell: { fontFamily: 'Outfit_6' },
  statusBadge: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  statusBadgeText: { fontFamily: 'Outfit_7', fontSize: 12, textAlign: 'center' },
  actionsCell: { flex: 1, flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ccfd3a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnText: { fontFamily: 'Outfit_7', fontSize: 12, color: '#002B22' },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#004d3d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnOutlineText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
  footNote: { fontFamily: 'Outfit_4', fontSize: 13, color: '#888', marginTop: 20 },
  centerState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerStateText: { color: '#888', fontFamily: 'Outfit_4', textAlign: 'center' },
  errorText: { color: '#B91C1C', fontFamily: 'Outfit_6', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  selectModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  selectTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 17, color: '#111' },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  selectOption: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  selectOptionActive: { borderColor: '#004d3d', backgroundColor: '#f3fbf8' },
  selectOptionText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#333' },
  selectOptionTextActive: { color: '#004d3d' },
  detailsModal: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  detailsTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#111' },
  detailsSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#777', marginTop: 4 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 28 },
  detailsItem: {
    width: '48%',
    backgroundColor: '#f8faf9',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef1ef',
  },
  detailsLabel: { fontFamily: 'Outfit_6', fontSize: 12, color: '#777', marginBottom: 6, textTransform: 'uppercase' },
  detailsValue: { fontFamily: 'Outfit_6', fontSize: 14, color: '#111' },
  timelineTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 12 },
  timelineEmpty: { fontFamily: 'Outfit_4', fontSize: 13, color: '#888', marginBottom: 18 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingBottom: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ccfd3a', marginTop: 5 },
  timelineContent: { flex: 1, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  timelineEventTitle: { fontFamily: 'Outfit_6', fontSize: 14, color: '#111', marginBottom: 4 },
  timelineEventText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#555', marginBottom: 6 },
  timelineEventDate: { fontFamily: 'Outfit_4', fontSize: 12, color: '#888' },
  modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end' },
});
