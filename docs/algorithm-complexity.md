# DocEase Algorithm Complexity Specification

**Formal Theoretical Time & Space Complexity Analysis**  
*DocEase Academic Intelligence, Productivity & Career Suite*

---

## 1. Notation & Parameters

- $N$: Total number of courses, intervals, or records in a collection.
- $M$: Number of query terms or target skills.
- $L$: Maximum character length of input strings or document text.
- $T$: Total number of tokens in a document or search corpus.
- $D$: Total number of documents indexed.
- $D_i$: Postings list (set of matching document IDs) for token $i$.
- $R$: Number of candidate recommendations generated.

---

## 2. Comprehensive Complexity Table

| Component & Algorithm | Operation | Average Time Complexity | Worst-Case Time Complexity | Space Complexity |
|:---|:---|:---|:---|:---|
| **Curriculum Index** (`curriculum-index.ts`) | Index Initialization | $O(N \cdot L)$ | $O(N \cdot L)$ | $O(N)$ references |
| | Get Courses by Scheme/Branch/Sem | $O(1)$ | $O(1)$ | $O(1)$ |
| | Get Course by Code | $O(1)$ | $O(1)$ | $O(1)$ |
| **Certificate Duplicate Detector** (`duplicate-detector.ts`) | Key Generation | $O(L)$ | $O(L)$ | $O(L)$ string |
| | Check Duplicate in Existing Set | $O(1)$ | $O(1)$ | $O(1)$ |
| | Check Duplicate in List | $O(N \cdot L)$ | $O(N \cdot L)$ | $O(1)$ |
| **Course Duplicate Detector** (`duplicate-detector.ts`) | Check Course Duplicate | $O(N \cdot L)$ | $O(N \cdot L)$ | $O(1)$ |
| | Find All Duplicate Courses | $O(N \cdot L)$ | $O(N \cdot L)$ | $O(N)$ Set entries |
| **Subject Index** (`subject-index.ts`) | Register Subject | $O(L)$ | $O(L)$ | $O(1)$ |
| | Lookup by Code | $O(1)$ | $O(1)$ | $O(1)$ |
| | Lookup by Name | $O(1)$ | $O(1)$ | $O(1)$ |
| | Resolve Subject | $O(1)$ | $O(1)$ | $O(1)$ |
| **Career Skill Gap Analyzer** (`careerService.ts`) | Construct User Skill Set | $O(N \cdot L)$ | $O(N \cdot L)$ | $O(N)$ Set entries |
| | Match Required & Optional Skills | $O(M)$ | $O(M)$ | $O(M)$ arrays |
| | Overall Skill Gap Evaluation | $O(N + M)$ | $O(N + M)$ | $O(N + M)$ |
| **Interval Overlap Conflict Detector** (`conflict-detector.ts`) | Sort Intervals by Start Time | $O(N \log N)$ | $O(N \log N)$ | $O(N)$ array copy |
| | Adjacent Overlap Scan | $O(N)$ | $O(N)$ | $O(K)$ conflicts |
| | Overall Conflict Detection | $O(N \log N)$ | $O(N \log N)$ | $O(N)$ |
| **Inverted Search Index** (`search-index.ts`) | Index Document | $O(T \cdot L)$ | $O(T \cdot L)$ | $O(T)$ postings |
| | Remove Document | $O(T)$ | $O(T)$ | $O(1)$ |
| | AND Multi-Token Query | $O(\min(\|D_i\|) \cdot M)$ | $O(\min(\|D_i\|) \cdot M)$ | $O(\min(\|D_i\|))$ |
| | OR Multi-Token Query | $O(\sum \|D_i\|)$ | $O(\sum \|D_i\|)$ | $O(\sum \|D_i\|)$ |
| | Candidate Scoring & Ranking | $O(C \log C)$ ($C \le D$) | $O(C \log C)$ | $O(C)$ |
| **Recommendation Engine** (`recommendation-engine.ts`) | Evaluate Academic Rules | $O(A + E)$ | $O(A + E)$ | $O(A + E)$ |
| | Evaluate Productivity Rules | $O(T + S + G)$ | $O(T + S + G)$ | $O(T + S + G)$ |
| | Evaluate Career Rules | $O(J + I + R)$ | $O(J + I + R)$ | $O(J + I + R)$ |
| | Evaluate Cross-Domain Compound | $O(E \cdot A + H \cdot R)$ | $O(E \cdot A + H \cdot R)$ | $O(E + H)$ |
| | Deduplication via Map | $O(R)$ | $O(R)$ | $O(R)$ entries |
| | Priority Sorting | $O(R \log R)$ | $O(R \log R)$ | $O(R)$ |
| | Top-K Truncation | $O(K)$ | $O(K)$ | $O(K)$ |
| | Smart Daily Plan Synthesis | $O(T + S + A + E)$ | $O(T + S + A + E)$ | $O(T + S + A + E)$ |

