"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon } from "lucide-react";
import {
  canPreviewDocument,
  type InvoiceDocument,
} from "@/lib/invoices/documents";
import { useInvoiceDocumentLink } from "@/lib/invoices/hooks/use-invoice-documents";

export function InvoiceDocumentThumbnail({
  invoiceId,
  document,
}: {
  invoiceId: string;
  document: InvoiceDocument;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const isImage = document.mimeType.startsWith("image/");
  const supported =
    isImage &&
    canPreviewDocument(document.mimeType) &&
    !document.deleting &&
    document.size <= 2 * 1024 * 1024;
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    if (target.current) observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  const link = useInvoiceDocumentLink(
    invoiceId,
    visible && supported ? document : null,
  );
  return (
    <div
      ref={target}
      className="flex h-28 w-full items-center justify-center overflow-hidden rounded bg-muted/30"
    >
      {link.data && !failed ? (
        <Image
          src={link.data.url}
          alt=""
          width={240}
          height={160}
          unoptimized
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : isImage ? (
        <ImageIcon className="size-10 text-blue-500" />
      ) : (
        <FileText className="size-10 text-red-500" />
      )}
    </div>
  );
}
