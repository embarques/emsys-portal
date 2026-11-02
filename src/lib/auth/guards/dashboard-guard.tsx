"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ApplicationLoader } from "@/components/app-shell/application-loader";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { permissionForPath } from "@/lib/auth/page-permissions";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
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
    return <ApplicationLoader stage={loading ? "session" : "access"} />;
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
          <h1 className="text-2xl font-bold tracking-tight">{t("shell.accessDenied.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("shell.accessDenied.description")}
          </p>
          <Button type="button" onClick={() => void handleLogout()}>
            {t("shell.profileMenu.logOut")}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
