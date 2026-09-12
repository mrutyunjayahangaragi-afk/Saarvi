"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string;
}

export const GLOBAL_FAQS: FaqItem[] = [
  {
    question: "Do I need an account?",
    answer: "No. All core Saarvi document and image tools are fully accessible without creating an account or signing in."
  },
  {
    question: "Is Saarvi free?",
    answer:
      "Yes. The current suite of browser-based utilities is free to use without fees, watermarks, or subscription paywalls."
  },
  {
    question: "How does local processing work?",
    answer:
      "Supported tools use web technologies like WebAssembly, HTML5 Canvas, and modern browser engines to process your files entirely inside your device's memory. Your document bytes are never sent over the network to remote servers."
  },
  {
    question: "Can I use Saarvi on mobile?",
    answer:
      "Yes. Saarvi is designed mobile-first and works smoothly across mobile phones, tablets, and desktop browsers."
  },
  {
    question: "Will more tools be added?",
    answer:
      "Yes. The platform is continuously expanding with new document utilities, student helpers, and productivity tools."
  }
];

interface FaqAccordionProps {
  items?: FaqItem[];
  title?: string;
  description?: string;
}

export default function FaqAccordion({
  items = GLOBAL_FAQS,
  title = "Frequently Asked Questions",
  description = "Common questions about Saarvi and how our tools work."
}: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {title && (
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 pt-2">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="border border-slate-200/80 rounded-2xl bg-white shadow-2xs transition-all overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="w-full px-5 py-4 text-left font-semibold text-sm sm:text-base text-slate-800 flex items-center justify-between gap-4 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors cursor-pointer"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 animate-in fade-in duration-150">
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
