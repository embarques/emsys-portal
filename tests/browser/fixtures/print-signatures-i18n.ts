import invoices from "@/locales/en/invoices.json";
export function useTranslation() { return {locale:"en", t:(key:string, values:Record<string,string|number>={}) => {
 if (!window.visual) return key;
 const text=key.split(".").slice(1).reduce<unknown>((value,part)=>value && typeof value==="object" ? (value as Record<string,unknown>)[part] : undefined,invoices);
 return typeof text==="string" ? text.replace(/\{(\w+)\}/g,(_,name:string)=>String(values[name]??"")) : key;
} }; }
