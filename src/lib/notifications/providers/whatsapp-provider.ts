import { DeliveryResult, ReminderWhatsAppMessage } from '@/types/notifications';

export interface NotificationWhatsAppProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  sendTemplateMessage(message: ReminderWhatsAppMessage): Promise<DeliveryResult>;
}

export class WhatsAppCloudApiProvider implements NotificationWhatsAppProvider {
  public id = 'whatsapp-cloud-api';
  public name = 'Official WhatsApp Cloud API';

  private apiToken: string | undefined;
  private phoneNumberId: string | undefined;
  private mockDeliveryInTest: boolean;

  constructor(options?: {
    apiToken?: string;
    phoneNumberId?: string;
    mockDeliveryInTest?: boolean;
  }) {
    this.apiToken = options?.apiToken ?? process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = options?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.mockDeliveryInTest = options?.mockDeliveryInTest ?? false;
  }

  public isConfigured(): boolean {
    return (Boolean(this.apiToken) && Boolean(this.phoneNumberId)) || this.mockDeliveryInTest;
  }

  public setMockDelivery(enabled: boolean): void {
    this.mockDeliveryInTest = enabled;
  }

  public async sendTemplateMessage(message: ReminderWhatsAppMessage): Promise<DeliveryResult> {
    const timestamp = new Date().toISOString();

    // Invariant: WhatsApp number format validation (E.164 without '+' or standard digits)
    const cleanedPhone = message.toPhone.replace(/[^0-9]/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      return {
        success: false,
        channel: 'whatsapp',
        status: 'FAILED',
        error: 'Invalid recipient phone number. Please provide a valid number with country code.',
        timestamp,
      };
    }

    // If configured with official Meta WhatsApp Cloud API credentials
    if (this.apiToken && this.phoneNumberId) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanedPhone,
              type: 'template',
              template: {
                name: message.templateName || 'saarvi_event_reminder',
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: message.parameters.eventType },
                      { type: 'text', text: message.parameters.eventTitle },
                      { type: 'text', text: message.parameters.scheduledTime },
                    ],
                  },
                ],
              },
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return {
            success: false,
            channel: 'whatsapp',
            status: 'FAILED',
            error: errData?.error?.message || `WhatsApp API error: HTTP ${response.status}`,
            timestamp,
          };
        }

        const data = await response.json();
        const msgId = data?.messages?.[0]?.id || `wa_${Date.now()}`;

        return {
          success: true,
          channel: 'whatsapp',
          status: 'SENT',
          providerMessageId: msgId,
          timestamp,
        };
      } catch (err) {
        return {
          success: false,
          channel: 'whatsapp',
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Network error communicating with WhatsApp API.',
          timestamp,
        };
      }
    }

    // Mock delivery mode for testing
    if (this.mockDeliveryInTest) {
      return {
        success: true,
        channel: 'whatsapp',
        status: 'SENT',
        providerMessageId: `mock_wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp,
      };
    }

    // Truthful unconfigured response
    return {
      success: false,
      channel: 'whatsapp',
      status: 'NOT_CONFIGURED',
      error: 'WhatsApp reminders are currently unavailable.',
      timestamp,
    };
  }
}
