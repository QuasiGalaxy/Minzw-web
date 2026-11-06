import { Rope } from './rope.js';

const $ = (selector) => document.querySelector(selector);
const media = matchMedia('(prefers-reduced-motion: reduce)');
let motionOff = media.matches;
try { const saved = localStorage.getItem('mzw-motion'); if (saved !== null) motionOff = saved === 'off'; } catch { /* The page also works with storage disabled. */ }
const hero = $('.hero'), badge = $('#badge'), rotator = $('#badge-rotator');
const paths = ['#rope','#rope-shadow','#rope-seam'].map($);
let rope, bounds, badgeWidth, badgeHeight, frame = 0, previousTime = 0, accumulator = 0;
let visible = true, dragging = false, pointerId = null, pointerOffset = {x:0,y:0}, dragStart, moved = false;
let angle = 0, angularVelocity = 0, tilt = 0, flip = 0, flipTarget = 0, lastX = 0, quietFrames = 0;
const clamp = (value, min, max) => Math.min(max, Math.max(min,value));

function layout() {
  bounds = hero.getBoundingClientRect();
  badgeWidth = badge.offsetWidth; badgeHeight = badge.offsetHeight;
  const attachY = bounds.height - badgeHeight - (bounds.width < 600 ? 110 : 88);
  rope = new Rope(bounds.width * .5, -35, attachY + 35);
  angle = -.08; angularVelocity = 0; lastX = rope.end.x;
  if (motionOff) { rope.settle(); angle = 0; }
  else rope.impulse(1.2);
  paint(); wake();
}
function paint() {
  const d = rope.path(); paths.forEach(path => path.setAttribute('d',d));
  badge.style.transform = `translate3d(${rope.end.x - badgeWidth/2}px,${rope.end.y}px,0) rotate(${angle}rad)`;
  rotator.style.transform = `perspective(850px) rotateY(${flip + tilt}deg) rotateX(${clamp(angularVelocity * -40,-5,5)}deg)`;
}
function tick(time) {
  frame = 0;
  if (!visible || document.hidden) { previousTime = 0; return; }
  const delta = previousTime ? Math.min(time-previousTime, 36) : 16.67;
  previousTime = time;
  accumulator += delta;
  if (!motionOff || dragging) {
    while (accumulator >= 1000/120) {
      rope.step();
      const dx = rope.end.x - lastX;
      const targetAngle = clamp((rope.anchor.x - rope.end.x) / rope.length * .78 - dx * .045,-.9,.9);
      angularVelocity += (targetAngle - angle) * .012;
      angularVelocity *= .965;
      angle += angularVelocity;
      if (bounds.width < 600) {
        const halfWidth = badgeWidth / 2 * Math.cos(angle);
        const swing = -badgeHeight * Math.sin(angle);
        const minX = 10 + halfWidth - Math.min(0,swing);
        const maxX = bounds.width - 10 - halfWidth - Math.max(0,swing);
        const safeX = clamp(rope.end.x,Math.min(minX,maxX),Math.max(minX,maxX));
        const correction = safeX - rope.end.x;
        if (Math.abs(correction) > .001) {
          rope.end.x = safeX;
          rope.end.px += correction * .85;
          if (rope.target) rope.target.x = safeX;
        }
      }
      tilt += (clamp(dx * 6,-24,24) - tilt) * .035;
      lastX = rope.end.x;
      accumulator -= 1000/120;
    }
  } else { accumulator = 0; }
  flip += (flipTarget - flip) * (motionOff ? 1 : .12);
  paint();
  if (!dragging && rope.energy < .009 && Math.abs(angularVelocity) < .0001 && Math.abs(flip-flipTarget) < .1) quietFrames++;
  else quietFrames = 0;
  if ((motionOff && !dragging && Math.abs(flip-flipTarget) < .1) || quietFrames > 75) { previousTime = 0; return; }
  frame = requestAnimationFrame(tick);
}
function wake() {
  quietFrames = 0;
  if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
}
function stop() { cancelAnimationFrame(frame); frame = 0; previousTime = 0; accumulator = 0; }
function updateDrag(e) {
  let x = e.clientX - bounds.left - pointerOffset.x;
  let y = e.clientY - bounds.top - pointerOffset.y;
  x = clamp(x,badgeWidth*.55,bounds.width-badgeWidth*.55);
  y = clamp(y,70,bounds.height-badgeHeight-25);
  const dx = x-rope.anchor.x, dy = y-rope.anchor.y;
  const dist = Math.hypot(dx,dy), limit = rope.length*.995;
  if (dist>limit) {x=rope.anchor.x+dx/dist*limit;y=rope.anchor.y+dy/dist*limit;}
  rope.target = {x,y};
  moved ||= Math.hypot(e.clientX-dragStart.x,e.clientY-dragStart.y)>6;
  wake();
}
badge.addEventListener('pointerdown',e=>{
  if (e.button !== 0 || dragging) return;
  bounds = hero.getBoundingClientRect();
  dragging=true; moved=false; pointerId=e.pointerId;
  pointerOffset={x:e.clientX-bounds.left-rope.end.x,y:e.clientY-bounds.top-rope.end.y};
  dragStart={x:e.clientX,y:e.clientY};
  badge.setPointerCapture(e.pointerId);
  $('#badge-help').classList.add('dismissed');
  updateDrag(e);
});
badge.addEventListener('pointermove',e=>{if(dragging && e.pointerId===pointerId) updateDrag(e);});
function release(e) {
  if(!dragging || e.pointerId!==pointerId) return;
  dragging=false; rope.target=null;
  if(badge.hasPointerCapture(e.pointerId)) badge.releasePointerCapture(e.pointerId);
  pointerId=null;
  if (motionOff) {rope.settle();angle=0;angularVelocity=0;tilt=0;}
  wake();
}
badge.addEventListener('pointerup',release);badge.addEventListener('pointercancel',release);badge.addEventListener('lostpointercapture',release);
badge.addEventListener('click',e=>{if(!moved || e.detail===0){flipTarget+=180;wake();}moved=false;});
badge.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key)) {
    e.preventDefault();
    if(e.key==='Escape'){flipTarget=0;rope.settle();angle=0;}
    else if(!motionOff) rope.impulse(e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0,e.key==='ArrowUp'?-3:2);
    wake();
  }
});
new ResizeObserver(()=>{stop();dragging=false;layout();}).observe(hero);
new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;
  if(visible)wake();else stop();
},{threshold:0}).observe(hero);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else wake();});

