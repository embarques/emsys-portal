import * as React from "react";

const FIELD_SELECTOR = [
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='combobox']",
].join(",");

const automaticSelectionFocus = new WeakSet<HTMLElement>();

export function isDesktopFormNavigation() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
}

/** A select is handing focus forward while its own popup is closing. */
export function isAutomaticSelectionFocus(element: HTMLElement | null): boolean {
  return element !== null && automaticSelectionFocus.has(element);
}

function isVisible(element: HTMLElement) {
  return Boolean(
    element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length,
  );
}

function isNavigableField(element: HTMLElement) {
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false;

  const isCombobox = element.getAttribute("role") === "combobox";
  if ((element as HTMLInputElement).readOnly && !isCombobox) return false;
  if (element.closest('[aria-hidden="true"], [inert], [data-enter-navigation="ignore"]')) return false;
  if (window.getComputedStyle(element).visibility === "hidden") return false;

  const tabIndex = element.getAttribute("tabindex");
  if (tabIndex !== null && Number(tabIndex) < 0) return false;

  return isVisible(element);
}

export function getNavigableFormFields(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(isNavigableField);
}

/** Focus the next navigable field in the same form. Returns true when focus moved. */
export function focusNextFormField(
  current: HTMLElement | null,
  options: { suppressComboboxOpen?: boolean } = {},
): boolean {
  if (!current || !isDesktopFormNavigation()) return false;

  const form = current.closest("form");
  if (!form) return false;

  const fields = getNavigableFormFields(form);
  const currentIndex = fields.indexOf(current);
  if (currentIndex === -1) return false;

  const nextField = fields.slice(currentIndex + 1).find((field) => {
    if (options.suppressComboboxOpen) automaticSelectionFocus.add(field);
    try {
      field.focus();
      return document.activeElement === field;
    } finally {
      automaticSelectionFocus.delete(field);
    }
  });
  if (!nextField) {
    const nextButton = Array.from(form.elements).find((element) =>
      element instanceof HTMLButtonElement && element.type === "submit" && isNavigableField(element),
    ) as HTMLButtonElement | undefined ?? form.closest('[data-testid="invoice-form-wizard"]')
      ?.querySelector<HTMLButtonElement>('[data-wizard-primary]');
    if (!nextButton || nextButton.disabled) return false;
    nextButton.focus();
    return true;
  }

  selectFormFieldText(nextField);
  return true;
}

function isSelectableFormField(
  element: HTMLElement,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    return false;
  }

  const inputType = element instanceof HTMLInputElement ? element.type : "";
  return !["checkbox", "radio", "button", "submit", "file", "hidden"].includes(inputType);
}

/** Select the current value so Enter/focus can replace it immediately. */
export function selectFormFieldText(element: HTMLElement | null) {
  if (!element || !isSelectableFormField(element)) return;
  if (!element.value) return;

  window.requestAnimationFrame(() => element.select());
}

export function selectFormFieldTextOnFocus(
  event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  selectFormFieldText(event.currentTarget);
}

/** Submit the parent form when Enter is pressed on a field (e.g. amount / reference). */
export function submitFormOnEnterKeyDown(
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  // Desktop forms advance through every field before submitting.
  if (isDesktopFormNavigation()) return;
  if (event.key !== "Enter") return;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.form?.requestSubmit();
}

export type FormEnterNavigationOptions = {
  advanceTextareas?: boolean;
  /**
   * Submit the form when Enter is pressed on the last field. When the form has
   * native `required` constraints, the browser focuses the first invalid field
   * instead of submitting. Defaults to `true`.
   */
  submitOnLast?: boolean;
  /**
   * Called instead of native form submit when Enter completes the form
   * (last field, or `shouldComplete`).
   */
  onComplete?: () => void;
  /**
   * When this returns true, Enter completes immediately instead of moving to
   * the next field.
   */
  shouldComplete?: () => boolean;
};

function completeForm(
  form: HTMLFormElement,
  submitOnLast: boolean,
  onComplete?: () => void,
) {
  if (onComplete) {
    onComplete();
    return;
  }

  if (!submitOnLast) return;

  const submitters = Array.from(form.elements).filter((element) =>
    (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.type === "submit",
  ) as (HTMLButtonElement | HTMLInputElement)[];
  const submitter = submitters.find(isNavigableField);
  if (submitters.length && !submitter) return;

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit(submitter);
  } else {
    form.submit();
  }
}

/**
 * Desktop Enter advances fields and submits at the end. Shift+Enter preserves
 * multiline input; open comboboxes retain their own Enter-to-select behavior.
 */
export function handleFormEnterNavigation(
  event: KeyboardEvent | React.KeyboardEvent<HTMLFormElement>,
  form: HTMLFormElement,
  options: FormEnterNavigationOptions = {},
) {
  const { submitOnLast = true, onComplete, shouldComplete, advanceTextareas = true } = options;
  if (!isDesktopFormNavigation() || event.key !== "Enter") return;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
  const composing = "nativeEvent" in event ? event.nativeEvent.isComposing : event.isComposing;
  if (event.defaultPrevented || event.repeat || composing) return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('[data-enter-navigation="ignore"]')) return;
  if ((target.tagName === "TEXTAREA" && !advanceTextareas) || target.isContentEditable) return;
  if (target.tagName === "BUTTON" || target.tagName === "A") return;
  const inputType = (target as HTMLInputElement).type;
  if (inputType === "submit" || inputType === "button") return;
  if (target.getAttribute("aria-expanded") === "true") return;

  const fields = getNavigableFormFields(form);
  const currentIndex = fields.indexOf(target);
  if (currentIndex === -1) return;
  event.preventDefault();

  if (shouldComplete?.()) {
    completeForm(form, submitOnLast, onComplete);
    return;
  }

  for (const nextField of fields.slice(currentIndex + 1)) {
    nextField.focus();
    if (document.activeElement !== nextField) continue;
    selectFormFieldText(nextField);
    return;
  }
  completeForm(form, submitOnLast, onComplete);
}

export function useFormEnterNavigation(options: FormEnterNavigationOptions = {}) {
  const { submitOnLast, onComplete, shouldComplete, advanceTextareas } = options;
  return React.useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => handleFormEnterNavigation(event, event.currentTarget, {
      submitOnLast, onComplete, shouldComplete, advanceTextareas,
    }),
    [onComplete, shouldComplete, submitOnLast, advanceTextareas],
  );
}
