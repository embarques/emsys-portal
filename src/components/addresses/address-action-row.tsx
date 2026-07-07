"use client";

import { Copy, MapPin, Navigation } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildCoreAddressMapsQuery,
  formatCoreAddressLines,
} from "@/lib/customers/display";
import type { CustomerCoreAddress } from "@/lib/customers/types";
import { cn } from "@/lib/utils";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";

type AddressActionRowProps = {
  label: string;
  address: CustomerCoreAddress;
  className?: string;
};

function buildMapsSearchHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildMapsDirectionsHref(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function AddressActionRow({ label, address, className }: AddressActionRowProps) {
  const { notifySuccess, notifyError } = useFeedback();
  const lines = formatCoreAddressLines(address);
  const query = buildCoreAddressMapsQuery(address);

  if (lines.length === 0) return null;

  async function handleCopy() {
    if (!query) return;

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      notifySuccess("Address copied");
    } catch {
      notifyError("Could not copy address");
    }
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border/80 px-4 py-2.5 last:border-b-0 odd:bg-muted/25",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-snug text-muted-foreground">{label}</p>
        <div className={cn("text-sm font-medium leading-snug text-foreground", ADDRESS_TEXT_WRAP_CLASSNAME)}>
          {lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label={`Copy ${label}`}
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy address</TooltipContent>
        </Tooltip>
        {query ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
                >
                  <a
                    href={buildMapsSearchHref(query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${label} in Google Maps`}
                  >
                    <MapPin className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View on Google Maps</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <a
                    href={buildMapsDirectionsHref(query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Get directions to ${label}`}
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Get directions</TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>
    </div>
  );
}