const motionButton=$('#motion-toggle');
function applyMotion() {
  document.documentElement.classList.toggle('motion-off',motionOff);
  motionButton.textContent=`动效：${motionOff?'关闭':'开启'}`;
  motionButton.setAttribute('aria-pressed',String(motionOff));
  if(rope){stop();if(motionOff){rope.settle();angle=0;tilt=0;paint();}else wake();}
}
motionButton.addEventListener('click',()=>{
  motionOff=!motionOff;applyMotion();
  try{localStorage.setItem('mzw-motion',motionOff?'off':'on');}catch{}
});
media.addEventListener('change',event=>{motionOff=event.matches;applyMotion();});
applyMotion();layout();

// Native scrolling, with reveal animations limited to transform and opacity.
document.documentElement.classList.add('js-ready');
const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -20px 0px'});
document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
const cursor=$('.cursor-dot');let cursorFrame=0,cursorX=0,cursorY=0;
const finePointer=matchMedia('(pointer:fine)');
function hideCursor(){
  cancelAnimationFrame(cursorFrame);cursorFrame=0;
  document.documentElement.classList.remove('custom-cursor-on');
  cursor.style.opacity='0';
}
document.addEventListener('pointermove',e=>{
  if(motionOff||!finePointer.matches||e.pointerType==='touch'){hideCursor();return;}
  cursorX=e.clientX;cursorY=e.clientY;
  cursor.classList.toggle('is-interactive',Boolean(e.target.closest('a,button,input,textarea,select,[role="button"]')));
  if(!cursorFrame)cursorFrame=requestAnimationFrame(()=>{
    cursor.style.transform=`translate3d(${cursorX}px,${cursorY}px,0) translate(-50%,-50%)`;
    cursor.style.opacity='1';
    document.documentElement.classList.add('custom-cursor-on');
    cursorFrame=0;
  });
},{passive:true});
document.documentElement.addEventListener('pointerleave',hideCursor);
window.addEventListener('blur',hideCursor);
finePointer.addEventListener('change',hideCursor);
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideCursor();});

// Pause the CSS ticker off screen; it needs no JavaScript animation loop.
const emailMarquee=$('.email-marquee-track');
new IntersectionObserver(entries=>{
  emailMarquee.classList.toggle('is-visible',entries[0].isIntersecting);
}).observe($('.email-marquee'));

