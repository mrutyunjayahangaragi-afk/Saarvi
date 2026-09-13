"use client";

import { useState, useRef, ChangeEvent, DragEvent, useEffect, useMemo } from "react";
import {
  Upload,
  File as FileIcon,
  FileText,
  ArrowUp,
  ArrowDown,
  Settings,
  AlertCircle,
  Play,
  Lock,
  Zap,
  Download as DownloadIcon,
  UserCheck
} from "lucide-react";
import { ToolDefinition } from "@/types/tool";
import { getToolOperation } from "@/lib/tools/registry";
import { SingleFileResult, MultiFileResult } from "@/lib/tools/types";
import { formatBytes } from "@/lib/utils";
import ProcessingProgress, { ProcessingState } from "@/components/common/ProcessingProgress";
import ResultDownload from "@/components/common/ResultDownload";
import { validateToolOutput } from "@/lib/tools/validation";
import { ERROR_MESSAGES } from "@/config/limits";
import { conversionHistoryService } from "@/lib/services/conversionHistoryService";
import { adminService } from "@/lib/services/adminService";
import { useAuth } from "@/context/AuthContext";
import { planService } from "@/lib/services/planService";
import UpgradePrompt from "@/components/plan/UpgradePrompt";
import Link from "next/link";
import { validateInputFile, sanitizeFilename as sanitizeSafeFilename } from "@/lib/security/file-security";

