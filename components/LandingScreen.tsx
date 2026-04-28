import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Platform, ScrollView, useWindowDimensions, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useFonts, PlusJakartaSans_800ExtraBold, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { PlayfairDisplay_700Bold, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, ChevronDown, ChevronUp, Package, Truck, Headphones, User, MapPin, Clock, Shield, BarChart3, Star, ArrowRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue, withSpring, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';

// === REUSABLE HOVERABLE WRAPPER ===
const HoverBtn = ({ children, style, onPress, ...props }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onHoverIn={() => { if (Platform.OS === 'web') scale.value = withSpring(1.06, { damping: 12 }); }}
      onHoverOut={() => { if (Platform.OS === 'web') scale.value = withSpring(1, { damping: 12 }); }}
      onPress={onPress}
      {...props}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
};

// === SERVICE CARD ===
const ServiceCard = ({ source }) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value,
    shadowColor: '#ccfd3a',
    shadowRadius: 20,
  }));
  return (
    <Pressable
      onHoverIn={() => { if (Platform.OS === 'web') { scale.value = withSpring(1.04, { damping: 14 }); glow.value = withSpring(0.6); } }}
      onHoverOut={() => { if (Platform.OS === 'web') { scale.value = withSpring(1); glow.value = withSpring(0); } }}
    >
      <Animated.View style={[styles.cardWrapper, anim]}>
        <Image source={source} style={styles.cardImg} />
        {/* Targeted patch to cover watermark only */}
        <View style={styles.wmPatch} />
      </Animated.View>
    </Pressable>
  );
};

// === DROPDOWN MENU ITEM ===
const DropItem = ({ icon: Icon, label, desc }) => {
  const bg = useSharedValue('transparent');
  const anim = useAnimatedStyle(() => ({})); // color anim handled by state
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.dropItem, hovered && styles.dropItemHover]}
    >
      <View style={styles.dropIconWrap}>
        <Icon color="#ccfd3a" size={18} />
      </View>
      <View>
        <Text style={styles.dropLabel}>{label}</Text>
        <Text style={styles.dropDesc}>{desc}</Text>
      </View>
      <ArrowRight color="#ccfd3a" size={14} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
};

// == BOUNCING CHEVRON ==
const BouncingScroll = () => {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withRepeat(withTiming(12, { duration: 900 }), -1, true); }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.scrollHint, anim]}>
      <Text style={styles.scrollText}>Discover More</Text>
      <ChevronDown color="rgba(255,255,255,0.7)" size={28} />
    </Animated.View>
  );
};

// === NAV ITEMS CONFIG ===
const NAV = [
  {
    label: 'Shipping',
    icon: Package,
    items: [
      { icon: Package, label: 'Book a Shipment', desc: 'Send parcels anywhere in Nigeria' },
      { icon: Truck, label: 'Freight & Bulk Cargo', desc: 'Large-scale haulage & interstate' },
      { icon: Star, label: 'Premium Express', desc: 'Same-day priority delivery' },
    ]
  },
  {
    label: 'Tracking',
    icon: MapPin,
    items: [
      { icon: MapPin, label: 'Live Tracking', desc: 'Real-time GPS updates' },
      { icon: Clock, label: 'Delivery History', desc: 'All your past orders' },
      { icon: BarChart3, label: 'Analytics', desc: 'Your logistics data dashboard' },
    ]
  },
  {
    label: 'Support',
    icon: Headphones,
    items: [
      { icon: Headphones, label: 'Live Chat', desc: '24/7 customer support' },
      { icon: Shield, label: 'Insurance Claims', desc: 'File and track claims' },
      { icon: Star, label: 'FAQs', desc: 'Common questions answered' },
    ]
  },
  {
    label: 'Account',
    icon: User,
    items: [
      { icon: User, label: 'My Profile', desc: 'Manage account settings' },
      { icon: BarChart3, label: 'Billing', desc: 'Invoices & payment methods' },
      { icon: Shield, label: 'Security', desc: 'Privacy & access control' },
    ]
  },
];

