export function useAuth() {
 return {companyId: "test-company", hasPermission: (name: string) => name === "canViewJournal" || (name === "canReconcileJournal" && !(window as unknown as {readOnly:boolean}).readOnly)};
}
export function useAccountingQueryEnabled() {return true;}

export function useAppSelector<T>(selector: (state: {auth: {idToken: string; companyId: string}}) => T): T {
 return selector({auth:{idToken:"fixture-token",companyId:"test-company"}});
}
