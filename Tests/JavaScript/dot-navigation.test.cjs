const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),vm=require('node:vm');
function dashboard(preference){
 const dom=new JSDOM(fs.readFileSync('Resources/Dashboard/index.html','utf8'),{url:'https://read.test/',runScripts:'outside-only'});
 const messages=[], listeners=[];
 dom.window.webkit={messageHandlers:{dashboard:{postMessage:value=>messages.push(value)}}};
 dom.window.matchMedia=()=>({matches:false,addEventListener:(_,handler)=>listeners.push(handler)});
 dom.window.IntersectionObserver=class{observe(){} disconnect(){}};
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 if(preference)dom.window.localStorage.setItem('shelfAppearance',preference);
 try{for(const name of ['reading-views.js','app.js','articles.js','discovery-reading.js','command-menu.js'])vm.runInContext(fs.readFileSync('Resources/Dashboard/'+name,'utf8'),dom.getInternalVMContext(),{filename:name});}catch(error){dom.window.close();throw error;}
 return {dom,messages,listeners};
}
test('all dashboard modules initialize and keep secondary destinations reachable',()=>{
 const {dom,messages}=dashboard();try{
 const doc=dom.window.document;
 assert.equal(doc.querySelectorAll('.taskbar-more').length,1);
 const primary=[...doc.querySelectorAll('.taskbar a:not([data-secondary-nav])')].map(x=>x.dataset.page);
 assert.deepEqual(primary.sort(),['articles','books','discover','highlights']);
 for(const page of ['services','activity','setup','updates','statistics','integrations','review','preferences','studio']){
  assert.ok(doc.getElementById(page),page);
  const link=doc.querySelector(`.taskbar [data-page="${page}"]`);assert.ok(link,page);assert.ok(link.hasAttribute('data-secondary-nav'),page);
 }
 doc.querySelector('.taskbar-more').click();assert.equal(messages.at(-1).type,'showNavigationMenu');
 doc.querySelector('.taskbar [data-page="setup"]').click();assert.ok(doc.getElementById('setup').classList.contains('visible'));
 }finally{dom.window.close()}
});
test('system appearance follows changes while existing OLED and Bright choices remain explicit',()=>{
 for(const choice of ['system','oled','bright','dark']){
 const {dom,listeners}=dashboard(choice);try{
  assert.equal(dom.window.document.documentElement.dataset.appearance,choice);
  assert.equal(dom.window.document.documentElement.dataset.theme,['oled','dark'].includes(choice)?'dark':'light');
  vm.runInContext('systemAppearance.matches=true',dom.getInternalVMContext());listeners[0]();
  assert.equal(dom.window.document.documentElement.dataset.theme,choice==='bright'?'light':'dark');
 }finally{dom.window.close()}
 }
});

test('saved views, bulk selection and command navigation work without a cloud account',()=>{
 const {dom,messages}=dashboard();try{
  const doc=dom.window.document,view={id:'a'.repeat(32),name:'Quick science',query:'tag:science read:<10'};
  dom.window.articleData({ok:true,views:[view],feeds:[],items:[{id:1,title:'A science essay',author:'Writer',status:'inbox',tags:'science',characters:1200,saved:Date.now()/1000,document_type:'article',fetched:1},{id:2,title:'Another essay',status:'inbox',tags:'other',characters:20000,saved:Date.now()/1000}]});
  doc.querySelector('[data-reading-view]').click();assert.equal(doc.querySelectorAll('[data-article-card]').length,1);
  doc.getElementById('toggleArticleSelection').click();doc.querySelector('[data-select-shown]').click();doc.querySelector('[data-bulk-status="archive"]').click();
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1))),{type:'articles',action:'bulk',ids:[1],status:'archive'});
  dom.window.readOpenCommandMenu();assert.ok(doc.querySelector('.command-dialog').open);
  const input=doc.getElementById('commandQuery');input.value='Quick science';input.dispatchEvent(new dom.window.Event('input'));
  assert.match(doc.getElementById('commandResults').textContent,/Quick science/);
  const result=[...doc.querySelectorAll('[data-command]')].find(x=>x.textContent.includes('Saved reading view'));result.click();assert.equal(doc.querySelector('.command-dialog').open,false);
  dom.window.readOpenCommandMenu();input.value='Articles';input.dispatchEvent(new dom.window.Event('input'));input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.ok(doc.getElementById('articles').classList.contains('visible'));assert.equal(doc.querySelector('.command-dialog').open,false);
 }finally{dom.window.close()}
});
