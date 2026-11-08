const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
function extractor(){
 const dom=new JSDOM('<!doctype html><html></html>',{url:'https://example.org/',runScripts:'outside-only'});
 for(const file of ['Vendor/Readability.js','Vendor/purify.min.js','article-extraction.js'])dom.window.eval(fs.readFileSync('Resources/Dashboard/'+file,'utf8'));
 return dom;
}
test('real Readability extracts article text without executing scripts or keeping tracking images',()=>{
 const dom=extractor();
 try{
  const result=dom.window.extractSavedArticle('<!doctype html><html lang="ja"><head><title>A quieter way to read</title><meta name="author" content="A Writer"></head><body><nav>Navigation</nav><article><h1>A quieter way to read</h1><p>'+('A long original paragraph about attention, reading, and keeping useful notes. '.repeat(20))+'</p><h2>日本語の見出し</h2><p>Read at your own pace.</p><script>window.untrustedExecuted=true</script><img src="https://tracker.test/a"><a onclick="bad()" href="javascript:bad()">Unsafe</a></article></body></html>','https://example.org/essay');
  assert.equal(result.title,'A quieter way to read');assert.equal(result.author,'A Writer');
  assert.match(result.content,/日本語の見出し/);assert.equal(dom.window.untrustedExecuted,undefined);
  assert.doesNotMatch(result.content,/<script|<img|onclick|javascript:/i);
 }finally{dom.window.close()}
});
test('an empty/login-only page fails visibly instead of saving an empty article',()=>{
 const dom=extractor();try{assert.throws(()=>dom.window.extractSavedArticle('<html><body><p>Log in</p></body></html>','https://example.org/'),/No readable article/)}finally{dom.window.close()}
});
