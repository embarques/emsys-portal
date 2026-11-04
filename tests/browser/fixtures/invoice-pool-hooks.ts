declare global { interface Window { poolDenied?: boolean; poolUsersDenied?: boolean; poolUsersError?: boolean; poolReads?: number; poolWrites?: unknown[]; poolLoseAck?: boolean; } }
import translations from "../../../src/locales/en/invoices.json";
export function useAuth() { return {companyId:"company-a",user:{uid:"user-a"},loading:false,roleLoading:false,hasPermission:(permission: string)=>!window.poolDenied && !(window.poolUsersDenied && permission === "canViewUser")}; }
export function useAppSelector(selector: (state: {auth:{companyId:string;idToken:string}})=>unknown) { return selector({auth:{companyId:"company-a",idToken:"fixture"}}); }
export function useTranslation() { return {t:(key:string)=>{
 let value:unknown=translations;
 for(const part of key.split(".").slice(1)){if(!value || typeof value!=="object")return key;value=(value as Record<string,unknown>)[part];}
 return typeof value==="string"?value:key;
}}; }
export function normalizeApiError(error: Error) { return {message:error.message}; }
export async function fetchUsers() { if(window.poolUsersError) throw Error("User lookup unavailable"); return {items:[{id:3,name:"Ada User",email:"ada@example.test",active:true}],total:1}; }
const rows=[
 {id:"68f800000000000000000001",number:"INV-100",claimed:false,allocation:{userId:0,token:"available-v1"}},
 {id:"68f800000000000000000002",number:"INV-101",claimed:false,allocation:{userId:3,token:"assigned-v1"}},
 {id:"68f800000000000000000003",number:"INV-102",claimed:true,allocation:{userId:3,token:"claimed-v1"}},
];
export const apiClient={
 get:async()=>{window.poolReads=(window.poolReads??0)+1;return {success:true,data:{items:rows,remaining:3,lowThreshold:10}};},
 post:async(url:string,request:unknown)=>{window.poolWrites??=[];window.poolWrites.push(request);if(window.poolLoseAck&&window.poolWrites.length===1)throw Error("Connection lost");return {success:true,data:rows};},
};
