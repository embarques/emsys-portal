"use client";

import { Building2, MapPin, Phone, User as UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { UserForm } from "@/components/users/user-form";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { createSecondaryFirebaseUser } from "@/lib/auth/firebase/firebase-user-admin";
import { useTranslation } from "@/lib/i18n";
import { useEmployeeLabels } from "@/lib/employees/hooks/use-employee-labels";
import { useCreateUser, useUpdateUser, useUsers } from "@/lib/users/hooks/use-users";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { createEmptyUserForm, type User, type UserFormValues, userToFormValues } from "@/lib/users/types";
import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_PORTAL_BRANCHES,
  EMPLOYEE_TITLES,
  createEmployeeBranchFromPortal,
  createEmptyEmployeeForm,
  getEmployeePortalBranch,
  type EmployeeAddress,
  type EmployeeFormValues,
  type EmployeePortalBranch,
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
  const employeeLabels = useEmployeeLabels();
  const usersQuery = useUsers({ page: 1, limit: 200, sort: "name:asc", active: true });
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const [values, setValues] = useState<EmployeeFormValues>(initialValues ?? createEmptyEmployeeForm());
  const [manualAddressEntry, setManualAddressEntry] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyEmployeeForm());
    setManualAddressEntry(false);
  }, [initialValues]);

  const departmentOptions = useMemo(() => {
    const departments = Array.from(new Set([...EMPLOYEE_DEPARTMENTS, values.department].filter(Boolean)));
    return departments.map((department) => ({
      value: department,
      label: employeeLabels.department(department),
    }));
  }, [employeeLabels, values.department]);

  const titleOptions = useMemo(() => {
    const titles = Array.from(new Set([...EMPLOYEE_TITLES, values.title].filter(Boolean)));
    return titles.map((title) => ({
      value: title,
      label: employeeLabels.title(title),
    }));
  }, [employeeLabels, values.title]);

  const activeOptions = useMemo(
    () => [
      { value: "true", label: t("employees.enums.status.active") },
      { value: "false", label: t("employees.enums.status.inactive") },
    ],
    [t],
  );

  const branchOptions = useMemo(
    () =>
      EMPLOYEE_PORTAL_BRANCHES.map((option) => ({
        value: option.portal,
        label: t(`employees.enums.branch.${option.portal}`),
      })),
    [t],
  );
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

  const selectedPortalBranch = getEmployeePortalBranch({ branch: values.branch, address: values.address });

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAddressField<K extends keyof EmployeeAddress>(key: K, value: EmployeeAddress[K]) {
    setValues((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  function applyPlaceToAddress(place: ParsedPlaceAddress) {
    setValues((current) => ({
      ...current,
      address: {
        ...current.address,
        address1: place.address1 || current.address.address1,
        city: place.city || current.address.city,
        state: place.state || current.address.state,
        zipcode: place.zipcode || current.address.zipcode,
        country: place.country || current.address.country,
      },
    }));
  }

  function updateBranchPortal(portal: EmployeePortalBranch) {
    const template = createEmployeeBranchFromPortal(portal);
    const config = EMPLOYEE_PORTAL_BRANCHES.find((entry) => entry.portal === portal) ?? EMPLOYEE_PORTAL_BRANCHES[0];

    setValues((current) => ({
      ...current,
      branch: template,
      address: {
        ...current.address,
        country: config.country,
      },
    }));
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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody isBusy={isSubmitting}>
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
                  <Label htmlFor="department">
                    {t("employees.form.fields.department")} <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    id="department"
                    value={values.department}
                    onValueChange={(next) => updateField("department", next)}
                    searchPlaceholder={t("employees.form.placeholders.departmentSearch")}
                    required
                    options={departmentOptions}
                    mobileSheet
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="title">
                    {t("employees.form.fields.title")} <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    id="title"
                    value={values.title}
                    onValueChange={(next) => updateField("title", next)}
                    searchPlaceholder={t("employees.form.placeholders.titleSearch")}
                    required
                    options={titleOptions}
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
                  <Input
                    id="startDate"
                    value={values.startDate}
                    onChange={(event) => updateField("startDate", event.target.value)}
                    placeholder={t("employees.form.placeholders.startDate")}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="endDate">{t("employees.form.fields.endDate")}</Label>
                  <Input
                    id="endDate"
                    value={values.endDate}
                    onChange={(event) => updateField("endDate", event.target.value)}
                    placeholder={t("employees.form.placeholders.endDate")}
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
                value={selectedPortalBranch}
                onValueChange={(next) => updateBranchPortal(next as EmployeePortalBranch)}
                searchPlaceholder={t("employees.form.placeholders.branchSearch")}
                required
                options={branchOptions}
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
          error={externalError}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
        />
      </form>

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
