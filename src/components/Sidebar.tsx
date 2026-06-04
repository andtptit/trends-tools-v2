"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Database, Activity, FileText, Layers, Settings, ClipboardList, Menu, X, MessageSquare, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/trends", label: "Quản lý Trends", icon: TrendingUp },
  { href: "/raw-data", label: "Dữ liệu thô", icon: FileText },
  { href: "/categories", label: "Danh mục Niche", icon: Layers },
  { href: "/telegram-groups", label: "Nhóm Telegram", icon: MessageSquare },
  { href: "/sources", label: "Nguồn dữ liệu", icon: Database },
  { href: "/ai-memory", label: "Bộ nhớ AI", icon: Brain },
  { href: "/ai-logs", label: "Nhật ký AI", icon: ClipboardList },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b p-4 shrink-0 z-20">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">AI Trends</span>
        </h1>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 w-64 bg-white border-r h-full flex flex-col shrink-0 shadow-sm z-40 transition-transform duration-300 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b hidden md:block">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">AI Trends</span>
          </h1>
        </div>
        <div className="p-4 border-b flex items-center justify-between md:hidden">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">AI Trends</span>
          </h1>
          <button onClick={() => setIsOpen(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link 
                key={item.href}
                href={item.href} 
                onClick={() => setIsOpen(false)}
                className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
              )} />
              <span className={cn(
                "font-medium",
                isActive ? "text-blue-700" : ""
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-glow" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t text-center shrink-0">
        <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">Version 2.6 Premium</p>
      </div>
    </aside>
    </>
  );
}
