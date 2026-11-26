'use client';

import './globals.css';
import { AuthProvider } from '../lib/auth-context';
import { PwaRegistrar } from '../components/PwaRegistrar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#34526E" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DAIH Clock In" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <title>Dare Adeboye Innovation Hub · Clock In</title>
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen antialiased bg-[#F7F9FB] text-[#111827] selection:bg-[#DCE6EE] selection:text-[#1E3A54]"
      >
        <PwaRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
