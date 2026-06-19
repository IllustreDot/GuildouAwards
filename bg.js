(function(){
  try{
    console.log('[bg] init');
    const container = document.getElementById('bg');
    if(!container){ console.warn('[bg] #bg container not found'); return; }

    // Use a 2D canvas multi-blob animation (no Three.js dependency)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.display = 'block';
    container.appendChild(canvas);

    function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize, {passive:true});
    resize();

    const W = ()=>canvas.width; const H = ()=>canvas.height;
    const colors = [
      {r:124,g:58,b:237}, // violet
      {r:251,g:191,b:36}  // yellow
    ];

    function lerp(a,b,t){ return a + (b-a)*t; }
    function mixColor(t){ return {
      r: Math.round(lerp(colors[0].r, colors[1].r, t)),
      g: Math.round(lerp(colors[0].g, colors[1].g, t)),
      b: Math.round(lerp(colors[0].b, colors[1].b, t))
    }; }

    // Blob objects
    const blobs = [];
    function spawnBlob(){
      const size = Math.random()*0.25 + 0.08; // fraction of max dim
      const radius = Math.max(W(),H()) * size;
      const x = Math.random()*W();
      const y = Math.random()*H();
      const speed = 10 + Math.random()*30;
      const dir = (Math.random()*Math.PI*2);
      const colorT = Math.random();
      const life = 6 + Math.random()*8; // seconds
      blobs.push({x,y,radius,dx:Math.cos(dir)*speed,dy:Math.sin(dir)*speed,colorT,age:0,life});
      // limit count
      if(blobs.length>12) blobs.shift();
    }

    // initial blobs
    for(let i=0;i<6;i++) spawnBlob();

    let lastSpawn = performance.now();
    const spawnInterval = 1200; // ms

    let t0 = performance.now();
    function frame(){
      const t = (performance.now() - t0)/1000;
      const w = W(), h = H();
      // base dark background
      ctx.fillStyle = 'rgba(6,6,11,1)';
      ctx.fillRect(0,0,w,h);

      // draw blobs with additive blending for soft glows
      ctx.globalCompositeOperation = 'lighter';
      blobs.forEach(b=>{
        const lifeR = 1 - (b.age / b.life);
        const col = mixColor(b.colorT);
        const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
        const alphaInner = 0.45 * lifeR;
        const alphaOuter = 0.0;
        grd.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${alphaInner})`);
        grd.addColorStop(0.5, `rgba(${col.r},${col.g},${col.b},${alphaInner*0.5})`);
        grd.addColorStop(1, `rgba(${col.r},${col.g},${col.b},${alphaOuter})`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.radius,0,Math.PI*2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      // subtle noise overlay
      ctx.fillStyle = 'rgba(255,255,255,0.012)';
      for(let i=0;i<6;i++){
        const rx = Math.random()*w; const ry = Math.random()*h; const rw = Math.random()*60; const rh = Math.random()*60;
        ctx.fillRect(rx,ry,rw,rh);
      }

      // update blobs
      const dt = 1/60;
      for(let i=blobs.length-1;i>=0;i--){
        const b = blobs[i];
        b.x += b.dx * dt;
        b.y += b.dy * dt;
        b.age += dt;
        // gentle wobble
        b.x += Math.sin(t*0.6 + i) * 0.2;
        b.y += Math.cos(t*0.4 + i) * 0.2;
        b.radius *= 0.9995; // slight shrink
        if(b.age > b.life) blobs.splice(i,1);
      }

      // spawn new periodically
      if(performance.now() - lastSpawn > spawnInterval){ spawnBlob(); lastSpawn = performance.now(); }

      requestAnimationFrame(frame);
    }
    frame();

  }catch(err){ console.error('[bg] error initializing background', err); }
})();
