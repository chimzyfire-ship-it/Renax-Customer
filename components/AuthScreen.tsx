// AuthScreen.tsx — Split-panel Sign In / Sign Up with onboarding
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform, ScrollView, useWindowDimensions, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFonts, PlusJakartaSans_800ExtraBold, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, ArrowRight, Check, MapPin } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara'
];

const STATE_COORDS = {
  'Lagos': { lat: 6.5244, lng: 3.3792 },
  'FCT - Abuja': { lat: 9.0765, lng: 7.3986 },
  'Rivers': { lat: 4.8156, lng: 7.0498 },
  'Kano': { lat: 12.0022, lng: 8.5920 },
  'Oyo': { lat: 7.8, lng: 3.93 },
  'Anambra': { lat: 6.21, lng: 7.07 },
};

const SHIP_TYPES = [
  { id: 'personal', label: 'Personal Parcels', desc: 'Documents, gifts, personal items' },
  { id: 'retail', label: 'SME / Retail', desc: 'E-commerce & bulk distributions' },
  { id: 'freight', label: 'Heavy Freight', desc: 'Industrial cargo & haulage' },
];

const FREQ_TYPES = [
  { id: 'once', label: 'Just a one-off' },
  { id: 'weekly', label: 'Weekly deliveries' },
  { id: 'daily', label: 'Daily Corporate Volume' },
];

