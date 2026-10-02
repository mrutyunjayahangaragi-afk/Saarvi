"use client";

import React, { useState } from "react";
import {
  Table as TableIcon,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

interface SheetPreview {
  sheetName: string;
  headers: (string | number | boolean | null)[];
  sampleRows: (string | number | boolean | null)[][];
  totalRows: number;
  totalCols: number;
  qualityScore: number;
  strategyUsed: string;
}

interface PdfExcelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData?: {
    sheets: SheetPreview[];
    documentType: string;
    totalRows?: number;
    maxCols?: number;
    qualityScore?: number;
    strategyUsed?: string;
  };
  onDownload: () => void;
  filename: string;
}

export default function PdfExcelPreviewModal({
  isOpen,
  onClose,
  previewData,
  onDownload,
  filename,
}: PdfExcelPreviewModalProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  if (!isOpen || !previewData || !previewData.sheets || previewData.sheets.length === 0) {
    return null;
  }

  const sheets = previewData.sheets;
  const currentSheet = sheets[activeSheetIndex] || sheets[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      <div className="bg-white dark:bg-[#111c38] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#0b1329]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="preview-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Extracted Data Preview
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  {currentSheet.qualityScore || previewData.qualityScore || 95}% Confidence
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {filename} • {previewData.strategyUsed || currentSheet.strategyUsed}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS & SHEET SELECTOR */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111c38] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Sheet tabs if multiple */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {sheets.length > 1 &&
              sheets.map((sheet, idx) => (
                <button
                  key={sheet.sheetName}
                  onClick={() => setActiveSheetIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 text-xs cursor-pointer ${
                    activeSheetIndex === idx
                      ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {sheet.sheetName} ({sheet.totalRows} rows)
                </button>
              ))}
            {sheets.length === 1 && (
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Sheet: <strong className="text-slate-700 dark:text-slate-200">{currentSheet.sheetName}</strong>
              </span>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>
              Rows: <strong className="text-slate-800 dark:text-slate-200">{currentSheet.totalRows}</strong>
            </span>
            <span>•</span>
            <span>
              Cols: <strong className="text-slate-800 dark:text-slate-200">{currentSheet.totalCols}</strong>
            </span>
            <span>•</span>
            <span>
              Document: <strong className="text-emerald-700 dark:text-emerald-400">{previewData.documentType}</strong>
            </span>
          </div>
        </div>

        {/* TABLE PREVIEW GRID */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-[#0b1329]/50">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#162244] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 font-mono text-[10px] text-slate-400 dark:text-slate-500 font-bold border-r border-slate-200 dark:border-slate-700 w-10 text-center select-none">
                    #
                  </th>
                  {currentSheet.headers.map((h, i) => (
                    <th
                      key={i}
                      className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 last:border-r-0 whitespace-nowrap"
                    >
                      {String(h ?? `Col ${i + 1}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentSheet.sampleRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors last:border-b-0 font-sans"
                  >
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-400 dark:text-slate-500 text-center border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 select-none">
                      {rowIdx + 2}
                    </td>
                    {currentSheet.headers.map((_, colIdx) => {
                      const cellVal = row[colIdx];
                      const isNum = typeof cellVal === "number";
                      return (
                        <td
                          key={colIdx}
                          className={`py-2 px-3 border-r border-slate-100 dark:border-slate-800 last:border-r-0 whitespace-nowrap ${
                            isNum ? "text-right font-mono text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {cellVal !== null && cellVal !== undefined && cellVal !== "" ? (
                            String(cellVal)
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 italic">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currentSheet.totalRows > currentSheet.sampleRows.length + 1 && (
            <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Showing sample preview of first {currentSheet.sampleRows.length + 1} rows. All {currentSheet.totalRows}{" "}
              rows are included in the downloadable Excel file.
            </p>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111c38] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Extracted with Saarvi Adaptive Multi-Strategy Engine 7.0</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Close Preview
            </button>
            <button
              onClick={() => {
                onDownload();
                onClose();
              }}
              className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
