"use client";

import SmartResultBanner from "./SmartResultBanner";

/**
 * ResultReadyBar (Section 32)
 * Re-exports the global SmartResultBanner as ResultReadyBar
 * providing the user-scroll protection notification when async results complete offscreen.
 */
export const ResultReadyBar = SmartResultBanner;
export default SmartResultBanner;
