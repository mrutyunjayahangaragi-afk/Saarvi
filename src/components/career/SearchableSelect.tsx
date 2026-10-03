"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";

export interface SelectOption {
  id: string;
  label: string;
  category?: string;
  popular?: boolean;
  recommended?: boolean;
  aliases?: string[];
}

export interface SearchableSelectProps {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  allowAny?: boolean;
  anyLabel?: string;
  className?: string;
  accentBorderClass?: string;
  focusRingClass?: string;
}

export default function SearchableSelect({
  id,
  label,
  placeholder = "Select...",
  value,
  onChange,
  options,
  allowAny = true,
  anyLabel = "Any",
  className = "",
  accentBorderClass = "focus-within:border-blue-500",
  focusRingClass = "focus-within:ring-2 focus-within:ring-blue-500/20",
}: SearchableSelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input on open
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Find currently selected label
  const selectedOption = options.find((opt) => opt.id === value || opt.label === value);
  const displayLabel = selectedOption
    ? selectedOption.label
    : value
    ? value
    : allowAny
    ? anyLabel
    : placeholder;

  const isSelected = Boolean(value && value !== "all" && value !== "any" && value !== "any-location");

  // Filtered options based on query
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    if (opt.label.toLowerCase().includes(q)) return true;
    if (opt.category && opt.category.toLowerCase().includes(q)) return true;
    if (opt.aliases && opt.aliases.some((a) => a.toLowerCase().includes(q))) return true;
    return false;
  });

  // Group by category if categories exist
  const categories = Array.from(
    new Set(filteredOptions.map((opt) => opt.category || "General").filter(Boolean))
  );

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative flex-1 min-w-[140px] ${className}`}
    >
      <label htmlFor={selectId} className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 truncate">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 bg-white dark:bg-[#111c38] rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-1.5 transition cursor-pointer shadow-2xs ${
          isSelected
            ? "border-blue-400 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 font-bold"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
        } ${isOpen ? `${accentBorderClass} ${focusRingClass}` : ""}`}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="flex items-center gap-1 shrink-0 text-slate-400 dark:text-slate-500">
          {isSelected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange(allowAny ? "all" : "");
              }}
              className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[240px] max-w-[320px] bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200/95 dark:border-slate-700 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Internal Search Input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden placeholder:text-slate-400 dark:placeholder:text-slate-500 py-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 text-xs" role="listbox">
            {/* "Any" Option */}
            {allowAny && !searchQuery && (
              <button
                type="button"
                role="option"
                aria-selected={!isSelected}
                onClick={() => {
                  onChange(value === "any-location" ? "any-location" : "all");
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                  !isSelected ? "bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <span>{anyLabel}</span>
                {!isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                No matching options
              </div>
            ) : categories.length > 1 && !searchQuery ? (
              // Grouped view
              categories.map((cat) => {
                const groupItems = filteredOptions.filter((opt) => (opt.category || "General") === cat);
                if (groupItems.length === 0) return null;
                return (
                  <div key={cat} className="space-y-0.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 block">
                      {cat}
                    </span>
                    {groupItems.map((opt) => {
                      const isItemActive = value === opt.id || value === opt.label;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={isItemActive}
                          onClick={() => {
                            onChange(opt.label);
                            setIsOpen(false);
                            setSearchQuery("");
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                            isItemActive
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{opt.label}</span>
                            {opt.recommended && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                                Recommended
                              </span>
                            )}
                          </div>
                          {isItemActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              // Flat view
              filteredOptions.map((opt) => {
                const isItemActive = value === opt.id || value === opt.label;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isItemActive}
                    onClick={() => {
                      onChange(opt.label);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                      isItemActive
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.recommended && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                          Recommended
                        </span>
                      )}
                    </div>
                    {isItemActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
