"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Package, Search, Truck, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const quickLinks = [
  { label: "Find customer", description: "Search customer records", href: "/customers", icon: Users },
  { label: "Create customer", description: "Open a new customer form", href: "/customers", icon: UserPlus },
  { label: "Track delivery", description: "Review routes and status", href: "/deliveries", icon: Truck },
  { label: "Inventory lookup", description: "Check stock and locations", href: "/inventory", icon: Package },
  { label: "Monthly reports", description: "Open operations reports", href: "/reports", icon: FileText },
];

export function SearchMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  const filteredLinks = quickLinks.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="hidden h-9 w-64 justify-start gap-2 px-3 text-muted-foreground sm:flex"
        aria-label="Open search menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search records...</span>
        <span className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="sm:hidden"
        aria-label="Open search menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Search className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          className={cn(
            "fixed left-24 right-3 top-24 z-[230] max-h-[70dvh] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl",
            "sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[28rem] sm:max-w-[calc(100vw-2rem)]"
          )}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search customers, orders, reports..."
            />
          </div>

          <div className="p-2">
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
            <div className="space-y-1">
              {filteredLinks.length > 0 ? (
                filteredLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-none">{item.label}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matching entries found.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
