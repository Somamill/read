/* Keep untrusted web pages out of the privileged local reader WebView. */
function readerClickedLink(event){
 if(event.button!=null&&event.button>1)return;
 const anchor=event.target.closest?.('a[href]');if(!anchor)return;
 const raw=anchor.getAttribute('href');
 if(!raw||raw.startsWith('#'))return;
 let url;try{url=new URL(raw,document.baseURI)}catch(_){return}
 if(!['https:','http:'].includes(url.protocol))return;
 event.preventDefault();event.stopImmediatePropagation();
 let heading='';
 for(const node of document.querySelectorAll('h1,h2,h3,h4')){
  if(node.contains(anchor)||node.compareDocumentPosition(anchor)&Node.DOCUMENT_POSITION_FOLLOWING)heading=node.textContent.trim();
  else break;
 }
 window.webkit.messageHandlers.reader.postMessage({type:'link',url:url.href,title:heading||anchor.textContent.trim()});
}
document.addEventListener('click',readerClickedLink,true);
document.addEventListener('auxclick',readerClickedLink,true);
