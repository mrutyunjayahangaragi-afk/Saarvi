"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, File as FileIcon, X, AlertCircle, Info } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface FileDropzoneProps {
  supportedFormats?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
  actionLabel?: string;
  onFilesChanged?: (files: File[]) => void;
}

export default function FileDropzone({
  supportedFormats = ["PDF", "JPG", "PNG"],
  maxSizeMB = 25,
  multiple = false,
  actionLabel = "Process File",
  onFilesChanged
}: FileDropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPhaseNotice, setShowPhaseNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incoming: FileList | File[]) => {
    setErrorMessage(null);
    setShowPhaseNotice(false);
    const valid: File[] = [];

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];

      // Check max size
      if (file.size > maxSizeMB * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the ${maxSizeMB}MB file limit.`);
        return;
      }

      // Check format extension if supportedFormats is specified
      if (supportedFormats.length > 0) {
        const ext = file.name.split(".").pop()?.toUpperCase();
        const matches = supportedFormats.some((fmt) => fmt.toUpperCase() === ext);
        if (!matches && ext) {
          setErrorMessage(
            `"${file.name}" is not a supported format. Please select: ${supportedFormats.join(", ")}`
          );
          return;
        }
      }

      valid.push(file);
    }

    const updated = multiple ? [...files, ...valid] : valid.slice(0, 1);
    setFiles(updated);
    if (onFilesChanged) onFilesChanged(updated);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    if (onFilesChanged) onFilesChanged(updated);
    setShowPhaseNotice(false);
  };

  const handleActionClick = () => {
    // Honest phase notice - no fake conversion
    setShowPhaseNotice(true);
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload Box */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-2xl cursor-pointer text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50/50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          onChange={onInputChange}
          className="hidden"
          accept={supportedFormats.map((f) => `.${f.toLowerCase()}`).join(",")}
        />

        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600 mb-3">
          <Upload className="w-6 h-6" />
        </div>

        <h3 className="text-base font-semibold text-slate-800 mb-1">
          Drag & drop your {supportedFormats.join(" / ")} here
        </h3>
        <p className="text-xs text-slate-500 mb-4">or choose a file from your device</p>

        <button
          type="button"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          Choose File
        </button>

        <div className="mt-4 text-[11px] text-slate-400 font-medium">
          Supported: {supportedFormats.join(", ")} • Max size: {maxSizeMB}MB
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selected File Details */}
      {files.length > 0 && (
        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4">
          <div className="text-xs font-semibold text-slate-700">Selected File</div>

          <div className="space-y-2">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatBytes(file.size)} • {file.type || "Document"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white"
                  title="Remove file"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Action Button & Honest Phase 1 Indicator */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {actionLabel}
            </button>

            {showPhaseNotice && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2 animate-in fade-in">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Phase 1 UI Foundation Mode</div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    File selection and UI verification are fully functional. Production file processing engines are scheduled for Phase 2.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
