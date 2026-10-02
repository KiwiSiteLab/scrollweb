/* Three live scenes. A gesture completes a move; there is no scrub stop. */
(() => {
  'use strict';
  const DEBUG=new URLSearchParams(location.search).has('debug');
  const stage=document.querySelector('#film-stage');
  const copies=[...document.querySelectorAll('.scene-copy')];
  const index=document.querySelector('#scene-index');
  const fill=document.querySelector('#progress-fill');
  const cue=document.querySelector('.scroll-cue');
  const status=document.querySelector('#media-status');
  const contact=document.querySelector('#contact');
  const card=document.querySelector('#business-card');
  const studio=document.querySelector('#studio-panel');
  const studioTabs=[...document.querySelectorAll('[data-studio-tab]')];
  const studioViews=[...document.querySelectorAll('[data-studio-view]')];
  const camera=document.querySelector('#scene-video');
  const returnCamera=document.querySelector('#return-video');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=v=>Math.min(1,Math.max(0,v));
  // All three supplied masters are 1470x630. The larger rendition reduces
  // browser interpolation on high-density desktops; mobile stays lightweight.
  const sceneRendition=innerWidth>=1024 && innerWidth*devicePixelRatio>=2300?'1260':'840';
  const smooth=t=>t*t*t*(t*(t*6-15)+10);
  const ready=v=>v.readyState>=2?Promise.resolve():new Promise((resolve,reject)=>{
    const done=()=>{clean();resolve();}, fail=()=>{clean();reject(new Error('media unavailable'));};
    const clean=()=>{v.removeEventListener('loadeddata',done);v.removeEventListener('error',fail);};
    v.addEventListener('loadeddata',done,{once:true});v.addEventListener('error',fail,{once:true});
    if(v.error)fail();
  });
  const safePlay=v=>{
    if(document.hidden||v._pending||v._blocked||!v.paused)return;
    v._pending=true;
    v.play().then(()=>{v._pending=false;}).catch(e=>{v._pending=false;if(e.name!=='AbortError')v._blocked=true;});
  };
  class LiveScene {
    constructor(name,overlap,sourceFrames) {
      this.name=name;this.overlap=overlap;this.sourceFrames=sourceFrames;
      this.panel=document.querySelector(`[data-scene="${name}"]`);
      this.players=[...this.panel.querySelectorAll('video')];
      this.active=0;this.enabled=false;this.preparing=false;this.cycles=0;
      this.panel.dataset.cycles='0';this.panel.dataset.underruns='0';
      this.players.forEach(v=>{
        v.muted=true;v.loop=false;v._frames=0;
        const decoded=(now,meta)=>{v._frames++;v._decoded=meta.mediaTime;v._wall=now;v.requestVideoFrameCallback(decoded);};
        if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(decoded);
        v.addEventListener('loadeddata',()=>{if(this.enabled)safePlay(this.players[this.active]);});
        v.addEventListener('ended',()=>{
          if(this.enabled && v===this.players[this.active])this.panel.dataset.underruns=String(+this.panel.dataset.underruns+1);
        });
      });
    }
    load() {
      if(this.loaded)return;this.loaded=true;
      const file=`${this.name}-buffered-${sceneRendition}.mp4`;
      this.players.forEach(v=>{v.src=`assets/web/${file}`;v.load();});
      this.players[this.active].style.opacity='1';this.players[this.active].style.zIndex='1';
    }
    async start() {
      this.load();this.enabled=true;
      await ready(this.players[this.active]);
      if(this.enabled)this.resume();
    }
    stop() {this.enabled=false;this.players.forEach(v=>v.pause());}
    resume() {
      if(!this.enabled)return;
      safePlay(this.players[this.active]);
      if(this.preparing)safePlay(this.players[1-this.active]);
    }
    tick() {
      if(!this.enabled||document.hidden)return;
      const a=this.players[this.active], b=this.players[1-this.active];
      const period=this.sourceFrames/24-this.overlap;
      if(!Number.isFinite(a.duration)||(a.paused&&!this.preparing))return;
      // The file already contains its natural seam plus one second of its own
      // beginning. During that guard segment both decoders show the SAME phase.
      if(!this.preparing && a.currentTime>=period-.025 && b.readyState>=2 && !b.seeking) {
        this.preparing=true;this.baseline=b._frames;this.lastSync=0;
        b.style.zIndex='2';b.style.opacity='0';b.playbackRate=1;safePlay(b);
      }
      const decoded=b.requestVideoFrameCallback?b._frames>this.baseline:b.currentTime>.025;
      if(this.preparing && decoded && !b.seeking && a.currentTime>=period+.08) {
        const phase=(a._decoded??a.currentTime)-period;
        const drift=phase-(b._decoded??b.currentTime);
        // Fine adjustment happens only on the hidden decoder, never the picture
        // being watched. Matching within one source frame avoids a visual jump.
        b.playbackRate=drift>.004?1.25:drift<-.044?.8:1;
        // Never hand off to an earlier frame (which looks like a tiny stutter).
        if(drift<=.004 && drift>=-.044) {
          b.style.opacity='1';b.style.zIndex='1';b.playbackRate=1;
          a.style.opacity='0';a.style.zIndex='0';a.pause();a.currentTime=0;
          this.active=1-this.active;this.preparing=false;
          this.panel.dataset.cycles=String(++this.cycles);
          this.panel.dataset.phaseError=String(Math.abs(drift));
          this.panel.dispatchEvent(new CustomEvent('filmframe',{bubbles:true}));
        } else if(a.currentTime>period+.30 && performance.now()-this.lastSync>180) {
          this.lastSync=performance.now();
          b.currentTime=Math.max(0,phase+.04);
        }
      }
    }
  }
  const scenes=[new LiveScene('exterior',10/24,121),new LiveScene('living',12/24,121),new LiveScene('kitchen',14/24,121)];
  const threshold=document.querySelector('#room-threshold');
  let current=0,transition=null,busy=false,cooldown=0,raf=0,hiddenAt=0;
  let wheelTotal=0,lastWheel=0,touchY=null;
  const debug=DEBUG?document.body.appendChild(Object.assign(document.createElement('pre'),{className:'film-debug'})):null;
  camera.muted=true;returnCamera.muted=true;
  camera.src='backgroundvideo-scrub.mp4';
  returnCamera.src='assets/web/return-exterior.mp4';
  camera.playbackRate=returnCamera.playbackRate=1.65;
  function panel(scene,visible,x=0,z=1) {
    scene.panel.style.visibility=visible?'visible':'hidden';
    scene.panel.style.opacity=visible?'1':'0';
    scene.panel.style.transform=`translate3d(${x}%,0,0)`;
    scene.panel.style.clipPath='inset(0 0 0 0)';
    scene.panel.style.zIndex=String(z);
  }
  function paintCopy(show=true) {
    copies.forEach((el,i)=>{
      const visible=show&&i===current;
      el.style.opacity=visible?'1':'0';el.style.transform=`translate3d(0,${visible||reduce.matches?0:18}px,0)`;
      el.setAttribute('aria-hidden',String(!visible));
    });
    index.textContent=String(current+1).padStart(2,'0');
    fill.style.transform=`scaleX(${(current+1)/3})`;
    const labels=['点击进入住宅','向右进入餐厅','联系 Willson'];
    cue.innerHTML=`${labels[current]} <span aria-hidden="true">${current===2?'↗':current===1?'→':'↗'}</span>`;
    cue.style.opacity=show?'1':'0';cue.disabled=!show;
  }
  function settle(destination) {
    current=destination;
    scenes.forEach((s,i)=>{panel(s,i===current);if(i!==current)s.stop();});
    [camera,returnCamera].forEach(v=>{v.style.opacity='0';v.pause();});
    threshold.style.opacity='0';
    transition=null;busy=false;cooldown=performance.now()+280;
    stage.dataset.scene=scenes[current].name;stage.dataset.transitioning='false';
    status.hidden=true;paintCopy();
  }
  async function move(destination) {
    if(busy||destination===current||destination<0||destination>2||contact.open||card.open||studio.open)return;
    busy=true;stage.dataset.transitioning='true';paintCopy(false);
    const from=current, to=destination;
    try {
      // Existing scene stays live while a destination is being decoded.
      await scenes[to].start();
      if(Math.abs(to-from)===1 && Math.min(from,to)===0 && !reduce.matches) {
        const v=to===1?camera:returnCamera;
        await ready(v);
        v.style.opacity='0';v.currentTime=0;v.playbackRate=1.65;
        if(v.seeking)await new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));
        panel(scenes[from],true,0,2);panel(scenes[to],true,0,1);
        await v.play();
        transition={type:'camera',from,to,video:v};
      } else {
        const direction=to>from?1:-1;
        panel(scenes[from],true,0,1);panel(scenes[to],true,0,2);
        scenes[to].panel.style.opacity='0';
        transition={type:'turn',from,to,direction,started:performance.now(),duration:reduce.matches?220:1150};
      }
    } catch {
      // Keep the outgoing scene playing. A later gesture can retry loading.
      scenes[to].stop();busy=false;stage.dataset.transitioning='false';paintCopy();
      status.hidden=false;status.textContent='下一场景正在准备，请稍后再滑动。';
    }
  }
  function tick(now) {
    raf=0;
    scenes.forEach(s=>s.tick());
    if(transition?.type==='camera') {
      const tr=transition,v=tr.video,t=v.currentTime;
      const inBlend=clamp(t/.22),outBlend=1-clamp((t-(v.duration-.32))/.25);
      v.style.opacity=String(Math.min(inBlend,outBlend));
      if(t>.22){panel(scenes[tr.from],false);scenes[tr.from].stop();}
      fill.style.transform=`scaleX(${(tr.from+1+(tr.to-tr.from)*clamp(t/v.duration))/3})`;
      if(t>=v.duration-.04||v.ended)settle(tr.to);
    } else if(transition?.type==='turn') {
      const tr=transition,p=clamp((now-tr.started)/tr.duration),e=smooth(p);
      // Both real scene videos continue playing while a nearby interior wall
      // occludes the lens during the change of viewpoint.
      const outgoing=scenes[tr.from].panel,incoming=scenes[tr.to].panel;
      outgoing.style.transform=`translate3d(${-18*e*tr.direction}%,0,0) scale(${1+.12*e})`;
      incoming.style.transform=`translate3d(${22*(1-e)*tr.direction}%,0,0) scale(${1+.12*(1-e)})`;
      outgoing.style.opacity=String(1-smooth(clamp((p-.20)/.40)));
      incoming.style.opacity=String(smooth(clamp((p-.40)/.40)));
      threshold.style.opacity=String(Math.pow(Math.sin(Math.PI*p),4)*.68);
      fill.style.transform=`scaleX(${(tr.from+1+(tr.to-tr.from)*e)/3})`;
      if(p===1)settle(tr.to);
    }
    if(debug)debug.textContent=`scene ${scenes[current].name}\ntransition ${transition?.type||'none'}\n${scenes.map(s=>`${s.name}: cycles ${s.cycles}, live ${s.enabled}, player ${s.active}, time ${s.players[s.active].currentTime.toFixed(2)}`).join('\n')}`;
    if(!document.hidden)raf=requestAnimationFrame(tick);
  }
  const retry=()=>{
    document.querySelectorAll('video').forEach(v=>{v._blocked=false;});
    scenes.forEach(s=>s.resume());
  };
  addEventListener('wheel',event=>{
    if(contact.open||card.open||studio.open||event.ctrlKey)return;
    event.preventDefault();retry();
    const now=performance.now();
    if(now-lastWheel>180)wheelTotal=0;
    lastWheel=now;
    if(busy||now<cooldown){wheelTotal=0;return;}
    wheelTotal+=event.deltaY*(event.deltaMode===1?16:1);
    if(Math.abs(wheelTotal)>=50){const direction=Math.sign(wheelTotal);wheelTotal=0;move(current+direction);}
  },{passive:false});
  stage.addEventListener('touchstart',event=>{touchY=event.touches[0].clientY;retry();},{passive:true});
  stage.addEventListener('touchmove',event=>{event.preventDefault();},{passive:false});
  stage.addEventListener('touchend',event=>{
    if(touchY===null)return;const delta=touchY-event.changedTouches[0].clientY;touchY=null;
    if(Math.abs(delta)>45&&!busy&&performance.now()>=cooldown)move(current+Math.sign(delta));
  },{passive:true});
  addEventListener('pointerdown',retry,{passive:true});
  addEventListener('keydown',event=>{
    if(contact.open||card.open||studio.open)return;
    if(event.target.closest('a,button,input,textarea,select'))return;
    retry();
    const down=['ArrowDown','ArrowRight','PageDown',' '].includes(event.key),up=['ArrowUp','ArrowLeft','PageUp'].includes(event.key);
    if(down||up){event.preventDefault();move(current+(down?1:-1));}
    if(event.key==='Home'){event.preventDefault();move(0);}
    if(event.key==='End'){event.preventDefault();move(2);}
  });
  cue.addEventListener('click',()=>current===2?contact.showModal():move(current+1));
  function showStudioView(name) {
    studioTabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.studioTab===name)));
    studioViews.forEach(view=>{view.hidden=view.dataset.studioView!==name;});
    studio.scrollTop=0;
  }
  function openStudio(name) {
    showStudioView(name);
    if(!studio.open)studio.showModal();
    studio.querySelector(`[data-studio-tab="${name}"]`).focus();
  }
  document.querySelectorAll('[data-open-studio]').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation();openStudio(button.dataset.openStudio);
  }));
  studioTabs.forEach(button=>button.addEventListener('click',()=>showStudioView(button.dataset.studioTab)));
  document.querySelector('#close-studio').addEventListener('click',()=>studio.close());
  document.querySelector('#studio-contact').addEventListener('click',()=>{studio.close();contact.showModal();});
  studio.addEventListener('click',event=>{
    if(event.target!==studio)return;
    const box=studio.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)studio.close();
  });
  stage.addEventListener('click',event=>{
    if(current===0&&!busy&&performance.now()>=cooldown&&!event.target.closest('button,a,dialog'))move(1);
  });
  document.querySelectorAll('a[href="#contact"]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();contact.showModal();}));
  document.querySelector('#close-contact').addEventListener('click',()=>contact.close());
  document.querySelectorAll('a[href="#film-stage"]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();if(contact.open)contact.close();move(0);}));
  document.querySelector('#show-card').addEventListener('click',()=>card.showModal());
  document.querySelector('#close-card').addEventListener('click',()=>card.close());
  card.addEventListener('click',event=>{if(event.target!==card)return;const r=card.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)card.close();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=performance.now();cancelAnimationFrame(raf);raf=0;scenes.forEach(s=>s.players.forEach(v=>v.pause()));[camera,returnCamera].forEach(v=>v.pause());}
    else {
      if(transition?.type==='turn')transition.started+=performance.now()-hiddenAt;
      scenes.forEach(s=>s.resume());if(transition?.type==='camera')safePlay(transition.video);
      if(!raf)raf=requestAnimationFrame(tick);
    }
  });
  document.querySelector('#year').textContent=new Date().getFullYear();
  settle(0);cooldown=0;status.hidden=false;
  scenes[0].start().then(()=>{
    status.hidden=true;
    // First scene is already moving before the remaining decoders are prepared.
    scenes[1].load();scenes[2].load();
  }).catch(()=>{status.textContent='影像正在准备，请刷新重试。';});
  raf=requestAnimationFrame(tick);
})();
