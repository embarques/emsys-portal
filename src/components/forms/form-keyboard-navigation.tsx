"use client";

import { useEffect } from "react";
import { getNavigableFormFields, handleFormEnterNavigation, isDesktopFormNavigation } from "@/hooks/use-form-enter-navigation";

/** Covers forms in pages and portals after their own keyboard handlers have run. */
export function FormKeyboardNavigation() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const form = target.closest("form");
      if (form) handleFormEnterNavigation(event, form);
    }

    let cancelValidationFocus = () => {};
    function onSubmit(event: Event) {
      const form = event.target;
      if (!isDesktopFormNavigation() || !(form instanceof HTMLFormElement)) return;
      cancelValidationFocus();
      // Schema validation can render errors after the submit event has completed.
      const focusInvalid = () => {
        if (!form.isConnected || !isDesktopFormNavigation()) return;
        const field = getNavigableFormFields(form).find((element) =>
          element.getAttribute("aria-invalid") === "true",
        );
        if (!field) return;
        field.focus();
        field.scrollIntoView({ block: "nearest" });
        cancelValidationFocus();
      };
      const observer = new MutationObserver(focusInvalid);
      observer.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-invalid"] });
      const frame = window.requestAnimationFrame(focusInvalid);
      const timeout = window.setTimeout(() => observer.disconnect(), 2000);
      cancelValidationFocus = () => {
        observer.disconnect();
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("submit", onSubmit, true);
      cancelValidationFocus();
    };
  }, []);
  return null;
}
