import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CategoryWorkspaceView from "@/components/tools/CategoryWorkspaceView";
import { createMetadata } from "@/lib/seo/metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = createMetadata({
  title: "Student Tools — Academic Calculators, Timetable & Study Suite | Saarvi",
  description: "Official VTU Scheme SGPA/CGPA calculators, timetable planner, assignment tracker, and student career tools. Built specifically for engineering and college student workflows.",
  path: "/student-tools",
  keywords: [
    "student tools",
    "sgpa calculator",
    "cgpa calculator",
    "marks calculator",
    "vtu engineering calculators",
    "study planner",
    "student resume builder",
    "attendance manager"
  ],
});

export default function StudentToolsCategoryPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Student Tools", url: "/student-tools" },
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-900 transition-colors duration-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <CategoryWorkspaceView
          category="student"
          title="Student Tools"
          tagline="Academic & Study Productivity"
          description="Academic, planning, and career tools designed around everyday student workflows. Deterministic syllabus credits, official grading formulas, and ATS resume tools."
          iconName="GraduationCap"
          popularKeys={["sgpa-calculator", "cgpa-calculator", "marks-calculator", "resume-builder"]}
          faqItems={[
            {
              q: "Are the SGPA formulas compliant with official VTU schemes?",
              a: "Yes. Our calculators implement official VTU 2022, 2021, and 2018 grading schemes with exact credit weights and grade point scales."
            },
            {
              q: "Can I save my calculated CGPA and semester records?",
              a: "Yes. When signed into your free Saarvi account, your semester grades and cumulative GPA sync automatically so you can track academic progress."
            },
            {
              q: "Does the Resume Builder produce ATS-compatible resumes?",
              a: "Yes! Every template in Saarvi Resume Builder is strictly ATS-scannable, using standard typographic headings, single-column linear flow, and clean PDF output."
            }
          ]}
        />
      </main>

      <Footer />
    </div>
  );
}