---

## 3. Mathematical Analysis & Proofs

### 3.1 O(1) Curriculum Lookup Proof
Let $\mathcal{C}$ be the universe of curriculum courses. A deterministic key function $h(s, b, m) = s \oplus b \oplus m$ is evaluated in $O(L)$ time where $L$ is key string length bounded by constant $c < 30$. Using V8's internal compact hash table implementation for `Map<string, CurriculumCourse[]>`, collisions are resolved via bucket chaining. With small key cardinality ($|\text{keys}| \approx 120$ for VTU programs), load factor $\alpha \ll 0.75$, ensuring constant time $O(1)$ retrieval.

### 3.2 O(N + M) Skill Gap Matching Proof
Let $U = \{u_1, u_2, \dots, u_n\}$ be the candidate's skills. Constructing $S_U = \text{Set}(U)$ takes $O(n)$ time. For role requirements $R = \{r_1, r_2, \dots, r_m\}$, checking if $r_j \in S_U$ takes $O(1)$ average time per requirement. Total time:
$$T = O(n) + \sum_{j=1}^m O(1) = O(n + m)$$
In contrast, naive array searching evaluates $\sum_{j=1}^m \sum_{i=1}^n \mathbb{I}(r_j = u_i) = O(n \cdot m)$. For a resume with 25 skills and 15 job requirements, the optimized set membership performs in 40 operations vs 375 operations (nearly 10x theoretical reduction).

### 3.3 Sweep-Line Interval Overlap Proof
Let $\mathcal{I} = \{[s_1, e_1], [s_2, e_2], \dots, [s_n, e_n]\}$ be study sessions or timetable periods.
Sorting $\mathcal{I}$ by $s_i$ requires $O(n \log n)$ time using Timsort.
In a sorted interval sequence, if interval $i$ overlaps with interval $j > i$, then either $j = i+1$ or there exists a chain of adjacent overlaps. Verifying $e_i > s_{i+1}$ along the sorted array requires strictly $n - 1$ comparisons ($O(n)$ time).
Total time: $O(n \log n) + O(n) = O(n \log n)$.
Space complexity is $O(n)$ to store the sorted copy, ensuring non-destructive operations.

### 3.4 Inverted Index Token Intersection Proof
Given query tokens $q_1, q_2, \dots, q_k$ with postings sets $P_1, P_2, \dots, P_k$.
The intersection $P = \bigcap_{i=1}^k P_i$ is computed by identifying $P_{\min} = \arg\min_{i} |P_i|$.
For each $d \in P_{\min}$, membership $d \in P_j$ is evaluated for $j \neq \min$ in $O(1)$ time per set.
Total comparisons bounded by $(k - 1) \cdot |P_{\min}| = O(k \cdot \min(|P_i|))$.
When a query contains at least one specific term (e.g. "compiler", $|P_i| \approx 3$), the intersection completes in single-digit operations, regardless of total document count $D$.
