export const COMPLAINT_STATUSES = [
  "open",
  "in_progress",
  "pending_customer",
  "resolved",
  "closed",
  "rejected",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_SEVERITIES = ["low", "normal", "high", "urgent"] as const;
export type ComplaintSeverity = (typeof COMPLAINT_SEVERITIES)[number];

export const COMPLAINT_TARGET_KINDS = ["employee", "appointment", "order", "invoice", "other"] as const;
export type ComplaintTargetKind = (typeof COMPLAINT_TARGET_KINDS)[number];

/** Statuses the API flags as `pending` (unresolved). */
export const UNRESOLVED_COMPLAINT_STATUSES: readonly ComplaintStatus[] = ["open", "in_progress", "pending_customer"];

/** Mirrors the API's intake transition map; `closed → in_progress` uses the reopen command instead. */
export const COMPLAINT_STATUS_TRANSITIONS: Record<ComplaintStatus, readonly ComplaintStatus[]> = {
  open: ["in_progress", "rejected"],
  in_progress: ["pending_customer", "resolved", "rejected"],
  pending_customer: ["in_progress", "rejected"],
  resolved: ["closed", "in_progress"],
  closed: [],
  rejected: ["open"],
};

export type ComplaintTarget = {
  kind: string;
  employeeId?: number;
  label?: string;
  note?: string;
};

export type ComplaintEvent = {
  id: string;
  type: string;
  actorId: number;
  body?: string;
  fromValue?: string;
  toValue?: string;
  createdAt: string;
};

export type ComplaintResolution = {
  summary: string;
  actionTaken: string;
  resolvedByUserId?: number;
  resolvedAt?: string;
};

export type ComplaintStaffAttachment = {
  id: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number;
};

export type Complaint = {
  id: string;
  /** Intake number (`C-2026-00001`); legacy records only carry `complaintNumber`. */
  number: string;
  version: number;
  callerName: string;
  callerPhone: string;
  callerEmail: string;
  /** Empty for legacy linked-origin complaints, which cannot use the intake workflow. */
  category: string;
  subject: string;
  description: string;
  severity: string;
  status: string;
  pending: boolean;
  details: Record<string, unknown>;
  loggedBy: number;
  assigneeId: number;
  targets: ComplaintTarget[];
  events: ComplaintEvent[];
  staffAttachments: ComplaintStaffAttachment[];
  resolution: ComplaintResolution | null;
  reopenedCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
  closedAt: string;
};

/** Common staff attachment types; the API accepts any MIME type up to 100 characters. */
export const COMPLAINT_ATTACHMENT_TYPES = [
  { id: "pdf", mimeType: "application/pdf" },
  { id: "jpeg", mimeType: "image/jpeg" },
  { id: "png", mimeType: "image/png" },
  { id: "webp", mimeType: "image/webp" },
  { id: "heic", mimeType: "image/heic" },
  { id: "mp4", mimeType: "video/mp4" },
  { id: "mov", mimeType: "video/quicktime" },
  { id: "mp3", mimeType: "audio/mpeg" },
  { id: "m4a", mimeType: "audio/mp4" },
  { id: "text", mimeType: "text/plain" },
  { id: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { id: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { id: "other", mimeType: "application/octet-stream" },
] as const;

/** Staff-only attachment metadata; the file itself stays with its HTTPS host. */
export type ComplaintAttachmentRequest = {
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
};

export type ComplaintAttachmentFormValues = {
  fileUrl: string;
  mimeType: string;
  /** Megabytes as typed; converted to bytes on submit. */
  sizeMb: string;
};

export type ComplaintTargetsFormValues = {
  targets: ComplaintTargetFormValues[];
};

export type ComplaintInsightCount = {
  key: string;
  count: number;
};

export type ComplaintInsights = {
  categories: ComplaintInsightCount[];
  employees: ComplaintInsightCount[];
  total: number;
  reopened: number;
  /** Null when no complaint in the range has been resolved. */
  averageResolutionHours: number | null;
};

/** Unread workspace inbox item; `id` is the complaint UUID. */
export type ComplaintNotification = {
  id: string;
  number: string;
  subject: string;
  severity: string;
  notifiedAt: string;
};

export type ComplaintDetailProperty = {
  type: string;
  format?: string;
  enum?: string[];
  items?: ComplaintDetailProperty;
};

export type ComplaintCategory = {
  key: string;
  label: string;
  active: boolean;
  detailsSchema: {
    type: string;
    properties: Record<string, ComplaintDetailProperty>;
    required: string[];
  };
  defaultSeverity: string;
  responseSlaHours: number;
  resolutionSlaHours: number;
};

export type ComplaintTargetFormValues = {
  kind: ComplaintTargetKind;
  employeeId: string;
  label: string;
  note: string;
};

export type ComplaintIntakeFormValues = {
  callerName: string;
  callerPhone: string;
  callerEmail: string;
  category: string;
  severity: string;
  subject: string;
  description: string;
  /** Raw inputs keyed by detail property; converted to typed values on submit. */
  details: Record<string, string | boolean>;
  targets: ComplaintTargetFormValues[];
};

export type ComplaintIntakeRequest = {
  callerName: string;
  callerPhone: string;
  callerEmail?: string;
  category: string;
  severity?: string;
  subject: string;
  description: string;
  details: Record<string, unknown>;
  targets: ComplaintTarget[];
};

export type ComplaintPatch = {
  status?: ComplaintStatus;
  /** Zero clears the assignee. */
  assigneeId?: number;
  severity?: ComplaintSeverity;
  resolution?: { summary: string; actionTaken: string };
};

export function createEmptyComplaintTarget(kind: ComplaintTargetKind = "other"): ComplaintTargetFormValues {
  return { kind, employeeId: "", label: "", note: "" };
}

export function createEmptyComplaintIntakeForm(): ComplaintIntakeFormValues {
  return {
    callerName: "",
    callerPhone: "",
    callerEmail: "",
    category: "",
    severity: "",
    subject: "",
    description: "",
    details: {},
    targets: [createEmptyComplaintTarget()],
  };
}

export function isComplaintStatus(value: string): value is ComplaintStatus {
  return (COMPLAINT_STATUSES as readonly string[]).includes(value);
}

/** Legacy linked-origin complaints are read-only here; the API rejects intake mutations on them. */
export function isIntakeComplaint(complaint: Pick<Complaint, "category">): boolean {
  return complaint.category.trim() !== "";
}
