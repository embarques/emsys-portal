"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ApplicationLoader } from "@/components/app-shell/application-loader";

import { useAuth } from "@/lib/auth/hooks/use-auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <ApplicationLoader stage="session" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
