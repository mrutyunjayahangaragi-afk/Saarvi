/**
 * Saarvi Canonical Academic Scheme Registry
 *
 * Implements Prompt Section 4 & 47:
 * - Authoritative configurations for 2018 CBCS, 2021 CBCS, 2022 Scheme, and 2025 Scheme
 * - Grade scales, grade points, mark bands, passing rules, and formulas
 * - Strict 2-decimal rounding with half-up tie-breaking
 * - Official VTU percentage formula: (CGPA - 0.75) * 10
 * - Never hardcoded in React components
 */

export interface GradeBand {
  min: number; // inclusive percentage lower bound
  max: number; // inclusive percentage upper bound
  grade: string;
  gradePoint: number;
  description: string;
}

export interface SchemePassingRules {
  minCIEPercent: number; // e.g. 40% (20/50)
  minSEEPercent: number; // e.g. 35% (18/50)
  minAggregatePercent: number; // e.g. 40% (40/100)
}

export interface CanonicalCourseInput {
  courseCode: string;
  courseTitle: string;
  courseType?: 'THEORY' | 'PRACTICAL' | 'INTEGRATED' | 'AUDIT' | 'PROJECT';
  semester: number;
  credits: number;
  cieMarks?: number;
  seeMarks?: number;
  totalMarks?: number;
  maxMarks?: number;
  grade?: string;
  gradePoint?: number;
  resultStatus?: 'P' | 'F' | 'AB' | 'NE';
  includedInSGPA?: boolean;
  includedInCGPA?: boolean;
}

export interface AcademicScheme {
  schemeId: 'vtu-2018' | 'vtu-2021' | 'vtu-2022' | 'vtu-2025';
  name: string;
  officialTitle: string;
  applicableYears: number[];
  gradeBands: GradeBand[];
  passingRules: SchemePassingRules;
  roundingDecimals: number;
  fGradeCreditTreatment: 'retain_in_denominator'; // VTU strictly retains failed credits in denominator
  percentageFormula: (cgpa: number) => number;
  percentageFormulaDescription: string;
  officialRegulationUrl: string;
  lastVerifiedAt: string;
}

// -----------------------------------------------------------------------------
// VTU 2018 CBCS Scheme Regulations
// -----------------------------------------------------------------------------
export const VTU_2018_SCHEME: AcademicScheme = {
  schemeId: 'vtu-2018',
  name: '2018 CBCS Scheme',
  officialTitle: 'VTU Choice Based Credit System (CBCS) 2018 Regulations',
  applicableYears: [2018, 2019, 2020],
  gradeBands: [
    { min: 90, max: 100, grade: 'S', gradePoint: 10, description: 'Outstanding' },
    { min: 80, max: 89.99, grade: 'A', gradePoint: 9, description: 'Excellent' },
    { min: 70, max: 79.99, grade: 'B', gradePoint: 8, description: 'Very Good' },
    { min: 60, max: 69.99, grade: 'C', gradePoint: 7, description: 'Good' },
    { min: 50, max: 59.99, grade: 'D', gradePoint: 6, description: 'Above Average' },
    { min: 45, max: 49.99, grade: 'E', gradePoint: 4, description: 'Pass' },
    { min: 0, max: 44.99, grade: 'F', gradePoint: 0, description: 'Fail' },
  ],
  passingRules: {
    minCIEPercent: 40,
    minSEEPercent: 35,
    minAggregatePercent: 40,
  },
  roundingDecimals: 2,
  fGradeCreditTreatment: 'retain_in_denominator',
  percentageFormula: (cgpa: number) => {
    if (isNaN(cgpa) || cgpa <= 0.75) return 0;
    const pct = (cgpa - 0.75) * 10;
    return Math.round((pct + Number.EPSILON) * 100) / 100;
  },
  percentageFormulaDescription: 'Percentage (%) = (CGPA - 0.75) × 10',
  officialRegulationUrl: 'https://vtu.ac.in/en/b-e-scheme-syllabus/#menu1',
  lastVerifiedAt: '2026-03-01',
};

