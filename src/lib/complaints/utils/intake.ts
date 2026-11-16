import {
  COMPLAINT_TARGET_KINDS,
  type ComplaintAttachmentFormValues,
  type ComplaintAttachmentRequest,
  type ComplaintCategory,
  type ComplaintDetailProperty,
  type ComplaintIntakeFormValues,
  type ComplaintIntakeRequest,
  type ComplaintTarget,
  type ComplaintTargetFormValues,
  type ComplaintTargetKind,
} from "@/lib/complaints/types";

export type ComplaintDetailError = { key: string; message: string };

type DetailConversion = { ok: true; value: unknown } | { ok: false; message: string };

function convertScalar(property: ComplaintDetailProperty, raw: string): DetailConversion {
  const text = raw.trim();
  if (!text) return { ok: true, value: undefined };
  if (property.type === "number" || property.type === "integer") {
    const numeric = Number(text);
    if (!Number.isFinite(numeric) || numeric < 0) return { ok: false, message: "complaints.validation.nonNegativeNumber" };
    if (property.type === "integer" && !Number.isInteger(numeric)) return { ok: false, message: "complaints.validation.wholeNumber" };
    return { ok: true, value: numeric };
  }
  if (property.enum?.length && !property.enum.includes(text)) return { ok: false, message: "complaints.validation.invalidOption" };
  if (text.length > 2000) return { ok: false, message: "complaints.validation.tooLong" };
  return { ok: true, value: text };
}

/** Converts one raw form input to the JSON type the category schema requires; `undefined` omits it. */
function convertDetail(property: ComplaintDetailProperty, raw: string | boolean | undefined): DetailConversion {
  if (property.type === "boolean") return { ok: true, value: raw === true ? true : undefined };
  const text = typeof raw === "string" ? raw : "";
  if (property.type !== "array") return convertScalar(property, text);

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { ok: true, value: undefined };
  if (parts.length > 20) return { ok: false, message: "complaints.validation.tooManyValues" };
  const items: unknown[] = [];
  for (const part of parts) {
    const converted = convertScalar(property.items ?? { type: "string" }, part);
    if (!converted.ok) return converted;
    items.push(converted.value);
  }
  return { ok: true, value: items };
}

/** Typed `details` for the selected category, or the per-field errors to show. */
export function buildComplaintDetails(
  category: ComplaintCategory,
  raw: ComplaintIntakeFormValues["details"],
): { details: Record<string, unknown>; errors: ComplaintDetailError[] } {
  const details: Record<string, unknown> = {};
  const errors: ComplaintDetailError[] = [];
  for (const [key, property] of Object.entries(category.detailsSchema.properties)) {
    const converted = convertDetail(property, raw[key]);
    if (!converted.ok) {
      errors.push({ key, message: converted.message });
    } else if (converted.value !== undefined) {
      details[key] = converted.value;
    }
  }
  for (const key of category.detailsSchema.required) {
    if (!(key in details) && !errors.some((error) => error.key === key)) {
      errors.push({ key, message: "common.validation.required" });
    }
  }
  return { details, errors };
}

/** Employee targets send numeric directory IDs; other kinds send a typed label. */
export function buildComplaintTargets(values: readonly ComplaintTargetFormValues[]): ComplaintTarget[] {
  return values.map((target) => {
    const note = target.note.trim() ? { note: target.note.trim() } : {};
    return target.kind === "employee"
      ? { kind: target.kind, employeeId: Number(target.employeeId), ...note }
      : { kind: target.kind, label: target.label.trim(), ...note };
  });
}

export function complaintTargetsToFormValues(targets: readonly ComplaintTarget[]): ComplaintTargetFormValues[] {
  return targets.map((target) => ({
    kind: (COMPLAINT_TARGET_KINDS as readonly string[]).includes(target.kind) ? (target.kind as ComplaintTargetKind) : "other",
    employeeId: target.kind === "employee" && target.employeeId ? String(target.employeeId) : "",
    label: target.kind === "employee" ? "" : target.label ?? "",
    note: target.note ?? "",
  }));
}

export function buildComplaintAttachmentRequest(values: ComplaintAttachmentFormValues): ComplaintAttachmentRequest {
  return {
    fileUrl: values.fileUrl.trim(),
    mimeType: values.mimeType.trim(),
    sizeBytes: Math.max(1, Math.round(Number(values.sizeMb) * 1024 * 1024)),
  };
}

export function buildComplaintIntakeRequest(
  values: ComplaintIntakeFormValues,
  details: Record<string, unknown>,
): ComplaintIntakeRequest {
  const targets = buildComplaintTargets(values.targets);
  return {
    callerName: values.callerName.trim(),
    callerPhone: values.callerPhone,
    ...(values.callerEmail.trim() ? { callerEmail: values.callerEmail.trim() } : {}),
    category: values.category,
    ...(values.severity ? { severity: values.severity } : {}),
    subject: values.subject.trim(),
    description: values.description.trim(),
    details,
    targets,
  };
}
