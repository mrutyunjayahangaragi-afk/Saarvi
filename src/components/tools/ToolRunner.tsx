"use client";

import { useState, useRef, ChangeEvent, DragEvent, useEffect, useMemo, useCallback } from "react";
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
  UserCheck,
  ArrowRight,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Table
} from "lucide-react";
import JSZip from "jszip";
import { ToolDefinition } from "@/types/tool";
import { ToolAccessResult } from "@/types/tool-control";
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
import { usePlatform } from "@/context/PlatformContext";
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
  const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheet");
  const isPptx = /\.pptx$/i.test(file.name) || file.type.includes("presentation");
  const isCode = /\.(html|htm)$/i.test(file.name);
  const isTable = /\.csv$/i.test(file.name);

  const [docSummary, setDocSummary] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function inspectFile() {
      if (isPdf && file.size < 50 * 1024 * 1024) {
        try {
          const slice = await file.slice(0, 500000).text();
          const matches = slice.match(/\/Type\s*\/Page\b/g);
          if (matches && matches.length > 0 && active) {
            setDocSummary(`${matches.length} page${matches.length === 1 ? "" : "s"}`);
          }
        } catch {
          // ignore
        }
      } else if (isXlsx && file.size < 50 * 1024 * 1024) {
        try {
          const zip = await JSZip.loadAsync(file.slice(0, 1000000));
          const wb = zip.file("xl/workbook.xml");
          if (wb) {
            const txt = await wb.async("text");
            const sheetMatches = txt.match(/<sheet\b/g);
            if (sheetMatches && active) {
              setDocSummary(`${sheetMatches.length} sheet${sheetMatches.length === 1 ? "" : "s"}`);
            }
          }
        } catch {
          // ignore
        }
      } else if (isPptx && file.size < 50 * 1024 * 1024) {
        try {
          const zip = await JSZip.loadAsync(file.slice(0, 1000000));
          const pres = zip.file("ppt/presentation.xml");
          if (pres) {
            const txt = await pres.async("text");
            const sldMatches = txt.match(/<p:sldId\b/g);
            if (sldMatches && active) {
              setDocSummary(`${sldMatches.length} slide${sldMatches.length === 1 ? "" : "s"}`);
            }
          }
        } catch {
          // ignore
        }
      }
    }
    inspectFile();
    return () => {
      active = false;
    };
  }, [file, isPdf, isXlsx, isPptx]);

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
        {/* Preview: Thumbnail for image, icon for PDF / Word / Excel / PPTX / Code */}
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
            ) : isXlsx ? (
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            ) : isPptx ? (
              <Presentation className="w-6 h-6 text-amber-600" />
            ) : isCode ? (
              <FileCode className="w-6 h-6 text-indigo-600" />
            ) : isTable ? (
              <Table className="w-6 h-6 text-teal-600" />
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
            {docSummary && (
              <>
                <span>•</span>
                <span className="text-slate-600 font-medium">{docSummary}</span>
              </>
            )}
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

  const { isMaintenance, maintenanceMessage, isGuestAccessEnabled } = usePlatform();
  const { user } = useAuth();

  const [serverAccess, setServerAccess] = useState<ToolAccessResult | null>(null);
  const [betaBlocked, setBetaBlocked] = useState<boolean>(false);
  const [activeReservationToken, setActiveReservationToken] = useState<string | null>(null);

  const loadToolAccess = useCallback(async () => {
    try {
      const url = user?.id
        ? `/api/tools/access?toolId=${tool.slug}&userId=${user.id}`
        : `/api/tools/access?toolId=${tool.slug}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setServerAccess(json.data);
          if (!json.data.isAllowed && json.data.reason === 'beta_limit_reached') {
            setBetaBlocked(true);
          } else {
            setBetaBlocked(false);
          }
        }
      }
    } catch (err) {
      console.warn('Tool access check error:', err);
    }
  }, [tool.slug, user?.id]);

  useEffect(() => {
    const checkTool = () => {
      adminService.getEffectiveTool(tool.slug).then((eff) => {
        if (eff) {
          setRuntimeStatus(eff.status);
          setRuntimeMaxSizeMB(eff.maxSizeMB);
        }
      }).catch(() => {});
      loadToolAccess();
    };

    checkTool();
    window.addEventListener('saarvi_platform_change', checkTool);
    return () => {
      window.removeEventListener('saarvi_platform_change', checkTool);
    };
  }, [tool.slug, tool.status, tool.maxSizeMB, loadToolAccess]);
  const entitlement = planService.canUseTool(tool.slug, user);
  const userPlan = planService.getUserPlan(user);
  const planLimits = planService.getPlanLimits(userPlan);

  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<ProcessingState>("IDLE");
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState<string | undefined>();
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

  // Phase 34 Advanced PDF Toolkit States
  // Protect PDF
  const [protectPassword, setProtectPassword] = useState("");
  const [protectOwnerPassword, setProtectOwnerPassword] = useState("");
  const [protectAllowPrinting, setProtectAllowPrinting] = useState(true);
  const [protectAllowCopying, setProtectAllowCopying] = useState(true);
  const [protectAllowModifying, setProtectAllowModifying] = useState(false);

  // Unlock PDF
  const [unlockPassword, setUnlockPassword] = useState("");

  // Watermark PDF
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkRotation, setWatermarkRotation] = useState(45);
  const [watermarkPosition, setWatermarkPosition] = useState<"center" | "diagonal" | "top" | "bottom">("diagonal");
  const [watermarkFontSize, setWatermarkFontSize] = useState(48);
  const [watermarkColor, setWatermarkColor] = useState("#888888");
  const [watermarkPageRange, setWatermarkPageRange] = useState("all");

  // Page Numbers PDF
  const [pageNumberFormat, setPageNumberFormat] = useState<"Page {page} of {total}" | "Page {page}" | "{page}">("Page {page} of {total}");
  const [pageNumberPosition, setPageNumberPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left">("bottom-center");
  const [pageNumberStart, setPageNumberStart] = useState(1);
  const [pageNumberRange, setPageNumberRange] = useState("all");

  // PDF Header & Footer
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("Page {page} of {total}");
  const [headerPosition, setHeaderPosition] = useState<"center" | "left" | "right">("center");
  const [footerPosition, setFooterPosition] = useState<"center" | "left" | "right">("center");
  const [headerFooterRange, setHeaderFooterRange] = useState("all");

  // PDF Metadata Editor
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataAuthor, setMetadataAuthor] = useState("");
  const [metadataSubject, setMetadataSubject] = useState("");
  const [metadataKeywords, setMetadataKeywords] = useState("");
  const [metadataClearAll, setMetadataClearAll] = useState(false);

  // Phase 35 Scan & Photo States
  const [scanPageSize, setScanPageSize] = useState<"A4" | "FIT">("A4");
  const [scanFilterMode, setScanFilterMode] = useState<"clean_bw" | "grayscale" | "enhanced_color">("clean_bw");

  const allowsMultiple =
    tool.slug === "multiple-images-to-pdf" ||
    tool.slug === "merge-pdf" ||
    tool.slug === "notes-to-pdf" ||
    tool.slug === "txt-to-pdf" ||
    tool.slug === "csv-to-pdf" ||
    tool.slug === "pdf-to-excel" ||
    tool.slug === "excel-to-pdf" ||
    tool.slug === "pdf-to-powerpoint" ||
    tool.slug === "powerpoint-to-pdf" ||
    tool.slug === "html-to-pdf" ||
    tool.slug === "protect-pdf" ||
    tool.slug === "watermark-pdf" ||
    tool.slug === "page-numbers-pdf" ||
    tool.slug === "flatten-pdf" ||
    tool.slug === "pdf-header-footer" ||
    tool.slug === "pdf-metadata" ||
    tool.slug === "document-scanner" ||
    tool.slug === "scan-to-pdf";

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
    setStageMessage(undefined);
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
    } else if (tool.slug === "protect-pdf") {
      config = {
        userPassword: protectPassword,
        ownerPassword: protectOwnerPassword || undefined,
        permissions: {
          printing: protectAllowPrinting,
          copying: protectAllowCopying,
          modifying: protectAllowModifying,
        },
      };
    } else if (tool.slug === "unlock-pdf") {
      config = { password: unlockPassword || undefined };
    } else if (tool.slug === "watermark-pdf") {
      config = {
        text: watermarkText,
        opacity: watermarkOpacity,
        rotation: watermarkRotation,
        position: watermarkPosition,
        fontSize: watermarkFontSize,
        color: watermarkColor,
        pageRange: watermarkPageRange === "all" ? undefined : watermarkPageRange,
      };
    } else if (tool.slug === "page-numbers-pdf") {
      config = {
        format: pageNumberFormat,
        position: pageNumberPosition,
        startPage: pageNumberStart,
        pageRange: pageNumberRange === "all" ? undefined : pageNumberRange,
      };
    } else if (tool.slug === "pdf-header-footer") {
      config = {
        headerText: headerText || undefined,
        footerText: footerText || undefined,
        headerPosition,
        footerPosition,
        pageRange: headerFooterRange === "all" ? undefined : headerFooterRange,
      };
    } else if (tool.slug === "pdf-metadata") {
      config = {
        title: metadataTitle || undefined,
        author: metadataAuthor || undefined,
        subject: metadataSubject || undefined,
        keywords: metadataKeywords ? metadataKeywords.split(",").map((s) => s.trim()) : undefined,
        clearAll: metadataClearAll,
      };
    } else if (tool.slug === "flatten-pdf") {
      config = {};
    } else if (tool.slug === "pdf-info") {
      config = {};
    } else if (
      tool.slug === "document-scanner" ||
      tool.slug === "scan-to-pdf" ||
      tool.slug === "photo-to-document"
    ) {
      config = {
        pageSize: scanPageSize,
        binarize: scanFilterMode === "clean_bw",
        grayscale: scanFilterMode === "grayscale",
      };
    }

    // Engine validation
    const val = operation.validate(files, config as never);
    if (!val.valid) {
      setErrorMessage(val.error || "Validation failed.");
      setState("ERROR");
      return;
    }

    // Atomic Beta Usage Reservation (PART 2.5 & 2.6)
    let currentReservationToken: string | null = null;
    if (serverAccess?.isBeta && !serverAccess?.isPro) {
      try {
        const reserveRes = await fetch('/api/tools/beta-usage/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolKey: tool.slug,
            userId: user?.id,
          }),
        });
        const reserveData = await reserveRes.json();
        if (!reserveData.allowed) {
          setBetaBlocked(true);
          setErrorMessage(reserveData.message || 'Your free Beta access for this tool has been reached.');
          setState('ERROR');
          return;
        }
        currentReservationToken = reserveData.reservationToken || null;
        setActiveReservationToken(currentReservationToken);
      } catch (reserveErr) {
        console.warn('Beta reservation notice:', reserveErr);
      }
    }

    setState("PROCESSING");
    setProgress(5);
    const startTime = performance.now();

    try {
      const res = await operation.execute(files, config as never, (pct: number, stage?: string) => {
        if (!isCancelledRef.current) {
          setProgress(pct);
          if (stage) {
            setStageMessage(stage);
          }
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

      // Atomic Beta Usage Commit upon verified successful completion (PART 2.5)
      if (currentReservationToken) {
        fetch('/api/tools/beta-usage/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolKey: tool.slug,
            reservationToken: currentReservationToken,
            userId: user?.id,
            processingTimeMs: durationMs,
          }),
        }).then(async (commitRes) => {
          if (commitRes.ok) {
            const commitJson = await commitRes.json();
            if (commitJson.data) {
              setServerAccess((prev) => prev ? {
                ...prev,
                usageCount: commitJson.data.usageCount,
                remainingUses: commitJson.data.remainingUses,
              } : null);
            }
          }
        }).catch(() => {});
        setActiveReservationToken(null);
      }

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

      // Release reserved slot on failure (PART 2.5 & 2.6)
      if (currentReservationToken) {
        fetch('/api/tools/beta-usage/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolKey: tool.slug,
            reservationToken: currentReservationToken,
            userId: user?.id,
            reason: err instanceof Error ? err.message : 'Processing failed',
          }),
        }).catch(() => {});
        setActiveReservationToken(null);
      }

      console.warn("Local tool conversion notice:", err);
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

  // If tool is DISABLED by admin (Section 16 / PART 2.1)
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

  // If Beta Free Usage Limit has been reached (PART 2.2)
  if (betaBlocked || (serverAccess && !serverAccess.isAllowed && serverAccess.reason === "beta_limit_reached")) {
    return (
      <div className="p-8 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/80 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 mb-1">
            Beta Limit Reached
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Your free Beta access for {tool.name} has been used up.
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Continue with Pro to keep using this tool without limits.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xs"
          >
            <span>Upgrade to Pro</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            View Plans
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
      {/* Beta Access Banner (PART 2.8) */}
      {serverAccess?.isBeta && !serverAccess?.isPro && (
        <div className={`p-3 sm:p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          serverAccess.remainingUses <= 2
            ? 'bg-amber-50 border-amber-200/90 text-amber-900 shadow-xs'
            : 'bg-blue-50/80 border-blue-200/80 text-blue-900 shadow-xs'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-white border border-current tracking-wide">
              Beta Access
            </span>
            <span className="font-medium">
              {serverAccess.remainingUses <= 2
                ? `Only ${serverAccess.remainingUses} / ${serverAccess.freeLimit} free uses remaining`
                : `${serverAccess.remainingUses} / ${serverAccess.freeLimit} free uses remaining`}
            </span>
          </div>
          <Link
            href="/pricing"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2 shrink-0"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}
      {/* PROCESSING STATE OR DROPZONE (Transforms in-place) */}
      {state === "PROCESSING" || state === "VALIDATING" ? (
        <ProcessingProgress
          state={state}
          percent={progress}
          statusMessage={stageMessage}
          errorMessage={errorMessage || undefined}
          onCancel={() => {
            isCancelledRef.current = true;
            setState("IDLE");
            setProgress(0);
            setStageMessage(undefined);
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
        <div
          className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-in fade-in ${
            errorMessage.includes("OCR is required")
              ? "bg-amber-50/90 border-amber-200/90 text-amber-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                errorMessage.includes("OCR is required") ? "text-amber-600" : "text-red-600"
              }`}
            />
            <div className="space-y-1">
              <p className="font-semibold text-xs leading-relaxed">{errorMessage}</p>
              {errorMessage.includes("OCR is required") && (
                <p className="text-[11px] text-amber-700/90">
                  Saarvi includes a dedicated OCR tool that recognizes and extracts text from scanned documents and images.
                </p>
              )}
            </div>
          </div>
          {errorMessage.includes("OCR is required") && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/tools/ocr-pdf"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Use OCR Tool</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={resetAll}
                className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-medium text-amber-900 hover:bg-amber-100/60 transition-colors cursor-pointer"
              >
                Try another file
              </button>
            </div>
          )}
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

          {/* Phase 34: Protect PDF */}
          {tool.slug === "protect-pdf" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Password (Required to Open)
                </label>
                <input
                  type="password"
                  value={protectPassword}
                  onChange={(e) => setProtectPassword(e.target.value)}
                  placeholder="Enter a strong password"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Owner Password (Optional, for permissions)
                </label>
                <input
                  type="password"
                  value={protectOwnerPassword}
                  onChange={(e) => setProtectOwnerPassword(e.target.value)}
                  placeholder="Optional permissions password"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Document Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 text-xs">
                    <input
                      type="checkbox"
                      checked={protectAllowPrinting}
                      onChange={(e) => setProtectAllowPrinting(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-800 font-medium">Allow Printing</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 text-xs">
                    <input
                      type="checkbox"
                      checked={protectAllowCopying}
                      onChange={(e) => setProtectAllowCopying(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-800 font-medium">Allow Copying</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 text-xs">
                    <input
                      type="checkbox"
                      checked={protectAllowModifying}
                      onChange={(e) => setProtectAllowModifying(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-800 font-medium">Allow Modifying</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Phase 34: Unlock PDF */}
          {tool.slug === "unlock-pdf" && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
                If this document is locked with an open password, enter it below to decrypt and remove restrictions. If it only has print/copy restrictions, leave blank to strip restrictions instantly.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Password (If required to open)
                </label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Leave empty if file opens without password"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Phase 34: Watermark PDF */}
          {tool.slug === "watermark-pdf" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Watermark Text</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL, DRAFT, DO NOT COPY"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Position</label>
                  <select
                    value={watermarkPosition}
                    onChange={(e) => setWatermarkPosition(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="diagonal">Center (Diagonal 45°)</option>
                    <option value="center">Center (Horizontal)</option>
                    <option value="top">Top Header</option>
                    <option value="bottom">Bottom Footer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Font Size ({watermarkFontSize}px)</label>
                  <input
                    type="range"
                    min="16"
                    max="96"
                    value={watermarkFontSize}
                    onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                    className="w-full mt-2 accent-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opacity ({Math.round(watermarkOpacity * 100)}%)</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round(watermarkOpacity * 100)}
                    onChange={(e) => setWatermarkOpacity(Number(e.target.value) / 100)}
                    className="w-full mt-2 accent-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Watermark Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={watermarkColor}
                      onChange={(e) => setWatermarkColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={watermarkColor}
                      onChange={(e) => setWatermarkColor(e.target.value)}
                      className="flex-1 text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Page Range</label>
                  <input
                    type="text"
                    value={watermarkPageRange}
                    onChange={(e) => setWatermarkPageRange(e.target.value)}
                    placeholder="all or 1-3, 5"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Phase 34: Add Page Numbers */}
          {tool.slug === "page-numbers-pdf" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Numbering Format</label>
                  <select
                    value={pageNumberFormat}
                    onChange={(e) => setPageNumberFormat(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="Page {page} of {total}">Page &#123;page&#125; of &#123;total&#125; (e.g. Page 1 of 5)</option>
                    <option value="Page {page}">Page &#123;page&#125; (e.g. Page 1)</option>
                    <option value="{page}">&#123;page&#125; (Just Number)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Placement Position</label>
                  <select
                    value={pageNumberPosition}
                    onChange={(e) => setPageNumberPosition(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Number</label>
                  <input
                    type="number"
                    min="1"
                    value={pageNumberStart}
                    onChange={(e) => setPageNumberStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pages to Number</label>
                  <input
                    type="text"
                    value={pageNumberRange}
                    onChange={(e) => setPageNumberRange(e.target.value)}
                    placeholder="all or 2- (skip cover)"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Phase 34: PDF Header & Footer */}
          {tool.slug === "pdf-header-footer" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Header Text (Optional)</label>
                  <input
                    type="text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Document Title or Subject"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Header Alignment</label>
                  <select
                    value={headerPosition}
                    onChange={(e) => setHeaderPosition(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Footer Text (Supports &#123;page&#125; and &#123;total&#125;)</label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="Page {page} of {total}"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Footer Alignment</label>
                  <select
                    value={footerPosition}
                    onChange={(e) => setFooterPosition(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Page Range</label>
                <input
                  type="text"
                  value={headerFooterRange}
                  onChange={(e) => setHeaderFooterRange(e.target.value)}
                  placeholder="all or 1-5"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Phase 34: PDF Metadata */}
          {tool.slug === "pdf-metadata" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title</label>
                  <input
                    type="text"
                    value={metadataTitle}
                    onChange={(e) => setMetadataTitle(e.target.value)}
                    placeholder="Document title"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Author Name</label>
                  <input
                    type="text"
                    value={metadataAuthor}
                    onChange={(e) => setMetadataAuthor(e.target.value)}
                    placeholder="Author name"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={metadataSubject}
                    onChange={(e) => setMetadataSubject(e.target.value)}
                    placeholder="Subject or category"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    value={metadataKeywords}
                    onChange={(e) => setMetadataKeywords(e.target.value)}
                    placeholder="report, finance, 2026"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100/70 text-xs">
                <input
                  type="checkbox"
                  checked={metadataClearAll}
                  onChange={(e) => setMetadataClearAll(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-amber-900 font-semibold">Strip all metadata (Sanitize personal identifiable info)</span>
              </label>
            </div>
          )}

          {/* Phase 34: Flatten PDF */}
          {tool.slug === "flatten-pdf" && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
              <strong>Interactive Form Flattening:</strong> Converts all interactive AcroForms, form fields, checkboxes, and text inputs into permanent static vector graphics. The resulting document is read-only and prints identically on all devices.
            </div>
          )}

          {/* Phase 34: PDF Info */}
          {tool.slug === "pdf-info" && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
              <strong>Client-Side Technical Inspection:</strong> Inspects page counts, physical paper dimensions (A4, Letter), embedded metadata, and encryption status locally in your browser memory without uploading.
            </div>
          )}

          {/* Phase 35: Document Scanner / Scan to PDF / Photo to Document */}
          {(tool.slug === "document-scanner" || tool.slug === "scan-to-pdf" || tool.slug === "photo-to-document") && (
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Scan & Document Settings
                </span>
                <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  100% Client-Side
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Document Filter
                  </label>
                  <select
                    value={scanFilterMode}
                    onChange={(e) => setScanFilterMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="clean_bw">Clean B&W (High Contrast Document)</option>
                    <option value="grayscale">Grayscale (Smooth Text & Diagrams)</option>
                    <option value="enhanced_color">Enhanced Color (Original Palette)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Output Page Layout
                  </label>
                  <select
                    value={scanPageSize}
                    onChange={(e) => setScanPageSize(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="A4">Standard A4 (Print-Ready Aligned)</option>
                    <option value="FIT">Fit Exact Image Dimensions</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Camera feed and photos are processed directly in browser canvas memory. Zero frames or document photos are sent to any external server.
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
