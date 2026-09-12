import { readFileAsDataURL, loadImage } from "@/lib/utils";

export interface IdPreset {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  targetWidthPx: number; // At 300 DPI
  targetHeightPx: number;
  description: string;
  photosPerSheet: number; // on 4x6 inch print
}

export const ID_PHOTO_PRESETS: IdPreset[] = [
  {
    id: "us-passport",
    name: "US Passport / Visa (2 x 2 in)",
    country: "United States",
    widthMm: 50.8,
    heightMm: 50.8,
    targetWidthPx: 600,
    targetHeightPx: 600,
    description: "Standard 2x2 inch biometric passport and visa specification.",
    photosPerSheet: 6
  },
  {
    id: "schengen-visa",
    name: "Schengen Visa & EU (35 x 45 mm)",
    country: "European Union / Schengen",
    widthMm: 35,
    heightMm: 45,
    targetWidthPx: 413,
    targetHeightPx: 531,
    description: "Standard 3.5 x 4.5 cm for European Schengen visas and passports.",
    photosPerSheet: 8
  },
  {
    id: "india-passport",
    name: "India Passport / OCI (35 x 45 mm)",
    country: "India",
    widthMm: 35,
    heightMm: 45,
    targetWidthPx: 413,
    targetHeightPx: 531,
    description: "Passport and visa dimensions for India & OCI applications.",
    photosPerSheet: 8
  },
  {
    id: "uk-passport",
    name: "UK & Commonwealth (35 x 45 mm)",
    country: "United Kingdom",
    widthMm: 35,
    heightMm: 45,
    targetWidthPx: 413,
    targetHeightPx: 531,
    description: "HM Passport Office 35mm x 45mm standard specification.",
    photosPerSheet: 8
  },
  {
    id: "student-admit",
    name: "Student ID / Exam Card (30 x 40 mm)",
    country: "Universal",
    widthMm: 30,
    heightMm: 40,
    targetWidthPx: 354,
    targetHeightPx: 472,
    description: "Compact format commonly required for university and exam portals.",
    photosPerSheet: 10
  }
];

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function generateIdPhoto(
  file: File,
  preset: IdPreset,
  cropArea: CropArea
): Promise<{ singleBlob: Blob; singleUrl: string; sheetBlob: Blob; sheetUrl: string }> {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  // 1. Render single cropped photo at 300 DPI target resolution
  const singleCanvas = document.createElement("canvas");
  singleCanvas.width = preset.targetWidthPx;
  singleCanvas.height = preset.targetHeightPx;
  const singleCtx = singleCanvas.getContext("2d");

  if (!singleCtx) {
    throw new Error("Could not initialize 2D context for single photo");
  }

  singleCtx.fillStyle = "#ffffff";
  singleCtx.fillRect(0, 0, singleCanvas.width, singleCanvas.height);
  singleCtx.imageSmoothingEnabled = true;
  singleCtx.imageSmoothingQuality = "high";

  singleCtx.drawImage(
    img,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    preset.targetWidthPx,
    preset.targetHeightPx
  );

  const singleBlob: Blob = await new Promise((resolve, reject) => {
    singleCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export single photo"))),
      "image/jpeg",
      0.95
    );
  });
  const singleUrl = URL.createObjectURL(singleBlob);

  // 2. Generate 4x6 inch printable sheet (1200 x 1800 px at 300 DPI)
  const sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = 1800; // 6 inches at 300 DPI
  sheetCanvas.height = 1200; // 4 inches at 300 DPI
  const sheetCtx = sheetCanvas.getContext("2d");

  if (!sheetCtx) {
    throw new Error("Could not initialize 2D context for print sheet");
  }

  // Pure white sheet background
  sheetCtx.fillStyle = "#ffffff";
  sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

  // Determine grid layout based on preset
  let cols = 3;
  let rows = 2;
  if (preset.id === "us-passport") {
    // 2x2 in: 3 cols x 2 rows = 6 photos (600x600 px each fits 1800x1200)
    cols = 3;
    rows = 2;
  } else if (preset.targetWidthPx <= 450) {
    // 35x45 mm (413x531 px): 4 cols x 2 rows = 8 photos
    cols = 4;
    rows = 2;
  }

  const cellWidth = sheetCanvas.width / cols;
  const cellHeight = sheetCanvas.height / rows;

  sheetCtx.lineWidth = 1;
  sheetCtx.strokeStyle = "#d4d4d8"; // light gray cutting guideline

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = c * cellWidth;
      const cellY = r * cellHeight;

      // Center photo in cell with a margin
      const photoX = cellX + (cellWidth - preset.targetWidthPx) / 2;
      const photoY = cellY + (cellHeight - preset.targetHeightPx) / 2;

      sheetCtx.drawImage(singleCanvas, photoX, photoY, preset.targetWidthPx, preset.targetHeightPx);

      // Draw subtle cut marks
      sheetCtx.strokeRect(photoX, photoY, preset.targetWidthPx, preset.targetHeightPx);
    }
  }

  const sheetBlob: Blob = await new Promise((resolve, reject) => {
    sheetCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export print sheet"))),
      "image/jpeg",
      0.95
    );
  });
  const sheetUrl = URL.createObjectURL(sheetBlob);

  return { singleBlob, singleUrl, sheetBlob, sheetUrl };
}
