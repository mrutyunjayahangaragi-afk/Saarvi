import type { DocumentType } from "./document-model.ts";

export interface PageClassification {
  pageNumber: number;
  selectableCharCount: number;
  hasImages: boolean;
  columnCountEstimate: number;
  hasTableStructures: boolean;
  useOcr: boolean;
}

export interface DocumentClassificationResult {
  documentType: DocumentType;
  totalPages: number;
  digitalPageCount: number;
  scannedPageCount: number;
  pages: PageClassification[];
  requiresOcr: boolean;
  isMixed: boolean;
  isComplex: boolean;
}

/**
 * Classifies a PDF document and determines the optimal processing strategy
 * for each individual page.
 */
export function classifyDocument(pagesInfo: {
  pageNumber: number;
  charCount: number;
  imageCount: number;
  columnCountEstimate?: number;
  hasTables?: boolean;
}[]): DocumentClassificationResult {
  const totalPages = pagesInfo.length;
  let digitalPageCount = 0;
  let scannedPageCount = 0;
  let complexCount = 0;

  const pageClassifications: PageClassification[] = pagesInfo.map((p) => {
    // A page is considered scanned if selectable text is practically absent (< 15 characters)
    const isScanned = p.charCount < 15;
    const colCount = p.columnCountEstimate || 1;
    const isComplex = colCount >= 2 || Boolean(p.hasTables);

    if (isScanned) {
      scannedPageCount++;
    } else {
      digitalPageCount++;
    }

    if (isComplex) {
      complexCount++;
    }

    return {
      pageNumber: p.pageNumber,
      selectableCharCount: p.charCount,
      hasImages: p.imageCount > 0,
      columnCountEstimate: colCount,
      hasTableStructures: Boolean(p.hasTables),
      useOcr: isScanned,
    };
  });

  let documentType: DocumentType;

  if (scannedPageCount === totalPages && totalPages > 0) {
    documentType = "TYPE_B_SCANNED";
  } else if (scannedPageCount > 0 && digitalPageCount > 0) {
    documentType = "TYPE_C_MIXED";
  } else if (complexCount > 0) {
    documentType = "TYPE_D_COMPLEX";
  } else {
    documentType = "TYPE_A_DIGITAL";
  }

  return {
    documentType,
    totalPages,
    digitalPageCount,
    scannedPageCount,
    pages: pageClassifications,
    requiresOcr: scannedPageCount > 0,
    isMixed: documentType === "TYPE_C_MIXED",
    isComplex: documentType === "TYPE_D_COMPLEX",
  };
}
