---
title: "Tasty 🍔"
permalink: /game/
author_profile: false
---

<p>A little break from research — catch the falling food on your plate. Every catch is <strong>Tasty!</strong> 🍽️<br/>
Move with your <strong>mouse</strong> or the <strong>← →</strong> arrow keys.</p>

<div id="tg" tabindex="0" aria-label="Tasty catch game">
  <div id="tg-hud"><span id="tg-score">Score: 0</span><span id="tg-best">Best: 0</span><span id="tg-time">⏱ 30</span></div>
  <div id="tg-plate">🍽️</div>
  <div id="tg-over"><div><h3 id="tg-title">Tasty!</h3><p id="tg-msg">Catch as much food as you can in 30 seconds.</p><button id="tg-btn" type="button">▶ Start</button></div></div>
</div>

<style>
#tg{position:relative;width:100%;max-width:640px;height:440px;margin:1rem auto;border:1px solid rgba(128,128,128,.28);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#eaf3ff,#f7fbff);user-select:none;touch-action:none;outline:none}
#tg-hud{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;gap:.5rem;padding:.5rem .85rem;font-weight:600;font-family:"Source Sans 3",system-ui,sans-serif;color:#2b3440;z-index:3}
#tg-plate{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:2.4rem;line-height:1;z-index:2;will-change:left}
.tg-food{position:absolute;font-size:1.9rem;line-height:1;z-index:1;will-change:transform}
.tg-pop{position:absolute;font-weight:700;color:#e8590c;font-family:"Source Sans 3",system-ui,sans-serif;pointer-events:none;z-index:4;animation:tg-pop .7s ease-out forwards}
@keyframes tg-pop{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-34px) scale(1.25)}}
#tg-over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(255,255,255,.82);backdrop-filter:blur(2px);z-index:5}
#tg-over h3{margin:0 0 .3rem;font-family:"Newsreader",Georgia,serif;font-size:1.6rem}
#tg-over p{margin:0 0 .9rem;color:#57606a}
#tg-btn{border:0;border-radius:9px;padding:.55rem 1.3rem;background:#2563eb;color:#fff;font-size:1rem;font-weight:600;cursor:pointer}
#tg-btn:hover{background:#1d4ed8}
#tg.playing #tg-over{display:none}
html[data-theme="dark"] #tg{background:linear-gradient(180deg,#0f1622,#0b0f16);border-color:rgba(255,255,255,.12)}
html[data-theme="dark"] #tg-hud{color:#e6edf3}
html[data-theme="dark"] #tg-over{background:rgba(13,17,23,.82)}
</style>

<script>
(function(){
  var tg=document.getElementById('tg'); if(!tg) return;
  var plate=document.getElementById('tg-plate'), over=document.getElementById('tg-over');
  var elScore=document.getElementById('tg-score'), elTime=document.getElementById('tg-time'), elBest=document.getElementById('tg-best');
  var elBtn=document.getElementById('tg-btn'), elTitle=document.getElementById('tg-title'), elMsg=document.getElementById('tg-msg');
  var FOODS=['🍔','🍕','🍰','🍣','🍩','🍎','🍜','🍟','🍤','🧁','🍇','🥐'];
  var W=0,H=0,plateX=0.5,plateHalf=40,foods=[],running=false,score=0,timeLeft=30,best=0,last=0,spawnAcc=0,timerAcc=0,raf=0;
  try{best=parseInt(localStorage.getItem('tasty-best')||'0',10)||0;}catch(e){}
  elBest.textContent='Best: '+best;
  function size(){var r=tg.getBoundingClientRect();W=r.width;H=r.height;}
  function setPlate(px){plateX=Math.max(plateHalf/W,Math.min(1-plateHalf/W,px));plate.style.left=(plateX*100)+'%';}
  function pop(x,y){var p=document.createElement('div');p.className='tg-pop';p.textContent='Tasty!';p.style.left=x+'px';p.style.top=y+'px';tg.appendChild(p);setTimeout(function(){p.remove();},700);}
  function spawn(){var f=document.createElement('div');f.className='tg-food';f.textContent=FOODS[(Math.random()*FOODS.length)|0];var x=Math.random()*(W-40)+20;f.style.left=x+'px';f.style.top='-30px';tg.appendChild(f);foods.push({el:f,x:x,y:-30,vy:120+Math.random()*90+score*2});}
  function end(){running=false;tg.classList.remove('playing');cancelAnimationFrame(raf);if(score>best){best=score;try{localStorage.setItem('tasty-best',String(best));}catch(e){}}elBest.textContent='Best: '+best;elTitle.textContent='Tasty! 😋';elMsg.textContent='You caught '+score+'. '+(score>=20?'Chef\u2019s kiss!':'Play again?');elBtn.textContent='▶ Play again';over.style.display='flex';}
  function loop(ts){if(!running)return;if(!last)last=ts;var dt=(ts-last)/1000;last=ts;if(dt>0.1)dt=0.1;spawnAcc+=dt;timerAcc+=dt;
    if(spawnAcc>Math.max(0.42,0.85-score*0.01)){spawnAcc=0;spawn();}
    if(timerAcc>=1){timerAcc-=1;timeLeft--;elTime.textContent='⏱ '+timeLeft;if(timeLeft<=0){end();return;}}
    var platePx=plateX*W;
    for(var i=foods.length-1;i>=0;i--){var o=foods[i];o.y+=o.vy*dt;o.el.style.transform='translateY('+(o.y+30)+'px)';
      if(o.y>=H-58 && o.y<=H-14 && Math.abs(o.x-platePx)<plateHalf+8){score++;elScore.textContent='Score: '+score;pop(o.x-10,H-72);o.el.remove();foods.splice(i,1);continue;}
      if(o.y>H+12){o.el.remove();foods.splice(i,1);}
    }
    raf=requestAnimationFrame(loop);
  }
  function start(){size();foods.forEach(function(o){o.el.remove();});foods=[];score=0;timeLeft=30;last=0;spawnAcc=0;timerAcc=0;running=true;elScore.textContent='Score: 0';elTime.textContent='⏱ 30';setPlate(0.5);tg.classList.add('playing');tg.focus();raf=requestAnimationFrame(loop);}
  elBtn.addEventListener('click',start);
  tg.addEventListener('mousemove',function(e){if(!W)size();var r=tg.getBoundingClientRect();setPlate((e.clientX-r.left)/r.width);});
  tg.addEventListener('touchmove',function(e){if(!W)size();var r=tg.getBoundingClientRect();var t=e.touches[0];setPlate((t.clientX-r.left)/r.width);e.preventDefault();},{passive:false});
  tg.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){setPlate(plateX-0.06);}else if(e.key==='ArrowRight'){setPlate(plateX+0.06);}});
  window.addEventListener('resize',size);
  size();setPlate(0.5);
})();
</script>