// === MAIN COMPONENT ===
export default function LandingScreen({ onEnterApp }) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 900;
  const [openMenu, setOpenMenu] = useState(null);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_8: PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_7: PlusJakartaSans_700Bold,
    PlusJakartaSans_6: PlusJakartaSans_600SemiBold,
    Outfit_4: Outfit_400Regular,
    Outfit_6: Outfit_600SemiBold,
    Outfit_7: Outfit_700Bold,
    Playfair_7: PlayfairDisplay_700Bold,
    Playfair_6: PlayfairDisplay_600SemiBold,
  });

  if (!fontsLoaded) return null;

  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};
  const glassLight = Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {};

  const toggleMenu = (label) => setOpenMenu(prev => prev === label ? null : label);

  const renderDropdown = (nav) => {
    if (openMenu !== nav.label) return null;
    return (
      <Animated.View entering={FadeInDown.duration(200)} style={[styles.dropdown, glass]}>
        <View style={styles.dropArrow} />
        {nav.items.map(item => (
          <DropItem key={item.label} icon={item.icon} label={item.label} desc={item.desc} />
        ))}
      </Animated.View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={() => setOpenMenu(null)}>
      <ScrollView style={{ flex: 1, backgroundColor: '#020f09' }} showsVerticalScrollIndicator={false}>

        {/* ─── HERO SECTION ─── */}
        <View style={{ height, width, position: 'relative', overflow: 'hidden' }}>
          {/* Background */}
          <Image source={require('../assets/images/bg.png')} style={styles.heroBg} />
          {/* Lighter overlay - bring back the colors */}
          <LinearGradient
            colors={['rgba(0,20,13,0.35)', 'rgba(0,10,6,0.50)', 'rgba(2,15,9,0.85)', '#020f09']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* NAVBAR */}
          <View style={[styles.navbar, glass]}>
            {/* Logo — transparent, no white box */}
            <Image
              source={require('../assets/images/logo.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />

            {!isMobile && (
              <View style={styles.navLinks}>
                {NAV.map((nav) => (
                  <View key={nav.label} style={{ position: 'relative' }}>
                    <Pressable
                      style={({ hovered }) => [styles.navBtn, hovered && styles.navBtnHover]}
                      onPress={() => toggleMenu(nav.label)}
                    >
                      <Text style={[styles.navBtnText, openMenu === nav.label && { color: '#ccfd3a' }]}>
                        {nav.label}
                      </Text>
                      {openMenu === nav.label
                        ? <ChevronUp color={openMenu === nav.label ? '#ccfd3a' : '#fff'} size={15} />
                        : <ChevronDown color="#bbb" size={15} />}
                    </Pressable>
                    {renderDropdown(nav)}
                  </View>
                ))}
              </View>
            )}

            <HoverBtn style={styles.ctaNavBtn} onPress={onEnterApp}>
              <Text style={styles.ctaNavBtnText}>Get Started</Text>
            </HoverBtn>
          </View>

          {/* HERO COPY */}
          <Animated.View entering={FadeIn.duration(1000)} style={styles.heroBody}>
            <View style={[styles.heroPill, glassLight]}>
              <View style={styles.heroPillDot} />
              <Text style={styles.heroPillText}>Nigeria's #1 Logistics Platform</Text>
            </View>

            <Text style={styles.heroH1}>
              DELIVERING{'\n'}<Text style={styles.heroAccent}>EXCELLENCE</Text>{'\n'}ACROSS NIGERIA & BEYOND
            </Text>
            <Text style={styles.heroSub}>
              Fast • Secure • Reliable from Last-Mile to Heavy Haul
            </Text>

            <View style={styles.heroCtas}>
              <HoverBtn style={styles.btnPrimary} onPress={onEnterApp}>
                <Package color="#002B22" size={20} />
                <Text style={styles.btnPrimaryText}>TRACK YOUR SHIPMENT</Text>
              </HoverBtn>
              <HoverBtn style={[styles.btnSecondary, glassLight]} onPress={() => {}}>
                <Text style={styles.btnSecondaryText}>GET INSTANT QUOTE</Text>
                <Text style={{ fontSize: 18 }}> 📍</Text>
              </HoverBtn>
            </View>

            <View style={[styles.trustRow, glassLight]}>
              {['24/7 Support', 'Fully Insured', '99.9% On-Time'].map((t) => (
                <View key={t} style={styles.trustItem}>
                  <CheckCircle2 color="#ccfd3a" size={20} />
                  <Text style={styles.trustText}>{t}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Bouncing Scroll Cue */}
          <View style={{ alignItems: 'center', paddingBottom: 28 }}>
            <BouncingScroll />
          </View>
        </View>

        {/* ─── SERVICES SECTION ─── */}
        <View style={{ minHeight: height, width, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
          {/* Biker background - much less dark to preserve photo vibrancy */}
          <Image source={require('../assets/images/biker_bg.png')} style={styles.bikerBg} />
          {/* Subtle tinted overlay */}
          <LinearGradient
            colors={['#020f09', 'rgba(2,15,9,0.45)', 'rgba(0,20,13,0.55)', 'rgba(2,15,9,0.75)']}
            style={StyleSheet.absoluteFillObject}
          />

          <Animated.View entering={FadeInDown.duration(700)} style={styles.servicesWrap}>
            {/* Heading */}
            <Text style={styles.servicesEyebrow}>WHAT WE DO</Text>
            <Text style={styles.servicesTitle}>Services</Text>

            {/* Cards Row */}
            <View style={[styles.cardsRow, isMobile && { flexDirection: 'column' }]}>
              <ServiceCard source={require('../assets/images/card 1.jpg')} />
              <ServiceCard source={require('../assets/images/card2.jpg')} />
              <ServiceCard source={require('../assets/images/card 3.jpg')} />
              <ServiceCard source={require('../assets/images/card 4.jpg')} />
            </View>

            {/* Stats Bar */}
            <View style={[styles.statsBar, glass]}>
              {[
                { val: '10K+', lbl: 'Shipments Delivered' },
                { val: 'All 36', lbl: 'States Covered' },
                { val: '99.9%', lbl: 'On-Time Delivery' },
                { val: '24/7', lbl: 'Customer Support' },
              ].map((s) => (
                <View key={s.lbl} style={styles.statCol}>
                  <Text style={styles.statVal}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  // Hero bg
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bikerBg: {
    position: 'absolute',
    top: '-5%',
    left: '-2%',
    width: '104%',
    height: '111%',
    resizeMode: 'cover',
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,20,13,0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  // Logo — use mixBlendMode on web to remove white background visually
  logo: {
    height: 46,
    width: 160,
    ...(Platform.OS === 'web' ? { mixBlendMode: 'screen' } : {}),
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navBtnHover: {
    backgroundColor: 'rgba(204, 253, 58, 0.08)',
  },
  navBtnText: {
    fontFamily: 'Outfit_6',
    fontSize: 15,
    color: '#e8f5ee',
    letterSpacing: 0.3,
  },
  ctaNavBtn: {
    backgroundColor: '#ccfd3a',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
  },
  ctaNavBtnText: {
    fontFamily: 'Outfit_7',
    fontSize: 14,
    color: '#002B22',
    letterSpacing: 0.5,
  },

  // Dropdown — FULLY OPAQUE so menus are always readable
  dropdown: {
    position: 'absolute',
    top: 52,
    left: -10,
    width: 280,
    backgroundColor: '#041910', // Fully opaque — no transparency issues
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(204, 253, 58, 0.3)',
    paddingVertical: 10,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 60px rgba(0,0,0,0.85)' } : {}),
  },
  dropArrow: {
    position: 'absolute',
    top: -6,
    left: 28,
    width: 12,
    height: 12,
    backgroundColor: '#041910',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(204,253,58,0.3)',
    transform: [{ rotate: '45deg' }],
  },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  dropItemHover: {
    backgroundColor: 'rgba(204, 253, 58, 0.07)',
  },
  dropIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(204,253,58,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropLabel: {
    fontFamily: 'PlusJakartaSans_6',
    fontSize: 14,
    color: '#f0fff4',
    marginBottom: 2,
  },
  dropDesc: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },

  // Hero Body
  heroBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.25)',
    backgroundColor: 'rgba(204,253,58,0.06)',
    marginBottom: 32,
  },
  heroPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ccfd3a',
  },
  heroPillText: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: '#ccfd3a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroH1: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 62,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 72,
    marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 24,
  },
  heroAccent: {
    color: '#ccfd3a',
  },
  heroSub: {
    fontFamily: 'Outfit_4',
    fontSize: 20,
    color: 'rgba(230,255,240,0.8)',
    textAlign: 'center',
    marginBottom: 44,
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  heroCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    marginBottom: 44,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ccfd3a',
    paddingHorizontal: 30,
    paddingVertical: 17,
    borderRadius: 10,
  },
  btnPrimaryText: {
    fontFamily: 'Outfit_7',
    fontSize: 15,
    color: '#002B22',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 30,
    paddingVertical: 17,
    borderRadius: 10,
  },
  btnSecondaryText: {
    fontFamily: 'Outfit_6',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.8,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontFamily: 'PlusJakartaSans_6',
    fontSize: 15,
    color: '#e8f5ee',
  },

  // Scroll hint
  scrollHint: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  scrollText: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Services
  servicesWrap: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 2,
  },
  servicesEyebrow: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: '#ccfd3a',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  servicesTitle: {
    fontFamily: 'Playfair_7',
    fontSize: 80,
    color: '#f8fff2',
    marginBottom: 56,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardWrapper: {
    width: 260,
    aspectRatio: 940 / 835, // real image dimensions
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ccfd3a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 20,
    position: 'relative',
  },
  cardImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  wmPatch: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '28%',
    height: '10%',
    backgroundColor: '#17251f',
    borderTopLeftRadius: 8,
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 50,
    paddingVertical: 28,
    paddingHorizontal: 60,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.15)',
    marginTop: 60,
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 38,
    color: '#ccfd3a',
    marginBottom: 4,
  },
  statLbl: {
    fontFamily: 'Outfit_4',
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
});
