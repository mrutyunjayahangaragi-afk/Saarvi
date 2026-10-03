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
// 5. CASHFREE CRYPTOGRAPHIC WEBHOOK & SECURITY TESTS
// =============================================================================

function verifyCashfreeWebhookSignature(rawBody, signature, timestamp, secretKey) {
  if (!rawBody || !signature || !timestamp || !secretKey) return false;
  try {
    const signatureData = `${timestamp}${rawBody}`;
    const expected = crypto.createHmac('sha256', secretKey).update(signatureData).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

test('Cashfree HMAC-SHA256 signature verification passes with valid key and payload', () => {
  const secretKey = 'test_secret_key_1234567890';
  const timestamp = '1710000000';
  const rawBody = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'saarvi_ord_123', order_amount: 99.0 },
      payment: { cf_payment_id: 'cf_pay_456', payment_status: 'SUCCESS' },
    },
  });

  const validSignature = crypto
    .createHmac('sha256', secretKey)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');

  assert.equal(verifyCashfreeWebhookSignature(rawBody, validSignature, timestamp, secretKey), true);
});

test('Cashfree signature verification rejects tampered payloads or invalid secrets', () => {
  const secretKey = 'test_secret_key_1234567890';
  const timestamp = '1710000000';
  const rawBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', amount: 99 });
  const tamperedBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', amount: 1 });

  const validSignature = crypto
    .createHmac('sha256', secretKey)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');

  // Tampered body with old signature
  assert.equal(verifyCashfreeWebhookSignature(tamperedBody, validSignature, timestamp, secretKey), false);

  // Wrong secret key
  assert.equal(verifyCashfreeWebhookSignature(rawBody, validSignature, timestamp, 'wrong_secret'), false);

  // Missing timestamp
  assert.equal(verifyCashfreeWebhookSignature(rawBody, validSignature, '', secretKey), false);
});
