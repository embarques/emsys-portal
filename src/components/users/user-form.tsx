"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import {
  USER_BRANCHES,
  USER_LANGUAGES,
  USER_ROLE_OPTIONS,
  USER_STATUSES,
  createEmptyUserForm,
  type UserFormValues,
} from "@/lib/users/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type UserFormProps = {
  initialValues?: UserFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: UserFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function UserForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(initialValues ?? createEmptyUserForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyUserForm());
  }, [initialValues]);

  const roleOptions = useMemo(() => {
    const options = new Map(USER_ROLE_OPTIONS.map((option) => [option.id, option.label]));
    if (values.roleId > 0 && !options.has(values.roleId)) {
      options.set(values.roleId, `Role ${values.roleId}`);
    }
    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  }, [values.roleId]);

  function updateField<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="userId">User ID</Label>
        <Input
          id="userId"
          value={values.userId || "Assigned after save"}
          readOnly
          className="bg-muted/40 font-mono text-xs"
        />
        {!isEditing ? (
          <p className="text-xs text-muted-foreground">The EMSYS API assigns the user ID on create.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="uid">Firebase UID</Label>
        <Input
          id="uid"
          value={values.uid}
          onChange={(event) => updateField("uid", event.target.value)}
          placeholder="Firebase authentication UID"
          className="font-mono text-xs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">
            Username <span className="text-destructive">*</span>
          </Label>
          <Input
            id="username"
            value={values.username}
            onChange={(event) => updateField("username", event.target.value)}
            placeholder="elk@elk.com"
            autoComplete="off"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Password {!isEditing ? <span className="text-destructive">*</span> : null}
          </Label>
          <Input
            id="password"
            type="password"
            value={values.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder={isEditing ? "Leave blank to keep current" : "Enter password"}
            autoComplete="new-password"
            required={!isEditing}
          />
          {isEditing ? (
            <p className="text-xs text-muted-foreground">Leave blank to keep the current password.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Defaults to username when empty"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">
            Status <span className="text-destructive">*</span>
          </Label>
          <select
            id="status"
            className={selectClassName}
            value={values.status}
            onChange={(event) => updateField("status", event.target.value as UserFormValues["status"])}
            required
          >
            {USER_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="roleId">
            Role <span className="text-destructive">*</span>
          </Label>
          <select
            id="roleId"
            className={selectClassName}
            value={values.roleId}
            onChange={(event) => updateField("roleId", Number(event.target.value))}
            required
          >
            {roleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="language">
            Language <span className="text-destructive">*</span>
          </Label>
          <select
            id="language"
            className={selectClassName}
            value={values.language}
            onChange={(event) => updateField("language", event.target.value as UserFormValues["language"])}
            required
          >
            {USER_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch"
            className={selectClassName}
            value={values.branch}
            onChange={(event) => updateField("branch", event.target.value as UserFormValues["branch"])}
            required
          >
            {USER_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="name@emsys.example"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            value={values.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+1 (212) 555-0100"
          />
        </div>
      </div>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
