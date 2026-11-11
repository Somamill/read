// Real source material, ranked locally. Never manufacture popularity counts.
const discoveryReading=document.createElement('section');
discoveryReading.className='discovery-reading';
discoveryReading.innerHTML='<div class="section-head"><div><h2>Worth your attention</h2><p>Recent stories from your subscriptions. Read and highlight them here.</p></div><button class="small-btn" id="discoveryFeeds">Find feeds</button></div><div id="discoveryStories" class="discovery-reading-grid" aria-live="polite"></div><div class="section-head"><div><h3>From your highlights</h3><p>Saved by you, ready to revisit.</p></div></div><div id="discoveryPassages" class="discovery-reading-grid"></div>';
document.getElementById('discover').prepend(discoveryReading);
document.getElementById('discoveryFeeds').addEventListener('click',()=>{showPage('articles');articlePost('discover');document.querySelector('.article-discovery').scrollIntoView({block:'center'})});
function discoveryStories(items,now=Date.now()/1000){
 const seen=new Set();
 return items.filter(x=>x.feed&&x.status!=='trash'&&x.status!=='archive'&&x.document_type!=='pdf'&&(!x.published||x.published<=now+86400)).sort((a,b)=>(b.published||b.saved||0)-(a.published||a.saved||0)).filter(x=>{const key=x.url.replace(/#.*$/,'');if(seen.has(key))return false;seen.add(key);return true}).slice(0,6);
}
function renderDiscoveryReading(){
 const stories=discoveryStories(articleLibrary.items);
 document.getElementById('discoveryStories').innerHTML=stories.map(x=>`<article class="discovery-reading-card"><small>${esc(x.site||x.author||'Your feed')}${x.published?' · '+esc(new Date(x.published*1000).toLocaleDateString()):''}</small><h3>${esc(x.title)}</h3><p>${esc((x.excerpt||'').slice(0,240))}</p><button class="primary-btn article-read" data-discovery-article="${Number(x.id)}">Read article <span aria-hidden="true">→</span></button></article>`).join('')||'<div class="empty-books">No unread feed stories yet. Choose Find feeds to connect a source; new stories appear here automatically.</div>';
 const passages=annotationState.items.filter(x=>!x.archived&&x.text).slice().sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||String(a.id).localeCompare(String(b.id)));
 const offset=passages.length?Math.floor(Date.now()/86400000)%passages.length:0;
 const daily=passages.slice(offset).concat(passages.slice(0,offset)).slice(0,3);
 document.getElementById('discoveryPassages').innerHTML=daily.map(x=>`<article class="discovery-reading-card"><blockquote>${esc(x.text.slice(0,600))}${x.text.length>600?'…':''}</blockquote><small>${esc(x.title||'Saved passage')}${x.author?' · '+esc(x.author):''}</small></article>`).join('')||'<p class="hint">Your saved highlights will appear here. Highlight a passage in the reader to start.</p>';
}
discoveryReading.addEventListener('click',e=>{const button=e.target.closest('[data-discovery-article]');if(button)openArticle(Number(button.dataset.discoveryArticle))});

const publicRecommendations=document.createElement('section');
publicRecommendations.id='publicRecommendations';
publicRecommendations.innerHTML='<h2>Beyond the trends</h2><p class="hint">Open Library reader ratings and Project Gutenberg classics, alongside Hardcover. Each source uses its own ranking; popularity is not a measure of quality.</p><div id="publicBookGroups" aria-live="polite">Checking public catalogs…</div>';
discoveryReading.after(publicRecommendations);
function renderPublicRecommendations(groups){
 const seen=new Set();
 document.getElementById('publicBookGroups').innerHTML=groups.map(group=>`<section><h3>${esc(group.source)}</h3>${group.warning?`<p class="hint">${esc(group.warning)}</p>`:''}<div class="discovery-grid">${(group.books||[]).filter(b=>{const key=coreBookTitle(b.title)+'|'+normalizedAuthors(b.author);if(seen.has(key))return false;seen.add(key);return true}).map(b=>{const local=(booksData?.allBooks||[]).find(x=>sameWork(x,b));const url=validCoverURL(b.url);return `<article class="discover-book"><div class="discover-cover">${bookCover({...b,id:0})}</div><div class="discover-meta"><h3>${esc(b.title)}</h3><p>${esc(b.author)}</p><small>${esc(b.reason)}</small><div class="discover-actions">${local?`<button class="small-btn primary-action" data-recommended-local="${Number(local.id)}">Read your copy</button>`:''}${url?`<button class="small-btn" data-recommended-url="${esc(url)}">View book</button>`:''}</div></div></article>`}).join('')}</div></section>`).join('');
 bindMissingCoverSearches(publicRecommendations);
}
publicRecommendations.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.recommendedLocal)readBook(Number(b.dataset.recommendedLocal));if(b?.dataset.recommendedUrl)openBookLink(b.dataset.recommendedUrl)});

setInterval(()=>{if(activePage==='discover'){articlePost('list');articlePost('refresh')}},300000);