interface SelectedFileItemProps {
  file: File;
  index: number;
  totalFiles: number;
  allowsMultiple: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SelectedFileItem({
  file,
  index,
  totalFiles,
  allowsMultiple,
  onRemove,
  onMoveUp,
  onMoveDown
}: SelectedFileItemProps) {
  const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isDocx = /\.docx$/i.test(file.name) || file.type.includes("word") || file.type.includes("officedocument");

  const previewUrl = useMemo(() => {
    if (isImage) {
      try {
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    }
    return null;
  }, [file, isImage]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [previewUrl]);

  return (
    <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 transition-all hover:border-slate-300">
      <div className="flex items-center gap-3.5 min-w-0 pr-2">
        {/* Preview: Thumbnail for image, icon for PDF / Word */}
        {previewUrl ? (
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shrink-0">
            {isPdf ? (
              <FileText className="w-6 h-6 text-red-500" />
            ) : isDocx ? (
              <FileText className="w-6 h-6 text-blue-600" />
            ) : (
              <FileIcon className="w-6 h-6" />
            )}
          </div>
        )}

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold text-xs">✓</span>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
              {file.name}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="font-mono">{formatBytes(file.size)}</span>
            <span>•</span>
            <span className="uppercase font-medium">{file.name.split(".").pop() || "File"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {allowsMultiple && (
          <div className="flex items-center gap-1 mr-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={onMoveUp}
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded-lg hover:bg-slate-200 transition-colors"
              title="Move Up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={index === totalFiles - 1}
              onClick={onMoveDown}
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded-lg hover:bg-slate-200 transition-colors"
              title="Move Down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="px-2.5 py-1 text-xs text-slate-500 hover:text-red-600 font-medium rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

interface ToolRunnerProps {
  tool: ToolDefinition;
}

export default function ToolRunner({ tool }: ToolRunnerProps) {
  const [runtimeStatus, setRuntimeStatus] = useState<ToolDefinition['status']>(tool.status);
  const [runtimeMaxSizeMB, setRuntimeMaxSizeMB] = useState<number>(tool.maxSizeMB);

  useEffect(() => {
    adminService.getEffectiveTool(tool.slug).then((eff) => {
      if (eff) {
        setRuntimeStatus(eff.status);
        setRuntimeMaxSizeMB(eff.maxSizeMB);
      }
    }).catch(() => {});
  }, [tool.slug, tool.status, tool.maxSizeMB]);

  const { user } = useAuth();
  const entitlement = planService.canUseTool(tool.slug, user);
  const userPlan = planService.getUserPlan(user);
  const planLimits = planService.getPlanLimits(userPlan);

  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<ProcessingState>("IDLE");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SingleFileResult | MultiFileResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef(false);

  // --- Tool-specific configuration states ---
  // Image to PDF / Multi-image
  const [pageSize, setPageSize] = useState<"a4" | "letter" | "fit">("a4");
  const [margin, setMargin] = useState<"none" | "small" | "normal">("small");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");

  // Format converter (PNG to JPG / WebP to JPG)
  const [quality, setQuality] = useState(92);

  // Image Resize
  const [origDimensions, setOrigDimensions] = useState<{ width: number; height: number } | null>(null);
  const [targetWidth, setTargetWidth] = useState(1920);
  const [targetHeight, setTargetHeight] = useState(1080);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [resizeFormat, setResizeFormat] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");

  // Image Crop
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(800);
  const [cropHeight, setCropHeight] = useState(600);
  const [cropAspectPreset, setCropAspectPreset] = useState<"free" | "1:1" | "4:3" | "16:9">("free");
  const [cropFormat, setCropFormat] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [cropQuality, setCropQuality] = useState(90);

  // Rotate & Flip Image
  const [imgRotateAngle, setImgRotateAngle] = useState<0 | 90 | 180 | 270>(90);
  const [imgFlipAxis, setImgFlipAxis] = useState<"none" | "horizontal" | "vertical" | "both">("none");
  const [imgRotateFormat, setImgRotateFormat] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [imgRotateQuality, setImgRotateQuality] = useState(90);

  // Compress Image
  const [imgCompressQuality, setImgCompressQuality] = useState(75);
  const [imgCompressFormat, setImgCompressFormat] = useState<"image/jpeg" | "image/webp" | "image/png">("image/jpeg");

  // PDF to JPG
  const [pdfScale, setPdfScale] = useState<number>(1.5);
  const [pdfJpgPages, setPdfJpgPages] = useState<string>("");

  // PDF to PNG
  const [pdfPngScale, setPdfPngScale] = useState<number>(1.5);
  const [pdfPngPages, setPdfPngPages] = useState<string>("");

  // Split PDF
  const [splitMode, setSplitMode] = useState<"range" | "all">("range");
  const [splitRange, setSplitRange] = useState("1-3");

  // Extract PDF pages
  const [extractRange, setExtractRange] = useState("1-2");

  // Delete PDF pages
  const [deletePagesRange, setDeletePagesRange] = useState("2");

  // Reorder PDF pages
  const [reorderPagesString, setReorderPagesString] = useState("1");

  // Rotate PDF
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [rotateScope, setRotateScope] = useState<"all" | "selected">("all");
  const [rotateRange, setRotateRange] = useState("1");

  // Compress PDF
  const [compressPreset, setCompressPreset] = useState<"low" | "balanced" | "high">("balanced");

  const allowsMultiple =
    tool.slug === "multiple-images-to-pdf" ||
    tool.slug === "merge-pdf" ||
    tool.slug === "notes-to-pdf";

  // When a file is selected for image operations, auto-detect dimensions
  useEffect(() => {
    if (
      (tool.slug === "image-resize" ||
        tool.slug === "crop-image" ||
        tool.slug === "rotate-image" ||
        tool.slug === "compress-image") &&
      files.length > 0
    ) {
      const file = files[0];
      if (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          setOrigDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          if (tool.slug === "image-resize") {
            setTargetWidth(img.naturalWidth);
            setTargetHeight(img.naturalHeight);
          } else if (tool.slug === "crop-image") {
            setCropX(0);
            setCropY(0);
            setCropWidth(img.naturalWidth);
            setCropHeight(img.naturalHeight);
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
    }
  }, [files, tool.slug]);

  const applyCropPreset = (preset: "free" | "1:1" | "4:3" | "16:9") => {
    setCropAspectPreset(preset);
    if (!origDimensions) return;
    const { width: W, height: H } = origDimensions;

    if (preset === "free") {
      setCropX(0);
      setCropY(0);
      setCropWidth(W);
      setCropHeight(H);
      return;
    }

    let targetRatio = 1;
    if (preset === "1:1") targetRatio = 1;
    if (preset === "4:3") targetRatio = 4 / 3;
    if (preset === "16:9") targetRatio = 16 / 9;

    let newW = W;
    let newH = Math.round(W / targetRatio);

    if (newH > H) {
      newH = H;
      newW = Math.round(H * targetRatio);
    }

    const newX = Math.max(0, Math.floor((W - newW) / 2));
    const newY = Math.max(0, Math.floor((H - newH) / 2));

    setCropX(newX);
    setCropY(newY);
    setCropWidth(newW);
    setCropHeight(newH);
  };

  const handleFilesAdded = async (incoming: FileList | File[]) => {
    setErrorMessage(null);
    const valid: File[] = [];

    const maxBatch = planLimits.maxBatchFiles || 10;
    const prospectiveCount = allowsMultiple ? files.length + incoming.length : incoming.length;
    if (allowsMultiple && prospectiveCount > maxBatch) {
      setErrorMessage(
        `Batch limit exceeded: You can select up to ${maxBatch} files on your ${userPlan.toUpperCase()} plan. Upgrade to Pro for higher batch limits.`
      );
      return;
    }

    for (let i = 0; i < incoming.length; i++) {
      const rawFile = incoming[i];
      const cleanName = sanitizeSafeFilename(rawFile.name);
      const file =
        cleanName !== rawFile.name
          ? new File([rawFile], cleanName, { type: rawFile.type, lastModified: rawFile.lastModified })
          : rawFile;

      // Format check
      if (tool.supportedFormats.length > 0) {
        const ext = file.name.split(".").pop()?.toUpperCase() || "";
        const matches = tool.supportedFormats.some(
          (fmt) => fmt.toUpperCase() === ext || (fmt === "JPG" && ext === "JPEG")
        );
        if (!matches) {
          setErrorMessage(ERROR_MESSAGES.UNSUPPORTED_FORMAT(file.name, tool.supportedFormats));
          return;
        }
      }

      // Max size check (enforcing single source of truth from runtime admin config & plan limits)
      const effectiveMaxMB = Math.min(runtimeMaxSizeMB || tool.maxSizeMB, planLimits.maxFileSizeMB || 50);
      if (file.size > effectiveMaxMB * 1024 * 1024) {
        setErrorMessage(ERROR_MESSAGES.FILE_TOO_LARGE(file.name, effectiveMaxMB));
        return;
      }

      // Real magic-byte binary signature inspection
      const validation = await validateInputFile(
        file,
        tool.supportedFormats.length > 0 ? tool.supportedFormats : undefined,
        effectiveMaxMB * 1024 * 1024
      );
      if (!validation.valid) {
        setErrorMessage(validation.error || "File security validation failed.");
        return;
      }

      valid.push(file);
    }

    const updated = allowsMultiple ? [...files, ...valid] : valid.slice(0, 1);
    setFiles(updated);
    setState(updated.length > 0 ? "FILE_SELECTED" : "IDLE");
  };

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    if (updated.length === 0) {
      setState("IDLE");
      setOrigDimensions(null);
    } else {
      setState("FILE_SELECTED");
    }
  };

  const moveFile = (idx: number, direction: "up" | "down") => {
    if (
      (direction === "up" && idx === 0) ||
      (direction === "down" && idx === files.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const reordered = [...files];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setFiles(reordered);
  };

  const resetAll = () => {
    isCancelledRef.current = true;
    setFiles([]);
    setResult(null);
    setState("IDLE");
    setProgress(0);
    setErrorMessage(null);
    setOrigDimensions(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Execute Real Operation
  const runOperation = async () => {
    isCancelledRef.current = false;
    const operation = getToolOperation(tool.slug);
    if (!operation) {
      setErrorMessage(`Tool operation for "${tool.name}" is not registered.`);
      setState("ERROR");
      return;
    }

    if (files.length === 0) {
      setErrorMessage("Please select at least one file to process.");
      setState("ERROR");
      return;
    }

    setState("VALIDATING");
    setErrorMessage(null);

    // Build configuration object matching the tool
    let config: Record<string, unknown> = {};
    if (tool.slug === "png-to-jpg" || tool.slug === "webp-to-jpg") {
      config = { targetFormat: "image/jpeg", quality: quality / 100, backgroundColor: "#ffffff" };
    } else if (tool.slug === "jpg-to-png" || tool.slug === "webp-to-png") {
      config = { targetFormat: "image/png" };
    } else if (tool.slug === "image-resize") {
      config = {
        targetWidth: Number(targetWidth),
        targetHeight: Number(targetHeight),
        format: resizeFormat,
        quality: quality / 100,
        maintainAspectRatio: maintainAspect
      };
    } else if (tool.slug === "crop-image") {
      config = {
        x: Number(cropX),
        y: Number(cropY),
        cropWidth: Number(cropWidth),
        cropHeight: Number(cropHeight),
        outputFormat: cropFormat,
        quality: cropQuality / 100
      };
    } else if (tool.slug === "rotate-image") {
      config = {
        angle: imgRotateAngle,
        flip: imgFlipAxis,
        outputFormat: imgRotateFormat,
        quality: imgRotateQuality / 100
      };
    } else if (tool.slug === "compress-image") {
      config = {
        quality: imgCompressQuality / 100,
        outputFormat: imgCompressFormat
      };
    } else if (tool.slug === "jpg-to-pdf" || tool.slug === "image-to-pdf" || tool.slug === "multiple-images-to-pdf") {
      config = { pageSize, margin, orientation };
    } else if (tool.slug === "pdf-to-jpg") {
      const selectedPages = pdfJpgPages.trim()
        ? pdfJpgPages
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        : undefined;
      config = { scale: pdfScale, quality: 0.9, selectedPages };
    } else if (tool.slug === "pdf-to-png") {
      const selectedPages = pdfPngPages.trim()
        ? pdfPngPages
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        : undefined;
      config = { scale: pdfPngScale, selectedPages };
    } else if (tool.slug === "split-pdf") {
      config = { mode: splitMode, rangeString: splitRange };
    } else if (tool.slug === "extract-pdf-pages") {
      config = { rangeString: extractRange };
    } else if (tool.slug === "delete-pdf-pages") {
      config = { rangeString: deletePagesRange };
    } else if (tool.slug === "reorder-pdf-pages") {
      const newOrder = reorderPagesString
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      config = { newOrder };
    } else if (tool.slug === "rotate-pdf") {
      config = {
        angle: rotateAngle,
        pagesMode: rotateScope,
        selectedRange: rotateScope === "selected" ? rotateRange : undefined
      };
    } else if (tool.slug === "compress-pdf") {
      config = { preset: compressPreset };
    }

    // Engine validation
    const val = operation.validate(files, config as never);
    if (!val.valid) {
      setErrorMessage(val.error || "Validation failed.");
      setState("ERROR");
      return;
    }

    setState("PROCESSING");
    setProgress(5);
    const startTime = performance.now();

    try {
      const res = await operation.execute(files, config as never, (pct: number) => {
        if (!isCancelledRef.current) {
          setProgress(pct);
        }
      });

      if (isCancelledRef.current) return;

      // Phase 16 Output Validation Engine Check
      const valRes = await validateToolOutput(res);
      if (!valRes.valid) {
        throw new Error(valRes.error || "Processing failed. Your original file was not changed.");
      }

      if (isCancelledRef.current) return;

      const durationMs = Math.round(performance.now() - startTime);
      setResult(res);
      setState("RESULT_READY");

      // Asynchronously record conversion metadata for authenticated users (NON-BLOCKING)
      // Privacy guaranteed: Zero document bytes, text, or file contents are sent
      const inputFilename = files.length === 1 ? files[0].name : `${files.length} files`;
      const outputFilename = res.type === "single" ? res.filename : res.zipFilename;
      const inputSize = files.reduce((acc, f) => acc + f.size, 0);
      const outputSize = res.type === "single" ? res.blob.size : res.zipBlob.size;

      conversionHistoryService.recordConversion({
        toolId: tool.id,
        toolName: tool.name,
        inputFilename,
        outputFilename,
        inputSize,
        outputSize,
        status: "Completed",
        processingTimeMs: durationMs,
      }).catch((histErr) => {
        console.warn("Non-blocking conversion history notice:", histErr);
      });
    } catch (err: unknown) {
      if (isCancelledRef.current) return;
      console.error("Local tool processing error:", err);
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.GENERIC_PROCESSING_ERROR;
      setErrorMessage(msg);
      setState("ERROR");
    }
  };

  // If tool requires authentication or is a planned Pro feature
  if (!entitlement.allowed) {
    if (entitlement.reason === "pro_required" || entitlement.reason === "coming_soon") {
      return (
        <UpgradePrompt
          reason={entitlement.reason}
          customMessage={entitlement.message}
        />
      );
    }
    if (entitlement.reason === "login_required") {
      return (
        <UpgradePrompt
          reason="login_required"
          customMessage={entitlement.message}
        />
      );
    }
  }

  // If tool is DISABLED by admin (Section 16)
  if (runtimeStatus === "disabled" || (!entitlement.allowed && entitlement.reason === "disabled")) {
    return (
      <div className="p-8 rounded-3xl border-2 border-dashed border-red-200 bg-red-50/50 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-base font-bold text-slate-800">
            This tool is temporarily unavailable.
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            This utility has been temporarily disabled by an administrator. Please check back shortly or explore other available tools.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            Explore available tools
          </Link>
        </div>
      </div>
    );
  }

  // If tool is in MAINTENANCE by admin (Section 17)
  if (runtimeStatus === "maintenance" || (!entitlement.allowed && entitlement.reason === "maintenance")) {
    return (
      <div className="p-8 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/50 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-base font-bold text-slate-800">
            This tool is temporarily unavailable while we improve it.
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            We are performing scheduled maintenance on this specific tool. Unrelated tools continue working normally.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            Explore available tools
          </Link>
        </div>
      </div>
    );
  }

  if (state === "RESULT_READY" && result) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <ResultDownload result={result} onReset={resetAll} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PROCESSING STATE OR DROPZONE (Transforms in-place) */}
      {state === "PROCESSING" || state === "VALIDATING" ? (
        <ProcessingProgress
          state={state}
          percent={progress}
          errorMessage={errorMessage || undefined}
          onCancel={() => {
            isCancelledRef.current = true;
            setState("IDLE");
            setProgress(0);
          }}
        />
      ) : (
        /* Dropzone & File Selection with 3D tactile depth */
        <div
          onDragOver={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesAdded(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-3xl border-2 border-dashed p-10 sm:p-12 text-center transition-all duration-200 hover-3d-lift ${
            isDragging
              ? "border-blue-600 bg-blue-50/80 shadow-lg scale-[1.01]"
              : "border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50 shadow-xs"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={
              tool.supportedFormats.length > 0
                ? tool.supportedFormats.map((f) => `.${f.toLowerCase()}`).join(",")
                : undefined
            }
            multiple={allowsMultiple}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(e.target.files);
              }
            }}
            className="hidden"
          />

          <div className="mx-auto flex flex-col items-center justify-center space-y-4">
            {/* Upload Arrow Icon */}
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-xs ${
                isDragging
                  ? "bg-blue-600 text-white scale-110 shadow-md"
                  : "bg-blue-50 text-blue-600 border border-blue-200/60"
              }`}
            >
              <Upload className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <p className="text-base sm:text-lg font-bold text-slate-800">
                {isDragging ? (
                  <span className="text-blue-600">Drop it here</span>
                ) : (
                  <span>Drop your {allowsMultiple ? "files" : "file"} here</span>
                )}
              </p>

              {!isDragging && (
                <>
                  <p className="text-xs text-slate-400 font-medium">or</p>
                  <div className="pt-1">
                    <span className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs hover:shadow transition-all">
                      Choose File
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Privacy indicator inside dropzone */}
            <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Processed in browser</span>
            </div>
          </div>
        </div>
      )}

      {/* Trust & Privacy Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs text-slate-600">
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-[11px] sm:text-xs">Private processing</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-[11px] sm:text-xs">Fast browser processing</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <DownloadIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-semibold text-[11px] sm:text-xs">Automatic download</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <UserCheck className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="font-semibold text-[11px] sm:text-xs">No account required</span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs shadow-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Selected File(s) Visual Card */}
      {files.length > 0 && state !== "PROCESSING" && state !== "VALIDATING" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Selected {allowsMultiple ? `Files (${files.length})` : "File"}
              </h4>
            </div>
            {allowsMultiple && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                + Add more files
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {files.map((file, idx) => (
              <SelectedFileItem
                key={`${file.name}-${idx}`}
                file={file}
                index={idx}
                totalFiles={files.length}
                allowsMultiple={allowsMultiple}
                onRemove={() => removeFile(idx)}
                onMoveUp={() => moveFile(idx, "up")}
                onMoveDown={() => moveFile(idx, "down")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tool-Specific Options Panel */}
      {files.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 uppercase tracking-wider">
            <Settings className="w-4 h-4 text-blue-600" />
            Conversion Options
          </div>

          {/* PNG to JPG Options */}
          {tool.slug === "png-to-jpg" && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Notice: Transparent background areas will automatically fill with solid white.
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 flex justify-between">
                  <span>JPEG Quality</span>
                  <span className="font-semibold text-blue-600">{quality}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full mt-1.5 accent-blue-600"
                />
              </div>
            </div>
          )}

          {/* JPG to PNG Options */}
          {tool.slug === "jpg-to-png" && (
            <p className="text-xs text-slate-600">
              Lossless export: Preserves exact pixel fidelity and prevents re-compression artifacts.
            </p>
          )}

          {/* Image to PDF / Multiple Images to PDF Options */}
          {(tool.slug === "jpg-to-pdf" ||
            tool.slug === "image-to-pdf" ||
            tool.slug === "multiple-images-to-pdf") && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as "a4" | "letter" | "fit")}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="fit">Fit to Image Size</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Margins</label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(e.target.value as "none" | "small" | "normal")}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="none">No Margin (Border to border)</option>
                  <option value="small">Small Margin (20pt)</option>
                  <option value="normal">Normal Margin (40pt)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Orientation</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as "auto" | "portrait" | "landscape")}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="auto">Auto (Match Image)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          )}

          {/* Image Resize Options */}
          {tool.slug === "image-resize" && (
            <div className="space-y-4">
              {origDimensions && (
                <div className="text-xs text-slate-500">
                  Original dimensions:{" "}
                  <span className="font-semibold text-slate-700">
                    {origDimensions.width} × {origDimensions.height} px
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Width (px)</label>
                  <input
                    type="number"
                    min="1"
                    value={targetWidth}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      setTargetWidth(w);
                      if (maintainAspect && origDimensions && origDimensions.width > 0) {
                        const ratio = origDimensions.height / origDimensions.width;
                        setTargetHeight(Math.round(w * ratio));
                      }
                    }}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Height (px)</label>
                  <input
                    type="number"
                    min="1"
                    value={targetHeight}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setTargetHeight(h);
                      if (maintainAspect && origDimensions && origDimensions.height > 0) {
                        const ratio = origDimensions.width / origDimensions.height;
                        setTargetWidth(Math.round(h * ratio));
                      }
                    }}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintainAspect}
                    onChange={(e) => setMaintainAspect(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Lock Aspect Ratio</span>
                </label>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Scale:</span>
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        if (origDimensions) {
                          setTargetWidth(Math.round(origDimensions.width * (pct / 100)));
                          setTargetHeight(Math.round(origDimensions.height * (pct / 100)));
                        }
                      }}
                      className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Output Format</label>
                  <select
                    value={resizeFormat}
                    onChange={(e) =>
                      setResizeFormat(e.target.value as "image/jpeg" | "image/png" | "image/webp")
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="image/jpeg">JPEG (.jpg)</option>
                    <option value="image/png">PNG (.png)</option>
                    <option value="image/webp">WebP (.webp)</option>
                  </select>
                </div>

                {resizeFormat !== "image/png" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Quality ({quality}%)
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full accent-blue-600 mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PDF to JPG Options */}
          {tool.slug === "pdf-to-jpg" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Resolution Scale</label>
                <select
                  value={pdfScale}
                  onChange={(e) => setPdfScale(Number(e.target.value))}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                >
                  <option value={1.0}>Standard (72-96 DPI, Faster)</option>
                  <option value={1.5}>Medium (150 DPI, Recommended)</option>
                  <option value={2.0}>High (300 DPI, Sharp Print)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pages to Render (optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for all pages, or e.g. 1, 3, 5"
                  value={pdfJpgPages}
                  onChange={(e) => setPdfJpgPages(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Split PDF Options */}
          {tool.slug === "split-pdf" && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSplitMode("range")}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    splitMode === "range"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Extract Page Range
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("all")}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    splitMode === "all"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Separate Every Page (ZIP)
                </button>
              </div>

              {splitMode === "range" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Page Range (e.g. 1-3, 5)
                  </label>
                  <input
                    type="text"
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                    placeholder="1-3, 5"
                  />
                </div>
              )}
            </div>
          )}

          {/* Extract PDF Pages Options */}
          {tool.slug === "extract-pdf-pages" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pages to Extract (e.g. 2, 5, 8-10)
              </label>
              <input
                type="text"
                value={extractRange}
                onChange={(e) => setExtractRange(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                placeholder="2, 5, 8-10"
              />
            </div>
          )}

          {/* Rotate PDF Options */}
          {tool.slug === "rotate-pdf" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Rotation Angle</label>
                <div className="flex gap-2">
                  {[
                    { angle: 90, label: "90° Clockwise" },
                    { angle: 180, label: "180° Flip" },
                    { angle: 270, label: "270° (90° Counter-Clockwise)" }
                  ].map((item) => (
                    <button
                      key={item.angle}
                      type="button"
                      onClick={() => setRotateAngle(item.angle as 90 | 180 | 270)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        rotateAngle === item.angle
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Apply To</label>
                  <select
                    value={rotateScope}
                    onChange={(e) => setRotateScope(e.target.value as "all" | "selected")}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="all">All Pages</option>
                    <option value="selected">Selected Pages</option>
                  </select>
                </div>

                {rotateScope === "selected" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Page Numbers (e.g. 1, 3-5)
                    </label>
                    <input
                      type="text"
                      value={rotateRange}
                      onChange={(e) => setRotateRange(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                      placeholder="1, 3-5"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compress PDF Options */}
          {tool.slug === "compress-pdf" && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">Compression Preset</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "low",
                    name: "Low Compression",
                    desc: "Higher image quality, mild size reduction"
                  },
                  {
                    id: "balanced",
                    name: "Balanced",
                    desc: "Optimal balance of clarity and byte savings"
                  },
                  {
                    id: "high",
                    name: "High Compression",
                    desc: "Maximum size reduction, lower raster quality"
                  }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCompressPreset(preset.id as "low" | "balanced" | "high")}
                    className={`p-3 text-left rounded-xl border transition-all ${
                      compressPreset === preset.id
                        ? "bg-blue-50/70 border-blue-600 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{preset.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Note: Client-side compression optimizes embedded raster images. Vector-only documents may experience smaller percentage changes.
              </p>
            </div>
          )}

          {/* WebP to JPG Options */}
          {tool.slug === "webp-to-jpg" && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Notice: Transparent background areas will automatically fill with solid white.
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 flex justify-between">
                  <span>JPEG Quality</span>
                  <span className="font-semibold text-blue-600">{quality}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full mt-1.5 accent-blue-600"
                />
              </div>
            </div>
          )}

          {/* WebP to PNG Options */}
          {tool.slug === "webp-to-png" && (
            <p className="text-xs text-slate-600">
              Lossless export: Preserves transparent alpha channel and pixel-perfect fidelity.
            </p>
          )}

          {/* Crop Image Options */}
          {tool.slug === "crop-image" && (
            <div className="space-y-4">
              {origDimensions && (
                <div className="text-xs text-slate-500">
                  Image dimensions:{" "}
                  <span className="font-semibold text-slate-700">
                    {origDimensions.width} × {origDimensions.height} px
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Aspect Ratio Preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: "free", label: "Free Form" },
                      { id: "1:1", label: "1:1 Square" },
                      { id: "4:3", label: "4:3 Standard" },
                      { id: "16:9", label: "16:9 Widescreen" }
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyCropPreset(preset.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        cropAspectPreset === preset.id
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">X Offset (px)</label>
                  <input
                    type="number"
                    min="0"
                    value={cropX}
                    onChange={(e) => setCropX(Math.max(0, Number(e.target.value)))}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Y Offset (px)</label>
                  <input
                    type="number"
                    min="0"
                    value={cropY}
                    onChange={(e) => setCropY(Math.max(0, Number(e.target.value)))}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Width (px)</label>
                  <input
                    type="number"
                    min="1"
                    value={cropWidth}
                    onChange={(e) => setCropWidth(Math.max(1, Number(e.target.value)))}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Height (px)</label>
                  <input
                    type="number"
                    min="1"
                    value={cropHeight}
                    onChange={(e) => setCropHeight(Math.max(1, Number(e.target.value)))}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Output Format</label>
                  <select
                    value={cropFormat}
                    onChange={(e) =>
                      setCropFormat(e.target.value as "image/jpeg" | "image/png" | "image/webp")
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="image/jpeg">JPEG (.jpg)</option>
                    <option value="image/png">PNG (.png, preserves alpha)</option>
                    <option value="image/webp">WebP (.webp)</option>
                  </select>
                </div>

                {cropFormat !== "image/png" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Quality ({cropQuality}%)
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={cropQuality}
                      onChange={(e) => setCropQuality(Number(e.target.value))}
                      className="w-full accent-blue-600 mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rotate & Flip Image Options */}
          {tool.slug === "rotate-image" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Rotation Angle</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { angle: 90, label: "90° Clockwise" },
                      { angle: 180, label: "180° Half Turn" },
                      { angle: 270, label: "270° Counter-CW" }
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.angle}
                      type="button"
                      onClick={() => setImgRotateAngle(item.angle)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        imgRotateAngle === item.angle
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Mirror / Flip</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { flip: "none", label: "No Flip" },
                      { flip: "horizontal", label: "Flip Horizontal ↔" },
                      { flip: "vertical", label: "Flip Vertical ↕" }
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.flip}
                      type="button"
                      onClick={() => setImgFlipAxis(item.flip)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        imgFlipAxis === item.flip
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Output Format</label>
                  <select
                    value={imgRotateFormat}
                    onChange={(e) =>
                      setImgRotateFormat(e.target.value as "image/jpeg" | "image/png" | "image/webp")
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="image/jpeg">JPEG (.jpg)</option>
                    <option value="image/png">PNG (.png, preserves alpha)</option>
                    <option value="image/webp">WebP (.webp)</option>
                  </select>
                </div>

                {imgRotateFormat !== "image/png" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Quality ({imgRotateQuality}%)
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={imgRotateQuality}
                      onChange={(e) => setImgRotateQuality(Number(e.target.value))}
                      className="w-full accent-blue-600 mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compress Image Options */}
          {tool.slug === "compress-image" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Format</label>
                  <select
                    value={imgCompressFormat}
                    onChange={(e) =>
                      setImgCompressFormat(e.target.value as "image/jpeg" | "image/webp" | "image/png")
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="image/jpeg">JPEG (.jpg, Best Compression)</option>
                    <option value="image/webp">WebP (.webp, High Efficiency)</option>
                    <option value="image/png">PNG (.png, Lossless)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 flex justify-between mb-1">
                    <span>Compression Quality</span>
                    <span className="font-semibold text-blue-600">{imgCompressQuality}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    value={imgCompressQuality}
                    onChange={(e) => setImgCompressQuality(Number(e.target.value))}
                    className="w-full accent-blue-600 mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>Smaller File (10%)</span>
                    <span>High Clarity (95%)</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Notice: All image processing runs locally in your browser. Actual byte savings will be measured and displayed after compression.
              </p>
            </div>
          )}

          {/* PDF to PNG Options */}
          {tool.slug === "pdf-to-png" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Resolution Scale</label>
                <select
                  value={pdfPngScale}
                  onChange={(e) => setPdfPngScale(Number(e.target.value))}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                >
                  <option value={1.0}>Standard (72-96 DPI, Faster)</option>
                  <option value={1.5}>Medium (150 DPI, Recommended)</option>
                  <option value={2.0}>High (300 DPI, Sharp Lossless PNG)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pages to Render (optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for all pages, or e.g. 1, 3, 5"
                  value={pdfPngPages}
                  onChange={(e) => setPdfPngPages(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Delete PDF Pages Options */}
          {tool.slug === "delete-pdf-pages" && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Pages to Remove (e.g. 2, 5, 8-10)
              </label>
              <input
                type="text"
                value={deletePagesRange}
                onChange={(e) => setDeletePagesRange(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                placeholder="2, 5, 8-10"
              />
              <p className="text-[11px] text-slate-500">
                Original document remains untouched. A new PDF excluding these pages will be created.
              </p>
            </div>
          )}

          {/* Reorder PDF Pages Options */}
          {tool.slug === "reorder-pdf-pages" && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                New Page Sequence (e.g. 3, 1, 2)
              </label>
              <input
                type="text"
                value={reorderPagesString}
                onChange={(e) => setReorderPagesString(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                placeholder="e.g. 3, 1, 2"
              />
              <p className="text-[11px] text-slate-500">
                Specify all page numbers in your preferred order, separated by commas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Process Button */}
      {files.length > 0 && state !== "PROCESSING" && state !== "VALIDATING" && (
        <button
          type="button"
          onClick={runOperation}
          className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2.5 hover-3d-lift cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          {tool.slug.includes("to-pdf")
            ? "Convert to PDF"
            : tool.slug.includes("compress")
            ? "Compress PDF"
            : tool.slug.includes("merge")
            ? "Merge PDF Documents"
            : tool.slug.includes("split")
            ? "Split PDF"
            : tool.slug.includes("rotate")
            ? "Rotate PDF"
            : tool.slug.includes("extract")
            ? "Extract PDF Pages"
            : `Process with ${tool.name}`}
        </button>
      )}
    </div>
  );
}
