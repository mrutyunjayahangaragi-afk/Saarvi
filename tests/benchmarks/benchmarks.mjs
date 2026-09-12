/**
 * DocEase Phase 21 Algorithm & Performance Benchmark Suite.
 *
 * Measures execution time, operations per second, and algorithmic efficiency
 * across core optimized algorithms and data structures.
 */

import { performance } from "node:perf_hooks";

console.log("=========================================================");
console.log(" DocEase Algorithm & Performance Benchmark Suite");
console.log("=========================================================\n");

const results = [];

// =========================================================================
// BENCHMARK 1: Curriculum Index Lookup (O(1) Map vs O(N) Array Scan)
// =========================================================================
function benchmarkCurriculumIndex() {
  console.log("▶ Benchmark 1: Curriculum Index Lookup (O(1) Map vs O(N) Array Scan)");

  const mockCourses = [];
  const schemes = ["2022", "2025"];
  const branches = ["CSE", "ISE", "AIML", "ECE", "MECH", "CIVIL"];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  for (const scheme of schemes) {
    for (const branch of branches) {
      for (const sem of semesters) {
        for (let c = 1; c <= 8; c++) {
          mockCourses.push({
            courseCode: `${scheme}${branch.slice(0, 2)}${sem}0${c}`,
            title: `Course ${branch} Sem ${sem} #${c}`,
            credits: 3,
            scheme,
            branch,
            semester: sem,
          });
        }
      }
    }
  }

  // Pre-build O(1) Composite Map Index
  const compositeMap = new Map();
  for (const course of mockCourses) {
    const key = `${course.scheme}|${course.branch}|${course.semester}`;
    const list = compositeMap.get(key) || [];
    list.push(course);
    compositeMap.set(key, list);
  }

  const iterations = 100000;
  const testKeys = [
    { scheme: "2022", branch: "CSE", sem: 3 },
    { scheme: "2025", branch: "AIML", sem: 5 },
    { scheme: "2022", branch: "ECE", sem: 7 },
  ];

  // Map Lookup
  const startMap = performance.now();
  for (let i = 0; i < iterations; i++) {
    const target = testKeys[i % testKeys.length];
    const key = `${target.scheme}|${target.branch}|${target.sem}`;
    const match = compositeMap.get(key);
  }
  const endMap = performance.now();
  const timeMap = endMap - startMap;
  const opsSecMap = Math.round((iterations / timeMap) * 1000);

  // Array Filter (Linear)
  const linearIterations = 5000;
  const startLinear = performance.now();
  for (let i = 0; i < linearIterations; i++) {
    const target = testKeys[i % testKeys.length];
    const match = mockCourses.filter(
      (c) => c.scheme === target.scheme && c.branch === target.branch && c.semester === target.sem
    );
  }
  const endLinear = performance.now();
  const timeLinear = (endLinear - startLinear) * (iterations / linearIterations);
  const opsSecLinear = Math.round((linearIterations / (endLinear - startLinear)) * 1000);

  const speedup = (timeLinear / timeMap).toFixed(1);

  console.log(`  - O(1) Map Lookup:   ${timeMap.toFixed(2)} ms for ${iterations} lookups (${opsSecMap.toLocaleString()} ops/sec)`);
  console.log(`  - O(N) Array Filter: ${timeLinear.toFixed(2)} ms (equiv) (${opsSecLinear.toLocaleString()} ops/sec)`);
  console.log(`  ⚡ Speedup:          ${speedup}x faster\n`);

  results.push({ name: "Curriculum Map Lookup", timeMap, opsSecMap, speedup });
}

