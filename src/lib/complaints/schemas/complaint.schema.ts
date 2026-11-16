import { z } from "zod";

import {
  COMPLAINT_TARGET_KINDS,
  type Complaint,
  type ComplaintCategory,
  type ComplaintDetailProperty,
  type ComplaintInsights,
  type ComplaintNotification,
} from "@/lib/complaints/types";

/** Go zero `time.Time` values serialize as year 1; treat them as absent. */
function optionalTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  return value.startsWith("0001-") ? "" : value;
}

const targetSchema = z.object({
  kind: z.string(),
  employeeId: z.number().optional(),
  label: z.string().optional(),
  note: z.string().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  actorId: z.number().optional().default(0),
  body: z.string().optional(),
  fromValue: z.string().optional(),
  toValue: z.string().optional(),
  createdAt: z.string(),
});

const resolutionSchema = z.object({
  summary: z.string().optional().default(""),
  actionTaken: z.string().optional().default(""),
  resolvedByUserId: z.number().optional(),
  resolvedAt: z.string().nullish(),
});

const attachmentSchema = z.object({
  id: z.string(),
  fileUrl: z.string(),
  mimeType: z.string().optional().default(""),
  sizeBytes: z.number().optional().default(0),
  uploadedBy: z.number().optional().default(0),
});

export const complaintSchema = z
  .object({
    id: z.string(),
    number: z.string().optional(),
    complaintNumber: z.string().optional(),
    version: z.number().int(),
    callerName: z.string().optional(),
    callerPhone: z.string().optional(),
    callerEmail: z.string().optional(),
    category: z.string().optional(),
    subject: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    severity: z.string().optional(),
    priority: z.string().optional(),
    status: z.string().optional(),
    pending: z.boolean().optional(),
    details: z.record(z.string(), z.unknown()).nullish(),
    loggedBy: z.number().optional(),
    assigneeId: z.number().optional(),
    targets: z.array(targetSchema).nullish(),
    events: z.array(eventSchema).nullish(),
    staffAttachments: z.array(attachmentSchema).nullish(),
    resolution: resolutionSchema.nullish(),
    reopenedCount: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    resolvedAt: z.string().nullish(),
    closedAt: z.string().nullish(),
  })
  .transform((row): Complaint => {
    const resolution = row.resolution && (row.resolution.summary || row.resolution.actionTaken)
      ? {
          summary: row.resolution.summary,
          actionTaken: row.resolution.actionTaken,
          resolvedByUserId: row.resolution.resolvedByUserId,
          resolvedAt: optionalTimestamp(row.resolution.resolvedAt),
        }
      : null;
    return {
      id: row.id,
      number: row.number || row.complaintNumber || "",
      version: row.version,
      callerName: row.callerName ?? "",
      callerPhone: row.callerPhone ?? "",
      callerEmail: row.callerEmail ?? "",
      category: row.category ?? "",
      subject: row.subject || row.title || "",
      description: row.description ?? "",
      severity: row.severity || row.priority || "",
      status: row.status ?? "",
      pending: row.pending ?? false,
      details: row.details ?? {},
      loggedBy: row.loggedBy ?? 0,
      assigneeId: row.assigneeId ?? 0,
      targets: row.targets ?? [],
      events: row.events ?? [],
      staffAttachments: row.staffAttachments ?? [],
      resolution,
      reopenedCount: row.reopenedCount ?? 0,
      createdAt: optionalTimestamp(row.createdAt),
      updatedAt: optionalTimestamp(row.updatedAt),
      resolvedAt: optionalTimestamp(row.resolvedAt),
      closedAt: optionalTimestamp(row.closedAt),
    };
  });

const detailPropertySchema: z.ZodType<ComplaintDetailProperty> = z.lazy(() =>
  z.object({
    type: z.string(),
    format: z.string().optional(),
    enum: z.array(z.string()).nullish().transform((value) => value ?? undefined),
    items: detailPropertySchema.nullish().transform((value) => value ?? undefined),
  }),
);

export const complaintCategorySchema = z
  .object({
    key: z.string(),
    label: z.string(),
    active: z.boolean().optional().default(true),
    detailsSchema: z
      .object({
        type: z.string().optional().default("object"),
        properties: z.record(z.string(), detailPropertySchema).nullish(),
        required: z.array(z.string()).nullish(),
      })
      .nullish(),
    defaultSeverity: z.string().optional().default("normal"),
    responseSlaHours: z.number().optional().default(0),
    resolutionSlaHours: z.number().optional().default(0),
  })
  .transform((row): ComplaintCategory => ({
    key: row.key,
    label: row.label,
    active: row.active,
    detailsSchema: {
      type: row.detailsSchema?.type ?? "object",
      properties: row.detailsSchema?.properties ?? {},
      required: row.detailsSchema?.required ?? [],
    },
    defaultSeverity: row.defaultSeverity,
    responseSlaHours: row.responseSlaHours,
    resolutionSlaHours: row.resolutionSlaHours,
  }));

