/** Focus the first invalid wizard control, opening comboboxes so the value can be corrected. */
export function focusInvoiceWizardField(fieldId: string) {
  const findField = () => {
    const byId = document.getElementById(fieldId);
    if (byId) return byId;

    const marked = document.querySelector<HTMLElement>(`[data-invoice-wizard-focus="${fieldId}"]`);
    if (!marked) return null;
    if (marked.matches("input, select, textarea, button, [role='combobox']")) return marked;
    return (
      marked.querySelector<HTMLElement>("input, select, textarea, button, [role='combobox']") ?? marked
    );
  };

  const focusField = () => {
    const element = findField();
    if (!element) return false;

    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
    element.focus();

    const isCombobox = element.getAttribute("role") === "combobox";
    if (isCombobox && element.getAttribute("aria-expanded") !== "true") {
      element.click();
    }
    if (fieldId === "invoice-wizard-discount" && element.tagName === "BUTTON") {
      element.click();
    }

    return true;
  };

  window.requestAnimationFrame(() => {
    if (focusField()) return;
    window.setTimeout(focusField, 50);
  });
}
