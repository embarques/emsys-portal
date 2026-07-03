import type { User } from "./types";

export const MOCK_USERS: User[] = [
  {
    id: 1,
    uid: "mock-admin-uid",
    name: "Admin User",
    active: true,
    role: {
      id: 1,
      name: "Administrador",
    },
    branch: { id: 1, code: "USA", name: "USA" },
    startTime: "",
    endTime: "",
    email: "admin@emsys.example",
    createdAt: "2024-01-01T08:00:00Z",
    updatedAt: "2026-05-01T10:00:00Z",
    createdBy: null,
    updatedBy: null,
  },
];

export function cloneUsers(): User[] {
  return structuredClone(MOCK_USERS);
}

export function getUserById(userId: number): User | undefined {
  return MOCK_USERS.find((user) => user.id === userId);
}
