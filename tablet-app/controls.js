// Shared tablet pickers: native data controls with one consistent touch menu.
window.TabletControls=(()=>{
  let active=null;
  function close(){if(!active)return;active.menu.hidden=true;active.button.setAttribute('aria-expanded','false');active=null;}
  document.addEventListener('click',event=>{if(active&&!active.root.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();const button=active.button;close();button.focus();}},true);
  function enhance(scope){
    scope.querySelectorAll('select:not([data-native])').forEach(select=>{
      if(select.dataset.enhanced)return;select.dataset.enhanced='true';
      const root=document.createElement('div');root.className='field-picker';select.parentNode.insertBefore(root,select);root.append(select);
      select.classList.add('native-value');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const button=document.createElement('button');button.type='button';button.className='picker-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
      const menu=document.createElement('div');menu.className='picker-menu';menu.hidden=true;menu.setAttribute('role','listbox');menu.id=`picker-${select.name}-${Math.random().toString(36).slice(2,7)}`;
      button.setAttribute('aria-controls',menu.id);
      const label=select.closest('label')?.firstChild?.textContent?.trim()||select.getAttribute('aria-label')||'Seleccionar';
      button.setAttribute('aria-label',label);menu.setAttribute('aria-label',label);
      function sync(){
        button.textContent=select.selectedOptions[0]?.textContent||'Seleccionar';
        menu.replaceChildren();
        [...select.options].filter(option=>option.value||select.dataset.includeEmpty==='true').forEach(option=>{
          const item=document.createElement('button');item.type='button';item.role='option';item.textContent=option.textContent;item.disabled=option.disabled;item.setAttribute('aria-selected',String(option.selected));
          item.onclick=()=>{select.value=option.value;sync();close();select.dispatchEvent(new Event('change',{bubbles:true}));button.focus();};menu.append(item);
        });
      }
      button.onclick=()=>{
        const opening=menu.hidden;close();if(!opening)return;
        menu.hidden=false;button.setAttribute('aria-expanded','true');active={root,menu,button};
        const rect=button.getBoundingClientRect();menu.classList.toggle('opens-up',innerHeight-rect.bottom<190&&rect.top>230);
        (menu.querySelector('[aria-selected=true]')||menu.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
      };
      menu.onkeydown=event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const items=[...menu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);const target=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[target]?.focus();};
      select.addEventListener('invalid',event=>{event.preventDefault();button.focus();button.setAttribute('aria-invalid','true');});select.onchange=()=>{sync();button.removeAttribute('aria-invalid');};
      root.append(button,menu);sync();
    });
  }
  return {enhance,close};
})();
