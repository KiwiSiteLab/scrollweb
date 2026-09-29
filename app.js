(() => {
  'use strict';
  const video = document.querySelector('#scene-video');
  const fill = document.querySelector('#progress-fill');
  const progressText = document.querySelector('#progress-text');
  const chapterName = document.querySelector('#chapter-name');
  const status = document.querySelector('#media-status');
  const motionButton = document.querySelector('#motion-toggle');
  const sections = [...document.querySelectorAll('.chapter')];
  const layers = [...document.querySelectorAll('[data-depth]')];
  const rails = [...document.querySelectorAll('.rail-link')];
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const opening = document.querySelector('#opening-video');
  const interior = document.querySelector('#interior-video');
  const mobile = matchMedia('(max-width: 700px)').matches;
  const loops = [
    {element:opening, source:mobile?'assets/opening-native-mobile.mp4':'assets/opening-native.mp4', ready:false, wanted:false, starting:false, failed:false},
    {element:interior, source:mobile?'assets/interior-native-mobile.mp4':'assets/interior-native.mp4', ready:false, wanted:false, starting:false, failed:false}
  ];
  const names = ['远景 / THE APPROACH', '边界 / THE THRESHOLD', '栖居 / THE INTERIOR', '对话 / THE CONVERSATION'];
  let staticMode = reduceMotion.matches;
  let progress = 0, smoothed = 0, frame = 0, lastFrame = 0, maxScroll = 1;
  let bounds = [], layerCenters = [], ready = false, failed = false, sourceFallback = false;
  let previousPercent = -1, previousChapter = -1, seekTarget = 0;
  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

  function playLoop(loop) {
    if(!loop.ready || !loop.wanted || staticMode || document.hidden || loop.starting || !loop.element.paused)return;
    loop.starting=true;
    loop.element.play().then(()=>{status.hidden=true;}).catch(()=>{
      status.textContent='点击页面开启原片动态';status.hidden=false;
    }).finally(()=>{loop.starting=false;});
  }
  function updateLoops() {
    const weights=[1-smooth(.07,.23,smoothed),smooth(.86,.98,smoothed)];
    loops.forEach((loop,i)=>{
      loop.wanted=weights[i]>.001;
      if(loop.wanted&&!staticMode&&!loop.element.getAttribute('src')&&!loop.failed){
        loop.element.src=loop.source;loop.element.load();
      }
      loop.element.style.opacity=loop.ready?String(weights[i]):'0';
      if(!loop.wanted||staticMode||document.hidden)loop.element.pause();else playLoop(loop);
    });
    document.body.dataset.scene=weights[0]>.5?'opening':weights[1]>.5?'interior':'travel';
  }
  loops.forEach(loop=>{
    loop.element.muted=true;
    loop.element.addEventListener('loadeddata',()=>{loop.ready=true;updateLoops();});
    loop.element.addEventListener('error',()=>{
      loop.failed=true;loop.ready=false;loop.element.style.opacity='0';
      status.textContent='循环影像未加载，暂显示原片镜头。请刷新重试。';status.hidden=false;
    });
  });
  addEventListener('pointerdown',()=>loops.forEach(playLoop),{passive:true});

  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bounds = sections.map(section => section.offsetTop);
    layerCenters = layers.map(el => {
      const transform = getComputedStyle(el).transform;
      const translation = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
      return el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - translation;
    });
    updateScroll();
  }
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  function updateScroll() {
    progress = clamp(scrollY / maxScroll);
    schedule();
  }
  // One seek at a time: coalesce rapid input instead of interrupting the decoder.
  function seekVideo() {
    if (!ready || staticMode || failed || video.seeking) return;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    seekTarget = smoothed >= .99999 ? duration : smoothed * duration;
    const tolerance = (seekTarget === 0 || seekTarget === duration) ? .00001 : .012;
    if (Math.abs(video.currentTime - seekTarget) > tolerance) video.currentTime = seekTarget;
  }
  function render(now) {
    frame = 0;
    const dt = Math.min(64, now - (lastFrame || now - 16));
    lastFrame = now;
    smoothed += (progress - smoothed) * (1 - Math.exp(-dt / 85));
    if (Math.abs(progress - smoothed) < .00015) smoothed = progress;
    fill.style.transform = `scaleX(${progress})`;
    const percent = Math.round(progress * 100);
    if (percent !== previousPercent) {
      progressText.textContent = `${String(percent).padStart(3, '0')}%`;
      previousPercent = percent;
    }
    const viewportCenter = scrollY + innerHeight * .52;
    let chapter = 0;
    bounds.forEach((top, i) => {if (viewportCenter >= top) chapter = i;});
    if (chapter !== previousChapter) {
      chapterName.textContent = names[chapter];
      document.body.classList.toggle('at-contact', chapter === 3);
      rails.forEach((a, i) => {
        a.classList.toggle('active', i === chapter);
        if (i === chapter) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      });
      navLinks.forEach(a => a.classList.toggle('active', a.hash === `#${sections[chapter].id}`));
      previousChapter = chapter;
    }
    if (!staticMode) {
      video.style.transform = 'none';
      layers.forEach((el, i) => {
        const distance = viewportCenter - layerCenters[i];
        el.style.transform = `translate3d(0,${clamp(distance * Number(el.dataset.depth), -120, 120)}px,0)`;
      });
      seekVideo();
    }
    updateLoops();
    // Native video playback supplies every water/cloud/fire frame while idle.
    // No synthetic motion and no continuous JavaScript draw loop are involved.
    if (smoothed !== progress) schedule();
  }
  function applyMotionMode() {
    document.body.classList.toggle('is-static', staticMode);
    motionButton.textContent = staticMode ? '开启动态' : '暂停动态';
    motionButton.setAttribute('aria-label', staticMode ? '开启环境动态与镜头漫游' : '暂停环境动态');
    motionButton.setAttribute('aria-pressed', String(staticMode));
    if (staticMode) {video.pause();loops.forEach(loop=>loop.element.pause());status.hidden = true;}
    else {loadVideo();schedule();}
  }
  function loadVideo() {
    if (!video.getAttribute('src')) {
      video.src = matchMedia('(max-width: 700px)').matches ? 'assets/background-mobile.mp4' : 'assets/background-scroll.mp4';
      status.hidden = false;
      video.load();
    }
  }
  video.addEventListener('loadeddata', () => {ready = true;failed = false;status.hidden = true;schedule();});
  video.addEventListener('seeked', schedule);
  video.addEventListener('canplay', schedule);
  video.addEventListener('error', () => {
    if (!sourceFallback) {sourceFallback = true;video.src = 'backgroundvideo.mp4';video.load();return;}
    failed = true;ready = false;status.hidden = false;
    status.textContent = '影像暂不可用，已显示静态画面。你仍可浏览和联系。';
  });
  motionButton.addEventListener('click', () => {staticMode = !staticMode;applyMotionMode();});
  document.querySelector('#immersion-toggle').addEventListener('click', event => {
    const immersive = document.body.classList.toggle('immersive');
    event.currentTarget.textContent = immersive ? '显示文字' : '纯享画面';
    event.currentTarget.setAttribute('aria-pressed', String(immersive));
  });
  reduceMotion.addEventListener('change', event => {staticMode = event.matches;applyMotionMode();});
  addEventListener('scroll', updateScroll, {passive: true});
  addEventListener('resize', measure, {passive: true});
  addEventListener('pageshow', measure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(frame);frame = 0;loops.forEach(loop=>loop.element.pause());} else {lastFrame = 0;updateScroll();}
  });
  new ResizeObserver(measure).observe(document.querySelector('main'));
  document.fonts.ready.then(measure);
  // Native dialog provides Escape handling, focus trapping, and focus restoration.
  const dialog = document.querySelector('#business-card');
  document.querySelector('#show-card').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-card').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {if (e.target === dialog) {const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.querySelector('#year').textContent = new Date().getFullYear();
  applyMotionMode();measure();
})();
