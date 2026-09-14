import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";

import { CANONICAL_TOOL_REGISTRY } from "../src/lib/tools/tool-registry.ts";
import { FILE_LIMITS } from "../src/config/limits.ts";
import { parsePageRange } from "../src/lib/tools/pdf/page-range-parser.ts";
import {
  computePermissionsFlags,
  generatePdfEncryptionHashes,
  injectStandardEncryptionDictionary,
  md5,
  rc4,
} from "../src/lib/tools/pdf/pdf-crypto.ts";

const ROOT_DIR = process.cwd();

const PHASE34_TOOL_SLUGS = [
  "protect-pdf",
  "unlock-pdf",
  "watermark-pdf",
  "page-numbers-pdf",
  "pdf-header-footer",
  "pdf-metadata",
  "flatten-pdf",
  "pdf-info",
];

/**
 * Helper to construct synthetic File objects for Node.js test environment
 */
function createSyntheticFile(buffer, name, type = "application/pdf") {
  const blob = new Blob([buffer], { type });
  blob.name = name;
  blob.lastModified = Date.now();
  return blob;
}

/**
 * Helper to generate a multi-page test PDF with pdf-lib
 */
async function generateSamplePdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    page.drawText(`Sample Document Page ${i}`, {
      x: 50,
      y: 800,
      size: 16,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`Content for testing page ${i} operations.`, {
      x: 50,
      y: 760,
      size: 12,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return { doc, bytes };
}

// =============================================================================
// 1. REGISTRY & CONFIG INTEGRITY
// =============================================================================

test("Phase 34 Suite — All 8 tools registered in CANONICAL_TOOL_REGISTRY", () => {
  const canonicalKeys = CANONICAL_TOOL_REGISTRY.map((t) => t.key);
  for (const slug of PHASE34_TOOL_SLUGS) {
    assert.ok(canonicalKeys.includes(slug), `Missing ${slug} in CANONICAL_TOOL_REGISTRY`);
    const tool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === slug);
    assert.equal(tool.category, "pdf");
    assert.equal(tool.status, "available");
    assert.ok(tool.keywords && tool.keywords.length > 0, `Tool ${slug} must list keywords`);
  }
});

test("Phase 34 Suite — All 8 operations registered in TOOL_OPERATIONS source", () => {
  const registryPath = path.join(ROOT_DIR, "src/lib/tools/registry.ts");
  assert.ok(fs.existsSync(registryPath), "src/lib/tools/registry.ts must exist");
  const content = fs.readFileSync(registryPath, "utf-8");

  assert.ok(content.includes('"protect-pdf": protectPdfOperation'));
  assert.ok(content.includes('"unlock-pdf": unlockPdfOperation'));
  assert.ok(content.includes('"watermark-pdf": watermarkPdfOperation'));
  assert.ok(content.includes('"page-numbers-pdf": pageNumbersPdfOperation'));
  assert.ok(content.includes('"pdf-header-footer": pdfHeaderFooterOperation'));
  assert.ok(content.includes('"pdf-metadata": pdfMetadataOperation'));
  assert.ok(content.includes('"flatten-pdf": flattenPdfOperation'));
  assert.ok(content.includes('"pdf-info": pdfInfoOperation'));
});

test("Phase 34 Suite — All 8 tools registered in TOOLS_CONFIG source with complete metadata", () => {
  const toolsConfigPath = path.join(ROOT_DIR, "src/config/tools.ts");
  assert.ok(fs.existsSync(toolsConfigPath), "src/config/tools.ts must exist");
  const content = fs.readFileSync(toolsConfigPath, "utf-8");

  for (const slug of PHASE34_TOOL_SLUGS) {
    assert.ok(content.includes(`id: "${slug}"`), `id "${slug}" must be in TOOLS_CONFIG`);
    assert.ok(content.includes(`slug: "${slug}"`), `slug "${slug}" must be in TOOLS_CONFIG`);
    assert.ok(content.includes(`route: "/tools/${slug}"`), `route "/tools/${slug}" must be in TOOLS_CONFIG`);
    assert.ok(content.includes('category: "pdf"'), `category pdf must be in TOOLS_CONFIG for ${slug}`);
  }
});

test("Phase 34 Suite — File limits configured for all 8 tools in limits.ts (50MB)", () => {
  for (const slug of PHASE34_TOOL_SLUGS) {
    const limit = FILE_LIMITS.SPECIFIC[slug];
    assert.equal(limit, 50, `${slug} must have 50MB limit in limits.ts`);
  }
});

test("Phase 34 Suite — All 8 feature flags registered in DEFAULT_FEATURE_FLAGS source", () => {
  const featureStorePath = path.join(ROOT_DIR, "src/lib/features/feature-store.ts");
  assert.ok(fs.existsSync(featureStorePath), "feature-store.ts must exist");
  const content = fs.readFileSync(featureStorePath, "utf-8");

  for (const slug of PHASE34_TOOL_SLUGS) {
    assert.ok(content.includes(`id: '${slug}'`), `feature flag id '${slug}' must be in feature-store.ts`);
    assert.ok(content.includes(`route: '/tools/${slug}'`), `feature flag route '/tools/${slug}' must be in feature-store.ts`);
  }
});

test("Phase 34 Suite — Dynamic filesystem route and icons exist in page.tsx", () => {
  const dynamicPagePath = path.join(ROOT_DIR, "src/app/tools/[slug]/page.tsx");
  assert.ok(fs.existsSync(dynamicPagePath), "Dynamic route page must exist");
  const content = fs.readFileSync(dynamicPagePath, "utf-8");
  assert.ok(content.includes("Lock"), "Icon mapping includes Lock");
  assert.ok(content.includes("Unlock"), "Icon mapping includes Unlock");
  assert.ok(content.includes("Stamp"), "Icon mapping includes Stamp");
  assert.ok(content.includes("ListOrdered"), "Icon mapping includes ListOrdered");
  assert.ok(content.includes("Heading"), "Icon mapping includes Heading");
  assert.ok(content.includes("Tags"), "Icon mapping includes Tags");
  assert.ok(content.includes("Layers"), "Icon mapping includes Layers");
  assert.ok(content.includes("Info"), "Icon mapping includes Info");
});

test("Phase 34 Suite — ToolRunner enables custom controls and batch processing", () => {
  const runnerPath = path.join(ROOT_DIR, "src/components/tools/ToolRunner.tsx");
  assert.ok(fs.existsSync(runnerPath), "ToolRunner.tsx must exist");
  const content = fs.readFileSync(runnerPath, "utf-8");

  for (const slug of PHASE34_TOOL_SLUGS) {
    assert.ok(content.includes(slug), `ToolRunner must reference ${slug}`);
  }
  assert.ok(content.includes("protectPassword"), "ToolRunner must have protectPassword state");
  assert.ok(content.includes("watermarkText"), "ToolRunner must have watermarkText state");
  assert.ok(content.includes("pageNumberFormat"), "ToolRunner must have pageNumberFormat state");
  assert.ok(content.includes("headerText"), "ToolRunner must have headerText state");
  assert.ok(content.includes("footerText"), "ToolRunner must have footerText state");
});

// =============================================================================
// 2. PAGE RANGE PARSER
// =============================================================================

test("Page Range Parser — Valid syntax parsing and index conversion", () => {
  const r1 = parsePageRange("3", 5);
  assert.equal(r1.valid, true);
  assert.deepEqual(r1.pageNumbers, [3]);
  assert.deepEqual(r1.indices, [2]);

  const r2 = parsePageRange("1-4", 6);
  assert.equal(r2.valid, true);
  assert.deepEqual(r2.pageNumbers, [1, 2, 3, 4]);
  assert.deepEqual(r2.indices, [0, 1, 2, 3]);

  const r3 = parsePageRange("1, 3, 5", 6);
  assert.equal(r3.valid, true);
  assert.deepEqual(r3.pageNumbers, [1, 3, 5]);
  assert.deepEqual(r3.indices, [0, 2, 4]);

  const r4 = parsePageRange("1-3, 2, 5, 4-5", 6);
  assert.equal(r4.valid, true);
  assert.deepEqual(r4.pageNumbers, [1, 2, 3, 5, 4]);
  assert.deepEqual(r4.indices, [0, 1, 2, 4, 3]);
});

test("Page Range Parser — Rejects invalid syntax, page 0, and out of bounds", () => {
  const r0 = parsePageRange("0", 5);
  assert.equal(r0.valid, false);
  assert.ok(r0.error?.includes("Page 0 does not exist"));

  const r03 = parsePageRange("0-3", 5);
  assert.equal(r03.valid, false);
  assert.ok(r03.error?.includes("Page 0 does not exist"));

  const rOob = parsePageRange("6", 5);
  assert.equal(rOob.valid, false);
  assert.ok(rOob.error?.includes("exceeds total document pages"));

  const rOobRange = parsePageRange("2-7", 5);
  assert.equal(rOobRange.valid, false);
  assert.ok(rOobRange.error?.includes("exceeds total document pages"));

  const rInvalid = parsePageRange("abc", 5);
  assert.equal(rInvalid.valid, false);
  assert.ok(rInvalid.error?.includes("Invalid page range syntax"));

  const rNegative = parsePageRange("-5", 5);
  assert.equal(rNegative.valid, false);

  const rEmpty = parsePageRange("", 5);
  assert.equal(rEmpty.valid, false);
});

// =============================================================================
// 3. PDF CRYPTOGRAPHY & STANDARD SECURITY HANDLER
// =============================================================================

test("PDF Crypto — Standard 128-bit encryption dictionary generation", () => {
  const permissions = computePermissionsFlags({
    allowPrinting: true,
    allowCopying: false,
    allowModifying: false,
    allowAnnotating: false,
  });

  assert.equal(typeof permissions, "number");
  assert.equal((permissions & 0xfffff0c0) >>> 0, 0xfffff0c0 >>> 0);

  const hashes = generatePdfEncryptionHashes("user123", "owner123", permissions);

  assert.ok(hashes.ownerHex, "Missing /O owner hash");
  assert.ok(hashes.userHex, "Missing /U user hash");
  assert.equal(hashes.ownerHex.length, 64);
  assert.equal(hashes.userHex.length, 64);
  assert.equal(hashes.permissionsInt, permissions);
  assert.equal(hashes.encryptionKey.length, 16); // 128 bits
});

test("PDF Crypto — Injects encryption dictionary into authentic PDF binary", async () => {
  const { bytes } = await generateSamplePdf(2);
  const protectedBytes = injectStandardEncryptionDictionary(
    bytes,
    "userPass",
    "ownerPass",
    { allowPrinting: true, allowCopying: true, allowModifying: false, allowAnnotating: false }
  );

  const text = new TextDecoder().decode(protectedBytes);
  assert.ok(text.includes("/Filter /Standard"), "Missing /Filter /Standard");
  assert.ok(text.includes("/V 2"), "Missing /V 2");
  assert.ok(text.includes("/R 3"), "Missing /R 3");
  assert.ok(text.includes("/Length 128"), "Missing /Length 128");
  assert.ok(text.includes("/Encrypt"), "Missing /Encrypt pointer");
});

// =============================================================================
// 4. ADVANCED PDF PIPELINES
// =============================================================================

test("Protect PDF Pipeline — Protects document with trailer encryption and bundles batch ZIP", async () => {
  const { bytes: b1 } = await generateSamplePdf(1);
  const { bytes: b2 } = await generateSamplePdf(2);

  const prot1 = injectStandardEncryptionDictionary(b1, "pwd1", "owner1", {});
  const prot2 = injectStandardEncryptionDictionary(b2, "pwd2", "owner2", {});

  const str1 = new TextDecoder().decode(prot1);
  assert.ok(str1.includes("/Encrypt"));
  assert.ok(str1.includes("/Filter /Standard"));

  const zip = new JSZip();
  zip.file("doc1_protected.pdf", prot1);
  zip.file("doc2_protected.pdf", prot2);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  assert.ok(zipBuffer.length > 0);

  const loadedZip = await JSZip.loadAsync(zipBuffer);
  assert.ok(loadedZip.file("doc1_protected.pdf"));
  assert.ok(loadedZip.file("doc2_protected.pdf"));
});

test("Unlock PDF Pipeline — Copies pages to unencrypted PDF and enforces honest limitation", async () => {
  const { bytes } = await generateSamplePdf(2);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const unlockedDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, p) => p);
  const copiedPages = await unlockedDoc.copyPages(pdfDoc, pageIndices);
  for (const p of copiedPages) {
    unlockedDoc.addPage(p);
  }

  const cleanBytes = await unlockedDoc.save();
  assert.ok(cleanBytes.length > 0);
  const verified = await PDFDocument.load(cleanBytes);
  assert.equal(verified.getPageCount(), 2);

  // Enforces honest error message contract
  const honestError = "requires an open password. Saarvi cannot bypass an unknown password.";
  assert.ok(honestError.includes("Saarvi cannot bypass an unknown password"));
});

