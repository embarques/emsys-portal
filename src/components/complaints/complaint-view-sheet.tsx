"use client";

import {
  CheckCircle2,
  ClipboardList,
  History,
  Info,
  MessageSquarePlus,
  MessageSquareWarning,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Target,
  UserRound,
  XCircle,
  Archive,
} from "lucide-react";

import { ComplaintActionDialog } from "@/components/complaints/complaint-action-dialog";
import { ComplaintAttachmentDialog, ComplaintTargetsDialog } from "@/components/complaints/complaint-edit-dialogs";
import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  complaintAttachmentTypeLabel,
  complaintCategoryLabel,
  complaintDetailFieldLabel,
  complaintSeverityBadgeClassName,
  complaintSeverityLabel,
  complaintStatusBadgeClassName,
  complaintStatusLabel,
  complaintTargetKindLabel,
  formatComplaintAttachmentSize,
  formatComplaintDetailValue,
} from "@/lib/complaints/display";
import { useComplaint, useComplaintAccess, type useComplaintPeople } from "@/lib/complaints/hooks/use-complaints";
import { useComplaintWorkflow } from "@/lib/complaints/hooks/use-complaint-workflow";
import {
  COMPLAINT_SEVERITIES,
  COMPLAINT_STATUS_TRANSITIONS,
  isComplaintStatus,
  isIntakeComplaint,
  type Complaint,
  type ComplaintCategory,
  type ComplaintEvent,
  type ComplaintSeverity,
  type ComplaintStatus,
} from "@/lib/complaints/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";

type People = ReturnType<typeof useComplaintPeople>;

const TRANSITION_ICONS: Record<ComplaintStatus, typeof Play> = {
  open: RotateCcw,
  in_progress: Play,
  pending_customer: Pause,
  resolved: CheckCircle2,
  closed: Archive,
  rejected: XCircle,
};

export function ComplaintStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={complaintStatusBadgeClassName(status)}>
      {complaintStatusLabel(t, status)}
    </Badge>
  );
}

export function ComplaintSeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation();
  if (!severity) return <span>{t("common.empty.dash")}</span>;
  return (
    <Badge variant="outline" className={complaintSeverityBadgeClassName(severity)}>
      {complaintSeverityLabel(t, severity)}
    </Badge>
  );
}

function useUserLabel(people: People) {
  const { t } = useTranslation();
  return (id: number | string | undefined) => {
    const numeric = Number(id ?? 0);
    if (!numeric) return t("complaints.unassigned");
    return people.userName(numeric) ?? t("complaints.userFallback", { id: numeric });
  };
}

