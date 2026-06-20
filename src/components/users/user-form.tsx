"use client";

import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  USER_ACTIVE_OPTIONS,
  USER_PORTAL_BRANCHES,
  USER_ROLE_OPTIONS,
  createEmptyUserForm,
  createUserBranchFromPortal,
  getUserPortalBranch,
  type UserFormValues,
  type UserPortalBranch,
} from "@/lib/users/types";

type UserFormProps = {
  initialValues?: UserFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: UserFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function UserForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(initialValues ?? createEmptyUserForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyUserForm());
  }, [initialValues]);

  const selectedPortalBranch = getUserPortalBranch({ branch: values.branch });

  const roleOptions = useMemo(() => {
    const options = new Map(USER_ROLE_OPTIONS.map((option) => [option.id, option.label]));
    if (values.role.id > 0 && !options.has(values.role.id)) {
      options.set(values.role.id, values.role.name || `Role ${values.role.id}`);
    }
    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  }, [values.role.id, values.role.name]);

  function updateField<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handlePortalBranchChange(portal: UserPortalBranch) {
    setValues((current) => ({
      ...current,
      branch: createUserBranchFromPortal(portal),
    }));
  }

  function handleRoleChange(roleId: number) {
    const label = roleOptions.find((option) => option.id === roleId)?.label ?? "";
    setValues((current) => ({
      ...current,
      role: { id: roleId, name: label },
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="id">User ID</Label>
        <Input
          id="id"
          value={values.id > 0 ? String(values.id) : "Assigned after save"}
          readOnly
          className="bg-muted/40 font-mono text-xs"
        />
        {!isEditing ? (
          <p className="text-xs text-muted-foreground">The EMSYS API assigns the user id on create.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="uid">uid</Label>
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
          <Label htmlFor="userName">
            userName <span className="text-destructive">*</span>
          </Label>
          <Input
            id="userName"
            value={values.userName}
            onChange={(event) => updateField("userName", event.target.value)}
            placeholder="elk@elk.com"
            autoComplete="off"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            password {!isEditing ? <span className="text-destructive">*</span> : null}
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
        <Label htmlFor="fullName">fullName</Label>
        <Input
          id="fullName"
          value={values.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
          placeholder="Defaults to userName when empty"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="active">
            active <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="active"
            searchable={false}
            value={String(values.active)}
            onValueChange={(next) => updateField("active", next === "true")}
            required
            options={USER_ACTIVE_OPTIONS.map((option) => ({
              value: String(option.value),
              label: option.label,
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="roleId">
            role.id <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="roleId"
            value={String(values.role.id)}
            onValueChange={(next) => handleRoleChange(Number(next))}
            searchPlaceholder="Search roles…"
            required
            options={roleOptions.map((option) => ({
              value: String(option.id),
              label: option.label,
            }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="branch">
            branch <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="branch"
            value={selectedPortalBranch}
            onValueChange={(next) => handlePortalBranchChange(next as UserPortalBranch)}
            searchPlaceholder="Search branches…"
            required
            options={USER_PORTAL_BRANCHES.map((option) => ({
              value: option.portal,
              label: option.label,
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">type</Label>
          <Input
            id="type"
            value={values.type}
            onChange={(event) => updateField("type", event.target.value)}
            placeholder="User type"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startTime">startTime</Label>
          <Input
            id="startTime"
            value={values.startTime}
            onChange={(event) => updateField("startTime", event.target.value)}
            placeholder="Shift start time"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">endTime</Label>
          <Input
            id="endTime"
            value={values.endTime}
            onChange={(event) => updateField("endTime", event.target.value)}
            placeholder="Shift end time"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">
            email {!isEditing ? <span className="text-destructive">*</span> : null}
          </Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="name@emsys.example"
            required={!isEditing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accessCode">accessCode</Label>
          <Input
            id="accessCode"
            type="number"
            value={values.accessCode}
            onChange={(event) => updateField("accessCode", Number(event.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="user">user</Label>
        <Input
          id="user"
          value={values.user ?? ""}
          onChange={(event) => updateField("user", event.target.value.trim() || null)}
          placeholder="Defaults to userName when empty"
        />
      </div>

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
