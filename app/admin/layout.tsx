"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Brain,
  Layers,
  Sliders,
  LogOut,
  Crown,
  Activity,
  RefreshCw,
  Filter,
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  DollarSign,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Brain;
  group: "core" | "analytics" | "churn" | "system";
}

const NAV_ITEMS: NavItem[] = [
  // Core
  { href: "/admin/retention", label: "Overview", icon: Brain, group: "core" },
  { href: "/admin/retention/users", label: "RL Users", icon: Layers, group: "core" },
  { href: "/admin/retention/segments", label: "Segments", icon: BarChart3, group: "core" },
  // Analytics
  { href: "/admin/retention/apu", label: "APU / VIP", icon: Crown, group: "analytics" },
  { href: "/admin/retention/engagement", label: "Engagement", icon: Activity, group: "analytics" },
  { href: "/admin/retention/lifecycle", label: "Lifecycle", icon: RefreshCw, group: "analytics" },
  { href: "/admin/retention/funnels", label: "Funnels", icon: Filter, group: "analytics" },
  // Churn
  { href: "/admin/retention/churn", label: "Churn Risk", icon: AlertTriangle, group: "churn" },
  { href: "/admin/retention/exit-forms", label: "Exit Forms", icon: ClipboardList, group: "churn" },
  { href: "/admin/retention/experiments", label: "Experiments", icon: FlaskConical, group: "churn" },
  { href: "/admin/retention/revenue", label: "Revenue", icon: DollarSign, group: "churn" },
  // System
  { href: "/admin/retention/coaching", label: "Coaching Link", icon: Link2, group: "system" },
  { href: "/admin/retention/config", label: "Policy Config", icon: Sliders, group: "system" },
];

const GROUP_LABELS: Record<string, string> = {
  core: "Core",
  analytics: "Analytics",
  churn: "Churn",
  system: "System",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          name: user.user_metadata?.full_name || user.email || "",
          email: user.email || "",
        });
      }
    });
  }, []);

  async function handleSignOut() {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  let lastGroup = "";

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link href="/admin/retention" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rumi_logo.png" alt="Rumi" className="h-6 w-auto" />
            <span className="text-xs text-gray-500">Retention</span>
          </Link>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, group }) => {
            const showGroupLabel = group !== lastGroup;
            lastGroup = group;

            const isActive =
              href === "/admin/retention"
                ? pathname === "/admin/retention"
                : pathname.startsWith(href);

            return (
              <div key={href}>
                {showGroupLabel && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">
                      {GROUP_LABELS[group]}
                    </span>
                  </div>
                )}
                <Link
                  href={href}
                  className={`flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-gray-800 text-yellow-400 border-r-2 border-yellow-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800 space-y-3">
          {process.env.NEXT_PUBLIC_COACHING_APP_URL && (
            <a
              href={`${process.env.NEXT_PUBLIC_COACHING_APP_URL}/admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-yellow-400 transition-colors"
            >
              <Link2 className="h-3 w-3" />
              Coaching Admin
            </a>
          )}
          {user && (
            <div className="text-xs">
              <p className="text-white truncate">{user.name}</p>
              <p className="text-gray-500 truncate">{user.email}</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="w-full border-gray-700 text-gray-400 hover:text-yellow-400 hover:border-yellow-400"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
