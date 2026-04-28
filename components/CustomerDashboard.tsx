import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFonts, PlusJakartaSans_800ExtraBold, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Headphones,
  LayoutDashboard,
  Leaf,
  Navigation,
  Package,
  PlusCircle,
  Settings,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import LanguageFloater from './LanguageFloater';
import TrackShipmentTab from './tabs/TrackShipmentTab';
import CreateShipmentTab from './tabs/CreateShipmentTab';
import CreateAgroShipmentTab from './tabs/CreateAgroShipmentTab';
import BookingHistoryTab from './tabs/BookingHistoryTab';
import PaymentMethodsTab from './tabs/PaymentMethodsTab';
import SettingsTab from './tabs/SettingsTab';
import SupportTab from './tabs/SupportTab';
import { DashboardMetrics, fetchDashboardMetrics, resolveCustomerId } from '../utils/customerData';

const NAV_ITEMS = [
  { key: 'dashboard', icon: LayoutDashboard, labelKey: 'dash.dashboard' },
  { key: 'track', icon: Navigation, labelKey: 'dash.track' },
  { key: 'create', icon: PlusCircle, labelKey: 'dash.create' },
  { key: 'agro', icon: Leaf, labelKey: 'dash.agro' },
  { key: 'history', icon: Clock, labelKey: 'dash.history' },
  { key: 'payment', icon: CreditCard, labelKey: 'dash.payment2' },
  { key: 'support', icon: Headphones, labelKey: 'nav.support' },
  { key: 'settings', icon: Settings, labelKey: 'dash.settings' },
] as const;

type CustomerDashboardProps = {
  userState?: string;
  userName?: string;
};

