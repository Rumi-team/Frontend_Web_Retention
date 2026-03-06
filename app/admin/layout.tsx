"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Users,
  Brain,
  Layers,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/admin/retention", label: "Retention", icon: Brain },
  { href: "/admin/retention/users", label: "RL Users", icon: Layers },
  { href: "/admin/retention/segments", label: "Segments", icon: BarChart3 },
  { href: "/admin/retention/config", label: "Policy Config", icon: Sliders },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link href="/admin/retention" className="flex items-center gap-2">
            <span className="text-sm font-bold text-yellow-400">Retention Dashboard</span>
          </Link>
        </div>
        <nav className="flex-1 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/admin/retention"
                ? pathname === "/admin/retention"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-gray-800 text-yellow-400 border-r-2 border-yellow-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-gray-700 text-gray-400 hover:text-yellow-400 hover:border-yellow-400"
            >
              Sign Out
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
