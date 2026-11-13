/* Keyboard-first access to existing local actions; no remote search. */
(function(){
 const dialog=document.createElement('dialog');dialog.className='command-dialog';dialog.setAttribute('aria-label','Find a command');
 dialog.innerHTML='<form method="dialog"><div class="command-heading"><h2>Find a command</h2><button class="small-btn" aria-label="Close command menu">Close</button></div></form><input type="search" id="commandQuery" aria-label="Search commands" placeholder="Find a page, saved view or library search…" autocomplete="off"><div id="commandResults"></div><p>Use ↑ and ↓ to move, Enter to choose, Esc to close.</p>';
 document.body.appendChild(dialog);const input=dialog.querySelector('input'),results=dialog.querySelector('#commandResults');let commands=[];
 function navigate(page){dialog.close();showPage(page)}
 function render(){const query=input.value.trim().toLocaleLowerCase();commands=Object.entries(titles).map(([page,label])=>({label:label[0],detail:'Open view',run:()=>navigate(page)}));
  commands.push({label:'Save article',detail:'Save a web page for reading',run:()=>{navigate('articles');document.getElementById('articleURL')?.focus()}});
  for(const view of articleLibrary.views||[])commands.push({label:view.name,detail:'Saved reading view',run:()=>{navigate('articles');applyReadingView(view.id)}});
  commands=commands.filter(x=>!query||[x.label,x.detail].join(' ').toLocaleLowerCase().includes(query));
  if(query)commands.push({label:'Search library for “'+input.value.trim()+'”',detail:'Search your books on this device',run:()=>{const value=input.value.trim();dialog.close();window.shelfFocusSearch();const field=document.getElementById('librarySearch');if(field){field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}))}}});
  results.innerHTML=commands.map((x,i)=>`<button type="button" class="command-result" data-command="${i}"><span>${esc(x.label)}</span><small>${esc(x.detail)}</small></button>`).join('')||'<p>No commands match. Try Library, Articles or Settings.</p>';
 }
 window.readOpenCommandMenu=()=>{if(dialog.open){input.focus();return}input.value='';render();dialog.showModal();input.focus()};
 input.addEventListener('input',render);
 results.addEventListener('click',event=>{const button=event.target.closest('[data-command]');if(button)commands[Number(button.dataset.command)]?.run()});
 dialog.addEventListener('keydown',event=>{const buttons=[...results.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const delta=event.key==='ArrowDown'?1:-1;buttons[(index+delta+buttons.length)%buttons.length]?.focus()}else if(event.key==='Enter'&&document.activeElement===input){event.preventDefault();commands[0]?.run()}});
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!event.altKey){event.preventDefault();window.readOpenCommandMenu()}});
})();