// -----------------------------------------------------------------------------
// VTU 2021 CBCS Scheme Regulations
// -----------------------------------------------------------------------------
export const VTU_2021_SCHEME: AcademicScheme = {
  schemeId: 'vtu-2021',
  name: '2021 CBCS Scheme',
  officialTitle: 'VTU Regulations Governing B.E./B.Tech. Under CBCS 2021',
  applicableYears: [2021],
  gradeBands: [
    { min: 90, max: 100, grade: 'O', gradePoint: 10, description: 'Outstanding' },
    { min: 80, max: 89.99, grade: 'A+', gradePoint: 9, description: 'Excellent' },
    { min: 70, max: 79.99, grade: 'A', gradePoint: 8, description: 'Very Good' },
    { min: 60, max: 69.99, grade: 'B+', gradePoint: 7, description: 'Good' },
    { min: 55, max: 59.99, grade: 'B', gradePoint: 6, description: 'Above Average' },
    { min: 50, max: 54.99, grade: 'C', gradePoint: 5, description: 'Average' },
    { min: 40, max: 49.99, grade: 'P', gradePoint: 4, description: 'Pass' },
    { min: 0, max: 39.99, grade: 'F', gradePoint: 0, description: 'Fail' },
  ],
  passingRules: {
    minCIEPercent: 40,
    minSEEPercent: 35,
    minAggregatePercent: 40,
  },
  roundingDecimals: 2,
  fGradeCreditTreatment: 'retain_in_denominator',
  percentageFormula: (cgpa: number) => {
    if (isNaN(cgpa) || cgpa <= 0.75) return 0;
    const pct = (cgpa - 0.75) * 10;
    return Math.round((pct + Number.EPSILON) * 100) / 100;
  },
  percentageFormulaDescription: 'Percentage (%) = (CGPA - 0.75) × 10',
  officialRegulationUrl: 'https://vtu.ac.in/en/b-e-scheme-syllabus/#menu2',
  lastVerifiedAt: '2026-03-01',
};

// -----------------------------------------------------------------------------
// VTU 2022 Scheme Regulations (Section 47)
// -----------------------------------------------------------------------------
export const VTU_2022_SCHEME: AcademicScheme = {
  schemeId: 'vtu-2022',
  name: '2022 Scheme',
  officialTitle: 'VTU Regulations Governing 4-Year B.E./B.Tech. Degree Programme (2022 Scheme)',
  applicableYears: [2022, 2023, 2024],
  gradeBands: [
    { min: 90, max: 100, grade: 'O', gradePoint: 10, description: 'Outstanding' },
    { min: 80, max: 89.99, grade: 'A+', gradePoint: 9, description: 'Excellent' },
    { min: 70, max: 79.99, grade: 'A', gradePoint: 8, description: 'Very Good' },
    { min: 60, max: 69.99, grade: 'B+', gradePoint: 7, description: 'Good' },
    { min: 55, max: 59.99, grade: 'B', gradePoint: 6, description: 'Above Average' },
    { min: 50, max: 54.99, grade: 'C', gradePoint: 5, description: 'Average' },
    { min: 40, max: 49.99, grade: 'P', gradePoint: 4, description: 'Pass' },
    { min: 0, max: 39.99, grade: 'F', gradePoint: 0, description: 'Fail' },
  ],
  passingRules: {
    minCIEPercent: 40, // 20 out of 50 marks
    minSEEPercent: 35, // 18 out of 50 marks
    minAggregatePercent: 40, // 40 out of 100 total marks
  },
  roundingDecimals: 2,
  fGradeCreditTreatment: 'retain_in_denominator',
  percentageFormula: (cgpa: number) => {
    if (isNaN(cgpa) || cgpa <= 0.75) return 0;
    const pct = (cgpa - 0.75) * 10;
    return Math.round((pct + Number.EPSILON) * 100) / 100;
  },
  percentageFormulaDescription: 'Percentage (%) = (CGPA - 0.75) × 10',
  officialRegulationUrl: 'https://vtu.ac.in/pdf/academic/2022_scheme_regulations.pdf',
  lastVerifiedAt: '2026-03-01',
};