// =========================================================================
// BENCHMARK 2: Interval Overlap Conflict Detection (O(N log N))
// =========================================================================
function benchmarkIntervalOverlap() {
  console.log("▶ Benchmark 2: Interval Conflict Detector (O(N log N) Sweep-Line)");

  const intervals = [];
  for (let i = 0; i < 5000; i++) {
    const start = Math.floor(Math.random() * 1000);
    const dur = Math.floor(Math.random() * 60) + 15;
    intervals.push({ start, end: start + dur, id: `int_${i}` });
  }

  const iterations = 50;
  const start = performance.now();

  for (let iter = 0; iter < iterations; iter++) {
    // Sort intervals by start time
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const conflicts = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end > sorted[i + 1].start) {
        conflicts.push([sorted[i], sorted[i + 1]]);
      }
    }
  }

  const end = performance.now();
  const totalTime = end - start;
  const avgTimePerSweep = (totalTime / iterations).toFixed(2);
  const totalEvaluations = intervals.length * iterations;
  const opsSec = Math.round((totalEvaluations / totalTime) * 1000);

  console.log(`  - Sweep-Line: ${totalTime.toFixed(2)} ms for ${iterations} sweeps over 5,000 intervals`);
  console.log(`  - Average:    ${avgTimePerSweep} ms per 5k dataset (${opsSec.toLocaleString()} intervals/sec)\n`);

  results.push({ name: "Interval Overlap Conflict", totalTime, avgTimePerSweep, opsSec });
}

// =========================================================================
// BENCHMARK 3: Certificate / Course Duplicate Detection (O(1) Set)
// =========================================================================
function benchmarkDuplicateDetection() {
  console.log("▶ Benchmark 3: Certificate Duplicate Detector (O(1) Hash Set)");

  const certSet = new Set();
  const certArray = [];
  for (let i = 0; i < 1000; i++) {
    const key = `cert_name_${i}|issuer_org_${i % 20}|2026-0${(i % 9) + 1}-15`;
    certSet.add(key);
    certArray.push({ name: `cert_name_${i}`, issuer: `issuer_org_${i % 20}`, date: `2026-0${(i % 9) + 1}-15`, key });
  }

  const checkIterations = 100000;
  const testKeys = [];
  for (let i = 0; i < 100; i++) {
    testKeys.push(`cert_name_${i * 10}|issuer_org_${(i * 10) % 20}|2026-0${((i * 10) % 9) + 1}-15`);
  }

  // Set lookup
  const startSet = performance.now();
  let hitsSet = 0;
  for (let i = 0; i < checkIterations; i++) {
    const k = testKeys[i % testKeys.length];
    if (certSet.has(k)) hitsSet++;
  }
  const endSet = performance.now();
  const timeSet = endSet - startSet;
  const opsSecSet = Math.round((checkIterations / timeSet) * 1000);

  // Array scan
  const scanIterations = 2000;
  const startScan = performance.now();
  let hitsScan = 0;
  for (let i = 0; i < scanIterations; i++) {
    const k = testKeys[i % testKeys.length];
    if (certArray.some((c) => c.key === k)) hitsScan++;
  }
  const endScan = performance.now();
  const timeScan = (endScan - startScan) * (checkIterations / scanIterations);
  const speedup = (timeScan / timeSet).toFixed(1);

  console.log(`  - O(1) Set.has():    ${timeSet.toFixed(2)} ms for ${checkIterations} checks (${opsSecSet.toLocaleString()} checks/sec)`);
  console.log(`  - O(N) Array.some(): ${timeScan.toFixed(2)} ms (equiv)`);
  console.log(`  ⚡ Speedup:          ${speedup}x faster\n`);

  results.push({ name: "Certificate Duplicate Set Check", timeSet, opsSecSet, speedup });
}

