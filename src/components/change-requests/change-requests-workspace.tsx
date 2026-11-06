"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { createRandomId } from "@/lib/utils/id";
import { useChanges, useChangeTarget, useSubmitChange, useReviewChange } from "@/lib/change-requests/hooks";
import type { ChangeRequest, ChangeResource, NewChange } from "@/lib/change-requests/api";
import { CHANGE_RESOURCES, changeRequestFormSchema, changeReviewSchema, type ChangeRequestFormValues } from "@/lib/change-requests/schemas/change-request.schema";
import { buildChangeCommand, canRequestChange } from "@/lib/change-requests/utils/commands";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ChangeRequestsWorkspace() {
  const { companyId, user, email, roleId, permissions } = useAuth();
  const grants = permissions.map(value => `${value.resourceType}:${value.name}`).sort().join("|");
  return <Workspace key={`${companyId}:${user?.uid ?? email}:${roleId}:${grants}`} />;
}

function Workspace() {
  const search = useSearchParams();
  const initialResource = CHANGE_RESOURCES.find(value => value === search.get("resourceType")) ?? "pickup";
  const initialID = search.get("resourceId") ?? "";
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const text = (key: string) => t(`accounting.changeRequests.${key}`);
  const [page, setPage] = useState(1);
  const list = useChanges(page);
  const submit = useSubmitChange();
  const review = useReviewChange();
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
  const [requestId, setRequestId] = useState(createRandomId);
  const pendingCommand = useRef<NewChange | null>(null);
  const submitting = useRef(false);
  const reviewingPending = useRef(false);
  const [lookup, setLookup] = useState<{ resourceType: ChangeResource; resourceId: string } | null>(
    initialID ? { resourceType: initialResource, resourceId: initialID } : null,
  );
  const form = useForm<ChangeRequestFormValues>({
    resolver: zodResolver(changeRequestFormSchema),
    defaultValues: { resourceType: initialResource, resourceId: initialID, action: search.get("action") === "VOID" ? "VOID" : "UPDATE", reason: "", text: "", amount: "" },
  });
  const reviewForm = useForm<{ reason: string }>({ resolver: zodResolver(changeReviewSchema), defaultValues: { reason: "" } });
  const [resource, rawId, action] = useWatch({ control: form.control, name: ["resourceType", "resourceId", "action"] });
  const id = rawId.trim();
  const reviewReason = useWatch({ control: reviewForm.control, name: "reason" });
  const lookupMatches = lookup?.resourceType === resource && lookup?.resourceId === id;
  const target = useChangeTarget(resource, id, lookupMatches);
  const context = lookupMatches && !target.isError && !target.isFetching ? target.data?.data : undefined;
  const canCreate = hasPermission("canCreateChangeRequest", "change_request");
  const canReview = hasPermission("canApproveChangeRequest", "change_request");
  const canSubmit = canCreate && canRequestChange(context, resource, id, action);

  async function save(values: ChangeRequestFormValues) {
    if (!context || !canSubmit || submitting.current || submit.isPending) return;
    submitting.current = true;
    try {
      // Preserve the whole command, including the source version, after an ambiguous failure.
      pendingCommand.current ??= buildChangeCommand(values, context, requestId);
      await submit.mutateAsync(pendingCommand.current);
      pendingCommand.current = null;
      form.reset();
      setLookup(null);
      setRequestId(createRandomId());
    } catch {
      // The mutation error is rendered below; keep the user's input and exact retry command.
    } finally {
      submitting.current = false;
    }
  }

  async function reviewRequest(approve: boolean, values: { reason: string }) {
    if (!reviewing || reviewing.status !== "PENDING" || !canReview || reviewingPending.current || review.isPending) return;
    if (!approve && !values.reason) {
      reviewForm.setError("reason", { message: text("reviewReason") });
      return;
    }
    reviewingPending.current = true;
    try {
      await review.mutateAsync({ id: reviewing.id, resourceType: reviewing.resourceType, approve, reason: values.reason });
      setReviewing(null);
    } catch {
      // Keep the review open and display the API failure without losing its reason.
    } finally {
      reviewingPending.current = false;
    }
  }

  if (!canCreate && !canReview && !hasPermission("canViewChangeRequest", "change_request")) {
    return <p>{t("common.errors.forbidden")}</p>;
  }
  const field = resource === "pickup" ? "purpose" : resource === "inventory" ? "notes" : resource === "invoice" ? "receiverName" : "descriptionField";

  return <div className="space-y-6">
    <PageHeader title={text("title")} description={text("description")} />
    {canCreate ? <Card><CardContent className="pt-6">
      <form onSubmit={event => { void form.handleSubmit(save)(event); }} onChange={() => {
        if (!submit.isPending && !submitting.current) {
          pendingCommand.current = null;
          setRequestId(createRandomId());
          submit.reset();
        }
      }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="change-resource">{text("resource")}</Label>
            <select id="change-resource" className="h-10 w-full rounded-md border bg-background px-3" {...form.register("resourceType")} disabled={submit.isPending}>
              {CHANGE_RESOURCES.map(value => <option key={value} value={value}>{text(value)}</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor="change-id">{text("record")}</Label>
            <Input id="change-id" {...form.register("resourceId")} disabled={submit.isPending} />
          </div>
        </div>
        <Button type="button" variant="outline" disabled={!id || target.isFetching || submit.isPending} onClick={() => {
          if (lookupMatches) void target.refetch();
          else setLookup({ resourceType: resource, resourceId: id });
        }}>{text("verify")}</Button>
        {target.isError && lookupMatches ? <p role="alert">{normalizeApiError(target.error).message}</p> : null}
        {context ? <>
          <p className="text-sm text-muted-foreground">{text("verified")}</p>
          <div className="space-y-2"><Label htmlFor="change-action">{text("action")}</Label>
            <select id="change-action" className="h-10 w-full rounded-md border bg-background px-3" {...form.register("action")} disabled={submit.isPending}>
              <option value="UPDATE" disabled={!canRequestChange(context, resource, id, "UPDATE")}>{text("update")}</option>
              <option value="VOID" disabled={!canRequestChange(context, resource, id, "VOID")}>{text("void")}</option>
            </select>
          </div>
          {action === "UPDATE" ? <>
            <div className="space-y-2"><Label htmlFor="change-text">{text(field)}</Label>
              <Input id="change-text" {...form.register("text")} disabled={submit.isPending} />
            </div>
            {resource === "journal" ? <div className="space-y-2"><Label htmlFor="change-amount">{text("amount")}</Label>
              <Input id="change-amount" type="number" min="0.01" step="0.01" {...form.register("amount")} disabled={submit.isPending} />
            </div> : null}
          </> : null}
          <div className="space-y-2"><Label htmlFor="change-reason">{text("reason")}</Label>
            <textarea id="change-reason" className="min-h-24 w-full rounded-md border bg-background p-3" {...form.register("reason")} disabled={submit.isPending} />
          </div>
          {Object.keys(form.formState.errors).length ? <p role="alert">{text("invalid")}</p> : null}
          {!canSubmit ? <p role="status">{text("notAllowed")}</p> : null}
          <Button type="submit" disabled={submit.isPending || !canSubmit}>{text("submit")}</Button>
        </> : null}
        {submit.isError ? <p role="alert">{normalizeApiError(submit.error).message}</p> : null}
        {submit.isSuccess ? <p role="status">{text("submitted")}</p> : null}
      </form>
    </CardContent></Card> : null}
    {list.isLoading ? <p role="status">{text("loading")}</p> : null}
    {list.isError ? <p role="alert">{normalizeApiError(list.error).message}</p> : null}
    {list.isSuccess && !list.data.data.length ? <p>{text("empty")}</p> : null}
    <div className="space-y-3">{!list.isError && list.data?.data.map(row => <Card key={row.id}>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{text(row.resourceType)} · {row.resourceId}</p><span>{text(row.status.toLowerCase())}</span></div>
        <p>{text(row.action.toLowerCase())}: {row.reason}</p>
        <p className="text-sm text-muted-foreground">{row.requestedBy.name}</p>
        {row.proposedChanges ? <dl className="space-y-1 text-sm">{Object.entries(row.proposedChanges).map(([key, value]) => <div key={key}>
          <dt className="font-medium">{text(key === "receiver" ? "receiverName" : key === "description" ? "descriptionField" : key)}</dt>
          <dd>{row.originalValues && key in row.originalValues ? <span>{text("before")}: {changeValue(row.originalValues[key])} → </span> : null}{text("after")}: {changeValue(value)}</dd>
        </div>)}</dl> : null}
        {row.reviewReason ? <p>{row.reviewReason}</p> : null}
        {row.status === "PENDING" && canReview ? <Button variant="outline" onClick={() => {
          setReviewing(row);
          reviewForm.reset({ reason: "" });
          review.reset();
        }}>{text("review")}</Button> : null}
      </CardContent>
    </Card>)}</div>
    <div className="flex items-center justify-between">
      <Button variant="outline" disabled={page === 1 || list.isFetching} onClick={() => setPage(page - 1)}>{text("previous")}</Button>
      <span>{page}</span>
      <Button variant="outline" disabled={page * 25 >= (list.data?.total ?? 0) || list.isFetching} onClick={() => setPage(page + 1)}>{text("next")}</Button>
    </div>
    <Dialog open={Boolean(reviewing)} onOpenChange={open => { if (!open && !review.isPending) setReviewing(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{text("review")}</DialogTitle><DialogDescription>{text("reviewDescription")}</DialogDescription></DialogHeader>
        <p>{reviewing?.reason}</p>
        <form onSubmit={event => { void reviewForm.handleSubmit(values => reviewRequest(true, values))(event); }} className="space-y-4">
          <Label htmlFor="review-reason">{text("reviewReason")}</Label>
          <textarea id="review-reason" className="min-h-24 w-full rounded-md border bg-background p-3" {...reviewForm.register("reason")} disabled={review.isPending} />
          {reviewForm.formState.errors.reason ? <p role="alert">{text("invalid")}</p> : null}
          {review.isError ? <p role="alert">{normalizeApiError(review.error).message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={review.isPending || !reviewReason.trim()} onClick={() => { void reviewForm.handleSubmit(values => reviewRequest(false, values))(); }}>{text("reject")}</Button>
            <Button type="submit" disabled={review.isPending}>{text("approve")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

function changeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object" && "name" in value) return String(value.name);
  if (Array.isArray(value)) return value.map(changeValue).join(", ");
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${changeValue(item)}`).join(", ");
  return String(value);
}
