/**
 * Veridex Demo App - Root Layout
 * 
 * This is the root layout component for the Next.js application.
 * It sets up:
 * - HTML structure
 * - Font loading (Geist Sans and Geist Mono)
 * - Global metadata
 * - Body wrapper for all pages
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ============================================================================
// Font Configuration
// ============================================================================

/**
 * Geist Sans - Modern sans-serif font
 * Used for body text and UI elements
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Geist Mono - Monospace font
 * Used for code, addresses, and technical content
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ============================================================================
// Metadata Configuration
// ============================================================================

/**
 * Page metadata for SEO and browser display
 * 
 * This appears in:
 * - Browser tab title
 * - Search engine results
 * - Social media previews
 */
export const metadata: Metadata = {
  title: "Veridex Demo - Passkey-Based Web3 Wallet",
  description: "Create a secure Web3 wallet using Touch ID, Face ID, or security keys. No seed phrases, no private keys to manage.",
};

// ============================================================================
// Root Layout Component
// ============================================================================

/**
 * Root layout wrapper for all pages
 * 
 * @param children - Page content to render
 * @returns HTML structure with fonts and global styles
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* 
        Body element with font variables
        These CSS variables are used in globals.css
      */}
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
