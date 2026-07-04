import { DM_Sans, Roboto_Slab } from "next/font/google";

import { cn } from "@/lib/utils";

export const invoiceDisplayFont = Roboto_Slab({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-invoice-display",
});

export const invoiceSansFont = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-invoice-sans",
});

export const invoiceWizardTypographyRoot = cn(
  invoiceDisplayFont.variable,
  invoiceSansFont.variable,
);

export const invoicePageEyebrowClassName =
  "font-[family-name:var(--font-invoice-display)] text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground md:text-sm";

export const invoicePageTitleClassName =
  "mt-1 font-[family-name:var(--font-invoice-display)] text-3xl font-extrabold uppercase tracking-tight text-foreground md:text-[2.5rem] md:leading-none";

export const invoicePageDescriptionClassName =
  "mt-3 max-w-3xl font-[family-name:var(--font-invoice-sans)] text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem] md:leading-7";

export const invoiceStepEyebrowClassName =
  "font-[family-name:var(--font-invoice-display)] text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs";

export const invoiceStepTitleClassName =
  "font-[family-name:var(--font-invoice-display)] text-xl font-extrabold uppercase tracking-wide text-foreground sm:text-2xl";
