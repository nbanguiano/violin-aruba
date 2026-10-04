/* Independent library components; no third-party runtime or form submissions. */
(() => {
 // Navigation is fully visible without JavaScript; each mobile menu is independent.
 for(const root of document.querySelectorAll('[data-ui~="site-menu"]')) {
  const toggle=root.querySelector('[data-menu-toggle]');
  const links=root.querySelector('[data-menu-links]');
  const compact=matchMedia('(max-width: 1100px)');
  let open=false;
  const render=()=>{
   toggle.hidden=!compact.matches;
   toggle.setAttribute('aria-expanded',String(open));
   links.hidden=compact.matches&&!open;
  };
  toggle.addEventListener('click',()=>{open=!open;render();});
  root.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&compact.matches&&open){event.preventDefault();open=false;render();toggle.focus();}
  });
  links.addEventListener('click',event=>{
   if(event.target.closest('a')&&compact.matches){open=false;render();toggle.focus();}
  });
  compact.addEventListener('change',()=>{
   const focused=root.contains(document.activeElement);
   open=false;render();
   if(focused)(compact.matches?toggle:links.querySelector('a')).focus();
  });
  render();
 }
 // Progressive tabs: without this controller, every panel remains readable.
 for(const root of document.querySelectorAll('[data-ui~="choice-panels"]')) {
  const tabs=root.querySelector('[data-choice-tabs]');
  const buttons=[...tabs.querySelectorAll('[data-panel-target]')];
  const panels=[...root.querySelectorAll('[data-choice-panel]')];
  tabs.setAttribute('role','tablist');
  const select=index=>{
   buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
   panels.forEach(panel=>{panel.hidden=panel.id!==buttons[index].dataset.panelTarget;});
  };
  buttons.forEach((button,index)=>{
   const panel=panels.find(item=>item.id===button.dataset.panelTarget);
   button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
   panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
   button.addEventListener('click',()=>select(index));
   button.addEventListener('keydown',event=>{
    let next=index;
    const vertical=tabs.getAttribute('aria-orientation')==='vertical';
    if(event.key===(vertical?'ArrowDown':'ArrowRight'))next=(index+1)%buttons.length;
    else if(event.key===(vertical?'ArrowUp':'ArrowLeft'))next=(index-1+buttons.length)%buttons.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=buttons.length-1;
    else return;
    event.preventDefault();select(next);buttons[next].focus();
   });
  });
  select(0);
 }
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const visible=(root,run)=>{
  let inView=false;
  const update=()=>run(inView&&!document.hidden);
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;update();},{threshold:.1});
  observer.observe(root);document.addEventListener('visibilitychange',update);
  reduced.addEventListener('change',update);
 };
 for(const root of document.querySelectorAll('[data-ui~="background-video"]')) {
  const video=root.querySelector('video'),button=root.querySelector('[data-video-toggle]');
  let onScreen=false,userPaused=false,userStarted=false;
  video.muted=true;
  const sync=()=>{
   const automatic=!reduced.matches&&!navigator.connection?.saveData;
   const play=onScreen&&!userPaused&&(automatic||userStarted);
   if(play){if(!video.getAttribute('src'))video.src=video.dataset.src;video.play().catch(()=>{button.textContent='Play background video';});}
   else video.pause();
   button.textContent=play?'Pause background video':'Play background video';
  };
  button.hidden=false;
  button.addEventListener('click',()=>{if(video.paused){userPaused=false;userStarted=true;}else userPaused=true;sync();});
  visible(root,value=>{onScreen=value;sync();});
  video.addEventListener('error',()=>{button.textContent='Video unavailable';button.disabled=true;});
 }
 for(const root of document.querySelectorAll('[data-ui~="gallery"]')) {
  const track=root.querySelector('.gallery-track'),items=[...track.children];
  const prev=root.querySelector('[data-gallery-prev]'),next=root.querySelector('[data-gallery-next]'),status=root.querySelector('[data-gallery-status]');
  const update=()=>{
   const max=track.scrollWidth-track.clientWidth;
   prev.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft>=max-2;
   const first=items.reduce((best,item,i)=>Math.abs(item.offsetLeft-items[0].offsetLeft-track.scrollLeft)<Math.abs(items[best].offsetLeft-items[0].offsetLeft-track.scrollLeft)?i:best,0);
   const last=items.reduce((last,item,i)=>item.offsetLeft-items[0].offsetLeft<track.scrollLeft+track.clientWidth-4?i:last,first);
   status.textContent=`${first+1}${last>first?'–'+(last+1):''} of ${items.length}`;
  };
  const move=direction=>track.scrollBy({left:direction*(items[0].getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap)),behavior:reduced.matches?'instant':'smooth'});
  prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
  track.addEventListener('keydown',e=>{if(e.target!==track)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
  track.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(track);update();
  for(const frame of root.querySelectorAll('.video-slide__frame')) {
   const video=frame.querySelector('video'),button=frame.querySelector('[data-video-play]');
   button.addEventListener('click',()=>{
    if(!video.getAttribute('src'))video.src=video.dataset.src;
    video.controls=true;video.play().then(()=>{button.hidden=true;video.focus();}).catch(()=>{button.hidden=false;button.textContent='Try playing again';});
   });
   video.addEventListener('play',()=>{for(const other of document.querySelectorAll('.video-slide video'))if(other!==video)other.pause();});
   video.addEventListener('ended',()=>{button.hidden=false;});
   video.addEventListener('error',()=>{button.hidden=false;button.textContent='Clip unavailable';button.disabled=true;});
   visible(frame,inView=>{if(!inView)video.pause();});
  }
 }
 for(const form of document.querySelectorAll('[data-ui~="contact-form"]')) {
  const fields=[...form.querySelectorAll('input,textarea')],result=form.querySelector('.contact-result');
  const validate=field=>{
   let message='';const value=field.value.trim();
   if(!value)message=field.name==='message'?'Write a short message.':field.name==='email'?'Enter your email address.':'Enter your name.';
   else if(field.type==='email'&&(field.validity.typeMismatch||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))message='Use an email like name@example.com.';
   const error=form.querySelector(`[id="${field.getAttribute('aria-describedby')}"]`);
   error.textContent=message;error.hidden=!message;field.setAttribute('aria-invalid',String(!!message));return !message;
  };
  form.addEventListener('submit',e=>{e.preventDefault();result.hidden=true;const invalid=fields.filter(field=>!validate(field));if(invalid.length){invalid[0].focus();return;}form.reset();result.textContent='Demo complete. Your message was not sent or stored.';result.hidden=false;result.focus();});
  for(const field of fields){field.addEventListener('blur',()=>validate(field));field.addEventListener('input',()=>{result.hidden=true;if(field.getAttribute('aria-invalid')==='true')validate(field);});}
  form.noValidate=true;form.querySelector('[type="submit"]').disabled=false;
 }
 for(const root of document.querySelectorAll('[data-ui~="marker"]')) {
  let played=false;
  const play=()=>{root.classList.remove('is-drawing');if(!reduced.matches){void root.offsetWidth;root.classList.add('is-drawing');}};
  visible(root,inView=>{if(inView&&!played){played=true;play();}});
  root.querySelector('[data-marker-replay]').addEventListener('click',play);
 }
 for(const root of document.querySelectorAll('[data-ui~="rotating-headline"]')) {
  const words=JSON.parse(root.dataset.words),word=root.querySelector('[data-rotating-word]'),button=root.querySelector('[data-motion-toggle]');
  const typing=root.dataset.typing==='true';let index=0,timer=null,paused=false,inView=false,phase='hold',letters=words[0].length;
  const stop=()=>{clearTimeout(timer);timer=null;};
  const run=()=>{
   stop();if(!inView||paused||reduced.matches)return;
   let delay=2000;
   if(typing){
    if(phase==='hold'){phase='delete';delay=45;}
    else if(phase==='delete'){letters--;word.textContent=words[index].slice(0,letters);delay=45;if(letters<=0){index=(index+1)%words.length;phase='type';delay=150;}}
    else {letters++;word.textContent=words[index].slice(0,letters);delay=65;if(letters>=words[index].length){phase='hold';delay=2000;}}
   }else{index=(index+1)%words.length;word.textContent=words[index];word.classList.remove('is-changing');void word.offsetWidth;word.classList.add('is-changing');}
   timer=setTimeout(run,delay);
  };
  const sync=()=>{stop();button.disabled=reduced.matches;button.textContent=reduced.matches?'Reduced motion enabled':paused?'Resume animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));if(reduced.matches){word.textContent=words[0];index=0;letters=words[0].length;phase='hold';}else if(inView&&!paused)timer=setTimeout(run,2000);};
  visible(root,value=>{inView=value;sync();});button.addEventListener('click',()=>{paused=!paused;sync();});
 }
 for(const root of document.querySelectorAll('[data-ui~="count-up"]')) {
  const counters=[...root.querySelectorAll('[data-count]')];let played=false,frame=0;
  const render=p=>counters.forEach(el=>{const value=Math.round(Number(el.dataset.count)*p);el.textContent=(el.dataset.prefix||'')+value.toLocaleString('en-US')+(el.dataset.suffix||'');});
  const play=()=>{cancelAnimationFrame(frame);if(reduced.matches){render(1);return;}const start=performance.now();render(0);const tick=now=>{const progress=Math.min(1,(now-start)/1200);render(1-Math.pow(1-progress,3));if(progress<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);};
  visible(root,inView=>{if(inView&&!played){played=true;play();}else if(!inView||reduced.matches){cancelAnimationFrame(frame);render(1);}});
  root.querySelector('[data-count-replay]').addEventListener('click',play);
 }
})();
