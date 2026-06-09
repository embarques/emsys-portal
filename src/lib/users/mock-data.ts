import type { User } from "./types";

export const MOCK_USERS: User[] = [
  {
    userId: "1",
    uid: "mock-admin-uid",
    username: "admin",
    password: "",
    name: "Admin User",
    status: "active",
    roleId: 1,
    roleName: "Administrador",
    language: "en",
    branch: "usa",
    branchCode: "NY",
    email: "admin@emsys.example",
    phone: "+1 (212) 555-0100",
    createdAt: "2024-01-01T08:00:00Z",
    createdBy: "System",
    updatedAt: "2026-05-01T10:00:00Z",
  },
];

export function cloneUsers(): User[] {
  return structuredClone(MOCK_USERS);
}

export function getUserById(userId: string): User | undefined {
  return MOCK_USERS.find((user) => user.userId === userId);
}
