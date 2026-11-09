/* Selection tools and cached images stay outside the document's text offsets. */
(function(){
 let bar;
 function initialize(){
  if(bar||!document.getElementById('reader-flow'))return;
  bar=document.createElement('div');bar.id='reader-selection-tools';bar.hidden=true;
  bar.innerHTML='<button type="button" data-save>✎ Highlight <small>H</small></button><button type="button" data-notes>↗ Apple Notes</button>';
  document.body.appendChild(bar);
  bar.addEventListener('pointerdown',e=>e.preventDefault());
  bar.querySelector('[data-save]').addEventListener('click',()=>window.captureReaderHighlight?.());
  bar.querySelector('[data-notes]').addEventListener('click',()=>window.captureReaderHighlight?.('notes'));
  let timer;document.addEventListener('selectionchange',()=>{clearTimeout(timer);timer=setTimeout(()=>{
   const selection=getSelection();if(!selection?.rangeCount||selection.toString().trim().length<2){bar.hidden=true;return}
   const range=selection.getRangeAt(0);if(!document.getElementById('reader-flow').contains(range.commonAncestorContainer)){bar.hidden=true;return}
   const rect=[...range.getClientRects()].find(r=>r.left>=0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight)||range.getBoundingClientRect();
   bar.hidden=false;bar.style.left=Math.max(14,Math.min(innerWidth-285,rect.left))+'px';bar.style.top=Math.max(18,Math.min(innerHeight-140,rect.bottom+10))+'px';
  },80)});
  window.readerSelectionDismiss=()=>{bar.hidden=true};
  document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='h'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&getSelection()?.toString().trim()&&!event.target.closest('input,textarea,select,[contenteditable="true"]')){event.preventDefault();window.captureReaderHighlight?.()}});
  if(window.readerPendingImages)window.readerSetImages(window.readerPendingImages);
 }
 window.readerSetImages=function(images){window.readerPendingImages=images;for(const image of document.querySelectorAll('img[data-read-image]')){const path=images[image.dataset.readImage];if(path&&!image.getAttribute('src')){image.addEventListener('load',()=>window.readerRelayout?.(),{once:true});image.src=path}}};
 window.addEventListener('load',initialize,{once:true});if(document.readyState==='complete')initialize();
})();
