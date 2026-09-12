"use client";

import { useState } from "react";
import { Lock, Info, X, Server, RefreshCw } from "lucide-react";

export type PrivacyMode = "LOCAL" | "SERVER" | "MIXED" | "EXTERNAL";

interface PrivacyBadgeProps {
  mode?: PrivacyMode;
  className?: string;
}

export default function PrivacyBadge({ mode = "LOCAL", className = "" }: PrivacyBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const badgeStyle =
    mode === "EXTERNAL"
      ? "bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70"
      : "bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70";

  return (
    <>
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-2 shadow-2xs cursor-pointer ${badgeStyle}`}
          title="Click to view privacy details"
          aria-label="View privacy details"
        >
          {mode === "LOCAL" && <Lock className="w-3.5 h-3.5 text-emerald-600" />}
          {mode === "EXTERNAL" && <Server className="w-3.5 h-3.5 text-amber-600" />}
          {mode === "SERVER" && <Server className="w-3.5 h-3.5 text-blue-600" />}
          {mode === "MIXED" && <RefreshCw className="w-3.5 h-3.5 text-amber-600" />}

          <span>
            {mode === "LOCAL" && "Private processing • Your file stays on this device"}
            {mode === "EXTERNAL" && "External processing with explicit consent"}
            {mode === "SERVER" && "Server-side processing"}
            {mode === "MIXED" && "Hybrid local & server processing"}
          </span>

          <Info className={`w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity ${mode === "EXTERNAL" ? "text-amber-600" : "text-emerald-600"}`} />
        </button>
      </div>

      {/* Accessible Privacy Details Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 id="privacy-dialog-title" className="text-sm font-bold text-slate-900">
                  How Your Privacy Is Protected
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-900">100% In-Browser Execution:</strong> This tool runs entirely within your web browser using client-side JavaScript, WebAssembly, and standard HTML5 Canvas APIs.
              </p>
              <p>
                <strong className="text-slate-900">Zero Remote Uploads:</strong> Your documents and images are never transmitted over the network or saved to remote cloud servers for this tool.
              </p>
              <p>
                <strong className="text-slate-900">Browser Memory Usage:</strong> Document bytes exist temporarily in your device&apos;s working memory (RAM) while processing and are released when you close or refresh the tab.
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                Notice: Browser memory capacity depends on your hardware. Processing very large files may be constrained by your device&apos;s available RAM.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
