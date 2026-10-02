"use client";

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, Lock, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { globalActionController } from "@/lib/ux/action-destination";

export interface SmartFileUploadProps {
  supportedFormats?: string[];
  maxSizeMB?: number;
  allowsMultiple?: boolean;
  onFilesAccepted: (files: File[]) => void;
  onError?: (errorMessage: string) => void;
  className?: string;
  label?: string;
  sublabel?: string;
  autoRevealDestination?: boolean;
}

/**
 * Saarvi SmartFileUpload Component (Section 41)
 * Standardized file upload handler providing:
 * 1. Immediate format & size validation
 * 2. Drag & drop with accessible file trigger
 * 3. Automatic viewport reveal of selected file / options section
 * 4. Automatic error reveal if invalid
 * 5. Screen reader aria-live announcements
 */
export default function SmartFileUpload({
  supportedFormats = [],
  maxSizeMB = 50,
  allowsMultiple = false,
  onFilesAccepted,
  onError,
  className = "",
  label,
  sublabel,
  autoRevealDestination = true,
}: SmartFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setErrorMessage(null);
    const valid: File[] = [];

    for (const file of rawFiles) {
      // 1. File size check
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        const err = `File "${file.name}" exceeds the maximum allowed size of ${maxSizeMB}MB.`;
        setErrorMessage(err);
        setStatusAnnouncement(err);
        onError?.(err);

        if (autoRevealDestination) {
          requestAnimationFrame(() => {
            globalActionController.revealError("#tool-error", {
              fallbackTarget: "[data-saarvi-target='tool-error']",
              reason: "file_size_exceeded",
            });
          });
        }
        return;
      }

      // 2. Format extension check
      if (supportedFormats.length > 0) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const mime = file.type.toLowerCase();
        const matchesExt = ext && supportedFormats.some((f) => f.toLowerCase() === ext);
        const matchesMime = supportedFormats.some((f) => mime.includes(f.toLowerCase()));

        if (!matchesExt && !matchesMime) {
          const err = `Unsupported format for "${file.name}". Supported: ${supportedFormats.join(", ")}`;
          setErrorMessage(err);
          setStatusAnnouncement(err);
          onError?.(err);

          if (autoRevealDestination) {
            requestAnimationFrame(() => {
              globalActionController.revealError("#tool-error", {
                fallbackTarget: "[data-saarvi-target='tool-error']",
                reason: "file_format_unsupported",
              });
            });
          }
          return;
        }
      }

      valid.push(file);
    }

    if (valid.length > 0) {
      const accepted = allowsMultiple ? valid : valid.slice(0, 1);
      const msg = `Accepted ${accepted.length} file${accepted.length > 1 ? "s" : ""}.`;
      setStatusAnnouncement(msg);
      onFilesAccepted(accepted);

      // Section 8 & 41: Auto-reveal selected file & options area
      if (autoRevealDestination) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            globalActionController.revealUpload("#selected-file-section", {
              fallbackTarget: "[data-saarvi-target='selected-file']",
              mode: "nearest",
              focus: false,
              reason: "files_selected_auto_reveal",
            });
          }, 60);
        });
      }
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatListString =
    supportedFormats.length > 0
      ? supportedFormats.map((f) => `.${f.toLowerCase()}`).join(",")
      : undefined;

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {/* Hidden screen reader live region for accessibility */}
      <div className="sr-only" role="status" aria-live="polite">
        {statusAnnouncement}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-saarvi-target="upload-box"
        className={`relative cursor-pointer rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 hover-3d-lift ${
          isDragging
            ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 shadow-lg scale-[1.01]"
            : "border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-[#111c38] hover:bg-slate-50 dark:hover:bg-[#162244] shadow-xs"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={allowsMultiple}
          accept={formatListString}
          onChange={handleInputChange}
          className="hidden"
          aria-label={label || `Upload ${allowsMultiple ? "files" : "file"}`}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs transition-transform duration-200 ${
              isDragging
                ? "bg-blue-600 text-white scale-110"
                : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800"
            }`}
          >
            <Upload className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
              {isDragging ? (
                <span className="text-blue-600 dark:text-blue-400">Drop files here</span>
              ) : (
                label || <span>Drop your {allowsMultiple ? "files" : "file"} here</span>
              )}
            </p>

            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">
              {sublabel || "or click to choose from your device"}
            </p>

            {!isDragging && (
              <div className="pt-2">
                <span className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs hover:shadow transition-all">
                  Choose File
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>100% Private · Processed locally in browser</span>
          </div>

          {supportedFormats.length > 0 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Supported: {supportedFormats.join(", ")} · Max {maxSizeMB}MB
            </p>
          )}
        </div>
      </div>

      {/* Inline Error Announcement with Auto-Focus */}
      {errorMessage && (
        <div
          id="tool-error"
          data-saarvi-target="tool-error"
          role="alert"
          tabIndex={-1}
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-3 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
