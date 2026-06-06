import type { RouteAssignment } from "./types";

export const MOCK_ROUTE_ASSIGNMENTS: RouteAssignment[] = [
  {
    routeAssignmentId: "ras-001",
    name: "Brooklyn morning run",
    date: "2026-06-04",
    truckId: "trk-001",
    employeeGroupId: "egr-001",
    createdAt: "2026-06-03T18:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    routeAssignmentId: "ras-002",
    name: "Doral warehouse shuttle",
    date: "2026-06-03",
    truckId: "trk-003",
    employeeGroupId: "egr-002",
    createdAt: "2026-06-02T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    routeAssignmentId: "ras-003",
    name: "Santo Domingo delivery team",
    date: "2026-06-02",
    truckId: "trk-004",
    employeeGroupId: "egr-003",
    createdAt: "2026-06-01T10:15:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    routeAssignmentId: "ras-004",
    name: "Cross-branch support",
    date: "2026-06-01",
    truckId: "trk-002",
    employeeGroupId: "egr-004",
    createdAt: "2026-05-31T09:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
];

export function cloneRouteAssignments(): RouteAssignment[] {
  return MOCK_ROUTE_ASSIGNMENTS.map((assignment) => ({ ...assignment }));
}

export function getRouteAssignmentById(routeAssignmentId: string): RouteAssignment | undefined {
  return MOCK_ROUTE_ASSIGNMENTS.find((assignment) => assignment.routeAssignmentId === routeAssignmentId);
}
