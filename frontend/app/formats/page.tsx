// frontend/app/formats/page.tsx
"use client";

import { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { AppContext } from "../../context/AppContext";
import {
  Box,
  Heading,
  Button,
  Checkbox,
  VStack,
  Text,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  Stack,
} from "@chakra-ui/react";
import { Toaster, toaster } from "../../components/ui/toaster";

type Size = { id: string; label: string };
type Category = { id: string; label: string; sizes: Size[] };

const categories: Category[] = [
  {
    id: "facebook",
    label: "Facebook & Instagram",
    sizes: [
      { id: "fb-feed-1440x1440", label: "Feed: 1440x1440 (1:1)" },
      { id: "fb-feed-1440x1800", label: "Feed (Vertical): 1440x1800 (4:5)" },
      { id: "fb-story-1440x2560", label: "Story: 1440x2560 (9:16)" },
      { id: "fb-feed-1200x628", label: "Feed (Horizontal): 1200×628 (1.91:1)" },
    ],
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    sizes: [
      { id: "tw-multi-1200x1200", label: "Single/Multi: 1200×1200 (1:1)" },
      { id: "tw-multi-1200x628", label: "Single/Multi: 1200×628 (1.91:1)" },
    ],
  },
  {
    id: "pinterest",
    label: "Pinterest",
    sizes: [
      { id: "pin-1000x1500", label: "Vertical: 1000x1500" },
      { id: "pin-1200x1200", label: "Square: 1200x1200" },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    sizes: [
      { id: "li-1200x628", label: "Single Image: 1200×628 (1.91:1)" },
      { id: "li-1200x1200", label: "Single Image: 1200×1200 (1:1)" },
      { id: "li-628x1200", label: "Single Image Vertical (Mobile Only): 628×1200 (1:1.91)" },
      { id: "li-2560x1440", label: "Click-to-Message Image: 2560x1440 (16:9)" },
    ],
  }, 
  {
    id: "display",
    label: "Display",
    sizes: [
      { id: "dd-leaderboard-728x90", label: "Leaderboard: 728×90" },
      { id: "dd-medrect-300x250", label: "Medium Rect: 300×250" },
      { id: "dd-largerect-336x280", label: "Large Rect: 336×280" },
      { id: "dd-halfpage-300x600", label: "Half Page / Skyscraper: 300×600" },
      { id: "dd-widesky-160x600", label: "Wide Skyscraper: 160×600" },
      { id: "dd-billboard-970x250", label: "Billboard: 970×250" },
      { id: "dd-square-1200x1200", label: "Square: 1200x1200" },
      { id: "dd-skinnybanner-1200x300", label: "Skinny Banner: 1200x300" }, // Corrected ID from dd-logo
      { id: "dd-vertical-960x1200", label: "Vertical: 960x1200" },
      { id: "dm-mobilebanner-320x50", label: "Mobile Banner: 320×50" },
      { id: "dm-largebanner-320x100", label: "Large Mobile Banner: 320×100" },
      { id: "dm-interstitial-640x1136", label: "Interstitial: 640×1136" },
      { id: "dm-interstitial-750x1334", label: "Interstitial: 750×1334" },
    ],
  },
];

export default function ChooseFormatsPage() {
  const router = useRouter();
  const { state, setState } = useContext(AppContext);
  const toast = Toaster();

  const [selectedSizes, setSelectedSizes] = useState<string[]>(state.selectedFormats || []);

  const allSelectedInCategory = (cat: Category) =>
    cat.sizes.every(sz => selectedSizes.includes(sz.id));

  const toggleCategory = (cat: Category) => {
    const categorySizeIds = cat.sizes.map(sz => sz.id);
    if (allSelectedInCategory(cat)) {
      setSelectedSizes(prev => prev.filter(id => !categorySizeIds.includes(id)));
    } else {
      setSelectedSizes(prev => [...new Set([...prev, ...categorySizeIds])]);
    }
  };

  const toggleSize = (id: string) => {
    setSelectedSizes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (selectedSizes.length === 0) {
      toaster.create({
        title: "No formats selected",
        description: "Please select at least one ad format to continue.",
        type: "warning",
        duration: 3000,
        closable: true,
      });
      return;
    }
    setState(prev => ({
      ...prev,
      selectedFormats: selectedSizes,
    }));
    router.push("/upload"); // Navigate to the new Step 2
  };

  function isCategorySelected(cat: Category) {
    return cat.sizes.some(sz => selectedSizes.includes(sz.id));
  }
  return (
    <Box maxWidth="container.xl" mx="auto" py={100} px={100} minH="100vh">
      <VStack gap={6} align="stretch">
      <Heading as="h1" size="2xl" textAlign="left">
        Step 1: Choose Ad Formats
      </Heading>
      <Text textAlign="left" fontSize="lg">
        Select the ad formats you want to generate.
      </Text>

      <Card.Root variant="outline">
        <CardBody>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
        {categories.map(cat => (
          <Box key={cat.id} p={5} borderWidth="1px" borderRadius="md" shadow="sm">
          <Checkbox.Root
            variant="solid"
            colorPalette="orange"
            size="lg"
            key={cat.id}
            checked={allSelectedInCategory(cat)}
            onChange={() => toggleCategory(cat)}
            mb={3}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>{cat.label}</Checkbox.Label>
          </Checkbox.Root>
          {isCategorySelected(cat) && (
            <Stack pl={6} mt={1} gap={1}>
            {cat.sizes.map(sz => (
              <Checkbox.Root
              variant="outline"
              colorPalette="orange"
              key={sz.id}
              checked={selectedSizes.includes(sz.id)}
              onChange={() => toggleSize(sz.id)}
              size="md"
              >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>{sz.label}</Checkbox.Label>
              </Checkbox.Root>
            ))}
            </Stack>
          )}
          </Box>
        ))}
        </SimpleGrid>
        </CardBody>
      </Card.Root>

      <Box
        position="fixed"
        bottom={0}
        left={0}
        width="100vw"
        bg="white"
        py={4}
        boxShadow="0 -2px 8px rgba(0,0,0,0.04)"
        zIndex={10}
        display="flex"
        borderTopWidth="1px"
        justifyContent="center"
      >
        <Button
        variant="solid"
        colorPalette="orange"
        size="lg"
        onClick={handleNext}
        px={10}
        disabled={selectedSizes.length === 0}
        >
        Next: Upload Image
        </Button>
      </Box>
      </VStack>
    </Box>
  );
}