const insightCountSchema = z
  .object({ key: z.union([z.string(), z.number()]).nullish(), count: z.number() })
  .transform((row) => ({ key: row.key == null ? "" : String(row.key), count: row.count }));

export const complaintInsightsSchema = z
  .object({
    categories: z.array(insightCountSchema).nullish(),
    employees: z.array(insightCountSchema).nullish(),
    summary: z
      .array(z.object({ total: z.number(), reopened: z.number(), averageResolutionHours: z.number().nullish() }))
      .nullish(),
  })
  .transform((row): ComplaintInsights => {
    const summary = row.summary?.[0];
    return {
      categories: row.categories ?? [],
      employees: row.employees ?? [],
      total: summary?.total ?? 0,
      reopened: summary?.reopened ?? 0,
      averageResolutionHours: summary?.averageResolutionHours ?? null,
    };
  });

export const complaintNotificationSchema = z
  .object({
    id: z.string(),
    number: z.string().optional(),
    subject: z.string().optional(),
    severity: z.string().optional(),
    notifiedAt: z.string().nullish(),
  })
  .transform((row): ComplaintNotification => ({
    id: row.id,
    number: row.number ?? "",
    subject: row.subject ?? "",
    severity: row.severity ?? "",
    notifiedAt: optionalTimestamp(row.notifiedAt),
  }));

const required = "common.validation.required";

const targetFormSchema = z
  .object({
    kind: z.enum(COMPLAINT_TARGET_KINDS),
    employeeId: z.string(),
    label: z.string().max(200, "complaints.validation.targetLabelTooLong"),
    note: z.string().max(1000, "complaints.validation.targetNoteTooLong"),
  })
  .superRefine((target, ctx) => {
    if (target.kind === "employee" && !target.employeeId) {
      ctx.addIssue({ code: "custom", path: ["employeeId"], message: required });
    }
    if (target.kind !== "employee" && !target.label.trim()) {
      ctx.addIssue({ code: "custom", path: ["label"], message: required });
    }
  });

export const complaintIntakeFormSchema = z.object({
  callerName: z.string().trim().min(1, required).max(200, "complaints.validation.tooLong"),
  callerPhone: z.string().refine((value) => value.replace(/\D/g, "").length >= 7, "complaints.validation.phone"),
  callerEmail: z.union([z.literal(""), z.string().trim().email("complaints.validation.email").max(254)]),
  category: z.string().min(1, required),
  severity: z.string(),
  subject: z.string().trim().min(1, required).max(120, "complaints.validation.subjectTooLong"),
  description: z.string().trim().min(1, required).max(5000, "complaints.validation.tooLong"),
  details: z.record(z.string(), z.union([z.string(), z.boolean()])),
  targets: z.array(targetFormSchema).min(1, "complaints.validation.targetRequired").max(30),
});

export const complaintTargetsFormSchema = z.object({
  targets: z.array(targetFormSchema).min(1, "complaints.validation.targetRequired").max(30),
});

/** The API stores at most 25 MiB of staff attachment metadata per file. */
export const COMPLAINT_ATTACHMENT_MAX_MB = 25;

export const complaintAttachmentFormSchema = z.object({
  fileUrl: z
    .string()
    .trim()
    .min(1, required)
    .max(2048, "complaints.validation.tooLong")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "complaints.validation.httpsUrl"),
  mimeType: z.string().trim().min(1, required).max(100, "complaints.validation.tooLong"),
  sizeMb: z.string().refine((value) => {
    const size = Number(value);
    return Number.isFinite(size) && size > 0 && size <= COMPLAINT_ATTACHMENT_MAX_MB;
  }, "complaints.validation.attachmentSize"),
});

export const complaintResolveFormSchema = z.object({
  summary: z.string().trim().min(1, required).max(5000, "complaints.validation.tooLong"),
  actionTaken: z.string().trim().min(1, required).max(5000, "complaints.validation.tooLong"),
});

export const complaintNoteFormSchema = z.object({
  body: z.string().trim().min(1, required).max(5000, "complaints.validation.tooLong"),
});

export const complaintReopenFormSchema = z.object({
  reason: z.string().trim().min(1, required).max(1000, "complaints.validation.tooLong"),
});
