"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { createRandomId } from "@/lib/utils/id";
import { useChanges, useChangeTarget, useSubmitChange, useReviewChange } from "@/lib/change-requests/hooks";
import type { ChangeRequest, ChangeResource } from "@/lib/change-requests/api";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
type Values = {
    resourceType: ChangeResource;
    resourceId: string;
    action: "UPDATE" | "VOID";
    reason: string;
    text: string;
    amount: string;
};
const resources: ChangeResource[] = ["pickup", "invoice", "journal", "labels", "inventory"];
export function ChangeRequestsWorkspace() { const { companyId, user, email, roleId } = useAuth(); return <Workspace key={`${companyId}:${user?.uid ?? email}:${roleId}`}/>; }
function Workspace() {
    const search = useSearchParams();
    const initialResource = resources.find(value => value === search.get("resourceType")) ?? "pickup";
    const initialID = search.get("resourceId") ?? "";
    const { hasPermission } = useAuth();
    const { t } = useTranslation();
    const text = (key: string) => t(`accounting.changeRequests.${key}`);
    const [page, setPage] = useState(1);
    const list = useChanges(page);
    const submit = useSubmitChange();
    const review = useReviewChange();
    const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
    const [reviewReason, setReviewReason] = useState("");
    const [requestId, setRequestId] = useState(createRandomId);
    const [lookup, setLookup] = useState<{
        resourceType: ChangeResource;
        resourceId: string;
    } | null>(initialID ? { resourceType: initialResource, resourceId: initialID } : null);
    const form = useForm<Values>({ defaultValues: { resourceType: initialResource, resourceId: initialID, action: search.get("action") === "VOID" ? "VOID" : "UPDATE", reason: "", text: "", amount: "" } });
    const resource = form.watch("resourceType"), id = form.watch("resourceId"), action = form.watch("action");
    const target = useChangeTarget(resource, id, lookup?.resourceType === resource && lookup?.resourceId === id);
    const canCreate = hasPermission("canCreateChangeRequest", "change_request"), canReview = hasPermission("canApproveChangeRequest", "change_request");
    if (!canCreate && !canReview && !hasPermission("canViewChangeRequest", "change_request"))
        return <p>{t("common.errors.forbidden")}</p>;
    const field = resource === "pickup" ? "purpose" : resource === "inventory" ? "notes" : resource === "invoice" ? "receiverName" : "description";
    const save = form.handleSubmit(async (values) => {
        const context = target.data?.data;
        if (!context || context.resourceId !== values.resourceId)
            return;
        const proposedChanges: Record<string, unknown> = values.resourceType === "invoice" ? { receiver: { name: values.text } } : { [values.resourceType === "pickup" ? "purpose" : values.resourceType === "inventory" ? "notes" : "description"]: values.text };
        if (values.resourceType === "journal" && values.amount.trim())
            proposedChanges.amount = Number(values.amount);
        try {
            await submit.mutateAsync({ requestId, resourceType: values.resourceType, resourceId: values.resourceId, action: values.action, reason: values.reason, expectedVersion: context.version, ...(values.action === "UPDATE" ? { proposedChanges } : {}) });
            form.reset();
            setLookup(null);
            setRequestId(createRandomId());
        }
        catch { /* Mutation retains the exact command for retry. */ }
    });
    return <div className="space-y-6"><PageHeader title={text("title")} description={text("description")}/>
 {canCreate ? <Card><CardContent className="pt-6"><form onSubmit={save} onChange={() => { if (!submit.isPending) {
            setRequestId(createRandomId());
            submit.reset();
        } }} className="space-y-4">
 <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="change-resource">{text("resource")}</Label><select id="change-resource" className="h-10 w-full rounded-md border bg-background px-3" {...form.register("resourceType")} disabled={submit.isPending}>{resources.map(value => <option key={value} value={value}>{text(value)}</option>)}</select></div>
 <div className="space-y-2"><Label htmlFor="change-id">{text("record")}</Label><Input id="change-id" {...form.register("resourceId", { required: true })} disabled={submit.isPending}/></div></div>
 <Button type="button" variant="outline" disabled={!id.trim() || target.isFetching || submit.isPending} onClick={() => { if (lookup?.resourceType === resource && lookup?.resourceId === id) {
            void target.refetch();
        }
        else {
            setLookup({ resourceType: resource, resourceId: id });
        } }}>{text("verify")}</Button>
 {target.isError ? <p role="alert">{normalizeApiError(target.error).message}</p> : null}
 {!target.isError && target.data?.data && lookup?.resourceType === resource && lookup?.resourceId === id ? <>
 <p className="text-sm text-muted-foreground">{text("verified")}</p>
 <div className="space-y-2"><Label htmlFor="change-action">{text("action")}</Label><select id="change-action" className="h-10 w-full rounded-md border bg-background px-3" {...form.register("action")} disabled={submit.isPending}><option value="UPDATE">{text("update")}</option><option value="VOID">{text("void")}</option></select></div>
 {action === "UPDATE" ? <><div className="space-y-2"><Label htmlFor="change-text">{text(field === "description" ? "descriptionField" : field)}</Label><Input id="change-text" {...form.register("text", { required: action === "UPDATE" })} disabled={submit.isPending}/></div>{resource === "journal" ? <div className="space-y-2"><Label htmlFor="change-amount">{text("amount")}</Label><Input id="change-amount" type="number" min="0.01" step="0.01" {...form.register("amount", { validate: value => !value || Number.isFinite(Number(value)) && Number(value) > 0 })} disabled={submit.isPending}/></div> : null}</> : null}
 <div className="space-y-2"><Label htmlFor="change-reason">{text("reason")}</Label><textarea id="change-reason" className="min-h-24 w-full rounded-md border bg-background p-3" {...form.register("reason", { required: true, maxLength: 1000 })} disabled={submit.isPending}/></div>
 <Button type="submit" disabled={submit.isPending || !target.data.data.allowedActions[action === "UPDATE" ? "request_update" : "request_void"]}>{text("submit")}</Button></> : null}
 {submit.isError ? <p role="alert">{normalizeApiError(submit.error).message}</p> : null}{submit.isSuccess ? <p role="status">{text("submitted")}</p> : null}
 </form></CardContent></Card> : null}
 {list.isError ? <p role="alert">{normalizeApiError(list.error).message}</p> : null}
 <div className="space-y-3">{!list.isError && list.data?.data.map(row => <Card key={row.id}><CardContent className="space-y-3 pt-6"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{text(row.resourceType)} · {row.resourceId}</p><span>{text(row.status.toLowerCase())}</span></div><p>{text(row.action.toLowerCase())}: {row.reason}</p><p className="text-sm text-muted-foreground">{row.requestedBy.name}</p>{row.proposedChanges ? <dl className="space-y-1 text-sm">{Object.entries(row.proposedChanges).map(([key, value]) => <div key={key}><dt className="font-medium">{text(key === "receiver" ? "receiverName" : key === "description" ? "descriptionField" : key)}</dt><dd>{row.originalValues && key in row.originalValues ? <span>{text("before")}: {changeValue(row.originalValues[key])} → </span> : null}{text("after")}: {changeValue(value)}</dd></div>)}</dl> : null}{row.reviewReason ? <p>{row.reviewReason}</p> : null}{row.status === "PENDING" && canReview ? <Button variant="outline" onClick={() => { setReviewing(row); setReviewReason(""); review.reset(); }}>{text("review")}</Button> : null}</CardContent></Card>)}</div>
 <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 1 || list.isFetching} onClick={() => setPage(page - 1)}>{text("previous")}</Button><span>{page}</span><Button variant="outline" disabled={page * 25 >= (list.data?.total ?? 0) || list.isFetching} onClick={() => setPage(page + 1)}>{text("next")}</Button></div>
 <Dialog open={Boolean(reviewing)} onOpenChange={open => { if (!open && !review.isPending)
        setReviewing(null); }}><DialogContent><DialogHeader><DialogTitle>{text("review")}</DialogTitle><DialogDescription>{text("reviewDescription")}</DialogDescription></DialogHeader><p>{reviewing?.reason}</p><Label htmlFor="review-reason">{text("reviewReason")}</Label><textarea id="review-reason" className="min-h-24 rounded-md border bg-background p-3" maxLength={1000} value={reviewReason} onChange={event => setReviewReason(event.target.value)} disabled={review.isPending}/>{review.isError ? <p role="alert">{normalizeApiError(review.error).message}</p> : null}<DialogFooter>{[false, true].map(approve => <Button key={String(approve)} variant={approve ? "default" : "outline"} disabled={review.isPending || !approve && !reviewReason.trim()} onClick={() => { if (reviewing)
        review.mutate({ id: reviewing.id, approve, reason: reviewReason }, { onSuccess: () => setReviewing(null) }); }}>{text(approve ? "approve" : "reject")}</Button>)}</DialogFooter></DialogContent></Dialog>
 </div>;
}
function changeValue(value: unknown): string { if (value === null || value === undefined)
    return "—"; if (typeof value === "object" && "name" in value)
    return String(value.name); if (Array.isArray(value))
    return value.map(changeValue).join(", "); if (typeof value === "object")
    return Object.entries(value).map(([key, item]) => `${key}: ${changeValue(item)}`).join(", "); return String(value); }
