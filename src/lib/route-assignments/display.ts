import { getEmployeeGroupById } from "@/lib/employee-groups/mock-data";
import { getEmployeeGroupBranchLabel } from "@/lib/employee-groups/display";
import { getTruckById } from "@/lib/trucks/mock-data";
import type { RouteAssignment } from "./types";

export function formatRouteAssignmentDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatRouteAssignmentTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function truncateRouteAssignmentId(routeAssignmentId: string): string {
  return routeAssignmentId.length > 12 ? `${routeAssignmentId.slice(0, 8)}…` : routeAssignmentId;
}

export function getTruckName(truckId: string): string {
  const truck = getTruckById(truckId);
  if (!truck) return "Unknown truck";
  return `${truck.name} (${truck.branch.toUpperCase()})`;
}

export function getEmployeeGroupLabel(employeeGroupId: string): string {
  const group = getEmployeeGroupById(employeeGroupId);
  if (!group) return "Unknown group";
  return `${group.employeeIds.length} employees · ${getEmployeeGroupBranchLabel(group.branch)} · ${group.createdBy}`;
}

export function formatRouteAssignmentCopyLabel(assignment: RouteAssignment): string {
  return `${assignment.name} · ${formatRouteAssignmentDate(assignment.date)} · ${getTruckName(assignment.truckId)}`;
}

export function routeAssignmentMatchesQuery(assignment: RouteAssignment, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    assignment.routeAssignmentId,
    assignment.name,
    assignment.date,
    assignment.createdBy,
    getTruckName(assignment.truckId),
    getEmployeeGroupLabel(assignment.employeeGroupId),
    formatRouteAssignmentDate(assignment.date),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeRouteAssignmentKpis(assignments: RouteAssignment[]) {
  const uniqueTrucks = new Set(assignments.map((assignment) => assignment.truckId)).size;
  const uniqueGroups = new Set(assignments.map((assignment) => assignment.employeeGroupId)).size;
  return {
    total: assignments.length,
    uniqueTrucks,
    uniqueGroups,
  };
}
