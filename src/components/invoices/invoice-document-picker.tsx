"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDocumentSize } from "@/lib/invoices/documents";
import { useTranslation } from "@/lib/i18n";

type Props = {
  files: File[];
  invalid: boolean;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
};

export function InvoiceDocumentPicker({ files, invalid, disabled, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="min-w-0 space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">{t("invoices.documents.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("invoices.documents.draftHint")}</p>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()} className="min-h-11 w-full sm:w-auto">
        <Upload className="size-4" />{t("invoices.documents.upload")}
      </Button>
      <input ref={input} type="file" multiple disabled={disabled} className="sr-only"
        aria-label={t("invoices.documents.upload")}
        onChange={(event) => { onAdd(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <p className="text-xs text-muted-foreground">{t("invoices.documents.formats")}</p>
      {invalid ? <p role="alert" className="text-sm text-destructive">{t("invoices.documents.invalidSize")}</p> : null}
      <ul className="space-y-2">
        {files.map((file, index) => (
          <li key={`${index}-${file.name}`} className="flex min-w-0 items-center gap-2 rounded border p-2">
            <div className="min-w-0 flex-1"><p className="break-all text-sm">{file.name}</p><p className="text-xs text-muted-foreground">{formatDocumentSize(file.size)}</p></div>
            <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled}
              aria-label={t("invoices.documents.removeQueued", { name: file.name })} onClick={() => onRemove(index)}><X className="size-4" /></Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