// =========================================================================
// BENCHMARK 4: Skill Gap Matching (O(N+M) Set Membership vs O(N*M) Includes)
// =========================================================================
function benchmarkSkillGap() {
  console.log("▶ Benchmark 4: Skill Gap Matching (O(N+M) Set vs O(N*M) Array.includes)");

  const candidateSkills = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "HTML", "CSS", "Git",
    "SQL", "PostgreSQL", "Docker", "Tailwind CSS", "Redux", "REST APIs", "Jest",
  ];
  const requiredSkills = [
    "HTML", "CSS", "JavaScript", "TypeScript", "React", "Responsive Design", "Git",
  ];
  const optionalSkills = [
    "Next.js", "Tailwind CSS", "Redux", "Web Performance", "Accessibility",
  ];

  const iterations = 50000;

  // Optimized O(N+M) Set matching
  const startSet = performance.now();
  for (let i = 0; i < iterations; i++) {
    const userSkillSet = new Set(candidateSkills.map((s) => s.toLowerCase()));
    let matched = 0;
    for (const req of requiredSkills) {
      if (userSkillSet.has(req.toLowerCase())) matched++;
    }
    for (const opt of optionalSkills) {
      if (userSkillSet.has(opt.toLowerCase())) matched++;
    }
  }
  const endSet = performance.now();
  const timeSet = endSet - startSet;
  const opsSecSet = Math.round((iterations / timeSet) * 1000);

  // Unoptimized O(N*M) Array.includes
  const startArr = performance.now();
  for (let i = 0; i < iterations; i++) {
    const normalizedUser = candidateSkills.map((s) => s.toLowerCase());
    let matched = 0;
    for (const req of requiredSkills) {
      if (normalizedUser.includes(req.toLowerCase())) matched++;
    }
    for (const opt of optionalSkills) {
      if (normalizedUser.includes(opt.toLowerCase())) matched++;
    }
  }
  const endArr = performance.now();
  const timeArr = endArr - startArr;
  const opsSecArr = Math.round((iterations / timeArr) * 1000);

  const speedup = (timeArr / timeSet).toFixed(2);

  console.log(`  - O(N+M) Set:       ${timeSet.toFixed(2)} ms for ${iterations} evaluations (${opsSecSet.toLocaleString()} ops/sec)`);
  console.log(`  - O(N*M) Includes:  ${timeArr.toFixed(2)} ms (${opsSecArr.toLocaleString()} ops/sec)`);
  console.log(`  ⚡ Efficiency:       ${speedup}x\n`);

  results.push({ name: "Skill Gap Set Membership", timeSet, opsSecSet, speedup });
}

// =========================================================================
// BENCHMARK 5: Inverted Token Search Index (Multi-Token Query)
// =========================================================================
function benchmarkInvertedIndex() {
  console.log("▶ Benchmark 5: Lightweight Inverted Search Index (Multi-Token Postings Intersect)");

  // Build 1,000 documents
  const invertedIndex = new Map();
  const docMap = new Map();

  function tokenize(str) {
    return str.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  }

  for (let id = 1; id <= 1000; id++) {
    const title = `Document #${id} Operating Systems Computer Networks VTU Exam Preparation ${id % 5 === 0 ? "urgent" : ""}`;
    const desc = `Notes on CPU scheduling, memory management, TCP IP protocols, routing algorithms semester ${((id % 8) + 1)}`;
    docMap.set(`doc_${id}`, { id, title, desc });

    const tokens = new Set(tokenize(`${title} ${desc}`));
    for (const t of tokens) {
      let set = invertedIndex.get(t);
      if (!set) {
        set = new Set();
        invertedIndex.set(t, set);
      }
      set.add(`doc_${id}`);
    }
  }

  const queryTokens = ["operating", "systems", "exam"];
  const iterations = 50000;

  const startInverted = performance.now();
  let totalMatches = 0;

  for (let i = 0; i < iterations; i++) {
    // Intersect postings lists
    const sets = queryTokens.map((t) => invertedIndex.get(t) || new Set());
    let smallest = sets[0];
    for (const s of sets) {
      if (s.size < smallest.size) smallest = s;
    }
    const matchingIds = [];
    for (const id of smallest) {
      if (sets.every((s) => s.has(id))) {
        matchingIds.push(id);
      }
    }
    totalMatches += matchingIds.length;
  }

  const endInverted = performance.now();
  const timeInverted = endInverted - startInverted;
  const opsSec = Math.round((iterations / timeInverted) * 1000);

  console.log(`  - Inverted Index Intersect: ${timeInverted.toFixed(2)} ms for ${iterations} multi-token queries`);
  console.log(`  - Throughput:                ${opsSec.toLocaleString()} queries/sec`);
  console.log(`  - Average latency:           ${(timeInverted / iterations * 1000).toFixed(2)} µs per query\n`);

  results.push({ name: "Inverted Index Intersect", timeInverted, opsSec, latencyUs: (timeInverted / iterations * 1000).toFixed(2) });
}

// Run All
benchmarkCurriculumIndex();
benchmarkIntervalOverlap();
benchmarkDuplicateDetection();
benchmarkSkillGap();
benchmarkInvertedIndex();

console.log("=========================================================");
console.log(" Summary: All 5 Algorithm Benchmarks Completed Successfully");
console.log("=========================================================");
