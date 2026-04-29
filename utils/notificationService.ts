import { supabase } from '../supabase';

export type CustomerNotificationRecord = {
  id: string;
  customer_id: string;
  shipment_id: string | null;
  title: string;
  body: string;
  notification_type: 'general' | 'shipment' | 'payment' | 'support' | 'marketing';
  status: 'unread' | 'read';
  action_label: string | null;
  action_target: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
  updated_at: string;
};

export type SupportTicketInput = {
  customerId: string;
  trackingId?: string;
  subject: string;
  issueDescription: string;
  preferredChannel?: 'email' | 'phone';
  email?: string;
  phoneNumber?: string;
};

export async function fetchCustomerNotifications(customerId: string, limit = 20) {
  const { data, error } = await supabase
    .from('customer_notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CustomerNotificationRecord[];
}

export async function countUnreadNotifications(customerId: string) {
  const { count, error } = await supabase
    .from('customer_notifications')
    .select('*', { head: true, count: 'exact' })
    .eq('customer_id', customerId)
    .eq('status', 'unread');

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('customer_notifications')
    .update({
      status: 'read',
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(customerId: string) {
  const { error } = await supabase
    .from('customer_notifications')
    .update({
      status: 'read',
      read_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId)
    .eq('status', 'unread');

  if (error) throw error;
}

export async function submitSupportTicket(input: SupportTicketInput) {
  const payload = {
    customer_id: input.customerId,
    tracking_id: input.trackingId?.trim() || null,
    subject: input.subject.trim(),
    issue_description: input.issueDescription.trim(),
    preferred_channel: input.preferredChannel || 'email',
    email: input.email?.trim() || null,
    phone_number: input.phoneNumber?.trim() || null,
  };

  const { data, error } = await supabase
    .from('support_tickets')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  const { error: notificationError } = await supabase.from('customer_notifications').insert({
    customer_id: input.customerId,
    title: 'Support ticket received',
    body: `We logged your support request${payload.tracking_id ? ` for ${payload.tracking_id}` : ''}. Our team will follow up through ${payload.preferred_channel}.`,
    notification_type: 'support',
    action_label: payload.tracking_id ? 'Track shipment' : null,
    action_target: payload.tracking_id || null,
    metadata: {
      support_ticket_id: data.id,
      preferred_channel: payload.preferred_channel,
      tracking_id: payload.tracking_id,
    },
  });

  if (notificationError) throw notificationError;

  return data;
}
