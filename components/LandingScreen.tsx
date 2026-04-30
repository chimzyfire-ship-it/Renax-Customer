import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Headphones,
  MapPin,
  Package,
  Shield,
  Star,
  Truck,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const NAV_ROUTE_MAP: Record<string, string> = {
  'Book a Shipment': 'book',
  'Freight & Bulk Cargo': 'book',
  'Premium Express': 'book',
  'Agro Transport': 'agro',
  'Live Tracking': 'track',
  'Delivery History': 'history',
  'Analytics': 'dashboard',
  'Custom Deliveries': 'book',
  'Pickup Truck Freight': 'book',
  'Cargo Tricycle Haulage': 'book',
  'Express Bike Delivery': 'book',
  'Live Chat': 'support',
  'Insurance Claims': 'support',
  FAQs: 'support',
};

const NAV = [
  {
    label: 'Shipping',
    items: [
      { icon: Package, label: 'Book a Shipment', desc: 'Send parcels across Nigeria with ease.' },
      { icon: Truck, label: 'Freight & Bulk Cargo', desc: 'Move heavier loads with dependable line-haul support.' },
      { icon: Truck, label: 'Agro Transport', desc: 'Get farm produce to market fresh and on time.' },
    ],
  },
  {
    label: 'Tracking',
    items: [
      { icon: MapPin, label: 'Live Tracking', desc: 'See every shipment update in real time.' },
      { icon: Clock, label: 'Delivery History', desc: 'Review completed jobs and delivery milestones.' },
      { icon: BarChart3, label: 'Analytics', desc: 'Monitor your logistics activity and performance.' },
    ],
  },
  {
    label: 'Services',
    items: [
      { icon: Package, label: 'Custom Deliveries', desc: 'Flexible shipping for personal and business needs.' },
      { icon: Truck, label: 'Pickup Truck Freight', desc: 'Fast freight handling for medium-sized cargo.' },
      { icon: Truck, label: 'Cargo Tricycle Haulage', desc: 'Navigate dense city routes efficiently and affordably.' },
      { icon: Truck, label: 'Express Bike Delivery', desc: 'Handle urgent deliveries with speed and precision.' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: Headphones, label: 'Live Chat', desc: 'Reach our support team whenever you need help.' },
      { icon: Shield, label: 'Insurance Claims', desc: 'File and track shipment protection requests.' },
      { icon: Star, label: 'FAQs', desc: 'Browse quick answers to common questions.' },
    ],
  },
  {
    label: 'About Us',
    items: [],
  },
];

const HERO_STATS = [
  { icon: Shield, value: '99.9%', label: 'On-Time Delivery' },
  { icon: Headphones, value: '24/7', label: 'Customer Support' },
  { icon: MapPin, value: '36', label: 'States Covered' },
  { icon: CheckCircle2, value: 'Fully', label: 'Insured' },
];

const TRUSTED_BRANDS = ['DANGOTE', 'Olam', 'BUA GROUP', 'GTCO', 'JMG', 'Presco', 'and more...'];

const SERVICE_CARDS = [
  {
    img: require('../assets/images/Card1.png'),
    title: 'Custom Deliveries',
    nav: 'book',
  },
  {
    img: require('../assets/images/Card3.png'),
    title: 'Pickup Truck Freight',
    nav: 'book',
  },
  {
    img: require('../assets/images/Card2.png'),
    title: 'Cargo Tricycle Haulage',
    nav: 'book',
  },
  {
    img: require('../assets/images/card 4.png'),
    title: 'Express Bike Delivery',
    nav: 'book',
  },
];

const SERVICE_BENEFITS = [
  {
    icon: Shield,
    title: 'Secure & Insured',
    desc: 'Every delivery is backed by careful handling and dependable protection.',
  },
  {
    icon: MapPin,
    title: 'Nationwide Coverage',
    desc: 'We operate across all 36 states and the FCT with reliable reach.',
  },
  {
    icon: Clock,
    title: 'On-Time Performance',
    desc: 'Speed, visibility, and punctuality stay built into every route.',
  },
  {
    icon: Headphones,
    title: 'Always Available',
    desc: 'Our support team stays ready to help around the clock.',
  },
];

const AGRO_FEATURES = [
  { icon: Shield, label: 'Safe & Hygienic\nTransport' },
  { icon: Truck, label: 'Temperature\nControlled' },
  { icon: CheckCircle2, label: 'Farm Fresh\nGuaranteed' },
];

