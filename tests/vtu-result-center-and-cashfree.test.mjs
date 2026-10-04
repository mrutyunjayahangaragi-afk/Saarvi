import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// =============================================================================
// 1. USN NORMALIZATION & VALIDATION TESTS
// =============================================================================

function normalizeUSN(raw) {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function validateUSNStructure(usn) {
  const clean = normalizeUSN(usn);
  if (!clean) return { isValid: false, error: 'Empty USN' };
  if (clean.length < 10) return { isValid: false, error: 'Too short' };
  if (clean.length > 11) return { isValid: false, error: 'Too long' };
  if (!/^[1-4]/.test(clean)) return { isValid: false, error: 'Invalid region' };
  const pattern = /^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4}$/;
  if (!pattern.test(clean)) return { isValid: false, error: 'Invalid pattern' };
  return { isValid: true };
}

test('USN normalization strips whitespace and converts to uppercase', () => {
  assert.equal(normalizeUSN('  1rv23cs001  '), '1RV23CS001');
  assert.equal(normalizeUSN('1ms-22-ec-045'), '1MS22EC045');
  assert.equal(normalizeUSN('1bm 21 is 090'), '1BM21IS090');
});

test('USN validation accepts legitimate VTU patterns including lateral entry', () => {
  assert.equal(validateUSNStructure('1RV23CS001').isValid, true);
  assert.equal(validateUSNStructure('2GI22ME045').isValid, true);
  assert.equal(validateUSNStructure('3BR21CV012').isValid, true);
  assert.equal(validateUSNStructure('4BD20EE089').isValid, true);
  // Lateral entry
  assert.equal(validateUSNStructure('1RV24CS400').isValid, true);
});

test('USN validation rejects illegitimate structures', () => {
  assert.equal(validateUSNStructure('').isValid, false);
  assert.equal(validateUSNStructure('5RV23CS001').isValid, false); // Region 5 doesn't exist in VTU
  assert.equal(validateUSNStructure('1RV23C').isValid, false); // Too short
  assert.equal(validateUSNStructure('1RV23CS0000001').isValid, false); // Too long
  assert.equal(validateUSNStructure('INVALID_USN').isValid, false);
});

// =============================================================================
// 2. SCHEME REGISTRY & DETECTION TESTS
// =============================================================================

function detectSchemeFromUSN(usn) {
  const clean = normalizeUSN(usn);
  const match = clean.match(/^[1-4][A-Z]{2}(\d{2})/);
  if (match && match[1]) {
    const year = 2000 + parseInt(match[1], 10);
    if (year >= 2025) return 'vtu-2025';
    if (year >= 2022) return 'vtu-2022';
    if (year === 2021) return 'vtu-2021';
    if (year >= 2018) return 'vtu-2018';
  }
  return 'vtu-2022';
}

function cgpaToPercentageVTU(cgpa) {
  if (isNaN(cgpa) || cgpa <= 0.75) return 0;
  const pct = (cgpa - 0.75) * 10;
  return Math.round((pct + Number.EPSILON) * 100) / 100;
}

test('Scheme registry accurately detects VTU regulations from USN batch year', () => {
  assert.equal(detectSchemeFromUSN('1RV25CS001'), 'vtu-2025');
  assert.equal(detectSchemeFromUSN('1RV23CS001'), 'vtu-2022');
  assert.equal(detectSchemeFromUSN('1RV22EC010'), 'vtu-2022');
  assert.equal(detectSchemeFromUSN('1MS21IS040'), 'vtu-2021');
  assert.equal(detectSchemeFromUSN('1BM19ME090'), 'vtu-2018');
});

test('VTU percentage formula converts CGPA according to (CGPA - 0.75) * 10', () => {
  assert.equal(cgpaToPercentageVTU(10.0), 92.5);
  assert.equal(cgpaToPercentageVTU(8.25), 75.0);
  assert.equal(cgpaToPercentageVTU(7.5), 67.5);
  assert.equal(cgpaToPercentageVTU(6.75), 60.0);
  assert.equal(cgpaToPercentageVTU(0.75), 0);
  assert.equal(cgpaToPercentageVTU(0.5), 0);
});

