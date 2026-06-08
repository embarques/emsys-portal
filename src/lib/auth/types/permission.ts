export type Permission = {
  name: string;
  resourceType: string;
};

export type RoleSummary = {
  id: number | string;
  name: string;
};

export type UserPermissionsResponse = {
  role: RoleSummary;
  permissions: Permission[];
};
