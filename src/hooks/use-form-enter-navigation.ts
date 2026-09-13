import * as React from "react";

const FIELD_SELECTOR = [
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='combobox']",
].join(",");

const automaticSelectionFocus = new WeakSet<HTMLElement>();

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
  if ((element as HTMLInputElement).disabled) return false;

  const isCombobox = element.getAttribute("role") === "combobox";
  if ((element as HTMLInputElement).readOnly && !isCombobox) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;

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
  if (!current) return false;

  const form = current.closest("form");
  if (!form) return false;

  const fields = getNavigableFormFields(form);
  const currentIndex = fields.indexOf(current);
  if (currentIndex === -1) return false;

  const nextField = fields[currentIndex + 1];
  if (!nextField) return false;

  if (options.suppressComboboxOpen) automaticSelectionFocus.add(nextField);
  try {
    nextField.focus();
  } finally {
    automaticSelectionFocus.delete(nextField);
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
  if (event.key !== "Enter") return;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.form?.requestSubmit();
}

export type FormEnterNavigationOptions = {
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

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.submit();
  }
}

/**
 * Returns a form `onKeyDown` handler that turns Enter into "advance to next
 * field" navigation (like Tab) and submits the form once the last field is
 * reached. Textareas keep their newline behavior, and open comboboxes keep
 * their own Enter-to-select behavior.
 */
export function useFormEnterNavigation(options: FormEnterNavigationOptions = {}) {
  const { submitOnLast = true, onComplete, shouldComplete } = options;

  return React.useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || event.nativeEvent.isComposing) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-enter-navigation="ignore"]')) return;

      const tagName = target.tagName;

      // Let textareas and rich-text fields insert newlines.
      if (tagName === "TEXTAREA" || target.isContentEditable) return;

      // Let buttons and links keep their native Enter behavior.
      if (tagName === "BUTTON" || tagName === "A") return;
      const inputType = (target as HTMLInputElement).type;
      if (inputType === "submit" || inputType === "button") return;

      // Let open comboboxes/menus handle Enter (e.g. confirming an option).
      if (target.getAttribute("aria-expanded") === "true") return;

      const form = event.currentTarget;
      const fields = getNavigableFormFields(form);

      const currentIndex = fields.indexOf(target);
      if (currentIndex === -1) return;

      if (shouldComplete?.()) {
        event.preventDefault();
        completeForm(form, submitOnLast, onComplete);
        return;
      }

      const nextField = fields[currentIndex + 1];

      if (nextField) {
        event.preventDefault();
        nextField.focus();
        selectFormFieldText(nextField);
        return;
      }

      if (onComplete || submitOnLast) {
        event.preventDefault();
        completeForm(form, submitOnLast, onComplete);
      }
    },
    [onComplete, shouldComplete, submitOnLast],
  );
}