export default function AuthScreen({ onAuthenticated }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_8: PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_6: PlusJakartaSans_600SemiBold,
    Outfit_4: Outfit_400Regular,
    Outfit_6: Outfit_600SemiBold,
    Outfit_7: Outfit_700Bold,
  });

  const [mode, setMode] = useState<'signin' | 'signup'>('signin'); // signin | signup
  const [onboardStep, setOnboardStep] = useState(0); // 0 = auth, 1 = state, 2 = shiptype, 3 = freq
  const [showPass, setShowPass] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Onboarding choices
  const [selectedState, setSelectedState] = useState('');
  const [selectedShipType, setSelectedShipType] = useState('');
  const [selectedFreq, setSelectedFreq] = useState('');

  if (!fontsLoaded) return null;

  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

  const handleSignIn = () => {
    // For web demo, skip real auth and go straight in
    onAuthenticated({ state: selectedState || 'Lagos', shipType: selectedShipType, freq: selectedFreq });
  };

  const handleSignUp = () => {
    // Move to onboarding
    setOnboardStep(1);
  };

  const finishOnboarding = () => {
    onAuthenticated({ state: selectedState || 'Lagos', shipType: selectedShipType, freq: selectedFreq });
  };

  // ─── ONBOARDING STEP 1: Choose State ───
  if (onboardStep === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020f09' }}>
      <Image source={require('../assets/images/Sign in page background .png')} style={StyleSheet.absoluteFillObject as any} resizeMode="contain" />
        <LinearGradient colors={['rgba(2,15,9,0.45)', 'rgba(2,15,9,0.75)']} style={StyleSheet.absoluteFillObject as any} />
        <Animated.View entering={FadeInDown.duration(500)} style={styles.onboardWrap}>
          <View style={styles.stepPill}><Text style={styles.stepPillText}>Step 1 of 3</Text></View>
          <MapPin color="#ccfd3a" size={48} />
          <Text style={styles.onboardTitle}>{t('onboard.step1')}</Text>
          <Text style={styles.onboardSub}>{t('onboard.step1sub')}</Text>
          <ScrollView style={styles.stateList} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            {NIGERIAN_STATES.map(s => (
              <Pressable
                key={s}
                style={[styles.stateItem, selectedState === s && styles.stateItemActive]}
                onPress={() => setSelectedState(s)}
              >
                <Text style={[styles.stateText, selectedState === s && { color: '#ccfd3a' }]}>{s}</Text>
                {selectedState === s && <Check color="#ccfd3a" size={18} />}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={[styles.onboardBtn, !selectedState && { opacity: 0.4 }]} onPress={() => selectedState && setOnboardStep(2)}>
            <Text style={styles.onboardBtnText}>{t('onboard.continue')}</Text>
            <ArrowRight color="#002B22" size={20} />
          </Pressable>
          <Pressable onPress={finishOnboarding}><Text style={styles.skipText}>{t('onboard.skip')}</Text></Pressable>
        </Animated.View>
      </View>
    );
  }

  // ─── ONBOARDING STEP 2: Ship Type ───
  if (onboardStep === 2) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020f09' }}>
      <Image source={require('../assets/images/Sign in page background .png')} style={StyleSheet.absoluteFillObject as any} resizeMode="contain" />
        <LinearGradient colors={['rgba(2,15,9,0.45)', 'rgba(2,15,9,0.75)']} style={StyleSheet.absoluteFillObject as any} />
        <Animated.View entering={FadeInDown.duration(500)} style={styles.onboardWrap}>
          <View style={styles.stepPill}><Text style={styles.stepPillText}>Step 2 of 3</Text></View>
          <Text style={styles.onboardTitle}>{t('onboard.step2')}</Text>
          <Text style={styles.onboardSub}>{t('onboard.step2sub')}</Text>
          <View style={styles.shipCards}>
            {SHIP_TYPES.map(s => (
              <Pressable
                key={s.id}
                style={[styles.shipCard, selectedShipType === s.id && styles.shipCardActive]}
                onPress={() => setSelectedShipType(s.id)}
              >
                <Text style={styles.shipLabel}>{s.label}</Text>
                <Text style={styles.shipDesc}>{s.desc}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.onboardBtn, !selectedShipType && { opacity: 0.4 }]} onPress={() => selectedShipType && setOnboardStep(3)}>
            <Text style={styles.onboardBtnText}>{t('onboard.continue')}</Text>
            <ArrowRight color="#002B22" size={20} />
          </Pressable>
          <Pressable onPress={finishOnboarding}><Text style={styles.skipText}>{t('onboard.skip')}</Text></Pressable>
        </Animated.View>
      </View>
    );
  }

  // ─── ONBOARDING STEP 3: Frequency ───
  if (onboardStep === 3) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020f09' }}>
      <Image source={require('../assets/images/Sign in page background .png')} style={StyleSheet.absoluteFillObject as any} resizeMode="contain" />
        <LinearGradient colors={['rgba(2,15,9,0.45)', 'rgba(2,15,9,0.75)']} style={StyleSheet.absoluteFillObject as any} />
        <Animated.View entering={FadeInDown.duration(500)} style={styles.onboardWrap}>
          <View style={styles.stepPill}><Text style={styles.stepPillText}>Step 3 of 3</Text></View>
          <Text style={styles.onboardTitle}>{t('onboard.step3')}</Text>
          <Text style={styles.onboardSub}>{t('onboard.step3sub')}</Text>
          <View style={{ gap: 14, width: '100%', maxWidth: 380 }}>
            {FREQ_TYPES.map(f => (
              <Pressable
                key={f.id}
                style={[styles.freqPill, selectedFreq === f.id && styles.freqPillActive]}
                onPress={() => setSelectedFreq(f.id)}
              >
                <Text style={[styles.freqText, selectedFreq === f.id && { color: '#002B22' }]}>{f.label}</Text>
                {selectedFreq === f.id && <Check color="#002B22" size={18} />}
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.onboardBtn, !selectedFreq && { opacity: 0.4 }]} onPress={() => selectedFreq && finishOnboarding()}>
            <Text style={styles.onboardBtnText}>{t('onboard.finish')}</Text>
          </Pressable>
          <Pressable onPress={finishOnboarding}><Text style={styles.skipText}>{t('onboard.skip')}</Text></Pressable>
        </Animated.View>
      </View>
    );
  }

  // ─── AUTH SCREEN (Split Panel) ───
  return (
    <View style={{ flex: 1, backgroundColor: '#020f09' }}>
      <Image source={require('../assets/images/Sign in page background .png')} style={StyleSheet.absoluteFillObject as any} resizeMode="contain" />
      <LinearGradient
        colors={['rgba(0,20,13,0.2)', 'rgba(2,15,9,0.75)']}
        style={StyleSheet.absoluteFillObject as any}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
      <View style={[styles.authContainer, isMobile && { flexDirection: 'column', flex: undefined }]}>
        {/* ── LEFT PANEL ── */}
        <Animated.View entering={FadeIn.duration(800)} style={[styles.leftPanel, isMobile && styles.leftPanelMobile]}>
          <Image source={require('../assets/images/logo.jpg')} style={styles.authLogo} resizeMode="contain" />
          <Text style={styles.authBrandTitle}>RENAX Logistics</Text>
          <Text style={styles.authBrandSub}>Nigeria's fastest growing{'\n'}logistics platform.</Text>

          <View style={{ gap: 16, marginTop: 40 }}>
            {[
              { icon: 'express', text: 'Express bike & tricycle delivery' },
              { icon: 'freight', text: 'Pickup & Heavy Freight nationwide' },
              { icon: 'tracking', text: 'Live GPS tracking across all 36 states' },
              { icon: 'insurance', text: 'Fully insured & 24/7 customer support' },
            ].map(f => (
              <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ fontSize: 24 }}>✓</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.versionTag}>
            <Text style={styles.versionText}>RENAX Logistics | v1.1.0</Text>
          </View>
        </Animated.View>

        {/* ── RIGHT PANEL ── */}
        <Animated.View entering={FadeInDown.duration(700)} style={[styles.rightPanel, glass, isMobile && styles.rightPanelMobile]}>
          {/* Tabs */}
          <View style={styles.authTabs}>
            <Pressable onPress={() => setMode('signin')} style={[styles.authTab, mode === 'signin' && styles.authTabActive]}>
              <Text style={[styles.authTabText, mode === 'signin' && styles.authTabTextActive]}>{t('auth.signin')}</Text>
            </Pressable>
            <Pressable onPress={() => setMode('signup')} style={[styles.authTab, mode === 'signup' && styles.authTabActive]}>
              <Text style={[styles.authTabText, mode === 'signup' && styles.authTabTextActive]}>{t('auth.signup')}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {mode === 'signin' ? (
              <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 18 }}>
                <View>
                  <Text style={styles.authWelcome}>{t('auth.welcome')}</Text>
                  <Text style={styles.authWelcomeSub}>{t('auth.subtitle')}</Text>
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@email.com"
                    placeholderTextColor="#4a6650"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputWrap}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                    <Pressable><Text style={styles.forgotText}>{t('auth.forgot')}</Text></Pressable>
                  </View>
                  <View style={styles.passWrap}>
                    <TextInput
                      style={[styles.input, { flex: 1, borderWidth: 0 }]}
                      placeholder="••••••••"
                      placeholderTextColor="#4a6650"
                      secureTextEntry={!showPass}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={() => setShowPass(p => !p)}>
                      {showPass ? <EyeOff color="#4a6650" size={20} /> : <Eye color="#4a6650" size={20} />}
                    </Pressable>
                  </View>
                </View>

                <Pressable style={styles.authBtn} onPress={handleSignIn}>
                  <Text style={styles.authBtnText}>{t('auth.signin')}</Text>
                  <ArrowRight color="#002B22" size={20} />
                </Pressable>

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>{t('auth.or')}</Text>
                  <View style={styles.orLine} />
                </View>

                <Pressable style={styles.switchBtn} onPress={() => setMode('signup')}>
                  <Text style={styles.switchText}>{t('auth.newuser')} <Text style={{ color: '#ccfd3a' }}>{t('auth.signup')}</Text></Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 18 }}>
                <View>
                  <Text style={styles.authWelcome}>{t('auth.create')}</Text>
                  <Text style={styles.authWelcomeSub}>Join thousands of Nigerians shipping smarter.</Text>
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>{t('auth.name')}</Text>
                  <TextInput style={styles.input} placeholder="Adewale Okafor" placeholderTextColor="#4a6650" value={name} onChangeText={setName} />
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                  <TextInput style={styles.input} placeholder="you@email.com" placeholderTextColor="#4a6650" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>{t('auth.phone')}</Text>
                  <TextInput style={styles.input} placeholder="+234 801 234 5678" placeholderTextColor="#4a6650" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                </View>

                <View style={styles.inputWrap}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                  </View>
                  <View style={styles.passWrap}>
                    <TextInput
                      style={[styles.input, { flex: 1, borderWidth: 0 }]}
                      placeholder="Create a strong password"
                      placeholderTextColor="#4a6650"
                      secureTextEntry={!showPass}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={() => setShowPass(p => !p)}>
                      {showPass ? <EyeOff color="#4a6650" size={20} /> : <Eye color="#4a6650" size={20} />}
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={() => setAgreed(p => !p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                    {agreed && <Check color="#002B22" size={14} />}
                  </View>
                  <Text style={styles.agreeText}>{t('auth.agree')}</Text>
                </Pressable>

                <Pressable style={[styles.authBtn, !agreed && { opacity: 0.5 }]} onPress={() => agreed && handleSignUp()}>
                  <Text style={styles.authBtnText}>{t('auth.create')}</Text>
                  <ArrowRight color="#002B22" size={20} />
                </Pressable>

                <Pressable style={styles.switchBtn} onPress={() => setMode('signin')}>
                  <Text style={styles.switchText}>{t('auth.existing')} <Text style={{ color: '#ccfd3a' }}>{t('auth.signin')}</Text></Text>
                </Pressable>
              </Animated.View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    padding: 50,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,40,26,0.6)',
  },
  leftPanelMobile: {
    flex: 0,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
  },
  authLogo: {
    width: '100%',
    maxWidth: 400,
    height: 140,
    marginBottom: 24,
  },
  authBrandTitle: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 36,
    color: '#ffffff',
    marginBottom: 8,
  },
  authBrandSub: {
    fontFamily: 'Outfit_4',
    fontSize: 18,
    color: 'rgba(200,255,220,0.7)',
    lineHeight: 28,
  },
  featureText: {
    fontFamily: 'Outfit_4',
    fontSize: 15,
    color: 'rgba(200,255,220,0.8)',
    lineHeight: 22,
  },
  versionTag: {
    position: 'absolute',
    bottom: 30,
    left: 50,
  },
  versionText: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  rightPanel: {
    width: 460,
    padding: 50,
    backgroundColor: 'rgba(4,20,13,0.88)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
  },
  rightPanelMobile: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 30,
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 9,
  },
  authTabActive: {
    backgroundColor: '#ccfd3a',
  },
  authTabText: {
    fontFamily: 'Outfit_6',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  authTabTextActive: {
    color: '#002B22',
  },
  authWelcome: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 28,
    color: '#fff',
    marginBottom: 4,
  },
  authWelcomeSub: {
    fontFamily: 'Outfit_4',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  inputWrap: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: 'rgba(200,255,220,0.7)',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontFamily: 'Outfit_4',
    fontSize: 15,
  },
  passWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: '#ccfd3a',
  },
  authBtn: {
    backgroundColor: '#ccfd3a',
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  authBtnText: {
    fontFamily: 'Outfit_7',
    fontSize: 15,
    color: '#002B22',
    letterSpacing: 0.5,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orText: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontFamily: 'Outfit_4',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ccfd3a',
    borderColor: '#ccfd3a',
  },
  agreeText: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: 'rgba(200,255,220,0.7)',
    flex: 1,
  },

  // Onboarding
  onboardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
    zIndex: 2,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  stepPill: {
    backgroundColor: 'rgba(204,253,58,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(204,253,58,0.3)',
  },
  stepPillText: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: '#ccfd3a',
    letterSpacing: 1,
  },
  onboardTitle: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  onboardSub: {
    fontFamily: 'Outfit_4',
    fontSize: 16,
    color: 'rgba(200,255,220,0.7)',
    textAlign: 'center',
    marginBottom: 28,
  },
  stateList: {
    width: '100%',
    maxHeight: 300,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  stateItemActive: {
    backgroundColor: 'rgba(204,253,58,0.08)',
  },
  stateText: {
    fontFamily: 'Outfit_4',
    fontSize: 15,
    color: 'rgba(200,255,220,0.9)',
  },
  shipCards: {
    gap: 14,
    width: '100%',
    marginBottom: 24,
  },
  shipCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 20,
  },
  shipCardActive: {
    borderColor: '#ccfd3a',
    backgroundColor: 'rgba(204,253,58,0.08)',
  },
  shipLabel: {
    fontFamily: 'Outfit_6',
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  shipDesc: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: 'rgba(200,255,220,0.6)',
  },
  freqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  freqPillActive: {
    backgroundColor: '#ccfd3a',
    borderColor: '#ccfd3a',
  },
  freqText: {
    fontFamily: 'Outfit_6',
    fontSize: 16,
    color: '#fff',
  },
  onboardBtn: {
    backgroundColor: '#ccfd3a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  onboardBtnText: {
    fontFamily: 'Outfit_7',
    fontSize: 16,
    color: '#002B22',
  },
  skipText: {
    fontFamily: 'Outfit_4',
    fontSize: 14,
    color: 'rgba(200,255,220,0.4)',
    textDecorationLine: 'underline',
  },
});
