"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface FeedbackOptions {
  category?: 'BUG' | 'FEATURE' | 'PERFORMANCE' | 'UX' | 'OTHER';
  toolSlug?: string;
}

interface FeedbackContextType {
  isOpen: boolean;
  options: FeedbackOptions;
  openFeedback: (options?: FeedbackOptions) => void;
  closeFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<FeedbackOptions>({});

  const openFeedback = useCallback((opts?: FeedbackOptions) => {
    setOptions(opts || {});
    setIsOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    setOptions({});
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      options,
      openFeedback,
      closeFeedback,
    }),
    [isOpen, options, openFeedback, closeFeedback]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextType {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}
