/* Mozilla Readability + DOMPurify. Stored text receives another native allowlist. */
function extractSavedArticle(html,url){
 const copy=new DOMParser().parseFromString(html,'text/html');
 const base=copy.createElement('base');base.href=url;copy.head.prepend(base);
 const parsed=new Readability(copy,{charThreshold:80}).parse();
 if(!parsed?.content||parsed.textContent.trim().length<40)throw new Error('No readable article text was found. This page may need a login.');
 const content=DOMPurify.sanitize(parsed.content,{USE_PROFILES:{html:true},FORBID_TAGS:['img','video','audio','iframe','form','input','button','style'],FORBID_ATTR:['style','srcset']});
 const clean=new DOMParser().parseFromString(content,'text/html');
 const origin=new URL(url);
 for(const link of clean.querySelectorAll('a[href]')){try{const target=new URL(link.getAttribute('href'),url);if(target.origin===origin.origin&&target.pathname===origin.pathname&&target.hash)link.setAttribute('href',target.hash)}catch(_){link.removeAttribute('href')}}
 return {url,title:parsed.title,author:parsed.byline||'',language:parsed.lang||'',content:clean.body.innerHTML};
}
