// frontend/app/customize-elements/page.tsx
"use client";

import React, { useState, useContext, ChangeEvent, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppContext } from "../../context/AppContext";
import {
  Box,
  Heading,
  Button,
  Input, 
  Textarea,
  Stack,
  VStack,
  HStack,
  Text,
  SimpleGrid,
  RadioGroup,
  Image as ChakraImage,
  Separator, // Changed from Divider
  // Chakra UI v3 specific imports
  Select,
  Switch,
  Checkbox,
  Field,
  Card,
  Alert,
  FileUpload,
  ColorPicker, 
  Portal, // For ColorPicker.Positioner
  parseColor, // For ColorPicker.Root value
  createListCollection, 
} from "@chakra-ui/react"; 
import { Toaster, toaster } from "../../components/ui/toaster";
import { HiUpload } from "react-icons/hi";
import { RiArrowRightLine, RiArrowLeftLine, RiMailLine } from "react-icons/ri"

// Constants
const POSITION_OPTIONS_DATA = [
  { value: "top_left", label: "Top Left" },
  { value: "top_center", label: "Top Center" },
  { value: "top_right", label: "Top Right" },
  { value: "middle_left", label: "Middle Left" },
  { value: "middle_center", label: "Middle Center" },
  { value: "middle_right", label: "Middle Right" },
  { value: "bottom_left", label: "Bottom Left" },
  { value: "bottom_center", label: "Bottom Center" },
  { value: "bottom_right", label: "Bottom Right" },
];
const AI_CHOOSE_OPTION_DATA = { value: "let_ai_choose", label: "Let AI Choose" };

const FONT_OPTIONS_DATA = [
    { label: "Arial", value: "Arial, sans-serif", filename: "Arial.ttf" },
    { label: "Helvetica", value: "Helvetica, sans-serif", filename: "Helvetica.ttf" },
    { label: "Inter", value: "Inter, sans-serif", filename: "Inter.ttf" },
    { label: "Inter Italic", value: "Inter-Italic, sans-serif", filename: "Inter-Italic.ttf" },
    { label: "Roboto", value: "Roboto, sans-serif", filename: "Roboto.ttf" },
    { label: "Open Sans", value: "'Open Sans', sans-serif", filename: "OpenSans.ttf" },
    { label: "Lato", value: "Lato, sans-serif", filename: "Lato.ttf" },
    { label: "Montserrat", value: "Montserrat, sans-serif", filename: "Montserrat.ttf" },
    { label: "Poppins", value: "Poppins, sans-serif", filename: "Poppins.ttf" },
    { label: "Nunito", value: "Nunito, sans-serif", filename: "Nunito.ttf" },
    { label: "Rubik", value: "Rubik, sans-serif", filename: "Rubik.ttf" },
    { label: "Georgia", value: "Georgia, serif", filename: "Georgia.ttf" },
    { label: "Times New Roman", value: "Times, serif", filename: "Times.ttf" },
];

// Placeholder Icons (replace with actual Chakra UI v3 icons or a library like lucide-react)
const ArrowBackIcon = (props: any) => <Text as="span" {...props}>&larr;</Text>;
const ArrowForwardIcon = (props: any) => <Text as="span" {...props}>&rarr;</Text>;
const PaletteIcon = (props: any) => ( 
  <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" {...props}>
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5c-6.07 0-11-4.93-11-11S5.93 1 12 1c5.3 0 9.68 3.66 10.74 8.45.24.98-.34 1.94-1.32 2.18-.98.24-1.94-.34-2.18-1.32C18.56 6.04 15.55 3 12 3zm6.5 9c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10.5c-.83 0-1.5-.67-1.5-1.5S5.17 7.5 6 7.5s1.5.67 1.5 1.5S6.83 10.5 6 10.5zm6-3c-.83 0-1.5-.67-1.5-1.5S11.17 4.5 12 4.5s1.5.67 1.5 1.5S12.83 7.5 12 7.5zm3 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>
);

type OrientationPosition = { square?: string; portrait?: string; landscape?: string };
interface Item { value: string; label: string; disabled?: boolean; } 

