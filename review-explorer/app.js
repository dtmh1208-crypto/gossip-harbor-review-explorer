(() => {
  'use strict';
  const payload = JSON.parse(document.getElementById('review-data').textContent);
  const reviews = payload.reviews;
  const topics = payload.topics;
  const byId = new Map(reviews.map(r => [r.id, r]));
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s).normalize('NFKC').replace(/’/g, "'").toLowerCase();
  const format = n => n.toLocaleString('en-US');
  const dateLabel = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  const storageKey = 'gossip-harbor-ios-evidence-v1';
  let evidence = {};
  let storageFailed = false;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const [id, value] of Object.entries(stored)) {
      if (byId.has(id) && value && typeof value === 'object') evidence[id] = {note: String(value.note || ''), savedAt: String(value.savedAt || '')};
    }
  } catch { storageFailed = true; }
  for (const r of reviews) r.searchText = norm(`${r.title}\n${r.text}\n${r.author}\n${r.id}`);
  const state = {q:'', searchMode:'all', stars:new Set(), categories:new Set(), categoryMode:'any', from:'', to:'',
    version:'', minWords:0, saved:'all', sort:'newest', pageSize:25, page:1};
  let filtered = [];
  let detailId = null;
  let searchTimer;
  let toastTimer;
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(evidence)); return true; }
    catch { storageFailed = true; return false; }
  };
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }
  function terms() {
    const q = state.q.trim();
    if (!q) return [];
    if (state.searchMode === 'phrase') return [norm(q.replace(/^"|"$/g, ''))].filter(Boolean);
    return [...q.matchAll(/"([^"]+)"|(\S+)/g)].map(m => norm(m[1] || m[2])).filter(Boolean);
  }
  function highlighted(text, queryTerms = terms()) {
    if (!queryTerms.length) return esc(text);
    const escaped = [...new Set(queryTerms)].sort((a,b) => b.length-a.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(escaped.join('|'), 'gi');
    let result = '', last = 0;
    for (const m of String(text).matchAll(regex)) {
      result += esc(String(text).slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return result + esc(String(text).slice(last));
  }
  function snippet(r) {
    const text = r.text;
    const hits = terms().map(t => text.toLowerCase().indexOf(t)).filter(i => i >= 0);
    const start = hits.length ? Math.max(0, Math.min(...hits)-95) : 0;
    return `${start ? '…' : ''}${text.slice(start,start+650)}${start+650<text.length ? '…' : ''}`;
  }
  function tags(r) {
    return r.categories.length ? r.categories.map(id => `<span class="tag ${id==='ad-mismatch'?'ad-mismatch':''}">${esc(topics[id].name)}</span>`).join('') : '<span class="no-tags">No topic tag</span>';
  }
  const rating = r => `<span class="rating-pill ${r.stars<=2?'low':r.stars===3?'mid':''}" aria-label="${r.stars} out of 5 stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span>`;
  const savedButton = r => `<button class="save-button ${evidence[r.id]?'saved':''}" data-action="save" data-id="${esc(r.id)}" aria-pressed="${!!evidence[r.id]}">${evidence[r.id]?'✓ Saved':'+ Save'}</button>`;
  function card(r) {
    return `<article class="review-card" data-review-id="${esc(r.id)}"><div class="review-top">${rating(r)}<span>${dateLabel(r.date)}</span><span>·</span><span>${highlighted(r.author)}</span><span class="review-version">v${esc(r.version)}</span>${savedButton(r)}</div><h4>${highlighted(r.title || 'Untitled review')}</h4><p class="review-text">${highlighted(snippet(r))}</p>${evidence[r.id]?.note?`<div class="note-preview">Note: ${esc(evidence[r.id].note)}</div>`:''}<footer><div class="tags">${tags(r)}</div><div class="review-bottom"><span class="review-id">ID ${esc(r.id)}</span><button class="read-button" data-action="detail" data-id="${esc(r.id)}">Read & cite ↗</button></div></footer></article>`;
  }
  function matches(r, queryTerms) {
    if (state.stars.size && !state.stars.has(r.stars)) return false;
    if (state.categories.size) {
      const hits = [...state.categories].map(id => id==='untagged' ? !r.categories.length : r.categories.includes(id));
      if (state.categoryMode==='all' ? !hits.every(Boolean) : !hits.some(Boolean)) return false;
    }
    if (state.from && r.date<state.from || state.to && r.date>state.to) return false;
    if (state.version && r.version!==state.version || r.words<state.minWords) return false;
    if (state.saved==='saved' && !evidence[r.id] || state.saved==='unsaved' && evidence[r.id]) return false;
    if (queryTerms.length) {
      const found = queryTerms.map(t => r.searchText.includes(t));
      if (state.searchMode==='any' ? !found.some(Boolean) : !found.every(Boolean)) return false;
    }
    return true;
  }
  function render() {
    const queryTerms = terms();
    filtered = reviews.filter(r => matches(r,queryTerms));
    const relevance = r => queryTerms.reduce((sum,t) => sum+r.searchText.split(t).length-1,0);
    const secondary = (a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    filtered.sort((a,b) => {
      if (state.sort==='oldest') return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      if (state.sort==='lowest') return a.stars-b.stars || secondary(a,b);
      if (state.sort==='highest') return b.stars-a.stars || secondary(a,b);
      if (state.sort==='longest') return b.words-a.words || secondary(a,b);
      if (state.sort==='relevance' && queryTerms.length) return relevance(b)-relevance(a) || secondary(a,b);
      return secondary(a,b);
    });
    const total = filtered.length;
    const pages = Math.max(1,Math.ceil(total/state.pageSize));
    state.page = Math.max(1,Math.min(state.page,pages));
    const start = (state.page-1)*state.pageSize;
    $('review-list').innerHTML = filtered.slice(start,start+state.pageSize).map(card).join('');
    $('empty-state').hidden = total>0;
    $('result-count').textContent = format(total);
    $('average').innerHTML = total ? `${(filtered.reduce((sum,r)=>sum+r.stars,0)/total).toFixed(2)} <small>/ 5</small>` : '—';
    $('negative-share').textContent = total ? `${(filtered.filter(r=>r.stars<=2).length/total*100).toFixed(1)}%` : '—';
    $('saved-count').textContent = format(Object.keys(evidence).length);
    $('range-label').textContent = total ? `${format(start+1)}–${format(Math.min(start+state.pageSize,total))} of ${format(total)}` : '0 results';
    $('page-label').textContent = `Page ${state.page} of ${format(pages)}`;
    $('prev-btn').disabled = state.page===1;
    $('next-btn').disabled = state.page>=pages;
    $('export-btn').disabled = !total;
    $('backup-btn').disabled = !Object.keys(evidence).length;
    renderChips();
  }
  function renderChips() {
    const chips=[];
    if (state.q) chips.push(['q',`Search: ${state.q}`]);
    for (const n of [...state.stars].sort()) chips.push([`star:${n}`,`${n} star`]);
    for (const id of state.categories) chips.push([`topic:${id}`,id==='untagged'?'No topic tag':topics[id].name]);
    if (state.from) chips.push(['from',`From ${state.from}`]);
    if (state.to) chips.push(['to',`To ${state.to}`]);
    if (state.version) chips.push(['version',`v${state.version}`]);
    if (state.minWords) chips.push(['minWords',`${state.minWords}+ words`]);
    if (state.saved!=='all') chips.push(['saved',state.saved==='saved'?'Saved evidence':'Not saved']);
    $('active-filters').innerHTML = chips.map(([id,label])=>`<button class="filter-chip" data-remove="${esc(id)}" aria-label="Remove filter: ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');
  }
  function readControls() {
    state.q=$('search').value;
    state.searchMode=$('search-mode').value;
    state.categoryMode=$('category-mode').value;
    state.stars=new Set([...document.querySelectorAll('[data-star]:checked')].map(el=>Number(el.dataset.star)));
    state.categories=new Set([...document.querySelectorAll('[data-topic]:checked')].map(el=>el.dataset.topic));
    state.from=$('date-from').value; state.to=$('date-to').value;
    state.version=$('version').value; state.minWords=Number($('min-words').value);
    state.saved=$('evidence-filter').value; state.sort=$('sort').value; state.pageSize=Number($('page-size').value);
    state.page=1;
    render();
  }
  function reset() {
    clearTimeout(searchTimer);
    for (const el of document.querySelectorAll('[data-star],[data-topic]')) el.checked=false;
    $('search').value=''; $('search-mode').value='all'; $('category-mode').value='any';
    $('date-from').value=''; $('date-to').value=''; $('version').value='';
    $('min-words').value='0'; $('evidence-filter').value='all'; $('sort').value='newest';
    readControls();
  }
  function toggleSaved(id) {
    if (evidence[id]) delete evidence[id];
    else evidence[id]={note:'',savedAt:new Date().toISOString()};
    const stored=persist();
    render();
    if (detailId===id && $('detail-dialog').open) openDetail(id,false);
    if (!stored) toast('Saved for this session only. Export your evidence to keep a backup.');
  }
  async function copyEvidence(id) {
    const r=byId.get(id);
    const text=`${r.title}\n${r.stars}/5 stars · ${r.date} · ${r.author}\n\n${r.text}\n\nGossip Harbor — US Apple App Store\nReview ID: ${r.id}\nApp version: ${r.version}\nSource page: ${r.page}\n${evidence[id]?.note?`Research note: ${evidence[id].note}\n`:''}https://apps.apple.com/us/app/gossip-harbor-merge-story/id1623318294`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error('Clipboard unavailable');
    } catch {
      const field=document.createElement('textarea');
      field.value=text;field.style.position='fixed';field.style.opacity='0';
      ($('detail-dialog').open?$('detail-dialog'):document.body).append(field);
      field.select();
      const copied=document.execCommand('copy');field.remove();
      if (!copied) { toast('Clipboard blocked. Select the review text or export results instead.');return; }
    }
    toast('Review and source ID copied.');
  }
  function openDetail(id,focus=true) {
    const r=byId.get(id);if (!r) return;
    detailId=id;
    const source='../'+r.source.replace(/\\/g,'/').split('/').map(encodeURIComponent).join('/');
    $('detail-content').innerHTML=`<h2 id="detail-title" class="detail-title">${highlighted(r.title||'Untitled review')}</h2><div class="detail-meta">${rating(r)}<span>${dateLabel(r.date)}</span><span>${highlighted(r.author)}</span><span>Version ${esc(r.version)}</span></div><div class="tags">${tags(r)}</div><p class="detail-body">${highlighted(r.text)}</p><p class="detail-provenance">Review ID <strong>${esc(r.id)}</strong> · ${r.words} body words · US App Store<br>Source page ${r.page} · <a href="${source}" target="_blank" rel="noreferrer">Open original response JSON ↗</a><br>Topic labels are keyword matches, not verified sentiment.</p><div class="detail-actions"><button class="button primary" data-action="copy" data-id="${esc(r.id)}">Copy review & citation</button>${savedButton(r)}</div>`;
    $('evidence-note').value=evidence[id]?.note||'';
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
    if (focus) {$('detail-dialog').scrollTop=0;$('close-dialog').focus();}
  }
  function download(name,text,type) {
    const url=URL.createObjectURL(new Blob([text],{type}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  const csvCell = value => {
    let s=String(value??'');
    if (/^[=+\-@\t\r]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  $('export-btn').addEventListener('click',()=>{
    // Flush any pending search input before exporting the current selection.
    clearTimeout(searchTimer);readControls();
    const header=['review_id','date','stars','version','author','title','review','body_words','topic_tags','source_page','source_file','saved','research_note'];
    const data=filtered.map(r=>[r.id,r.date,r.stars,r.version,r.author,r.title,r.text,r.words,r.categories.map(id=>topics[id].name).join('; '),r.page,r.source,!!evidence[r.id],evidence[r.id]?.note||'']);
    download(`gossip-harbor-${filtered.length}-reviews.csv`,'\ufeff'+[header,...data].map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    toast(`Exported ${format(filtered.length)} matching reviews.`);
  });
  $('backup-btn').addEventListener('click',()=>{
    const items=Object.entries(evidence).map(([id,saved])=>{
      const {searchText,...review}=byId.get(id);return {review,...saved};
    });
    download('gossip-harbor-saved-evidence.json',JSON.stringify({appId:'1623318294',country:'us',exportedAt:new Date().toISOString(),items},null,2),'application/json');
    toast(`Exported ${format(items.length)} saved reviews with notes.`);
  });
  $('save-note').addEventListener('click',()=>{
    if (!detailId) return;
    evidence[detailId]={note:$('evidence-note').value,savedAt:evidence[detailId]?.savedAt||new Date().toISOString()};
    const stored=persist();render();openDetail(detailId,false);
    toast(stored?'Note and review saved.':'Saved for this session only. Export your evidence to keep it.');
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if (!button) return;
    const {action,id}=button.dataset;
    if (action==='save') toggleSaved(id);
    if (action==='detail') openDetail(id);
    if (action==='copy') copyEvidence(id);
  });
  $('active-filters').addEventListener('click',event=>{
    const button=event.target.closest('[data-remove]');if (!button) return;
    const value=button.dataset.remove;
    if (value.startsWith('star:')) document.querySelector(`[data-star="${value.slice(5)}"]`).checked=false;
    else if (value.startsWith('topic:')) document.querySelector(`[data-topic="${value.slice(6)}"]`).checked=false;
    else {
      const ids={q:'search',from:'date-from',to:'date-to',version:'version',minWords:'min-words',saved:'evidence-filter'};
      $(ids[value]).value=value==='minWords'?'0':value==='saved'?'all':'';
    }
    clearTimeout(searchTimer);readControls();
  });
  $('close-dialog').addEventListener('click',()=>$('detail-dialog').close());
  $('detail-dialog').addEventListener('click',event=>{if(event.target===$('detail-dialog')){
    const rect=$('detail-dialog').getBoundingClientRect();
    if (event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) $('detail-dialog').close();
  }});
  $('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(readControls,180);});
  for (const id of ['search-mode','category-mode','date-from','date-to','version','min-words','evidence-filter','sort','page-size']) $(id).addEventListener('change',readControls);
  $('stars').addEventListener('change',readControls);$('categories').addEventListener('change',readControls);
  for (const id of ['reset-btn','empty-reset']) $(id).addEventListener('click',reset);
  $('saved-shortcut').addEventListener('click',()=>{$('evidence-filter').value=$('evidence-filter').value==='saved'?'all':'saved';readControls();});
  $('prev-btn').addEventListener('click',()=>{state.page--;render();$('review-list').scrollIntoView({behavior:'smooth',block:'start'});});
  $('next-btn').addEventListener('click',()=>{state.page++;render();$('review-list').scrollIntoView({behavior:'smooth',block:'start'});});
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detail-dialog').open){event.preventDefault();$('search').focus();}
  });
  $('stars').innerHTML=[5,4,3,2,1].map(n=>`<label class="filter-row"><input type="checkbox" data-star="${n}" aria-label="${n} star reviews"><span class="star-label">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span><span class="facet-count">${format(reviews.filter(r=>r.stars===n).length)}</span></label>`).join('');
  $('categories').innerHTML=Object.entries(topics).map(([id,topic])=>`<label class="filter-row"><input type="checkbox" data-topic="${esc(id)}"><span class="topic-name">${esc(topic.name)}</span><span class="facet-count">${format(reviews.filter(r=>r.categories.includes(id)).length)}</span></label>`).join('')+`<label class="filter-row"><input type="checkbox" data-topic="untagged"><span class="topic-name">No topic tag</span><span class="facet-count">${format(reviews.filter(r=>!r.categories.length).length)}</span></label>`;
  const versions=[...new Set(reviews.map(r=>r.version))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  $('version').insertAdjacentHTML('beforeend',versions.map(v=>`<option value="${esc(v)}">Version ${esc(v)}</option>`).join(''));
  render();
  if(storageFailed) toast('Browser storage is unavailable. Use Export saved evidence to keep your notes.');
})();
