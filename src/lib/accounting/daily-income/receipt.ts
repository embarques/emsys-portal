import {
  isCheckPaymentMethod,
  isZellePaymentMethod,
  type DailyIncomeJournal,
  type JournalTransactionType,
} from "@/lib/accounting/daily-income/types";

/** Transaction types that represent a payment toward an invoice and can produce a receipt. */
export function isPaymentReceiptEligible(transactionType: JournalTransactionType): boolean {
  return transactionType === "PAYMENT" || transactionType === "INITIAL-PAYMENT";
}

export type PaymentReceiptOptions = {
  companyName?: string;
  branchName?: string;
  /** Optional logo URL. When omitted, an empty placeholder slot is rendered. */
  logoUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  }
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function field(label: string, value: string): string {
  return `
    <div class="field">
      <span class="field-label">${escapeHtml(label)}</span>
      <span class="field-value">${escapeHtml(value)}</span>
    </div>`;
}

function buildReceiptHtml(journal: DailyIncomeJournal, options: PaymentReceiptOptions): string {
  const currency = journal.currency || "USD";
  const isZelle = isZellePaymentMethod(journal.paymentMethod?.name);
  const isCheck = isCheckPaymentMethod(journal.paymentMethod?.name);
  const receiptNumber = String(journal.id);
  const logo = options.logoUrl
    ? `<img class="logo" src="${escapeHtml(options.logoUrl)}" alt="Company logo" />`
    : `<div class="logo-slot"><span>LOGO</span></div>`;

  const zelleFields = isZelle
    ? field("Zelle name / Nombre Zelle", journal.zelleTransactionName || "—") +
      field("Zelle date / Fecha Zelle", formatDate(journal.zelleTransactionDate))
    : "";
  const checkFields = isCheck
    ? field("Check number / Número de cheque", journal.checkNumber || "—")
    : "";

  const heading = options.companyName || options.branchName || "Company";
  const subtitle = options.companyName && options.branchName ? options.branchName : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Receipt #${escapeHtml(receiptNumber)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
    }
    .receipt {
      width: 100%;
      margin: 0;
      border: 2px solid #0f172a;
      border-radius: 16px;
      padding: 28px 32px;
      background: #ffffff;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;
    }
    .brand { display: flex; align-items: center; gap: 16px; }
    .logo, .logo-slot { width: 84px; height: 84px; border-radius: 12px; flex: none; object-fit: contain; }
    .logo-slot {
      border: 2px dashed #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
    }
    .brand-text .company { font-size: 22px; font-weight: 800; color: #b91c1c; letter-spacing: 0.02em; }
    .brand-text .branch { font-size: 13px; color: #475569; margin-top: 2px; }
    .brand-text .doc-type { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 8px; }
    .receipt-no { text-align: right; }
    .receipt-no .label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.14em; }
    .receipt-no .value { font-size: 26px; font-weight: 800; color: #b91c1c; }
    .fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 28px;
      padding: 22px 0;
    }
    .field { display: flex; flex-direction: column; gap: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .field-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .field-value { font-size: 15px; font-weight: 600; color: #0f172a; }
    .totals {
      display: flex;
      gap: 16px;
      margin-top: 8px;
    }
    .total-card {
      flex: 1;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 16px 18px;
    }
    .total-card.balance { border-color: #b91c1c; }
    .total-card .label { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; }
    .total-card .amount { font-size: 24px; font-weight: 800; margin-top: 4px; }
    .total-card.balance .amount { color: #b91c1c; }
    @media print {
      body { padding: 0; background: #ffffff; }
      .receipt { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="brand">
        ${logo}
        <div class="brand-text">
          <div class="company">${escapeHtml(heading)}</div>
          ${subtitle ? `<div class="branch">${escapeHtml(subtitle)}</div>` : ""}
          <div class="doc-type">Payment Receipt / Recibo de Pago</div>
        </div>
      </div>
      <div class="receipt-no">
        <div class="label">Receipt # / Recibo</div>
        <div class="value">${escapeHtml(receiptNumber)}</div>
      </div>
    </div>

    <div class="fields">
      ${field("Date / Fecha", formatDate(journal.date))}
      ${field("Invoice # / Factura", journal.invoice?.number || "—")}
      ${field("Employee / Empleado", journal.employee?.name || "—")}
      ${field("Reference # / Referencia", journal.refNumber || "—")}
      ${field("Payment reference / Referencia del pago", journal.externalReferenceNumber || "—")}
      ${field("Payment method / Método de pago", journal.paymentMethod?.name || "—")}
      ${zelleFields}
      ${checkFields}
    </div>

    <div class="totals">
      <div class="total-card">
        <div class="label">Amount paid / Monto pagado</div>
        <div class="amount">${escapeHtml(formatMoney(journal.amount, currency))}</div>
      </div>
      <div class="total-card balance">
        <div class="label">New balance / Nuevo saldo</div>
        <div class="amount">${escapeHtml(formatMoney(journal.invoice?.balance ?? 0, currency))}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Renders a printable payment receipt in a hidden iframe and opens the browser print dialog. */
export function printPaymentReceipt(journal: DailyIncomeJournal, options: PaymentReceiptOptions = {}): void {
  if (typeof window === "undefined") return;

  const html = buildReceiptHtml(journal, options);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      iframe.remove();
      return;
    }
    frameWindow.addEventListener("afterprint", () => window.setTimeout(() => iframe.remove(), 1000), { once: true });
    frameWindow.focus();
    frameWindow.print();
  };

  // Using srcdoc ensures `onload` fires only once the receipt HTML is rendered,
  // avoiding the initial about:blank load that would otherwise print an empty page.
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
