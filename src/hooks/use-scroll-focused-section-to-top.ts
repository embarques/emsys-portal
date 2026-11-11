import { useEffect, type RefObject } from "react";

const TOP_OFFSET = 16;
const KEYBOARD_FOCUS_WINDOW_MS = 1000;

/** When Tab/Enter moves focus into another `[data-form-section]`, scroll that section to the top of its `[data-form-body]`. */
export function useScrollFocusedSectionToTop(formRef: RefObject<HTMLFormElement | null>, enabled = true) {
  useEffect(() => {
    const form = formRef.current;
    if (!enabled || !form) return;
    const formElement = form;
    // Selects hand focus forward after their popup closes, so the key press may precede focus.
    let keyboardNavigationAt = 0;
    let currentSection: HTMLElement | null = null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) keyboardNavigationAt = Date.now();
    }

    function onPointerDown() {
      keyboardNavigationAt = 0;
    }

    function onFocusIn(event: FocusEvent) {
      const field = event.target;
      if (!(field instanceof HTMLElement)) return;
      const section = field.closest<HTMLElement>("[data-form-section]");
      if (!section || section === currentSection) return;
      currentSection = section;
      if (Date.now() - keyboardNavigationAt > KEYBOARD_FOCUS_WINDOW_MS) return;
      const body = section.closest<HTMLElement>("[data-form-body]");
      if (!body || !formElement.contains(body)) return;
      body.scrollTo({ top: body.scrollTop + section.getBoundingClientRect().top - body.getBoundingClientRect().top - TOP_OFFSET });
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    formElement.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      formElement.removeEventListener("focusin", onFocusIn);
    };
  }, [enabled, formRef]);
}
