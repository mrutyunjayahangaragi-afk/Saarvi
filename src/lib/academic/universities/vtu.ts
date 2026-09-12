import { UniversityAcademicConfig, GradingBand } from "../types";

/**
 * Official VTU 2022 Scheme Grading Scale
 * Source: VTU Regulations Governing Bachelor of Engineering (B.E.) CBCS / NEP 2020
 */
export const VTU_GRADING_BANDS: GradingBand[] = [
  { min: 90, max: 100, grade: "O", gradePoint: 10, description: "Outstanding" },
  { min: 80, max: 89.99, grade: "A+", gradePoint: 9, description: "Excellent" },
  { min: 70, max: 79.99, grade: "A", gradePoint: 8, description: "Very Good" },
  { min: 60, max: 69.99, grade: "B+", gradePoint: 7, description: "Good" },
  { min: 55, max: 59.99, grade: "B", gradePoint: 6, description: "Above Average" },
  { min: 50, max: 54.99, grade: "C", gradePoint: 5, description: "Average" },
  { min: 40, max: 49.99, grade: "P", gradePoint: 4, description: "Pass" },
  { min: 0, max: 39.99, grade: "F", gradePoint: 0, description: "Fail" },
];

/**
 * Official VTU 2022 Scheme Percentage Conversion:
 * Formula: Percentage = (CGPA - 0.75) * 10 (applicable for CGPA >= 0.75)
 */
export function calculateVTUPercentage(cgpa: number): number {
  if (isNaN(cgpa) || cgpa <= 0.75) return 0;
  const pct = (cgpa - 0.75) * 10;
  return Math.round(Math.min(100, pct) * 100) / 100;
}

export const VTU_ACADEMIC_CONFIG: UniversityAcademicConfig = {
  id: "VTU",
  name: "Visvesvaraya Technological University",
  shortName: "VTU",
  country: "India",
  location: "Belagavi, Karnataka",
  primarySourceUrl: "https://vtu.ac.in/b-e-scheme-syllabus/",
  regulationsTitle:
    "VTU Regulations Governing Bachelor of Engineering (B.E.) Under Choice Based Credit System (CBCS) / NEP 2020",
  schemes: [
    {
      id: "2022",
      name: "2022 Scheme (CBCS / NEP)",
      year: "2022",
      branches: [
        {
          id: "CSE",
          name: "Computer Science & Engineering",
          code: "CSE",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: "ISE",
          name: "Information Science & Engineering",
          code: "ISE",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: "AIML",
          name: "Artificial Intelligence & Machine Learning",
          code: "AIML",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: "ECE",
          name: "Electronics & Communication Engineering",
          code: "ECE",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
      ],
      defaultCreditsPerSemester: {
        1: 20,
        2: 20,
        3: 20,
        4: 20,
        5: 22,
        6: 22,
        7: 20,
        8: 16,
      },
    },
    {
      id: "2025",
      name: "2025 Scheme (CBCS / NEP 2020 Revised)",
      year: "2025",
      branches: [
        {
          id: "CSE",
          name: "Computer Science & Engineering",
          code: "CSE",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: "ISE",
          name: "Information Science & Engineering",
          code: "ISE",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: "AIML",
          name: "Artificial Intelligence & Machine Learning",
          code: "AIML",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: "ECE",
          name: "Electronics & Communication Engineering",
          code: "ECE",
          availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        },
      ],
      defaultCreditsPerSemester: {
        1: 20,
        2: 20,
        3: 20,
        4: 20,
        5: 20,
        6: 20,
        7: 20,
        8: 20,
      },
    },
  ],
  gradingBands: VTU_GRADING_BANDS,
  calculationRules: {
    roundingDecimals: 2,
    fGradeTreatment: "retain_credits",
    percentageFormula: calculateVTUPercentage,
    percentageFormulaDescription: "VTU 2022 Official Formula: (CGPA - 0.75) × 10",
  },
};
