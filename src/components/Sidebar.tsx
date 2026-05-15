"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Database, Activity, FileText, Layers, Settings, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/trends", label: "Quản lý Trends", icon: TrendingUp },
  { href: "/raw-data", label: "Dữ liệu thô", icon: FileText },
  { href: "/categories", label: "Danh mục Niche", icon: Layers },
  { href: "/sources", label: "Nguồn dữ liệu", icon: Database },
  { href: "/ai-logs", label: "Nhật ký AI", icon: ClipboardList },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r h-full flex flex-col shrink-0 shadow-sm z-10">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">AI Trends</span>
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href}
              href={item.href} 
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
      <div className="p-4 border-t text-center">
        <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">Version 2.1 Premium</p>
      </div>
    </aside>
  );
}
