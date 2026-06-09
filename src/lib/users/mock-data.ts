import type { User } from "./types";

export const MOCK_USERS: User[] = [
  {
    id: 1,
    uid: "mock-admin-uid",
    userName: "admin",
    password: "",
    fullName: "Admin User",
    active: true,
    role: {
      id: 1,
      name: "Administrador",
      active: true,
      permissions: [],
      createdAt: "2024-01-01T08:00:00Z",
      updatedAt: "2026-05-01T10:00:00Z",
    },
    branch: { id: 1, name: "USA", code: "NY" },
    startTime: "",
    endTime: "",
    email: "admin@emsys.example",
    createdAt: "2024-01-01T08:00:00Z",
    updatedAt: "2026-05-01T10:00:00Z",
    user: "admin",
    accessCode: 0,
    type: "",
  },
];

export function cloneUsers(): User[] {
  return structuredClone(MOCK_USERS);
}

export function getUserById(userId: number): User | undefined {
  return MOCK_USERS.find((user) => user.id === userId);
}
