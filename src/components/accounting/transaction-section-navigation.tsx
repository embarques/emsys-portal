"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronRight } from "lucide-react";

type Section = { id: string; label: string };

/** Uses the rendered sections so conditional fields and translations stay in sync. */
export function TransactionSectionNavigation({ formRef, title }: {
  formRef: RefObject<HTMLFormElement | null>;
  title: string;
}) {
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    const form = formRef.current;
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
    const form = formRef.current;
    const section = id ? document.getElementById(id) : form?.querySelector<HTMLElement>("[data-form-section]");
    if (!form || !section || !form.contains(section)) return;
    const body = section.closest<HTMLElement>("[data-form-body]");
    if (!body) return;
    body.scrollTo({ top: id ? body.scrollTop + section.getBoundingClientRect().top - body.getBoundingClientRect().top - 16 : 0 });
    section.focus({ preventScroll: true });
  }

  return (
    <nav aria-label={title} className="shrink-0 overflow-x-auto border-b bg-card px-3 py-2">
      <ol className="flex w-max items-center gap-1 text-xs">
        {[{ id: "", label: title }, ...sections].map((section, index) => (
          <li key={section.id} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /> : null}
            <button type="button" aria-controls={section.id || undefined} onClick={() => scrollToSection(section.id)}
              className={`min-h-9 rounded-md px-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${index === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {section.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