const AGRO_STEPS = [
  { step: '1. Schedule Pickup', desc: 'Book online or via our app in minutes' },
  { step: '2. Secure Transport', desc: 'Your produce is carefully picked up and packed' },
  { step: '3. In-Transit Tracking', desc: 'Track your shipment in real-time' },
  { step: '4. Delivered Fresh', desc: 'We deliver on time, every time' },
  { step: '5. Market Ready', desc: 'Your produce arrives fresh and ready to sell' },
];

const HoverBtn = ({ children, style, onPress, ...props }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onHoverIn={() => {
        if (Platform.OS === 'web') scale.value = withSpring(1.04, { damping: 14 });
      }}
      onHoverOut={() => {
        if (Platform.OS === 'web') scale.value = withSpring(1, { damping: 14 });
      }}
      onPress={onPress}
      {...props}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
};

const DropItem = ({ icon: Icon, label, desc, onPress }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={[styles.dropItem, hovered && styles.dropItemHover]}
    >
      <View style={styles.dropIconWrap}>
        <Icon color="#ccfd3a" size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.dropLabel}>{label}</Text>
        <Text style={styles.dropDesc}>{desc}</Text>
      </View>
      <ArrowRight color="#ccfd3a" size={14} />
    </Pressable>
  );
};

const BouncingScroll = () => {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(withTiming(12, { duration: 900 }), -1, true);
  }, [y]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.scrollHint, anim]}>
      <Text style={styles.scrollText}>Discover More</Text>
      <ChevronDown color="rgba(255,255,255,0.72)" size={28} />
    </Animated.View>
  );
};

