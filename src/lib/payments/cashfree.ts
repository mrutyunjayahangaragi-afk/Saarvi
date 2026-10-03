import crypto from 'node:crypto';
import { getCashfreeConfig, isCashfreeConfigured } from '@/config/cashfree';

export interface CashfreeCustomerDetails {
  customerId: string;
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
}

export interface CreateCashfreeOrderParams {
  orderId: string;
  amountPaise: number; // in paise
  currency?: string; // default "INR"
  customer: CashfreeCustomerDetails;
  returnUrl: string;
  orderNote?: string;
}

export interface CashfreeOrderResult {
  orderId: string;
  paymentSessionId: string;
  orderStatus: string;
  cfOrderId?: string;
  environment: 'SANDBOX' | 'PRODUCTION';
}

export interface CashfreePaymentRecord {
  cfPaymentId: string;
  paymentStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'USER_DROPPED';
  paymentAmount: number; // in rupees
  paymentCurrency: string;
  paymentMethod: string;
  paymentTime?: string;
  paymentMessage?: string;
  gatewayResponse?: Record<string, unknown>;
}

export class CashfreeService {
  private static instance: CashfreeService | null = null;

  public static getInstance(): CashfreeService {
    if (!CashfreeService.instance) {
      CashfreeService.instance = new CashfreeService();
    }
    return CashfreeService.instance;
  }

  private getHeaders(): Record<string, string> {
    const config = getCashfreeConfig();
    if (!config.appId || !config.secretKey) {
      throw new Error('Cashfree credentials are not configured in environment.');
    }
    return {
      'x-client-id': config.appId,
      'x-client-secret': config.secretKey,
      'x-api-version': config.apiVersion,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Creates a Cashfree order via the PG Orders API v3
   */
  public async createOrder(params: CreateCashfreeOrderParams): Promise<CashfreeOrderResult> {
    const config = getCashfreeConfig();
    const amountRupees = params.amountPaise / 100;

    // Normalize customer phone to 10 digits if present, or provide standard fallback
    let cleanPhone = (params.customer.customerPhone || '').replace(/\D/g, '');
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
    if (cleanPhone.length < 10) cleanPhone = '9999999999';

    const payload = {
      order_id: params.orderId,
      order_amount: amountRupees,
      order_currency: params.currency || 'INR',
      customer_details: {
        customer_id: params.customer.customerId,
        customer_email: params.customer.customerEmail,
        customer_phone: cleanPhone,
        customer_name: params.customer.customerName || 'Saarvi Student',
      },
      order_meta: {
        return_url: params.returnUrl,
      },
      order_note: params.orderNote || 'Saarvi Pro Plan Subscription',
    };

    const url = `${config.baseUrl}/orders`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || res.statusText;
      console.error('[Cashfree API Order Error]:', { status: res.status, error: errorMsg });
      throw new Error(`Failed to create Cashfree order: ${errorMsg}`);
    }

    if (!data.payment_session_id) {
      throw new Error('Cashfree response did not include a valid payment_session_id.');
    }

    return {
      orderId: data.order_id || params.orderId,
      paymentSessionId: data.payment_session_id,
      orderStatus: data.order_status || 'ACTIVE',
      cfOrderId: data.cf_order_id ? String(data.cf_order_id) : undefined,
      environment: config.environment,
    };
  }

  /**
   * Fetches the order status from Cashfree
   */
  public async getOrder(orderId: string): Promise<Record<string, unknown>> {
    const config = getCashfreeConfig();
    const url = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data?.message || res.statusText;
      throw new Error(`Failed to fetch Cashfree order (${res.status}): ${errorMsg}`);
    }

    return data;
  }

  /**
   * Fetches actual payments for an order to inspect payment method and transaction ID
   */
  public async getOrderPayments(orderId: string): Promise<CashfreePaymentRecord[]> {
    const config = getCashfreeConfig();
    const url = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json().catch(() => []);
    if (!Array.isArray(data)) return [];

    return data.map((item: Record<string, unknown>) => {
      let method = 'UNKNOWN';
      if (item.payment_group) {
        method = String(item.payment_group);
      } else if (item.payment_method && typeof item.payment_method === 'object') {
        method = Object.keys(item.payment_method)[0] || 'UNKNOWN';
      }

      return {
        cfPaymentId: String(item.cf_payment_id || item.payment_id || ''),
        paymentStatus: (String(item.payment_status || '').toUpperCase() as CashfreePaymentRecord['paymentStatus']) || 'PENDING',
        paymentAmount: Number(item.payment_amount || 0),
        paymentCurrency: String(item.payment_currency || 'INR'),
        paymentMethod: method,
        paymentTime: item.payment_time ? String(item.payment_time) : undefined,
        paymentMessage: item.payment_message ? String(item.payment_message) : undefined,
        gatewayResponse: item,
      };
    });
  }

  /**
   * Verifies the cryptographic HMAC SHA256 signature on an incoming Cashfree webhook
   */
  public verifyWebhookSignature(
    rawBody: string,
    signature: string,
    timestamp: string
  ): boolean {
    const config = getCashfreeConfig();
    if (!config.secretKey || !signature || !timestamp || !rawBody) {
      return false;
    }

    try {
      const signatureData = `${timestamp}${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.secretKey)
        .update(signatureData)
        .digest('base64');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (err) {
      console.error('[Cashfree Webhook Signature Verification Error]:', err);
      return false;
    }
  }

  /**
   * Issues a refund through Cashfree PG Refund API
   */
  public async createRefund(orderId: string, refundAmountRupees: number, refundNote?: string): Promise<Record<string, unknown>> {
    const config = getCashfreeConfig();
    const refundId = `saarvi_ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const url = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}/refunds`;

    const payload = {
      refund_amount: refundAmountRupees,
      refund_id: refundId,
      refund_note: refundNote || 'Admin initiated refund from Saarvi',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Refund failed (${res.status}): ${data?.message || res.statusText}`);
    }

    return data;
  }
}
