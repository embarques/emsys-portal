import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,"../..");

function loadPicker(language){
 const messages=JSON.parse(fs.readFileSync(path.join(root,`src/locales/${language}/routes.json`),"utf8"));
 const t=(key,params={})=>{
  let value=key.replace(/^routes\./,"").split(".").reduce((node,part)=>node?.[part],messages)??key;
  for(const [name,text] of Object.entries(params))value=value.replace(`{{${name}}}`,text);
  return value;
 };
 const cache=new Map();
 function load(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const loadedModule={exports:{}};cache.set(filename,loadedModule);
  const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  function resolve(name){
   if(name==="@/lib/i18n")return{useTranslation:()=>({t})};
   if(name==="@/lib/utils")return{cn:(...args)=>args.filter(Boolean).join(" ")};
   if(name==="@/components/ui/button")return{Button:({children,...props})=>React.createElement("button",props,children)};
   if(name.startsWith("@/")){const base=path.join(root,"src",name.slice(2));return load(fs.existsSync(base+".ts")?base+".ts":base+".tsx");}
   return require(name);
  }
  new Function("require","module","exports",output)(resolve,loadedModule,loadedModule.exports);return loadedModule.exports;
 }
 return{...load(path.join(root,"src/components/route-manager/crew-role-picker.tsx")),messages};
}
function inputs(node,result=[]){if(!node||typeof node!=="object")return result;if(node.type==="input")result.push(node);React.Children.forEach(node.props?.children,child=>inputs(child,result));return result;}

for(const language of ["en","es"]){
 test(`${language}: daily-route Supervisor retains existing appraiser assignment semantics`,()=>{
  const{CrewRolePicker,messages}=loadPicker(language);const changes=[];
  const tree=CrewRolePicker({employees:[{id:7,name:"Crew member",role:"driver",roles:["driver","appraiser"]}],toggleLeadRoles:true,onRoleChange:(...args)=>changes.push(args)});
  const html=renderToStaticMarkup(tree);
  assert.match(html,/Supervisor/);assert.doesNotMatch(html,/Appraiser|Tasador/);
  const supervisor=inputs(tree).find(input=>input.props.id==="crew-role-7-appraiser");
  assert.equal(supervisor.props.checked,true);
  supervisor.props.onChange();assert.deepEqual(changes,[[7,"appraiser"]]);
  assert.equal(messages.columns.appraiser,"Supervisor");
  assert.equal(messages.filters.enums.crewRole.appraiser,"Supervisor");
  assert.equal(messages.activeRoute.appraiser,"Supervisor");
 });
}
