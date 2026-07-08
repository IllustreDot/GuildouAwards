/* App: CRUD, localStorage, import/export for Guildou Awards */
const STORAGE_KEY = 'guildou:qa:v1';

document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('qaForm');
  const qId = document.getElementById('q-id');
  const qTitle = document.getElementById('q-title');
  const qChoices = document.getElementById('q-choices');
  // category removed — no qCat
  const resetBtn = document.getElementById('resetBtn');

  const qaList = document.getElementById('qaList');
  const search = document.getElementById('search');
  const exportBtn = document.getElementById('exportBtn');
  const exportResponses = document.getElementById('exportResponses');
  const modeAdmin = document.getElementById('modeAdmin');
  const modePublic = document.getElementById('modePublic');
  const publicPanel = document.getElementById('publicPanel');
  const listPanel = document.getElementById('listPanel');
  const hintPanel = document.querySelector('.panel.hint');
  const layout = document.querySelector('.layout');
  const publicForm = document.getElementById('publicForm');
  const surveyQuestions = document.getElementById('surveyQuestions');
  const publicReset = document.getElementById('publicReset');
  const resultsPanel = document.getElementById('resultsPanel');
  const resultsContainer = document.getElementById('resultsContainer');
  const participantsList = document.getElementById('participantsList');
  const logoutBtn = document.getElementById('logoutBtn');
  const importFile = document.getElementById('importFile');
  const clearAll = document.getElementById('clearAll');

  const qMediaUrl = document.getElementById('q-media-url');
  const qMediaFile = document.getElementById('q-media-file');
  const qMediaSelect = document.getElementById('q-media-select');
  const refreshImgListBtn = document.getElementById('refreshImgListBtn');
  const imgListStatus = document.getElementById('imgListStatus');
  const optionsContainer = document.getElementById('optionsContainer');
  const addOptionBtn = document.getElementById('addOptionBtn');

  let localImageList = [];
  let firebaseDb = null;
  let firebaseEnabled = false;

  function setStatusMessage(message){
    const statusEl = document.getElementById('statusMessage');
    if(statusEl) statusEl.textContent = message || '';
  }

  function initFirebase(){
    const config = window.FIREBASE_CONFIG || null;
    if(!config || typeof firebase === 'undefined' || !firebase.firestore) return;
    try{
      firebase.initializeApp(config);
      firebaseDb = firebase.firestore();
      firebaseEnabled = true;
    }catch(err){
      console.warn('Firebase init failed', err);
      firebaseEnabled = false;
    }
  }

  function isFirebaseEnabled(){
    return firebaseEnabled && firebaseDb;
  }

  function saveQuestionToFirebase(item){
    if(!isFirebaseEnabled()) return Promise.resolve();
    return firebaseDb.collection('questions').doc(item.id).set({
      ...item,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
      console.error('Firebase question save failed', error);
      setStatusMessage('Erreur Firebase question : ' + (error.message || error));
      throw error;
    });
  }

  function saveResponseToFirebase(resp){
    if(!isFirebaseEnabled()) return Promise.resolve();
    return firebaseDb.collection('responses').doc(resp.id).set({
      ...resp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
      console.error('Firebase response save failed', error);
      setStatusMessage('Erreur Firebase réponse : ' + (error.message || error));
      throw error;
    });
  }

  async function loadFirebaseQuestions(){
    if(!isFirebaseEnabled()) return [];
    const snapshot = await firebaseDb.collection('questions').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
  }

  async function loadFirebaseResponses(){
    if(!isFirebaseEnabled()) return [];
    const snapshot = await firebaseDb.collection('responses').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
  }

  async function loadFirebaseAggregated(){
    try {
      const responses = await loadFirebaseResponses();
      const summary = {byQuestion:{}, respondents:[]};
      responses.forEach(resp => {
        if(resp.respondent){
          if(!summary.respondents.includes(resp.respondent)) summary.respondents.push(resp.respondent);
        }
        if(!Array.isArray(resp.answers)) return;
        resp.answers.forEach(answer => {
          const qid = answer.id;
          const raw = answer.answer;
          const key = raw === null || raw === undefined || raw === '' ? '__empty__' : String(raw);
          summary.byQuestion[qid] = summary.byQuestion[qid] || {counts:{}, total:0};
          summary.byQuestion[qid].counts[key] = (summary.byQuestion[qid].counts[key]||0) + 1;
          summary.byQuestion[qid].total += 1;
        });
      });
      return summary;
    } catch (error) {
      console.warn('Firebase aggregated load failed', error);
      setStatusMessage('Firebase inaccessible : utilisation du mode local.');
      firebaseEnabled = false;
      return loadAggregated();
    }
  }

  function populateSelectWithImages(select, list){
    if(!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Aucune --</option>';
    list.forEach(fn=>{ const opt = document.createElement('option'); opt.value = 'img/'+fn; opt.textContent = fn; select.appendChild(opt); });
    if(current) select.value = current;
    select.disabled = list.length === 0;
  }

  function updateAllLocalMediaSelects(){
    if(qMediaSelect) populateSelectWithImages(qMediaSelect, localImageList);
    document.querySelectorAll('.opt-media select').forEach(select=> populateSelectWithImages(select, localImageList));
  }

  function setImgListStatus(message){ if(imgListStatus) imgListStatus.textContent = message; }

  // Modal helper to replace native alerts
  function showModal(title, message){
    try{
      const siteModal = document.getElementById('siteModal');
      const siteModalTitle = document.getElementById('siteModalTitle');
      const siteModalBody = document.getElementById('siteModalBody');
      const siteModalOk = document.getElementById('siteModalOk');
      const siteModalCancel = document.getElementById('siteModalCancel');
      if(!siteModal) return Promise.resolve();
      siteModalTitle.textContent = title || '';
      siteModalBody.textContent = message || '';
      // ensure cancel hidden for simple modal
      if(siteModalCancel) siteModalCancel.style.display = 'none';
      siteModal.setAttribute('aria-hidden','false');
      siteModalOk.focus();
      return new Promise(resolve=>{
        function close(){ siteModal.setAttribute('aria-hidden','true'); siteModalOk.removeEventListener('click', onOk); if(siteModalCancel) siteModalCancel.removeEventListener('click', onCancel); document.removeEventListener('keydown', onKey); resolve(); }
        function onOk(){ close(); }
        function onCancel(){ close(); }
        function onKey(e){ if(e.key === 'Escape') close(); }
        siteModalOk.addEventListener('click', onOk);
        if(siteModalCancel) siteModalCancel.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
      });
    }catch(e){ return Promise.resolve(); }
  }

  // Confirmation modal (returns true if confirmed, false if cancelled)
  function showConfirm(title, message){
    try{
      const siteModal = document.getElementById('siteModal');
      const siteModalTitle = document.getElementById('siteModalTitle');
      const siteModalBody = document.getElementById('siteModalBody');
      const siteModalOk = document.getElementById('siteModalOk');
      const siteModalCancel = document.getElementById('siteModalCancel');
      if(!siteModal) return Promise.resolve(false);
      siteModalTitle.textContent = title || '';
      siteModalBody.textContent = message || '';
      if(siteModalCancel) siteModalCancel.style.display = '';
      siteModal.setAttribute('aria-hidden','false');
      // focus Cancel to make accidental confirmations less likely
      (siteModalCancel || siteModalOk).focus();
      return new Promise(resolve=>{
        function cleanup(){ siteModal.setAttribute('aria-hidden','true'); siteModalOk.removeEventListener('click', onOk); if(siteModalCancel) siteModalCancel.removeEventListener('click', onCancel); document.removeEventListener('keydown', onKey); }
        function onOk(){ cleanup(); resolve(true); }
        function onCancel(){ cleanup(); resolve(false); }
        function onKey(e){ if(e.key === 'Escape'){ cleanup(); resolve(false); } }
        siteModalOk.addEventListener('click', onOk);
        if(siteModalCancel) siteModalCancel.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
      });
    }catch(e){ return Promise.resolve(false); }
  }

  function normalizeImageFilename(name){
    if(!name || typeof name !== 'string') return '';
    let fn = name.trim().replace(/\\/g, '/').split('?')[0].split('#')[0];
    fn = fn.replace(/^\/+/,'').replace(/^img\//i, '');
    const parts = fn.split('/').filter(Boolean);
    fn = parts.length ? parts[parts.length - 1] : '';
    return fn;
  }

  function isImageFilename(name){
    const fn = normalizeImageFilename(name);
    const ext = fn.split('.').pop().toLowerCase();
    return ['png','jpg','jpeg','gif','webp','avif','svg'].includes(ext);
  }

  function detectGithubRepo(){
    const explicit = document.body.dataset.githubRepo;
    if(explicit){
      const parts = explicit.split('/').map(part=>part.trim()).filter(Boolean);
      if(parts.length === 2) return {owner: parts[0], repo: parts[1]};
    }
    const host = window.location.hostname;
    if(host.endsWith('.github.io')){
      const owner = host.slice(0, -'.github.io'.length);
      const segments = window.location.pathname.split('/').filter(Boolean);
      const repo = segments.length ? segments[0] : owner;
      if(owner && repo) return {owner, repo};
    }
    return null;
  }

  async function fetchGithubImages(){
    const repo = detectGithubRepo();
    if(!repo) return [];
    for(const branch of ['main','master']){
      try{
        const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/img?ref=${branch}`;
        const res = await fetch(url, {cache:'no-store'});
        if(!res.ok) continue;
        const json = await res.json();
        if(Array.isArray(json)){
          return json.filter(item=>item && item.type==='file' && item.name).map(item=>item.name);
        }
      }catch(e){}
    }
    return [];
  }

  function parseImageListFromHtml(html){
    const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"/gi)];
    const found = new Set();
    matches.forEach(match=>{
      const rawHref = match[1];
      const href = rawHref.split('?')[0].split('#')[0];
      if(!href || href.endsWith('/')) return;
      const filename = normalizeImageFilename(href);
      if(isImageFilename(filename)) found.add(filename);
    });
    return Array.from(found).sort();
  }

  function loadLocalImageDir(){
    return fetch('img/', {cache:'no-store'}).then(r=>{
      if(!r.ok) return [];
      const contentType = r.headers.get('content-type') || '';
      if(!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return [];
      return r.text().then(text=> parseImageListFromHtml(text));
    }).catch(()=>[]);
  }

  function loadManifestImages(){
    return fetch('img/manifest.json?t=' + Date.now(), {cache:'no-store'}).then(r=>{
      if(!r.ok) return [];
      return r.json();
    }).then(list=>{
      if(!Array.isArray(list)) return [];
      return list.map(normalizeImageFilename).filter(name=>name && isImageFilename(name));
    }).catch(()=>[]);
  }

  function refreshLocalImages(){
    setImgListStatus('Recherche des images locales...');
    return Promise.all([loadManifestImages(), loadLocalImageDir(), fetchGithubImages()]).then(results=>{
      const allImages = new Set();
      results.forEach(list=>{
        if(Array.isArray(list)){
          list.forEach(fn=>{
            const filename = normalizeImageFilename(fn);
            if(filename && isImageFilename(filename)) allImages.add(filename);
          });
        }
      });
      localImageList = Array.from(allImages).sort();
      updateAllLocalMediaSelects();
      if(localImageList.length){
        setImgListStatus(`${localImageList.length} image${localImageList.length > 1 ? 's' : ''} locale${localImageList.length > 1 ? 's' : ''} trouvée${localImageList.length > 1 ? 's' : ''}.`);
      }else{
        setImgListStatus('Aucune image locale trouvée dans img/. Ajoute des fichiers ou crée un manifest.json.');
      }
    }).catch(()=>{
      setImgListStatus('Impossible de charger les images locales.');
      localImageList = [];
      updateAllLocalMediaSelects();
    });
  }

  // holds DataURL when a file is selected for media
  let mediaDataUrl = '';
  // original file size when reading a file (bytes)
  let mediaFileSize = 0;
  // limits
  const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB
  const MAX_DATAURL_CHARS = 14 * 1024 * 1024; // conservative char length for data URLs

  let data = [];
  async function initApp(){
    initFirebase();
    if(isFirebaseEnabled()){
      try{
        const remoteQuestions = await loadFirebaseQuestions();
        if(Array.isArray(remoteQuestions) && remoteQuestions.length){
          data = remoteQuestions;
        } else {
          data = loadData();
          setStatusMessage('');
        }
      } catch (error) {
        console.warn('Firebase questions unavailable', error);
        setStatusMessage('Firebase inaccessible : utilisation du mode local.');
        firebaseEnabled = false;
        data = loadData();
      }
    } else {
      data = loadData();
      setStatusMessage('');
    }
    renderList(data);

    if(qMediaSelect){
      refreshLocalImages();
      qMediaSelect.addEventListener('change', ()=>{
        const v = qMediaSelect.value;
        if(v){ qMediaUrl.value = v; }
      });
      if(refreshImgListBtn){ refreshImgListBtn.addEventListener('click', refreshLocalImages); }
    }
  }

  const initAppPromise = initApp();

  // option editor helpers (advanced options)
  function createOptionRow(opt){
    const row = document.createElement('div'); row.className = 'option-row';
    const txt = document.createElement('input'); txt.type='text'; txt.placeholder="Texte de l'option"; txt.value = (opt && opt.text) ? opt.text : ''; txt.name='opt-text';
    const mediaUrl = document.createElement('input'); mediaUrl.type='text'; mediaUrl.placeholder='URL media (ou sélectionner)'; mediaUrl.style.width='240px'; mediaUrl.value = (opt && opt.media && opt.media.src) ? opt.media.src : ''; mediaUrl.name='opt-media';
    const remove = document.createElement('button'); remove.type='button'; remove.className='remove-opt'; remove.textContent='Supprimer';
    const mediaHidden = document.createElement('input'); mediaHidden.type='hidden';

    remove.addEventListener('click', ()=>{ row.remove(); });

    const mediaSelectLocal = document.createElement('select'); mediaSelectLocal.style.marginLeft='6px';
    populateSelectWithImages(mediaSelectLocal, localImageList);
    mediaSelectLocal.addEventListener('change', ()=>{ if(mediaSelectLocal.value){ mediaUrl.value = mediaSelectLocal.value; mediaHidden.value=''; } });

    const mediaWrap = document.createElement('div'); mediaWrap.className='opt-media'; mediaWrap.appendChild(mediaUrl); mediaWrap.appendChild(mediaSelectLocal);
    // append in order: text, media controls, remove button, hidden
    row.appendChild(txt); row.appendChild(mediaWrap); row.appendChild(remove); row.appendChild(mediaHidden);
    return row;
  }
  if(addOptionBtn){ addOptionBtn.addEventListener('click', ()=>{ const r = createOptionRow(null); optionsContainer.appendChild(r); }); }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const id = qId.value || idForNow();
    const item = {
      id,
      title: qTitle.value.trim(),
      // always choice-type questions
      type: 'choice',
      choices: (qChoices && qChoices.value) ? qChoices.value.split('|').map(s=>s.trim()).filter(Boolean) : []
    };
    // attach media if provided (auto-detect type) with size guards
    let mediaSrc = (mediaDataUrl && mediaDataUrl.length) ? mediaDataUrl : (qMediaUrl && qMediaUrl.value ? qMediaUrl.value.trim() : '');
    if(mediaSrc){
      // if it's a data URL, estimate size from original file size when available or from base64 length
      let approxBytes = mediaFileSize || 0;
      if(!approxBytes && mediaSrc.indexOf('data:')===0){
        const comma = mediaSrc.indexOf(',');
        if(comma>-1){ approxBytes = Math.floor((mediaSrc.length - comma - 1) * 3 / 4); }
      }
      if(approxBytes > MAX_MEDIA_BYTES || mediaSrc.length > MAX_DATAURL_CHARS){
        showModal('Erreur', 'Le media est trop volumineux pour être stocké localement (limite 5MB). Utilise une URL externe ou enlève le media.');
        mediaSrc = '';
      }
    }
    const mediaTypeDetected = detectMediaType(mediaSrc);
    if(mediaTypeDetected && mediaSrc) item.media = {type: mediaTypeDetected, src: mediaSrc};

    // advanced per-option editor: if options are present, build structured choices
    if(optionsContainer && optionsContainer.children.length){
      const opts = [];
      Array.from(optionsContainer.children).forEach(row=>{
        const txtInputs = row.querySelectorAll('input[type=text]');
        const text = (txtInputs && txtInputs[0]) ? txtInputs[0].value.trim() : '';
        const mediaHidden = (row.querySelector('input[type=hidden]')||{value:''}).value || '';
        const mediaUrlVal = (txtInputs && txtInputs[1]) ? (txtInputs[1].value.trim() || '') : '';
        let mediaSrcOpt = mediaHidden || mediaUrlVal || '';
        if(mediaSrcOpt) mediaSrcOpt = normalizeImageUrl(mediaSrcOpt);
        const mtype = detectMediaType(mediaSrcOpt);
        opts.push({text, media: mediaSrcOpt ? {type: mtype, src: mediaSrcOpt} : null});
      });
      if(opts.length) item.choices = opts;
    }

    const idx = data.findIndex(x=>x.id===id);
    if(idx>=0) data[idx]=item; else data.unshift(item);
    // try saving local data and sync to Firebase when available
    try{
      saveData(data);
      renderList(data);
      saveQuestionToFirebase(item).catch(()=>{});
    }catch(err){
      // localStorage quota exceeded -> try removing media and retry
      if(err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)){
        if(item && item.media){
          delete item.media;
          try{ saveData(data); renderList(data); showModal('Erreur', 'Espace de stockage insuffisant : le media a été retiré de la question avant sauvegarde.'); }
          catch(e){
            // still failing - rollback
            data = data.filter(x=>x.id!==id);
            renderList(data);
            showModal('Erreur', 'Impossible de sauvegarder la question en raison d\'un quota de stockage. Veuillez exporter/vider des données existantes.');
          }
        }else{
          // no media to remove, rollback
          data = data.filter(x=>x.id!==id);
          renderList(data);
          showModal('Erreur', 'Impossible de sauvegarder la question en raison d\'un quota de stockage. Veuillez exporter/vider des données existantes.');
        }
      }else{
        throw err;
      }
    }
    // reset search filter so newly added/edited item is visible
    if(search){ search.value = ''; search.dispatchEvent(new Event('input')); }
    // ensure list panel is visible for admins
    if(isAdmin() && listPanel) listPanel.style.display = '';
    form.reset(); qId.value='';
    // reset media inputs/state
    mediaDataUrl = '';
    if(qMediaUrl) qMediaUrl.value = '';
    if(qMediaFile) qMediaFile.value = '';
    saveQuestionToFirebase(item).catch(()=>{});
  });

  resetBtn.addEventListener('click', ()=>{ form.reset(); qId.value=''; });

  qaList.addEventListener('click', async e=>{
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-delete]');
    if(edit){
      const id = edit.dataset.edit;
      const item = data.find(x=>x.id===id);
      if(!item) return;
      qId.value = item.id;
      qTitle.value = item.title;
      // clear advanced options
      if(optionsContainer) optionsContainer.innerHTML = '';
      if(Array.isArray(item.choices) && item.choices.length){
        if(typeof item.choices[0] === 'string'){
          if(qChoices) qChoices.value = item.choices.join(' | ');
        }else{
          if(qChoices) qChoices.value = '';
          item.choices.forEach(c=>{ const r = createOptionRow(c); optionsContainer.appendChild(r); });
        }
      }
      // populate media fields when editing (question-level media)
      if(item.media){
        if(item.media.src && item.media.src.indexOf('data:')===0){ mediaDataUrl = item.media.src; if(qMediaUrl) qMediaUrl.value = ''; }
        else{ if(qMediaUrl) qMediaUrl.value = item.media.src || ''; mediaDataUrl = ''; }
      }else{ if(qMediaUrl) qMediaUrl.value = ''; mediaDataUrl = ''; }
      window.scrollTo({top:0,behavior:'smooth'});
    }
    if(del){
      const id = del.dataset.delete;
      const ok = await showConfirm('Supprimer', 'Supprimer cette question ?');
      if(!ok) return;
      data = data.filter(x=>x.id!==id);
      saveData(data);
      renderList(data);
      // if Firebase is enabled, questions will be synced there as well
      if(isFirebaseEnabled()){
        firebaseDb.collection('questions').doc(id).delete().catch(()=>{});
      }
    }
  });

  search.addEventListener('input', ()=>{
    const q = search.value.trim().toLowerCase();
    Array.from(qaList.children).forEach(li=>{
      const txt = li.dataset.search;
      li.style.display = txt.includes(q) ? '' : 'none';
    });
  });

  if(exportBtn) exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'guildou-awards-questions.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // Export collected responses
  if(exportResponses) exportResponses.addEventListener('click', ()=>{
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
      // hide hint when in admin mode
      if(hintPanel) hintPanel.style.display = 'none';
      publicPanel.style.display = 'none';
      publicPanel.classList.remove('visible');
      if(resultsPanel) resultsPanel.style.display = '';
      // refresh results view
      renderAdminResults();
      if(layout) layout.classList.remove('public-open');
    }else{
      if(listPanel) listPanel.style.display = 'none';
      if(resultsPanel) resultsPanel.style.display = 'none';
      // hint visible in public mode
      if(hintPanel) hintPanel.style.display = '';
      publicPanel.style.display = '';
      publicPanel.classList.add('visible');
      if(layout) layout.classList.add('public-open');
    }
    modeAdmin.classList.toggle('active', adminMode);
    modePublic.classList.toggle('active', !adminMode);
    // hide admin-only controls (marked) when public; keep mode toggle visible
    Array.from(document.querySelectorAll('.top-actions .admin-only')).forEach(el=>{
      el.style.display = adminMode ? '' : 'none';
    });
    // render survey when entering public mode
    if(!adminMode) renderPublicSurvey(data);
    // adjust spacing after mode change
    requestAnimationFrame(adjustPublicPanelSpacing);
  }

  modeAdmin.addEventListener('click', ()=>{
    if(isAdmin()) return setMode('admin');
    const pass = prompt('Mot de passe admin :');
    if(pass === null) return; // cancel
    const stored = localStorage.getItem('guildou:adminPass') || 'guildou';
    if(pass === stored){
      sessionStorage.setItem('guildou:adminSecret', pass);
      setAdmin(true);
      setMode('admin');
    } else showModal('Erreur', 'Mot de passe incorrect');
  });
  modePublic.addEventListener('click', ()=>setMode('public'));

  if(logoutBtn) logoutBtn.addEventListener('click', ()=>{
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

      const left = document.createElement('div');
      left.className = 'survey-content';
      let inputHtml = '';
      if(Array.isArray(it.choices) && it.choices.length){
        // structured choices with media
        if(typeof it.choices[0] === 'object'){
              inputHtml = '<div class="q-input">' + it.choices.map((c,idx)=>{
                return `<label class="choice-item"><input type="radio" name="q_${it.id}" value="${idx}" required> ${escapeHtml(c.text)}</label>`;
              }).join('') + '</div>';
        }else{
              inputHtml = '<div class="q-input">' + it.choices.map((c,idx)=>{
                return `<label class="choice-item"><input type="radio" name="q_${it.id}" value="${idx}" required> ${escapeHtml(c)}</label>`;
              }).join('') + '</div>';
        }
      }else{
            inputHtml = `<div class="q-input"><textarea name="q_${it.id}" placeholder="Ta réponse..." rows="2" required></textarea></div>`;
      }
      left.innerHTML = `\n        <label>${escapeHtml(it.title)}</label>\n        ${inputHtml}\n      `;

      div.appendChild(left);

      // if choices are objects with media, build a slider of option media
      if(Array.isArray(it.choices) && it.choices.length && typeof it.choices[0] === 'object'){
        const slides = [];
        it.choices.forEach((c, idx)=>{ if(c.media && c.media.src){ slides.push({idx, src:c.media.src, type:c.media.type, caption:c.text}); } });
        if(slides.length){
          const slider = document.createElement('div'); slider.className = 'slider';
          const slidesWrap = document.createElement('div'); slidesWrap.className = 'slides';
          slides.forEach(s=>{
            const slide = document.createElement('div'); slide.className = 'slide';
            slide.style.width = '100%';
            slide.style.height = '100%';
            if(s.type==='youtube'){
              const iframe = document.createElement('iframe');
              iframe.src = youtubeEmbedUrl(s.src) || s.src;
              iframe.frameBorder = '0';
              iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
              iframe.allowFullscreen = true;
              iframe.width = '100%';
              iframe.height = '100%';
              iframe.style.objectFit = 'contain';
              slide.appendChild(iframe);
            }else if(s.type==='video' || (s.src.indexOf('video/')>-1)){
              const v = document.createElement('video');
              v.controls = true; v.src = s.src;
              v.style.maxWidth = '100%';
              v.style.maxHeight = '100%';
              v.style.width = 'auto';
              v.style.height = 'auto';
              v.style.objectFit = 'contain';
              slide.appendChild(v);
            }else{
              const img = document.createElement('img');
              img.src = normalizeImageUrl(s.src);
              img.alt = s.caption || '';
              img.style.maxWidth = '100%';
              img.style.maxHeight = '100%';
              img.style.width = 'auto';
              img.style.height = 'auto';
              img.style.objectFit = 'contain';
              img.style.objectPosition = 'center';
              slide.appendChild(img);
            }
            slidesWrap.appendChild(slide);
          });
          slider.appendChild(slidesWrap);
          const controls = document.createElement('div'); controls.className = 'slider-controls';
          const btnL = document.createElement('button'); btnL.type='button'; btnL.className='slider-btn left'; btnL.textContent='<';
          const captionEl = document.createElement('div'); captionEl.className = 'slider-caption';
          const btnR = document.createElement('button'); btnR.type='button'; btnR.className='slider-btn right'; btnR.textContent='>';
          controls.appendChild(btnL);
          controls.appendChild(captionEl);
          controls.appendChild(btnR);
          slider.appendChild(controls);
          const mediaWrap = document.createElement('div'); mediaWrap.className = 'survey-media';
          mediaWrap.appendChild(slider);
          div.appendChild(mediaWrap);
          // slider logic
          let cur = 0; const max = slides.length;
          Array.from(slidesWrap.children).forEach(s=>{ s.style.flex = '0 0 100%'; });
          function show(i){
            cur = (i+max)%max;
            Array.from(slidesWrap.children).forEach((slide, idx)=>{
              slide.classList.toggle('active', idx === cur);
            });
            captionEl.textContent = slides[cur].caption || '';
          }
          btnL.addEventListener('click', ()=>{ show(cur-1); });
          btnR.addEventListener('click', ()=>{ show(cur+1); });
          // default show first
          show(0);
          // when radio changes, move to corresponding slide if exists
          left.querySelectorAll('input[type=radio]').forEach(r=>{
            r.addEventListener('change',(ev)=>{
              const val = ev.target.value; const idx = parseInt(val,10);
              const sIndex = slides.findIndex(s=>s.idx===idx);
              if(sIndex>=0) show(sIndex);
            });
          });
          // attach media load listeners
          slider.querySelectorAll('img,video,iframe').forEach(el=>{ el.addEventListener('load', adjustPublicPanelSpacing); el.addEventListener('loadedmetadata', adjustPublicPanelSpacing); });
        }
      }else{
        // fallback: single question-level media
        if(it.media && it.media.src){
          const mediaWrap = document.createElement('div');
          mediaWrap.className = 'survey-media';
          if(it.media.type === 'youtube'){
            const embed = youtubeEmbedUrl(it.media.src);
            if(embed){
              const iframe = document.createElement('iframe');
              iframe.src = embed;
              iframe.width = '100%';
              iframe.height = '100%';
              iframe.frameBorder = '0';
              iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
              iframe.allowFullscreen = true;
              iframe.style.objectFit = 'contain';
              mediaWrap.appendChild(iframe);
            }else{
              const link = document.createElement('a'); link.href = it.media.src; link.textContent = 'Voir la vidéo'; link.target = '_blank'; mediaWrap.appendChild(link);
            }
          }else if(it.media.type==='video' || (it.media.src.indexOf('video/')>-1)){
            const v = document.createElement('video');
            v.controls = true; v.src = it.media.src;
            v.style.objectFit = 'contain';
            mediaWrap.appendChild(v);
          }else{
            const img = document.createElement('img');
            img.src = normalizeImageUrl(it.media.src);
            img.alt = it.title || 'media';
            mediaWrap.appendChild(img);
          }
          div.appendChild(mediaWrap);
          const mediaEl = mediaWrap.querySelector('img,video,iframe');
          if(mediaEl){ mediaEl.addEventListener('load', adjustPublicPanelSpacing); mediaEl.addEventListener('loadedmetadata', adjustPublicPanelSpacing); }
        }
      }

      surveyQuestions.appendChild(div);
    });
    // adjust spacing after rendering
    requestAnimationFrame(adjustPublicPanelSpacing);
  }

  publicForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    // Let browser show validation errors if any
    if(!publicForm.reportValidity()) return;
    const formData = new FormData(publicForm);
    const respondent = (formData.get('respondent')||'').toString().trim();
    const answers = [];
    const aggregated = {};
    data.forEach(it=>{
      const key = 'q_'+it.id;
      const rawVal = formData.get(key);
      const val = rawVal === null ? '' : rawVal.toString();
      answers.push({id:it.id, question:it.title, answer:val});
      // count by index (val should be index for choices)
      if(!aggregated[it.id]) aggregated[it.id] = {};
      const k = val === '' ? '__empty__' : val;
      aggregated[it.id][k] = (aggregated[it.id][k]||0) + 1;
    });
    // store full submission (without linking respondent to answers in results display)
    const resp = {id:idForNow(), timestamp:Date.now(), respondent, answers};
    const all = loadResponses(); all.unshift(resp); saveResponses(all);
    // update results aggregation store
    updateAggregatedResults(aggregated, respondent);
    try{
      await saveResponseToFirebase(resp);
    }catch(e){
      console.warn('Firebase response save failed during submit', e);
    }
    publicForm.reset(); showModal('Merci', 'Réponses enregistrées.');
    // refresh admin results if visible
    if(resultsPanel && resultsPanel.style.display !== 'none') renderAdminResults();
  });

  // No type toggle: questions are always choice-type.

  if(publicReset) publicReset.addEventListener('click', ()=>{ publicForm.reset(); });

  // Aggregated results stored separately for quick admin view
  function loadAggregated(){ try{ const r = localStorage.getItem('guildou:results:v1'); return r?JSON.parse(r):{byQuestion:{},respondents:[]}; }catch(e){return{byQuestion:{},respondents:[]};} }
  function saveAggregated(obj){ localStorage.setItem('guildou:results:v1', JSON.stringify(obj)); }

  function updateAggregatedResults(aggByQ, respondent){
    const store = loadAggregated();
    // merge counts
    Object.keys(aggByQ).forEach(qid=>{
      store.byQuestion[qid] = store.byQuestion[qid] || {counts:{}, total:0};
      const dest = store.byQuestion[qid];
      Object.keys(aggByQ[qid]).forEach(k=>{ dest.counts[k] = (dest.counts[k]||0) + aggByQ[qid][k]; dest.total = (dest.total||0) + aggByQ[qid][k]; });
    });
    // add respondent to list (no association)
    if(respondent){ store.respondents = store.respondents || []; if(!store.respondents.includes(respondent)) store.respondents.push(respondent); }
    saveAggregated(store);
  }

  async function renderAdminResults(){
    if(!resultsContainer) return;
    resultsContainer.innerHTML = '';
    let agg;
    try {
      agg = isFirebaseEnabled() ? await loadFirebaseAggregated() : loadAggregated();
    } catch (error) {
      console.warn('Admin results load failed', error);
      setStatusMessage('Résultats Firebase indisponibles, affichage local.');
      agg = loadAggregated();
    }
    // participants summary at top
    const participants = (agg.respondents || []);
    if(participantsList) participantsList.innerHTML = participants.length ? `<strong>Participants (${participants.length}):</strong> ${participants.join(', ')}` : '<em>Aucun participant pour l\'instant</em>';
    if(!data || !data.length){ resultsContainer.innerHTML = '<div>Aucune question.</div>'; return; }
    data.forEach(it=>{
      const wrap = document.createElement('div'); wrap.className = 'result-block';
      const titleWrap = document.createElement('div'); titleWrap.style.flex = '1';
      const title = document.createElement('h3'); title.textContent = it.title; titleWrap.appendChild(title);
      const list = document.createElement('div'); list.className = 'result-list';
      const stats = agg.byQuestion && agg.byQuestion[it.id] ? agg.byQuestion[it.id] : {counts:{}, total:0};
      const total = stats.total || 0;
      if(Array.isArray(it.choices) && it.choices.length){
        it.choices.forEach((c, idx)=>{
          const key = String(idx);
          const count = stats.counts[key] || 0;
          const pct = total ? Math.round((count/total)*100) : 0;
          const row = document.createElement('div'); row.className = 'result-row'; row.textContent = `${escapeHtml(typeof c === 'object' ? c.text : c)} — ${pct}% (${count})`;
          list.appendChild(row);
        });
      }else{
        // free text answers breakdown: show top answers
        const entries = Object.entries(stats.counts||{}).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,10);
        entries.forEach(en=>{ const pct = total ? Math.round((en.v/total)*100) : 0; const row = document.createElement('div'); row.className='result-row'; row.textContent = `${en.k} — ${pct}% (${en.v})`; list.appendChild(row); });
      }
      // canvas pie
      const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200;
      wrap.appendChild(canvas);
      wrap.appendChild(titleWrap);
      wrap.appendChild(list);
      resultsContainer.appendChild(wrap);
      // draw pie
      drawPieChart(canvas, it, stats);
    });
  }

  function drawPieChart(canvas, question, stats){
    const ctx = canvas.getContext('2d'); if(!ctx) return;
    const total = stats.total || 0; ctx.clearRect(0,0,canvas.width,canvas.height);
    const centerX = canvas.width/2; const centerY = canvas.height/2; const radius = Math.min(centerX, centerY) - 10;
    let start = -Math.PI/2;
    const colors = ['#fbbf24','#7c3aed','#00e5ff','#ff6b6b','#ffd166','#6bcB77','#f78fb3','#4d96ff'];
    const entries = (Array.isArray(question.choices) ? question.choices.map((c,idx)=>({label: typeof c==='object'?c.text:c, count: stats.counts[String(idx)]||0})) : Object.entries(stats.counts||{}).map(([k,v])=>({label:k,count:v})) );
    entries.forEach((e, i)=>{
      const slice = total ? (e.count/total) : 0;
      const end = start + slice * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, start, end); ctx.closePath(); ctx.fillStyle = colors[i % colors.length]; ctx.fill(); start = end;
    });
    // donut hole
    ctx.beginPath(); ctx.fillStyle = '#0a0b10'; ctx.arc(centerX, centerY, radius*0.5, 0, Math.PI*2); ctx.fill();
    // center text total
    ctx.fillStyle = '#fff'; ctx.font = '14px Inter, Arial'; ctx.textAlign = 'center'; ctx.fillText(total + ' votes', centerX, centerY+5);
  }

  // Reset aggregated results and stored responses with double confirmation
  const resetResultsBtn = document.getElementById('resetResultsBtn');
  async function resetAllResults(){
    const ok = await showConfirm('Confirmer', 'Confirmer : supprimer tous les résultats agrégés ?');
    if(!ok) return;
    const finalOk = await showConfirm('Confirmation finale', 'Es-tu sûr de vouloir réinitialiser TOUTES les réponses et résultats ?');
    if(!finalOk) return;
    try{
      localStorage.removeItem('guildou:results:v1');
      localStorage.removeItem('guildou:responses:v1');
      if(isFirebaseEnabled()){
        try{
          const snapshot = await firebaseDb.collection('responses').get();
          const batch = firebaseDb.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }catch(error){
          console.warn('Firebase reset responses failed', error);
          setStatusMessage('Erreur lors de la réinitialisation Firebase : ' + (error.message || error));
        }
      }
    }catch(e){
      console.warn('Reset results local cleanup failed', e);
    }
    // refresh UI
    if(participantsList) participantsList.innerHTML = '<em>Aucun participant pour l\'instant</em>';
    renderAdminResults();
    renderList(data);
    showModal('Réinitialisé', 'Résultats et réponses réinitialisés.');
  }
  if(resetResultsBtn) resetResultsBtn.addEventListener('click', resetAllResults);

  function saveResponses(arr){ localStorage.setItem('guildou:responses:v1', JSON.stringify(arr)); }
  function loadResponses(){ try{ const r = localStorage.getItem('guildou:responses:v1'); return r?JSON.parse(r):[]; }catch(e){return[];} }

  // initialize default mode = admin
  // admin session helpers
  function isAdmin(){ return sessionStorage.getItem('guildou:admin') === '1'; }
  function setAdmin(flag){
    if(flag) sessionStorage.setItem('guildou:admin','1'); else sessionStorage.removeItem('guildou:admin');
    if(logoutBtn) logoutBtn.style.display = flag ? '' : 'none';
  }

  // restore admin state after questions are loaded
  initAppPromise.then(()=>{
    if(isAdmin()) setMode('admin'); else setMode('public');
  }).catch(err => {
    console.warn('initApp failed', err);
    if(isAdmin()) setMode('admin'); else setMode('public');
  });

  if(importFile) importFile.addEventListener('change', (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result);
        if(!Array.isArray(imported)) throw new Error('Format invalide');
        // ensure imported items have media.type detected when missing
        const normalized = imported.map(it=>{
          try{
            if(it && it.media && it.media.src){
              // detect type if missing
              if(!it.media.type) it.media.type = detectMediaType(it.media.src) || null;
              // protect against huge data URLs in imports
              if(it.media.src.indexOf('data:')===0 && it.media.src.length > MAX_DATAURL_CHARS){
                it.media = null;
              }
            }
          }catch(e){}
          return it;
        });
        data = normalized.concat(data);
        saveData(data);
        renderList(data);
        importFile.value='';
      }catch(err){ showModal('Erreur', 'Impossible d\'importer le fichier : '+err.message); }
    };
    reader.readAsText(f);
  });

  // read selected media file to DataURL with size guard
  if(qMediaFile){
    qMediaFile.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if(!f) { mediaDataUrl=''; mediaFileSize = 0; return; }
      if(f.size > MAX_MEDIA_BYTES){
        showModal('Erreur', 'Fichier trop volumineux (limite 5MB). Choisis un fichier plus petit ou utilise une URL externe.');
        qMediaFile.value = '';
        mediaDataUrl = '';
        mediaFileSize = 0;
        return;
      }
      mediaFileSize = f.size;
      const reader = new FileReader();
      reader.onload = ()=>{ mediaDataUrl = reader.result.toString(); };
      reader.readAsDataURL(f);
    });
  }

  if(clearAll) clearAll.addEventListener('click', async ()=>{
    const ok = await showConfirm('Supprimer', 'Supprimer toutes les questions ?');
    if(!ok) return;
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
      const choicesText = Array.isArray(it.choices) ? (typeof it.choices[0] === 'object' ? it.choices.map(c=>c.text||'').join(' | ') : it.choices.join(' | ')) : '';
      li.dataset.search = (it.title+' '+(it.type||'')+' '+choicesText).toLowerCase();
      li.innerHTML = `
        <div>
          <div style="font-weight:700;color:#fff">${escapeHtml(it.title)}</div>
          <div style="margin-top:8px;color:var(--muted);font-size:13px">${escapeHtml(choicesText)}</div>
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
      {id:idForNow(),title:'Qui a oublié le pull de raid ?',type:'choice',choices:['Le pull catastrophe du dimanche soir.','Personne']},
      {id:idForNow(),title:'Meilleure excuse pour wipe',type:'choice',choices:['Lag','Erreur de strat','Autre']}
    ];
  }

  function saveData(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

  function idForNow(){ return 'id_'+Math.random().toString(36).slice(2,9); }

  // detect whether a source is an image or video (basic heuristic)
  function detectMediaType(src){
    if(!src) return null;
    try{
      if(src.indexOf('data:')===0){
        const mime = src.split(':')[1].split(';')[0];
        if(mime.indexOf('video/')===0) return 'video';
        if(mime.indexOf('image/')===0) return 'image';
        return null;
      }
      const lower = src.toLowerCase();
      // Youtube links
      if(lower.indexOf('youtube.com') !== -1 || lower.indexOf('youtu.be') !== -1) return 'youtube';
      // Imgur pages should be treated as images
      if(lower.indexOf('imgur.com') !== -1) return 'image';
      const u = src.split('?')[0].toLowerCase();
      const ext = u.split('.').pop();
      const videoExt = ['mp4','webm','ogg','mov','m4v','mkv'];
      const imageExt = ['png','jpg','jpeg','gif','webp','avif','svg'];
      if(videoExt.indexOf(ext) !== -1) return 'video';
      if(imageExt.indexOf(ext) !== -1) return 'image';
    }catch(e){}
    return null;
  }

  // Normalize image URLs (handle Imgur page URLs -> i.imgur.com direct links)
  function normalizeImageUrl(src){
    if(!src) return src;
    try{
      const u = new URL(src, window.location.href);
      const host = u.hostname.toLowerCase();
      if(host.indexOf('imgur.com') !== -1 && host.indexOf('i.imgur.com') === -1){
        // path like /gallery/ID or /a/ID or /ID
        const parts = u.pathname.split('/').filter(Boolean);
        if(parts.length){
          const last = parts[parts.length-1];
          // if last contains a dot, assume direct filename
          if(last.indexOf('.') !== -1) return src;
          // default to jpg for Imgur page links
          return 'https://i.imgur.com/' + last + '.jpg';
        }
      }
    }catch(e){}
    return src;
  }

  // Convert YouTube url to embed URL
  function youtubeEmbedUrl(src){
    if(!src) return null;
    try{
      // examples: https://www.youtube.com/watch?v=ID, https://youtu.be/ID
      const u = new URL(src, window.location.href);
      let id = '';
      if(u.hostname.indexOf('youtu.be') !== -1){
        id = u.pathname.slice(1);
      }else if(u.hostname.indexOf('youtube.com') !== -1){
        id = u.searchParams.get('v') || '';
        if(!id){
          // check for /embed/ID
          const parts = u.pathname.split('/');
          const idx = parts.indexOf('embed');
          if(idx !== -1 && parts[idx+1]) id = parts[idx+1];
        }
      }
      if(!id) return null;
      return 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?rel=0';
    }catch(e){return null;}
  }

  // Adjust bottom spacing so footer doesn't overlap publicPanel
  function adjustPublicPanelSpacing(){
    try{
      if(!layout) return;
      if(publicPanel && publicPanel.classList.contains('visible')){
        layout.style.paddingBottom = '';
        if(publicPanel) publicPanel.style.top = '';
      }else{
        layout.style.paddingBottom = '';
        if(publicPanel) publicPanel.style.top = '';
      }
    }catch(e){}
  }

  // recalc on resize
  window.addEventListener('resize', adjustPublicPanelSpacing);

  function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
});
