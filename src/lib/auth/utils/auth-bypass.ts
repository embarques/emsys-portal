/**
 * Dev-only auth bypass: skips the Firebase login UI and uses a cached dev session
 * (sessionStorage + optional env) with a real API idToken.
 *
 * Enabled only when **both**:
 * - `NODE_ENV === 'development'`
 * - `NEXT_PUBLIC_BYPASS_AUTH=true`
 */
export function isAuthBypassEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH !== "true") {
    return false;
  }
  return process.env.NODE_ENV === "development";
}
