import { CurriculumCourse } from "@/types/student";
import { ALL_VERIFIED_VTU_COURSES } from "./curriculum-data";

/**
 * High-Performance In-Memory Curriculum Index.
 *
 * Multi-Level Composite Index:
 * - Primary Index: Map<string, CurriculumCourse[]>
 *   Key Format: `${scheme}|${branch}|${semester}` and `${scheme}|${programme}|${branch}|${semester}`
 * - Secondary Index: Map<string, CurriculumCourse>
 *   Key Format: `${scheme}|${courseCode}`
 * - Tertiary Index: Map<string, CurriculumCourse>
 *   Key Format: `${id}`
 *
 * Complexity:
 * - Build Index: O(N) single pass over N course definitions.
 * - Composite Key Lookup: O(1) average time complexity.
 * - Code Reverse Lookup: O(1) average time complexity.
 * - Id Reverse Lookup: O(1) average time complexity.
 * - Space: O(N) reference pointers with zero object cloning.
 */
export class CurriculumIndex {
  private index: Map<string, readonly CurriculumCourse[]> = new Map();
  private courseCodeMap: Map<string, CurriculumCourse> = new Map();
  private subjectIdMap: Map<string, CurriculumCourse> = new Map();
  private totalIndexedCourses: number = 0;

  constructor(courses?: CurriculumCourse[]) {
    this.buildIndex(courses || ALL_VERIFIED_VTU_COURSES);
  }

  public buildIndex(courses: CurriculumCourse[]): void {
    this.index.clear();
    this.courseCodeMap.clear();
    this.subjectIdMap.clear();

    const tempMap = new Map<string, CurriculumCourse[]>();

    for (const course of courses) {
      // 1. Standard composite key: scheme|branch|semester
      const key = this.generateKey(course.scheme, course.branch, course.semester);
      let list = tempMap.get(key);
      if (!list) {
        list = [];
        tempMap.set(key, list);
      }
      list.push(course);

      // 2. Extended composite key if programme is defined (e.g., BE|2022|CSE|3)
      const rawProg = (course as unknown as Record<string, unknown>).programme;
      const programme = typeof rawProg === 'string' ? rawProg : undefined;
      if (programme) {
        const extKey = `${course.scheme.trim()}|${programme.trim().toUpperCase()}|${course.branch.trim().toUpperCase()}|${course.semester}`;
        let extList = tempMap.get(extKey);
        if (!extList) {
          extList = [];
          tempMap.set(extKey, extList);
        }
        extList.push(course);
      }

      // 3. Secondary Code Index: scheme|courseCode
      const codeKey = `${course.scheme.trim()}|${course.courseCode.trim().toUpperCase()}`;
      if (!this.courseCodeMap.has(codeKey)) {
        this.courseCodeMap.set(codeKey, course);
      }

      // 4. Tertiary ID Index: id (if present on record or cast)
      const courseWithId = course as CurriculumCourse & { id?: string };
      if (courseWithId.id) {
        this.subjectIdMap.set(courseWithId.id, course);
      }
    }

    // Freeze arrays to guarantee immutability and prevent defensive cloning overhead
    for (const [k, arr] of tempMap.entries()) {
      this.index.set(k, Object.freeze([...arr]));
    }

    this.totalIndexedCourses = courses.length;
  }

  public generateKey(scheme: string, branch: string, semester: number): string {
    return `${scheme.trim()}|${branch.trim().toUpperCase()}|${semester}`;
  }

  /**
   * Retrieves all curriculum courses for the specified combination.
   * Complexity: O(1) average time.
   */
  public getCourses(scheme: string, branch: string, semester: number): readonly CurriculumCourse[] {
    const key = this.generateKey(scheme, branch, semester);
    return this.index.get(key) || [];
  }

  /**
   * Checks if a scheme, branch, and semester combination is officially verified.
   * Complexity: O(1) average time.
   */
  public isCombinationVerified(scheme: string, branch: string, semester: number): boolean {
    const key = this.generateKey(scheme, branch, semester);
    const list = this.index.get(key);
    return Boolean(list && list.length > 0);
  }

  /**
   * Lookup course metadata by code.
   * Complexity: O(1) average time.
   */
  public getCourseByCode(scheme: string, courseCode: string): CurriculumCourse | undefined {
    return this.courseCodeMap.get(`${scheme.trim()}|${courseCode.trim().toUpperCase()}`);
  }

  /**
   * Lookup course metadata by ID.
   * Complexity: O(1) average time.
   */
  public getCourseById(id: string): CurriculumCourse | undefined {
    return this.subjectIdMap.get(id);
  }

  /**
   * Returns total count of indexed courses.
   */
  public getTotalCourses(): number {
    return this.totalIndexedCourses;
  }

  /**
   * Returns all supported verified keys in the index.
   */
  public getAvailableKeys(): string[] {
    return Array.from(this.index.keys());
  }
}

// Global Singleton Index
export const curriculumIndex = new CurriculumIndex();
