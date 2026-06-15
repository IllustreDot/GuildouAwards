document.addEventListener('DOMContentLoaded',function(){
  const list = document.getElementById('questions-list');
  const search = document.getElementById('search');
  const start = document.getElementById('start');

  // Toggle answer visibility when title clicked
  list.addEventListener('click', e=>{
    const btn = e.target.closest('.q-title');
    if(!btn) return;
    const item = btn.closest('.qa');
    item.classList.toggle('open');
  });

  // Filter questions by text
  search.addEventListener('input', ()=>{
    const q = search.value.trim().toLowerCase();
    Array.from(list.children).forEach(li=>{
      const title = li.querySelector('.q-title').textContent.toLowerCase();
      li.style.display = title.includes(q) ? '' : 'none';
    });
  });

  // Small UX: focus search when starting
  start.addEventListener('click', ()=>{ search.focus(); });

  // Accessibility: allow Enter/Space to toggle when focused on button (native) — no extra code needed
});
