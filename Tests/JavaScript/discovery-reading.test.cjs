const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('discovery shows actual unread feed stories, deduplicated and newest first',()=>{
 const source=fs.readFileSync('Resources/Dashboard/discovery-reading.js','utf8');
 const context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function discoveryStories('),source.indexOf('function renderDiscoveryReading(')),context);
 const item={feed:'https://example.org/feed',status:'inbox',document_type:'article',published:100,url:'https://example.org/story'};
 const rows=[item,{...item,url:item.url+'#part',published:99},{...item,url:'https://example.org/new',published:200},{...item,status:'archive',url:'https://example.org/old'},{...item,published:1000000,url:'https://example.org/future'},{...item,feed:'',url:'https://example.org/saved'}];
 assert.equal(JSON.stringify(context.discoveryStories(rows,300).map(x=>x.url)),JSON.stringify(['https://example.org/new','https://example.org/story']));
});
