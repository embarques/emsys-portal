type Filter={field?:string;operator?:string;value?:unknown;filters?:Filter[]};
const records=Array.from({length:120},(_,i)=>({id:(i+1).toString(16).padStart(24,"0"),number:`MOBILE-${String(i+1).padStart(3,"0")}`,date:"2026-10-24T00:00:00Z",cost:10,payment:i%2?10:0,balance:i%2?undefined:10,paidStatus:i%2?"CLOSED":"OPEN",registration:i%10?"COMPLETED":"PENDING",sender:{name:i%3?"Sender Beta":"Sender Alpha",phones:[]},receiver:{name:i%2?"Receiver Two":"Receiver One",phones:[]},invoiceDetails:[]}));
function match(record:Record<string,unknown>,filter:Filter):boolean{
 if(filter.filters)return filter.operator==="or"?filter.filters.some(f=>match(record,f)):filter.filters.every(f=>match(record,f));
 const value=filter.field?.split(".").reduce<unknown>((v,key)=>(v as Record<string,unknown>)?.[key],record);
 if(filter.operator==="contains")return String(value??"").toLowerCase().includes(String(filter.value).toLowerCase());
 if(filter.operator==="neq")return value!==filter.value;
 if(filter.operator==="gt")return Number(value)>Number(filter.value);
 return value===filter.value;
}
async function request(url:string,body?:Filter){
 const parsed=new URL(url,"http://fixture");
 if(!parsed.pathname.startsWith("/invoices"))return {success:true,data:[],total:0};
 const page=Number(parsed.searchParams.get("page")||1),limit=Number(parsed.searchParams.get("limit")||50);
 const rows=body?records.filter(r=>match(r,body)):records;
 const diagnostics=document.getElementById("requests");if(diagnostics)diagnostics.textContent=JSON.stringify({url,body});
 if(page===2&&limit===50&&document.documentElement.dataset.failOlder==="true"){document.documentElement.dataset.failOlder="false";throw new Error("Older invoices unavailable");}
 return {success:true,data:rows.slice((page-1)*limit,page*limit),total:rows.length,page,resultsPerPage:limit};
}
export const apiClient={get:(url:string)=>request(url),post:(url:string,body:Filter)=>request(url,body),put:()=>Promise.reject(new Error("Mutations disabled in fixture")),delete:()=>Promise.reject(new Error("Mutations disabled in fixture"))};
