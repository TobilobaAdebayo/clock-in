'use client';

import './globals.css';
import { AuthProvider } from '../lib/auth-context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-[#F7F9FB] text-[#111827]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
