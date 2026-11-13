"use client";

import { useEffect, useState, type RefObject } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Section = { id: string; label: string };

/**
 * One bar for every transaction screen: the type step, then the selected type and its sections.
 * Uses the rendered sections so conditional fields and translations stay in sync.
 */
export function TransactionSectionNavigation({ formRef, title, onBack, backDisabled = false }: {
  formRef?: RefObject<HTMLFormElement | null>;
  title: string;
  /** Returns to the transaction type step. */
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    const form = formRef?.current;
    if (!form) return;
    const formElement = form;
    function updateSections() {
      const next = Array.from(formElement.querySelectorAll<HTMLElement>("[data-form-section]"))
        .filter((section) => !section.closest(".hidden, [hidden]"))
        .map((section) => ({ id: section.id, label: section.querySelector("h3")?.textContent?.trim() ?? "" }));
      setSections((previous) => previous.length === next.length && previous.every((section, index) =>
        section.id === next[index].id && section.label === next[index].label,
      ) ? previous : next);
    }
    updateSections();
    const observer = new MutationObserver(updateSections);
    observer.observe(form, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden"] });
    return () => observer.disconnect();
  }, [formRef]);

  function scrollToSection(id?: string) {
    const form = formRef?.current;
    const section = id ? document.getElementById(id) : form?.querySelector<HTMLElement>("[data-form-section]");
    if (!form || !section || !form.contains(section)) return;
    const body = section.closest<HTMLElement>("[data-form-body]");
    if (!body) return;
    body.scrollTo({ top: id ? body.scrollTop + section.getBoundingClientRect().top - body.getBoundingClientRect().top - 16 : 0 });
    section.focus({ preventScroll: true });
  }

  const crumbClassName = "min-h-9 rounded-md px-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

  return (
    <nav aria-label={title} className="shrink-0 overflow-x-auto border-b bg-card px-3 py-2">
      <ol className="flex w-max items-center gap-1 text-xs">
        {onBack ? (
          <li className="flex items-center gap-1">
            <button type="button" disabled={backDisabled} onClick={onBack} className={cn(crumbClassName, "flex items-center gap-1 text-muted-foreground")}>
              <ArrowLeft aria-hidden="true" className="size-3.5 shrink-0" />
              {t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}
            </button>
          </li>
        ) : null}
        {[{ id: "", label: title }, ...sections].map((section, index) => (
          <li key={section.id} className="flex items-center gap-1">
            {index > 0 || onBack ? <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /> : null}
            {formRef ? (
              <button type="button" aria-controls={section.id || undefined} onClick={() => scrollToSection(section.id)}
                className={cn(crumbClassName, index === 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {section.label}
              </button>
            ) : (
              <span aria-current="step" className="flex min-h-9 items-center px-2 font-semibold text-foreground">{section.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
