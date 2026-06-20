(function(){
  if(typeof window === 'undefined') return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints>0;
  if(isTouch) return;

  const NUM = 12;
  const lines = [];
  const positions = [];
  let mouseX = window.innerWidth/2, mouseY = window.innerHeight/2;
  let lastMoveAt = Date.now();
  let lastMouseX = mouseX, lastMouseY = mouseY;

  for(let i=0;i<NUM;i++){
    const el = document.createElement('div');
    el.className = 'cursor-line' + (i>NUM-4 ? ' small' : '');
    // gradient from violet (270) to yellow (50)
    const t = i/Math.max(1,NUM-1);
    const hue = Math.round(270 + (50-270) * t);
    el.style.background = `linear-gradient(90deg, hsla(${hue},85%,65%,1), hsla(${(hue+40)%360},85%,60%,0.2))`;
    el.style.opacity = (1 - i/NUM) * 0.9;
    document.body.appendChild(el);
    lines.push(el);
    positions.push({x:mouseX, y:mouseY, angle:0});
  }

  window.addEventListener('mousemove', (e)=>{ mouseX = e.clientX; mouseY = e.clientY; lastMoveAt = Date.now(); });

  function animate(){
    // compute velocity of mouse for sizing
    const dxm = mouseX - lastMouseX;
    const dym = mouseY - lastMouseY;
    const speed = Math.sqrt(dxm*dxm + dym*dym);
    lastMouseX = mouseX; lastMouseY = mouseY;

    // lead follows mouse
    const vx = mouseX - positions[0].x;
    const vy = mouseY - positions[0].y;
    positions[0].x += vx * 0.32;
    positions[0].y += vy * 0.32;
    positions[0].angle = Math.atan2(vy, vx) * 180 / Math.PI;

    // scale based on recent speed, clamp to avoid huge lengths
    const baseW = 20; const maxW = 220;
    const leadW = Math.min(maxW, baseW + speed * 6);
    lines[0].style.width = leadW + 'px';
    lines[0].style.transform = `translate(${positions[0].x}px, ${positions[0].y}px) translate(-50%,-50%) rotate(${positions[0].angle}deg)`;

    for(let i=1;i<NUM;i++){
      const dx = positions[i-1].x - positions[i].x;
      const dy = positions[i-1].y - positions[i].y;
      positions[i].x += dx * (0.18 + i*0.01);
      positions[i].y += dy * (0.18 + i*0.01);
      positions[i].angle = Math.atan2(dy, dx) * 180 / Math.PI;
      // smaller width for trailing lines
      const w = Math.max(8, leadW * (1 - i/NUM));
      lines[i].style.width = w + 'px';
      // fade opacity when mouse is idle
      const idle = (Date.now() - lastMoveAt) > 700;
      lines[i].style.opacity = (idle ? 0 : Math.max(0.12, (1 - i/NUM)));
      lines[i].style.transform = `translate(${positions[i].x}px, ${positions[i].y}px) translate(-50%,-50%) rotate(${positions[i].angle}deg)`;
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // hide when leaving window
  window.addEventListener('mouseout', (e)=>{ if(e.relatedTarget === null) lines.forEach(d=>d.classList.add('hidden')); });
  window.addEventListener('mouseover', ()=>{ lines.forEach(d=>d.classList.remove('hidden')); });

  // hide trail after idle timeout
  let idleTimer = null;
  function scheduleIdle(){
    if(idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(()=>{
      lines.forEach(l=>{ l.style.opacity = 0; });
    }, 900);
  }
  window.addEventListener('mousemove', ()=>{ lines.forEach(l=>l.classList.remove('hidden')); scheduleIdle(); lastMoveAt = Date.now(); });
})();