export default function LandingScreen({ onEnterApp, isLoggedIn = false }) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 900;
  const isCompact = width < 640;
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const heroHeight = isCompact ? Math.max(height, 1080) : isMobile ? Math.max(height, 1220) : Math.max(height, 980);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_8: PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_7: PlusJakartaSans_700Bold,
    PlusJakartaSans_6: PlusJakartaSans_600SemiBold,
    Outfit_4: Outfit_400Regular,
    Outfit_6: Outfit_600SemiBold,
    Outfit_7: Outfit_700Bold,
  });

  if (!fontsLoaded) return null;

  const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(22px)' } as any) : {};
  const glassLight = Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as any) : {};

  const toggleMenu = (label: string) => setOpenMenu((prev) => (prev === label ? null : label));

  const handleNavItem = (itemLabel: string) => {
    setOpenMenu(null);
    const targetNav = NAV_ROUTE_MAP[itemLabel] || 'dashboard';
    onEnterApp(targetNav);
  };

  const renderDropdown = (nav) => {
    if (openMenu !== nav.label || !nav.items.length) return null;

    return (
      <Animated.View entering={FadeInDown.duration(220)} style={styles.dropdown}>
        <View style={styles.dropArrow} />
        {nav.items.map((item) => (
          <DropItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
            onPress={() => handleNavItem(item.label)}
          />
        ))}
      </Animated.View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={() => setOpenMenu(null)}>
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroSection, { minHeight: heroHeight }]}>
          <Image source={require('../assets/images/Super landing page .png')} style={styles.heroBg} />
          <LinearGradient
            colors={['rgba(1,12,8,0.92)', 'rgba(1,12,8,0.68)', 'rgba(1,12,8,0.24)', 'rgba(1,12,8,0.72)']}
            locations={[0, 0.32, 0.64, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(1,12,8,0.84)', 'rgba(1,12,8,0.32)', 'rgba(1,12,8,0.12)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View
            style={[
              styles.navbar,
              glass,
              isCompact && { paddingHorizontal: 16, paddingVertical: 12 },
              isMobile && !isCompact && { paddingHorizontal: 24 },
            ]}
          >
            <Image
              source={require('../assets/images/logo.jpg')}
              style={[
                styles.logo,
                isCompact && { width: 160, height: 44 },
                isMobile && !isCompact && { width: 190, height: 54 },
              ]}
              resizeMode="contain"
            />

            {!isMobile && (
              <View style={styles.navLinks}>
                {NAV.map((nav) => (
                  <View key={nav.label} style={{ position: 'relative' }}>
                    <Pressable
                      style={({ hovered }) => [styles.navBtn, hovered && styles.navBtnHover]}
                      onPress={() => (nav.items.length ? toggleMenu(nav.label) : setOpenMenu(null))}
                    >
                      <Text style={[styles.navBtnText, openMenu === nav.label && styles.navBtnTextActive]}>
                        {nav.label}
                      </Text>
                      {nav.items.length ? (
                        openMenu === nav.label ? (
                          <ChevronUp color="#ccfd3a" size={15} />
                        ) : (
                          <ChevronDown color="rgba(255,255,255,0.72)" size={15} />
                        )
                      ) : null}
                    </Pressable>
                    {renderDropdown(nav)}
                  </View>
                ))}
              </View>
            )}

            <HoverBtn
              style={[
                styles.ctaNavBtn,
                isCompact && { paddingHorizontal: 16, paddingVertical: 11 },
                isLoggedIn && styles.ctaNavBtnLoggedIn,
              ]}
              onPress={() => onEnterApp('dashboard')}
            >
              <Text style={[styles.ctaNavBtnText, isLoggedIn && styles.ctaNavBtnTextLoggedIn]}>
                {isLoggedIn ? 'Dashboard' : 'Get Started'}
              </Text>
            </HoverBtn>
          </View>

          {isMobile && (
            <View style={styles.mobileNavWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNavScroll}>
                {NAV.map((nav) => (
                  <Pressable
                    key={nav.label}
                    onPress={() => (nav.items.length ? toggleMenu(nav.label) : setOpenMenu(null))}
                    style={[styles.mobileNavChip, openMenu === nav.label && styles.mobileNavChipActive]}
                  >
                    <Text style={[styles.mobileNavChipText, openMenu === nav.label && styles.mobileNavChipTextActive]}>
                      {nav.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {NAV.map((nav) =>
                openMenu === nav.label && nav.items.length ? (
                  <Animated.View key={nav.label} entering={FadeInDown.duration(220)} style={[styles.mobileDropdown, glass]}>
                    {nav.items.map((item) => (
                      <DropItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        desc={item.desc}
                        onPress={() => handleNavItem(item.label)}
                      />
                    ))}
                  </Animated.View>
                ) : null
              )}
            </View>
          )}

          <Animated.View
            entering={FadeIn.duration(900)}
            style={[
              styles.heroContentWrap,
              isCompact && { paddingHorizontal: 20, paddingTop: 44 },
              isMobile && !isCompact && { paddingHorizontal: 28, paddingTop: 46 },
            ]}
          >
            <View style={[styles.heroCopyColumn, isMobile && styles.heroCopyColumnMobile]}>
              <Text style={styles.heroEyebrow}>NIGERIA'S MOST RELIABLE LOGISTICS PARTNER</Text>
              <Text
                style={[
                  styles.heroH1,
                  isCompact && { fontSize: 48, lineHeight: 52, maxWidth: 320 },
                  isMobile && !isCompact && { fontSize: 68, lineHeight: 72, maxWidth: 680 },
                ]}
              >
                We Move More{'\n'}
                <Text style={styles.heroAccent}>So You Can Grow</Text>
              </Text>
              <Text
                style={[
                  styles.heroSub,
                  isCompact && { fontSize: 16, lineHeight: 25, maxWidth: 320 },
                  isMobile && !isCompact && { fontSize: 19, lineHeight: 30, maxWidth: 620 },
                ]}
              >
                Renax Logistics delivers across Nigeria and beyond.{'\n'}
                From parcels to pallets, farm produce to industrial equipment,{'\n'}
                we move what matters - safely, on time, every time.
              </Text>

              <View
                style={[
                  styles.heroCtas,
                  isMobile && { width: '100%', maxWidth: isCompact ? 320 : 520 },
                  isCompact && { flexDirection: 'column', gap: 12, marginBottom: 30 },
                ]}
              >
                <HoverBtn
                  style={[styles.btnPrimary, isMobile && { width: '100%', justifyContent: 'center' }]}
                  onPress={() => onEnterApp('track')}
                >
                  <Package color="#002B22" size={20} />
                  <Text style={styles.btnPrimaryText}>TRACK YOUR SHIPMENT</Text>
                </HoverBtn>

                <HoverBtn
                  style={[styles.btnSecondary, glassLight, isMobile && { width: '100%', justifyContent: 'center' }]}
                  onPress={() => onEnterApp('book')}
                >
                  <Text style={styles.btnSecondaryText}>GET INSTANT QUOTE</Text>
                  <ArrowRight color="#ccfd3a" size={18} />
                </HoverBtn>
              </View>

              <View style={[styles.heroStats, glassLight, isCompact && styles.heroStatsCompact]}>
                {HERO_STATS.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <View key={stat.label} style={[styles.heroStatItem, isCompact && styles.heroStatItemCompact]}>
                      <View style={styles.heroStatIconWrap}>
                        <Icon color="#ccfd3a" size={20} />
                      </View>
                      <View>
                        <Text style={styles.heroStatValue}>{stat.value}</Text>
                        <Text style={styles.heroStatLabel}>{stat.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          <View style={[styles.brandBar, glassLight, isCompact && styles.brandBarCompact, isMobile && !isCompact && styles.brandBarMobile]}>
            <View style={[styles.brandLead, !isCompact && styles.brandLeadDesktop]}>
              <Text style={styles.brandLeadText}>TRUSTED BY THOUSANDS OF BUSINESSES AND FARMERS</Text>
            </View>
            <View style={styles.brandLogoWrap}>
              {TRUSTED_BRANDS.map((brand) => (
                <Text key={brand} style={styles.brandLogoText}>
                  {brand}
                </Text>
              ))}
            </View>
          </View>

          {!isCompact ? (
            <View style={{ alignItems: 'center', paddingBottom: 22 }}>
              <BouncingScroll />
            </View>
          ) : null}
        </View>

        <View style={styles.servicesSection}>
          <Image source={require('../assets/images/biker_bg.png')} style={styles.bikerBg} />
          <LinearGradient
            colors={['#010d07', 'rgba(1,13,7,0.04)', '#010d07']}
            style={StyleSheet.absoluteFillObject}
          />

          <Animated.View entering={FadeInDown.duration(650)} style={styles.sectionShell}>
            <Text style={styles.sectionEyebrow}>OUR SERVICES</Text>
            <Text style={[styles.sectionTitle, isCompact && { fontSize: 38, lineHeight: 44 }, isMobile && !isCompact && { fontSize: 56, lineHeight: 62 }]}>
              More Than Logistics.{'\n'}
              <Text style={{ color: '#ccfd3a' }}>We Deliver Solutions.</Text>
            </Text>
            <Text style={[styles.sectionSub, isCompact && { maxWidth: 320, fontSize: 15 }, isMobile && !isCompact && { maxWidth: 720 }]}>
              From businesses to individuals, we provide fast, reliable, and tech-enabled delivery services tailored to your needs.
            </Text>

            <View style={[styles.servicesGrid, isCompact && styles.servicesGridCompact]}>
              {SERVICE_CARDS.map((card) => (
                <Pressable
                  key={card.title}
                  onPress={() => onEnterApp(card.nav)}
                  style={({ hovered }) => [
                    styles.serviceCardLink,
                    isCompact && styles.serviceCardLinkCompact,
                    isMobile && !isCompact && styles.serviceCardLinkTablet,
                    hovered && Platform.OS === 'web' ? styles.serviceCardLinkHover : null,
                  ]}
                >
                  <Image source={card.img} style={styles.serviceCardImage} resizeMode="contain" />
                </Pressable>
              ))}
            </View>

            <View style={[styles.benefitsRow, isCompact && styles.benefitsRowCompact]}>
              {SERVICE_BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <View key={benefit.title} style={[styles.benefitCard, isCompact && styles.benefitCardCompact, isMobile && !isCompact && styles.benefitCardTablet]}>
                    <View style={styles.benefitIconWrap}>
                      <Icon color="#ccfd3a" size={20} />
                    </View>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>

        <View style={[styles.agroSection, isCompact && { minHeight: 'auto' }]}>
          <Image
            source={require('../assets/images/3rd/3rd screen background image asset 1.png')}
            style={styles.agroBg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(1,10,5,0.92)', 'rgba(1,15,7,0.82)', 'rgba(0,30,15,0.55)', 'rgba(1,10,5,0.78)', 'rgba(1,10,5,0.97)']}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <View
            style={[
              styles.agroInner,
              isCompact && { paddingHorizontal: 20, paddingVertical: 60 },
              isMobile && !isCompact && { paddingHorizontal: 32, paddingVertical: 84 },
            ]}
          >
            <Animated.View entering={FadeInDown.duration(700)} style={[styles.agroCopy, isCompact && { maxWidth: '100%' }]}>
              <Text style={styles.sectionEyebrow}>AGROTRANSPORT</Text>
              <Text style={[styles.agroTitle, isCompact && { fontSize: 36, lineHeight: 44 }, isMobile && !isCompact && { fontSize: 48, lineHeight: 56 }]}>
                From Farm to Market,{'\n'}
                We Deliver <Text style={{ color: '#ccfd3a' }}>Growth</Text>
              </Text>
              <Text style={[styles.agroSub, isCompact && { fontSize: 15, lineHeight: 26, maxWidth: 340 }]}>
                Renax AgroTransport ensures your agricultural produce reaches every corner of Nigeria fresh, safe, and on time. Connecting farms to markets, empowering communities.
              </Text>

              <View style={[styles.agroFeaturesRow, isCompact && styles.agroFeaturesRowCompact]}>
                {AGRO_FEATURES.map((feature, index) => {
                  const Icon = feature.icon;
                  const showDivider = !isCompact && index < AGRO_FEATURES.length - 1;
                  return (
                    <View key={feature.label} style={[styles.agroFeatureItem, isCompact && styles.agroFeatureItemCompact, showDivider && styles.agroFeatureDivider]}>
                      <View style={styles.agroFeatureIconWrap}>
                        <Icon color="#ccfd3a" size={22} />
                      </View>
                      <Text style={styles.agroFeatureText}>{feature.label}</Text>
                    </View>
                  );
                })}
              </View>

              <HoverBtn style={styles.agroCta} onPress={() => onEnterApp('agro')}>
                <Text style={styles.agroCtaText}>Book Agro Transport</Text>
                <ChevronRight color="#002B22" size={18} />
              </HoverBtn>
            </Animated.View>

            {!isCompact && (
              <Animated.View entering={FadeInDown.duration(900).delay(150)} style={[styles.agroStepsWrap, isMobile && { marginTop: 52 }]}>
                <View style={styles.agroStepsCard}>
                  <Text style={styles.agroStepsTitle}>How It Works</Text>
                  {AGRO_STEPS.map((item, index) => (
                    <View key={item.step} style={[styles.stepRow, index < AGRO_STEPS.length - 1 && styles.stepRowSpaced]}>
                      <View style={styles.stepRail}>
                        <View style={styles.stepCircle}>
                          <Text style={styles.stepCircleText}>{index + 1}</Text>
                        </View>
                        {index < AGRO_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                      </View>
                      <View style={styles.stepCopy}>
                        <Text style={styles.stepTitle}>{item.step}</Text>
                        <Text style={styles.stepDesc}>{item.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </View>

          {isCompact && (
            <View style={styles.mobileStepsSection}>
              <Text style={styles.mobileStepsTitle}>How It Works</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.mobileStepsRow}>
                  {AGRO_STEPS.map((item, index) => (
                    <View key={item.step} style={styles.mobileStepCard}>
                      <View style={styles.mobileStepBadge}>
                        <Text style={styles.mobileStepBadgeText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.mobileStepTitle}>{item.step}</Text>
                      <Text style={styles.mobileStepDesc}>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#020f09',
  },
  heroSection: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,20,13,0.34)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    zIndex: 100,
  },
  logo: {
    width: 240,
    height: 68,
    ...(Platform.OS === 'web' ? ({ mixBlendMode: 'screen' } as any) : {}),
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
    borderRadius: 10,
  },
  navBtnHover: {
    backgroundColor: 'rgba(204,253,58,0.08)',
  },
  navBtnText: {
    fontFamily: 'Outfit_6',
    fontSize: 15,
    color: '#f1f8f4',
  },
  navBtnTextActive: {
    color: '#ccfd3a',
  },
  ctaNavBtn: {
    backgroundColor: '#ccfd3a',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
  },
  ctaNavBtnLoggedIn: {
    backgroundColor: '#083426',
    borderWidth: 1,
    borderColor: '#ccfd3a',
  },
  ctaNavBtnText: {
    fontFamily: 'Outfit_7',
    fontSize: 14,
    color: '#002B22',
  },
  ctaNavBtnTextLoggedIn: {
    color: '#ccfd3a',
  },
  dropdown: {
    position: 'absolute',
    top: 60,
    left: -8,
    width: 320,
    backgroundColor: '#04150d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.28)',
    paddingVertical: 10,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 30,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 24px 60px rgba(0,0,0,0.45)' } as any) : {}),
  },
  dropArrow: {
    position: 'absolute',
    top: -6,
    left: 26,
    width: 14,
    height: 14,
    backgroundColor: '#04150d',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(204,253,58,0.24)',
    transform: [{ rotate: '45deg' }],
  },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  dropItemHover: {
    backgroundColor: 'rgba(204,253,58,0.07)',
  },
  dropIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,253,58,0.1)',
  },
  dropLabel: {
    fontFamily: 'PlusJakartaSans_6',
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 2,
  },
  dropDesc: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    color: 'rgba(255,255,255,0.58)',
    lineHeight: 17,
  },
  mobileNavWrap: {
    paddingTop: 14,
    paddingHorizontal: 16,
    zIndex: 90,
  },
  mobileNavScroll: {
    gap: 10,
    paddingRight: 24,
  },
  mobileNavChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mobileNavChipActive: {
    borderColor: 'rgba(204,253,58,0.42)',
    backgroundColor: 'rgba(204,253,58,0.12)',
  },
  mobileNavChipText: {
    fontFamily: 'Outfit_6',
    fontSize: 14,
    color: '#edf6f1',
  },
  mobileNavChipTextActive: {
    color: '#ccfd3a',
  },
  mobileDropdown: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(4,21,13,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.2)',
    paddingVertical: 8,
  },
  heroContentWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  heroCopyColumn: {
    width: '100%',
    maxWidth: 680,
    paddingBottom: 48,
  },
  heroCopyColumnMobile: {
    maxWidth: '100%',
  },
  heroEyebrow: {
    fontFamily: 'Outfit_6',
    fontSize: 14,
    letterSpacing: 3.2,
    color: '#ccfd3a',
    marginBottom: 24,
  },
  heroH1: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 80,
    lineHeight: 84,
    color: '#ffffff',
    marginBottom: 22,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  heroAccent: {
    color: '#ccfd3a',
  },
  heroSub: {
    fontFamily: 'Outfit_4',
    fontSize: 20,
    lineHeight: 32,
    color: 'rgba(240,255,246,0.86)',
    maxWidth: 600,
    marginBottom: 34,
  },
  heroCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 34,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ccfd3a',
    paddingHorizontal: 28,
    paddingVertical: 17,
    borderRadius: 12,
  },
  btnPrimaryText: {
    fontFamily: 'Outfit_7',
    fontSize: 15,
    color: '#002B22',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    paddingHorizontal: 28,
    paddingVertical: 17,
    borderRadius: 12,
  },
  btnSecondaryText: {
    fontFamily: 'Outfit_6',
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    width: '100%',
    maxWidth: 860,
  },
  heroStatsCompact: {
    gap: 12,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 176,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(1,14,9,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroStatItemCompact: {
    width: '47%',
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroStatIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,253,58,0.12)',
  },
  heroStatValue: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 20,
    color: '#ffffff',
    marginBottom: 2,
  },
  heroStatLabel: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: 'rgba(235,255,244,0.72)',
  },
  brandBar: {
    marginHorizontal: 24,
    marginBottom: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.14)',
    backgroundColor: 'rgba(1,12,8,0.44)',
  },
  brandBarMobile: {
    marginHorizontal: 28,
  },
  brandBarCompact: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  brandLead: {
    marginBottom: 16,
  },
  brandLeadDesktop: {
    marginBottom: 18,
  },
  brandLeadText: {
    fontFamily: 'Outfit_6',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.8,
  },
  brandLogoWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 18,
  },
  brandLogoText: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 18,
    color: 'rgba(255,255,255,0.78)',
  },
  scrollHint: {
    alignItems: 'center',
  },
  scrollText: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 4,
  },
  servicesSection: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#010d07',
    paddingVertical: 84,
    position: 'relative',
  },
  bikerBg: {
    position: 'absolute',
    top: '-5%',
    left: '-2%',
    width: '104%',
    height: '112%',
    opacity: 0.18,
    resizeMode: 'cover',
  },
  sectionShell: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sectionEyebrow: {
    fontFamily: 'Outfit_6',
    fontSize: 12,
    color: '#ccfd3a',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 18,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 64,
    lineHeight: 70,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionSub: {
    fontFamily: 'Outfit_4',
    fontSize: 17,
    lineHeight: 28,
    color: 'rgba(200,255,220,0.68)',
    textAlign: 'center',
    maxWidth: 620,
    marginBottom: 54,
  },
  servicesGrid: {
    width: '100%',
    maxWidth: 1400,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 24,
    marginBottom: 54,
  },
  servicesGridCompact: {
    gap: 18,
  },
  serviceCardLink: {
    width: 290,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,22,14,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ transition: 'transform 180ms ease, border-color 180ms ease' } as any) : {}),
  },
  serviceCardLinkTablet: {
    width: '46%',
    minWidth: 280,
    maxWidth: 360,
  },
  serviceCardLinkCompact: {
    width: '100%',
    maxWidth: 340,
  },
  serviceCardLinkHover: {
    borderColor: 'rgba(204,253,58,0.35)',
    transform: [{ translateY: -4 }],
  },
  serviceCardImage: {
    width: '100%',
    aspectRatio: 0.736,
  },
  benefitsRow: {
    width: '100%',
    maxWidth: 1180,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 18,
  },
  benefitsRowCompact: {
    gap: 14,
  },
  benefitCard: {
    width: 270,
    minHeight: 180,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.14)',
  },
  benefitCardTablet: {
    width: '47%',
    minWidth: 270,
  },
  benefitCardCompact: {
    width: '100%',
    maxWidth: 340,
    minHeight: 0,
  },
  benefitIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,253,58,0.1)',
    marginBottom: 14,
  },
  benefitTitle: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 8,
  },
  benefitDesc: {
    fontFamily: 'Outfit_4',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(200,255,220,0.62)',
  },
  agroSection: {
    width: '100%',
    minHeight: 760,
    position: 'relative',
    overflow: 'hidden',
  },
  agroBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  agroInner: {
    paddingHorizontal: 80,
    paddingVertical: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 80,
  },
  agroCopy: {
    flex: 1,
    maxWidth: 560,
  },
  agroTitle: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 58,
    lineHeight: 66,
    color: '#ffffff',
    marginBottom: 24,
  },
  agroSub: {
    fontFamily: 'Outfit_4',
    fontSize: 17,
    lineHeight: 28,
    color: 'rgba(200,255,220,0.72)',
    marginBottom: 38,
    maxWidth: 500,
  },
  agroFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginBottom: 42,
  },
  agroFeaturesRowCompact: {
    gap: 14,
  },
  agroFeatureItem: {
    width: 134,
    alignItems: 'center',
    paddingRight: 18,
  },
  agroFeatureItemCompact: {
    width: '30%',
    minWidth: 92,
    paddingRight: 0,
  },
  agroFeatureDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(204,253,58,0.15)',
  },
  agroFeatureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,253,58,0.1)',
    marginBottom: 12,
  },
  agroFeatureText: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(200,255,220,0.76)',
    textAlign: 'center',
  },
  agroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ccfd3a',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
  },
  agroCtaText: {
    fontFamily: 'Outfit_7',
    fontSize: 15,
    color: '#002B22',
  },
  agroStepsWrap: {
    flex: 1,
    maxWidth: 580,
  },
  agroStepsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.15)',
    padding: 32,
  },
  agroStepsTitle: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 22,
    color: '#ffffff',
    marginBottom: 30,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepRowSpaced: {
    marginBottom: 24,
  },
  stepRail: {
    width: 44,
    alignItems: 'center',
    marginRight: 16,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,253,58,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(204,253,58,0.28)',
  },
  stepCircleText: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 15,
    color: '#ccfd3a',
  },
  stepLine: {
    width: 1.5,
    height: 20,
    backgroundColor: 'rgba(204,253,58,0.2)',
    marginTop: 6,
  },
  stepCopy: {
    flex: 1,
    paddingTop: 8,
  },
  stepTitle: {
    fontFamily: 'Outfit_6',
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 3,
  },
  stepDesc: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(200,255,220,0.58)',
  },
  mobileStepsSection: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  mobileStepsTitle: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 20,
    color: '#ffffff',
    marginBottom: 20,
  },
  mobileStepsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  mobileStepCard: {
    width: 168,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mobileStepBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,253,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.26)',
    marginBottom: 12,
  },
  mobileStepBadgeText: {
    fontFamily: 'PlusJakartaSans_7',
    fontSize: 14,
    color: '#ccfd3a',
  },
  mobileStepTitle: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: '#ccfd3a',
    lineHeight: 18,
    marginBottom: 8,
  },
  mobileStepDesc: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(200,255,220,0.58)',
  },
});
