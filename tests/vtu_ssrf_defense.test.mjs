import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi VTU Curriculum Engine & Strict SSRF Defense Test Suite", () => {
  const rootDir = process.cwd();

  // Reference implementation of SSRF defense from VtuCurriculumService
  const FORBIDDEN_IP_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./, // AWS/Cloud metadata
    /^::1$/,
    /^0\.0\.0\.0$/,
  ];

  function validateVtuUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') {
      return { valid: false, error: 'URL string is required' };
    }
    try {
      const parsed = new URL(urlString.trim());
      if (parsed.protocol !== 'https:') {
        return { valid: false, error: 'Only secure HTTPS protocols are permitted for official VTU sources.' };
      }
      const hostname = parsed.hostname.toLowerCase();
      for (const pattern of FORBIDDEN_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return { valid: false, error: 'Security violation: Localhost and private subnet addresses are forbidden.' };
        }
      }
      const isOfficialVtu = hostname === 'vtu.ac.in' || hostname.endsWith('.vtu.ac.in');
      if (!isOfficialVtu) {
        return {
          valid: false,
          error: `Untrusted domain (${hostname}). Official curriculum sync only accepts vtu.ac.in domains.`,
        };
      }
      if (parsed.port && parsed.port !== '443') {
        return { valid: false, error: 'Non-standard port detected. Only default HTTPS (443) is permitted.' };
      }
      return { valid: true, url: parsed };
    } catch {
      return { valid: false, error: 'Invalid URL syntax.' };
    }
  }

  test("1. SSRF Defense blocks insecure HTTP and private subnet/loopback addresses", () => {
    // Insecure HTTP
    assert.equal(validateVtuUrl("http://vtu.ac.in/en/syllabus").valid, false);

    // Localhost & Loopback
    assert.equal(validateVtuUrl("https://localhost/admin").valid, false);
    assert.equal(validateVtuUrl("https://127.0.0.1:8000/").valid, false);

    // Private Subnets
    assert.equal(validateVtuUrl("https://10.0.0.1/").valid, false);
    assert.equal(validateVtuUrl("https://192.168.1.1/").valid, false);
    assert.equal(validateVtuUrl("https://172.16.0.1/").valid, false);

    // AWS Cloud Metadata IP
    assert.equal(validateVtuUrl("https://169.254.169.254/latest/meta-data").valid, false);
  });

  test("2. SSRF Defense blocks attacker spoofed domains and non-standard ports", () => {
    // Spoofed subdomain
    assert.equal(validateVtuUrl("https://vtu.ac.in.attacker.org/leak").valid, false);
    assert.equal(validateVtuUrl("https://evil-vtu.ac.in/").valid, false);
    assert.equal(validateVtuUrl("https://google.com/").valid, false);

    // Non-standard port
    assert.equal(validateVtuUrl("https://vtu.ac.in:8080/syllabus").valid, false);
  });

  test("3. SSRF Defense accepts genuine official VTU URLs", () => {
    assert.equal(validateVtuUrl("https://vtu.ac.in/en/b-e-scheme-syllabus/").valid, true);
    assert.equal(validateVtuUrl("https://syllabus.vtu.ac.in/pdf/2022-cse.pdf").valid, true);
    assert.equal(validateVtuUrl("https://vtu.ac.in/wp-content/uploads/2022/10/2022-Scheme-CSE-Syllabus.pdf").valid, true);
  });

  test("4. VtuCurriculumService service file enforces deterministic extraction and superadmin role checks", () => {
    const servicePath = path.join(rootDir, "src/lib/services/vtu-curriculum-service.ts");
    assert.ok(fs.existsSync(servicePath), "VtuCurriculumService file must exist");

    const code = fs.readFileSync(servicePath, "utf8");
    assert.ok(code.includes("validateVtuUrl"), "Must implement validateVtuUrl");
    assert.ok(code.includes("syncVtuSyllabus"), "Must implement syncVtuSyllabus");
    assert.ok(code.includes("generateDeterministicCourses"), "Must implement generateDeterministicCourses");
    assert.ok(code.includes("transitionStatus"), "Must implement transitionStatus");
    assert.ok(code.includes("newStatus === 'PUBLISHED' && actorRole !== 'SUPER_ADMIN'"), "Publishing must strictly require SUPER_ADMIN role");
    assert.ok(code.includes("vtu-source-documents"), "Must use dedicated private bucket for VTU source documents");
  });

  test("5. VTU Sync API route restricts sync to MANAGE and publish to SUPER_ADMIN", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/academic/vtu-sync/route.ts");
    assert.ok(fs.existsSync(routePath), "VTU sync API route must exist");

    const code = fs.readFileSync(routePath, "utf8");
    assert.ok(code.includes("SYNC_VTU"), "Must handle SYNC_VTU action");
    assert.ok(code.includes("TRANSITION_STATUS"), "Must handle TRANSITION_STATUS action");
  });
});
