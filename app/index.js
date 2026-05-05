import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LandingScreen from '../components/LandingScreen';
import CustomerDashboard from '../components/CustomerDashboard';
import AuthScreenNew from '../components/AuthScreen';
import { supabase } from '../supabase';
import '../i18n';

const THEME = {
  primary: '#FF6B00',
  background: '#050505',
  surface: '#121214',
  text: '#FFFFFF',
  subtext: '#71717A',
  danger: '#EF4444',
};

const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const resolveClaimRole = (user) => {
  const directRole = user?.app_metadata?.role;
  if (typeof directRole === 'string' && directRole.trim()) {
    return directRole.trim().toLowerCase();
  }

  const roles = user?.app_metadata?.roles;
  if (Array.isArray(roles)) {
    const normalizedRoles = roles
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim().toLowerCase());

    if (normalizedRoles.includes('admin')) return 'admin';
    if (normalizedRoles.includes('driver')) return 'driver';
    if (normalizedRoles.includes('rider')) return 'rider';
    if (normalizedRoles.includes('customer')) return 'customer';
  }

  return null;
};

function LoadingScreen() {
  return (
    <View style={styles.centeredScreen}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.logo}>📦</Text>
      <ActivityIndicator size="large" color={THEME.primary} />
      <Text style={styles.loadingLabel}>RENAX LOGISTICS</Text>
    </View>
  );
}

function RoleAccessNotice({ role }) {
  const label = role === 'admin' ? 'Admin app' : 'Rider app';

  return (
    <SafeAreaView style={styles.centeredScreen}>
      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>🔒</Text>
        <Text style={styles.noticeTitle}>Use the dedicated {label}</Text>
        <Text style={styles.noticeBody}>
          This customer entry no longer opens admin or rider tools. Those secured workflows now live in their own apps.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.primaryButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async () => {
    triggerHaptic();

    if (!email || !password) {
      setMessage('Please fill in your email and password.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated?.();
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          role: 'customer',
          full_name: fullName || null,
          phone_number: phone || null,
        });

        if (profileError) throw profileError;
      }

      setMessage('Account created. You can sign in now.');
      setIsLogin(true);
      setPassword('');
    } catch (error) {
      setMessage(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (Platform.OS === 'web') {
      setMessage('Biometric login is only available on mobile devices.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login to RENAX Logistics',
    });

    if (result.success) {
      setMessage('Biometric check passed. Finish sign-in with your saved account.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authScreen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.authCard}>
        <Text style={styles.authLogo}>📦</Text>
        <Text style={styles.authTitle}>{isLogin ? 'Customer Sign In' : 'Create Customer Account'}</Text>
        <Text style={styles.authSubtitle}>This entry now routes only into the secured customer workflow.</Text>

        {!isLogin ? (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Full name"
              placeholderTextColor={THEME.subtext}
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Phone"
              placeholderTextColor={THEME.subtext}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={THEME.subtext}
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={THEME.subtext}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#050505" /> : <Text style={styles.primaryButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>}
        </TouchableOpacity>

        {isLogin ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBiometricLogin}>
            <Text style={styles.secondaryButtonText}>Use Biometrics</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => setIsLogin((current) => !current)}>
          <Text style={styles.toggleText}>{isLogin ? 'Create a new account' : 'Back to sign in'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const isWebDemo = Platform.OS === 'web';
  const [session, setSession] = useState(isWebDemo ? { user: { id: 'demo' } } : null);
  const [userRole, setUserRole] = useState(isWebDemo ? 'customer' : null);
  const [loading, setLoading] = useState(!isWebDemo);
  const [showLanding, setShowLanding] = useState(isWebDemo);
  const [showAuth, setShowAuth] = useState(false);
  const [targetNav, setTargetNav] = useState('dashboard');
  const [isWebLoggedIn, setIsWebLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState({ state: 'Lagos', name: 'Adewale' });

  const fetchRole = async (nextSession) => {
    const claimedRole = resolveClaimRole(nextSession?.user);
    if (claimedRole) {
      setUserRole(claimedRole);
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', nextSession.user.id)
        .single();

      setUserRole(data?.role || 'customer');
    } catch (error) {
      console.log(error);
      setUserRole('customer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWebDemo) return;

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      if (nextSession) {
        fetchRole(nextSession);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        fetchRole(nextSession);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isWebDemo]);

  useEffect(() => {
    if (!isWebDemo) return;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession) {
        setIsWebLoggedIn(true);
      }
    });
  }, [isWebDemo]);

  if (loading) return <LoadingScreen />;

  if (isWebDemo) {
    if (showLanding && !showAuth) {
      return (
        <LandingScreen
          isLoggedIn={isWebLoggedIn}
          onEnterApp={(navTarget = 'dashboard') => {
            setTargetNav(navTarget);
            if (isWebLoggedIn) {
              setShowLanding(false);
            } else {
              setShowLanding(false);
              setShowAuth(true);
            }
          }}
        />
      );
    }

    if (showAuth) {
      return (
        <AuthScreenNew
          onAuthenticated={(profile) => {
            setUserProfile(profile);
            setIsWebLoggedIn(true);
            setShowAuth(false);
          }}
        />
      );
    }

    return (
      <CustomerDashboard
        userState={userProfile.state}
        userName={userProfile.name || 'Adewale'}
        initialNav={targetNav}
      />
    );
  }

  if (!session) return <AuthScreen onAuthenticated={() => {}} />;
  if (userRole === 'admin') return <RoleAccessNotice role="admin" />;
  if (userRole === 'driver' || userRole === 'rider') return <RoleAccessNotice role="rider" />;
  return <CustomerDashboard initialNav={targetNav} />;
}

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 48,
    marginBottom: 20,
  },
  loadingLabel: {
    color: THEME.subtext,
    marginTop: 20,
    letterSpacing: 2,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: THEME.surface,
    padding: 24,
  },
  noticeIcon: {
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 16,
  },
  noticeTitle: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  noticeBody: {
    color: THEME.subtext,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  authScreen: {
    flex: 1,
    backgroundColor: THEME.background,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  authCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: THEME.surface,
    padding: 24,
  },
  authLogo: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  authTitle: {
    color: THEME.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    color: THEME.subtext,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#232329',
    borderRadius: 14,
    backgroundColor: '#0B0B0D',
    color: THEME.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  message: {
    color: '#FBBF24',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: THEME.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#050505',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2D2D34',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleText: {
    color: THEME.subtext,
    textAlign: 'center',
    marginTop: 18,
  },
});
