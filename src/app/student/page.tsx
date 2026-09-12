import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StudentPortalView from "./StudentPortalView";

import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Student Tools & VTU Academic Suite",
  description: "Official VTU 2022 Scheme SGPA/CGPA calculators, attendance planner, assignment tracker, and career preparation tools for engineering students.",
  path: "/student",
  keywords: ["vtu student tools", "vtu academic suite", "engineering calculators", "attendance planner", "vtu marks calculator"],
});

export default function StudentPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <StudentPortalView />
      </main>

      <Footer />
    </div>
  );
}
