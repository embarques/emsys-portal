"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeliveryPhoto } from "@/lib/deliveries/hooks/use-delivery-photos";
import { useTranslation } from "@/lib/i18n";

function PhotoPreview({ photo }: { photo: DeliveryPhoto }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectURL = "";
    // Decode thumbnails at a bounded size and release their bitmap immediately.
    // Original phone photos remain untouched for the invoice storage upload.
    async function thumbnail() {
      try {
        const bitmap = await createImageBitmap(photo.file, {
          resizeWidth: 480,
        });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.75),
        );
        if (blob && !cancelled) {
          objectURL = URL.createObjectURL(blob);
          setUrl(objectURL);
        }
      } catch {
        /* HEIC and other unsupported previews retain the original upload. */
      }
    }
    void thumbnail();
    return () => {
      cancelled = true;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [photo.file]);
  return url ? (
    <img
      src={url}
      alt={photo.file.name}
      className="aspect-[4/3] w-full object-cover"
    />
  ) : (
    <div className="flex aspect-[4/3] items-center justify-center bg-muted">
      <Camera className="size-9 text-muted-foreground" />
    </div>
  );
}
export function DeliveryPhotoPicker({
  photos,
  onAdd,
  onRemove,
  disabled,
}: {
  photos: DeliveryPhoto[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const receive = (files: FileList | null) => {
    if (files) onAdd(Array.from(files));
  };
  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border-2 border-dashed bg-primary/[0.025] px-4 py-7 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) onAdd(Array.from(event.dataTransfer.files));
        }}
      >
        <Camera className="mx-auto mb-3 size-10 text-primary" aria-hidden />
        <p className="mb-4 text-sm text-muted-foreground">
          {t("deliveries.wizard.photoHint")}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            type="button"
            disabled={disabled || photos.length >= 12}
            className="min-h-11"
            onClick={() => camera.current?.click()}
          >
            <Camera className="size-4" />
            {t("deliveries.wizard.takePhoto")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || photos.length >= 12}
            className="min-h-11"
            onClick={() => gallery.current?.click()}
          >
            <ImagePlus className="size-4" />
            {t("deliveries.wizard.gallery")}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("deliveries.wizard.photoLimits")}
        </p>
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        aria-label={t("deliveries.wizard.takePhoto")}
        onChange={(event) => {
          receive(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={disabled}
        aria-label={t("deliveries.wizard.gallery")}
        onChange={(event) => {
          receive(event.target.files);
          event.target.value = "";
        }}
      />
      <ul
        className="grid grid-cols-2 gap-3"
        aria-label={t("deliveries.wizard.photos")}
      >
        {photos.map((photo) => (
          <li
            key={photo.id}
            className="relative min-w-0 overflow-hidden rounded-xl border"
          >
            <PhotoPreview photo={photo} />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={disabled}
              aria-label={t("deliveries.wizard.removePhoto", {
                name: photo.file.name,
              })}
              className="absolute right-2 top-2 size-8 rounded-full"
              onClick={() => onRemove(photo.id)}
            >
              <X className="size-4" />
            </Button>
            <div className="space-y-1 p-2 text-xs">
              <p className="truncate" title={photo.file.name}>
                {photo.file.name}
              </p>
              <p
                className={
                  photo.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {photo.status === "uploaded" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    {t("deliveries.wizard.uploaded")}
                  </span>
                ) : photo.status === "uploading" ? (
                  `${photo.percent}%`
                ) : (
                  t(
                    photo.status === "failed"
                      ? "deliveries.wizard.photoFailed"
                      : "deliveries.wizard.readyToUpload",
                  )
                )}
              </p>
              {photo.status === "uploading" ? (
                <progress
                  value={photo.percent}
                  max={100}
                  className="w-full"
                  aria-label={photo.file.name}
                />
              ) : null}
              {photo.error ? (
                <p role="alert" className="break-words text-destructive">
                  {photo.error}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {photos.length > 0 ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Upload className="size-4 shrink-0" />
          {t("deliveries.wizard.savedWithInvoice")}
        </p>
      ) : null}
    </div>
  );
}
