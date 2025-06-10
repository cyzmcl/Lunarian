// frontend/context/AppContext.tsx
"use client";

import React, { createContext, useState, ReactNode } from "react";

// Define the BoundingBox type
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AppState = {
  // From original brandkit - review if still needed or use more specific ones below
  fontFamily?: string; // General font, consider if copyFontFamily and ctaFont replace this
  brandColor?: string; // General brand color, consider if copyBrandColor etc. replace this

  // Upload page state
  sourceFile?: File | null;
  sourceImagePreviewUrl?: string | null; // For upload page preview
  userInputHeroBbox?: BoundingBox | null; // User-defined bounding box

  // Formats page state
  selectedFormats?: string[];

  // Logo settings (from customize-elements page)
  includeLogo?: boolean;
  logoFile?: File;
  logoPreviewUrl?: string | null; // For logo preview on customize page
  logoScope?: "all" | "selected";
  logoSelectedFormats?: string[]; // Made optional to align with initialization
  logoPositionByOrientation?: {
    square?: string;
    portrait?: string;
    landscape?: string;
  };
  logoAppliesToAll?: boolean; // This is derivable from logoScope, can be removed if not used elsewhere

  // Ad Copy settings (from customize-elements page)
  includeCopy?: boolean;
  adCopy?: string;
  copyFontFamily?: string; // Specific font for ad copy
  copyBrandColor?: string; // Specific color for ad copy text
  copyScope?: "all" | "selected";
  copySelectedFormats?: string[]; // Made optional
  copyPositionByOrientation?: {
    square?: string;
    portrait?: string;
    landscape?: string;
  };
  copyAppliesToAll?: boolean; // Derivable from copyScope

  // CTA settings (from customize-elements page)
  includeCta?: boolean;
  ctaText?: string;
  ctaFont?: string;
  ctaTextColor?: string;
  ctaBgColor?: string;
  ctaScope?: "all" | "selected";
  ctaSelectedFormats?: string[]; // Made optional
  ctaPositionByOrientation?: {
    square?: string;
    portrait?: string;
    landscape?: string;
  };
  ctaAppliesToAll?: boolean; // Derivable from ctaScope
};

// Initial state for the context
const initialState: AppState = {
  // General (review if needed)
  fontFamily: "Arial, sans-serif", // Default general font
  brandColor: "#000000", // Default general brand color

  // Upload
  sourceFile: null,
  sourceImagePreviewUrl: null,
  userInputHeroBbox: null,

  // Formats
  selectedFormats: [],

  // Logo
  includeLogo: false,
  logoFile: undefined,
  logoPreviewUrl: null,
  logoScope: "all",
  logoSelectedFormats: [],
  logoPositionByOrientation: {
    square: "top_center",
    portrait: "top_center",
    landscape: "middle_left",
  },
  logoAppliesToAll: true, // Initial value if you keep it

  // Ad Copy
  includeCopy: false,
  adCopy: "",
  copyFontFamily: "Arial, sans-serif", // Default ad copy font
  copyBrandColor: "#000000", // Default ad copy text color (black)
  copyScope: "all",
  copySelectedFormats: [],
  copyPositionByOrientation: {
    square: "bottom_center",
    portrait: "bottom_center",
    landscape: "middle_right",
  },
  copyAppliesToAll: true,

  // CTA
  includeCta: false,
  ctaText: "",
  ctaFont: "Arial, sans-serif", // Default CTA font
  ctaTextColor: "#FFFFFF", // Default CTA text color (white)
  ctaBgColor: "#000000", //
  ctaScope: "all",
  ctaSelectedFormats: [],
  ctaPositionByOrientation: {
    square: "bottom_center",
    portrait: "bottom_center",
    landscape: "middle_right",
  },
  ctaAppliesToAll: true,
};

export const AppContext = createContext<{
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}>({
  state: initialState,
  setState: () => {}, // Default empty function
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  return (
    <AppContext.Provider value={{ state, setState }}>
      {children}
    </AppContext.Provider>
  );
}
