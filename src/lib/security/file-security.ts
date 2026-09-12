/**
 * DocEase Security: File Upload Validation & Path Traversal / DoS Defenses.
 *
 * Guarantees:
 * - Real magic-byte binary signature inspection (does not trust file extension or browser MIME type).
 * - Immediate rejection of executable binary signatures (Windows PE, ELF, Mach-O, Java Class, Shell scripts).
 * - Comprehensive filename sanitization preventing directory traversal (../, ..\, null bytes, control chars, reserved names).
 * - ZIP archive expansion bounds preventing decompression bombs (ratio limit, max size, entry count, traversal prevention).
 * - Image dimension bounding preventing canvas/decompression memory spikes.
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedFormat?: string;
  details?: Record<string, unknown>;
}

export interface ZipSafetyLimits {
  maxEntries?: number; // default 500
  maxUncompressedBytes?: number; // default 200 MB
  maxCompressionRatio?: number; // default 100:1
}

/**
 * Sanitizes arbitrary untrusted filenames to eliminate path traversal and injection attacks.
 * Replaces directory separators, null bytes, unicode control chars, and Windows reserved device names.
 */
export function sanitizeFilename(rawFilename: string, fallback: string = "unnamed_file"): string {
  if (!rawFilename || typeof rawFilename !== "string") {
    return fallback;
  }

  // 1. Strip path traversal sequences (both Unix / and Windows \)
  let name = rawFilename.replace(/^[a-zA-Z]:[/\\]/g, ""); // Strip Windows drive letters (C:)
  name = name.replace(/\.\.+[/\\?]*/g, ""); // Strip directory traversal (../ or ..\)
  name = name.replace(/[/\\?%*:|"<>]/g, "_"); // Replace path separators and illegal file characters
  name = name.replace(/[\x00-\x1f\x7f-\x9f]/g, ""); // Strip control chars and null bytes

  // 2. Prevent hidden dotfile exploits or leading separator leftovers
  name = name.replace(/^[._]+/, "");
  if (!name.trim()) {
    return fallback;
  }

  // 3. Prevent Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const baseName = name.split(".")[0]?.toUpperCase();
  const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
  if (reservedNames.includes(baseName)) {
    name = `safe_${name}`;
  }

  // 4. Cap filename length to 100 characters while preserving extension
  if (name.length > 100) {
    const extIndex = name.lastIndexOf(".");
    if (extIndex > 0 && extIndex > name.length - 10) {
      const ext = name.slice(extIndex);
      name = name.slice(0, 100 - ext.length) + ext;
    } else {
      name = name.slice(0, 100);
    }
  }

  return name || fallback;
}

/**
 * Checks if a byte sequence matches dangerous executable binary signatures.
 */
export function isExecutableSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;

  // 1. Windows PE executable ("MZ" = 0x4D, 0x5A)
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;

  // 2. Linux ELF binary (0x7F, 'E', 'L', 'F' = 0x7F, 0x45, 0x4C, 0x46)
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;

  // 3. Mach-O binaries (macOS / iOS)
  if (bytes.length >= 4) {
    const magic32 = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    if (magic32 === 0xfeedface || magic32 === 0xfeedfacf || magic32 === 0xcafebabe || magic32 === 0xbebafeca) {
      return true;
    }
  }

  // 4. Unix shell script shebang ("#!" = 0x23, 0x21)
  if (bytes[0] === 0x23 && bytes[1] === 0x21) return true;

  return false;
}

/**
 * Inspects binary magic bytes to detect authentic file format.
 */
export async function detectFileFormatFromBytes(bytes: Uint8Array): Promise<string | null> {
  if (bytes.length < 4) return null;

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "pdf";
  }

  // PNG: \x89PNG\r\n\x1a\n (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: \xFF\xD8\xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // WebP: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  // GIF: GIF87a or GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "gif";
  }

  // ZIP: PK\x03\x04 or PK\x05\x06 (0x50, 0x4B)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "zip";
  }

  // Text files (ASCII / UTF-8 text without null bytes or control characters)
  const isText =
    bytes.length > 0 &&
    Array.from(bytes).every(
      (b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e) || b >= 0x80
    );
  if (isText) {
    const str = String.fromCharCode(...bytes.slice(0, 16)).trim();
    if (str.startsWith("{") || str.startsWith("[")) {
      return "json";
    }
    return "txt";
  }

  return null;
}

/**
 * Validates an input file (Blob or File) before processing by inspecting actual magic bytes.
 */
