import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function sanitizeFilename(filename: string, fallback: string = "document"): string {
  if (!filename || typeof filename !== "string") return fallback;
  // Strip path traversal and slashes
  const basename = filename.replace(/^.*[\\/]/, "");
  // Replace invalid filesystem characters with underscores
  const clean = basename.replace(/[^a-zA-Z0-9._-]/g, "_").trim();
  return clean.length > 0 ? clean : fallback;
}

export function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const cleanName = sanitizeFilename(filename);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = cleanName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 4000);
    return true;
  } catch (err) {
    console.warn("Programmatic download failed or was blocked by browser:", err);
    return false;
  }
}

export function downloadZip(blob: Blob, filename: string): boolean {
  const name = filename.toLowerCase().endsWith(".zip") ? filename : `${filename}.zip`;
  return downloadBlob(blob, name);
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + e));
    img.src = src;
  });
}
