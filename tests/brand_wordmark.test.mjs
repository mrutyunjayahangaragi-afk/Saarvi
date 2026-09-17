import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Engineered Brand Wordmark & Single S Mark Test Suite", () => {
  const rootDir = process.cwd();

  test("1. SaarviWordmark is pure vector SVG without raster PNG or JPG dependencies", () => {
    const wordmarkPath = path.join(rootDir, "src/components/brand/SaarviWordmark.tsx");
    assert.ok(fs.existsSync(wordmarkPath), "SaarviWordmark.tsx must exist");

    const code = fs.readFileSync(wordmarkPath, "utf8");
    assert.ok(code.includes("<svg"), "Must render vector SVG elements");
    assert.ok(!code.includes("<img"), "Must not contain raster <img> elements");
    assert.ok(!code.includes(".png"), "Must not reference .png files");
    assert.ok(!code.includes(".jpg"), "Must not reference .jpg files");
  });

  test("2. SaarviWordmark contains engineered geometry, gradient, and canonical typography", () => {
    const wordmarkPath = path.join(rootDir, "src/components/brand/SaarviWordmark.tsx");
    const code = fs.readFileSync(wordmarkPath, "utf8");

    // Engineered single S mark
    assert.ok(code.includes("EngineeredSingleSMark"), "Must export EngineeredSingleSMark");
    assert.ok(code.includes("#2563EB") || code.includes("#1D4ED8") || code.includes("#7C3AED"), "Must use brand vector gradient");
    assert.ok(code.includes("Saarvi"), "Must include brand name Saarvi");
    assert.ok(code.includes("Study. Work. Grow."), "Must include official tagline");
  });

  test("3. SaarviLogo component renders vector EngineeredSingleSMark instead of legacy raster images", () => {
    const logoPath = path.join(rootDir, "src/components/brand/SaarviLogo.tsx");
    assert.ok(fs.existsSync(logoPath), "SaarviLogo.tsx must exist");

    const code = fs.readFileSync(logoPath, "utf8");
    assert.ok(code.includes("EngineeredSingleSMark"), "Must import and use EngineeredSingleSMark");
    assert.ok(!code.includes('src="/logo.png"'), "Must not use raster /logo.png");
  });
});