function TimelineEntry({ event, userLabel }: { event: ComplaintEvent; userLabel: (id: number | string | undefined) => string }) {
  const { t } = useTranslation();
  let text: string;
  if (event.type === "status_change") {
    text = event.fromValue
      ? t("complaints.timeline.statusChange", {
          from: complaintStatusLabel(t, event.fromValue),
          to: complaintStatusLabel(t, event.toValue ?? ""),
        })
      : t("complaints.timeline.filed", { status: complaintStatusLabel(t, event.toValue ?? "") });
  } else if (event.type === "assignment") {
    text = Number(event.toValue ?? 0)
      ? t("complaints.timeline.assigned", { user: userLabel(event.toValue) })
      : t("complaints.timeline.unassigned");
  } else if (event.type === "reopened") {
    text = t("complaints.timeline.reopened");
  } else if (event.type === "note") {
    text = t("complaints.timeline.note");
  } else {
    text = event.type;
  }

  return (
    <li className="border-b border-border/80 px-4 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{text}</span>
        <span className="text-xs text-muted-foreground">{formatAuditDateTime(event.createdAt)}</span>
      </div>
      {event.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90 [overflow-wrap:anywhere]">{event.body}</p> : null}
      <p className="mt-0.5 text-xs text-muted-foreground">{userLabel(event.actorId)}</p>
    </li>
  );
}

function WorkflowActions({
  complaint,
  workflow,
  canReopen,
}: {
  complaint: Complaint;
  workflow: ReturnType<typeof useComplaintWorkflow>;
  canReopen: boolean;
}) {
  const { t } = useTranslation();
  const status = isComplaintStatus(complaint.status) ? complaint.status : null;
  if (!status) return null;

  const transitions = COMPLAINT_STATUS_TRANSITIONS[status];
  return (
    <>
      {transitions.map((next) => {
        const Icon = TRANSITION_ICONS[next];
        const label = t(`complaints.workflow.actions.${status}.${next}`);
        return (
          <Button
            key={next}
            size="sm"
            variant={next === "resolved" || (status === "open" && next === "in_progress") ? "default" : "outline"}
            disabled={workflow.busy}
            onClick={() => (next === "resolved" ? workflow.openDialog("resolve") : workflow.transition(next))}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        );
      })}
      {status === "closed" && canReopen ? (
        <Button size="sm" variant="outline" disabled={workflow.busy} onClick={() => workflow.openDialog("reopen")}>
          <RotateCcw className="size-4" />
          {t("complaints.workflow.reopen")}
        </Button>
      ) : null}
      {status !== "closed" ? (
        <Button size="sm" variant="outline" disabled={workflow.busy} onClick={() => workflow.openDialog("note")}>
          <MessageSquarePlus className="size-4" />
          {t("complaints.workflow.addNote")}
        </Button>
      ) : null}
    </>
  );
}

type ComplaintViewSheetProps = {
  complaint: Complaint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: readonly ComplaintCategory[];
  people: People;
};

export function ComplaintViewSheet({ complaint: row, open, onOpenChange, categories, people }: ComplaintViewSheetProps) {
  const { t, locale } = useTranslation();
  const access = useComplaintAccess();
  const detail = useComplaint(open ? row?.id ?? null : null, row ?? undefined);
  const complaint = detail.data ?? row;
  const workflow = useComplaintWorkflow(complaint);
  const userLabel = useUserLabel(people);

  if (!complaint) return null;

  const dash = t("common.empty.dash");
  const intake = isIntakeComplaint(complaint);
  const editable = intake && access.canUpdate && complaint.status !== "closed";
  const detailEntries = Object.entries(complaint.details);
  const events = [...complaint.events].reverse();
  const assigneeOptions = [
    { value: "0", label: t("complaints.unassigned") },
    ...people.users
      .filter((user) => user.active || user.id === complaint.assigneeId)
      .map((user) => ({ value: String(user.id), label: user.name || user.email, description: user.email, keywords: [user.email] })),
  ];
  const severityOptions = COMPLAINT_SEVERITIES.map((value) => ({ value, label: complaintSeverityLabel(t, value) }));

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={complaint.subject || complaint.number || dash}
          meta={
            <>
              {complaint.number ? (
                <Badge variant="outline" className="font-mono">
                  {complaint.number}
                </Badge>
              ) : null}
              <ComplaintStatusBadge status={complaint.status} />
              <ComplaintSeverityBadge severity={complaint.severity} />
              {complaint.category ? <Badge variant="secondary">{complaintCategoryLabel(t, complaint.category, categories)}</Badge> : null}
            </>
          }
          actions={
            intake && access.canUpdate ? (
              <WorkflowActions complaint={complaint} workflow={workflow} canReopen={access.canReopen} />
            ) : undefined
          }
        />

        <RecordViewSheetBody>
          {!intake ? (
            <p role="note" className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              {t("complaints.view.legacyNotice")}
            </p>
          ) : null}

          <RecordViewSheetSection icon={UserRound} title={t("complaints.form.sections.caller")}>
            <RecordViewSheetDetailRow label={t("complaints.fields.callerName")} value={complaint.callerName || dash} />
            <RecordViewSheetDetailRow
              label={t("complaints.fields.callerPhone")}
              value={complaint.callerPhone ? formatPhoneDisplayOrDash(complaint.callerPhone) : dash}
            />
            <RecordViewSheetDetailRow label={t("complaints.fields.callerEmail")} value={complaint.callerEmail || dash} />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={MessageSquareWarning} title={t("complaints.form.sections.complaint")}>
            <RecordViewSheetDetailRow label={t("complaints.fields.description")} value={complaint.description || dash} />
            <RecordViewSheetDetailRow
              label={t("complaints.fields.assignee")}
              value={
                editable && access.canViewUsers ? (
                  <SearchableSelect
                    id="complaint-assignee"
                    options={assigneeOptions}
                    value={String(complaint.assigneeId)}
                    onValueChange={(value) => workflow.assign(Number(value))}
                    loading={people.usersLoading}
                    disabled={workflow.busy}
                    aria-label={t("complaints.fields.assignee")}
                    placeholder={t("complaints.unassigned")}
                    searchPlaceholder={t("complaints.view.assigneeSearch")}
                    emptyMessage={t("complaints.view.assigneeEmpty")}
                  />
                ) : (
                  userLabel(complaint.assigneeId)
                )
              }
            />
            <RecordViewSheetDetailRow
              label={t("complaints.fields.severity")}
              value={
                editable ? (
                  <SearchableSelect
                    id="complaint-severity-change"
                    options={severityOptions}
                    value={complaint.severity}
                    onValueChange={(value) => workflow.changeSeverity(value as ComplaintSeverity)}
                    disabled={workflow.busy}
                    aria-label={t("complaints.fields.severity")}
                    placeholder={complaintSeverityLabel(t, complaint.severity)}
                    searchPlaceholder={t("complaints.form.searchOptions")}
                    emptyMessage={t("complaints.form.noOptions")}
                  />
                ) : (
                  complaintSeverityLabel(t, complaint.severity)
                )
              }
            />
            <RecordViewSheetDetailRow label={t("complaints.fields.loggedBy")} value={complaint.loggedBy ? userLabel(complaint.loggedBy) : dash} />
            <RecordViewSheetDetailRow label={t("complaints.fields.createdAt")} value={formatAuditDateTime(complaint.createdAt)} />
            {complaint.reopenedCount > 0 ? (
              <RecordViewSheetDetailRow label={t("complaints.fields.reopenedCount")} value={complaint.reopenedCount} />
            ) : null}
          </RecordViewSheetSection>

          {detailEntries.length ? (
            <RecordViewSheetSection icon={ClipboardList} title={t("complaints.view.details")}>
              {detailEntries.map(([key, value]) => (
                <RecordViewSheetDetailRow key={key} label={complaintDetailFieldLabel(t, key)} value={formatComplaintDetailValue(t, value)} />
              ))}
            </RecordViewSheetSection>
          ) : null}

          {complaint.targets.length || editable ? (
            <RecordViewSheetSection
              icon={Target}
              title={t("complaints.form.sections.targets")}
              headerAction={
                editable ? (
                  <Button size="sm" variant="ghost" className="h-7" disabled={workflow.busy} onClick={() => workflow.openDialog("targets")}>
                    <Pencil className="size-3.5" />
                    {t("complaints.workflow.editTargets")}
                  </Button>
                ) : undefined
              }
            >
              {complaint.targets.map((target, index) => {
                const subject = target.kind === "employee"
                  ? people.employeeName(target.employeeId ?? 0) ?? t("complaints.employeeFallback", { id: target.employeeId ?? 0 })
                  : target.label || dash;
                return (
                  <RecordViewSheetDetailRow
                    key={`${target.kind}:${target.employeeId ?? target.label ?? ""}:${index}`}
                    label={complaintTargetKindLabel(t, target.kind)}
                    value={target.note ? `${subject}\n${target.note}` : subject}
                  />
                );
              })}
            </RecordViewSheetSection>
          ) : null}

          {complaint.resolution ? (
            <RecordViewSheetSection icon={CheckCircle2} title={t("complaints.view.resolution")}>
              <RecordViewSheetDetailRow label={t("complaints.fields.resolutionSummary")} value={complaint.resolution.summary || dash} />
              <RecordViewSheetDetailRow label={t("complaints.fields.actionTaken")} value={complaint.resolution.actionTaken || dash} />
              <RecordViewSheetDetailRow
                label={t("complaints.fields.resolvedBy")}
                value={complaint.resolution.resolvedByUserId ? userLabel(complaint.resolution.resolvedByUserId) : dash}
              />
              <RecordViewSheetDetailRow
                label={t("complaints.fields.resolvedAt")}
                value={complaint.resolution.resolvedAt ? formatAuditDateTime(complaint.resolution.resolvedAt) : dash}
              />
            </RecordViewSheetSection>
          ) : null}

          {complaint.staffAttachments.length || editable ? (
            <RecordViewSheetSection
              icon={Paperclip}
              title={t("complaints.view.attachments")}
              headerAction={
                editable && complaint.staffAttachments.length < 50 ? (
                  <Button size="sm" variant="ghost" className="h-7" disabled={workflow.busy} onClick={() => workflow.openDialog("attachment")}>
                    <Plus className="size-3.5" />
                    {t("complaints.workflow.addAttachment")}
                  </Button>
                ) : undefined
              }
            >
              {complaint.staffAttachments.length ? (
                complaint.staffAttachments.map((attachment) => (
                  <RecordViewSheetDetailRow
                    key={attachment.id}
                    label={complaintAttachmentTypeLabel(t, attachment.mimeType) || dash}
                    value={
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                          {t("complaints.view.openAttachment")}
                        </a>
                        {attachment.sizeBytes ? (
                          <span className="text-xs text-muted-foreground">{formatComplaintAttachmentSize(attachment.sizeBytes, locale)}</span>
                        ) : null}
                      </span>
                    }
                  />
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">{t("complaints.attachments.empty")}</p>
              )}
            </RecordViewSheetSection>
          ) : null}

          {events.length ? (
            <RecordViewSheetSection icon={History} title={t("complaints.view.timeline")}>
              <ol className={cn(detail.isFetching && "opacity-70")}>
                {events.map((event) => (
                  <TimelineEntry key={event.id} event={event} userLabel={userLabel} />
                ))}
              </ol>
            </RecordViewSheetSection>
          ) : null}
        </RecordViewSheetBody>
      </RecordViewSheetContent>
      <ComplaintActionDialog workflow={workflow} />
      <ComplaintTargetsDialog workflow={workflow} canPickEmployees={access.canViewEmployees} />
      <ComplaintAttachmentDialog workflow={workflow} />
    </RecordViewSheet>
  );
}
