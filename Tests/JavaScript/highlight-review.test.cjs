const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('Resources/Dashboard/app.js','utf8');
const code=source.slice(source.indexOf('function renderReview(){'),source.indexOf('\nfunction ',source.indexOf('function renderReview(){')+1));
test('desktop review shows persistent daily progress, completion and snooze state',()=>{
 const root={innerHTML:''},annotationState={review:[],settings:{reviewSize:5},reviewStatus:{goal:5,reviewed:5,scheduled:true}};
 const context={document:{getElementById:()=>root},annotationState,reviewIndex:0,annotationCard:()=>'<article>Passage</article>'};
 vm.createContext(context);vm.runInContext(code+';renderReview()',context);
 assert.match(root.innerHTML,/5 of 5 reviewed today/);assert.match(root.innerHTML,/review is complete/);
 annotationState.reviewStatus.snoozed=true;vm.runInContext('renderReview()',context);assert.match(root.innerHTML,/Review is snoozed/);
 annotationState.reviewStatus.snoozed=false;annotationState.reviewStatus.reviewed=1;annotationState.review=[{id:'1'}];
 vm.runInContext('renderReview()',context);assert.match(root.innerHTML,/data-review="7"/);assert.match(root.innerHTML,/Skip for now/);
});
