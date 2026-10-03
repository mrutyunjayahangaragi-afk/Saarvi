// DocEase Phase 15: Centralized Environment Validation & Production Config Guards
// Categorizes all environment variables and prevents invalid or insecure deployments.

export type EnvCategory = 'PUBLIC' | 'SERVER_ONLY' | 'BUILD_TIME' | 'OPTIONAL' | 'REQUIRED_IN_PRODUCTION';

export interface EnvVariableSpec {
  name: string;
  category: EnvCategory;
  description: string;
  isSecret: boolean;
}

export const ENV_SPECS: Record<string, EnvVariableSpec> = {
  // Public
  NEXT_PUBLIC_SUPABASE_URL: {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    category: 'REQUIRED_IN_PRODUCTION',
    description: 'Supabase project endpoint URL for auth and client queries',
    isSecret: false,
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    category: 'REQUIRED_IN_PRODUCTION',
    description: 'Supabase anonymous/public API key',
    isSecret: false,
  },
  NEXT_PUBLIC_CASHFREE_MODE: {
    name: 'NEXT_PUBLIC_CASHFREE_MODE',
    category: 'OPTIONAL',
    description: 'Cashfree Web SDK mode ("sandbox" or "production")',
    isSecret: false,
  },

  // Server-Only Cashfree PG
  CASHFREE_APP_ID: {
    name: 'CASHFREE_APP_ID',
    category: 'REQUIRED_IN_PRODUCTION',
    description: 'Cashfree PG Application ID',
    isSecret: false,
  },
  CASHFREE_SECRET_KEY: {
    name: 'CASHFREE_SECRET_KEY',
    category: 'REQUIRED_IN_PRODUCTION',
    description: 'Cashfree PG Secret Key used for HMAC webhook verification and orders API',
    isSecret: true,
  },
  CASHFREE_API_VERSION: {
    name: 'CASHFREE_API_VERSION',
    category: 'OPTIONAL',
    description: 'Cashfree PG API Version (default: 2023-08-01)',
    isSecret: false,
  },
  CASHFREE_ENVIRONMENT: {
    name: 'CASHFREE_ENVIRONMENT',
    category: 'REQUIRED_IN_PRODUCTION',
    description: 'Cashfree PG Environment ("SANDBOX" or "PRODUCTION")',
    isSecret: false,
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    category: 'OPTIONAL',
    description: 'Supabase service role secret for server administrative overrides',
    isSecret: true,
  },

  // Transactional Email (Gmail SMTP)
  EMAIL_PROVIDER: {
    name: 'EMAIL_PROVIDER',
    category: 'OPTIONAL',
    description: 'Active email provider ("gmail" or "resend")',
    isSecret: false,
  },
  SMTP_HOST: {
    name: 'SMTP_HOST',
    category: 'OPTIONAL',
    description: 'SMTP server hostname (default: smtp.gmail.com)',
    isSecret: false,
  },
  SMTP_PORT: {
    name: 'SMTP_PORT',
    category: 'OPTIONAL',
    description: 'SMTP port (default: 465)',
    isSecret: false,
  },
  SMTP_SECURE: {
    name: 'SMTP_SECURE',
    category: 'OPTIONAL',
    description: 'Use TLS/SSL for SMTP connection (default: true)',
    isSecret: false,
  },
  SMTP_USER: {
    name: 'SMTP_USER',
    category: 'OPTIONAL',
    description: 'Gmail SMTP username/email address',
    isSecret: false,
  },
  SMTP_PASS: {
    name: 'SMTP_PASS',
    category: 'OPTIONAL',
    description: 'Google App Password for SMTP authentication',
    isSecret: true,
  },
  EMAIL_FROM_EMAIL: {
    name: 'EMAIL_FROM_EMAIL',
    category: 'OPTIONAL',
    description: 'Sender email address for outgoing transactional notifications',
    isSecret: false,
  },
  EMAIL_FROM_NAME: {
    name: 'EMAIL_FROM_NAME',
    category: 'OPTIONAL',
    description: 'Sender display name for outgoing emails',
    isSecret: false,
  },

  // AI & OCR Document Intelligence
  AI_PROVIDER: {
    name: 'AI_PROVIDER',
    category: 'OPTIONAL',
    description: 'AI model provider ("gemini" or "openrouter")',
    isSecret: false,
  },
  AI_API_KEY: {
    name: 'AI_API_KEY',
    category: 'OPTIONAL',
    description: 'API key for text AI model provider',
    isSecret: true,
  },
  AI_TEXT_MODEL: {
    name: 'AI_TEXT_MODEL',
    category: 'OPTIONAL',
    description: 'Model identifier for AI text generation',
    isSecret: false,
  },
  OCR_PROVIDER: {
    name: 'OCR_PROVIDER',
    category: 'OPTIONAL',
    description: 'OCR processing provider ("gemini")',
    isSecret: false,
  },
  OCR_API_KEY: {
    name: 'OCR_API_KEY',
    category: 'OPTIONAL',
    description: 'API key for OCR visual extraction',
    isSecret: true,
  },
  OPENROUTER_API_KEY: {
    name: 'OPENROUTER_API_KEY',
    category: 'OPTIONAL',
    description: 'API key for OpenRouter AI routing',
    isSecret: true,
  },

  // WhatsApp Cloud API
  WHATSAPP_API_TOKEN: {
    name: 'WHATSAPP_API_TOKEN',
    category: 'OPTIONAL',
    description: 'Meta Graph API access token for WhatsApp messages',
    isSecret: true,
  },
  WHATSAPP_PHONE_NUMBER_ID: {
    name: 'WHATSAPP_PHONE_NUMBER_ID',
    category: 'OPTIONAL',
    description: 'Meta registered Phone Number ID for WhatsApp dispatch',
    isSecret: false,
  },
};