// =============================================================================
// 3. DETERMINISTIC SGPA & CGPA ENGINE TESTS
// =============================================================================

function calculateSGPA(courses) {
  let totalCredits = 0;
  let totalPoints = 0;
  let earnedCredits = 0;

  for (const c of courses) {
    if (c.includedInSGPA === false || c.credits <= 0) continue;
    totalCredits += c.credits;
    totalPoints += c.credits * c.gradePoint;
    if (c.gradePoint > 0 && c.grade !== 'F') {
      earnedCredits += c.credits;
    }
  }

  const raw = totalCredits > 0 ? totalPoints / totalCredits : 0;
  const sgpa = Math.round((raw + Number.EPSILON) * 100) / 100;
  return { sgpa, totalCredits, earnedCredits, totalPoints };
}

function calculateCGPA(semesters) {
  let totalCredits = 0;
  let totalPoints = 0;

  for (const s of semesters) {
    if (s.totalCredits > 0 && s.sgpa > 0) {
      totalCredits += s.totalCredits;
      totalPoints += s.sgpa * s.totalCredits;
    }
  }

  const raw = totalCredits > 0 ? totalPoints / totalCredits : 0;
  const cgpa = Math.round((raw + Number.EPSILON) * 100) / 100;
  return { cgpa, totalCredits };
}

test('SGPA engine strictly retains F-grade credits in denominator', () => {
  const subjects = [
    { courseCode: '22CS31', credits: 4, gradePoint: 9, grade: 'A+' }, // 36 pts
    { courseCode: '22CS32', credits: 4, gradePoint: 8, grade: 'A' },  // 32 pts
    { courseCode: '22CS33', credits: 4, gradePoint: 0, grade: 'F' },  // 0 pts (FAILED)
    { courseCode: '22CS34', credits: 3, gradePoint: 7, grade: 'B+' }, // 21 pts
    { courseCode: '22CSL35', credits: 1, gradePoint: 10, grade: 'O' }, // 10 pts
  ];

  const res = calculateSGPA(subjects);
  // Total points = 36 + 32 + 0 + 21 + 10 = 99
  // Total credits = 4 + 4 + 4 + 3 + 1 = 16
  // SGPA = 99 / 16 = 6.1875 -> 6.19
  assert.equal(res.totalCredits, 16);
  assert.equal(res.earnedCredits, 12);
  assert.equal(res.sgpa, 6.19);
});

test('CGPA engine computes credit-weighted progression, not crude average of SGPAs', () => {
  // Semester 1: 20 credits with 8.00 SGPA (160 pts)
  // Semester 2: 24 credits with 9.00 SGPA (216 pts)
  // Weighted sum = (160 + 216) / 44 = 376 / 44 = 8.5454... -> 8.55
  // Note: Crude average would be (8.00 + 9.00)/2 = 8.50 (Incorrect)
  const semesters = [
    { semester: 1, sgpa: 8.0, totalCredits: 20 },
    { semester: 2, sgpa: 9.0, totalCredits: 24 },
  ];

  const res = calculateCGPA(semesters);
  assert.equal(res.totalCredits, 44);
  assert.equal(res.cgpa, 8.55);
});

// =============================================================================
// 4. WHAT-IF SIMULATOR & TARGET PLANNER TESTS
// =============================================================================

function calculateWhatIf(historicalSemesters, projectedCredits, projectedGradePoint) {
  let curPts = 0;
  let curCreds = 0;
  for (const s of historicalSemesters) {
    curCreds += s.totalCredits;
    curPts += s.sgpa * s.totalCredits;
  }
  const curCgpa = curCreds > 0 ? Math.round((curPts / curCreds + Number.EPSILON) * 100) / 100 : 0;

  const projPts = projectedCredits * projectedGradePoint;
  const totCreds = curCreds + projectedCredits;
  const totPts = curPts + projPts;
  const newCgpa = totCreds > 0 ? Math.round((totPts / totCreds + Number.EPSILON) * 100) / 100 : curCgpa;
  const delta = Math.round((newCgpa - curCgpa + Number.EPSILON) * 100) / 100;

  return { curCgpa, newCgpa, delta };
}

