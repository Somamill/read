const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
test('lazy thumbnail requests observe a visible card even when the image placeholder is hidden',()=>{
 const dom=new JSDOM('<article class="article-card"><h3>A story</h3><img style="display:none" data-article-cover="7"></article>');try{
 const source=fs.readFileSync('Resources/Dashboard/articles.js','utf8'),code=source.slice(source.indexOf('function observeArticleCovers('));
 const seen=[],context={};vm.createContext(context);vm.runInContext(code,context);context.observeArticleCovers(dom.window.document,{disconnect(){seen.length=0},observe(node){seen.push(node)}});assert.equal(seen.length,1);assert.equal(seen[0].tagName,'ARTICLE');assert.equal(seen[0].querySelector('img').dataset.articleCover,'7');context.observeArticleCovers(dom.window.document,{disconnect(){seen.length=0},observe(node){seen.push(node)}});assert.equal(seen.length,1);
 }finally{dom.window.close()}
});
