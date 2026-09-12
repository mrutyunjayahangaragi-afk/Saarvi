import { VTUSchemeOption } from "@/types/student";

export const VTU_METADATA = {
  university: "Visvesvaraya Technological University",
  universityShort: "VTU",
  location: "Belagavi, Karnataka, India",
  primarySourceUrl: "https://vtu.ac.in/b-e-scheme-syllabus/",
  regulationsTitle: "VTU Regulations Governing Bachelor of Engineering (B.E.) Under Choice Based Credit System (CBCS) / NEP 2020",
  retrievedAt: "2024-08-01",
};

export const AVAILABLE_VTU_SCHEMES: VTUSchemeOption[] = [
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
  },
  {
    id: "2025",
    name: "2025 Scheme (Draft / Extensible)",
    year: "2025",
    branches: [
      {
        id: "CSE",
        name: "Computer Science & Engineering",
        code: "CSE",
        availableSemesters: [1, 2],
      },
    ],
  },
];
