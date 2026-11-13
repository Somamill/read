const test=require('node:test'),assert=require('node:assert/strict');
const {compile}=require('../../Resources/Dashboard/reading-views.js');
const now=Date.UTC(2026,10,12),items=[
 {title:'日本語の本',author:'Martha Wells',document_type:'epub',tags:'fiction, 日本語',saved:now/1000,progress:.2},
 {title:'An essay',author:'A Writer',document_type:'article',url:'https://www.example.org/a',feed:'https://example.org/feed',characters:12000,progress:0,favorite:1,saved:now-2*86400000,fetched:1},
 {title:'Finished PDF',kind:'pdf',finished:true,progress:1,saved:now-20*86400000,highlightCount:2}
];
test('reading queries combine phrases, nested Boolean filters, exact tags and Unicode',()=>{
 assert.equal(items.filter(compile('author:"Martha Wells" tag:日本語')).length,1);
 assert.deepEqual(items.filter(compile('(type:article AND domain:example.org) OR has:highlights')).map(x=>x.title),['An essay','Finished PDF']);
 assert.equal(items.filter(compile('NOT (type:pdf OR type:epub)')).length,1);
 assert.equal(items.filter(compile('is:starred -tag:fiction')).length,1);
});
test('relative dates, percentages, read times and mobile metadata use the same semantics',()=>{
 assert.equal(items.filter(compile('saved:7d',{now})).length,2);
 assert.equal(items.filter(compile('read:<=10')).length,1);
 assert.equal(items.filter(compile('progress:>=97')).length,1);
 assert.equal(items.filter(compile('status:finished')).length,1);
 assert.equal(items.filter(compile('feed:true is:offline')).length,1);
 assert.equal(compile('type:epub')({kind:'epub'}),true);
});
test('invalid or excessively complex queries fail visibly without evaluating code',()=>{
 for(const query of ['title:"unfinished','field:unknown','type:pdf OR','(type:pdf','type:pdf)','progress:many','read:NaN','saved:yesterday','has:anything','is:unknown','x'.repeat(1601),'x '.repeat(101)])assert.throws(()=>compile(query),Error,query);
 assert.throws(()=>compile('javascript:alert(1)'),/Unknown filter/);
});

test('desktop and mobile ship the same query engine',()=>{const fs=require('node:fs');assert.equal(fs.readFileSync('Resources/Dashboard/reading-views.js','utf8'),fs.readFileSync('Apps/iPhone/src/lib/reading-views.js','utf8'))});
