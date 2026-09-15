import { DeliveryResult, ReminderEmailMessage } from '@/types/notifications';

export interface TransactionalEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export type EmailProviderStatus =
  | 'OPERATIONAL'
  | 'CONFIG_MISSING'
  | 'CONNECTION_FAILURE'
  | 'ERROR';

export interface EmailProviderHealth {
  status: EmailProviderStatus;
  message?: string;
  provider: string;
  configured: boolean;
  host?: string;
  port?: number;
  latencyMs?: number;
}

export interface NotificationEmailProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  checkHealth?(): Promise<EmailProviderHealth>;
  sendTransactionalEmail(options: TransactionalEmailOptions): Promise<DeliveryResult>;
  sendReminder(message: ReminderEmailMessage): Promise<DeliveryResult>;
}
