const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('Sources/ReadMacApp/AppMain.swift','utf8');
const code=source.slice(source.indexOf('function layoutPages(){'),source.indexOf('\n              function chapterIndex()'));
test('font/layout changes preserve saved progress instead of an obsolete page number',()=>{
 const context={readerLayout:"auto",readerViewport:{scrollLeft:0,clientWidth:1000},readerFlow:{style:{setProperty(){}},scrollWidth:730*1000},step:()=>1000,pageCount:200,currentPage:8,userHasNavigated:false,window:{readerBook:{resumePercentage:.0382}}};
 vm.createContext(context);vm.runInContext(code+';layoutPages()',context);
 assert.equal(context.pageCount,730);assert.equal(context.currentPage,28);assert.equal(context.readerViewport.scrollLeft,28000);
 context.userHasNavigated=true;context.currentPage=29;context.readerFlow.scrollWidth=1000*1000;
 vm.runInContext('layoutPages()',context);
 assert.equal(context.currentPage,Math.round(29/729*999));
});
test('restoring a page is immediate; only user page turns animate',()=>{
 const start=source.indexOf('function setPage(page,userAction){'),end=source.indexOf('\n',start);
 const context={readerLayout:"single",readerViewport:{scrollTo:options=>context.lastScroll=options},layoutPages:()=>{},pageCount:730,currentPage:0,step:()=>1000,window:{setTimeout:()=>{}},sendPosition:()=>{}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';setPage(28,false)',context);
 assert.equal(context.lastScroll.behavior,'instant');assert.equal(context.lastScroll.left,28000);
 vm.runInContext('setPage(29,true)',context);assert.equal(context.lastScroll.behavior,'smooth');assert.equal(context.userHasNavigated,true);
});

test('continuous mode uses vertical document extent and vertical page turns',()=>{
 const context={readerLayout:'scroll',readerViewport:{clientWidth:1200,scrollTop:0,scrollLeft:0,scrollTo:x=>context.scroll=x},readerFlow:{style:{setProperty(){}},scrollHeight:5600,scrollWidth:1200},step:()=>800,pageCount:1,currentPage:0,userHasNavigated:false,window:{readerBook:{resumePercentage:.5},setTimeout:()=>{}},sendPosition:()=>{}};vm.createContext(context);vm.runInContext(code+';layoutPages()',context);assert.equal(context.pageCount,7);assert.equal(context.currentPage,3);assert.equal(context.readerViewport.scrollTop,2400);const start=source.indexOf('function setPage(page,userAction){'),end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end)+';setPage(4,true)',context);assert.equal(context.scroll.top,3200);assert.equal(context.scroll.left,0);
});
test('single and spread layouts choose the requested number of columns',()=>{
 const context={readerLayout:'single',readerViewport:{clientWidth:1400,scrollLeft:0},readerFlow:{style:{setProperty(){}},scrollWidth:2800},step:()=>1400,pageCount:1,currentPage:0,userHasNavigated:false,window:{readerBook:{}}};vm.createContext(context);vm.runInContext(code+';layoutPages()',context);assert.equal(context.readerFlow.style.columnCount,'1');context.readerLayout='spread';vm.runInContext('layoutPages()',context);assert.equal(context.readerFlow.style.columnCount,'2');
});
