"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";

import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

const flatNavigation = navigation.flatMap((group) => group.items);

type DesktopSidebarProps = {
  expanded: boolean;
};

export function DesktopSidebar({ expanded }: DesktopSidebarProps) {
  const pathname = usePathname();

  if (!expanded) {
    return (
      <aside className="fixed inset-y-0 left-0 z-50 flex w-20 flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl">
        <div className="flex h-20 shrink-0 items-center justify-center border-b border-white/10">
          <Link
            href="/"
            aria-label="Dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"
          >
            <Boxes className="h-6 w-6" />
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-4">
          {flatNavigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl text-white/80 transition hover:bg-white/10 hover:text-white",
                  active && "bg-white/10 text-white"
                )}
              >
                <Icon className="h-6 w-6" />
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            href="/settings"
            title="Profile"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 transition hover:bg-white/15"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-500 text-sm font-bold text-slate-950">
              HJ
            </div>
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-20 flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl xl:w-72">
      <div className="flex h-20 shrink-0 items-center justify-center border-b border-white/10 xl:hidden">
        <Link
          href="/"
          aria-label="Dashboard"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"
        >
          <Boxes className="h-6 w-6" />
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-4 xl:hidden">
        {flatNavigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl text-white/80 transition hover:bg-white/10 hover:text-white",
                active && "bg-white/10 text-white"
              )}
            >
              <Icon className="h-6 w-6" />
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3 xl:hidden">
        <Link
          href="/settings"
          title="Profile"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 transition hover:bg-white/15"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-500 text-sm font-bold text-slate-950">
            HJ
          </div>
        </Link>
      </div>

      <div className="hidden h-20 shrink-0 items-center gap-3 border-b border-white/10 px-5 xl:flex">
        <Link
          href="/"
          aria-label="Dashboard"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"
        >
          <Boxes className="h-6 w-6" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-none text-white">{siteConfig.name}</p>
          <p className="mt-1 truncate text-xs text-white/60">{siteConfig.company}</p>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto p-3 xl:block">
        <SidebarNav />
      </div>

      <div className="hidden shrink-0 border-t border-white/10 p-3 xl:block">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl bg-white/10 p-3 transition hover:bg-white/15"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-500 text-sm font-bold text-slate-950">
            HJ
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Hector Mejia</p>
            <p className="truncate text-xs text-white/60">Administrator</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
