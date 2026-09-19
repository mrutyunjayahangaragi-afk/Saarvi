/**
 * Saarvi Document Layout Model
 *
 * Provides a structured, geometry-preserving document model for high-fidelity
 * PDF ↔ Word conversions.
 */

export type DocumentType =
  | "TYPE_A_DIGITAL"
  | "TYPE_B_SCANNED"
  | "TYPE_C_MIXED"
  | "TYPE_D_COMPLEX";

export type QualityAssessment = "High" | "Medium" | "Needs Review";

export interface ConversionQualityReport {
  detectedType: DocumentType;
  ocrUsed: boolean;
  pageCount: number;
  paragraphCount: number;
  headingCount: number;
  tableCount: number;
  imageCount: number;
  fontSubstitutions: Record<string, string>;
  durationMs: number;
  qualityState: QualityAssessment;
  formattingNotes: string[];
}

export interface GeometryBox {
  x: number; // in points (from left)
  y: number; // in points (from top)
  width: number;
  height: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  colorHex?: string;
  alignment: "left" | "center" | "right" | "justify";
}

export interface TextSpan {
  text: string;
  style: TextStyle;
}

export interface ParagraphElement extends GeometryBox {
  type: "paragraph";
  spans: TextSpan[];
  alignment: "left" | "center" | "right" | "justify";
  lineSpacingMultiple?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  leftIndentPt?: number;
  firstLineIndentPt?: number;
}

export interface HeadingElement extends GeometryBox {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
  style: TextStyle;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
}

export interface ListElement extends GeometryBox {
  type: "list";
  listType: "bullet" | "numbered";
  marker: string;
  level: number;
  spans: TextSpan[];
}

export interface TableCellModel {
  colSpan?: number;
  rowSpan?: number;
  widthPt: number;
  paragraphs: ParagraphElement[];
  hasTopBorder?: boolean;
  hasBottomBorder?: boolean;
  hasLeftBorder?: boolean;
  hasRightBorder?: boolean;
  backgroundColorHex?: string;
}

export interface TableRowModel {
  heightPt?: number;
  isHeader?: boolean;
  cells: TableCellModel[];
}

export interface TableElement extends GeometryBox {
  type: "table";
  rows: TableRowModel[];
  columnWidthsPt: number[];
  totalWidthPt: number;
}

export interface ImageElement extends GeometryBox {
  type: "image";
  dataUrl?: string;
  imageBuffer?: Uint8Array;
  mimeType: string;
  aspectRatio: number;
  rotation?: number;
  caption?: string;
}

export interface VisualFallbackElement extends GeometryBox {
  type: "visual_fallback";
  imageDataUrl: string;
  mimeType: string;
  description: string;
}

export type LayoutElement =
  | ParagraphElement
  | HeadingElement
  | ListElement
  | TableElement
  | ImageElement
  | VisualFallbackElement;

export interface PageModel {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  isLandscape: boolean;
  marginsPt: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  headerText?: string;
  footerText?: string;
  columnCount: number;
  elements: LayoutElement[];
  isScanned: boolean;
}

export interface DocumentModel {
  title?: string;
  author?: string;
  pages: PageModel[];
  documentType: DocumentType;
  qualityReport: ConversionQualityReport;
}
