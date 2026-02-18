import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veridex Agent — Advanced Example',
  description: 'Production-grade AI agent with Gemini chat, MCP tools, ERC-8004 identity, and multi-chain payments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
