// Saarvi Cashfree Production Configuration
// Server-authoritative environment detection and gateway endpoints.

export type CashfreeEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface CashfreeConfig {
  appId: string;
  secretKey: string;
  apiVersion: string;
  environment: CashfreeEnvironment;
  baseUrl: string;
}

export function getCashfreeConfig(): CashfreeConfig {
  const appId = process.env.CASHFREE_APP_ID || '';
  const secretKey = process.env.CASHFREE_SECRET_KEY || '';
  const apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';
  
  // Environment resolution: defaults to SANDBOX in development/test, PRODUCTION when configured
  const envRaw = (process.env.CASHFREE_ENVIRONMENT || '').toUpperCase();
  const environment: CashfreeEnvironment =
    envRaw === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';

  const baseUrl =
    environment === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

  return {
    appId,
    secretKey,
    apiVersion,
    environment,
    baseUrl,
  };
}

export function isCashfreeConfigured(): boolean {
  const config = getCashfreeConfig();
  return Boolean(config.appId && config.secretKey);
}
