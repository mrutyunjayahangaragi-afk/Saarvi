import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidQrUrl, resolvePaymentQrImage } from '../src/lib/billing/qr-resolver.ts';

test('QR Resolver - Unit Validation & Sanitization', async (t) => {
  await t.test('rejects empty, null, undefined, and whitespace', () => {
    assert.equal(isValidQrUrl(null), false);
    assert.equal(isValidQrUrl(undefined), false);
    assert.equal(isValidQrUrl(''), false);
    assert.equal(isValidQrUrl('   '), false);
    assert.equal(resolvePaymentQrImage(null), null);
    assert.equal(resolvePaymentQrImage(undefined), null);
    assert.equal(resolvePaymentQrImage(''), null);
    assert.equal(resolvePaymentQrImage('   '), null);
  });

  await t.test('strictly rejects temporary browser blob URLs', () => {
    const blob1 = 'blob:http://localhost:3000/d507ca2f-87a2-4a7b-a320-994df58d116c';
    const blob2 = 'blob:https://saarvi.in/82fe7e41-01f7-418c-bfa8-04f7623ce1b8';
    assert.equal(isValidQrUrl(blob1), false);
    assert.equal(isValidQrUrl(blob2), false);
    assert.equal(resolvePaymentQrImage(blob1), null);
    assert.equal(resolvePaymentQrImage(blob2), null);
  });

  await t.test('strictly rejects script and malformed protocols', () => {
    assert.equal(isValidQrUrl('javascript:alert(1)'), false);
    assert.equal(isValidQrUrl('vbscript:msgbox'), false);
    assert.equal(resolvePaymentQrImage('javascript:alert(1)'), null);
  });

  await t.test('resolves canonical Supabase storage paths correctly', () => {
    const path1 = 'qr-codes/saarvi-upi-qr.jpeg';
    assert.equal(isValidQrUrl(path1), true);
    const resolved1 = resolvePaymentQrImage(path1);
    assert.ok(resolved1?.includes('/storage/v1/object/public/payment-assets/qr-codes/saarvi-upi-qr.jpeg'));

    const path2 = 'payment-assets/qr-codes/saarvi-upi-qr.png';
    assert.equal(isValidQrUrl(path2), true);
    const resolved2 = resolvePaymentQrImage(path2);
    assert.ok(resolved2?.includes('/storage/v1/object/public/payment-assets/qr-codes/saarvi-upi-qr.png'));
  });

  await t.test('preserves full valid public https URLs', () => {
    const fullUrl = 'https://teeronvvkemqzfrbppjo.supabase.co/storage/v1/object/public/payment-assets/qr-codes/saarvi-upi-qr.jpeg';
    assert.equal(isValidQrUrl(fullUrl), true);
    assert.equal(resolvePaymentQrImage(fullUrl), fullUrl);
  });

  await t.test('appends cache-busting timestamp when requested for replacement freshness', () => {
    const path = 'qr-codes/saarvi-upi-qr.jpeg';
    const resolved = resolvePaymentQrImage(path, 1715000000);
    assert.ok(resolved?.endsWith('?t=1715000000') || resolved?.endsWith('&t=1715000000'));
  });

  await t.test('handles relative storage public paths', () => {
    const relPath = '/storage/v1/object/public/payment-assets/qr-codes/saarvi-upi-qr.png';
    assert.equal(isValidQrUrl(relPath), true);
    const resolved = resolvePaymentQrImage(relPath);
    assert.ok(resolved?.startsWith('https://'));
    assert.ok(resolved?.includes('/storage/v1/object/public/payment-assets/qr-codes/saarvi-upi-qr.png'));
  });
});

test('Payment Config & QR State Transitions', async (t) => {
  // Model payment configuration state transitions
  let config = {
    upiId: 'saarvi@okhdfcbank',
    qrImageUrl: 'qr-codes/saarvi-upi-qr.jpeg',
    monthlyPrice: 99,
    yearlyPrice: 899,
    manualUpiEnabled: true,
  };

  await t.test('active QR resolves to public URL for Admin and Checkout display', () => {
    const resolved = resolvePaymentQrImage(config.qrImageUrl);
    assert.ok(resolved);
    assert.ok(resolved.startsWith('https://'));
    assert.ok(resolved.includes('qr-codes/saarvi-upi-qr.jpeg'));
  });

  await t.test('updating general settings does NOT wipe out or nullify active QR code', () => {
    const generalSettingsUpdate = {
      monthlyPrice: 49,
      yearlyPrice: 399,
    };
    config = {
      ...config,
      ...generalSettingsUpdate,
    };
    assert.equal(config.monthlyPrice, 49);
    assert.equal(config.yearlyPrice, 399);
    assert.equal(config.qrImageUrl, 'qr-codes/saarvi-upi-qr.jpeg');
    assert.ok(resolvePaymentQrImage(config.qrImageUrl));
  });

  await t.test('replacing QR code generates clean fresh path and resolves immediately', () => {
    const timestamp = Date.now();
    const newStoragePath = `qr-codes/saarvi-upi-qr-${timestamp}.png`;
    config = {
      ...config,
      qrImageUrl: newStoragePath,
    };
    const freshResolved = resolvePaymentQrImage(config.qrImageUrl, timestamp);
    assert.ok(freshResolved?.includes(`saarvi-upi-qr-${timestamp}.png`));
    assert.ok(freshResolved?.includes(`t=${timestamp}`));
  });

  await t.test('removing custom QR resets to empty state and resolver returns null', () => {
    config = {
      ...config,
      qrImageUrl: null,
    };
    assert.equal(resolvePaymentQrImage(config.qrImageUrl), null);
  });
});
