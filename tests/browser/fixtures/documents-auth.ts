export function useAuth() {
  return {
    hasPermission: (name?: string) => {
      const fixture = window as unknown as { readOnly?: boolean; denyClearance?: boolean };
      return !fixture.readOnly && !(name === "canClearJournal" && fixture.denyClearance);
    },
  };
}
export function useAppSelector<T>(
  selector: (state: { auth: { companyId: string } }) => T,
): T {
  return selector({ auth: { companyId: "test-company" } });
}
export const getContainerLabelForInvoice = () => "CONT-123";