function calculateTargetGoal(curCgpa, targetCgpa, completedCredits, remainingCredits) {
  const totCreds = completedCredits + remainingCredits;
  const ptsNeeded = targetCgpa * totCreds - curCgpa * completedCredits;
  const requiredSgpa = Math.round((ptsNeeded / remainingCredits + Number.EPSILON) * 100) / 100;
  return { requiredSgpa, isAchievable: requiredSgpa <= 10.0 };
}

test('What-If simulator accurately models future CGPA changes without mutating history', () => {
  const history = [
    { semester: 1, sgpa: 8.0, totalCredits: 20 },
    { semester: 2, sgpa: 8.0, totalCredits: 20 },
  ];
  // 40 credits at 8.00 = 320 pts
  // Project next sem: 20 credits at 10.0 = 200 pts
  // Total = 520 pts / 60 credits = 8.666... -> 8.67
  const res = calculateWhatIf(history, 20, 10.0);
  assert.equal(res.curCgpa, 8.0);
  assert.equal(res.newCgpa, 8.67);
  assert.equal(res.delta, 0.67);
});

test('Target CGPA planner detects achievable and impossible goals', () => {
  // Current: 8.0 CGPA on 100 credits. Target: 8.5 CGPA with 20 credits remaining
  // Total = 120 credits * 8.5 = 1020 pts. Current = 800 pts. Need 220 pts in 20 creds = 11.0 SGPA -> Impossible
  const impossible = calculateTargetGoal(8.0, 8.5, 100, 20);
  assert.equal(impossible.isAchievable, false);
  assert.equal(impossible.requiredSgpa, 11.0);

  // Current: 8.0 CGPA on 60 credits. Target: 8.5 CGPA with 60 credits remaining
  // Total = 120 * 8.5 = 1020 pts. Current = 480 pts. Need 540 pts in 60 creds = 9.0 SGPA -> Achievable
  const achievable = calculateTargetGoal(8.0, 8.5, 60, 60);
  assert.equal(achievable.isAchievable, true);
  assert.equal(achievable.requiredSgpa, 9.0);
});

// =============================================================================
// 5. RAZORPAY CRYPTOGRAPHIC WEBHOOK & SECURITY TESTS
// =============================================================================

