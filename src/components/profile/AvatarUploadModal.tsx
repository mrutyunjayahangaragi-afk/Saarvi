"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, X, Trash2, Camera, Check, AlertCircle, Loader2 } from "lucide-react";

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string | null;
  userFullName?: string;
  onAvatarUpdated: (newUrl: string | null) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function AvatarUploadModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  userFullName,
  onAvatarUpdated,
}: AvatarUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewSrc(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("File exceeds 5MB size limit. Please choose a smaller image.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const generateCropped512Webp = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!previewSrc) {
        return reject(new Error("No preview source"));
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Canvas context failed"));
        }

        // Center square crop
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 512, 512);

        // Convert to WebP data URL
        const dataUrl = canvas.toDataURL("image/webp", 0.92);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image for cropping"));
      img.src = previewSrc;
    });
  };

  const handleUpload = async () => {
    if (!selectedFile && !previewSrc) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const croppedBase64 = await generateCropped512Webp();

      const response = await fetch("/api/user/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Data: croppedBase64,
          mimeType: "image/webp",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload avatar");
      }

      setSuccessMessage("Profile photo updated successfully!");
      onAvatarUpdated(result.avatarUrl);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to remove avatar");
      }

      setSuccessMessage("Profile photo removed.");
      onAvatarUpdated(null);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete avatar");
    } finally {
      setIsDeleting(false);
    }
  };

  const initials = userFullName
    ? userFullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "S";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Profile Photo</h3>
            <p className="text-xs text-slate-500">
              Upload a 512×512 square photo (WebP, PNG, JPEG up to 5MB)
            </p>
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Preview Circle */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative w-32 h-32 rounded-full ring-4 ring-slate-100 shadow-md overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-extrabold select-none">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
              />
            ) : currentAvatarUrl ? (
              <img
                src={currentAvatarUrl}
                alt="Current Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 font-medium">
            Square 1:1 auto-crop applied
          </span>
        </div>

        {/* Hidden Canvas for High-Precision 512x512 Crop */}
        <canvas ref={canvasRef} className="hidden" width={512} height={512} />

        {/* File Input & Actions */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="space-y-3">
          {!previewSrc ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Choose Photo from Device</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Choose Different
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Photo</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Delete current avatar if exists */}
          {currentAvatarUrl && !previewSrc && (
            <div className="pt-2 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Remove current photo</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
