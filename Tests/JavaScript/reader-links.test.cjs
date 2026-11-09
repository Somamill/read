const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
function reader(html){const dom=new JSDOM(html,{url:'file:///local/reader/index.html',runScripts:'outside-only'}),messages=[];dom.window.webkit={messageHandlers:{reader:{postMessage:x=>messages.push(x)}}};dom.window.eval(fs.readFileSync('Resources/Dashboard/reader-links.js','utf8'));return {dom,messages}}
test('a newsletter button stays internal, including target blank, and keeps its book heading',()=>{
 const {dom,messages}=reader('<h3>Moral Letters to Lucilius</h3><p><a target="_blank" href="https://readwise.io/reader/fd/123"><span>Add EPUB to Reader</span></a></p><h3>Next item</h3>');
 try{const event=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});dom.window.document.querySelector('span').dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(messages.length,1);assert.equal(messages[0].type,'link');assert.equal(messages[0].title,'Moral Letters to Lucilius')}finally{dom.window.close()}
});
test('contents anchors and right-click menus keep their normal behavior',()=>{
 const {dom,messages}=reader('<a href="#chapter">Contents</a><h2 id="chapter">Chapter</h2><a href="https://example.org/article">Article</a>');
 try{const anchors=dom.window.document.querySelectorAll('a');let event=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});anchors[0].dispatchEvent(event);assert.equal(event.defaultPrevented,false);event=new dom.window.MouseEvent('auxclick',{bubbles:true,cancelable:true,button:2});anchors[1].dispatchEvent(event);assert.equal(event.defaultPrevented,false);assert.equal(messages.length,0)}finally{dom.window.close()}
});
