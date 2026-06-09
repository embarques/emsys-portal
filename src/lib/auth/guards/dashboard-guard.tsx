"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { permissionForPath } from "@/lib/auth/page-permissions";
import { Button } from "@/components/ui/button";

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    loading,
    permissionsLoading,
    isAuthenticated,
    hasPermission,
    signOut,
  } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading || permissionsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const requiredPermission = permissionForPath(pathname);
  const canViewPage =
    !requiredPermission ||
    hasPermission(requiredPermission.name, requiredPermission.resourceType);

  if (!canViewPage) {
    const handleLogout = async () => {
      await signOut();
      router.replace("/login");
    };

    return (
      <div className="flex h-screen items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view this page.
          </p>
          <Button type="button" onClick={() => void handleLogout()}>
            Log out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