// -----------------------------------------------------------------------------
// VTU 2025 Scheme Regulations (Section 4: NEP 2020 Aligned)
// -----------------------------------------------------------------------------
export const VTU_2025_SCHEME: AcademicScheme = {
  schemeId: 'vtu-2025',
  name: '2025 Scheme (NEP)',
  officialTitle: 'VTU NEP-2020 Aligned Multidisciplinary Engineering Regulations (2025)',
  applicableYears: [2025, 2026, 2027],
  gradeBands: [
    { min: 90, max: 100, grade: 'O', gradePoint: 10, description: 'Outstanding' },
    { min: 80, max: 89.99, grade: 'A+', gradePoint: 9, description: 'Excellent' },
    { min: 70, max: 79.99, grade: 'A', gradePoint: 8, description: 'Very Good' },
    { min: 60, max: 69.99, grade: 'B+', gradePoint: 7, description: 'Good' },
    { min: 55, max: 59.99, grade: 'B', gradePoint: 6, description: 'Above Average' },
    { min: 50, max: 54.99, grade: 'C', gradePoint: 5, description: 'Average' },
    { min: 40, max: 49.99, grade: 'P', gradePoint: 4, description: 'Pass' },
    { min: 0, max: 39.99, grade: 'F', gradePoint: 0, description: 'Fail' },
  ],
  passingRules: {
    minCIEPercent: 40,
    minSEEPercent: 35,
    minAggregatePercent: 40,
  },
  roundingDecimals: 2,
  fGradeCreditTreatment: 'retain_in_denominator',
  percentageFormula: (cgpa: number) => {
    if (isNaN(cgpa) || cgpa <= 0.75) return 0;
    const pct = (cgpa - 0.75) * 10;
    return Math.round((pct + Number.EPSILON) * 100) / 100;
  },
  percentageFormulaDescription: 'Percentage (%) = (CGPA - 0.75) × 10',
  officialRegulationUrl: 'https://vtu.ac.in/en/nep-2020-regulations',
  lastVerifiedAt: '2026-03-01',
};

// -----------------------------------------------------------------------------
// Canonical Academic Scheme Registry
// -----------------------------------------------------------------------------
export class AcademicSchemeRegistry {
  private static schemes: Map<string, AcademicScheme> = new Map([
    ['vtu-2018', VTU_2018_SCHEME],
    ['vtu-2021', VTU_2021_SCHEME],
    ['vtu-2022', VTU_2022_SCHEME],
    ['vtu-2025', VTU_2025_SCHEME],
  ]);

  /**
   * Retrieves scheme configuration by ID
   */
  public static getScheme(schemeId: string): AcademicScheme {
    const scheme = AcademicSchemeRegistry.schemes.get(schemeId);
    if (!scheme) {
      // Default to 2022 Scheme for unmatched queries
      return VTU_2022_SCHEME;
    }
    return scheme;
  }

  /**
   * Automatically detects the likely VTU scheme based on USN batch year
   * e.g. "1RV23CS001" -> Batch 2023 -> 2022 Scheme
   * e.g. "1RV20CS001" -> Batch 2020 -> 2018 Scheme
   */
  public static detectSchemeFromUSN(usn: string): AcademicScheme {
    if (!usn || typeof usn !== 'string') return VTU_2022_SCHEME;
    const clean = usn.trim().toUpperCase();

    // Match 2-digit batch year: e.g. 1RV23CS001 -> '23' -> 2023
    const match = clean.match(/^[1-4][A-Z]{2}(\d{2})/);
    if (match && match[1]) {
      const year = 2000 + parseInt(match[1], 10);
      if (year >= 2025) return VTU_2025_SCHEME;
      if (year >= 2022) return VTU_2022_SCHEME;
      if (year === 2021) return VTU_2021_SCHEME;
      if (year >= 2018) return VTU_2018_SCHEME;
    }

    return VTU_2022_SCHEME;
  }

  /**
   * Returns all registered academic schemes
   */
  public static getAllSchemes(): AcademicScheme[] {
    return Array.from(AcademicSchemeRegistry.schemes.values());
  }

  /**
   * Derives grade and grade point for marks percentage in a given scheme
   */
  public static deriveGrade(percentage: number, schemeId = 'vtu-2022'): { grade: string; gradePoint: number; description: string } {
    const scheme = AcademicSchemeRegistry.getScheme(schemeId);
    const pct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));

    for (const band of scheme.gradeBands) {
      if (pct >= band.min && (pct <= band.max || (band.max >= 99.99 && pct >= 99.99))) {
        return { grade: band.grade, gradePoint: band.gradePoint, description: band.description };
      }
    }

    return { grade: 'F', gradePoint: 0, description: 'Fail' };
  }
}
