// frontend/app/upload/page.tsx
"use client";

import React, { useContext, useState, useRef, useEffect, MouseEvent } from "react";
import { AppContext, BoundingBox } from "../../context/AppContext";
import { useRouter } from "next/navigation";

import {
  Box,
  Button,
  Heading,
  VStack,
  HStack,
  Text,
  // Center, // Center component was not used
  // AspectRatio, // AspectRatio component was not used directly, but its concept is applied via styles
  FileUpload, // Imported FileUpload
} from "@chakra-ui/react";
import { HiUpload } from "react-icons/hi"
import { RiArrowRightLine } from "react-icons/ri";
// Define a minimal type for FileUpload's onFileAccept details,
// as the exact type might be part of @chakra-ui/react a TSDoc or internal type.
// Based on the PDF, onFileAccept provides details about accepted files.
type FileAcceptDetails = {
  files: File[];
  // Add other properties from FileAcceptDetails if known or needed
};


export default function UploadPage() {
  const router = useRouter();
  const { setState } = useContext(AppContext);

  // --- File + preview state ---
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // --- Free-form marquee state ---
  const [selectionRect, setSelectionRect] = useState<BoundingBox | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  // --- Two-step flow state ---
  const [heroConfirmed, setHeroConfirmed] = useState(false);

  // --- Refs for image + canvas ---
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ─── Draw image + marquee on canvas ────────────────────────────────────────
  useEffect(() => {
    const canvasEl = canvasRef.current;
    const imageEl = imageRef.current;
    if (!canvasEl || !imageEl || !imagePreviewUrl) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const redraw = () => {
      // Ensure canvas dimensions match the displayed image dimensions
      // This is crucial for accurate coordinate mapping
      canvasEl.width = imageEl.clientWidth;
      canvasEl.height = imageEl.clientHeight;

      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height); // Clear previous drawings
      ctx.drawImage(imageEl, 0, 0, canvasEl.width, canvasEl.height); // Draw the image

      // If a selection rectangle exists, draw it
      if (selectionRect) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          selectionRect.x,
          selectionRect.y,
          selectionRect.width,
          selectionRect.height
        );
      }
    };

    // If the image is not yet loaded, draw it on load. Otherwise, draw immediately.
    if (!imageEl.complete) {
      imageEl.onload = redraw;
    } else {
      redraw();
    }
    // Redraw when the image URL or selection rectangle changes
  }, [imagePreviewUrl, selectionRect, imageRef, canvasRef]);

  // ─── Helpers for mouse coords ─────────────────────────────────────────────
  // Calculates mouse position relative to the canvas
  function getMousePos(
    canvas: HTMLCanvasElement,
    evt: globalThis.MouseEvent // Using globalThis.MouseEvent for clarity
  ): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect(); // Get canvas position and size
    return {
      x: evt.clientX - rect.left, // Adjust for canvas offset
      y: evt.clientY - rect.top,
    };
  }

  // ─── Mouse handlers for marquee ──────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || heroConfirmed) return; // Don't draw if hero is confirmed
    const pos = getMousePos(canvasRef.current, e.nativeEvent);
    setStartPoint(pos); // Set the starting point of the drawing
    setIsDrawing(true); // Activate drawing mode
    // Initialize selection rectangle at the starting point
    setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !canvasRef.current || heroConfirmed) return;
    const pos = getMousePos(canvasRef.current, e.nativeEvent);
    const width = pos.x - startPoint.x;
    const height = pos.y - startPoint.y;
    // Update selection rectangle dimensions based on mouse movement
    // Handles drawing in all directions by adjusting x, y, width, height
    setSelectionRect({
      x: width > 0 ? startPoint.x : pos.x,
      y: height > 0 ? startPoint.y : pos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (heroConfirmed) return;
    setIsDrawing(false); // Deactivate drawing mode
    // startPoint is kept to allow handleConfirm to use it if needed,
    // but for new drawings, it's reset on mouseDown.
    // For this implementation, resetting startPoint here is fine.
    // setStartPoint(null); // Optional: reset start point
  };

  // ─── File selection with Chakra UI FileUpload ─────────────────────────────
  function handleFileAccept(details: FileAcceptDetails) {
    const file = details.files?.[0] ?? null; // Get the first file (maxFiles is 1)
    setImageFile(file);
    setHeroConfirmed(false); // Reset hero confirmation
    setSelectionRect(null);  // Clear previous selection

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string); // Set image preview URL
      };
      reader.readAsDataURL(file); // Read file as data URL for preview
    } else {
      setImagePreviewUrl(null); // Clear preview if no file
    }
  }

  // ─── Confirm hero & save to context ─────────────────────────────────────
  function handleConfirm() {
    if (!imageFile || !selectionRect || !imageRef.current) {
      // Replaced alert with console.error for better DX in iframe environments
      console.error("Please select an image and drag out a hero box first.");
      // Optionally, you can implement a custom modal/toast for user feedback here
      return;
    }

    // Scale marquee coordinates from displayed (client) to original (natural) image pixels
    const img = imageRef.current;
    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;

    // Prevent division by zero if clientWidth or clientHeight is 0
    if (clientWidth === 0 || clientHeight === 0) {
        console.error("Image dimensions are not yet available for scaling.");
        return;
    }

    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const boxed: BoundingBox = {
      x: Math.round(selectionRect.x * scaleX),
      y: Math.round(selectionRect.y * scaleY),
      width: Math.round(selectionRect.width * scaleX),
      height: Math.round(selectionRect.height * scaleY),
    };

    setState((s) => ({
      ...s,
      sourceFile: imageFile,
      userInputHeroBbox: boxed,
    }));
    setHeroConfirmed(true); // Mark hero as confirmed
  }

  // ─── Reselect hero (go back to marquee) ─────────────────────────────────
  function handleReselect() {
    setHeroConfirmed(false); // Allow re-selection
    setSelectionRect(null);  // Clear current selection
  }

  // ─── Next step ───────────────────────────────────────────────────────────
  function handleNext() {
    if (!heroConfirmed) {
        console.error("Please confirm your hero selection before proceeding.");
        // Optionally, show a message to the user
        return;
    }
    router.push("/customize-elements"); // Navigate to the next page
  }


  return (
    <Box maxWidth="container.xl" mx="auto" py={100} px={100} minH="100vh">
      <VStack gap={6} align="stretch"> {/* Changed gap to spacing for VStack */}
        <Heading as="h1" size="2xl" textAlign="left">
          Step 2: Upload & Select Your Hero
        </Heading>

        {/** File input section using Chakra UI FileUpload **/}
        <FileUpload.Root
            maxFiles={1} // Allow only one file
            onFileAccept={handleFileAccept} // Handle accepted files
            accept={{ "image/*": [] }} // Accept all image types
        >
            <VStack gap={3} align="stretch"> {/* Changed gap to spacing */}
                <Text fontSize="lg" textAlign="left">
                    Upload a .jpg or .png image. File size should be less than 10MB.
                </Text>
                <FileUpload.Dropzone 
                    border="2px dashed" 
                    borderColor="orange.300" 
                    borderRadius="lg" // Slightly larger border radius
                    p={8} // Increased padding
                    _hover={{ borderColor: "orange.500", bg: "orange.50", }} // Hover effect
                    transition="all 0.2s ease-in-out"
                >
                    <VStack gap={3}>
                        <FileUpload.Label>
                            Drag & drop your image here, or click to browse
                        </FileUpload.Label>
                        
                        <FileUpload.HiddenInput />
                        <FileUpload.Trigger asChild>
                            <Button colorPalette="orange" variant="outline" size="md">
                                <HiUpload />Choose File
                            </Button>
                        </FileUpload.Trigger>
                    </VStack>
                </FileUpload.Dropzone>
                 {imageFile && ( // Display selected file name
                    <HStack gap={2} mt={2} align="center">
                        <Text fontSize="md">
                            Selected:
                        </Text>
                        <Text fontSize="md" fontWeight="medium">
                            {imageFile.name}
                        </Text>
                    </HStack>
                )}
                 <FileUpload.ItemGroup>
                    {/* This area can be used to display previews or file items if needed,
                        but for a single preview, we handle it outside FileUpload.Root */}
                 </FileUpload.ItemGroup>
            </VStack>
        </FileUpload.Root>

        {/** Preview + marquee canvas **/}
        {imagePreviewUrl && (
          <Box
            mt={6} // Add margin top for spacing
            border="2px solid" // Slightly thicker border
            borderColor="gray.200"
            overflow="hidden" // Keep overflow hidden
            boxShadow="lg" // Larger shadow for better depth
            alignSelf="center" // Center the preview box
            w="full" // Use full width of its container
            maxW={{ base: "80%", md: "50%", lg: "30%" }} // Responsive max width
            position="relative" // For absolute positioning of the canvas
            // Using a pseudo-element or an inner div for aspect ratio can be an alternative
            // For simplicity, direct img styling is used here.
          >   
               
              <img
                ref={imageRef}
                src={imagePreviewUrl}
                alt="Image Preview"
                style={{
                  display: "block", // Remove extra space below image
                  objectFit: "contain", // Ensure image fits while maintaining aspect ratio
                  width: "100%",      // Image takes full width of its parent Box
                  height: "auto",     // Height adjusts to maintain aspect ratio
                  userSelect: "none", // Prevent text selection on image
                  maxWidth: "1000px", // An upper limit for very large screens, if desired
                }}
              />
              {/* Canvas for drawing selection box */}
              <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%", // Canvas matches the image's displayed width
                height: "100%",// Canvas matches the image's displayed height
                cursor: heroConfirmed ? "default" : "crosshair", // Change cursor based on state
                display: "block",
                pointerEvents: heroConfirmed ? "none" : "auto", // Disable drawing if hero is confirmed
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={(e) => handleMouseDown(e as any)} // Basic touch support
              onTouchMove={(e) => handleMouseMove(e as any)}  // Basic touch support
              onTouchEnd={handleMouseUp}                       // Basic touch support
              />
          </Box>
        )}

        {/** Action Buttons: Confirm / Reselect / Next **/}
        {imagePreviewUrl && ( // Show buttons only if there's an image preview
          <Box
          position="fixed"
          left={0}
          right={0}
          bottom={0}
          bg="white"
          borderTopWidth="1px"
          borderColor="gray.200"
          zIndex={10}
          px={{ base: 4, md: 12 }}
          py={4}
          boxShadow="0 -2px 8px rgba(0,0,0,0.04)"
          display="flex"
          justifyContent="center"
        >
          <HStack gap={4} justify="center"> {/* Main container for the buttons */}
            {!heroConfirmed ? (
              // When hero is NOT confirmed, show helper text and Confirm button
              <VStack gap={2}>
                <Text fontSize="sm" color="grey.600" fontWeight={"semibold"}>
                  Click and drag to draw a box on the image to select the hero content. Include the area that you do not want to crop off.
                </Text>
                <Button
                  colorPalette="orange"
                  size="lg" // Larger button
                  onClick={handleConfirm}
                  px={8} // More padding
                  // Disable button until a selection is drawn
                  disabled={!selectionRect || selectionRect.width === 0 || selectionRect.height === 0}
                >
                  Confirm Hero
                </Button>
              </VStack>
            ) : (
              // When hero IS confirmed, show the next step buttons
              <>
                <Button
                  colorPalette="orange"
                  variant="outline"
                  size="lg"
                  onClick={handleReselect}
                >
                  Reselect Hero
                </Button>
                <Button
                  colorPalette="orange"
                  size="lg"
                  onClick={handleNext}
                >
                  Next Step: Customize Elements <RiArrowRightLine />
                </Button>
              </>
            )}
          </HStack>
        </Box>
      )}
    </VStack>
  </Box>
  );
}
