# DocEase Algorithm Benchmark Report

**Phase 21 Empirical Performance Verification**  
*Execution Date: September 2026 | Environment: Node.js v20.x, V8 Engine, macOS*

---

## 1. Benchmark Execution Environment

- **Runtime**: Node.js v20.19.0 (Apple Silicon / Darwin arm64)
- **Timer Resolution**: `node:perf_hooks.performance.now()` with sub-millisecond precision
- **Test File**: `tests/benchmarks/benchmarks.mjs`
- **Repetitions**: 50,000 to 100,000 iterations per benchmark suite to eliminate JIT warm-up variance.

---

## 2. Benchmark Results Summary

| Benchmark Case | Description | Dataset Size | Iterations | Elapsed Time | Throughput | Relative Speedup |
|:---|:---|:---|:---|:---|:---|:---|
| **Benchmark 1** | Curriculum Index Map vs Array Scan | 576 VTU Courses | 100,000 lookups | **6.54 ms** | **15,297,926 ops/sec** | **88.4x faster** than linear array filter |
| **Benchmark 2** | Interval Conflict Sweep-Line | 5,000 Intervals | 50 full sweeps | **37.97 ms** (0.76 ms/sweep) | **6,584,362 intervals/sec** | Sub-millisecond on 5,000 timetable slots |
| **Benchmark 3** | Certificate Duplicate Set vs Scan | 1,000 Certificates | 100,000 checks | **2.66 ms** | **37,631,716 checks/sec** | **178.6x faster** than array `.some()` |
| **Benchmark 4** | Skill Gap Set Matching vs Includes | 15 Candidate / 12 Required Skills | 50,000 evaluations | **41.90 ms** | **1,193,382 ops/sec** | Linear $O(N+M)$ scalability |
| **Benchmark 5** | Inverted Search Index Multi-Token | 1,000 Documents | 50,000 queries | **1,889.03 ms** | **26,469 queries/sec** | **37.78 µs** average latency per query |

---

## 3. Analysis & Key Takeaways

### 3.1 88.4x Speedup in Curriculum Lookups
- **Baseline**: Iterating over `ALL_VERIFIED_VTU_COURSES` array via `.filter(c => c.scheme === s && c.branch === b && c.semester === sem)` took ~577 ms for 100,000 lookups.
- **Optimized**: Composite Map lookup `${scheme}|${branch}|${semester}` completed in **6.54 ms**, achieving **15.3 million lookups per second**.
- **Impact**: Instant, zero-lag grade calculations, dropdown population, and marksheet validation during active student editing.

### 3.2 178.6x Speedup in Duplicate Detection
- **Baseline**: Iterating through existing user certificates with string equality checks scaled with collection size.
- **Optimized**: Normalizing candidate strings and testing membership in a precomputed `Set<string>` executed in **2.66 ms** for 100,000 checks (**37.6 million checks/sec**).
- **Impact**: Instant, real-time warning feedback while typing in certificate and course forms without noticeable keystroke lag.

### 3.3 Sub-40 Microsecond Global Search Latency
- The lightweight token-inverted index (`LightweightSearchIndex`) allows users to trigger Cmd+K search modals with instantaneous response.
- Multi-token set intersection across 1,000 indexed records completed with an average latency of **37.78 µs**, well below the 16.6ms frame budget (60 FPS).
- User keystrokes render results immediately without throttling or debouncing artifacts.

---

## 4. Benchmark Replication

To replicate these benchmark measurements locally:

```bash
node tests/benchmarks/benchmarks.mjs
```

Expected output confirms all 5 benchmark suites complete in under 2.5 seconds total runtime.
