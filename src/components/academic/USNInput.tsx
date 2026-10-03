"use client";

import React, { useState, useEffect, useId } from 'react';
import { Search, CheckCircle2, AlertCircle, Sparkles, GraduationCap } from 'lucide-react';
import { AcademicSchemeRegistry, AcademicScheme } from '@/lib/academic/scheme-registry';

interface USNInputProps {
  value: string;
  onChange: (val: string, scheme: AcademicScheme) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function normalizeUSN(raw: string): string {
  if (!raw) return '';
  // Convert to uppercase and strip all whitespace, hyphens, and non-alphanumeric chars
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateUSNStructure(usn: string): { isValid: boolean; error?: string } {
  const clean = normalizeUSN(usn);
  if (!clean) {
    return { isValid: false, error: 'Please enter your VTU USN.' };
  }

  if (clean.length < 10) {
    return { isValid: false, error: `USN is too short (${clean.length}/10 characters).` };
  }

  if (clean.length > 11) {
    return { isValid: false, error: `USN exceeds expected length (${clean.length} characters).` };
  }

  // Region must start with 1, 2, 3, or 4 (Belagavi, Bengaluru, Mysuru, Kalaburagi)
  if (!/^[1-4]/.test(clean)) {
    return { isValid: false, error: 'VTU USN should begin with region code (1, 2, 3, or 4).' };
  }

  // General tolerant pattern: [Region][College 2 chars][Year 2 digits][Branch 2-3 chars][Roll 2-4 digits]
  const pattern = /^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4}$/;
  if (!pattern.test(clean)) {
    return { isValid: false, error: 'Expected format: e.g. 1RV23CS001, 1MS22EC045.' };
  }

  return { isValid: true };
}

export function USNInput({
  value,
  onChange,
  onSubmit,
  placeholder = '1RV23CS001',
  disabled = false,
  className = '',
}: USNInputProps) {
  const inputId = useId();
  const [touched, setTouched] = useState(false);
  const [detectedScheme, setDetectedScheme] = useState<AcademicScheme>(() =>
    AcademicSchemeRegistry.detectSchemeFromUSN(value)
  );

  const cleanValue = normalizeUSN(value);
  const validation = validateUSNStructure(cleanValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = normalizeUSN(raw);
    const scheme = AcademicSchemeRegistry.detectSchemeFromUSN(normalized);
    setDetectedScheme(scheme);
    onChange(normalized, scheme);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && validation.isValid && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={`space-y-2 w-full ${className}`}>
      <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        Enter VTU University Seat Number (USN)
      </label>

      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
          <GraduationCap className="w-5 h-5" />
        </div>

        <input
          id={inputId}
          type="text"
          value={value}
          onChange={handleInputChange}
          onBlur={() => setTouched(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={11}
          className={`w-full pl-11 pr-24 py-3.5 text-base sm:text-lg font-mono font-bold tracking-wider rounded-2xl border transition-all shadow-xs focus:outline-hidden ${
            touched && !validation.isValid && value
              ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 focus:ring-2 focus:ring-rose-500'
              : validation.isValid
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500'
          }`}
        />

        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !validation.isValid}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs tracking-normal transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Get Results</span>
          </button>
        )}
      </div>

      {/* Dynamic Hints & Validation Feedback */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {touched && !validation.isValid && value ? (
          <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{validation.error}</span>
          </span>
        ) : validation.isValid ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Valid USN Format</span>
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            Example: 1RV23CS001, 1BM22EC015, 1MS21IS042
          </span>
        )}

        {validation.isValid && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Sparkles className="w-3 h-3" />
            <span>Auto-Detected: {detectedScheme.name}</span>
          </span>
        )}
      </div>
    </div>
  );
}
