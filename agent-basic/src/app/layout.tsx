import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Veridex Agent — Basic Example',
  description: 'Minimal example: passkey wallet + agent payments with @veridex/agentic-payments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: '#0a0a0f',
        color: '#e4e4ef',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  );
}
