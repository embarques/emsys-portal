"use client";

import { DevLoginForm } from "@/components/auth/dev-login-form";
import { LoginForm } from "@/components/auth/login-form";
import { isAuthBypassEnabled } from "@/lib/auth/utils/auth-bypass";

export default function LoginPage() {
  if (isAuthBypassEnabled()) {
    return <DevLoginForm />;
  }

  return <LoginForm />;
}
