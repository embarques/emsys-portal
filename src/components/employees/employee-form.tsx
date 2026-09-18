"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { employeeFormSchema } from "@/lib/employees/schemas/employee.schema";
import { getEmployeeTitleOptions } from "@/lib/employee-titles/utils/title-options";
import { useAllBranchOptions } from "@/lib/branches/hooks/use-branches";
import { Building2, MapPin, Phone, Plus, Pencil, User as UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { EmployeeDepartmentDialog } from "@/components/employee-departments/employee-department-dialog";
import { EmployeeTitleDialog } from "@/components/employee-titles/employee-title-dialog";
import { useDepartmentWorkspace } from "@/lib/employee-departments/hooks/use-department-workspace";
import { useTitleWorkspace } from "@/lib/employee-titles/hooks/use-title-workspace";
import { UserForm } from "@/components/users/user-form";
import { FieldEntityActions, fieldEntityActionClassName } from "@/components/forms/field-entity-actions";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { employeeDateToInputValue, isEmployeeEndDateBeforeToday } from "@/lib/employees/utils/employee-date";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { createSecondaryFirebaseUser } from "@/lib/auth/firebase/firebase-user-admin";
import { useTranslation } from "@/lib/i18n";
import { useCreateUser, useUpdateUser, useUsers } from "@/lib/users/hooks/use-users";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { createEmptyUserForm, type User, type UserFormValues, userToFormValues } from "@/lib/users/types";
import {
  createEmptyEmployeeForm,
  type EmployeeAddress,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import type { ParsedPlaceAddress } from "@/lib/customers/types";

type EmployeeFormProps = {
  initialValues?: EmployeeFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function EmployeeForm({
  initialValues,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const { t } = useTranslation();
  const { notifyAdded } = useFeedback();
  const usersQuery = useUsers({ page: 1, limit: 200, sort: "name:asc", active: true });
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const branchesQuery = useAllBranchOptions();
  const { control, reset, setValue, getValues, handleSubmit, formState: { errors } } = useForm<EmployeeFormValues>({
    defaultValues: initialValues ?? createEmptyEmployeeForm(),
    resolver: zodResolver(employeeFormSchema),
  });
  const values = useWatch({ control }) as EmployeeFormValues;
  const departmentEditor = useDepartmentWorkspace({
    onSaved: (item) => setValue("department", item.name, { shouldDirty: true, shouldValidate: true }),
  });
  const titleEditor = useTitleWorkspace({
    onSaved: (item) => setValue("title", item.name, { shouldDirty: true, shouldValidate: true }),
  });
  const departmentsQuery = departmentEditor.query;
  const titlesQuery = titleEditor.query;
  // Employee references are names; never guess an ID when catalog names collide.
  const selectedDepartments = (departmentsQuery.data ?? []).filter((item) => item.name === values.department);
  const selectedTitles = (titlesQuery.data ?? []).filter((item) => item.name === values.title);

  const [manualAddressEntry, setManualAddressEntry] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    reset(initialValues ?? createEmptyEmployeeForm());
    setManualAddressEntry(false);
  }, [initialValues, reset]);

  const departmentOptions = useMemo(() => {
    const names = (departmentsQuery.data ?? []).filter((item) => item.active).map((item) => item.name);
    return Array.from(new Set([...names, values.department].filter(Boolean))).map((name) => ({ value: name, label: name }));
  }, [departmentsQuery.data, values.department]);

  const titleOptions = useMemo(
    () => getEmployeeTitleOptions(titlesQuery.data ?? [], values.title),
    [titlesQuery.data, values.title],
  );

  const activeOptions = useMemo(
    () => [
      { value: "true", label: t("employees.enums.status.active") },
      { value: "false", label: t("employees.enums.status.inactive") },
    ],
    [t],
  );

  const branchOptions = useMemo(() => {
    const branches = branchesQuery.data ?? [];
    const selected = values.branch;
    const items = selected.id && !branches.some((branch) => branch.id === selected.id) ? [selected, ...branches] : branches;
    return items.map((branch) => ({ value: String(branch.id), label: [branch.name, branch.code].filter(Boolean).join(" · ") || String(branch.id) }));
  }, [branchesQuery.data, values.branch]);
  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
  const userOptions = useMemo(() => {
    const selectedUser = values.user;
    const userItems =
      selectedUser && !users.some((user) => user.id === selectedUser.id)
        ? [selectedUser, ...users]
        : users;

    return [
      { value: "", label: t("employees.form.fields.noUser") },
      ...userItems.map((user) => ({
        value: String(user.id),
        label: user.email ? `${user.name} · ${user.email}` : user.name,
      })),
    ];
  }, [t, users, values.user]);

  const createUserInitialValues = useMemo<UserFormValues>(
    () => ({
      ...createEmptyUserForm(),
      email: values.email.trim(),
      name: values.name.trim(),
    }),
    [values.email, values.name],
  );

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValue<keyof EmployeeFormValues>(key, value, { shouldDirty: true, shouldValidate: true });
  }

  function updateEndDate(next: string) {
    updateField("endDate", next);
    if (isEmployeeEndDateBeforeToday(next)) {
      updateField("active", false);
    }
  }

  function updateAddressField<K extends keyof EmployeeAddress>(key: K, value: EmployeeAddress[K]) {
    updateField("address", { ...getValues("address"), [key]: value });
  }

  function applyPlaceToAddress(place: ParsedPlaceAddress) {
    const current = getValues("address");
    updateField("address", {
      ...current,
      address1: place.address1 || current.address1,
      city: place.city || current.city,
      state: place.state || current.state,
      zipcode: place.zipcode || current.zipcode,
      country: place.country || current.country,
    });
  }

  function updateBranch(id: string) {
    const branch = branchesQuery.data?.find((item) => String(item.id) === id);
    if (branch) updateField("branch", { id: branch.id, code: branch.code, name: branch.name });
  }

  function updateUser(userId: string) {
    const user =
      users.find((entry) => String(entry.id) === userId) ??
      (values.user && String(values.user.id) === userId ? values.user : null);
    updateField("user", user ? { ...user } : null);
  }

  function selectCreatedUser(user: User) {
    updateField("user", user);
  }

  async function createUser(values: UserFormValues) {
    setCreateUserError(null);

    try {
      const uid = await createSecondaryFirebaseUser(values.email, values.password);
      try {
        const next = await createUserMutation.mutateAsync({ values, uid });
        selectCreatedUser(next);
        notifyAdded(t("users.entity"), next.name);
        setCreateUserOpen(false);
      } catch (apiError) {
        throw new Error(
          t("users.errors.firebasePartialCreate", {
            message: normalizeApiError(apiError).message,
          }),
        );
      }
    } catch (error) {
      setCreateUserError(normalizeApiError(error).message);
    }
  }

  async function saveUser(values: UserFormValues) {
    if (!editingUser) return;

    setCreateUserError(null);
    try {
      const next = await updateUserMutation.mutateAsync({ userId: editingUser.id, values });
      selectCreatedUser(next);
      setCreateUserOpen(false);
      setEditingUser(null);
    } catch (error) {
      setCreateUserError(normalizeApiError(error).message);
    }
  }

  function openCreateUser() {
    setEditingUser(null);
    setCreateUserError(null);
    setCreateUserOpen(true);
  }

  function openEditUser() {
    if (!values.user) return;
    setEditingUser(values.user);
    setCreateUserError(null);
    setCreateUserOpen(true);
  }

  function updateCreateUserOpen(open: boolean) {
    if (!open && (createUserMutation.isPending || updateUserMutation.isPending)) return;
    setCreateUserOpen(open);
    if (!open) {
      setCreateUserError(null);
      setEditingUser(null);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody isBusy={isSubmitting}>
          {departmentsQuery.isError || titlesQuery.isError || branchesQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">{normalizeApiError(departmentsQuery.error || titlesQuery.error || branchesQuery.error).message}</p>
          ) : null}
          <FormSection icon={UserIcon} title={t("employees.form.sections.employee")}>
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="name">
                  {t("employees.form.fields.name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder={t("employees.form.placeholders.name")}
                  required
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <Label htmlFor="department">
                      {t("employees.form.fields.department")} <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-1">
                      <PermissionGuard permission={PERMISSIONS.employeeDepartmentsCreate}>
                        <Button type="button" variant="ghost" size="sm" className={fieldEntityActionClassName}
                          disabled={isSubmitting || departmentEditor.busy} onClick={() => departmentEditor.edit(null)}>
                          <Plus className="size-3.5" />{t("common.actions.add")}
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission={PERMISSIONS.employeeDepartmentsUpdate}>
                        <Button type="button" variant="ghost" size="sm" className={fieldEntityActionClassName}
                          disabled={isSubmitting || departmentEditor.busy || departmentsQuery.isFetching || departmentsQuery.isError || selectedDepartments.length !== 1}
                          onClick={() => { if (selectedDepartments.length === 1) departmentEditor.edit(selectedDepartments[0]); }}>
                          <Pencil className="size-3.5" />{t("common.actions.edit")}
                        </Button>
                      </PermissionGuard>
                    </div>
                  </div>
                  <SearchableSelect
                    id="department"
                    value={values.department}
                    onValueChange={(next) => updateField("department", next)}
                    searchPlaceholder={t("employees.form.placeholders.departmentSearch")}
                    required
                    options={departmentOptions}
                    disabled={departmentsQuery.isLoading}
                    mobileSheet
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <Label htmlFor="title">
                      {t("employees.form.fields.title")} <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-1">
                      <PermissionGuard permission={PERMISSIONS.employeeTitlesCreate}>
                        <Button type="button" variant="ghost" size="sm" className={fieldEntityActionClassName}
                          disabled={isSubmitting || titleEditor.busy} onClick={() => titleEditor.edit(null)}>
                          <Plus className="size-3.5" />{t("common.actions.add")}
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission={PERMISSIONS.employeeTitlesUpdate}>
                        <Button type="button" variant="ghost" size="sm" className={fieldEntityActionClassName}
                          disabled={isSubmitting || titleEditor.busy || titlesQuery.isFetching || titlesQuery.isError || selectedTitles.length !== 1}
                          onClick={() => { if (selectedTitles.length === 1) titleEditor.edit(selectedTitles[0]); }}>
                          <Pencil className="size-3.5" />{t("common.actions.edit")}
                        </Button>
                      </PermissionGuard>
                    </div>
                  </div>
                  <SearchableSelect
                    id="title"
                    value={values.title}
                    onValueChange={(next) => updateField("title", next)}
                    searchPlaceholder={t("employees.form.placeholders.titleSearch")}
                    required
                    options={titleOptions}
                    disabled={titlesQuery.isLoading}
                    mobileSheet
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="active">
                  {t("employees.form.fields.active")} <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="active"
                  value={values.active ? "true" : "false"}
                  onValueChange={(next) => updateField("active", next === "true")}
                  required
                  options={activeOptions}
                  mobileSheet
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="startDate">{t("employees.form.fields.startDate")}</Label>
                  <DateInput
                    id="startDate"
                    value={employeeDateToInputValue(values.startDate)}
                    onChange={(event) => updateField("startDate", event.target.value)}
                    aria-invalid={Boolean(errors.startDate)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="endDate">{t("employees.form.fields.endDate")}</Label>
                  <DateInput
                    id="endDate"
                    value={employeeDateToInputValue(values.endDate)}
                    onChange={(event) => updateEndDate(event.target.value)}
                    aria-invalid={Boolean(errors.endDate)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cost">{t("employees.form.fields.cost")}</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.cost}
                  onChange={(event) => updateField("cost", Number(event.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="userId">{t("employees.form.fields.user")}</Label>
                  <FieldEntityActions
                    hasSelection={Boolean(values.user)}
                    onAdd={openCreateUser}
                    onEdit={openEditUser}
                    disabled={usersQuery.isLoading}
                  />
                </div>
                <div className="min-w-0 w-full">
                  <SearchableSelect
                    id="userId"
                    value={values.user ? String(values.user.id) : ""}
                    onValueChange={updateUser}
                    placeholder={t("employees.form.fields.noUser")}
                    searchPlaceholder={t("employees.form.placeholders.userSearch")}
                    options={userOptions}
                    disabled={usersQuery.isLoading}
                    className="w-full"
                    mobileSheet
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection icon={Building2} title={t("employees.form.sections.branch")}>
            <div className="space-y-1">
              <Label htmlFor="branch-portal">
                {t("employees.form.fields.branch")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="branch-portal"
                value={values.branch.id ? String(values.branch.id) : ""}
                onValueChange={updateBranch}
                searchPlaceholder={t("employees.form.placeholders.branchSearch")}
                required
                options={branchOptions}
                disabled={branchesQuery.isLoading}
                mobileSheet
              />
            </div>
          </FormSection>

        <FormSection
          icon={MapPin}
          title={t("employees.form.sections.address")}
          action={
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setManualAddressEntry((current) => !current)}
            >
              {manualAddressEntry ? t("common.address.useGoogle") : t("common.address.useManual")}
            </button>
          }
        >
          <div className="space-y-2.5">
            <div className="flex items-end gap-2">
              <div className="min-w-0 w-full flex-1 space-y-1">
                <Label htmlFor="address-address1" className="text-xs text-muted-foreground">
                  {t("employees.form.fields.address1")}
                </Label>
                <AddressAutocompleteInput
                  id="address-address1"
                  value={values.address.address1}
                  onValueChange={(value) => updateAddressField("address1", value)}
                  onPlaceSelected={applyPlaceToAddress}
                  placeholder={t("employees.form.placeholders.address1")}
                  allowManualEntry
                  className="w-full"
                  manualEntry={manualAddressEntry}
                  onManualEntryChange={setManualAddressEntry}
                  manualEntryTogglePosition="none"
                />
              </div>
              <div className="w-24 shrink-0 space-y-1 sm:w-32">
                <Label htmlFor="address-apartment" className="text-xs text-muted-foreground">
                  {t("employees.form.fields.apartment")}
                </Label>
                <Input
                  id="address-apartment"
                  value={values.address.apartment}
                  onChange={(event) => updateAddressField("apartment", event.target.value)}
                  placeholder={t("employees.form.placeholders.apartment")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Input
                id="address-address2"
                value={values.address.address2}
                onChange={(event) => updateAddressField("address2", event.target.value)}
                placeholder={t("employees.form.placeholders.address2")}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="address-city" className="text-xs text-muted-foreground">
                  {t("employees.form.fields.city")}
                </Label>
                <Input
                  id="address-city"
                  value={values.address.city}
                  onChange={(event) => updateAddressField("city", event.target.value)}
                  placeholder={t("employees.form.placeholders.city")}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-state" className="text-xs text-muted-foreground">
                  {t("employees.form.fields.state")}
                </Label>
                <Input
                  id="address-state"
                  value={values.address.state}
                  onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
                  placeholder={t("employees.form.placeholders.state")}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-zipcode" className="text-xs text-muted-foreground">
                  {t("employees.form.fields.zipcode")}
                </Label>
                <Input
                  id="address-zipcode"
                  value={values.address.zipcode}
                  onChange={(event) => updateAddressField("zipcode", event.target.value)}
                  placeholder={t("employees.form.placeholders.zipcode")}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-country" className="text-xs text-muted-foreground">
                  {t("employees.form.fields.country")}
                </Label>
                <Input
                  id="address-country"
                  value={values.address.country}
                  onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
                  placeholder={t("employees.form.placeholders.country")}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Phone} title={t("employees.form.sections.contact")}>
          <div className="space-y-2.5">
            <PhoneListEditor
              idPrefix="employee-phone"
              phones={values.phones}
              compact
              onChange={(phones) => updateField("phones", phones)}
            />

            <div className="space-y-1">
              <Label htmlFor="email">{t("employees.form.fields.email")}</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder={t("employees.form.placeholders.email")}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

        <FormFooter
          error={externalError || errors.startDate?.message || errors.endDate?.message || errors.name?.message || errors.department?.message || errors.title?.message || errors.branch?.message}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
        />
      </form>

      <EmployeeDepartmentDialog state={departmentEditor} />
      <EmployeeTitleDialog state={titleEditor} />

      <Dialog open={createUserOpen} onOpenChange={updateCreateUserOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle>
              {editingUser ? t("users.form.editTitle") : t("employees.dialogs.createUserTitle")}
            </DialogTitle>
            {!editingUser ? (
              <DialogDescription>{t("employees.dialogs.createUserDescription")}</DialogDescription>
            ) : null}
          </DialogHeader>
          <UserForm
            key={`${createUserOpen ? "open" : "closed"}-${editingUser?.id ?? "new"}`}
            initialValues={editingUser ? userToFormValues(editingUser) : createUserInitialValues}
            isEditing={Boolean(editingUser)}
            submitLabel={editingUser ? t("common.actions.saveChanges") : t("users.actions.add")}
            isSubmitting={createUserMutation.isPending || updateUserMutation.isPending}
            externalError={createUserError}
            onSubmit={editingUser ? saveUser : createUser}
            onCancel={() => updateCreateUserOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
