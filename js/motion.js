(function(){
  var d=document, w=window;
  if(w.__pgTrans) return; w.__pgTrans=1;
  var root=d.documentElement;
  if(root) root.classList.add('pg-clip');
  var st=d.createElement('style');
  st.id='pg-trans-style';
  st.textContent='html{background:#fff}'
   +'html.pg-clip{overflow-x:hidden}'
   +'body{opacity:0;transition:opacity .42s ease}'
   +'body.pg-in{opacity:1}'
   +'body.pg-out{opacity:0;transition:opacity .2s ease-in}'
   +'@media (prefers-reduced-motion: reduce){body{opacity:1!important;transition:none!important}}';
  (d.head||root).appendChild(st);
  function unclip(){ if(root) root.classList.remove('pg-clip'); }
  function inNow(){
    if(!d.body) return;
    d.body.classList.remove('pg-out');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.body.classList.add('pg-in'); }); });
    setTimeout(unclip,760);
  }
  if(d.readyState==='loading'){ d.addEventListener('DOMContentLoaded',inNow); } else { inNow(); }
  setTimeout(function(){
    if(d.body && !d.body.classList.contains('pg-in')) d.body.classList.add('pg-in');
    unclip();
  },1200);
  var leaving=false;
  function go(href){
    if(leaving) return; leaving=true;
    if(!d.body){ location.href=href; return; }
    d.body.classList.add('pg-out');
    setTimeout(function(){ location.href=href; },240);
    setTimeout(function(){ leaving=false; },1400);
  }
  d.addEventListener('click',function(e){
    if(e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a=e.target;
    while(a && a!==d.body && a.tagName!=='A') a=a.parentElement;
    if(!a || a.tagName!=='A') return;
    var href=a.getAttribute('href');
    if(!href || href.charAt(0)==='#' || href.indexOf('javascript:')===0) return;
    if(a.target && a.target!=='_self') return;
    if(a.hasAttribute('download')) return;
    if(a.host && a.host!==location.host) return;
    go(a.href);
  },false);
  w.addEventListener('pageshow',function(ev){
    leaving=false;
    if(ev.persisted || !d.body.classList.contains('pg-in')) inNow();
    else d.body.classList.remove('pg-out');
  });
})();
