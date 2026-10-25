const auth={companyId:"fixture-company",user:{uid:"fixture-user"},loading:false,roleLoading:false,email:"fixture@example.test",hasPermission:(name:string)=>["canViewInvoice","canViewClient","canViewUser"].includes(name),hasAnyPermission:()=>true};
export function useAuth(){return auth;}