const ElementCustomizationSection = ({
  elementKey,
  title,
  includeState,
  onIncludeChange,
  children
}: {
  elementKey: string;
  title: string;
  includeState: boolean;
  onIncludeChange: (details: { checked: boolean }) => void;
  children: React.ReactNode;
}) => (
  <Card.Root variant="outline">
    <Card.Header pb={includeState ? 2 : 4} pt={4} px={6}>
      <HStack justifyContent="space-between" alignItems="center">
        <Switch.Root
          id={`include-${elementKey}-switch`}
          checked={includeState}
          onCheckedChange={onIncludeChange}
          colorPalette="orange"
          size="md"
        >
          <Switch.HiddenInput />
          <Switch.Control>
              <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
        <Text fontWeight="semibold" fontSize="lg"
          onClick={() => onIncludeChange({checked: !includeState})}
          cursor="pointer"
          flexGrow={1}
        >
          {title}
        </Text>
      </HStack>
    </Card.Header>
    {includeState && (
      <>
        <Separator />
        <Card.Body pt={4} px={6} pb={6}>
          {children}
        </Card.Body>
      </>
    )}
  </Card.Root>
);

export default function CustomizeElementsPage() {
  const router = useRouter();
  const { state, setState } = useContext(AppContext);

  // --- State declarations ---
  const [includeLogo, setIncludeLogo] = useState(state.includeLogo || false);
  const [logoFile, setLogoFile] = useState<File | undefined>(state.logoFile);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(state.logoPreviewUrl || null);
  const [logoScope, setLogoScope] = useState<"all" | "selected">(state.logoScope || "all");
  const [logoFormats, setLogoFormats] = useState<string[]>(state.logoSelectedFormats || []);
  const [logoPositionByOrientation, setLogoPositionByOrientation] = useState<OrientationPosition>(
    state.logoPositionByOrientation || { square: "top_center", portrait: "top_center", landscape: "middle_left" }
  );

  const [includeCopy, setIncludeCopy] = useState(state.includeCopy || false);
  const [adCopy, setAdCopy] = useState(state.adCopy || "");
  const [copyFontFamily, setCopyFontFamily] = useState(state.copyFontFamily || FONT_OPTIONS_DATA[0].value);
  const [copyBrandColor, setCopyBrandColor] = useState(state.copyBrandColor || "#000000");
  const [copyScope, setCopyScope] = useState<"all" | "selected">(state.copyScope || "all");
  const [copyFormats, setCopyFormats] = useState<string[]>(state.copySelectedFormats || []);
  const [copyPositionByOrientation, setCopyPositionByOrientation] = useState<OrientationPosition>(
    state.copyPositionByOrientation || { square: "bottom_center", portrait: "bottom_center", landscape: "middle_right" }
  );

  const [includeCta, setIncludeCta] = useState(state.includeCta || false);
  const [ctaText, setCtaText] = useState(state.ctaText || "");
  const [ctaFont, setCtaFont] = useState(state.ctaFont || FONT_OPTIONS_DATA[0].value);
  const [ctaTextColor, setCtaTextColor] = useState(state.ctaTextColor || "#FFFFFF");
  const [ctaBgColor, setCtaBgColor] = useState(state.ctaBgColor || "#000000"); 
  const [ctaScope, setCtaScope] = useState<"all" | "selected">(state.ctaScope || "all");
  const [ctaFormats, setCtaFormats] = useState<string[]>(state.ctaSelectedFormats || []);
  const [ctaPositionByOrientation, setCtaPositionByOrientation] = useState<OrientationPosition>(
    state.ctaPositionByOrientation || { square: "bottom_center", portrait: "bottom_center", landscape: "middle_right" }
  );
  
  
  // --- Effects and handlers ---
  React.useEffect(() => {
    if (state.logoFile && !logoPreviewUrl && !logoFile) { 
        setLogoFile(state.logoFile); 
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreviewUrl(reader.result as string);
        reader.readAsDataURL(state.logoFile);
    }
  }, [state.logoFile, logoPreviewUrl, logoFile]);

  const handleLogoFileUpload = (details: FileUpload.FileChangeDetails) => { 
    if (details.acceptedFiles && details.acceptedFiles.length > 0) {
      const file = details.acceptedFiles[0];
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (details.rejectedFiles && details.rejectedFiles.length > 0) {
        toaster.create({ title: "Logo Upload Failed", description: details.rejectedFiles[0].errors.map((err: any) => err.message).join(', '), type: "error" });
        setLogoFile(undefined);
        setLogoPreviewUrl(null);
    }
  };
  
  const clearLogoFile = () => {
    setLogoFile(undefined);
    setLogoPreviewUrl(null);
  };

  const positionSelectCollection = useMemo(() => createListCollection({ items: POSITION_OPTIONS_DATA as Item[] }), []);
  const aiPositionSelectCollection = useMemo(() => createListCollection({ items: [AI_CHOOSE_OPTION_DATA, ...POSITION_OPTIONS_DATA] as Item[] }), []);
  const fontSelectCollection = useMemo(() => createListCollection({ items: FONT_OPTIONS_DATA as Item[] }), []);

  const renderPositionSelectors = (
    type: "logo" | "copy" | "cta",
    currentPositions: OrientationPosition,
    setter: React.Dispatch<React.SetStateAction<OrientationPosition>>
  ) => {
    const collection = type !== "logo" ? aiPositionSelectCollection : positionSelectCollection;
    return (
      <Box mt={4}>
        <Text fontSize="sm" fontWeight="medium" mb={2}>Choose position</Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {(["square", "portrait", "landscape"] as const).map(shape => (
            <Field.Root key={`${type}-${shape}`} id={`${type}-${shape}-pos`}>
              <Field.Label fontSize="xs" textTransform="capitalize" htmlFor={`${type}-${shape}-pos-select`}>{shape}</Field.Label>
              <Select.Root
                id={`${type}-${shape}-pos-select`}
                collection={collection}
                value={currentPositions[shape] ? [currentPositions[shape] as string] : []}
                onValueChange={(details) => {
                  if (details.value.length > 0) {
                    setter(prev => ({ ...prev, [shape]: details.value[0] }));
                  } else { 
                     setter(prev => ({ ...prev, [shape]: type !== "logo" ? AI_CHOOSE_OPTION_DATA.value : POSITION_OPTIONS_DATA[0].value }));
                  }
                }}
                size="sm"
                width="full"
                positioning={{ sameWidth: true }}
              >
                <Select.Trigger>
                  <Select.ValueText placeholder={`Select ${shape} position`} /> 
                </Select.Trigger>
                <Portal> 
                  <Select.Positioner>
                    <Select.Content>
                      {(collection.items as Item[]).map((item: Item) => ( 
                          <Select.Item key={item.value} item={item}> 
                              {item.label}
                          </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Field.Root>
          ))}
        </SimpleGrid>
      </Box>
    );
  };

const renderScopeSelector = (
    type: "logo" | "copy" | "cta",
    scope: "all" | "selected",
    scopeSetter: React.Dispatch<React.SetStateAction<"all" | "selected">>,
    selectedFormatsForElement: string[],
    selectedFormatsSetter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const availableFormats = state.selectedFormats || [];
    return (
      <Box my={4}>
        <Text fontSize="sm" fontWeight="semibold" mb={2}>Apply to:</Text>
        <RadioGroup.Root 
          value={scope} 
          onValueChange={(details) => scopeSetter(details.value as "all" | "selected")} // details.value is string
          variant="solid"
          colorPalette="orange" // Apply colorPalette to RadioGroup.Root
        >
          <HStack gap={4} mb={scope === "selected" && availableFormats.length > 0 ? 2 : 0}>
            <RadioGroup.Item value="all" id={`${type}-scope-all`}>
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemIndicator />
              <RadioGroup.Label>All selected formats ({availableFormats.length})</RadioGroup.Label>
            </RadioGroup.Item>
            <RadioGroup.Item value="selected" id={`${type}-scope-specific`}>
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemIndicator />
              <RadioGroup.Label>Specific formats</RadioGroup.Label>
            </RadioGroup.Item>
          </HStack>
        </RadioGroup.Root>
        
        {scope === "selected" && (
          <Box pl={2} ml={2} borderLeftWidth="2px" borderColor="orange.200" mt={3} py={2} pr={2} maxH="150px" overflowY="auto" bg="whiteAlpha.500" borderRadius="md">
            {availableFormats.length > 0 ? (
              availableFormats.map(fmtId => {
                const formatDetail = categoriesDataForLabels.flatMap(c => c.sizes).find(s => s.id === fmtId);
                return (
                  <Checkbox.Root
                    key={`${type}-${fmtId}`}
                    id={`${type}-specific-${fmtId}`} // Ensure unique ID
                    checked={selectedFormatsForElement.includes(fmtId)} 
                    onCheckedChange={(details) => { 
                      selectedFormatsSetter(prevFormats =>
                        details.checked // Use details.checked from the event
                          ? [...prevFormats, fmtId] 
                          : prevFormats.filter(x => x !== fmtId)
                      );
                    }}
                    colorPalette="orange"
                    display="block" 
                    py={0.5}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>{formatDetail?.label || fmtId}</Checkbox.Label>
                  </Checkbox.Root>
                );
              })
            ) : (
              <Text fontSize="xs">No formats selected in Step 1 to choose from.</Text>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const handleSubmit = () => {
    if (includeLogo && !logoFile && !state.logoFile) {
      toaster.create({ title: "Logo Missing", description: "Please upload a logo or uncheck 'Include Logo'.", type: "warning" }); return;
    }
    if (includeCopy && !adCopy.trim()) {
      toaster.create({ title: "Ad Copy Missing", description: "Please enter ad copy or uncheck 'Include Ad Copy'.", type: "warning" }); return;
    }
    if (includeCta && !ctaText.trim()) {
      toaster.create({ title: "CTA Text Missing", description: "Please enter CTA text or uncheck 'Include CTA'.", type: "warning" }); return;
    }

    setState(prev => ({
      ...prev,
      includeLogo, logoFile: logoFile || prev.logoFile, logoPreviewUrl: logoPreviewUrl || prev.logoPreviewUrl, logoScope,
      logoSelectedFormats: logoScope === "all" ? (prev.selectedFormats || []) : logoFormats, logoPositionByOrientation,
      includeCopy, adCopy, copyFontFamily, copyBrandColor, copyScope,
      copySelectedFormats: copyScope === "all" ? (prev.selectedFormats || []) : copyFormats, copyPositionByOrientation,
      includeCta, ctaText, ctaFont, ctaTextColor, ctaBgColor, ctaScope,
      ctaSelectedFormats: ctaScope === "all" ? (prev.selectedFormats || []) : ctaFormats, ctaPositionByOrientation,
    }));
    router.push("/preview");
  };

  const categoriesDataForLabels = [ 
    { id: "facebook", label: "Facebook & Instagram", sizes: [{ id: "fb-feed-1440x1440", label: "Feed: 1440x1440 (1:1)" }, { id: "fb-feed-1440x1800", label: "Feed (Vertical): 1440x1800 (4:5)" }, { id: "fb-story-1440x2560", label: "Story: 1440x2560 (9:16)" }, { id: "fb-feed-1200x628", label: "Feed: 1200×628 (1.91:1)" }, ] },
    { id: "twitter", label: "X (Twitter)", sizes: [{ id: "tw-multi-1200x1200", label: "Single/Multi: 1200×1200 (1:1)" }, { id: "tw-multi-1200x628", label: "Single/Multi: 1200×628 (1.91:1)" }, ] },
    { id: "linkedin", label: "LinkedIn", sizes: [{ id: "li-1200x628", label: "Single Image: 1200×628 (1.91:1)" }, { id: "li-1200x1200", label: "Single Image: 1200×1200 (1:1)" }, { id: "li-628x1200", label: "Single Image Vertical (Mobile Only): 628×1200 (1:1.91)" }, { id: "li-2560x1440", label: "Click-to-Message Image: 2560x1440 (16:9)" }, ] },
    { id: "pinterest", label: "Pinterest", sizes: [{ id: "pin-1000x1500", label: "Vertical: 1000x1500" }, { id: "pin-1200x1200", label: "Square: 1200x1200" }, ] },
    { id: "display", label: "Display", sizes: [{ id: "dd-leaderboard-728x90", label: "Leaderboard: 728×90" }, { id: "dd-medrect-300x250", label: "Medium Rect: 300×250" }, { id: "dd-largerect-336x280", label: "Large Rect: 336×280" }, { id: "dd-halfpage-300x600", label: "Half Page / Skyscraper: 300×600" }, { id: "dd-widesky-160x600", label: "Wide Skyscraper: 160×600" }, { id: "dd-billboard-970x250", label: "Billboard: 970×250" }, { id: "dd-square-1200x1200", label: "Square: 1200x1200" }, { id: "dd-skinnybanner-1200x300", label: "Skinny Banner: 1200x300" },  { id: "dd-vertical-960x1200", label: "Vertical: 960x1200" }, { id: "dm-mobilebanner-320x50", label: "Mobile Banner: 320×50" }, { id: "dm-largebanner-320x100", label: "Large Mobile Banner: 320×100" }, { id: "dm-interstitial-640x1136", label: "Interstitial: 640×1136" }, { id: "dm-interstitial-750x1334", label: "Interstitial: 750×1334" }, ] },
  ];

  if (!state.selectedFormats || state.selectedFormats.length === 0) {
    return (
      <Box maxWidth="container.xl" mx="auto" py={100} px={100} textAlign="center">
        <Alert.Root status="warning" borderRadius="md" variant="subtle">
          <Alert.Indicator /> {/* Corrected from Alert.Indicator */}
          <Box>
            <Alert.Title>No formats selected.</Alert.Title>
            <Alert.Description>
              Please go back to Step 1 and select some ad formats before customizing elements.
            </Alert.Description>
          </Box>
        </Alert.Root>
        <Button mt={6} colorPalette="orange" onClick={() => router.push('/formats')} size="lg">
          Go to Step 1: Choose Formats
        </Button>
      </Box>
    )
  }
  // --- NEW: Logic to disable the preview button ---
  // The button is disabled if the "include logo" switch is on, but no logo file is present.
  const isPreviewDisabled = includeLogo && !logoFile;

  return (
    <Box maxWidth="container.lg" mx="auto" py={100} px={100}>
      <VStack gap={6} align="stretch">
        <Heading as="h1" size="2xl" textAlign="left">
          Step 3: Customize Ad Elements
        </Heading>
        <Text textAlign="left" fontSize="lg" mb={0}>
          Fine-tune your logo, ad copy, and call-to-action button.
        </Text>

        <VStack gap={4} align="stretch"> {/* Reduced gap between sections to match screenshot */}
            {/* --- Logo Section --- */}
            <ElementCustomizationSection
                elementKey="logo"
                title="Include logo?"
                includeState={includeLogo}
                onIncludeChange={(details) => setIncludeLogo(details.checked)}
            >
                <VStack gap={5} align="stretch">
                    <Field.Root id="logoUploadField">
                    <FileUpload.Root 
                        maxFiles={1} 
                        accept={{ "image/*": [".png", ".jpg", ".jpeg", ".svg"] }}
                        onFileChange={handleLogoFileUpload} 
                    >
                        <FileUpload.HiddenInput />
                            <FileUpload.Trigger asChild>
                                <Button variant="outline" size="sm">
                                    <HiUpload /> 
                                Upload logo file
                                </Button>
                            </FileUpload.Trigger>
                        <FileUpload.List />
                    </FileUpload.Root>
                    {logoPreviewUrl && (
                        <HStack mt={2} p={2} borderWidth="1px" borderRadius="md" justifyContent="space-between" alignItems="center" bg="gray.50">
                        <ChakraImage src={logoPreviewUrl} alt="Logo Preview" maxH="40px" borderRadius="sm" objectFit="contain" />
                        <Text fontSize="xs" title={logoFile?.name} flex={1} mx={2}>{logoFile?.name || "Uploaded logo"}</Text>
                        <Button size="xs" variant="ghost" colorPalette="orange" onClick={clearLogoFile}>Remove</Button>
                        </HStack>
                    )}
                    </Field.Root>
                    {renderScopeSelector("logo", logoScope, setLogoScope, logoFormats, setLogoFormats)}
                    {renderPositionSelectors("logo", logoPositionByOrientation, setLogoPositionByOrientation)}
                </VStack>
            </ElementCustomizationSection>

            {/* --- Ad Copy Section --- */}
             <ElementCustomizationSection
                elementKey="copy"
                title="Include copy?"
                includeState={includeCopy}
                onIncludeChange={(details) => setIncludeCopy(details.checked)}
            >
                <VStack gap={5} align="stretch">
                    <Field.Root id="adCopyTextField" required={includeCopy}>
                    <Field.Label fontSize="sm" fontWeight="medium" htmlFor="adCopyTextarea">Ad Copy Text</Field.Label>
                    <Input id="adCopyTextarea" value={adCopy} onChange={(e) => setAdCopy(e.target.value)} placeholder="Enter your ad copy here..."/> 
                    </Field.Root>
                    <SimpleGrid columns={{base: 1, md: 3}} gap={4} alignItems="flex-end">
                    <Field.Root id="copyFontField" flex={1}>
                        <Field.Label>Font Family</Field.Label>
                        <Select.Root id="copyFontSelect" collection={fontSelectCollection} value={copyFontFamily ? [copyFontFamily] : []} onValueChange={(d) => d.value.length && setCopyFontFamily(d.value[0])} size="sm" positioning={{sameWidth: true}}>
                        <Select.Control>
                        <Select.Trigger><Select.ValueText placeholder="Select font"/></Select.Trigger>
                        <Select.IndicatorGroup>
                            <Select.Indicator />
                        </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal><Select.Positioner><Select.Content>
                            {(fontSelectCollection.items as Item[]).map((font: Item) => (<Select.Item key={font.value} item={font}>{font.label}</Select.Item>))}
                        </Select.Content></Select.Positioner></Portal>
                        </Select.Root>
                    </Field.Root>
                    <Field.Root id="copyColorPickerField">
                    <ColorPicker.Root
                        variant= "outline"
                        maxW="200px"
                        defaultValue={parseColor(copyBrandColor)} // Make sure copyBrandColor is a valid string for parseColor
                        onValueChange={(details) => {setCopyBrandColor(details.value.toString("hex"));}}
                    >
                        <ColorPicker.HiddenInput />
                        <ColorPicker.Label>Text Color</ColorPicker.Label>
                        <ColorPicker.Control>
                            <ColorPicker.Input />
                            <ColorPicker.Trigger />
                        </ColorPicker.Control>
                        <Portal>
                          <ColorPicker.Positioner>
                            <ColorPicker.Content>
                              <ColorPicker.Area />
                              <HStack>
                                <ColorPicker.EyeDropper size="xs" variant="outline" />
                                <ColorPicker.Sliders />
                              </HStack>
                            </ColorPicker.Content>
                          </ColorPicker.Positioner>
                        </Portal>
                    </ColorPicker.Root>
                    </Field.Root>
                    </SimpleGrid>
                    {renderScopeSelector("copy", copyScope, setCopyScope, copyFormats, setCopyFormats)}
                    {renderPositionSelectors("copy", copyPositionByOrientation, setCopyPositionByOrientation)}
                </VStack>
            </ElementCustomizationSection>

            {/* --- CTA Section --- */}
            <ElementCustomizationSection
                elementKey="cta"
                title="Include CTA?"
                includeState={includeCta}
                onIncludeChange={(details) => setIncludeCta(details.checked)}
            >
                <VStack gap={5} align="stretch">
                    <Field.Root id="ctaTextField" required={includeCta}>
                    <Field.Label>CTA Text</Field.Label>
                    <Input id="ctaTextInput" variant="outline" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="e.g., SHOP"/>
                    </Field.Root>
                    <SimpleGrid columns={{base: 1, md: 3}} gap={4} alignItems="flex-end">
                    <Field.Root id="ctaFontField">
                        <Field.Label>Font Family</Field.Label>
                        <Select.Root id="ctaFontSelect" collection={fontSelectCollection} value={ctaFont ? [ctaFont] : []} onValueChange={(d) => d.value.length && setCtaFont(d.value[0])} >
                        <Select.Control>
                        <Select.Trigger><Select.ValueText placeholder="Select font"/></Select.Trigger>
                        <Select.IndicatorGroup>
                            <Select.Indicator />
                        </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal><Select.Positioner><Select.Content>
                            {(fontSelectCollection.items as Item[]).map((font: Item) => (<Select.Item key={font.value} item={font}>{font.label}</Select.Item>))}
                        </Select.Content></Select.Positioner></Portal>
                        </Select.Root>
                    </Field.Root>
                    <Field.Root id="ctaTextColorPickerField">
                        <ColorPicker.Root 
                            variant="outline"
                            maxW="200px"
                            defaultValue={parseColor(ctaTextColor)} 
                            onValueChange={(details) => setCtaTextColor(details.value.toString("hex"))} 
                        >
                          <ColorPicker.HiddenInput />
                          <ColorPicker.Label>CTA Text Color</ColorPicker.Label>
                          <ColorPicker.Control>
                              <ColorPicker.Input />
                              <ColorPicker.Trigger />
                          </ColorPicker.Control>
                          <Portal>
                            <ColorPicker.Positioner>
                              <ColorPicker.Content>
                                <ColorPicker.Area />
                                <HStack>
                                  <ColorPicker.EyeDropper size="xs" variant="outline" />
                                  <ColorPicker.Sliders />
                                </HStack>
                              </ColorPicker.Content>
                            </ColorPicker.Positioner>
                          </Portal>
                        </ColorPicker.Root>
                    </Field.Root>
                    
                    <Field.Root id="ctaBgColorPickerField">
                        <ColorPicker.Root 
                            variant="outline"
                            maxW="200px"
                            defaultValue={parseColor(ctaBgColor)} 
                            onValueChange={(details) => setCtaBgColor(details.value.toString("hex"))} 
                        >
                            <ColorPicker.HiddenInput />
                            <ColorPicker.Label>Button Background Color</ColorPicker.Label>
                            <ColorPicker.Control>
                                <ColorPicker.Input />
                                <ColorPicker.Trigger />
                            </ColorPicker.Control>
                            <Portal>
                              <ColorPicker.Positioner>
                                <ColorPicker.Content>
                                  <ColorPicker.Area />
                                  <HStack>
                                    <ColorPicker.EyeDropper size="xs" variant="outline" />
                                    <ColorPicker.Sliders />
                                  </HStack>
                                </ColorPicker.Content>
                              </ColorPicker.Positioner>
                            </Portal>
                        </ColorPicker.Root>
                    </Field.Root>
                    </SimpleGrid>
                    {renderScopeSelector("cta", ctaScope, setCtaScope, ctaFormats, setCtaFormats)}
                    {renderPositionSelectors("cta", ctaPositionByOrientation, setCtaPositionByOrientation)}
                </VStack>
            </ElementCustomizationSection>
        </VStack>

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
          <HStack gap={4} justify="center" mt={6} w="full" maxW="container.lg" mx="auto">
            <Button onClick={() => router.push("/upload")} variant="outline" size="lg" colorPalette="orange">
              <RiArrowLeftLine />Back to Upload
            </Button>
            <Button colorPalette="orange" onClick={handleSubmit} variant="solid" size="lg" disabled={isPreviewDisabled}>
              Next: Preview Ads <RiArrowRightLine />
            </Button>
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
}
