import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { SearchableItem } from "@/lib/search/search-engine";

export interface DomainSearchItem extends SearchableItem {
  domain: "tools" | "academic" | "career" | "interview" | "guides" | "features";
}

export function getStaticDomainSearchItems(): DomainSearchItem[] {
  const items: DomainSearchItem[] = [];

  // 1. All Document, PDF & Image Tools from Canonical Registry
  for (const t of CANONICAL_TOOL_REGISTRY) {
    items.push({
      id: `tool_${t.key}`,
      title: t.name,
      description: t.description,
      category: t.category.toUpperCase(),
      domain: "tools",
      route: t.route,
      keywords: [
        t.key,
        t.category,
        ...(t.keywords || []),
      ].filter(Boolean),
      badge: t.badge || t.category.toUpperCase(),
    });
  }

  // 2. Academic & Engineering Student Tools
  const academicItems: DomainSearchItem[] = [
    {
      id: "acad_sgpa",
      title: "SGPA Calculator",
      description: "Deterministic semester SGPA computation across 2022 & 2025 engineering schemes.",
      category: "Academic",
      domain: "academic",
      route: "/student/sgpa-calculator",
      keywords: ["sgpa", "semester grade", "marks", "vtu", "cie", "see", "grading"],
      badge: "Academic",
    },
    {
      id: "acad_cgpa",
      title: "CGPA Calculator & Degree Percentage",
      description: "Cumulative GPA aggregator across completed semesters with percentage converter.",
      category: "Academic",
      domain: "academic",
      route: "/student/cgpa-calculator",
      keywords: ["cgpa", "percentage", "cumulative grade", "transcript", "conversion"],
      badge: "Academic",
    },
    {
      id: "acad_attendance",
      title: "Attendance Tracker & Margin Calculator",
      description: "Subject attendance tracker with safe skips and 75% margin recovery calculations.",
      category: "Academic",
      domain: "academic",
      route: "/student/attendance",
      keywords: ["attendance", "safe skips", "margin", "bunk calculator", "75 percent"],
      badge: "Attendance",
    },
    {
      id: "acad_curriculum",
      title: "Academic Curriculum & Syllabus",
      description: "Explore engineering courses, credits, and syllabus schemes from Semesters 1 to 8.",
      category: "Academic",
      domain: "academic",
      route: "/student",
      keywords: ["curriculum", "syllabus", "engineering courses", "credits", "semesters"],
      badge: "Curriculum",
    },
    {
      id: "acad_timetable",
      title: "Smart Timetable & Interval Collision Detector",
      description: "Interactive student schedule with conflict-free timetable intervals.",
      category: "Academic",
      domain: "academic",
      route: "/student/timetable",
      keywords: ["timetable", "schedule", "routine", "classes", "collision detection"],
      badge: "Productivity",
    },
    {
      id: "acad_copilot",
      title: "AI Student & Study Copilot",
      description: "Instant concept explanations, study schedules, and exam preparation assistance.",
      category: "Copilot",
      domain: "academic",
      route: "/student/copilot",
      keywords: ["ai copilot", "study assistant", "doubts", "revision", "exam help"],
      badge: "AI Copilot",
    },
  ];
  items.push(...academicItems);

  // 3. Career & Placement Suite
  const careerItems: DomainSearchItem[] = [
    {
      id: "car_resume",
      title: "Resume & CV Builder",
      description: "Build ATS-friendly technical resumes with real-time export and verified templates.",
      category: "Career",
      domain: "career",
      route: "/career/resume-builder",
      keywords: ["resume", "cv", "resume builder", "latex resume", "pdf resume", "career"],
      badge: "Career",
    },
    {
      id: "car_ats",
      title: "ATS Resume Analyzer & Score",
      description: "Deterministic 100-point structural ATS audit against engineering hiring criteria.",
      category: "Career",
      domain: "career",
      route: "/student/ats",
      keywords: ["ats", "resume score", "keyword match", "ats check", "applicant tracking"],
      badge: "ATS Tool",
    },
    {
      id: "car_skill_gap",
      title: "Skill Gap Analyzer",
      description: "Compare your resume skills against target job descriptions to identify missing keywords.",
      category: "Career",
      domain: "career",
      route: "/career/skill-gap",
      keywords: ["skill gap", "missing skills", "job match", "skills analysis"],
      badge: "Career",
    },
    {
      id: "car_cover_letter",
      title: "Cover Letter Generator",
      description: "Tailored engineering cover letters highlighting technical projects and achievements.",
      category: "Career",
      domain: "career",
      route: "/career/cover-letter",
      keywords: ["cover letter", "job application", "intro letter", "recruiter email"],
      badge: "Career",
    },
    {
      id: "car_job_tracker",
      title: "Job & Internship Tracker",
      description: "Track applications across wishlist, applied, interview, and offer stages.",
      category: "Career",
      domain: "career",
      route: "/career/job-tracker",
      keywords: ["job tracker", "internships", "applications", "interviews tracker"],
      badge: "Career",
    },
  ];
  items.push(...careerItems);

  // 4. Mock Interview 2.0
  const interviewItems: DomainSearchItem[] = [
    {
      id: "int_mock_hub",
      title: "Mock Interview 2.0",
      description: "Live WebRTC video interviews and timed 30s/60s MCQ assessments with verified sources.",
      category: "Interview",
      domain: "interview",
      route: "/student/copilot/interview",
      keywords: [
        "mock interview",
        "interview 2.0",
        "live interview",
        "mcq interview",
        "webrtc",
        "google interview",
        "amazon interview",
      ],
      badge: "Interview 2.0",
    },
    {
      id: "int_prep_hub",
      title: "Interview Question Bank & Concepts",
      description: "Curated DSA, OOP, DBMS, OS, Computer Networks, and Behavioral practice topics.",
      category: "Interview",
      domain: "interview",
      route: "/career/interview-prep",
      keywords: ["interview questions", "dsa", "oop", "dbms", "os", "system design", "star method"],
      badge: "Practice",
    },
  ];
  items.push(...interviewItems);

  // 5. Guides, Tutorials & Blog
  const guideItems: DomainSearchItem[] = [
    {
      id: "guide_pdf_jpg",
      title: "How to Convert PDF to JPG Fast",
      description: "Step-by-step browser guide for extracting high-resolution images from PDF files.",
      category: "Guides",
      domain: "guides",
      route: "/blog/how-to-convert-pdf-to-jpg",
      keywords: ["pdf to jpg guide", "extract images", "high resolution pdf", "tutorial"],
      badge: "Guide",
    },
    {
      id: "guide_compress_pdf",
      title: "How to Compress PDF Without Losing Quality",
      description: "Optimizing PDF file sizes for government portals and university upload limits.",
      category: "Guides",
      domain: "guides",
      route: "/blog/how-to-compress-pdf",
      keywords: ["compress pdf guide", "reduce pdf size", "mb to kb", "portal upload"],
      badge: "Guide",
    },
    {
      id: "guide_dsa",
      title: "Data Structures & Algorithms Roadmap",
      description: "Essential algorithms, pattern matching, graph traversal, and time complexities.",
      category: "Guides",
      domain: "guides",
      route: "/career/interview-prep",
      keywords: ["algorithms", "kmp", "bfs", "dfs", "dijkstra", "dynamic programming", "graphs"],
      badge: "DSA Notes",
    },
  ];
  items.push(...guideItems);

  // 6. Platform Features & Policies
  const featureItems: DomainSearchItem[] = [
    {
      id: "feat_pricing",
      title: "Saarvi Pro Pricing & Plans",
      description: "Transparent student pricing, lifetime academic workspace access, and Pro features.",
      category: "Features",
      domain: "features",
      route: "/pricing",
      keywords: ["pricing", "pro plan", "subscription", "upgrade", "billing"],
      badge: "Pro",
    },
    {
      id: "feat_privacy",
      title: "Privacy Policy & Private by Design Philosophy",
      description: "Zero server document uploads, local-first client processing, and strict data rights.",
      category: "Features",
      domain: "features",
      route: "/privacy",
      keywords: ["privacy", "security", "local first", "client side processing", "gdpr"],
      badge: "Security",
    },
    {
      id: "feat_terms",
      title: "Terms of Service",
      description: "Fair use rules, acceptable proctoring guidelines, and account standards.",
      category: "Features",
      domain: "features",
      route: "/terms",
      keywords: ["terms", "conditions", "service agreement", "legal"],
      badge: "Legal",
    },
  ];
  items.push(...featureItems);

  return items;
}
