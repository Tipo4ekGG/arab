(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var root = document.documentElement, body = document.body;
  var bar = $('bar'), q = $('q'), qClear = $('qClear'), found = $('found'), empty = $('empty');
  var chips = $('chips'), chipLinks = Array.prototype.slice.call(chips.querySelectorAll('a'));
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const topic = $('topic');
  const themeNames = new Map(chipLinks.map(a => [a.hash.slice(1), a.textContent]));
  const foodBody = $('food').querySelector('tbody');
  for (const row of document.querySelectorAll('tr[data-also-in="food"]')) {
    const copy = row.cloneNode(true);
    copy.removeAttribute('data-also-in');
    const extra = copy.cells[3];
    const plural = extra.textContent.split('мн.');
    if (plural.length > 1) {
      extra.firstChild.textContent = '';
    } else {
      extra.textContent = '';
    }
    // Show lunch between breakfast and dinner as in the textbook.
    if (copy.cells[2].textContent === 'обед') {
      const breakfast = Array.from(foodBody.rows).find(r => r.cells[2].textContent === 'завтрак');
      breakfast.after(copy);
    } else foodBody.append(copy);
  }

  const grammarTopics = {have:'f-have',prepsuf:'f-prep',pronouns:'f-pron'};
  function trainURL(id) {
    const params = new URLSearchParams();
    if (id === 'conjugation') params.set('track','conj');
    else {
      params.set('track', grammarTopics[id] ? 'form' : 'ru');
      params.set('topic', grammarTopics[id] || id);
    }
    return 'trainer.html?' + params;
  }
  function norm(value) {
    return value.toLowerCase().replace(/ё/g,'е')
      .replace(/[\u0301'’‘ʼ`ʿʾ\-‐‑]/g,'')
      .replace(/[ً-ٰٟـ]/g,'').replace(/[أإآٱ]/g,'ا')
      .replace(/[٠-٩]/g,n=>String(n.charCodeAt(0)-0x660))
      .replace(/\s+/g,' ').trim();
  }
  function wordText(el) {
    const walker = document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    const parts=[];
    while(walker.nextNode()) parts.push(walker.currentNode.nodeValue);
    return parts.join(' ');
  }
  function indexRow(row) {
    if (row.classList.contains('num')) return norm(wordText(row));
    // Preserve Arabic spelling across highlights inside a single word.
    return norm(Array.from(row.cells, c => c.classList.contains('ar') ? c.textContent : wordText(c)).join(' '));
  }
  const groups = sections.map(section => {
    const id = section.id;
    const name = themeNames.get(id) || section.querySelector('h2').textContent;
    topic.add(new Option(name,id));
    const title = section.querySelector('h2');
    const head = document.createElement('div');
    head.className = 'section-head';
    title.before(head); head.append(title);
    const train = document.createElement('a');
    train.className = 'topic-train'; train.href = trainURL(id); train.textContent = 'Тренировать';
    train.setAttribute('aria-label','Тренировать тему «' + name + '»');
    head.append(train);
    const tables = Array.from(section.querySelectorAll('table'),table => {
      const headers=Array.from(table.tHead.rows[0].cells,c=>c.textContent.trim());
      if (['Слово','Команда','Фраза'].includes(headers[0]) && headers[1] === 'Вслух' && headers.length<=4)
        table.dataset.layout='word';
      else if(headers[0]==='Прошедшее') table.dataset.layout='verb';
      else if(headers[0]==='Перевод' && headers[1]==='Слово') table.dataset.layout='day';
      const rows=Array.from(table.tBodies).flatMap(body=>Array.from(body.rows,r=>({el:r,text:indexRow(r)})));
      const box=table.closest('.tablebox');
      const heading=box.previousElementSibling;
      return {box,rows,heading:heading && heading.tagName==='H3' ? heading : null};
    });
    const cards=Array.from(section.querySelectorAll('.num'),el=>({el,text:indexRow(el)}));
    return {section,tables,cards,title:norm(name+' '+title.textContent)};
  });
  $('topic-tools').hidden=false;
  chips.hidden=true;

  let positions=[], positionFrame=0, current='', lastSearch=null;
  function activeTopic() {
    const line=window.scrollY+bar.offsetHeight+18;
    let id='';
    for(const pos of positions) { if(pos.top>line) break; id=pos.id; }
    if (id!==current || topic.value!==id) { topic.value=id; current=id; }
  }
  function measure() {
    cancelAnimationFrame(positionFrame);
    positionFrame=requestAnimationFrame(()=>{
      root.style.setProperty('--stick',(bar.offsetHeight+12)+'px');
      positions=sections.filter(s=>!s.hidden).map(s=>({id:s.id,top:s.getBoundingClientRect().top+window.scrollY}));
      activeTopic();
    });
  }
  let scrollFrame=0;
  addEventListener('scroll',()=>{
    if(scrollFrame) return;
    scrollFrame=requestAnimationFrame(()=>{ scrollFrame=0; activeTopic(); });
  },{passive:true});
  if('ResizeObserver' in window){
    const ro=new ResizeObserver(measure);
    ro.observe(bar); ro.observe(document.querySelector('main'));
  }
  addEventListener('resize',measure);
  if(document.fonts) document.fonts.ready.then(measure);
  measure();

  function search() {
    qClear.hidden=!q.value;
    const query=norm(q.value);
    if(query===lastSearch) return;
    lastSearch=query;
    const tokens=query.split(' ').filter(Boolean);
    let total=0;
    for(const group of groups) {
      let count=0;
      function show(item) {
        const match=tokens.every(token=>item.text.includes(token) || group.title.includes(token));
        item.el.hidden=!match;
        if(match) count++;
      }
      for(const table of group.tables) {
        const before=count;
        table.rows.forEach(show);
        table.box.hidden=before===count;
        if(table.heading) table.heading.hidden=table.box.hidden;
      }
      group.cards.forEach(show);
      group.section.hidden=count===0;
      group.section.classList.toggle('row-results',!!query && !group.title.includes(query));
      total+=count;
    }
    found.hidden=!query;
    found.textContent=query?'Совпадений: '+total:'';
    empty.hidden=!query || total>0;
    measure();
  }
  function clearSearch() {q.value='';search();}
  q.addEventListener('input',search);
  q.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();clearSearch();}});
  qClear.addEventListener('click',()=>{clearSearch();q.focus();});
  empty.querySelector('button').addEventListener('click',()=>{clearSearch();q.focus();});
  topic.addEventListener('change',()=>{
    const id=topic.value;
    if(!id) return;
    clearSearch();
    if(location.hash!=='#'+id) location.hash=id;
    else $(id).scrollIntoView();
  });
  addEventListener('hashchange',()=>{
    const target=document.getElementById(location.hash.slice(1));
    if(target && target.closest('section[hidden]')) {clearSearch();target.scrollIntoView();}
  });

  // Проверка себя
  var testBtn = $('testBtn'), panel = $('testPanel'), dot = $('testDot');
  testBtn.addEventListener('click', function(){
    var open = panel.hidden; panel.hidden = !open;
    testBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  function refreshDot(){
    var n = ['no-ar','no-tr','no-ru'].filter(function(c){ return body.classList.contains(c); }).length;
    dot.hidden = !n; dot.textContent = n; testBtn.classList.toggle('on', n > 0);
    if(!n) Array.prototype.forEach.call(document.querySelectorAll('.peek'), function(el){ el.classList.remove('peek'); });
  }
  function wire(btn, cls){
    btn.addEventListener('click', function(){
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      body.classList.toggle(cls, on);
      document.querySelectorAll(cls === 'no-ar' ? 'tbody .ar, .num .word' : cls === 'no-tr' ? 'tbody .tr, .num .say' : 'tbody .ru').forEach(function(cell){
        if(on) cell.tabIndex = 0; else cell.removeAttribute('tabindex');
      });
      if(!on) Array.prototype.forEach.call(document.querySelectorAll('.peek'), function(el){ el.classList.remove('peek'); });
      refreshDot();
    });
  }
  wire($('hideAr'), 'no-ar'); wire($('hideTr'), 'no-tr'); wire($('hideRu'), 'no-ru');
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('tbody .ar, tbody .tr, tbody .ru, .num .word, .num .say') : null;
    if(!t) return;
    var cat = t.matches('.ar, .word') ? 'no-ar' : t.matches('.tr, .say') ? 'no-tr' : 'no-ru';
    if(body.classList.contains(cat)) t.classList.toggle('peek');
  });

  // Шрифт
  (function(){
    var b = $('fontSw'), K = 'arabic-a1-font';
    function apply(on){ body.classList.toggle('font-naskh', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    var on = false; try{ on = localStorage.getItem(K) === 'naskh'; }catch(e){}
    apply(on);
    b.addEventListener('click', function(){ on = !on; apply(on); try{ localStorage.setItem(K, on ? 'naskh' : 'sans'); }catch(e){} });
  })();

  document.addEventListener('keydown', function(e){
    if((e.key === 'Enter' || e.key === ' ') && e.target.matches('[tabindex="0"]') && e.target.closest('table,.num')){
      e.preventDefault(); e.target.click();
    }
  });
})();
