"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { revealDestination } from "@/lib/ux/action-destination";

export interface FaqItem {
  question: string;
  answer: string;
}

export const GLOBAL_FAQS: FaqItem[] = [
  {
    question: "Do I need an account to use Saarvi?",
    answer:
      "No. All core document and image tools are fully accessible without creating an account or signing in. You can convert, merge, compress, and edit files as a guest instantly."
  },
  {
    question: "Is Saarvi completely free?",
    answer:
      "Yes. Saarvi offers free guest and account access for everyday file conversions, calculators, and student tools. An optional Pro tier is available for users needing higher concurrent limits and expanded file capacities."
  },
  {
    question: "How does local browser-first processing work?",
    answer:
      "Supported tools (such as PDF to JPG, Merge PDF, Compress PDF, and Image to PDF) run directly inside your browser memory using WebAssembly and HTML5 Canvas. Your document bytes stay on your device and are never uploaded to remote servers. Server-processed conversions (like PDF to Excel) run in ephemeral, private containers that immediately delete temporary files after processing."
  },
  {
    question: "Can I use Saarvi on mobile devices?",
    answer:
      "Yes. Saarvi is mobile-first and responsive across smartphones, tablets, and desktop browsers without installing any apps."
  },
  {
    question: "How do Jobs & Internships work on Saarvi?",
    answer:
      "Verified job and internship listings are curated from vetted industry sources. Authenticated users can browse active opportunities, track applications, and apply directly via authoritative company career portals."
  },
  {
    question: "Are my uploaded files and data stored or trained on?",
    answer:
      "Never. Saarvi does not inspect, sell, retain, or train artificial intelligence models on your documents, resumes, images, or files. Privacy and data security are built into the platform architecture."
  }
];

interface FaqAccordionProps {
  items?: FaqItem[];
  eyebrow?: string;
  title?: string | null;
  description?: string | null;
}

export default function FaqAccordion({
  items = GLOBAL_FAQS,
  eyebrow,
  title,
  description,
}: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    const nextState = openIndex === index ? null : index;
    setOpenIndex(nextState);

    if (nextState !== null) {
      setTimeout(() => {
        const itemEl = document.getElementById(`faq-item-${index}`);
        if (itemEl) {
          revealDestination({
            target: itemEl,
            mode: "minimal",
            focus: false,
            behavior: "smooth",
            reason: "accordion_expand",
          });
        }
      }, 60);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(index);
    } else if (e.key === "Escape" && openIndex === index) {
      e.preventDefault();
      setOpenIndex(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {(eyebrow || title || description) && (
        <div className="text-center space-y-2">
          {eyebrow && (
            <span className="text-[11px] sm:text-xs font-bold tracking-widest text-blue-600 uppercase">
              {eyebrow}
            </span>
          )}
          {title && (
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 pt-2" role="region" aria-label="Frequently Asked Questions">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const buttonId = `faq-trigger-${index}`;
          const contentId = `faq-content-${index}`;

          return (
            <div
              key={index}
              id={`faq-item-${index}`}
              className="border border-slate-200/80 rounded-2xl bg-white shadow-2xs transition-all overflow-hidden saarvi-destination-target"
            >

              <button
                id={buttonId}
                type="button"
                onClick={() => toggle(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="w-full px-5 py-4 text-left font-semibold text-sm sm:text-base text-slate-800 flex items-center justify-between gap-4 hover:text-blue-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl transition-colors cursor-pointer"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                    isOpen ? "rotate-180 text-blue-600" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 animate-in fade-in duration-150 motion-reduce:animate-none"
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