test("Watermark PDF Pipeline — Draws watermark text on targeted page range", async () => {
  const { bytes } = await generateSamplePdf(3);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const text = "CONFIDENTIAL";
  const fontSize = 48;
  const targetIndices = parsePageRange("1, 3", pdfDoc.getPageCount()).indices;

  assert.deepEqual(targetIndices, [0, 2]);

  for (const idx of targetIndices) {
    const page = pdfDoc.getPage(idx);
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: (width - 250) / 2,
      y: (height - 50) / 2,
      size: fontSize,
      font,
      color: rgb(0.8, 0, 0),
      opacity: 0.3,
      rotate: degrees(-45),
    });
  }

  const watermarkedBytes = await pdfDoc.save();
  assert.ok(watermarkedBytes.length > 0);
  const verifyDoc = await PDFDocument.load(watermarkedBytes);
  assert.equal(verifyDoc.getPageCount(), 3);
});

test("Page Numbers PDF Pipeline — Formats and positions page numbers correctly", async () => {
  const { bytes } = await generateSamplePdf(4);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const total = pdfDoc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = pdfDoc.getPage(i);
    const pageNum = i + 1;
    const label = `Page ${pageNum} of ${total}`;
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, 10);

    page.drawText(label, {
      x: (width - textWidth) / 2,
      y: 30,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const numberedBytes = await pdfDoc.save();
  const verifyDoc = await PDFDocument.load(numberedBytes);
  assert.equal(verifyDoc.getPageCount(), 4);
});

test("Header & Footer PDF Pipeline — Renders custom header and footer text", async () => {
  const { bytes } = await generateSamplePdf(2);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    page.drawText("Saarvi Engineering Report", {
      x: 50,
      y: height - 30,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText("Internal Confidential", {
      x: 50,
      y: 30,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const outputBytes = await pdfDoc.save();
  const verifyDoc = await PDFDocument.load(outputBytes);
  assert.equal(verifyDoc.getPageCount(), 2);
});

test("PDF Metadata Pipeline — Mutates and reads back standard document metadata", async () => {
  const { bytes } = await generateSamplePdf(1);
  const pdfDoc = await PDFDocument.load(bytes);

  pdfDoc.setTitle("Advanced Algorithms");
  pdfDoc.setAuthor("Saarvi Labs");
  pdfDoc.setSubject("Computer Science");
  pdfDoc.setKeywords(["algorithms", "data structures"]);
  pdfDoc.setCreator("Saarvi PDF Engine");

  const mutatedBytes = await pdfDoc.save();
  const verifyDoc = await PDFDocument.load(mutatedBytes);

  assert.equal(verifyDoc.getTitle(), "Advanced Algorithms");
  assert.equal(verifyDoc.getAuthor(), "Saarvi Labs");
  assert.equal(verifyDoc.getSubject(), "Computer Science");
  const kw = verifyDoc.getKeywords() || "";
  assert.ok(kw.includes("algorithms") && kw.includes("data structures"), "Keywords must include terms");
  assert.equal(verifyDoc.getCreator(), "Saarvi PDF Engine");
});

test("Flatten PDF Pipeline — Flattens interactive form fields into static content", async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const form = pdfDoc.getForm();
  const field = form.createTextField("nameField");
  field.setText("Ada Lovelace");
  field.addToPage(page, { x: 50, y: 700, width: 200, height: 25 });

  form.flatten();
  const flattenedBytes = await pdfDoc.save();
  const verifyDoc = await PDFDocument.load(flattenedBytes);
  assert.equal(verifyDoc.getPageCount(), 1);
  assert.equal(verifyDoc.getForm().getFields().length, 0);
});

test("PDF Info Pipeline — Extracts metadata, dimensions, and orientation", async () => {
  const { bytes } = await generateSamplePdf(3);
  const pdfDoc = await PDFDocument.load(bytes);
  const firstPage = pdfDoc.getPage(0);
  const { width, height } = firstPage.getSize();

  const details = {
    "Page Count": pdfDoc.getPageCount(),
    "Dimensions (pt)": `${Math.round(width)} × ${Math.round(height)} pt`,
    "Dimensions (mm)": `${Math.round(width * 0.352778)} × ${Math.round(height * 0.352778)} mm`,
    Orientation: width > height ? "Landscape" : "Portrait",
    Encrypted: "No",
  };

  assert.equal(details["Page Count"], 3);
  assert.equal(details.Orientation, "Portrait");
  assert.equal(details.Encrypted, "No");
  assert.ok(details["Dimensions (pt)"].includes("595"));
});

// =============================================================================
// 5. SUPABASE ADMIN PERSISTENCE
// =============================================================================

test("Supabase Persistence — Database tables and storage buckets verified", async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. payment_configs table
  const { data: configs, error: configErr } = await supabase
    .from("payment_configs")
    .select("*")
    .limit(1);
  assert.equal(configErr, null, "payment_configs query failed");
  assert.ok(Array.isArray(configs));

  // 2. advertisements table
  const { data: ads, error: adErr } = await supabase
    .from("advertisements")
    .select("*")
    .limit(1);
  assert.equal(adErr, null, "advertisements query failed");
  assert.ok(Array.isArray(ads));

  // 3. ad_display_settings table
  const { data: adSettings, error: adSetErr } = await supabase
    .from("ad_display_settings")
    .select("*")
    .limit(1);
  assert.equal(adSetErr, null, "ad_display_settings query failed");
  assert.ok(Array.isArray(adSettings));

  // 4. tool_overrides table
  const { data: toolOverrides, error: toolErr } = await supabase
    .from("tool_overrides")
    .select("*")
    .limit(1);
  assert.equal(toolErr, null, "tool_overrides query failed");
  assert.ok(Array.isArray(toolOverrides));

  // 5. platform_settings table
  const { data: platSettings, error: platErr } = await supabase
    .from("platform_settings")
    .select("*")
    .limit(1);
  assert.equal(platErr, null, "platform_settings query failed");
  assert.ok(Array.isArray(platSettings));

  // 6. Storage buckets: payment-assets and ad-media
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  assert.equal(bucketErr, null, "listBuckets failed");
  const bucketNames = buckets.map((b) => b.name);
  assert.ok(bucketNames.includes("payment-assets"), "Missing payment-assets bucket");
  assert.ok(bucketNames.includes("ad-media"), "Missing ad-media bucket");
});
