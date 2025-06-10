//frontend/app/page.tsx

"use client"
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  SimpleGrid,
  HStack,
  Image,
  Stack,
  Flex,
} from "@chakra-ui/react";
import { AbsoluteCenter, Center, Circle, Square } from "@chakra-ui/react"
import { defineAnimationStyles } from "@chakra-ui/react"

import { useColorModeValue, useColorMode } from "../components/ui/color-mode";
const bounceFadeIn = defineAnimationStyles({
  bounceFadeIn: {
    value: {
      animationName: "bounce, fade-in",
      animationDuration: "1s",
      animationTimingFunction: "ease-in-out",
    },
  },
})
export default function HomePage() {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Box mx="auto">
      <Flex
        as="nav"
        align="center"
        justify="space-between"
        py={4}
        px={20}
        position={isSticky ? "sticky" : "relative"}
        top={0}
        zIndex={1000}
        bg={isSticky ? "white" : "transparent"}
        boxShadow={isSticky ? "sm" : "none"}
        transition="all 0.3s ease"
        w="100%"
      >
        {/* Left: Logo */}
        <Box maxH="50px">
          <Link href="/">
          <Image
            src="/logo.png"
            alt="Logo"
            width={100}
            height={28}
            style={{ height: "30px", width: "auto" }}
          />
          </Link>
        </Box>

        {/* Center: Menu */}
        <HStack
          gap={8}
          as="nav"
          justify="center"
          flex={1}
          display={{ base: "none", md: "flex" }}
        >
          <Link href="#features"><Text fontWeight="semibold">Features</Text></Link>
          <Link href="#how-it-works"><Text fontWeight="semibold">How it works</Text></Link>
          <Link href="#signup"><Text fontWeight="semibold">Join Beta</Text></Link>
        </HStack>

        {/* Right: CTA Button */}
        <Box>
          <Link href="/formats">
            <Button colorPalette="orange" size="sm" fontWeight={"bold"}>
              Try It For Free
            </Button>
          </Link>
        </Box>
      </Flex>

      {/* Hero Section */}
      <VStack gap={6} textAlign="center" py={20}>
        <Heading as="h1" size="6xl" paddingTop="50px" animationStyle={{ _open: "slide-fade-in", _closed: "slide-fade-out"}}>  {/* Animation needs to be updated */}
          Turn Any Photo into Ad - in Seconds.
        </Heading>
        <Text fontSize="lg" color="gray.600">
          Create high-performing, on-brand ads for every platform with AI that understands design, performance, and your unique style.
        </Text>
        <Box w="100%" maxW="8xl" overflow="hidden" >
          <Center mx={6} marginTop={20}>
          <Image
            src="/hero-image.png"
            alt="Turn Any Photo into Ad - in Seconds"
          />
          </Center>
        </Box>
      </VStack>

      {/* Selling Points */}
      <Heading id="features" as="h2" size="3xl" mb={6} textAlign={"center"}>
      Design Smarter. Launch Faster.
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={10} mt={20} px={100} maxW="8xl" mx="auto">
        <Box>
          <Heading as="h3" size="lg" mb={2}>
            Instant Multi-Platform Resizing
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Generate ad-perfect visuals for every format in one click.
          </Text>
        </Box>
        <Box>
          <Heading as="h3" size="lg" mb={2}>
            AI That Knows What Works
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Trained on thousands of top ads to follow proven design rules.
          </Text>
        </Box>
        <Box>
          <Heading as="h3" size="lg" mb={2}>
            Brand-Perfect Every Time
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Custom-trained to match your fonts, colors, and layout preferences.
          </Text>
        </Box>
      </SimpleGrid>
      {/* How It Works Section */}
      <Box id="how-it-works" mt={24} textAlign="center" bgColor="gray.100" py={20}>
        <VStack gap={6} textAlign="center">
          <Heading as="h2" size="3xl" mb={6}>
            How It Works
          </Heading>
          <Text maxW="3xl" mx="auto" fontSize="lg" color="gray.600">
          Upload your image and logo. Our AI tool instantly crops, resizes, and positions your content for every major ad format—Facebook, Pinterest, Google, and more. It adapts to your needs and delivers export-ready creatives that follow best practices and stay on brand.          </Text>
          <Link href="/formats">
            <Button colorPalette="orange" size="lg" fontWeight={"bold"} >
              Try It For Free
            </Button>
          </Link>
        </VStack>
      </Box>
      {/* Footer */}
      <Box as="footer" py={10} textAlign="center" fontSize="sm" color="gray.500">
        &copy; Lunarian 2025
      </Box>
    </Box>
  );
}
