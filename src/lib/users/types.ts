import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";

export type UserBranch = "usa" | "dr";
export type UserStatus = "active" | "inactive";
export type UserRole = "admin" | "user" | "manager" | "viewer";
export type UserLanguage = "en" | "es";

export type User = {
  userId: string;
  username: string;
  password: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  language: UserLanguage;
  branch: UserBranch;
  email: string;
  phone: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type UserFormValues = {
  userId: string;
  username: string;
  password: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  language: UserLanguage;
  branch: UserBranch;
  email: string;
  phone: string;
  createdBy: string;
};

export type UserFilterState = {
  query: string;
  branch: UserBranch | "all";
  status: UserStatus | "all";
  role: UserRole | "all";
};

export const USER_BRANCHES: { value: UserBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const USER_STATUSES: { value: UserStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "user", label: "User" },
  { value: "viewer", label: "Viewer" },
];

export const USER_LANGUAGES: { value: UserLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
];

export function createUserId(): string {
  return createRecordId();
}

export function createEmptyUserForm(createdBy = DEFAULT_CREATED_BY): UserFormValues {
  return {
    userId: createUserId(),
    username: "",
    password: "",
    name: "",
    status: "active",
    role: "user",
    language: "en",
    branch: "usa",
    email: "",
    phone: "",
    createdBy,
  };
}

export function userToFormValues(user: User): UserFormValues {
  return {
    userId: user.userId,
    username: user.username,
    password: "",
    name: user.name,
    status: user.status,
    role: user.role,
    language: user.language,
    branch: user.branch,
    email: user.email,
    phone: user.phone,
    createdBy: user.createdBy,
  };
}

export function formValuesToUser(
  values: UserFormValues,
  existingPassword?: string,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): User {
  if (!values.username.trim()) {
    throw new Error("Username is required.");
  }

  if (!values.name.trim()) {
    throw new Error("Name is required.");
  }

  const password = values.password.trim() || existingPassword;
  if (!password) {
    throw new Error("Password is required.");
  }

  return {
    userId: values.userId,
    username: values.username.trim(),
    password,
    name: values.name.trim(),
    status: values.status,
    role: values.role,
    language: values.language,
    branch: values.branch,
    email: values.email.trim(),
    phone: values.phone.trim(),
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function maskPassword(_password: string): string {
  return "••••••••";
}
