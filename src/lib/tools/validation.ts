// DocEase Phase 16: Output Validation Engine
// Validates client-side generated files before presenting them for download.
// Prevents corrupted, truncated, or zero-byte outputs from triggering automatic downloads.

import type { SingleFileResult, MultiFileResult } from './types';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export interface OutputValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Validates a PDF Blob to confirm it begins with the standard %PDF- header
 * and can be read by PDFDocument.
 */
export async function validatePdfBlob(blob: Blob): Promise<OutputValidationResult> {
  if (!blob || blob.size === 0) {
    return { valid: false, error: 'Generated PDF is empty (0 bytes).' };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Check magic bytes: "%PDF-" = 0x25, 0x50, 0x44, 0x46, 0x2D
    if (
      bytes.length < 5 ||
      bytes[0] !== 0x25 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x44 ||
      bytes[3] !== 0x46 ||
      bytes[4] !== 0x2d
    ) {
      return { valid: false, error: 'Generated file does not have a valid PDF header signature.' };
    }

    // Confirm PDF structure is parseable
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();

    if (pageCount === 0) {
      return { valid: false, error: 'Generated PDF has 0 pages.' };
    }

    return {
      valid: true,
      details: { pageCount, byteLength: bytes.length },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Corrupted or unreadable PDF structure.';
    return { valid: false, error: `Invalid PDF output: ${message}` };
  }
}

/**
 * Validates an image Blob to confirm positive size and expected MIME type.
 */
export function validateImageBlob(blob: Blob): OutputValidationResult {
  if (!blob || blob.size === 0) {
    return { valid: false, error: 'Generated image is empty (0 bytes).' };
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!validTypes.includes(blob.type) && !blob.type.startsWith('image/')) {
    return { valid: false, error: `Invalid image MIME type: ${blob.type}` };
  }

  return {
    valid: true,
    details: { type: blob.type, size: blob.size },
  };
}

/**
 * Validates a ZIP Blob to confirm it begins with the standard PK header (0x50, 0x4B, 0x03, 0x04).
 */
export async function validateZipBlob(blob: Blob): Promise<OutputValidationResult> {
  if (!blob || blob.size === 0) {
    return { valid: false, error: 'Generated ZIP archive is empty (0 bytes).' };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // PK magic bytes: 0x50, 0x4B, 0x03, 0x04 (or 0x05, 0x06 for empty zip)
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return { valid: false, error: 'Generated archive does not have a valid ZIP header signature.' };
    }

    return { valid: true, details: { byteLength: bytes.length } };
  } catch {
    return { valid: false, error: 'Unable to inspect ZIP header.' };
  }
}

/**
 * Validates an XLSX Blob to confirm it is a valid ZIP archive containing OpenXML workbook structures.
 */
export async function validateXlsxBlob(blob: Blob): Promise<OutputValidationResult> {
  if (!blob || blob.size === 0) {
    return { valid: false, error: 'Generated XLSX spreadsheet is empty (0 bytes).' };
  }

  const zipCheck = await validateZipBlob(blob);
  if (!zipCheck.valid) {
    return { valid: false, error: `Invalid XLSX archive: ${zipCheck.error}` };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const hasContentTypes = Boolean(zip.file('[Content_Types].xml'));
    const hasWorkbook = Boolean(
      zip.file('xl/workbook.xml') ||
      Object.keys(zip.files).some((k) => k.startsWith('xl/'))
    );

    if (!hasContentTypes || !hasWorkbook) {
      return {
        valid: false,
        error: 'Generated XLSX is missing essential OpenXML structure ([Content_Types].xml or xl/workbook.xml).',
      };
    }

    return { valid: true, details: { byteLength: blob.size, fileCount: Object.keys(zip.files).length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Corrupted XLSX package';
    return { valid: false, error: `Invalid XLSX structure: ${msg}` };
  }
}

/**
 * Validates a PPTX Blob to confirm it is a valid ZIP archive containing OpenXML presentation structures.
 */
export async function validatePptxBlob(blob: Blob): Promise<OutputValidationResult> {
  if (!blob || blob.size === 0) {
    return { valid: false, error: 'Generated PPTX presentation is empty (0 bytes).' };
  }

  const zipCheck = await validateZipBlob(blob);
  if (!zipCheck.valid) {
    return { valid: false, error: `Invalid PPTX archive: ${zipCheck.error}` };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const hasContentTypes = Boolean(zip.file('[Content_Types].xml'));
    const hasPresentation = Boolean(
      zip.file('ppt/presentation.xml') ||
      Object.keys(zip.files).some((k) => k.startsWith('ppt/'))
    );

    if (!hasContentTypes || !hasPresentation) {
      return {
        valid: false,
        error: 'Generated PPTX is missing essential OpenXML structure ([Content_Types].xml or ppt/presentation.xml).',
      };
    }

    return { valid: true, details: { byteLength: blob.size, fileCount: Object.keys(zip.files).length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Corrupted PPTX package';
    return { valid: false, error: `Invalid PPTX structure: ${msg}` };
  }
}

/**
 * Master output validator for SingleFileResult and MultiFileResult.
 */
export async function validateToolOutput(
  result: SingleFileResult | MultiFileResult
): Promise<OutputValidationResult> {
  if (!result) {
    return { valid: false, error: 'No result produced by processing engine.' };
  }

  if (result.type === 'single') {
    const filename = result.filename.toLowerCase();
    if (filename.endsWith('.pdf')) {
      return await validatePdfBlob(result.blob);
    }
    if (filename.endsWith('.xlsx')) {
      return await validateXlsxBlob(result.blob);
    }
    if (filename.endsWith('.pptx')) {
      return await validatePptxBlob(result.blob);
    }
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png') || filename.endsWith('.webp')) {
      return validateImageBlob(result.blob);
    }
    if (filename.endsWith('.zip')) {
      return await validateZipBlob(result.blob);
    }
    // Generic fallback for other formats
    if (result.blob.size === 0) {
      return { valid: false, error: 'Output file is 0 bytes.' };
    }
    return { valid: true };
  } else if (result.type === 'multiple') {
    if (!result.files || result.files.length === 0) {
      return { valid: false, error: 'Multi-file output contains 0 extracted files.' };
    }
    return await validateZipBlob(result.zipBlob);
  }

  return { valid: false, error: 'Unknown result type.' };
}
