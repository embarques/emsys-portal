export function useAuth() {
  return {
    hasPermission: () =>
      !(window as unknown as { readOnly?: boolean }).readOnly,
  };
}
export function useAppSelector<T>(
  selector: (state: { auth: { companyId: string } }) => T,
): T {
  return selector({ auth: { companyId: "test-company" } });
}
export const getContainerLabelForInvoice = () => "CONT-123";
