import { Book, escapeHTML, Settings } from "./model";
import { purifyScript, extractionScripts } from "./vendor";
const scriptSafe = (s: string) => s.replace(/<\/script/gi, "<\\/script");
const literal = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");
export function extractionHTML(html: string, url: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'"></head><body><script>${scriptSafe(extractionScripts)}\ntry{window.ReactNativeWebView.postMessage(JSON.stringify({type:'extracted',item:extractSavedArticle(${literal(html)},${literal(url)})}))}catch(error){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:error.message}))}</script></body></html>`;
}
export function readerHTML(
  book: Book,
  s: Settings,
  dark: boolean,
  highlights: string[] = [],
) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'"><style>
:root{color-scheme:${dark ? "dark" : "light"}}*{box-sizing:border-box}html,body{margin:0;height:100%;background:${dark ? "#000" : "#fff"};color:${dark ? "#eee" : "#242424"};font: ${s.fontSize}px/1.7 Georgia,'Hiragino Mincho ProN',serif}#view{height:100%;overflow:${s.layout === "scroll" ? "auto" : "hidden"};scrollbar-width:none}#flow{${s.layout === "pages" ? "height:100%;column-width:calc(100vw - 44px);column-gap:44px;column-fill:auto;" : "max-width:740px;margin:auto;"}padding:25px 22px 80px}h1,h2,h3{font-family:-apple-system,sans-serif;line-height:1.2}h1{font-size:1.5em}img{max-width:100%;max-height:60vh;object-fit:contain}a{color:${dark ? "#82b8ff" : "#2460b0"}}mark{background:#dbc47388;color:inherit}pre{white-space:pre-wrap}section{break-before:auto}#tools{position:fixed;z-index:5;bottom:15px;left:50%;transform:translateX(-50%);border:1px solid #8885;border-radius:22px;background:${dark ? "#191919ef" : "#f2f2f2ef"};padding:8px 18px;backdrop-filter:blur(20px)}button{font:600 15px -apple-system;border:0;background:transparent;color:inherit;padding:8px}
</style></head><body><main id="view"><article id="flow"></article></main><div id="tools" hidden><button id="highlight">Highlight selection</button></div><script>${scriptSafe(purifyScript)}
const data=${literal(book)},flow=document.getElementById('flow'),view=document.getElementById('view');flow.innerHTML='<h1>'+${literal(escapeHTML(book.title))}+'</h1>'+DOMPurify.sanitize(data.html||'',{FORBID_TAGS:['script','iframe','object','embed','form','style','input','video','audio','svg'],FORBID_ATTR:['style','srcset']});
// Restore saved local highlights without evaluating source HTML.
for(const quote of ${literal(highlights)}){
 const walk=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);let text='',nodes=[],node;
 while(node=walk.nextNode()){nodes.push({node,start:text.length});text+=node.textContent}
 const start=text.indexOf(quote);if(start<0)continue;const end=start+quote.length;
 const first=nodes.findLast(x=>x.start<=start),last=nodes.findLast(x=>x.start<end);
 if(!first||!last)continue;const range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);
 const mark=document.createElement('mark');try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{}
}
const scrollMode=${s.layout === "scroll"},post=x=>window.ReactNativeWebView.postMessage(JSON.stringify(x));let touched=false,timer,page=0,pages=1,startX=0,startY=0,selection;
function count(){pages=Math.max(1,Math.ceil((scrollMode?view.scrollHeight:view.scrollWidth)/(scrollMode?view.clientHeight:view.clientWidth)))}
function percentage(){return scrollMode?Math.min(1,view.scrollTop/Math.max(1,view.scrollHeight-view.clientHeight)):pages===1?0:page/(pages-1)}
function report(){count();if(scrollMode)page=Math.min(pages-1,Math.floor(view.scrollTop/view.clientHeight));post({type:'position',percentage:percentage(),user:touched,page:page+1,pages})}
function move(delta){touched=true;count();page=Math.max(0,Math.min(pages-1,page+delta));view.scrollTo({left:scrollMode?0:page*view.clientWidth,top:scrollMode?view.scrollTop+delta*view.clientHeight:0,behavior:'smooth'});clearTimeout(timer);timer=setTimeout(report,350)}window.movePage=move;
window.goChapter=id=>{const h=document.getElementById(id);if(h){touched=true;if(scrollMode)view.scrollTo({top:h.getBoundingClientRect().top+view.scrollTop,behavior:'smooth'});else{count();page=Math.floor((h.getBoundingClientRect().left+view.scrollLeft)/view.clientWidth);view.scrollTo({left:page*view.clientWidth,behavior:'smooth'})}setTimeout(report,350)}};
view.addEventListener('touchstart',e=>{startX=e.changedTouches[0].clientX;startY=e.changedTouches[0].clientY},{passive:true});view.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;if(!scrollMode&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4&&!getSelection().toString())move(dx<0?1:-1)},{passive:true});
view.addEventListener('scroll',()=>{if(!scrollMode)return;clearTimeout(timer);timer=setTimeout(report,450)},{passive:true});view.addEventListener('touchmove',()=>{touched=true},{passive:true});
document.addEventListener('selectionchange',()=>{const s=getSelection();if(s.toString().trim().length>1){selection=s.getRangeAt(0).cloneRange();document.getElementById('tools').hidden=false}else document.getElementById('tools').hidden=true});document.getElementById('highlight').onpointerdown=e=>e.preventDefault();document.getElementById('highlight').onclick=()=>{if(!selection)return;const text=selection.toString().trim();if(!text||text.length>4096)return;const mark=document.createElement('mark');try{mark.appendChild(selection.extractContents());selection.insertNode(mark)}catch{}post({type:'highlight',text});getSelection().removeAllRanges();document.getElementById('tools').hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();move(1)}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();move(-1)}});
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;e.preventDefault();const href=a.getAttribute('href');if(href.startsWith('#'))window.goChapter(href.slice(1));else if(/^https?:/.test(href))post({type:'link',url:href})});
setTimeout(()=>{count();page=Math.round((pages-1)*data.progress);view.scrollTo({left:scrollMode?0:page*view.clientWidth,top:scrollMode?data.progress*(view.scrollHeight-view.clientHeight):0});report()},150);window.addEventListener('resize',()=>{const p=percentage();count();page=Math.round(p*(pages-1));view.scrollTo({left:scrollMode?0:page*view.clientWidth});report()});
</script></body></html>`;
}
