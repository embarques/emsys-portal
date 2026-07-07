"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FirebaseError } from "firebase/app";
import { KeyRound } from "lucide-react";
import { useMemo } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeCurrentUserPassword } from "@/lib/auth/firebase/firebase-password";
import {
  createChangePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/auth/schemas/change-password.schema";
import { useTranslation } from "@/lib/i18n";

const defaultValues: ChangePasswordValues = {
  password: "",
  confirmPassword: "",
};

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { notifySuccess } = useFeedback();
  const schema = useMemo(() => createChangePasswordSchema(t), [t]);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    if (!nextOpen) {
      reset(defaultValues);
    }
    onOpenChange(nextOpen);
  }

  async function submit(values: ChangePasswordValues) {
    try {
      await changeCurrentUserPassword(values.password);
      reset(defaultValues);
      onOpenChange(false);
      notifySuccess(t("settings.password.toast.success"));
    } catch (error) {
      setError("root", { message: passwordErrorMessage(error, t) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-6 p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <KeyRound className="size-6" />
            {t("settings.password.title")}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t("settings.password.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="space-y-5">
          <PasswordField
            id="new-password"
            label={t("settings.password.fields.new")}
            error={errors.password?.message}
            inputProps={register("password")}
          />
          <PasswordField
            id="confirm-password"
            label={t("settings.password.fields.confirm")}
            error={errors.confirmPassword?.message}
            inputProps={register("confirmPassword")}
          />
          {errors.root ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("settings.password.actions.changing") : t("settings.password.actions.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  id,
  label,
  error,
  inputProps,
}: {
  id: string;
  label: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function passwordErrorMessage(error: unknown, t: TranslateFn): string {
  if (error instanceof FirebaseError && error.code === "auth/requires-recent-login") {
    return t("settings.password.errors.requiresRecentLogin");
  }
  if (error instanceof FirebaseError && error.code === "auth/weak-password") {
    return t("settings.password.errors.weakPassword");
  }
  return error instanceof Error ? error.message : t("settings.password.errors.generic");
}
