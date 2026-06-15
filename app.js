/* App: CRUD, localStorage, import/export for Guildou Awards */
const STORAGE_KEY = 'guildou:qa:v1';

document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('qaForm');
  const qId = document.getElementById('q-id');
  const qTitle = document.getElementById('q-title');
  const qAnswer = document.getElementById('q-answer');
  const qCat = document.getElementById('q-cat');
  const qNominee = document.getElementById('q-nominee');
  const qImportance = document.getElementById('q-importance');
  const resetBtn = document.getElementById('resetBtn');

  const qaList = document.getElementById('qaList');
  const search = document.getElementById('search');
  const exportBtn = document.getElementById('exportBtn');
  const exportResponses = document.getElementById('exportResponses');
  const modeAdmin = document.getElementById('modeAdmin');
  const modePublic = document.getElementById('modePublic');
  const publicPanel = document.getElementById('publicPanel');
  const listPanel = document.getElementById('listPanel');
  const previewPanel = document.getElementById('previewPanel');
  const publicForm = document.getElementById('publicForm');
  const surveyQuestions = document.getElementById('surveyQuestions');
  const publicReset = document.getElementById('publicReset');
  const logoutBtn = document.getElementById('logoutBtn');
  const importFile = document.getElementById('importFile');
  const clearAll = document.getElementById('clearAll');

  let data = loadData();
  renderList(data);

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const id = qId.value || idForNow();
    const item = {
      id,
      title: qTitle.value.trim(),
      answer: qAnswer.value.trim(),
      cat: qCat.value,
      nominee: qNominee.value.trim(),
      importance: qImportance.value
    };

    const idx = data.findIndex(x=>x.id===id);
    if(idx>=0) data[idx]=item; else data.unshift(item);
    saveData(data);
    renderList(data);
    form.reset(); qId.value='';
  });

  resetBtn.addEventListener('click', ()=>{ form.reset(); qId.value=''; });

  qaList.addEventListener('click', e=>{
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-delete]');
    if(edit){
      const id = edit.dataset.edit;
      const item = data.find(x=>x.id===id);
      if(!item) return;
      qId.value = item.id;
      qTitle.value = item.title;
      qAnswer.value = item.answer;
      qCat.value = item.cat;
      qNominee.value = item.nominee;
      qImportance.value = item.importance;
      window.scrollTo({top:0,behavior:'smooth'});
    }
    if(del){
      const id = del.dataset.delete;
      if(!confirm('Supprimer cette question ?')) return;
      data = data.filter(x=>x.id!==id);
      saveData(data);
      renderList(data);
    }
  });

  search.addEventListener('input', ()=>{
    const q = search.value.trim().toLowerCase();
    Array.from(qaList.children).forEach(li=>{
      const txt = li.dataset.search;
      li.style.display = txt.includes(q) ? '' : 'none';
    });
  });

  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'guildou-awards-questions.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // Export collected responses
  exportResponses.addEventListener('click', ()=>{
    const resp = loadResponses();
    const blob = new Blob([JSON.stringify(resp, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'guildou-awards-responses.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // Mode toggle
  function setMode(mode){
    const adminMode = mode==='admin';
    // Left column (admin form) only visible to admin
    document.querySelector('.left').style.display = adminMode ? '' : 'none';
    // Right column: show list + preview for admin, show public panel for public
    if(adminMode){
      if(listPanel) listPanel.style.display = '';
      if(previewPanel) previewPanel.style.display = '';
      publicPanel.style.display = 'none';
    }else{
      if(listPanel) listPanel.style.display = 'none';
      if(previewPanel) previewPanel.style.display = 'none';
      publicPanel.style.display = '';
    }
    modeAdmin.classList.toggle('active', adminMode);
    modePublic.classList.toggle('active', !adminMode);
    // hide admin-only controls (marked) when public; keep mode toggle visible
    Array.from(document.querySelectorAll('.top-actions .admin-only')).forEach(el=>{
      el.style.display = adminMode ? '' : 'none';
    });
    // render survey when entering public mode
    if(!adminMode) renderPublicSurvey(data);
  }

  modeAdmin.addEventListener('click', ()=>{
    if(isAdmin()) return setMode('admin');
    const pass = prompt('Mot de passe admin :');
    if(pass === null) return; // cancel
    const stored = localStorage.getItem('guildou:adminPass') || 'guildou';
    if(pass === stored){ setAdmin(true); setMode('admin'); }
    else alert('Mot de passe incorrect');
  });
  modePublic.addEventListener('click', ()=>setMode('public'));

  logoutBtn.addEventListener('click', ()=>{
    setAdmin(false);
    setMode('public');
  });

  // Public survey rendering & submission
  function renderPublicSurvey(items){
    surveyQuestions.innerHTML = '';
    if(items.length===0){ surveyQuestions.innerHTML = '<p>Aucune question disponible pour le moment.</p>'; return; }
    items.forEach(it=>{
      const div = document.createElement('div');
      div.className = 'survey-q';
      div.innerHTML = `
        <label>${escapeHtml(it.title)}</label>
        <div class="q-input"><textarea name="q_${it.id}" placeholder="Ta réponse..." rows="2"></textarea></div>
        <div class="qa-meta">Cat: ${escapeHtml(it.cat)} • Nominé: ${escapeHtml(it.nominee||'—')}</div>
      `;
      surveyQuestions.appendChild(div);
    });
  }

  publicForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const formData = new FormData(publicForm);
    const respondent = (formData.get('respondent')||'').toString().trim();
    const answers = [];
    data.forEach(it=>{
      const key = 'q_'+it.id;
      const val = (formData.get(key)||'').toString();
      answers.push({id:it.id, question:it.title, answer:val});
    });
    const resp = {id:idForNow(), timestamp:Date.now(), respondent, answers};
    const all = loadResponses(); all.unshift(resp); saveResponses(all);
    publicForm.reset(); alert('Merci — réponses enregistrées.');
  });

  publicReset.addEventListener('click', ()=>{ publicForm.reset(); });

  function saveResponses(arr){ localStorage.setItem('guildou:responses:v1', JSON.stringify(arr)); }
  function loadResponses(){ try{ const r = localStorage.getItem('guildou:responses:v1'); return r?JSON.parse(r):[]; }catch(e){return[];} }

  // initialize default mode = admin
  // admin session helpers
  function isAdmin(){ return sessionStorage.getItem('guildou:admin') === '1'; }
  function setAdmin(flag){
    if(flag) sessionStorage.setItem('guildou:admin','1'); else sessionStorage.removeItem('guildou:admin');
    logoutBtn.style.display = flag ? '' : 'none';
  }

  // restore admin state if present
  if(isAdmin()) setMode('admin'); else setMode('public');

  importFile.addEventListener('change', (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result);
        if(!Array.isArray(imported)) throw new Error('Format invalide');
        data = imported.concat(data);
        saveData(data);
        renderList(data);
        importFile.value='';
      }catch(err){ alert('Impossible d\'importer le fichier : '+err.message); }
    };
    reader.readAsText(f);
  });

  clearAll.addEventListener('click', ()=>{
    if(!confirm('Supprimer toutes les questions ?')) return;
    data = [];
    saveData(data);
    renderList(data);
  });

  function renderList(items){
    qaList.innerHTML='';
    if(items.length===0){
      qaList.innerHTML = '<li class="qa-empty">Aucune question — commencez en ajoutant une.</li>';
      return;
    }
    items.forEach(it=>{
      const li = document.createElement('li');
      li.className = 'qa-item';
      li.dataset.search = (it.title+' '+it.answer+' '+(it.nominee||'')+' '+it.cat).toLowerCase();
      li.innerHTML = `
        <div>
          <div style="font-weight:700;color:#fff">${escapeHtml(it.title)}</div>
          <div class="qa-meta">${escapeHtml(it.nominee||'—')} • ${escapeHtml(it.cat)} • ★${it.importance}</div>
          <div style="margin-top:8px;color:var(--muted);font-size:13px">${escapeHtml(it.answer||'')}</div>
        </div>
        <div class="qa-actions">
          <button data-edit="${it.id}">Éditer</button>
          <button data-delete="${it.id}">Supprimer</button>
        </div>
      `;
      qaList.appendChild(li);
    });
  }

  function loadData(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){/* ignore */}
    // seed sample data
    return [
      {id:idForNow(),title:'Qui a oublié le pull de raid ?',answer:'Le pull catastrophe du dimanche soir.',cat:'raid',nominee:'Zorg',importance:'3'},
      {id:idForNow(),title:'Meilleure excuse pour wipe',answer:'Lag + mojo perdu',cat:'humour',nominee:'Luna',importance:'2'}
    ];
  }

  function saveData(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

  function idForNow(){ return 'id_'+Math.random().toString(36).slice(2,9); }

  function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
});
