"use client";

import React, { useEffect, useRef } from "react";
import { globalActionController } from "@/lib/ux/action-destination";

export interface SmartSearchResultsProps {
  id?: string;
  query: string;
  hasSearched: boolean;
  totalResults: number;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  autoReveal?: boolean;
}

/**
 * Saarvi SmartSearchResults Component (Section 44)
 * Standardized results container for search workflows (Jobs, Tools, Global Search):
 * 1. Registers data-saarvi-target="search-results"
 * 2. Reveals results region if outside viewport after user searches
 * 3. Gracefully displays empty state when query returns 0 matches
 */
export default function SmartSearchResults({
  id = "search-results",
  query,
  hasSearched,
  totalResults,
  children,
  emptyState,
  className = "",
  autoReveal = true,
}: SmartSearchResultsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevQueryRef = useRef<string>("");

  useEffect(() => {
    // Only auto-reveal when user has actively submitted a new search query
    if (hasSearched && query && query !== prevQueryRef.current && autoReveal) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          globalActionController.revealSearch(`#${id}`, {
            fallbackTarget: "[data-saarvi-target='search-results']",
            mode: "section",
            focus: true,
            reason: "search_results_updated",
          });
        }, 50);
      });
    }
    prevQueryRef.current = query;
  }, [hasSearched, query, id, autoReveal]);

  return (
    <div
      ref={containerRef}
      id={id}
      data-saarvi-target="search-results"
      tabIndex={-1}
      role="region"
      aria-label="Search Results"
      className={`scroll-mt-24 saarvi-destination-target outline-hidden ${className}`}
    >
      {hasSearched && totalResults === 0 && emptyState ? (
        emptyState
      ) : (
        children
      )}
    </div>
  );
}
