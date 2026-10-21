"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function ApplicationLoader({ stage }: { stage: "session" | "access" }) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-6 py-12 text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <div aria-hidden="true" className="relative mb-8 grid size-32 place-items-center">
          <div className="absolute inset-0 rounded-full border border-primary/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/30 motion-safe:animate-spin [animation-duration:3s]" />
          <div className="grid size-24 place-items-center rounded-3xl border border-primary/15 bg-card shadow-xl shadow-primary/10">
            <Image src="/logo.svg" alt="" width={64} height={64} priority />
          </div>
        </div>
        <p className="text-xs font-semibold tracking-[0.35em] text-primary">EMSYS</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("common.startup.title")}</h1>
        <div role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span>{t(`common.startup.${stage}`)}</span>
        </div>
        <div aria-hidden="true" className="mt-7 flex gap-2">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-1.5 rounded-full bg-primary/60 motion-safe:animate-pulse" style={{ animationDelay: `${dot * 250}ms` }} />
          ))}
        </div>
        {slow && (
          <div className="mt-8 space-y-4">
            <p role="status" className="text-sm leading-relaxed text-muted-foreground">{t("common.startup.slow")}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>{t("common.startup.reload")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
