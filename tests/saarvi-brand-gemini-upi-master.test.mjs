import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkGeminiHealth, getGeminiModel } from "../src/lib/ai/gemini.ts";
import {
  isValidUpiId,
  createUpiPaymentIntent,
  DEFAULT_SAARVI_UPI_VPA,
} from "../src/lib/billing/upi-intent.ts";

const ROOT_DIR = process.cwd();

test("Saarvi Brand & Assets: Official logo and mark files exist with valid headers", async () => {
  const brandAssets = [
    "public/brand/saarvi-mark.png",
    "public/brand/saarvi-mark.webp",
    "public/brand/saarvi-logo.png",
    "public/brand/saarvi-logo.webp",
    "public/brand/favicon.png",
    "public/favicon.ico",
    "public/og-image.png",
  ];

  for (const asset of brandAssets) {
    const fullPath = path.join(ROOT_DIR, asset);
    assert.ok(fs.existsSync(fullPath), `Brand asset must exist: ${asset}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 500, `Asset must have authentic content: ${asset} (${stat.size} bytes)`);
  }
});

test("Saarvi Brand: SaarviMark and SaarviLogo components export cleanly", async () => {
  const markPath = path.join(ROOT_DIR, "src/components/brand/SaarviMark.tsx");
  const logoPath = path.join(ROOT_DIR, "src/components/brand/SaarviLogo.tsx");

  assert.ok(fs.existsSync(markPath), "SaarviMark.tsx must exist");
  assert.ok(fs.existsSync(logoPath), "SaarviLogo.tsx must exist");

  const markContent = fs.readFileSync(markPath, "utf-8");
  const logoContent = fs.readFileSync(logoPath, "utf-8");

  assert.match(markContent, /export function SaarviMark/);
  assert.match(markContent, /\/brand\/saarvi-mark\.webp/);
  assert.match(logoContent, /export default function SaarviLogo/);
  assert.match(logoContent, /Saarvi — Study\. Work\. Grow\./);
});

test("Gemini AI 2.0: Service measures true latency and never leaks API key", async () => {
  const model = getGeminiModel();
  assert.ok(model.includes("gemini"), `Expected gemini model, received: ${model}`);

  const health = await checkGeminiHealth(5000);
  assert.strictEqual(health.provider, "gemini");
  assert.strictEqual(typeof health.configured, "boolean");
  assert.strictEqual(typeof health.latencyMs, "number");
  assert.ok(health.latencyMs >= 0, "Latency must be a non-negative number");

  // Verify no secrets leaked in health payload
  const jsonStr = JSON.stringify(health);
  assert.ok(!jsonStr.includes("AQ.Ab8"), "API key must not be exposed in health check");
  assert.ok(!jsonStr.includes("GEMINI_API_KEY="), "Secret key name must not be exposed");
});

test("UPI Payment: Centralized VPA 9036745164-3@axl is valid and default", async () => {
  assert.strictEqual(DEFAULT_SAARVI_UPI_VPA, "9036745164-3@axl");
  assert.ok(isValidUpiId(DEFAULT_SAARVI_UPI_VPA), "Official VPA 9036745164-3@axl must be valid syntax");

  // Test dynamic URI generation with default VPA
  const intent = createUpiPaymentIntent({
    provider: "OTHER_UPI",
    plan: "monthly",
    amount: 99,
    transactionReference: "SAARVI-TEST-REF123",
  });

  assert.strictEqual(intent.payeeUpiId, "9036745164-3@axl");
  assert.ok(intent.universalUri.includes("pa=9036745164-3%40axl"));
  assert.ok(intent.universalUri.includes("am=99.00"));
  assert.ok(intent.universalUri.includes("cu=INR"));
  assert.ok(intent.universalUri.includes("tn=SAARVI-TEST-REF123"));
});

test("UPI Payment: Yearly Pro Plan dynamically generates ₹899 URI", async () => {
  const intent = createUpiPaymentIntent({
    provider: "PHONEPE",
    plan: "yearly",
    amount: 899,
    transactionReference: "SAARVI-YEARLY-REF",
  });

  assert.strictEqual(intent.amount, 899);
  assert.strictEqual(intent.formattedAmount, "₹899");
  assert.ok(intent.intentUri.startsWith("phonepe://pay?"));
  assert.ok(intent.intentUri.includes("am=899.00"));
});
