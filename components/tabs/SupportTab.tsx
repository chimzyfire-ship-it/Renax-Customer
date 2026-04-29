import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Mail, Phone, Search, Send, Ticket } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { fetchCurrentProfile, resolveCustomerId } from '../../utils/customerData';
import { submitSupportTicket } from '../../utils/notificationService';

const FAQS = [
  {
    q: 'How long does a standard delivery take?',
    a: 'Same-state standard deliveries typically take 24-48 hours. Interstate freight timelines vary by hub routing and handoff stage.',
  },
  {
    q: 'Will I receive shipment updates automatically?',
    a: 'Yes. RENAX now sends customer notifications for booking, rider assignment, terminal transit, out-for-delivery, delivery, and exception milestones.',
  },
  {
    q: 'Can I change my delivery address mid-transit?',
    a: 'Address changes are only possible before final-mile dispatch. Once a shipment is out for delivery, support must review feasibility with the assigned rider or hub team.',
  },
  {
    q: 'What happens if my package is lost or damaged?',
    a: 'Create a support ticket immediately with the order ID and a clear issue description so the operations team can start an investigation.',
  },
];

type SupportTabProps = {
  customerId?: string | null;
  onTrackShipment?: (trackingId: string) => void;
};

export default function SupportTab({ customerId, onTrackShipment }: SupportTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const isCompact = width < 640;
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId ?? null);
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [subject, setSubject] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<'email' | 'phone'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (customerId) {
      setResolvedCustomerId(customerId);
      return;
    }

    resolveCustomerId()
      .then(setResolvedCustomerId)
      .catch((error) => {
        console.error('Failed to resolve customer id for support', error);
        setErrorMessage('We could not identify the current customer profile.');
      });
  }, [customerId]);

  useEffect(() => {
    if (!resolvedCustomerId) return;

    fetchCurrentProfile(resolvedCustomerId)
      .then((profile) => {
        setProfileEmail(profile?.email || '');
        setProfilePhone(profile?.phone_number || '');
      })
      .catch((error) => {
        console.error('Failed to preload support profile', error);
      });
  }, [resolvedCustomerId]);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return FAQS;

    return FAQS.filter((item) =>
      `${item.q} ${item.a}`.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const openEmail = async () => {
    const url = 'mailto:support@renax.ng?subject=RENAX%20Support%20Request';
    await Linking.openURL(url);
  };

  const openPhone = async () => {
    await Linking.openURL('tel:+23480073629');
  };

  const handleSubmit = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (!resolvedCustomerId) {
      setErrorMessage('Support ticket submission needs a resolved customer profile.');
      return;
    }

    if (!subject.trim() || !issueDescription.trim()) {
      setErrorMessage('Please add both a subject and a clear issue description.');
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await submitSupportTicket({
        customerId: resolvedCustomerId,
        trackingId,
        subject,
        issueDescription,
        preferredChannel,
        email: profileEmail,
        phoneNumber: profilePhone,
      });

      setSuccessMessage(`Ticket ${ticket.id.slice(0, 8).toUpperCase()} was submitted successfully.`);
      setTrackingId('');
      setSubject('');
      setIssueDescription('');

      if (trackingId.trim()) {
        onTrackShipment?.(trackingId.trim());
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Ticket submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: isCompact ? 12 : isMobile ? 16 : 32, paddingBottom: 60 }}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, isCompact && { fontSize: 22 }]}>{t('dash.support', 'Customer Support')}</Text>
          <Text style={styles.pageSub}>Get help through real support channels and a ticketing queue that can scale with your shipments.</Text>
        </View>
      </View>

      {successMessage ? <View style={styles.successBanner}><Text style={styles.successText}>{successMessage}</Text></View> : null}
      {errorMessage ? <View style={styles.errorBanner}><Text style={styles.errorText}>{errorMessage}</Text></View> : null}

      <View style={styles.mainGrid}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.leftCol, isMobile && { minWidth: 0, maxWidth: '100%' as any, width: '100%' }]}>
          <View style={[styles.contactCard, isCompact && { padding: 18 }]}>
            <View style={styles.contactIconWrap}>
              <Phone color="#004d3d" size={24} />
            </View>
            <Text style={styles.contactTitle}>Call Operations</Text>
            <Text style={styles.contactSub}>Use phone support for urgent delivery or dispatch issues during business hours.</Text>
            <Pressable style={styles.btnOutline} onPress={openPhone}>
              <Text style={styles.btnOutlineText}>+234 800 RENAX</Text>
            </Pressable>
          </View>

          <View style={[styles.contactCard, isCompact && { padding: 18 }]}>
            <View style={styles.contactIconWrap}>
              <Mail color="#004d3d" size={24} />
            </View>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>Use email for documentation, proofs, address clarifications, and less urgent follow-up.</Text>
            <Pressable style={styles.btnOutline} onPress={openEmail}>
              <Text style={styles.btnOutlineText}>support@renax.ng</Text>
            </Pressable>
          </View>

          <View style={[styles.contactCard, isCompact && { padding: 18 }]}>
            <View style={styles.contactIconWrap}>
              <Ticket color="#004d3d" size={24} />
            </View>
            <Text style={styles.contactTitle}>Ticketing Standard</Text>
            <Text style={styles.contactSub}>Every issue can be logged to the backend so operations can triage, assign, and follow up at scale.</Text>
            <View style={styles.ticketPill}>
              <Text style={styles.ticketPillText}>No mock chat buttons</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.rightCol, isMobile && { minWidth: 0, width: '100%' }]}>
          <View style={[styles.card, isCompact && { padding: 18 }]}>
            <Text style={styles.cardTitle}>Frequently Asked Questions</Text>

            <View style={styles.searchBar}>
              <Search color="#999" size={18} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search help articles..."
                placeholderTextColor="#aaa"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.faqList}>
              {filteredFaqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <View key={faq.q} style={[styles.faqItem, isOpen && styles.faqItemOpen]}>
                    <Pressable style={styles.faqHeader} onPress={() => setOpenFaq(isOpen ? null : i)}>
                      <Text style={[styles.faqQ, isOpen && { color: '#004d3d' }]}>{faq.q}</Text>
                      {isOpen ? <ChevronUp color="#004d3d" size={20} /> : <ChevronDown color="#999" size={20} />}
                    </Pressable>
                    {isOpen ? (
                      <View style={styles.faqBody}>
                        <Text style={styles.faqA}>{faq.a}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {filteredFaqs.length === 0 ? (
                <Text style={styles.noSearchResults}>No help articles matched your search.</Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.card, isCompact && { padding: 18 }]}>
            <Text style={styles.cardTitle}>Submit a Ticket</Text>
            <View style={{ gap: 16 }}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Related Order ID (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. RNX-1207"
                  placeholderTextColor="#aaa"
                  value={trackingId}
                  onChangeText={setTrackingId}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Short summary of the issue"
                  placeholderTextColor="#aaa"
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Describe the issue</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Explain what happened, what shipment is affected, and what outcome you need."
                  placeholderTextColor="#aaa"
                  value={issueDescription}
                  onChangeText={setIssueDescription}
                  multiline
                />
              </View>

              <View style={styles.channelRow}>
                <Text style={styles.inputLabel}>Preferred follow-up</Text>
                <View style={[styles.channelButtons, isCompact && { flexWrap: 'wrap' }]}>
                  {(['email', 'phone'] as const).map((channel) => {
                    const active = preferredChannel === channel;
                    return (
                      <Pressable
                        key={channel}
                        style={[styles.channelBtn, isCompact && { flex: 1, minWidth: 120 }, active && styles.channelBtnActive]}
                        onPress={() => setPreferredChannel(channel)}
                      >
                        <Text style={[styles.channelBtnText, active && styles.channelBtnTextActive]}>
                          {channel === 'email' ? 'Email' : 'Phone'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable style={[styles.btnSolid, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
                <Send color="#004d3d" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.btnSolidText}>{submitting ? 'Submitting...' : 'Submit Ticket'}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#111', marginBottom: 4 },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', maxWidth: 720 },
  successBanner: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 18 },
  successText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#166534' },
  errorBanner: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fecaca', marginBottom: 18 },
  errorText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#b91c1c' },
  mainGrid: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  leftCol: { flex: 1, minWidth: 260, maxWidth: 320, gap: 16 },
  rightCol: { flex: 2, minWidth: 320 },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    alignItems: 'center',
  },
  contactIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(204,253,58,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  contactTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 6, textAlign: 'center' },
  contactSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  ticketPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  ticketPillText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#166534' },
  btnSolid: {
    flexDirection: 'row',
    backgroundColor: '#ccfd3a',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSolidText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },
  btnOutline: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#004d3d',
  },
  btnOutlineText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    marginBottom: 24,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111', marginBottom: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchInput: { flex: 1, paddingVertical: 14, paddingLeft: 12, fontFamily: 'Outfit_4', fontSize: 15, color: '#111' },
  faqList: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  faqItemOpen: { backgroundColor: '#fdfdfd' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
  faqQ: { fontFamily: 'Outfit_6', fontSize: 15, color: '#333', flex: 1, paddingRight: 16 },
  faqBody: { paddingBottom: 20 },
  faqA: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', lineHeight: 22 },
  noSearchResults: { fontFamily: 'Outfit_4', fontSize: 13, color: '#888', paddingTop: 18 },
  inputWrap: { gap: 8 },
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
  multilineInput: { height: 110, textAlignVertical: 'top' },
  channelRow: { gap: 10 },
  channelButtons: { flexDirection: 'row', gap: 10 },
  channelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  channelBtnActive: {
    backgroundColor: '#004d3d',
    borderColor: '#004d3d',
  },
  channelBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#4b5563' },
  channelBtnTextActive: { color: '#ccfd3a' },
});
