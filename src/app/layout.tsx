import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { TrendingUp, Database, Activity } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Trends Dashboard",
  description: "Quản trị trends nội dung",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} flex h-screen bg-gray-50 overflow-hidden`}>
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r h-full flex flex-col shrink-0">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              AI Trends
            </h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/trends" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
              <TrendingUp className="w-5 h-5" />
              <span className="font-medium">Quản lý Trends</span>
            </Link>
            <Link href="/sources" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
              <Database className="w-5 h-5" />
              <span className="font-medium">Nguồn dữ liệu</span>
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
              <Activity className="w-5 h-5" />
              <span className="font-medium">Cài đặt</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
        
        <Toaster />
      </body>
    </html>
  );
}
