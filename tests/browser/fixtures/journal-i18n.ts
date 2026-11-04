export function useTranslation() {
  return {
    locale: "en",
    t: (key: string, params?: Record<string, string | number>) =>
      key === "tableFields.table.selectRow" ? `Select ${params?.row}` : key,
  };
}
