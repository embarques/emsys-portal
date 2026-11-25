"use client";

import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEmployeeUserLink } from "@/lib/employees/hooks/use-employee-user-link";
import { normalizeApiError } from "@/lib/api/axios";
import { useUserError } from "@/lib/errors";

const selection = z.object({ id: z.string().regex(/^[1-9][0-9]*$/) });

export function EmployeeUserLink({
  side,
  name,
  id,
  linkedUser,
}: {
  side: "employee" | "user";
  name: string;
  id: number;
  linkedUser?: string;
}) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { notifySuccess } = useFeedback();
  const { toErrorMessage } = useUserError();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const delayed = useDebouncedValue(search, 250);
  const inputId = useId();
  const submitting = useRef(false);
  const form = useForm<{ id: string }>({
    resolver: zodResolver(selection),
    defaultValues: { id: "" },
  });
  const target = side === "employee" ? "user" : "employee";
  const allowed = [
    PERMISSIONS.employeeUserLink,
    PERMISSIONS.usersView,
    PERMISSIONS.employeesView,
  ].every((p) => hasPermission(p.name, p.resourceType));
  const { candidates, mutation } = useEmployeeUserLink(
    target,
    delayed,
    open && allowed,
  );
  const action = t(
    target === "user"
      ? "employees.link.userAction"
      : "employees.link.employeeAction",
  );
  const options = candidates.data ?? [];
  const selected = form.watch("id");
  const pending = mutation.isPending || form.formState.isSubmitting;
  const close = () => {
    setOpen(false);
    setSearch("");
    form.reset();
  };
  async function submit({ id: choice }: { id: string }) {
    if (submitting.current) return;
    submitting.current = true;
    const candidateId = Number(choice);
    try {
      await mutation.mutateAsync({
        employeeId: side === "employee" ? id : candidateId,
        userId: side === "user" ? id : candidateId,
      });
      notifySuccess(t("employees.link.success"));
      close();
    } catch (error) {
      const message =
        normalizeApiError(error).status === 409
          ? t("employees.link.conflict")
          : toErrorMessage(error);
      form.setError("root", { message });
    } finally {
      submitting.current = false;
    }
  }

  if (linkedUser)
    return (
      <span className="text-xs">
        {t("employees.link.linked", { name: linkedUser })}
      </span>
    );
  if (!allowed)
    return (
      <span className="text-xs text-muted-foreground">
        {t("employees.link.ask")}
      </span>
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          if (next) setOpen(true);
          else close();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {action}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)}>
          <Label htmlFor={inputId}>
            {t(
              target === "user"
                ? "employees.link.user"
                : "employees.link.employee",
            )}
          </Label>
          <SearchableSelect
            id={inputId}
            value={selected}
            options={options}
            onValueChange={(value) => {
              form.clearErrors();
              form.setValue("id", value);
            }}
            onSearchChange={setSearch}
            manualFiltering
            placeholder={t("employees.link.search")}
            searchPlaceholder={t("employees.link.search")}
            loading={candidates.isFetching}
            disabled={pending}
          />
          {candidates.isError && (
            <p role="alert">{toErrorMessage(candidates.error)}</p>
          )}
          {form.formState.errors.root?.message && (
            <p role="alert">{form.formState.errors.root.message}</p>
          )}
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={pending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" disabled={!selected || pending}>
              {action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
