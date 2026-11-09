/* Main text stays independent of any hosted reading service. */
function extractSavedArticle(html,url){
 const copy=new DOMParser().parseFromString(html,'text/html');
 const base=copy.createElement('base');base.href=url;copy.head.prepend(base);
 let parsed;try{parsed=new Readability(copy.cloneNode(true),{charThreshold:80}).parse()}catch(_){}
 if(!parsed?.content||parsed.textContent.trim().length<80){
  let body='';
  const visit=value=>{if(!value||typeof value!=='object')return;if(typeof value.articleBody==='string'&&value.articleBody.trim().length>=80)body=value.articleBody;if(Array.isArray(value))value.forEach(visit);else if(value['@graph'])visit(value['@graph'])};
  for(const node of copy.querySelectorAll('script[type="application/ld+json"]'))try{visit(JSON.parse(node.textContent))}catch(_){}
  if(body){const wrapper=copy.createElement('article');for(const paragraph of body.split(/\n\s*\n/)){const p=copy.createElement('p');p.textContent=paragraph;wrapper.appendChild(p)}parsed={content:wrapper.innerHTML,textContent:body}}
  else{
   for(const node of copy.querySelectorAll('script,style,nav,footer,header,aside,form,button,input,iframe,[role="navigation"],[role="banner"]'))node.remove();
   const candidates=[...copy.querySelectorAll('article,main,[itemprop="articleBody"],[role="main"]')].sort((a,b)=>b.textContent.trim().length-a.textContent.trim().length);
   const candidate=candidates.find(x=>x.textContent.trim().length>=180);
   if(candidate)parsed={content:candidate.innerHTML,textContent:candidate.textContent};
  }
  if(parsed){parsed.title=copy.querySelector('meta[property="og:title"]')?.content||copy.querySelector('h1')?.textContent||copy.title;parsed.byline=copy.querySelector('meta[name="author"]')?.content||'';parsed.lang=copy.documentElement.lang}
 }
 if(!parsed?.content||parsed.textContent.trim().length<40)throw new Error('This page needs its rendered publisher view. It may require a login or block automatic text extraction.');
 const content=DOMPurify.sanitize(parsed.content,{USE_PROFILES:{html:true},FORBID_TAGS:['video','audio','iframe','form','input','button','style'],FORBID_ATTR:['style','srcset']});
 const clean=new DOMParser().parseFromString(content,'text/html'),origin=new URL(url);
 for(const link of clean.querySelectorAll('a[href]')){try{const target=new URL(link.getAttribute('href'),url);if(target.origin===origin.origin&&target.pathname===origin.pathname&&target.hash)link.setAttribute('href',target.hash)}catch(_){link.removeAttribute('href')}}
 for(const image of clean.querySelectorAll('img')){try{const target=new URL(image.getAttribute('src')||'',url);if(!/^https?:$/.test(target.protocol))throw new Error();image.setAttribute('src',target.href)}catch(_){image.remove()}}
 return {url,title:parsed.title,author:parsed.byline||'',language:parsed.lang||'',content:clean.body.innerHTML};
}
