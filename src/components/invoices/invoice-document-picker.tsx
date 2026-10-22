"use client";

import { useRef, useState } from "react";
import { Camera, Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOCUMENT_ACCEPT, formatDocumentSize } from "@/lib/invoices/documents";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  description?: string;
  allowVideoCapture?: boolean;
  files: File[];
  invalid: boolean;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
};

export function InvoiceDocumentPicker({
  description,
  allowVideoCapture = false,
  files,
  invalid,
  disabled,
  onAdd,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | File[] | null) {
    const next = Array.from(list ?? []);
    if (next.length) onAdd(next);
  }

  return (
    <section className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4">
      <div>
        <h2 className="font-semibold">{t("invoices.documents.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ?? t("invoices.documents.draftHint")}
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-4 text-center sm:p-6",
          dragging && "border-primary bg-primary/5",
          disabled && "opacity-60",
        )}
      >
        <Upload className="mx-auto mb-2 size-8 text-muted-foreground" />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
            className="min-h-11 w-full sm:w-auto"
          >
            <Upload className="size-4" />
            {t("invoices.documents.upload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => cameraInput.current?.click()}
            className="min-h-11 w-full sm:w-auto"
          >
            <Camera className="size-4" />
            {t(allowVideoCapture ? "invoices.documents.capturePhoto" : "invoices.documents.takePhoto")}
          </Button>
          {allowVideoCapture && <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => videoInput.current?.click()}
            className="min-h-11 w-full sm:w-auto"
          >
            <Video className="size-4" />
            {t("invoices.documents.takeVideo")}
          </Button>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("invoices.documents.formats")}
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        disabled={disabled}
        className="sr-only"
        aria-label={t("invoices.documents.upload")}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept={allowVideoCapture ? "image/*" : "image/*,video/*"}
        capture="environment"
        disabled={disabled}
        className="sr-only"
        aria-label={t(allowVideoCapture ? "invoices.documents.capturePhoto" : "invoices.documents.takePhoto")}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {allowVideoCapture && <input
        ref={videoInput}
        type="file"
        accept="video/*"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        aria-label={t("invoices.documents.takeVideo")}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />}

      {invalid ? (
        <p role="alert" className="text-sm text-destructive">
          {t("invoices.documents.invalidSize")}
        </p>
      ) : null}

      {files.length ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${index}-${file.name}-${file.size}`}
              className="flex min-w-0 items-center gap-2 rounded border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDocumentSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                disabled={disabled}
                aria-label={t("invoices.documents.removeQueued", {
                  name: file.name,
                })}
                onClick={() => onRemove(index)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
