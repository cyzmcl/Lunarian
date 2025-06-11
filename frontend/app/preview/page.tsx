// frontend/app/preview/page.tsx
"use client";

import { useContext, useEffect, useState } from "react";
import { AppContext } from "../../context/AppContext";
import { useRouter } from "next/navigation";
import { 
  DownloadTrigger, 
  Button,
  Heading,
  Box,
  Text,
  Stack,
  Card,
  SimpleGrid,
  VStack,
  HStack,
  Spinner,
} from "@chakra-ui/react"
import JSZip from "jszip";

type PreviewData = {
  formatId: string;
  label: string;
  imageSrc: string;
};

// ───────────────────────────────────────────────────────────────────────────────
// Your full format map
const FORMAT_MAP: Record<string, { label: string; width: number; height: number }> = {
  "fb-feed-1440x1440":    { label: "Feed: 1440×1440 (1:1)",       width: 1440, height: 1440 },
  "fb-feed-1440x1800":    { label: "Feed (Vertical): 1440×1800 (4:5)", width: 1440, height: 1800 },
  "fb-story-1440x2560":   { label: "Story: 1440×2560 (9:16)",      width: 1440, height: 2560 },
  "fb-feed-1200x628":     { label: "Feed (Horizontal): 1200×628 (1.91:1)",      width: 1200, height: 628 },

  "tw-multi-1200x1200":   { label: "Single/Multi: 1200×1200 (1:1)",  width: 1200, height: 1200 },
  "tw-multi-1200x628":    { label: "Single/Multi: 1200×628 (1.91:1)", width: 1200, height: 628 },

  "li-1200x628":          { label: "LinkedIn Single: 1200×628 (1.91:1)", width: 1200, height: 628 },
  "li-1200x1200":         { label: "LinkedIn Single: 1200×1200 (1:1)",   width: 1200, height: 1200 },
  "li-628x1200":          { label: "LinkedIn Vertical: 628×1200 (1:1.91)", width: 628, height: 1200 },
  "li-2560x1440":         { label: "LinkedIn Click-to-Message: 2560×1440 (16:9)", width: 2560, height: 1440 },

  "pin-1000x1500":        { label: "Pinterest Vertical: 1000×1500",    width: 1000, height: 1500 },
  "pin-1200x1200":        { label: "Pinterest Square: 1200×1200",      width: 1200, height: 1200 },

  "dd-leaderboard-728x90":{ label: "Leaderboard: 728×90",             width: 728,  height: 90  },
  "dd-medrect-300x250":   { label: "Medium Rect: 300×250",             width: 300,  height: 250 },
  "dd-largerect-336x280": { label: "Large Rect: 336×280",              width: 336,  height: 280 },
  "dd-halfpage-300x600":  { label: "Half Page / Skyscraper: 300×600",  width: 300,  height: 600 },
  "dd-widesky-160x600":   { label: "Wide Skyscraper: 160×600",         width: 160,  height: 600 },
  "dd-billboard-970x250": { label: "Billboard: 970×250",               width: 970,  height: 250 },
  "dd-square-1200x1200":  { label: "Square: 1200×1200",                width: 1200, height: 1200 },
  "dd-skinnybanner-1200x300":     { label: "Skinny Banner: 1200×300",          width: 1200, height: 300 },
  "dd-vertical-960x1200": { label: "Vertical: 960×1200",               width: 960,  height: 1200 },

  "dm-mobilebanner-320x50":   { label: "Mobile Banner: 320×50",        width: 320,  height: 50   },
  "dm-largebanner-320x100":   { label: "Large Mobile Banner: 320×100", width: 320,  height: 100  },
  "dm-interstitial-640x1136": { label: "Interstitial: 640×1136",        width: 640,  height: 1136 },
  "dm-interstitial-750x1334": { label: "Interstitial: 750×1334",        width: 750,  height: 1334 },
};
// ───────────────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const { state } = useContext(AppContext);
  const [previews, setPreviews] = useState<PreviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isZipping, setIsZipping] = useState(false); // State for bulk download loading

  const router = useRouter();

