import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require=createRequire(import.meta.url);
const source=ts.transpileModule(fs.readFileSync(new URL("../../src/components/accounting/daily-income-workspace.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(canStart=true){
 const query={data:null,isLoading:false,isError:false};
 const block=({children})=>React.createElement("div",null,children);
 const special={
  useTranslation:()=>({t:(key)=>key}),
  useStartTransaction:()=>({canStart,isPending:false,setupOpen:false,error:null,start:()=>{}}),
  useAuth:()=>({hasPermission:()=>false}),
  useFeedback:()=>({}),
  useWorkspaceTabs:()=>({isDesktopTabs:true}),
  useTablePageSize:()=>({page:1,pageSize:20,pageLimit:20,rememberTotal:()=>{}}),
  useApiTableColumns:()=>({columns:[]}),
  useTableSelectionReset:()=>{},
  Button:({children,disabled})=>React.createElement("button",{disabled},children),
  Card:block,CardContent:block,CardHeader:block,CardTitle:block,Badge:block,Label:block,
 };
 const loaded={exports:{}};
 new Function("require","module","exports",source)((name)=>{
  if(!name.startsWith("@/"))return require(name);
  return new Proxy({}, {get:(_,key)=>special[key] ?? (key.startsWith("use")?()=>query:key[0]===key[0].toUpperCase()?()=>null:()=>"")});
 },loaded,loaded.exports);
 return renderToStaticMarkup(React.createElement(loaded.exports.DailyIncomeWorkspace));
}
test("desktop and mobile Add transaction buttons remain available without a closeout",()=>{
 const html=render();
 const buttons=(html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []).filter((button)=>button.includes("accounting.dailyIncome.actions.addTransaction"));
 assert.equal(buttons.length,2);
 for(const button of buttons)assert.doesNotMatch(button,/disabled/);
});
test("Add transaction respects permission gating without a closeout",()=>{
 const html=render(false);
 const buttons=(html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []).filter((button)=>button.includes("accounting.dailyIncome.actions.addTransaction"));
 assert.equal(buttons.length,2);
 for(const button of buttons)assert.match(button,/disabled/);
});