const formatAmount = (amount: number | null | undefined) =>
  `₦${Number(amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function CustomerDashboard({ userState = 'Lagos', userName = 'Adewale' }: CustomerDashboardProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const [activeNav, setActiveNav] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [trackPrefillId, setTrackPrefillId] = useState('');
  const [trackSignal, setTrackSignal] = useState(0);

  useEffect(() => {
    resolveCustomerId()
      .then(setCustomerId)
      .catch((error) => {
        console.error('Failed to resolve customer id', error);
        setDashboardError('Customer dashboard could not resolve the current account.');
      });
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!customerId) return;
    setDashboardLoading(true);

    try {
      const metrics = await fetchDashboardMetrics(customerId);
      setDashboardMetrics(metrics);
      setDashboardError('');
    } catch (error) {
      console.error('Failed to fetch dashboard metrics', error);
      setDashboardError('Dashboard data is unavailable until the customer migration is applied.');
    } finally {
      setDashboardLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId && activeNav === 'dashboard') {
      refreshDashboard();
    }
  }, [activeNav, customerId, refreshDashboard]);

  const handleTrackShipment = (trackingId: string) => {
    setTrackPrefillId(trackingId);
    setTrackSignal((current) => current + 1);
    setActiveNav('track');
  };

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_8: PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_7: PlusJakartaSans_700Bold,
    PlusJakartaSans_6: PlusJakartaSans_600SemiBold,
    Outfit_4: Outfit_400Regular,
    Outfit_6: Outfit_600SemiBold,
    Outfit_7: Outfit_700Bold,
  });

  if (!fontsLoaded) return null;

  const sidebarWidth = collapsed ? 76 : 240;
  const sidebarWebStyle = Platform.OS === 'web'
    ? {
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        flexShrink: 0,
      }
    : {};

  const renderSidebar = () => (
    <View style={[styles.sidebar, { width: sidebarWidth }, sidebarWebStyle as any]}>
      <View style={[styles.sidebarLogo, collapsed && { padding: 12 }]}>
        {collapsed ? (
          <Image
            source={require('../assets/images/logo.jpg')}
            style={{ width: 44, height: 44, borderRadius: 8 }}
            resizeMode="cover"
          />
        ) : (
          <Image
            source={require('../assets/images/logo.jpg')}
            style={styles.sidebarLogoImg}
            resizeMode="cover"
          />
        )}
      </View>

      <View style={styles.sidebarNav}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.key;
          return (
            <Pressable
              key={item.key}
              style={[
                styles.navItem,
                isActive && styles.navItemActive,
                collapsed && { justifyContent: 'center', paddingHorizontal: 0 },
              ]}
              onPress={() => setActiveNav(item.key)}
            >
              {isActive && <View style={styles.navActiveBar} />}
              <Icon color={isActive ? '#ccfd3a' : 'rgba(255,255,255,0.5)'} size={20} />
              {!collapsed ? (
                <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                  {t(item.labelKey)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {!collapsed ? (
        <View style={styles.sidebarFooter}>
          <Text style={styles.sidebarFooterText}>RENAX Logistics | v1.1.0</Text>
        </View>
      ) : null}
    </View>
  );

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={() => setCollapsed((prev) => !prev)} style={styles.menuToggle}>
          {collapsed ? <ChevronRight color="#004d3d" size={24} /> : <ChevronLeft color="#004d3d" size={24} />}
        </Pressable>
        <View>
          <Text style={styles.welcomeText}>{t('dash.welcome')}, {userName}</Text>
          <Text style={styles.welcomeSub}>{t('dash.subtitle')} {userState ? `Serving ${userState}.` : ''}</Text>
        </View>
      </View>
      <View style={styles.topBarRight}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_7', fontSize: 16 }}>{userName.charAt(0)}</Text>
          </View>
          <ChevronDown color="#666" size={16} />
        </View>
        <View style={styles.bellWrap}>
          <Bell color="#444" size={22} />
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>
              {dashboardMetrics?.pendingCount ? Math.min(dashboardMetrics.pendingCount, 9) : 0}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderDashboard = () => {
    const metrics = dashboardMetrics;
    const stats = [
      { label: 'In Transit', value: String(metrics?.inTransitCount ?? 0), icon: Truck, accent: false },
      { label: 'Pending', value: String(metrics?.pendingCount ?? 0), icon: Calendar, accent: false },
      { label: 'Total Shipments', value: String(metrics?.totalBookings ?? 0), icon: Package, accent: false },
      { label: 'Outstanding Payments', value: formatAmount(metrics?.outstandingPayments), icon: TrendingUp, accent: true },
    ];

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 36, paddingBottom: 80 }}>
        {renderTopBar()}

        {dashboardError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{dashboardError}</Text>
          </View>
        ) : null}

        <View style={[styles.statsRow, isMobile && { flexDirection: 'column' }]}>
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Animated.View key={stat.label} entering={FadeInDown.delay(index * 80).duration(400)} style={styles.statCard}>
                <View style={styles.statCardLeft}>
                  <Text style={styles.statCardLabel}>{stat.label}</Text>
                  <Text style={[styles.statCardValue, stat.accent && { color: '#ccfd3a', fontSize: 24 }]}>{stat.value}</Text>
                </View>
                <View style={styles.statCardIcon}>
                  <Icon color="#ccfd3a" size={26} />
                </View>
              </Animated.View>
            );
          })}
        </View>

        {dashboardLoading ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading live dashboard data...</Text>
          </View>
        ) : (
          <View style={[styles.heroGrid, isMobile && { flexDirection: 'column' }]}>
            <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.heroPanel}>
              <Text style={styles.panelEyebrow}>Active Shipment</Text>
              {metrics?.activeShipment ? (
                <>
                  <Text style={styles.panelTitle}>{metrics.activeShipment.tracking_id || metrics.activeShipment.id}</Text>
                  <Text style={styles.panelText}>
                    {metrics.activeShipment.pickup_address || 'Pickup'} to {metrics.activeShipment.delivery_address || 'Destination'}
                  </Text>
                  <View style={styles.panelMetaRow}>
                    <Text style={styles.panelMeta}>Status: {metrics.activeShipment.status || 'Pending'}</Text>
                    <Text style={styles.panelMeta}>{formatAmount(metrics.activeShipment.estimated_price)}</Text>
                  </View>
                  <Pressable style={styles.panelButton} onPress={() => handleTrackShipment(metrics.activeShipment?.tracking_id || metrics.activeShipment?.id || '')}>
                    <Navigation color="#002B22" size={16} />
                    <Text style={styles.panelButtonText}>Track Shipment</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.panelTitle}>No Active Shipment</Text>
                  <Text style={styles.panelText}>Create a new booking to see live shipment status here instead of a rider-style map.</Text>
                  <Pressable style={styles.panelButton} onPress={() => setActiveNav('create')}>
                    <PlusCircle color="#002B22" size={16} />
                    <Text style={styles.panelButtonText}>Create Shipment</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(180).duration(400)} style={[styles.heroPanel, styles.walletPanel]}>
              <Text style={styles.panelEyebrow}>RENAX Wallet</Text>
              <Text style={styles.walletPanelBalance}>{formatAmount(metrics?.wallet?.balance)}</Text>
              <Text style={styles.panelText}>Wallet funding, withdrawal requests, and shipment payments now live in the payment methods tab.</Text>
              <View style={styles.panelMetaRow}>
                <Text style={styles.panelMeta}>Pending: {formatAmount(metrics?.wallet?.pending_balance)}</Text>
                <Text style={styles.panelMeta}>Spent: {formatAmount(metrics?.wallet?.total_spent)}</Text>
              </View>
              <Pressable style={styles.panelButtonAlt} onPress={() => setActiveNav('payment')}>
                <Wallet color="#004d3d" size={16} />
                <Text style={styles.panelButtonAltText}>Open Wallet</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}

        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.bookingsCard}>
          <View style={styles.bookingsHeaderTop}>
            <View>
              <Text style={styles.bookingsTitle}>Recent Bookings</Text>
              <Text style={styles.bookingsSub}>This list is pulled from live shipment records for the current customer.</Text>
            </View>
            <Pressable style={styles.smallBtn} onPress={refreshDashboard}>
              <Text style={styles.smallBtnText}>Refresh</Text>
            </Pressable>
          </View>

          <View style={styles.bookingsHeader}>
            {['Date', 'Order ID', 'Destination', 'Status', 'Actions'].map((header) => (
              <Text key={header} style={styles.bookingsHeaderCell}>{header}</Text>
            ))}
          </View>

          {(metrics?.recentBookings ?? []).length === 0 ? (
            <Text style={styles.emptyBookings}>No recent bookings yet.</Text>
          ) : (
            (metrics?.recentBookings ?? []).map((booking, index) => (
              <Animated.View key={booking.id} entering={FadeInDown.delay(index * 60).duration(300)} style={[styles.bookingRow, index % 2 === 0 && styles.bookingRowAlt]}>
                <Text style={styles.bookingCell}>{booking.created_at ? new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</Text>
                <Text style={[styles.bookingCell, styles.bookingLink]}>{booking.tracking_id || booking.id}</Text>
                <Text style={styles.bookingCell}>{booking.delivery_address || 'N/A'}</Text>
                <Text style={styles.bookingCell}>{booking.status || 'Pending'}</Text>
                <Pressable onPress={() => handleTrackShipment(booking.tracking_id || booking.id)}><Text style={styles.viewDetails}>Track</Text></Pressable>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (activeNav === 'dashboard') {
      return renderDashboard();
    }

    let tabContent: React.ReactNode;
    switch (activeNav) {
      case 'track':
        tabContent = <TrackShipmentTab initialTrackingId={trackPrefillId} autoTrackSignal={trackSignal} />;
        break;
      case 'create':
        tabContent = <CreateShipmentTab customerId={customerId} />;
        break;
      case 'agro':
        tabContent = <CreateAgroShipmentTab customerId={customerId} />;
        break;
      case 'history':
        tabContent = <BookingHistoryTab customerId={customerId} onTrackShipment={handleTrackShipment} />;
        break;
      case 'payment':
        tabContent = <PaymentMethodsTab customerId={customerId} />;
        break;
      case 'support':
        tabContent = <SupportTab />;
        break;
      default:
        tabContent = <SettingsTab customerId={customerId} />;
        break;
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 36, paddingTop: 28 }}>
          {renderTopBar()}
        </View>
        <View style={{ flex: 1 }}>
          {tabContent}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInLeft.duration(500)} style={{ zIndex: 10 }}>
        {renderSidebar()}
      </Animated.View>

      <ImageBackground
        source={require('../assets/images/Tabs Background.png')}
        style={{ flex: 1 }}
        imageStyle={{
          resizeMode: 'cover',
          opacity: 0.35,
          position: 'absolute',
          left: '20%',
          width: '60%',
        }}
      >
        {renderContent()}
      </ImageBackground>

      <LanguageFloater />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f4f6f8' },
  sidebar: { backgroundColor: '#004d3d', minHeight: '100%' },
  sidebarLogo: {
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  sidebarLogoImg: {
    width: '100%',
    height: 110,
    ...(Platform.OS === 'web' ? { mixBlendMode: 'screen' } : {}),
  },
  sidebarNav: { paddingTop: 12, flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    position: 'relative',
  },
  navItemActive: { backgroundColor: 'rgba(204,253,58,0.08)' },
  navActiveBar: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 4,
    backgroundColor: '#ccfd3a',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  navItemText: { fontFamily: 'Outfit_4', fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  navItemTextActive: { color: '#ccfd3a', fontFamily: 'Outfit_6' },
  sidebarFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sidebarFooterText: { fontFamily: 'Outfit_4', fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  menuToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  welcomeText: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#121212' },
  welcomeSub: { fontFamily: 'Outfit_4', fontSize: 15, color: '#666', marginTop: 4, maxWidth: 560 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#004d3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellWrap: { position: 'relative', width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Outfit_7' },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  errorBannerText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#B91C1C' },
  statsRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  statCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#004d3d',
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statCardLeft: { gap: 6, flexShrink: 1, paddingRight: 8 },
  statCardLabel: { fontFamily: 'Outfit_4', fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  statCardValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 28, color: '#fff' },
  statCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(204,253,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  loadingText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#666' },
  heroGrid: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  heroPanel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  walletPanel: { backgroundColor: '#f8fff1' },
  panelEyebrow: {
    fontFamily: 'Outfit_6',
    fontSize: 11,
    color: '#004d3d',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  panelTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#111', marginBottom: 10 },
  panelText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 },
  panelMetaRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
  panelMeta: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  panelButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ccfd3a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  panelButtonText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#002B22' },
  panelButtonAlt: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#004d3d',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  panelButtonAltText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#004d3d' },
  walletPanelBalance: { fontFamily: 'PlusJakartaSans_7', fontSize: 30, color: '#004d3d', marginBottom: 12 },
  bookingsCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  bookingsHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  bookingsTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#121212', marginBottom: 4 },
  bookingsSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#777' },
  smallBtn: {
    backgroundColor: '#f2f7f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  bookingsHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 4,
  },
  bookingsHeaderCell: { flex: 1, fontFamily: 'Outfit_6', fontSize: 13, color: '#888', letterSpacing: 0.5 },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  bookingRowAlt: { backgroundColor: 'rgba(0,0,0,0.02)' },
  bookingCell: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333' },
  bookingLink: { color: '#004d3d', fontFamily: 'Outfit_6' },
  viewDetails: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: '#004d3d',
    textAlign: 'right',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  emptyBookings: { fontFamily: 'Outfit_4', fontSize: 14, color: '#777', paddingVertical: 20 },
});
