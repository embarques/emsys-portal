import type { RouteAssignment } from "./types";

export const MOCK_ROUTE_ASSIGNMENTS: RouteAssignment[] = [
  {
    id: "665f2a1b3c4d5e6f7a8b9d01",
    routeAssignmentId: "ras-001",
    name: "Brooklyn morning run",
    date: "2026-06-04T00:00:00Z",
    truck: { id: "665f1a2b3c4d5e6f7a8b9c0d", name: "Unit 12 — Freightliner" },
    employeeGroup: { id: "egr-001", name: "egr-001 · USA · 3 employees" },
    createdAt: "2026-06-03T18:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    id: "665f2a1b3c4d5e6f7a8b9d02",
    routeAssignmentId: "ras-002",
    name: "Doral warehouse shuttle",
    date: "2026-06-03T00:00:00Z",
    truck: { id: "665f1a2b3c4d5e6f7a8b9c0f", name: "Unit 04 — Ford Transit" },
    employeeGroup: { id: "egr-002", name: "egr-002 · DR · 2 employees" },
    createdAt: "2026-06-02T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    id: "665f2a1b3c4d5e6f7a8b9d03",
    routeAssignmentId: "ras-003",
    name: "Santo Domingo delivery team",
    date: "2026-06-02T00:00:00Z",
    truck: { id: "665f1a2b3c4d5e6f7a8b9c10", name: "Unit 15 — Kenworth T680" },
    employeeGroup: { id: "egr-003", name: "egr-003 · DR · 4 employees" },
    createdAt: "2026-06-01T10:15:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    id: "665f2a1b3c4d5e6f7a8b9d04",
    routeAssignmentId: "ras-004",
    name: "Cross-branch support",
    date: "2026-06-01T00:00:00Z",
    truck: { id: "665f1a2b3c4d5e6f7a8b9c0e", name: "Unit 08 — Isuzu NPR" },
    employeeGroup: { id: "egr-004", name: "egr-004 · USA · 2 employees" },
    createdAt: "2026-05-31T09:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
];

export function cloneRouteAssignments(): RouteAssignment[] {
  return MOCK_ROUTE_ASSIGNMENTS.map((assignment) => ({
    ...assignment,
    truck: { ...assignment.truck },
    employeeGroup: { ...assignment.employeeGroup },
  }));
}

export function getRouteAssignmentById(routeAssignmentId: string): RouteAssignment | undefined {
  return MOCK_ROUTE_ASSIGNMENTS.find((assignment) => assignment.routeAssignmentId === routeAssignmentId);
}

export function getRouteAssignmentByRecordId(id: string): RouteAssignment | undefined {
  return MOCK_ROUTE_ASSIGNMENTS.find((assignment) => assignment.id === id);
}
