var background=function(){"use strict";var b,w;function v(t){return t==null||typeof t=="function"?{main:t}:t}const a=((w=(b=globalThis.browser)==null?void 0:b.runtime)==null?void 0:w.id)==null?globalThis.chrome:globalThis.browser,C=v(()=>{let t=null,i=!1;console.log("Background script is running.");const l=new Map,f=new Set;a.bookmarks.onCreated.addListener((o,e)=>{if(!e.url){console.log(`Folder created: ID=${o}, Title=${e.title}`);return}console.log(`Bookmark created: ID=${o}`),console.log(`Title: ${e.title}`),console.log(`URL: ${e.url}`),S(o)}),a.bookmarks.onChanged.addListener((o,e)=>{console.log(`Bookmark changed: ID=${o}`),console.log("Change Info:",e),B(o)}),a.bookmarks.onMoved.addListener((o,e)=>{if(console.log(`Bookmark moved: ID=${o}`),console.log("Move Info:",e),f.has(o)){console.log(`Bookmark ${o} move initiated by extension. Skipping reprocessing.`);return}B(o)});function S(o){l.has(o)&&clearTimeout(l.get(o).timerId);const e=setTimeout(()=>{F(o),l.delete(o)},1e3);l.set(o,{timerId:e,userInteracted:!1})}function B(o){const e=l.get(o);e&&(e.userInteracted=!0)}async function F(o){try{const[e]=await a.bookmarks.get(o);if(!e.url){console.log(`Bookmark ${o} is a folder or has no URL. Skipping.`);return}const r=l.get(o);if((r==null?void 0:r.userInteracted)||!1){console.log(`User interacted with bookmark ${o}. Skipping categorization.`);return}console.log(`Processing bookmark: ID=${o}`),console.log(`Final Title: ${e.title}`),console.log(`Final URL: ${e.url}`);const s=await j(e.title||"",e.url);console.log(`Categorized under: ${s}`),await y(o,s)}catch(e){console.error(`Error processing bookmark ${o}:`,e)}}async function y(o,e){try{const r=await M();if(!r){console.error("Parent folder ID not found.");return}let n;const s=await a.bookmarks.getChildren(r);for(const g of s)if(g.title===e&&!g.url){n=g.id;break}n||(n=(await a.bookmarks.create({parentId:r,title:e})).id,console.log(`Created new folder: ${e} (ID: ${n})`)),f.add(o),await a.bookmarks.move(o,{parentId:n}),console.log(`Moved bookmark to folder: ${e}`),f.delete(o);const[u]=await a.bookmarks.get(o);u.parentId===n?console.log("Bookmark moved successfully."):console.error("Bookmark move failed.")}catch(r){f.delete(o),console.error("Error in placeBookmarkInFolder:",r)}}async function M(){const[o]=await a.bookmarks.getTree(),e=o.children||[];for(const r of e)if(r.title==="Bookmarks Bar"||r.title==="Other Bookmarks")return r.id}a.runtime.onMessage.addListener(async(o,e,r)=>{if(o.action==="organizeBookmarks"){console.log("Organize Bookmarks action received.");try{await D(),a.runtime.sendMessage({action:"organizationComplete"})}catch(n){console.error("Error organizing all bookmarks:",n),a.runtime.sendMessage({action:"organizationError"})}}});async function D(){try{console.log("Starting to organize all bookmarks...");const o=Date.now(),e=await A(),r=e.length;let n=0;const s=25,u=[];for(let c=0;c<e.length;c+=s)u.push(e.slice(c,c+s));for(const c of u)try{const p=await L(c);for(let k=0;k<c.length;k++){const I=c[k],T=p[k];console.log(`Categorizing bookmark ID=${I.id} under ${T}`),await y(I.id,T),n++,console.log(`Processed ${n}/${r} bookmarks.`)}}catch(p){console.error("Error processing batch:",p)}const $=(Date.now()-o)/1e3;console.log(`Finished organizing all bookmarks in ${$} seconds.`),a.runtime.sendMessage({action:"organizationComplete",duration:$})}catch(o){console.error("Error organizing all bookmarks:",o),a.runtime.sendMessage({action:"organizationError"})}}async function A(){const o=await a.bookmarks.getTree(),e=[];return z(o,e),e}function z(o,e){for(const r of o)r.children?z(r.children,e):r.url&&e.push(r)}async function j(o,e){try{if(t!==null)try{const n=await a.tabs.get(t);(!n||n.status==="unloaded")&&(t=null,i=!1)}catch{t=null,i=!1}if(t===null){const n=await a.tabs.query({});if(!n||n.length===0)throw new Error("No tabs found.");for(const s of n)if(s.id!==void 0&&s.url&&s.url.startsWith("http"))try{t=s.id,i=!1,console.log(`added script in tab: ${s.url}`);break}catch{continue}if(t===null)throw new Error("No suitable tab found for injecting content script.")}i||(await a.scripting.executeScript({target:{tabId:t},files:["content-scripts/content.js"]}),i=!0);const r=await a.tabs.sendMessage(t,{action:"categorizeBookmarkAI",data:{title:o,url:e}});return r.success?(console.log(`AI categorized bookmark as: ${r.category}`),r.category):(console.error("AI categorization failed:",r.error),m(o,e))}catch(r){return console.error("Error in categorizeBookmark:",r),m()}}function m(o,e){return"Others"}async function L(o){const e=o.map(n=>n.title||"Untitled"),r=o.map(n=>n.url);try{return await P(e,r)}catch(n){return console.error("Error in categorizeBookmarksBatch:",n),o.map(()=>m())}}async function P(o,e){try{await U();const r=await a.tabs.sendMessage(t,{action:"categorizeBookmarkBatchAI",data:{titles:o,urls:e}});return r.success?(console.log("AI categorized batch successfully."),r.categories):(console.error("AI batch categorization failed:",r.error),o.map(()=>"Others"))}catch(r){return console.error("Error in categorizeBookmarkBatchInContentScript:",r),o.map(()=>"Others")}}async function U(){if(t!==null)try{const o=await a.tabs.get(t);(!o||o.status==="unloaded")&&(t=null,i=!1)}catch{t=null,i=!1}if(t===null){const o=await a.tabs.query({});if(!o||o.length===0)throw new Error("No tabs found.");for(const e of o)if(e.id!==void 0&&e.url&&e.url.startsWith("http"))try{t=e.id,i=!1,console.log(`Using tab ${e.id} (${e.url}) for categorization.`);break}catch{continue}if(t===null)throw new Error("No suitable tab found for injecting content script.")}i||(await a.scripting.executeScript({target:{tabId:t},files:["content-scripts/content.js"]}),i=!0,console.log("Content script injected."))}});function O(){}function d(t,...i){}const E={debug:(...t)=>d(console.debug,...t),log:(...t)=>d(console.log,...t),warn:(...t)=>d(console.warn,...t),error:(...t)=>d(console.error,...t)};let h;try{h=C.main(),h instanceof Promise&&console.warn("The background's main() function return a promise, but it must be synchronous")}catch(t){throw E.error("The background crashed on startup!"),t}return h}();
background;