// --- NEW: Function to handle bulk download ---
  const handleBulkDownload = async () => {
    if (previews.length === 0) return;
    setIsZipping(true);

    const zip = new JSZip();

    // Use Promise.all to fetch all images concurrently
    await Promise.all(
      previews.map(async (preview) => {
        try {
          const response = await fetch(preview.imageSrc);
          const blob = await response.blob();
          // Add each image to the zip file with a proper name
          zip.file(`${preview.formatId}.png`, blob);
        } catch (error) {
          console.error(`Failed to fetch image for ${preview.formatId}:`, error);
        }
      })
    );

    // Generate the zip file and trigger download
    zip.generateAsync({ type: "blob" }).then((content) => {
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "lunarian-ads.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsZipping(false);
    });
  };

  const handleDownload = async (imageSrc: string, fileName: string) => {
    try {
      // Fetch the image data from the base64 URL
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      // Append to the DOM, click it, and then remove it
      document.body.appendChild(a);
      a.click();
      
      // Clean up the temporary URL
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      // You could add a user-facing error message here, e.g., using a toast
    }
  };

  useEffect(() => {
    if (!state.sourceFile) {
      router.push("/upload");
      return;
    }
    async function fetchPreviews() {
      setLoading(true);

      // 1) Destructure with defaults so nothing is undefined
      const {
        sourceFile,
        logoFile,
        copyBrandColor,
        selectedFormats = [],
        userInputHeroBbox,
        ctaBgColor,
        ctaTextColor,
      } = state;

      // 2) Convert uploaded Files to base64 Data URLs
      const toDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const sourceImage = sourceFile ? await toDataUrl(sourceFile) : "";
      const brandLogo   = logoFile   ? await toDataUrl(logoFile)   : "";

      // 3) Build formats array expected by the API
      const formats = selectedFormats.map((id) => {
        const fmt = FORMAT_MAP[id];
        return { id, width: fmt.width, height: fmt.height };
      });

      // 4) Construct payload and POST
      const payload = {
        sourceImage,
        brandLogo,
        copyBrandColor: state.copyBrandColor,
        includeLogo:state.includeLogo,
        logoAppliesToAll: state.logoAppliesToAll,
        logoSelectedFormats: state.logoSelectedFormats,
        logoPositionByOrientation: state.logoPositionByOrientation,
        includeCopy: state.includeCopy,
        adCopy: state.adCopy,
        copyAppliesToAll: state.copyAppliesToAll,
        copySelectedFormats: state.copySelectedFormats,
        copyPositionByOrientation: state.copyPositionByOrientation,
        includeCta: state.includeCta,
        ctaText: state.ctaText,
        ctaAppliesToAll: state.ctaAppliesToAll,
        ctaSelectedFormats: state.ctaSelectedFormats,
        ctaPositionByOrientation: state.ctaPositionByOrientation,
        ctaTextColor: state.ctaTextColor,
        ctaBgColor: state.ctaBgColor,
        ctaFont: state.ctaFont,
        formats,
        userInputHeroBbox,
      };
      console.log("POST /generate payload =", payload);
      
      const start: number = performance.now();

      const response = await fetch("https://cyzmcl--lunarian-backend-modal-fastapi-app.modal.run/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const end = performance.now();
      console.log(`⏱️ API response time: ${(end - start).toFixed(2)} ms`);

      if (!response.ok) {
        console.error("Generate API error:", await response.text());
        setLoading(false);
        return;
      }

      let json;
    try {
      json = await response.json();
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      setLoading(false);
      return;
    }
    console.log("✅ Generate result:", json);

    const results = (json.results || {}) as Record<string, string>;

      // 5) Map results back into PreviewData[]
      const data = selectedFormats.map((id) => ({
        formatId: id,
        label: FORMAT_MAP[id]?.label ?? id,
        imageSrc: results[id],
      }));

      setPreviews(data);
      setLoading(false);
    }

    fetchPreviews();
  }, [state]);

  if (loading) {
    return (
      <VStack colorPalette="orange" maxWidth="container.xl" mx="auto" py={100} px={100} minH="100vh">
      <Spinner color="colorPalette.600" />
      <Text color="colorPalette.600">Generating your ads...</Text>
    </VStack>
    );
  }


  return (
    <Box maxWidth="container.xl" mx="auto" py={100} px={100} minH="100vh">
      <VStack gap={6} align="stretch">
      <HStack justify="space-between" align="center">
          <Heading as="h1" size="2xl" textAlign="left">
            Preview Your Ads
          </Heading>
          {/* --- NEW: Bulk Download Button --- */}
          <Button
            onClick={handleBulkDownload}
            colorPalette="orange"
            loading={isZipping}
            loadingText="Zipping..."
            disabled={loading || previews.length === 0}
          >
            Download All as ZIP
          </Button>
        </HStack>
      <div
        className="grid"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        {previews.map((preview) => (
          <VStack key={preview.formatId} style={{ textAlign: "center" }}>
            <img
              src={preview.imageSrc}
              alt={preview.label}
              style={{ maxWidth: "100%", border: "1px solid #ddd", borderRadius: 4 }}
            />
            <div style={{ marginTop: 8 }}>{preview.label}</div>
            
            {/* --- FIXED: Replaced DownloadTrigger with a standard anchor-styled button --- */}
                <Button
                  onClick={() => handleDownload(preview.imageSrc, `${preview.formatId}.png`)}
                  variant="outline" 
                  colorPalette={"orange"} 
                  size="sm"
                >
                  Download
                </Button>
          </VStack>
        ))}
      </div>
      </VStack>
    </Box>
  );
}