export interface EnvironmentValidationResult {
  valid: boolean;
  environment: 'development' | 'preview' | 'production' | 'test';
  errors: string[];
  warnings: string[];
  billingConfigured: boolean;
  isProductionReady: boolean;
}

/**
 * Validates the runtime environment against Phase 15 production rules.
 * Does NOT crash free document tools if optional billing is unconfigured in development.
 */
export function validateEnvironment(env: Record<string, string | undefined> = process.env): EnvironmentValidationResult {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const vercelEnv = (env.VERCEL_ENV || '').toLowerCase();
  const isProduction = nodeEnv === 'production' || vercelEnv === 'production';
  const isPreview = vercelEnv === 'preview';
  const isTest = nodeEnv === 'test';

  const errors: string[] = [];
  const warnings: string[] = [];

  const cfAppId = env.CASHFREE_APP_ID || '';
  const cfSecretKey = env.CASHFREE_SECRET_KEY || '';
  const cfEnv = (env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();

  const billingConfigured = Boolean(cfAppId && cfSecretKey);

  // 1. Production Config Guards (Cashfree Only)
  if (isProduction) {
    if (cfEnv !== 'PRODUCTION') {
      errors.push('CRITICAL: CASHFREE_ENVIRONMENT must be set to PRODUCTION in production.');
    }

    if (!cfAppId) {
      errors.push('Missing required production variable: CASHFREE_APP_ID.');
    }

    if (!cfSecretKey) {
      errors.push('Missing required production variable: CASHFREE_SECRET_KEY.');
    }
  } else if (!isTest) {
    // Development / Preview warnings
    if (!billingConfigured) {
      warnings.push(
        'Billing is unconfigured or partially configured. Free document tools remain fully operational.'
      );
    }
    if (cfEnv === 'PRODUCTION') {
      warnings.push(
        'Warning: CASHFREE_ENVIRONMENT=PRODUCTION configured in non-production environment.'
      );
    }
  }

  // 2. Client-Bundle Secret Leak Prevention (Section 3)
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('NEXT_PUBLIC_') && (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('SERVICE_ROLE'))) {
      errors.push(`SECURITY VIOLATION: Secret variable "${key}" has NEXT_PUBLIC_ prefix and will leak to browser bundles.`);
    }
  }

  const currentEnv = isProduction ? 'production' : isPreview ? 'preview' : isTest ? 'test' : 'development';

  return {
    valid: errors.length === 0,
    environment: currentEnv,
    errors,
    warnings,
    billingConfigured,
    isProductionReady: errors.length === 0 && billingConfigured && isProduction,
  };
}

/**
 * Returns safe environment overview without leaking secret values.
 */
export function getSafeEnvironmentStatus(): {
  environment: string;
  billingProvider: string;
  isConfigured: boolean;
  hasPublicRzpKey: boolean;
  hasServerRzpKey: boolean;
  hasWebhookSecret: boolean;
  hasPlansConfigured: boolean;
} {
  const env = process.env;
  return {
    environment: env.NODE_ENV || 'development',
    billingProvider: env.BILLING_PROVIDER || 'razorpay',
    isConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET),
    hasPublicRzpKey: Boolean(env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
    hasServerRzpKey: Boolean(env.RAZORPAY_KEY_ID),
    hasWebhookSecret: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
    hasPlansConfigured: Boolean(env.RAZORPAY_PRO_MONTHLY_PLAN_ID && env.RAZORPAY_PRO_YEARLY_PLAN_ID),
  };
}

/**
 * Sanitizes an object or environment record for safe logging, redacting all secrets and credentials.
 */
export function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const upperKey = k.toUpperCase();
    const isKnownSecret = ENV_SPECS[k]?.isSecret;
    const isSensitiveName =
      upperKey.includes('SECRET') ||
      upperKey.includes('PASS') ||
      upperKey.includes('TOKEN') ||
      upperKey.includes('CREDENTIAL') ||
      upperKey.includes('PRIVATE') ||
      (upperKey.includes('KEY') && !upperKey.startsWith('NEXT_PUBLIC_'));

    if (isKnownSecret || isSensitiveName) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = v;
    }
  }
  return result;
}

