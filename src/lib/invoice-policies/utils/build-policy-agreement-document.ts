import type { InvoicePolicy } from "@/lib/invoice-policies/types";

const CANVAS_WIDTH = 900;
const MARGIN_X = 48;
const MARGIN_Y = 48;
const TITLE_SIZE = 28;
const HEADING_SIZE = 18;
const BODY_SIZE = 14;
const LINE_HEIGHT = 22;
const SECTION_GAP = 28;
const SIGNATURE_MAX_HEIGHT = 160;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const word = words[i]!;
      const candidate = `${current} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load signature image."));
    image.src = dataUrl;
  });
}

/**
 * Builds a PNG of the active policies plus the customer signature for upload
 * as an invoice document after create.
 */
export async function buildPolicyAgreementDocument(options: {
  policies: InvoicePolicy[];
  signatureDataUrl: string;
  invoiceNumber?: string;
  signedAt?: Date;
}): Promise<File> {
  const { policies, signatureDataUrl, invoiceNumber } = options;
  const signedAt = options.signedAt ?? new Date();
  const signatureImage = await loadImage(signatureDataUrl);

  const measure = document.createElement("canvas");
  measure.width = CANVAS_WIDTH;
  const measureCtx = measure.getContext("2d");
  if (!measureCtx) throw new Error("Canvas is not available.");

  const contentWidth = CANVAS_WIDTH - MARGIN_X * 2;
  let height = MARGIN_Y;

  measureCtx.font = `700 ${TITLE_SIZE}px system-ui, sans-serif`;
  height += TITLE_SIZE + 12;
  measureCtx.font = `400 ${BODY_SIZE}px system-ui, sans-serif`;
  const metaLines = [
    invoiceNumber ? `Invoice: ${invoiceNumber}` : null,
    `Signed: ${signedAt.toLocaleString()}`,
  ].filter(Boolean) as string[];
  height += metaLines.length * LINE_HEIGHT + SECTION_GAP;

  for (const policy of policies) {
    measureCtx.font = `600 ${HEADING_SIZE}px system-ui, sans-serif`;
    height += HEADING_SIZE + 10;
    measureCtx.font = `400 ${BODY_SIZE}px system-ui, sans-serif`;
    const bodyLines = wrapText(measureCtx, policy.body, contentWidth);
    height += bodyLines.length * LINE_HEIGHT + SECTION_GAP;
  }

  height += HEADING_SIZE + 12;
  const signatureScale = Math.min(
    1,
    contentWidth / Math.max(signatureImage.width, 1),
    SIGNATURE_MAX_HEIGHT / Math.max(signatureImage.height, 1),
  );
  const signatureWidth = signatureImage.width * signatureScale;
  const signatureHeight = signatureImage.height * signatureScale;
  height += signatureHeight + MARGIN_Y;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.textBaseline = "top";

  let y = MARGIN_Y;
  ctx.font = `700 ${TITLE_SIZE}px system-ui, sans-serif`;
  ctx.fillText("Invoice policy agreement", MARGIN_X, y);
  y += TITLE_SIZE + 12;

  ctx.font = `400 ${BODY_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = "#4b5563";
  for (const line of metaLines) {
    ctx.fillText(line, MARGIN_X, y);
    y += LINE_HEIGHT;
  }
  y += SECTION_GAP;
  ctx.fillStyle = "#111827";

  for (const policy of policies) {
    ctx.font = `600 ${HEADING_SIZE}px system-ui, sans-serif`;
    ctx.fillText(policy.title, MARGIN_X, y);
    y += HEADING_SIZE + 10;
    ctx.font = `400 ${BODY_SIZE}px system-ui, sans-serif`;
    for (const line of wrapText(ctx, policy.body, contentWidth)) {
      ctx.fillText(line, MARGIN_X, y);
      y += LINE_HEIGHT;
    }
    y += SECTION_GAP;
  }

  ctx.font = `600 ${HEADING_SIZE}px system-ui, sans-serif`;
  ctx.fillText("Signature", MARGIN_X, y);
  y += HEADING_SIZE + 12;
  ctx.drawImage(signatureImage, MARGIN_X, y, signatureWidth, signatureHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Unable to encode policy agreement image."));
    }, "image/png");
  });

  const stamp = signedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new File([blob], `invoice-policy-agreement-${stamp}.png`, {
    type: "image/png",
  });
}