const projects={
  flood:{eyebrow:'01 / AI × HYDRODYNAMICS / 2025',title:'城市洪涝迷宫 · AI 最优解',lead:'面向城市内涝中的车辆通行与应急救援，把时序预测、水动力模拟和路径规划连接起来。担任项目负责人，团队获得第十九届“挑战杯”揭榜挂帅擂台赛国家一等奖。',metrics:[['59.6×','相较传统模型的计算加速'],['278','降雨情景对比测试'],['<9.8%','面积、水深、总水量相对误差']],sections:[['我负责的部分','构建并联调 CNN + BiGRU 与水动力求解器的耦合模型，完成降雨预测与车辆路径规划的衔接；统筹团队技术研讨、任务推进和竞赛答辩。'],['从数据到系统','处理渭南市 DEM、土地利用、降雨和路网数据，完成时序对齐、空间处理、路网校核与训练验证样本构建。'],['让计算跟上决策','针对“时间步 × 空间网格”的十亿级累计数据量，开发路网积水 GPU 并行计算程序，约 10 分钟完成处理；原 CPU 方案预计需 5 天。']],tags:['Python','PyTorch','CNN + BiGRU','CUDA / CuPy','路径规划'],source:'数据与职责来自本人简历。'},
  vision:{eyebrow:'02 / COMPUTER VISION / 2024',title:'让小车看懂世界',lead:'智能车视觉感知与避障系统设计。将目标识别、超声测距和运动控制串联起来，让软件的判断变成小车的实际行动。',metrics:[['4B','Raspberry Pi 主控平台'],['PID','速度与转向控制'],['EI','第一作者会议论文']],image:'assets/vehicle-original.jpg',sections:[['感知与控制','基于树莓派 4B 和 OpenCV 实现归一化相关模板匹配，结合 YOLOv5 目标检测、超声测距与 PID 控制，完成交通标识识别及车速、转向调节。'],['从屏幕走到实车','在弱光、遮挡和转弯等场景开展实车测试，验证交通标识识别、相应控制行为及前方障碍物避让。'],['研究成果','第一作者论文 Design of Target Tracking Intelligent Vehicle Based on Machine Vision 发表于 AINIT 2024（EI 会议）。']],tags:['OpenCV','Raspberry Pi','YOLOv5','PID','计算机视觉'],source:'职责和技术信息来自本人简历；图像提取自本人 2024 年论文中的目标跟踪测试画面。'},
  simulation:{eyebrow:'03 / ADAPTIVE SIMULATION / 2026 — ONGOING',title:'跟上城市变化的模型',lead:'面向城市动态更新的雨洪过程数值模拟方法研究。关注城市变化时，如何通过动态分区和局部更新，让模拟更适应实际场景。',metrics:[['SWMM','管网与雨洪模拟'],['2D','地表模拟结果分析'],['2026','5 月起持续研究']],sections:[['主要技术开发','负责数据整理、分区算法开发与实验设计，协同课题组推进自适应分区及局部更新研究。'],['让分区有依据','基于 Python、SWMM 及二维地表模拟结果，实现水量交换分析与动态分区，研究雨强、交换阈值和分块率之间的关系。'],['验证与复盘','分析水量平衡和异常积水原因，梳理边界处理的改进点，并编写技术报告以支撑模型验证。']],tags:['Python','SWMM','二维模拟','动态分区','水量平衡'],source:'研究内容来自本人简历。'}
};
const dialog=$('#project-dialog'),content=$('#dialog-content');let dialogTrigger;
document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{
  const p=projects[button.dataset.project];dialogTrigger=button;
  content.innerHTML=`<p class="dialog-eyebrow">${p.eyebrow}</p><h2 id="dialog-title">${p.title}</h2><p class="dialog-lead">${p.lead}</p><div class="dialog-metrics">${p.metrics.map(([n,l])=>`<div><div class="metric-value">${n}</div><div class="metric-label">${l}</div></div>`).join('')}</div>${p.image?`<img class="dialog-image" src="${p.image}" alt="论文中的目标跟踪测试画面" width="452" height="320">`:''}${p.sections.map(([h,t])=>`<section class="dialog-section"><h3>${h}</h3><p>${t}</p></section>`).join('')}<div class="dialog-tags">${p.tags.map(tag=>`<span>${tag}</span>`).join('')}</div><p class="dialog-source">${p.source}</p>`;
  document.body.classList.add('dialog-open');dialog.showModal();dialog.scrollTop=0;
  dialog.append(cursor); // Keep the cursor above the native dialog's top layer.
}));
$('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.append(cursor);document.body.classList.remove('dialog-open');dialogTrigger?.focus({preventScroll:true});});
let toastTimeout;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}
const contacts={email:'19979064939@163.com',wechat:'Hauru1215',qq:'1917087472'};
async function copyText(text){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return;}catch{/* Fall back for local files and restricted browsers. */}
  }
  const focused=document.activeElement,field=document.createElement('textarea');
  field.value=text;field.readOnly=true;field.tabIndex=-1;
  field.style.cssText='position:fixed;left:-9999px;top:0;font-size:16px';
  document.body.append(field);field.select();field.setSelectionRange(0,text.length);
  try{if(!document.execCommand('copy'))throw new Error('Clipboard unavailable');}
  finally{field.remove();focused?.focus({preventScroll:true});}
}
document.querySelectorAll('[data-copy-contact]').forEach(button=>button.addEventListener('click',async()=>{
  try{await copyText(contacts[button.dataset.copyContact]);toast('已复制');}
  catch{toast('复制未成功，请检查浏览器剪贴板权限后重试');}
}));
