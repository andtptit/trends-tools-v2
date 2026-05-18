import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Trends Dashboard",
  description: "Quản trị trends nội dung",
};

import { Sidebar } from "@/components/Sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden`}>
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
        
        <Toaster />
      </body>
    </html>
  );
}
