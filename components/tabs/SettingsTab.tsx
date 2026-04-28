import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n';
import { Bell, ChevronRight, Globe, Lock, LogOut, Mail, User } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../supabase';
import {
  ensureCustomerSettings,
  fetchCurrentProfile,
  resolveCustomerId,
  updateCustomerSettings,
  upsertCustomerProfile,
} from '../../utils/customerData';

type SettingsTabProps = {
  customerId?: string | null;
};

type SectionKey = 'profile' | 'notifications' | 'security' | 'language';

export default function SettingsTab({ customerId }: SettingsTabProps) {
  const { t, i18n } = useTranslation();
  const [activeSection, setActiveSection] = useState<SectionKey>('profile');
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId ?? null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    state: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    marketing_notifications: false,
    language_code: 'en',
    region: 'Nigeria',
    two_factor_enabled: false,
  });
  const [securityForm, setSecurityForm] = useState({
    newEmail: '',
    newPassword: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState('');
  const [flashError, setFlashError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customerId) {
      setResolvedCustomerId(customerId);
      return;
    }

    resolveCustomerId()
      .then(setResolvedCustomerId)
      .catch((error) => {
        console.error('Failed to resolve customer id', error);
        setFlashError('Could not identify the current customer profile.');
      });
  }, [customerId]);

  useEffect(() => {
    if (!resolvedCustomerId) return;

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [profile, settings] = await Promise.all([
          fetchCurrentProfile(resolvedCustomerId),
          ensureCustomerSettings(resolvedCustomerId),
        ]);

        setProfileForm({
          fullName: profile?.full_name || '',
          email: profile?.email || '',
          phone: profile?.phone_number || '',
          state: profile?.state || '',
        });

        setSettingsForm({
          email_notifications: settings.email_notifications,
          sms_notifications: settings.sms_notifications,
          push_notifications: settings.push_notifications,
          marketing_notifications: settings.marketing_notifications,
          language_code: settings.language_code,
          region: settings.region,
          two_factor_enabled: settings.two_factor_enabled,
        });

        if (settings.language_code && settings.language_code !== i18n.language) {
          await setAppLanguage(settings.language_code);
        }
      } catch (error: any) {
        console.error('Failed to load customer settings', error);
        const msg = error?.message || String(error);
        setFlashError(`${msg} — Settings data is unavailable until the customer migration is applied.`);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [resolvedCustomerId, i18n]);

  const persistSettings = async (updates: Partial<typeof settingsForm>, successMessage: string) => {
    if (!resolvedCustomerId) return;
    setSaving(true);
    setFlashError('');

    try {
      const nextSettings = { ...settingsForm, ...updates };
      const saved = await updateCustomerSettings(resolvedCustomerId, nextSettings);
      setSettingsForm({
        email_notifications: saved.email_notifications,
        sms_notifications: saved.sms_notifications,
        push_notifications: saved.push_notifications,
        marketing_notifications: saved.marketing_notifications,
        language_code: saved.language_code,
        region: saved.region,
        two_factor_enabled: saved.two_factor_enabled,
      });
      if (saved.language_code !== i18n.language) {
        await setAppLanguage(saved.language_code);
      }
      setFlashMessage(successMessage);
    } catch (error: any) {
      setFlashError(error?.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!resolvedCustomerId) return;
    setSaving(true);
    setFlashError('');

    try {
      await upsertCustomerProfile(resolvedCustomerId, {
        full_name: profileForm.fullName,
        email: profileForm.email,
        phone_number: profileForm.phone,
        state: profileForm.state,
      });
      setFlashMessage('Profile information saved.');
    } catch (error: any) {
      setFlashError(error?.message || 'Could not save profile information.');
    } finally {
      setSaving(false);
    }
  };

  const saveSecurity = async () => {
    setSaving(true);
    setFlashError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Security changes require a signed-in account instead of the demo shell.');
      }

      if (securityForm.newEmail) {
        const { error } = await supabase.auth.updateUser({ email: securityForm.newEmail });
        if (error) throw error;
      }

      if (securityForm.newPassword) {
        const { error } = await supabase.auth.updateUser({ password: securityForm.newPassword });
        if (error) throw error;
      }

      setSecurityForm({ newEmail: '', newPassword: '' });
      setFlashMessage('Security changes submitted. Check your email if confirmation is required.');
    } catch (error: any) {
      setFlashError(error?.message || 'Could not update account security.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setSaving(true);
    setFlashError('');

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setFlashMessage('You have been signed out.');
    } catch (error: any) {
      setFlashError(error?.message || 'Could not sign out of this account.');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { id: 'profile' as const, icon: User, label: 'Profile Information' },
    { id: 'notifications' as const, icon: Bell, label: 'Notifications' },
    { id: 'security' as const, icon: Lock, label: 'Password & Security' },
    { id: 'language' as const, icon: Globe, label: 'Language & Region' },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 80 }}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>{t('dash.settings', 'Settings')}</Text>
          <Text style={styles.pageSub}>Manage your profile, notifications, security, and localization preferences.</Text>
        </View>
      </View>

      {flashMessage ? <View style={styles.successBanner}><Text style={styles.successText}>{flashMessage}</Text></View> : null}
      {flashError ? <View style={styles.errorBanner}><Text style={styles.errorText}>{flashError}</Text></View> : null}

      <View style={styles.mainGrid}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.leftCol}>
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setActiveSection(item.id)}
                style={[styles.menuItem, activeSection === item.id && styles.menuItemActive, index === 0 && { borderTopWidth: 0 }]}
              >
                <View style={styles.menuItemLeft}>
                  <item.icon color={activeSection === item.id ? '#ccfd3a' : '#004d3d'} size={20} />
                  <Text style={[styles.menuItemLabel, activeSection === item.id && styles.menuItemLabelActive]}>{item.label}</Text>
                </View>
                <ChevronRight color={activeSection === item.id ? '#ccfd3a' : '#888'} size={18} />
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut color="#EF4444" size={20} />
            <Text style={styles.logoutText}>{saving ? 'Working...' : 'Log Out'}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.rightCol}>
          {isLoading ? (
            <View style={styles.card}>
              <Text style={styles.pageSub}>Loading customer settings...</Text>
            </View>
          ) : null}

          {!isLoading && activeSection === 'profile' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile Information</Text>
              <View style={styles.inputGrid}>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput style={styles.input} value={profileForm.fullName} onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))} placeholder="Your Name" />
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput style={styles.input} value={profileForm.email} onChangeText={(value) => setProfileForm((current) => ({ ...current, email: value }))} placeholder="Email" autoCapitalize="none" />
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput style={styles.input} value={profileForm.phone} onChangeText={(value) => setProfileForm((current) => ({ ...current, phone: value }))} placeholder="Phone" />
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput style={styles.input} value={profileForm.state} onChangeText={(value) => setProfileForm((current) => ({ ...current, state: value }))} placeholder="State" />
                </View>
              </View>
              <View style={styles.cardActionRow}>
                <Pressable style={styles.saveBtn} onPress={saveProfile}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!isLoading && activeSection === 'notifications' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notification Preferences</Text>
              {[
                {
                  key: 'email_notifications' as const,
                  title: 'Email Notifications',
                  sub: 'Receive shipment updates and payment confirmations by email.',
                },
                {
                  key: 'sms_notifications' as const,
                  title: 'SMS Alerts',
                  sub: 'Get critical delivery updates as text messages.',
                },
                {
                  key: 'push_notifications' as const,
                  title: 'Push Notifications',
                  sub: 'See in-app alerts for all booking milestones.',
                },
                {
                  key: 'marketing_notifications' as const,
                  title: 'RENAX Product Updates',
                  sub: 'Occasional new-feature and promotional messages.',
                },
              ].map((item, index, items) => (
                <View key={item.key} style={[styles.toggleRow, index === items.length - 1 && { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text style={styles.toggleTitle}>{item.title}</Text>
                    <Text style={styles.toggleSub}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={settingsForm[item.key]}
                    onValueChange={(value) => persistSettings({ [item.key]: value }, `${item.title} updated.`)}
                    trackColor={{ false: '#e0e0e0', true: '#004d3d' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          ) : null}

          {!isLoading && activeSection === 'security' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Password & Security</Text>
              <View style={styles.infoCard}>
                <Mail color="#004d3d" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Change account email</Text>
                  <Text style={styles.infoCardText}>Supabase will send a confirmation if the account requires verification.</Text>
                </View>
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>New Email</Text>
                <TextInput style={styles.input} value={securityForm.newEmail} onChangeText={(value) => setSecurityForm((current) => ({ ...current, newEmail: value }))} placeholder="new@email.com" autoCapitalize="none" />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput style={styles.input} value={securityForm.newPassword} onChangeText={(value) => setSecurityForm((current) => ({ ...current, newPassword: value }))} placeholder="Enter a new password" secureTextEntry />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={styles.toggleTitle}>Two-factor readiness flag</Text>
                  <Text style={styles.toggleSub}>Tracks whether the customer wants 2FA enabled when a verification provider is connected.</Text>
                </View>
                <Switch
                  value={settingsForm.two_factor_enabled}
                  onValueChange={(value) => persistSettings({ two_factor_enabled: value }, 'Two-factor preference updated.')}
                  trackColor={{ false: '#e0e0e0', true: '#004d3d' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.cardActionRow}>
                <Pressable style={styles.saveBtn} onPress={saveSecurity}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Apply Security Changes'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!isLoading && activeSection === 'language' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Language & Region</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Preferred Language</Text>
                <View style={styles.optionGroup}>
                  {[
                    { code: 'en', label: 'English' },
                    { code: 'pcm', label: 'Pidgin' },
                    { code: 'ha', label: 'Hausa' },
                    { code: 'yo', label: 'Yoruba' },
                    { code: 'ig', label: 'Igbo' },
                  ].map((option) => (
                    <Pressable
                      key={option.code}
                      onPress={() => persistSettings({ language_code: option.code }, `Language switched to ${option.label}.`)}
                      style={[styles.optionPill, settingsForm.language_code === option.code && styles.optionPillActive]}
                    >
                      <Text style={[styles.optionPillText, settingsForm.language_code === option.code && styles.optionPillTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Region</Text>
                <TextInput
                  style={styles.input}
                  value={settingsForm.region}
                  onChangeText={(value) => setSettingsForm((current) => ({ ...current, region: value }))}
                  placeholder="Nigeria"
                />
              </View>

              <View style={styles.cardActionRow}>
                <Pressable style={styles.saveBtn} onPress={() => persistSettings({ region: settingsForm.region }, 'Language and region saved.')}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Region'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#111', marginBottom: 4 },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666' },
  successBanner: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 14, marginBottom: 16 },
  successText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#166534' },
  errorBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#B91C1C' },
  mainGrid: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  leftCol: { flex: 1, minWidth: 280, maxWidth: 320 },
  rightCol: { flex: 2, minWidth: 320 },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  menuItemActive: { backgroundColor: '#004d3d' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemLabel: { fontFamily: 'Outfit_6', fontSize: 15, color: '#333' },
  menuItemLabelActive: { color: '#fff' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontFamily: 'Outfit_6', fontSize: 15, color: '#EF4444' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 24,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 24 },
  inputGrid: { gap: 16 },
  inputWrap: { gap: 8, marginBottom: 16 },
  inputLabel: { fontFamily: 'Outfit_6', fontSize: 13, color: '#555' },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Outfit_4',
    fontSize: 15,
    color: '#111',
  },
  cardActionRow: { alignItems: 'flex-start', marginTop: 8 },
  saveBtn: { backgroundColor: '#ccfd3a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  saveBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleTitle: { fontFamily: 'Outfit_6', fontSize: 15, color: '#111', marginBottom: 4 },
  toggleSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#777' },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  infoCardTitle: { fontFamily: 'Outfit_6', fontSize: 14, color: '#166534', marginBottom: 4 },
  infoCardText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#166534' },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionPill: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  optionPillActive: { backgroundColor: '#004d3d', borderColor: '#004d3d' },
  optionPillText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#444' },
  optionPillTextActive: { color: '#fff' },
});