function verifyRazorpayWebhookSignature(rawBody, signature, secretKey) {
  if (!rawBody || !signature || !secretKey) return false;
  try {
    const expected = crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

test('Razorpay HMAC-SHA256 signature verification passes with valid key and payload', () => {
  const secretKey = 'test_secret_key_1234567890';
  const rawBody = JSON.stringify({
    event: 'order.paid',
    payload: {
      order: { entity: { id: 'order_123', amount: 9900 } },
      payment: { entity: { id: 'pay_456', status: 'captured' } },
    },
  });

  const validSignature = crypto
    .createHmac('sha256', secretKey)
    .update(rawBody)
    .digest('hex');

  assert.equal(verifyRazorpayWebhookSignature(rawBody, validSignature, secretKey), true);
});

test('Razorpay signature verification rejects tampered payloads or invalid secrets', () => {
  const secretKey = 'test_secret_key_1234567890';
  const rawBody = JSON.stringify({ event: 'order.paid', amount: 9900 });
  const tamperedBody = JSON.stringify({ event: 'order.paid', amount: 100 });

  const validSignature = crypto
    .createHmac('sha256', secretKey)
    .update(rawBody)
    .digest('hex');

  // Tampered body with old signature
  assert.equal(verifyRazorpayWebhookSignature(tamperedBody, validSignature, secretKey), false);

  // Wrong secret key
  assert.equal(verifyRazorpayWebhookSignature(rawBody, validSignature, 'wrong_secret'), false);
});

// =============================================================================
// 5. PDF PARSER RESILIENCE & CASHFREE CSP TESTS
// =============================================================================

function testDetectUsn(text, fallbackUsn) {
  // Strategy 1: Direct exact match
  const exactMatch = text.match(/\b([1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4})\b/i);
  if (exactMatch) return exactMatch[1].toUpperCase();

  // Strategy 2: Spaced characters / kerning
  const spacedMatch = text.match(/\b([1-4]\s*[A-Za-z]{2}\s*\d{2}\s*[A-Za-z]{2,3}\s*\d{2,4})\b/i);
  if (spacedMatch) {
    const candidate = spacedMatch[1].replace(/\s+/g, '').toUpperCase();
    if (/^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4}$/.test(candidate)) {
      return candidate;
    }
  }

  // Strategy 3: Target label-based extraction
  const labelMatch = text.match(/(?:University\s*Seat\s*Number|USN|Seat\s*No|Roll\s*No)\s*[:.-]?\s*([A-Za-z0-9\s]{7,18})/i);
  if (labelMatch) {
    const candidate = labelMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const subMatch = candidate.match(/([1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4})/);
    if (subMatch) return subMatch[1];
  }

  // Strategy 4: Search squashed text
  const squashed = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const squashedMatch = squashed.match(/([1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4})/);
  if (squashedMatch) {
    return squashedMatch[1];
  }

  // Strategy 5: Contextual Fallback
  if (fallbackUsn) {
    const cleanFallback = fallbackUsn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4}$/.test(cleanFallback)) {
      return cleanFallback;
    }
  }

  return '';
}

test('detectUsnFromText extracts USN across exact, spaced, labeled and fallback formats', () => {
  // Exact match
  assert.equal(testDetectUsn('Student 2LB24CS047 semester 1 marks card'), '2LB24CS047');

  // Spaced/kerning match
  assert.equal(testDetectUsn('Seat: 2 L B 2 4 C S 0 4 7 Examination Result'), '2LB24CS047');

  // Label-based match
  assert.equal(testDetectUsn('University Seat Number : 2LB24CS047'), '2LB24CS047');
  assert.equal(testDetectUsn('USN : 2LB24CS047 - B.E. Computer Science'), '2LB24CS047');

  // Squashed/dirty punctuation match
  assert.equal(testDetectUsn('VTU-RESULT|USN:2LB24CS047|SEM:1'), '2LB24CS047');

  // Fallback match when text is fragmented
  assert.equal(testDetectUsn('VTU PROVISIONAL RESULTS 2024', '2LB24CS047'), '2LB24CS047');
});

test('2022 Scheme course code regex detects BMATS101, BCS301, BSCK307', () => {
  const subjectCodeRegex = /\b((?:B[A-Z]{2,5}\d{2,3}[A-Z]?)|(?:\d{2}[A-Z]{2,4}\d{2,3}[A-Z]?)|(?:[A-Z]{2,5}\d{2,4}[A-Z]?))\b/gi;
  const sample = 'BMATS101 Mathematics, BPHYS102 Physics, BCS301 Data Structures, BSCK307 Social Connect, 21CS31 Analog';
  const matches = Array.from(sample.matchAll(subjectCodeRegex)).map(m => m[1].toUpperCase());

  assert.ok(matches.includes('BMATS101'));
  assert.ok(matches.includes('BPHYS102'));
  assert.ok(matches.includes('BCS301'));
  assert.ok(matches.includes('BSCK307'));
  assert.ok(matches.includes('21CS31'));
});

test('next.config.ts CSP header includes Razorpay SDK, endpoints, and iframes', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const nextConfig = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');

  assert.match(nextConfig, /https:\/\/checkout\.razorpay\.com/);
  assert.match(nextConfig, /https:\/\/\*\.razorpay\.com/);
  assert.match(nextConfig, /https:\/\/api\.razorpay\.com/);
  assert.match(nextConfig, /https:\/\/lumberjack\.razorpay\.com/);
});

