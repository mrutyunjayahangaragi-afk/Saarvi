export type NotificationCategory =
  | 'ANNOUNCEMENT'
  | 'OFFER'
  | 'FEATURE_UPDATE'
  | 'MAINTENANCE'
  | 'INTERVIEW'
  | 'ACADEMIC'
  | 'CAREER'
  | 'SCHOLARSHIP'
  | 'SYSTEM'
  | 'REMINDER'
  | 'PROMOTION'
  | 'CUSTOM';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type NotificationAudienceType =
  | 'ALL_USERS'
  | 'SELECTED_USERS'
  | 'FREE_USERS'
  | 'PRO_USERS'
  | 'VERIFIED_USERS'
  | 'UNVERIFIED_USERS'
  | 'ADMINS'
  | 'CUSTOM_SEGMENT';

export type NotificationDeliveryChannel = 'in_app' | 'email';

export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'READ'
  | 'CLICKED'
  | 'FAILED';

export type NotificationStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'CANCELLED'
  | 'FAILED';

export interface NotificationAudienceDefinition {
  userIds?: string[];
  plan?: 'FREE' | 'PRO';
  verifiedOnly?: boolean;
  unverifiedOnly?: boolean;
  role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  customFilter?: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  created_by: string;
  created_by_email?: string;
  type: string;
  category: NotificationCategory;
  title: string;
  subtitle?: string;
  body: string;
  logo_url?: string;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
  secondary_url?: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  audience_type: NotificationAudienceType;
  audience_definition: NotificationAudienceDefinition;
  channels: NotificationDeliveryChannel[];
  created_at: string;
  scheduled_at?: string;
  sent_at?: string;
  expires_at?: string;
  recipient_count?: number;
}

export interface NotificationRecipientRecord {
  id: string;
  notification_id: string;
  user_id: string;
  recipient_email?: string;
  delivery_status: NotificationDeliveryStatus;
  channel: NotificationDeliveryChannel;
  idempotency_key: string;
  delivered_at?: string;
  read_at?: string;
  clicked_at?: string;
  failed_at?: string;
  failure_reason?: string;
}

export interface NotificationTemplateRecord {
  id: string;
  name: string;
  type: string;
  subject?: string;
  title: string;
  body: string;
  cta_text?: string;
  cta_url?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceRecord {
  user_id: string;
  category: NotificationCategory;
  enabled: boolean;
  updated_at: string;
}

export interface NotificationSystemSettings {
  id: string;
  global_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  max_broadcast_size: number;
  require_superadmin_approval: boolean;
  promotional_email_enabled: boolean;
  default_sender_name: string;
  rate_limit_per_hour: number;
  updated_at: string;
  updated_by?: string;
}

export interface NotificationAuditLogRecord {
  id: string;
  notification_id?: string;
  actor_user_id: string;
  action:
    | 'NOTIFICATION_CREATED'
    | 'NOTIFICATION_UPDATED'
    | 'NOTIFICATION_PREVIEWED'
    | 'NOTIFICATION_SCHEDULED'
    | 'NOTIFICATION_SENT'
    | 'NOTIFICATION_CANCELLED'
    | 'NOTIFICATION_RETRIED'
    | 'NOTIFICATION_TEMPLATE_CREATED'
    | 'NOTIFICATION_TEMPLATE_UPDATED'
    | 'NOTIFICATION_SETTINGS_CHANGED';
  recipient_count?: number;
  target_type?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface NotificationAnalyticsSummary {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  failureRate: number;
}

export interface CreateBroadcastPayload {
  category: NotificationCategory;
  type?: string;
  title: string;
  subtitle?: string;
  body: string;
  logo_url?: string;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
  priority?: NotificationPriority;
  audience_type: NotificationAudienceType;
  audience_definition?: NotificationAudienceDefinition;
  channels: NotificationDeliveryChannel[];
  sendNow: boolean;
  scheduled_at?: string;
  expires_at?: string;
  isDraft?: boolean;
}
