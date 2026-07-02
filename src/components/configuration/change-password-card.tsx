"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FirebaseError } from "firebase/app";
import { KeyRound } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeCurrentUserPassword } from "@/lib/auth/firebase/firebase-password";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/auth/schemas/change-password.schema";

const defaultValues: ChangePasswordValues = {
  password: "",
  confirmPassword: "",
};

export function ChangePasswordCard() {
  const { notifySuccess } = useFeedback();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues,
  });

  async function submit(values: ChangePasswordValues) {
    try {
      await changeCurrentUserPassword(values.password);
      reset(defaultValues);
      notifySuccess("Password changed successfully.");
    } catch (error) {
      setError("root", { message: passwordErrorMessage(error) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" />
          Change password
        </CardTitle>
        <CardDescription>Set a new password for your signed-in account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <PasswordField
            id="new-password"
            label="New password"
            error={errors.password?.message}
            inputProps={register("password")}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            error={errors.confirmPassword?.message}
            inputProps={register("confirmPassword")}
          />
          {errors.root ? <p className="text-sm text-destructive" role="alert">{errors.root.message}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Changing password…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
      {error ? <p id={`${id}-error`} className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function passwordErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && error.code === "auth/requires-recent-login") {
    return "For security, Firebase requires you to sign out and sign in again before changing your password.";
  }
  if (error instanceof FirebaseError && error.code === "auth/weak-password") {
    return "Firebase rejected this password because it is too weak.";
  }
  return error instanceof Error ? error.message : "Unable to change your password.";
}