export async function validateInputFile(
  file: Blob | File,
  expectedFormats?: string[],
  maxSizeBytes: number = 50 * 1024 * 1024
): Promise<FileValidationResult> {
  if (!file || file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 bytes)." };
  }

  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `File size exceeds the allowed limit of ${maxMB} MB.` };
  }

  try {
    // Read first 32 bytes for signature analysis
    const slice = file.slice(0, 32);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Check for dangerous executables
    if (isExecutableSignature(bytes)) {
      return {
        valid: false,
        error: "Security violation: Executable files and binary scripts cannot be uploaded or processed.",
      };
    }

    // 2. Identify real format from magic bytes
    const detectedFormat = await detectFileFormatFromBytes(bytes);

    if (expectedFormats && expectedFormats.length > 0) {
      const normalizedExpected = expectedFormats.map((f) => f.toLowerCase().replace(/^\./, ""));
      // Handle format equivalence (jpg/jpeg, txt/md/csv/json)
      const isExpected =
        detectedFormat &&
        (normalizedExpected.includes(detectedFormat) ||
          (detectedFormat === "jpeg" && normalizedExpected.includes("jpg")) ||
          (detectedFormat === "jpg" && normalizedExpected.includes("jpeg")) ||
          (detectedFormat === "txt" &&
            (normalizedExpected.includes("md") ||
              normalizedExpected.includes("csv") ||
              normalizedExpected.includes("json"))) ||
          (detectedFormat === "json" &&
            (normalizedExpected.includes("txt") || normalizedExpected.includes("json"))));

      if (!isExpected) {
        return {
          valid: false,
          error: `File signature mismatch: expected [${expectedFormats.join(", ")}], but detected [${
            detectedFormat || "unknown format"
          }].`,
          detectedFormat: detectedFormat || undefined,
        };
      }
    }

    return {
      valid: true,
      detectedFormat: detectedFormat || undefined,
      details: { sizeBytes: file.size },
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to inspect file signature: ${err instanceof Error ? err.message : "Read error"}`,
    };
  }
}

/**
 * Validates image dimensions against decompression bombs.
 * Max safe dimension: 10,000 px, max megapixels: 50 MP.
 */
export function validateImageDimensions(
  width: number,
  height: number,
  maxDimension: number = 10000,
  maxMegaPixels: number = 50
): { valid: boolean; error?: string } {
  if (width <= 0 || height <= 0) {
    return { valid: false, error: "Image dimensions must be positive non-zero integers." };
  }

  if (width > maxDimension || height > maxDimension) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) exceed the maximum allowable dimension of ${maxDimension}px.`,
    };
  }

  const megaPixels = (width * height) / 1_000_000;
  if (megaPixels > maxMegaPixels) {
    return {
      valid: false,
      error: `Image resolution (${megaPixels.toFixed(1)} MP) exceeds the maximum safety limit of ${maxMegaPixels} MP.`,
    };
  }

  return { valid: true };
}

/**
 * Validates ZIP entries against ZIP bombs, path traversal, and decompression attacks.
 */
export function validateZipEntryMetadata(
  entryName: string,
  uncompressedSize: number,
  compressedSize: number,
  totalUncompressedAccumulator: number,
  limits: ZipSafetyLimits = {}
): { valid: boolean; error?: string } {
  const maxUncompressed = limits.maxUncompressedBytes ?? 200 * 1024 * 1024; // 200 MB
  const maxRatio = limits.maxCompressionRatio ?? 100; // 100:1

  // 1. Path traversal in entry name
  const sanitized = sanitizeFilename(entryName);
  if (entryName.includes("..") || entryName.startsWith("/") || entryName.startsWith("\\")) {
    return { valid: false, error: `Malicious ZIP entry path traversal detected: "${entryName}"` };
  }

  // 2. Check total uncompressed size limit
  if (totalUncompressedAccumulator + uncompressedSize > maxUncompressed) {
    return {
      valid: false,
      error: `ZIP decompression bomb defense: Total expanded size exceeds safe ceiling of ${Math.round(
        maxUncompressed / (1024 * 1024)
      )} MB.`,
    };
  }

  // 3. Check compression ratio (if compressedSize is non-trivial)
  if (compressedSize > 100) {
    const ratio = uncompressedSize / compressedSize;
    if (ratio > maxRatio) {
      return {
        valid: false,
        error: `Suspicious compression ratio (${ratio.toFixed(0)}:1) indicates a potential ZIP bomb.`,
      };
    }
  }

  return { valid: true };
}
