/* Local reading queries. No evaluation, network calls or third-party runtime. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReadViews=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const normalize=x=>String(x??'').normalize('NFKC').toLowerCase();
function tokenize(query){
 if(typeof query!=='string'||query.length>1600)throw new Error('Keep the view query under 1,600 characters.');
 const out=[];let token='',quote=false,escape=false;
 const push=()=>{if(token){out.push(token);token=''}};
 for(const ch of query){
  if(escape){token+=ch;escape=false;continue}
  if(ch==='\\'&&quote){escape=true;continue}
  if(ch==='"'){quote=!quote;continue}
  if(!quote&&(ch==='('||ch===')')){push();out.push(ch)}
  else if(!quote&&/\s/.test(ch))push();else token+=ch;
 }
 if(quote||escape)throw new Error('Close the quotation marks in your query.');push();
 if(out.length>100)throw new Error('Use fewer than 100 query terms.');return out;
}
const epoch=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?(n<1e11?n*1000:n):Date.parse(value)||0};
function comparison(value,actual){
 const m=/^(<=|>=|<|>|=)?(\d+(?:\.\d+)?)$/.exec(value);
 if(!m)throw new Error('Use a number with <, >, <= or >=.');
 const expected=Number(m[2]),op=m[1]||'=';
 return Number.isFinite(actual)&&(op==='<'?actual<expected:op==='>'?actual>expected:op==='<='?actual<=expected:op==='>='?actual>=expected:actual===expected);
}
function predicate(token,now){
 const split=token.indexOf(':'),field=split<0?'text':normalize(token.slice(0,split)),value=normalize(split<0?token:token.slice(split+1));
 if(!value)throw new Error('Add a value after '+field+':');
 const supported=['text','title','author','tag','type','status','is','domain','source','feed','read','progress','saved','has'];
 if(!supported.includes(field))throw new Error('Unknown filter “'+field+'”. Try tag:, type:, author: or read:.');
 if(field==='read'||field==='progress')comparison(value,0);
 if(field==='saved'&&!/^\d+(?:\.\d+)?[dhw]$/.test(value))throw new Error('Use saved:7d, saved:24h or saved:2w.');
 if(field==='is'&&!['starred','favorite','finished','unread','reading','offline'].includes(value))throw new Error('Use is:starred, is:finished, is:unread, is:reading or is:offline.');
 if(field==='has'&&value!=='highlights')throw new Error('Use has:highlights.');
 return item=>{
  const title=normalize(item.title),author=normalize(item.author||item.authors),type=normalize(item.document_type||item.kind||(String(item.formats||'').includes('EPUB')?'epub':'book'));
  const progress=Number(item.progress??item.percentage??0),finished=!!item.finished||progress>=.97,status=normalize(item.status||(finished?'archive':progress>0?'reading':'inbox'));
  const tags=Array.isArray(item.tags)?item.tags.map(normalize):normalize(item.tags).split(/[,;\n]/).map(x=>x.trim());
  const source=String(item.sourceURL||item.url||item.feed||item.site||'');let domain='';try{domain=new URL(source).hostname.replace(/^www\./,'')}catch{}
  if(field==='text')return normalize([title,author,item.site,tags.join(' '),item.excerpt].join(' ')).includes(value);
  if(field==='title'||field==='author')return (field==='title'?title:author).includes(value);
  if(field==='tag')return tags.includes(value);
  if(field==='type')return type===value||(value==='book'&&['epub','audio','book'].includes(type));
  if(field==='status')return value==='finished'?status==='archive'||finished:value==='unread'?progress===0&&status!=='trash':value==='reading'?progress>0&&!finished&&status!=='trash':status===value;
  if(field==='domain')return domain===value||domain.endsWith('.'+value);
  if(field==='source')return normalize([source,item.site].join(' ')).includes(value);
  if(field==='feed')return value==='true'?!!item.feed:value==='false'?!item.feed:normalize(item.feed).includes(value);
  if(field==='has')return Number(item.highlightCount||item.highlights?.length||0)>0;
  if(field==='is')return value==='starred'||value==='favorite'?!!(item.favorite||item.starred):value==='finished'?finished||status==='archive':value==='unread'?progress===0&&status!=='trash':value==='reading'?progress>0&&!finished&&status!=='trash':!!(item.fetched||item.hasContent||item.html||item.uri);
  if(field==='progress')return comparison(value,progress*100);
  if(field==='read'){const chars=Number(item.characters||item.text?.length||0),minutes=Number(item.readingMinutes)||(chars>0?Math.max(1,Math.ceil(chars/1200)):NaN);return comparison(value,minutes)}
  if(field==='saved'){const amount=Number(value.slice(0,-1)),unit=value.at(-1),age=amount*(unit==='h'?3600000:unit==='w'?604800000:86400000),stamp=epoch(item.saved||item.added);return stamp>0&&stamp<=now&&now-stamp<=age}
  return false;
 };
}
function compile(query,options={}){
 const tokens=tokenize(query);let at=0;const now=options.now??Date.now();
 function atom(){
  const token=tokens[at++];if(token===undefined)throw new Error('Finish the query after AND or OR.');
  if(token==='('){const inner=or();if(tokens[at++]!==')')throw new Error('Close the parenthesis in your query.');return inner}
  if(token===')'||/^(AND|OR)$/i.test(token))throw new Error('Add a filter before '+token+'.');
  if(token==='-'||/^NOT$/i.test(token)){const inner=atom();return x=>!inner(x)}
  if(token.startsWith('-')){const inner=predicate(token.slice(1),now);return x=>!inner(x)}
  return predicate(token,now);
 }
 function and(){let left=atom();while(at<tokens.length&&tokens[at]!==')'&&!/^OR$/i.test(tokens[at])){if(/^AND$/i.test(tokens[at]))at++;const a=left,b=atom();left=x=>a(x)&&b(x)}return left}
 function or(){let left=and();while(/^OR$/i.test(tokens[at]||'')){at++;const a=left,b=and();left=x=>a(x)||b(x)}return left}
 if(!tokens.length)return ()=>true;const result=or();if(at<tokens.length)throw new Error('Remove the extra closing parenthesis.');return result;
}
return {compile,tokenize};
});
