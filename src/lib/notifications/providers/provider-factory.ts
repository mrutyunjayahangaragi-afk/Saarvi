import { NotificationEmailProvider, TransactionalEmailProvider } from './email-provider';
import { NotificationWhatsAppProvider, WhatsAppCloudApiProvider } from './whatsapp-provider';

class ProviderFactory {
  private emailProvider: NotificationEmailProvider;
  private whatsAppProvider: NotificationWhatsAppProvider;

  constructor() {
    this.emailProvider = new TransactionalEmailProvider();
    this.whatsAppProvider = new WhatsAppCloudApiProvider();
  }

  public getEmailProvider(): NotificationEmailProvider {
    return this.emailProvider;
  }

  public getWhatsAppProvider(): NotificationWhatsAppProvider {
    return this.whatsAppProvider;
  }

  public setEmailProvider(provider: NotificationEmailProvider): void {
    this.emailProvider = provider;
  }

  public setWhatsAppProvider(provider: NotificationWhatsAppProvider): void {
    this.whatsAppProvider = provider;
  }

  public resetDefaults(): void {
    this.emailProvider = new TransactionalEmailProvider();
    this.whatsAppProvider = new WhatsAppCloudApiProvider();
  }
}

export const providerFactory = new ProviderFactory();
