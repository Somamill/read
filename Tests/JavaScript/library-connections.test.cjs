const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('Resources/Dashboard/app.js','utf8'),html=fs.readFileSync('Resources/Dashboard/index.html','utf8');
const line=name=>source.split('\n').find(x=>x.startsWith('function '+name+'('));
test('Discover has the real page and response targets used by its controller',()=>{
 for(const id of ['discover','discoveryBooks','discoveryBasis','discoveryUpdated','hardcoverSearch'])assert.match(html,new RegExp('id="'+id+'"'));
});
test('recent activity chooses the latest reading location instead of first nonempty metadata',()=>{
 const context={data:{syncActivity:[]}};vm.createContext(context);vm.runInContext(line('bookActivity'),context);
 const date=vm.runInContext(`bookActivity({modified:'2024-01-01',appleBooks:{lastEngaged:'2024-02-01'},hardcover:{updatedAt:'2026-11-06'}})`,context);
 assert.equal(date,Date.parse('2026-11-06'));
});
test('an ebook file URL cannot mask audiobook artwork and missing Apple artwork resolves by catalog ID',()=>{
 const context={URL,esc:String,externalCoverCache:new Map(),localBookCoverCache:new Map(),coverFallback:()=>'<fallback>'};vm.createContext(context);
 vm.runInContext(line('validCoverURL')+'\n'+line('bookCover'),context);
 const cover=vm.runInContext(`bookCover({title:'Audio',coverURL:'file:///book.epub',hardcover:{coverURL:'https://assets.hardcover.app/cover.jpg'}})`,context);
 assert.match(cover,/data-external-cover="https:\/\/assets.hardcover.app\/cover.jpg"/);
 const apple=vm.runInContext(`bookCover({title:'Audio',appleBooks:{assetId:'1684681587',language:'de'}})`,context);
 assert.match(apple,/itunes.apple.com\/lookup/);assert.match(apple,/country=de/);
});
test('local highlights are not introduced as a Readwise library',()=>{
 assert.doesNotMatch(source,/My Readwise library/);
 assert.match(source,/Your highlights are saved locally in read\./);
});
test('one book combines numbered imports and subtitle variants while retaining cover paths',()=>{
 const context={booksData:{allBooks:[{id:1,title:'003 - Endurance',authors:'Alfred Lansing',formats:'EPUB',coverPath:'/fixture/cover.jpg'},{id:2,title:"Endurance: Shackleton’s Incredible Voyage",authors:'Alfred Lansing',formats:'PDF'}]},hardcoverShelfDataCache:null,appleBooksData:null};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function normalizedBookTitle('),source.indexOf('function setLibraryView(')),context);
 assert.equal(context.unifiedBooks().length,1);assert.equal(context.unifiedBooks()[0].coverPath,'/fixture/cover.jpg');
 assert.equal(context.sameWork({title:'Series Volume 1',authors:'Writer'},{title:'Series Volume 2',authors:'Writer'}),false);
 assert.equal(context.sameWork({title:'Endurance',authors:'Different Writer'},{title:'Endurance: A Voyage',authors:'Alfred Lansing'}),false);
});
test('cover callbacks tolerate an already rendered image without fallback-only data',()=>{
 const images=[],context={window:{},localBookCoverCache:new Map(),CSS:{escape:String},document:{querySelectorAll:()=>[{dataset:{},alt:'Cover of Example'}]},Image:class{constructor(){images.push(this)}}};vm.createContext(context);
 vm.runInContext(source.split('\n').find(x=>x.startsWith('window.bookCoverLoaded=')),context);
 context.window.bookCoverLoaded({bookId:1,coverData:'data:image/jpeg;base64,fixture'});
 assert.equal(images[0].alt,'Cover of Example');
});
