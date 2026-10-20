"use client";

import { useEffect } from "react";
import { getNavigableFormFields, handleFormEnterNavigation, isDesktopFormNavigation } from "@/hooks/use-form-enter-navigation";

/** Covers forms in pages and portals after their own keyboard handlers have run. */
export function FormKeyboardNavigation() {
  useEffect(() => {
    const activatedForms = new Set<HTMLFormElement>();
    let activationFrame: number | null = null;

    function isDisplayed(element: HTMLElement) {
      return element.getClientRects().length > 0 &&
        !element.closest('[hidden], [inert], [role="dialog"][data-state="closed"], [role="alertdialog"][data-state="closed"]') &&
        window.getComputedStyle(element).visibility !== "hidden";
    }

    function focusNewlyVisibleForm() {
      activationFrame = null;
      const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form"));
      for (const form of activatedForms) {
        if (!form.isConnected || !isDisplayed(form)) activatedForms.delete(form);
      }
      if (!isDesktopFormNavigation()) return;

      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
        .filter(isDisplayed);
      const topDialog = dialogs.at(-1);
      const candidates = forms.filter((form) => !activatedForms.has(form) && isDisplayed(form) &&
        form.dataset.formAutofocus !== "off" && (!topDialog || topDialog.contains(form)));
      const ready = candidates.map((form) => ({ form, fields: getNavigableFormFields(form) }))
        .filter(({ fields }) => fields.length > 0);
      for (const { form } of ready) activatedForms.add(form);
      if (ready.some(({ form }) => form.contains(document.activeElement))) return;
      // A dialog or sheet opened above another form takes priority.
      for (const field of ready.at(-1)?.fields ?? []) {
        field.focus();
        if (document.activeElement === field) return;
      }
    }

    function scheduleActivationFocus() {
      if (activationFrame === null) activationFrame = window.requestAnimationFrame(focusNewlyVisibleForm);
    }

    // Observe lifecycle changes, not input values, so typing never restarts focus.
    const activationObserver = new MutationObserver(scheduleActivationFocus);
    activationObserver.observe(document.body, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["hidden", "inert", "class", "style", "disabled", "readonly", "aria-hidden", "data-state"],
    });
    scheduleActivationFocus();

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const form = target.closest("form");
      if (form) handleFormEnterNavigation(event, form);
    }

    let cancelValidationFocus = () => {};
    let invalidFocusFrame: number | null = null;
    function onInvalid(event: Event) {
      const target = event.target;
      if (!isDesktopFormNavigation() || !(target instanceof HTMLElement)) return;
      if (!target.matches('[aria-hidden="true"]') || !target.parentElement) return;
      // Custom selects validate through a hidden input; focus their visible control.
      const field = getNavigableFormFields(target.parentElement)[0];
      if (!field) return;
      event.preventDefault();
      if (invalidFocusFrame !== null) return;
      invalidFocusFrame = window.requestAnimationFrame(() => {
        invalidFocusFrame = null;
        if (field.isConnected) field.focus();
      });
    }
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
    document.addEventListener("invalid", onInvalid, true);
    return () => {
      activationObserver.disconnect();
      if (activationFrame !== null) window.cancelAnimationFrame(activationFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("invalid", onInvalid, true);
      if (invalidFocusFrame !== null) window.cancelAnimationFrame(invalidFocusFrame);
      cancelValidationFocus();
    };
  }, []);
  return null;
}
