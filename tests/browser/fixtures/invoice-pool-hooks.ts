declare global { interface Window { poolDenied?: boolean; poolUsersDenied?: boolean; poolUsersError?: boolean; poolQueries?: Array<{q?:string;after?:string;userId?:number}>; poolSearches?: unknown[]; poolReads?: number; poolUserQueries?: string[]; poolWrites?: unknown[]; poolLoseAck?: boolean; } }
import translations from "../../../src/locales/en/invoices.json";
import tableFields from "../../../src/locales/en/table-fields.json";
import common from "../../../src/locales/en/common.json";
export function useAuth() { return {companyId:"company-a",user:{uid:"user-a"},loading:false,roleLoading:false,hasPermission:(permission: string)=>!window.poolDenied && !(window.poolUsersDenied && permission === "canViewUser")}; }
export function useAppSelector(selector: (state: {auth:{companyId:string;idToken:string}})=>unknown) { return selector({auth:{companyId:"company-a",idToken:"fixture"}}); }
export function useTranslation() { return {t:(key:string, params: Record<string, string | number> = {})=>{
 let value:unknown=key.startsWith("tableFields.") ? tableFields : key.startsWith("common.") ? common : translations;
 for(const part of key.split(".").slice(1)){if(!value || typeof value!=="object")return key;value=(value as Record<string,unknown>)[part];}
 return typeof value==="string"?value.replace(/\{\{(\w+)\}\}/g, (match, name) => String(params[name] ?? match)):key;
}}; }
export function normalizeApiError(error: Error) { return {message:error.message}; }
export async function fetchUsers(params: {search?: {value: string}} = {}) {
 window.poolUserQueries ??= []; window.poolUserQueries.push(params.search?.value ?? "");
 if(window.poolUsersError) throw Error("User lookup unavailable");
 const user = params.search?.value === "Grace" ? {id:41,name:"Grace User",email:"grace@example.test",active:true} : {id:3,name:"Ada User",email:"ada@example.test",active:true};
 return {items:[user],total:1};
}
const rows=[
 {id:"68f800000000000000000001",number:"INV-100",receivedAt:"2026-11-07T15:30:00Z",claimed:false,allocation:{userId:0,token:"available-v1"}},
 {id:"68f800000000000000000002",number:"INV-101",receivedAt:null,claimed:false,allocation:{userId:3,token:"assigned-v1"}},
 {id:"68f800000000000000000003",number:"INV-102",claimed:true,allocation:{userId:3,token:"claimed-v1"}},
];
export const apiClient={
 get:async(_url:string, options:{params:{q?:string;after?:string;userId?:number}})=>{
 if (!_url.includes("/invoices/reserved")) return {success:true,data:[]};
 window.poolReads=(window.poolReads??0)+1;window.poolQueries??=[];window.poolQueries.push(options.params);
 const params=options.params;
 const filtered=rows.filter(row=>(params.userId===undefined||row.allocation.userId===params.userId)&&(!params.q||row.number.toLowerCase().includes(params.q.toLowerCase())));
 return {success:true,data:{items:filtered,remaining:filtered.length,lowThreshold:10}};
 },
 post:async(url:string,request:unknown)=>{
 if (url === "/invoices/reserved/search") {
  window.poolSearches ??= []; window.poolSearches.push(request);
  return {success:true,data:{items:rows.filter(row => matches(row, request as FilterNode)),remaining:rows.filter(row => matches(row, request as FilterNode)).length,lowThreshold:10}};
 }
 if (!url.includes("/invoices/reserved")) return {success:true,data:[]};
 window.poolWrites??=[];window.poolWrites.push(request);if(window.poolLoseAck&&window.poolWrites.length===1)throw Error("Connection lost");return {success:true,data:rows};
 },
};
type FilterNode = {operator:string;filters?:FilterNode[];field?:string;value?:unknown};
function matches(row: typeof rows[number], node: FilterNode): boolean {
 if (node.filters) return node.operator === "or" ? node.filters.some(child => matches(row, child)) : node.filters.every(child => matches(row, child));
 const actual = node.field === "number" ? row.number : node.field === "receivedAt" ? ("receivedAt" in row ? row.receivedAt : undefined) : node.field === "claimed" ? row.claimed : row.allocation.userId;
 if (node.operator === "eq") return actual === node.value;
 if (node.operator === "neq") return actual !== node.value;
 if (node.operator === "contains") return String(actual).toLowerCase().includes(String(node.value).toLowerCase());
 if (node.operator === "startsWith") return String(actual).toLowerCase().startsWith(String(node.value).toLowerCase());
 throw Error("Unexpected fixture operator: " + node.operator);
}
