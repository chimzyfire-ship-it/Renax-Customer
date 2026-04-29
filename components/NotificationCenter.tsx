import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Bell, CheckCheck, Package, Radio } from 'lucide-react-native';
import type { CustomerNotificationRecord } from '../utils/notificationService';

type NotificationCenterProps = {
  visible: boolean;
  notifications: CustomerNotificationRecord[];
  loading: boolean;
  onClose: () => void;
  onOpenNotification: (notification: CustomerNotificationRecord) => void;
  onMarkAllRead: () => void;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function NotificationCenter({
  visible,
  notifications,
  loading,
  onClose,
  onOpenNotification,
  onMarkAllRead,
}: NotificationCenterProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, isMobile && styles.overlayMobile]} onPress={onClose}>
        <Pressable style={[styles.sheet, isMobile && styles.sheetMobile]} onPress={() => {}}>
          <View style={[styles.header, isMobile && styles.headerMobile]}>
            <View style={styles.headerLeft}>
              <Bell color="#004d3d" size={18} />
              <View>
                <Text style={styles.title}>Notifications</Text>
                <Text style={styles.subtitle}>Live shipment and account alerts</Text>
              </View>
            </View>
            <Pressable style={[styles.markAllBtn, isMobile && styles.markAllBtnMobile]} onPress={onMarkAllRead}>
              <CheckCheck color="#004d3d" size={16} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#004d3d" size="small" />
              <Text style={styles.emptyText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Radio color="#ccfd3a" size={32} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>Shipment booking, transit, delivery, and support updates will appear here.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {notifications.map((notification) => {
                const isUnread = notification.status === 'unread';
                return (
                  <Pressable
                    key={notification.id}
                    style={[styles.card, isUnread && styles.cardUnread]}
                    onPress={() => onOpenNotification(notification)}
                  >
                    <View style={styles.cardIcon}>
                      <Package color="#004d3d" size={16} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle}>{notification.title}</Text>
                        {isUnread ? <View style={styles.unreadDot} /> : null}
                      </View>
                      <Text style={styles.cardText}>{notification.body}</Text>
                      <View style={styles.cardMeta}>
                        <Text style={styles.cardDate}>{formatDate(notification.created_at)}</Text>
                        {notification.action_label ? <Text style={styles.cardAction}>{notification.action_label}</Text> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 92,
    paddingRight: 28,
    paddingBottom: 24,
  },
  overlayMobile: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    paddingTop: 24,
    paddingRight: 12,
    paddingLeft: 12,
    paddingBottom: 100,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
  },
  sheetMobile: {
    maxWidth: '100%',
    maxHeight: '78%',
    borderRadius: 18,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  title: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111' },
  subtitle: { fontFamily: 'Outfit_4', fontSize: 12, color: '#6b7280' },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  markAllBtnMobile: {
    alignSelf: 'flex-start',
  },
  markAllText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111' },
  emptyText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  list: { gap: 12, paddingBottom: 4 },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardUnread: { backgroundColor: '#f7fee7', borderColor: '#d9f99d' },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(204,253,58,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardBody: { flex: 1, gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontFamily: 'Outfit_7', fontSize: 14, color: '#111', flex: 1 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444' },
  cardText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#4b5563', lineHeight: 19 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardDate: { fontFamily: 'Outfit_4', fontSize: 12, color: '#9ca3af' },
  cardAction: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
});
