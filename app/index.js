import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LandingScreen from '../components/LandingScreen';
import CustomerDashboard from '../components/CustomerDashboard';
import AuthScreenNew from '../components/AuthScreen';
import { supabase } from '../supabase';
import { ensureCustomerProfileForUser } from '../utils/customerProfile';
import '../i18n';

const THEME = {
  primary: '#FF6B00',
  background: '#050505',
  surface: '#121214',
  text: '#FFFFFF',
  subtext: '#71717A',
  danger: '#EF4444',
};

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

export default function App() {
  const isWebDemo = Platform.OS === 'web';
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(isWebDemo);
  const [showAuth, setShowAuth] = useState(false);
  const [targetNav, setTargetNav] = useState('dashboard');
  const [isWebLoggedIn, setIsWebLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState({ state: 'Lagos', name: 'Adewale' });

  const hydrateCustomerProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, state')
        .eq('id', userId)
        .maybeSingle();

      setUserProfile({
        state: data?.state || 'Lagos',
        name: data?.full_name || 'Adewale',
      });
    } catch (error) {
      console.log(error);
      setUserProfile({ state: 'Lagos', name: 'Adewale' });
    }
  };

  const fetchRole = async (nextSession) => {
    const claimedRole = resolveClaimRole(nextSession?.user);
    if (claimedRole) {
      setUserRole(claimedRole);
      if (claimedRole === 'customer' && nextSession?.user?.id) {
        try {
          await ensureCustomerProfileForUser({ user: nextSession.user });
        } catch (error) {
          console.log(error);
        }
        await hydrateCustomerProfile(nextSession.user.id);
      }
      setLoading(false);
      return;
    }

    try {
      await ensureCustomerProfileForUser({ user: nextSession.user });
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', nextSession.user.id)
        .single();

      setUserRole(data?.role || 'customer');
      await hydrateCustomerProfile(nextSession.user.id);
    } catch (error) {
      console.log(error);
      setUserRole('customer');
      if (nextSession?.user?.id) {
        await hydrateCustomerProfile(nextSession.user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      if (nextSession) {
        fetchRole(nextSession);
        if (isWebDemo) {
          setIsWebLoggedIn(true);
          setShowLanding(false);
          setShowAuth(false);
        }
      } else {
        if (isWebDemo) {
          setIsWebLoggedIn(false);
        }
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        fetchRole(nextSession);
        if (isWebDemo) {
          setIsWebLoggedIn(true);
          setShowLanding(false);
          setShowAuth(false);
        }
      } else {
        setUserRole(null);
        if (isWebDemo) {
          setIsWebLoggedIn(false);
          setShowLanding(true);
          setShowAuth(false);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isWebDemo]);

  if (loading) return <LoadingScreen />;

  if (isWebDemo) {
    if (!session && showLanding && !showAuth) {
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

    if (!session && showAuth) {
      return (
        <AuthScreenNew
          onAuthenticated={(profile) => {
            setUserProfile({
              state: profile?.state || 'Lagos',
              name: profile?.name || userProfile.name || 'Adewale',
            });
            setIsWebLoggedIn(true);
            setShowAuth(false);
          }}
        />
      );
    }

    if (!session) return <AuthScreenNew onAuthenticated={() => setShowAuth(false)} />;
  }

  if (!session) return <AuthScreenNew onAuthenticated={() => {}} />;
  if (userRole === 'admin') return <RoleAccessNotice role="admin" />;
  if (userRole === 'driver' || userRole === 'rider') return <RoleAccessNotice role="rider" />;
  return <CustomerDashboard initialNav={targetNav} userName={userProfile.name} userState={userProfile.state} />;
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
});
