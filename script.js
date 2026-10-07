/* =========================================================
   CONFIG & STATE
   ========================================================= */
const DIFFICULTIES = {
  easy:    { label:"DỄ",          time:80, hard:false, pvp:false, desc:"Đảo vị trí đáp án • 1p20s/câu" },
  medium:  { label:"TRUNG BÌNH",  time:60, hard:false, pvp:false, desc:"Đảo vị trí đáp án • 1p/câu" },
  hard:    { label:"KHÓ",         time:40, hard:true,  pvp:false, desc:"Trộn đáp án câu khác • 40s/câu" },
  extreme: { label:"SIÊU KHÓ",    time:20, hard:true,  pvp:false, desc:"Trộn đáp án câu khác • 20s/câu" },
  pvp:     { label:"PVP 4 NGƯỜI", time:30, hard:false, pvp:true,  desc:"Bạn vs 3 bot • 30s/câu" }
};

const ITEMS = {
  gold:       { name:"Túi vàng",      icon:"💰", cls:"gold",       desc:"+200 điểm ngay" },
  freezeTime: { name:"Đóng băng giờ", icon:"⏱️", cls:"freezeTime", desc:"+30 giây cho câu này" },
  double:     { name:"Nhân đôi điểm", icon:"⚡", cls:"double",     desc:"Câu đúng tới x2" },
  freezeBot:  { name:"Đóng băng bot", icon:"❄️", cls:"freezeBot",  desc:"Freeze 1 bot 2 câu" },
  fifty:      { name:"Gợi ý 50:50",   icon:"🎯", cls:"fifty",      desc:"Loại 2 đáp án sai" }
};

const BOT_POOL = [
  { name:"Hùng Vương",     ava:"👑", speed:0.65, acc:0.55 },
  { name:"Lê Lợi",         ava:"🗡️", speed:0.70, acc:0.60 },
  { name:"Quang Trung",    ava:"🐉", speed:0.75, acc:0.65 },
  { name:"Trần Hưng Đạo",  ava:"🛡️", speed:0.60, acc:0.50 },
  { name:"Nguyễn Huệ",     ava:"⚔️", speed:0.72, acc:0.62 },
  { name:"Lý Thường Kiệt", ava:"🏹", speed:0.68, acc:0.58 }
];

let hardcoreMode = false;
let selectedDiff = "easy";
let S = null;
let pendingTimeout = null;
let online = null;
const MAX_ONLINE = 4;
const MON = window.CURRENT_MON || "lich-su";
const QUESTIONS = window.QUESTIONS || [];

const $ = id => document.getElementById(id);
const norm = s => s.trim().toLowerCase().replace(/\s+/g," ");
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

/* Nếu không có data -> cảnh báo */
if(QUESTIONS.length === 0){
  console.error("Không có data câu hỏi cho môn: " + MON);
}

/* =========================================================
   BUILD DIFF GRID
   ========================================================= */
(function buildDiffGrid(){
  const grid = $("diffGrid");
  if(!grid) return;
  Object.entries(DIFFICULTIES).forEach(([key,d])=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "diff" + (key===selectedDiff ? " on" : "") + (d.pvp ? " pvp" : "");
    b.dataset.key = key;
    b.innerHTML = `<b>${d.label}</b><small>${d.desc}</small>`;
    b.onclick = ()=>{
      selectedDiff = key;
      [...grid.children].forEach(c=>c.classList.toggle("on", c.dataset.key===key));
    };
    grid.appendChild(b);
  });
})();

$("toggleHardcore").onclick = function(){
  hardcoreMode = !hardcoreMode;
  this.classList.toggle("on", hardcoreMode);
};

/* =========================================================
   BẮT ĐẦU GAME
   ========================================================= */
$("btnStart").onclick = ()=>{
  const name = $("playerName").value.trim();
  if(!name){
    $("playerName").classList.add("err");
    $("playerName").focus();
    setTimeout(()=>$("playerName").classList.remove("err"),450);
    return;
  }
  if(QUESTIONS.length === 0){
    alert("Chưa có câu hỏi cho môn này!");
    return;
  }
  startGame(name, selectedDiff);
};
$("playerName").addEventListener("keydown", e=>{
  if(e.key==="Enter") $("btnStart").click();
});

function startGame(name, diff){
  clearTimeout(pendingTimeout);
  const cfg = DIFFICULTIES[diff];
  let totalTime = cfg.time;
  if(hardcoreMode) totalTime = Math.max(10, Math.round(totalTime/2));

  S = {
    name, diff, cfg, totalTime,
    queue: shuffle([...Array(QUESTIONS.length).keys()]),
    current: null, questionNumber: 0,
    score: 0, streak: 0, bestStreak: 0,
    correctCount: 0, wrongCount: 0,
    wrongPool: new Set(), wrongLog: [],
    answered: false, pendingReview: false,
    timerId: null, timeLeft: 0, dead: false,
    inventory: {}, doubleActive: false,
    curseRemaining: 0,
    isPvP: cfg.pvp, bots: [], frozenBots: {},
    onTimeUp: null
  };

  if(S.isPvP) setupBots();
  $("hudName").textContent = name;
  $("avatar").textContent = name.charAt(0).toUpperCase();
  $("pvpBoard").style.display = S.isPvP ? "grid" : "none";
  $("invBar").style.display = S.isPvP ? "flex" : "none";
  $("effectBadges").style.display = S.isPvP ? "flex" : "none";
  $("curseChip").style.display = "none";

  updateHud();
  updateInventory();
  updatePvpBoard();
  showScreen("screenQuiz");
  nextQuestion();
}

function setupBots(){
  const pool = shuffle([...BOT_POOL]);
  S.bots = [];
  for(let i=0;i<3;i++){
    const base = pool[i];
    S.bots.push({
      name: base.name, ava: base.ava,
      speed: base.speed, acc: base.acc,
      score: 0, lastResult: null
    });
  }
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active", s.id===id));
  window.scrollTo({top:0, behavior:"smooth"});
}

/* =========================================================
   BUILD OPTIONS + RENDER CÂU HỎI
   ========================================================= */
function buildOptions(qIdx, hard){
  const q = QUESTIONS[qIdx];
  const correctText = q.o[q.a];
  let list;
  if(!hard){
    list = q.o.map((t,i)=>({ text:t, correct:i===q.a }));
  } else {
    const seen = new Set([norm(correctText)]);
    const pool = [];
    QUESTIONS.forEach((other,oi)=>{
      if(oi===qIdx) return;
      other.o.forEach(t=>{
        const n = norm(t);
        if(seen.has(n)) return;
        seen.add(n); pool.push(t);
      });
    });
    shuffle(pool);
    const picked = pool.slice(0,3);
    list = [{ text:correctText, correct:true }, ...picked.map(t=>({ text:t, correct:false }))];
  }
  return shuffle(list);
}

function nextQuestion(){
  if(!S || S.dead) return;
  if(S.pendingReview){
    S.pendingReview = false;
    if(S.wrongPool.size > 0){
      const arr = [...S.wrongPool];
      const qi = arr[Math.floor(Math.random()*arr.length)];
      S.current = { qIndex:qi, options: buildOptions(qi, S.cfg.hard), isReview:true };
      renderQuestion(); return;
    }
  }
  if(S.queue.length === 0){ endGame(); return; }
  const qi = S.queue.shift();
  S.current = { qIndex:qi, options: buildOptions(qi, S.cfg.hard), isReview:false };
  renderQuestion();
}

function renderQuestion(){
  const cur = S.current;
  const q = QUESTIONS[cur.qIndex];
  S.answered = false;
  S.questionNumber++;

  $("qText").textContent = q.q;
  const badge = $("qBadge");
  if(S.curseRemaining > 0){
    badge.textContent = "💀 LỜI NGUYỀN -x2 (còn " + S.curseRemaining + " câu)";
    badge.className = "badge curse";
  } else if(cur.isReview){
    badge.textContent = "🔁 ÔN LẠI CÂU ĐÃ SAI";
    badge.className = "badge review";
  } else {
    badge.textContent = "CÂU HỎI";
    badge.className = "badge";
  }

  const box = $("options");
  box.innerHTML = "";
  box.classList.remove("locked");
  cur.options.forEach((opt,i)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = "ABCD"[i];
    const txt = document.createElement("span");
    txt.className = "otext";
    txt.textContent = opt.text;
    btn.append(letter, txt);
    btn.onclick = ()=>handleAnswer(i);
    box.appendChild(btn);
  });

  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  updateProgress();
  updateInventory();
  updatePvpBoard();
  startTimer();
  if(S.isPvP) scheduleBotsAnswer();
}

/* =========================================================
   TIMER
   ========================================================= */
function startTimer(){
  clearInterval(S.timerId);
  S.timeLeft = S.totalTime;
  paintTimer();
  S.timerId = setInterval(()=>{
    if(!S || S.dead){ clearInterval(S.timerId); return; }
    S.timeLeft -= 0.1;
    if(S.timeLeft <= 0){
      S.timeLeft = 0;
      paintTimer();
      clearInterval(S.timerId);
      if(S.onTimeUp) S.onTimeUp();
      else handleAnswer(-1);
    } else paintTimer();
  }, 100);
}

function paintTimer(){
  const p = Math.max(0, S.timeLeft / S.totalTime) * 100;
  const fill = $("timerFill");
  fill.style.width = p + "%";
  fill.style.background = p>50 ? "linear-gradient(90deg,#22c55e,#4ade80)"
    : p>20 ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
    : "linear-gradient(90deg,#dc2626,#ef4444)";
  $("timerText").textContent = Math.ceil(S.timeLeft) + "s";
  $("timerText").style.color = p<=20 ? "#f87171" : "#94a3b8";
}

/* =========================================================
   XỬ LÝ TRẢ LỜI
   ========================================================= */
function handleAnswer(selected){
  if(!S || S.answered || S.dead) return;
  S.answered = true;
  clearInterval(S.timerId);

  const cur = S.current;
  const correctIdx = cur.options.findIndex(o => o.correct);
  const btns = [...$("options").children];
  $("options").classList.add("locked");
  const isCorrect = (selected === correctIdx);

  if(isCorrect){
    btns[correctIdx].classList.add("correct");
    S.streak++;
    if(S.streak > S.bestStreak) S.bestStreak = S.streak;
    const mult = S.streak >= 2 ? 1.5 : 1;
    let gain = Math.round(100 * mult);
    const wasDouble = S.doubleActive;
    if(wasDouble){ gain *= 2; S.doubleActive = false; }
    S.score += gain;
    S.correctCount++;
    if(cur.isReview) S.wrongPool.delete(cur.qIndex);
    let msg = `✅ Chính xác! +${gain} điểm`;
    if(mult===1.5) msg += ` 🔥 x1.5`;
    if(wasDouble) msg += ` ⚡ x2`;
    setFeedback(true, msg);

    if(S.streak >= 5 && S.streak % 5 === 0){
      setTimeout(()=>tryDropItem(), 700);
    }
    if(S.correctCount % 10 === 0 && S.wrongPool.size > 0){
      S.pendingReview = true;
    }
  } else {
    if(selected >= 0) btns[selected].classList.add("wrong");
    btns[correctIdx].classList.add("correct");
    S.streak = 0;
    S.wrongCount++;
    S.wrongPool.add(cur.qIndex);
    S.wrongLog.push(cur.qIndex);

    let penalty = 50;
    if(S.curseRemaining > 0){
      penalty = 100;
      S.curseRemaining--;
      if(S.curseRemaining <= 0){
        setTimeout(()=>alert("💀 Lời nguyền đã kết thúc!"), 1200);
      }
    }
    S.score = Math.max(0, S.score - penalty);

    const ansLetter = "ABCD"[correctIdx];
    let msg = selected<0 ? `⏰ Hết giờ! Đáp án: ${ansLetter}` : `❌ Sai! Đáp án: ${ansLetter}`;
    msg += ` (-${penalty}đ)`;
    if(penalty === 100) msg += ` 💀`;
    setFeedback(false, msg);

    if(S.curseRemaining <= 0 && Math.random() < 0.25){
      setTimeout(()=>showCursePopup(), 1000);
    }
  }

  updateHud();
  updatePvpBoard();

  const delay = isCorrect ? 1200 : 1900;
  clearTimeout(pendingTimeout);
  pendingTimeout = setTimeout(()=>{
    if(S && !S.dead) nextQuestion();
  }, delay);
}

function setFeedback(ok, text){
  const f = $("feedback");
  f.textContent = text;
  f.className = "feedback " + (ok ? "ok" : "no");
}

function updateHud(){
  if(!S) return;
  $("hudScore").textContent = S.score.toLocaleString("vi-VN");
  $("hudStreak").textContent = S.streak >= 2 ? "x1.5" : "x1.0";
  $("streakChip").classList.toggle("hot", S.streak >= 2);
  if(S.curseRemaining > 0){
    $("curseChip").style.display = "flex";
    $("hudCurse").textContent = S.curseRemaining;
  } else {
    $("curseChip").style.display = "none";
  }
}

function updateProgress(){
  if(!S) return;
  const done = QUESTIONS.length - S.queue.length;
  $("progFill").style.width = (done / QUESTIONS.length * 100) + "%";
  $("progTxt").textContent = `${Math.min(done+1, QUESTIONS.length)}/${QUESTIONS.length}`;
      }
/* =========================================================
   VẬT PHẨM
   ========================================================= */
function tryDropItem(){
  if(Math.random() > 0.7) return;
  const keys = Object.keys(ITEMS);
  const validKeys = S.isPvP ? keys : keys.filter(k=>k!=="freezeBot");
  const key = validKeys[Math.floor(Math.random()*validKeys.length)];
  S.inventory[key] = (S.inventory[key] || 0) + 1;
  updateInventory();
  showItemPopup(key);
}

function showItemPopup(key){
  const item = ITEMS[key];
  const pop = document.createElement("div");
  pop.className = "surprise-popup";
  pop.innerHTML = `
    <div class="surprise-box">
      <span class="tag">✨ PHẦN THƯỞNG CHUỖI ${S.streak}</span>
      <span class="icon">${item.icon}</span>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <button class="btn-claim" onclick="this.closest('.surprise-popup').remove()">TUYỆT VỜI! 🎉</button>
    </div>
  `;
  document.body.appendChild(pop);
  setTimeout(()=>{ if(pop.parentNode) pop.remove(); }, 4000);
}

function showCursePopup(){
  if(!S) return;
  S.curseRemaining = 4;
  const pop = document.createElement("div");
  pop.className = "surprise-popup";
  pop.innerHTML = `
    <div class="surprise-box curse">
      <span class="tag">💀 TÌNH HUỐNG BẤT NGỜ</span>
      <span class="icon">💀</span>
      <h3>LỜI NGUYỀN -x2 ĐIỂM</h3>
      <p>Trong <b>4 câu tiếp theo</b>, mỗi lần sai bạn bị trừ <b>GẤP ĐÔI</b> (-100đ thay vì -50đ).</p>
      <button class="btn-claim" onclick="this.closest('.surprise-popup').remove()">CHẤP NHẬN 😰</button>
    </div>
  `;
  document.body.appendChild(pop);
  updateHud();
  setTimeout(()=>{ if(pop.parentNode) pop.remove(); }, 5000);
}

function updateInventory(){
  if(!S || !S.isPvP){ 
    if($("invBar")) $("invBar").style.display = "none"; 
    return; 
  }
  const bar = $("invBar");
  bar.style.display = "flex";
  const keys = Object.keys(S.inventory).filter(k=>S.inventory[k] > 0);
  if(keys.length === 0){
    bar.innerHTML = '<span class="empty">Túi đồ trống — chuỗi 5 để nhận vật phẩm!</span>';
    return;
  }
  bar.innerHTML = "";
  keys.forEach(key=>{
    const item = ITEMS[key];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item-btn " + item.cls;
    btn.innerHTML = `${item.icon}<span class="cnt">${S.inventory[key]}</span>`;
    btn.title = item.name + " - " + item.desc;
    btn.onclick = ()=>useItem(key);
    bar.appendChild(btn);
  });
}

function useItem(key){
  if(!S || S.answered) return;
  if(!S.inventory[key] || S.inventory[key] <= 0) return;

  if(key === "gold"){
    S.score += 200; S.inventory[key]--;
    setFeedback(true, "💰 +200 điểm!");
  }
  else if(key === "freezeTime"){
    S.timeLeft = Math.min(S.totalTime, S.timeLeft + 30);
    paintTimer(); S.inventory[key]--;
    setFeedback(true, "⏱️ +30 giây!");
  }
  else if(key === "double"){
    S.doubleActive = true; S.inventory[key]--;
    setFeedback(true, "⚡ Câu tới x2 điểm!");
  }
  else if(key === "freezeBot"){
    if(!S.isPvP){ S.inventory[key]--; return; }
    const avail = S.bots.map((b,i)=>i).filter(i=>!S.frozenBots[i]);
    if(avail.length === 0){
      setFeedback(false, "❄️ Tất cả bot đã bị freeze!"); return;
    }
    const target = avail[Math.floor(Math.random()*avail.length)];
    S.frozenBots[target] = 2; S.inventory[key]--;
    setFeedback(true, `❄️ Đã freeze ${S.bots[target].name}!`);
  }
  else if(key === "fifty"){
    const cur = S.current;
    const wrongIdxs = cur.options.map((o,i)=>o.correct ? -1 : i).filter(i=>i>=0);
    shuffle(wrongIdxs);
    const remove = wrongIdxs.slice(0,2);
    const btns = [...$("options").children];
    remove.forEach(i=>btns[i].classList.add("eliminated"));
    S.inventory[key]--;
    setFeedback(true, "🎯 Đã loại 2 đáp án sai!");
  }
  updateHud();
  updateInventory();
}

/* =========================================================
   PVP BOTS
   ========================================================= */
function scheduleBotsAnswer(){
  S.bots.forEach((bot, idx)=>{
    bot.lastResult = null;
    if(S.frozenBots[idx] && S.frozenBots[idx] > 0){
      S.frozenBots[idx]--;
      return;
    }
    const delay = (1.5 + Math.random()*3) * (1 / bot.speed);
    const willBeCorrect = Math.random() < bot.acc;
    setTimeout(()=>{
      if(!S) return;
      bot.lastResult = willBeCorrect ? "correct" : "wrong";
      if(willBeCorrect) bot.score += 100;
      updatePvpBoard();
    }, delay*1000);
  });
}

function updatePvpBoard(){
  if(!S || !S.isPvP) return;
  const board = $("pvpBoard");
  board.innerHTML = "";
  const me = document.createElement("div");
  me.className = "pvp-player me";
  me.innerHTML = `<span class="ava">${S.name.charAt(0).toUpperCase()}</span><span class="nm">${S.name}</span><span class="sc">${S.score}</span>`;
  board.appendChild(me);
  S.bots.forEach((bot, idx)=>{
    const el = document.createElement("div");
    el.className = "pvp-player";
    if(bot.lastResult === "correct") el.classList.add("correct");
    if(bot.lastResult === "wrong") el.classList.add("wrong");
    if(S.frozenBots[idx] && S.frozenBots[idx] > 0) el.classList.add("frozen");
    el.innerHTML = `<span class="ava">${bot.ava}</span><span class="nm">${bot.name}</span><span class="sc">${bot.score}</span>`;
    board.appendChild(el);
  });
}

/* =========================================================
   KẾT THÚC SOLO / PVP
   ========================================================= */
function endGame(){
  if(!S) return;
  S.dead = true;
  clearInterval(S.timerId);
  clearTimeout(pendingTimeout);

  const total = S.correctCount + S.wrongCount;
  const acc = total ? Math.round(S.correctCount/total*100) : 0;

  /* Lưu điểm cao vào localStorage */
  saveScore(MON, S.score);

  $("endName").textContent = `Người chơi: ${S.name} • Mức ${S.cfg.label}${hardcoreMode?" ⚡":""}`;
  $("endScore").textContent = S.score.toLocaleString("vi-VN");
  $("stCorrect").textContent = S.correctCount;
  $("stWrong").textContent = S.wrongCount;
  $("stAcc").textContent = acc + "%";
  $("stStreak").textContent = S.bestStreak;

  let title = "HOÀN THÀNH!";
  if(S.isPvP){
    const all = [{name:S.name, score:S.score, me:true}, ...S.bots.map(b=>({name:b.name, score:b.score, me:false}))];
    all.sort((a,b)=>b.score - a.score);
    const rank = all.findIndex(p=>p.me) + 1;
    if(rank === 1) title = "🏆 VÔ ĐỊCH PVP!";
    else if(rank === 2) title = "🥈 Á QUÂN PVP!";
    else if(rank === 3) title = "🥉 HẠNG 3 PVP!";
    else title = "😢 HẠNG 4 PVP!";
  } else {
    if(acc>=90) title="🏆 XUẤT SẮC!";
    else if(acc>=70) title="🌟 RẤT TỐT!";
    else if(acc>=50) title="👍 CỐ GẮNG THÊM!";
    else title="📚 ÔN LẠI NHÉ!";
  }
  $("endTitle").textContent = title;

  const list = $("wrongList");
  list.innerHTML = "";
  const uniq = [...new Set(S.wrongLog)];
  if(uniq.length){
    const h = document.createElement("h3");
    h.textContent = `❗ CÁC CÂU BẠN ĐÃ LÀM SAI (${uniq.length})`;
    list.appendChild(h);
    uniq.forEach(qi=>{
      const q = QUESTIONS[qi];
      const d = document.createElement("div");
      d.className = "wrong-item";
      d.innerHTML = `<div class="q">${q.q}</div><div class="a">✔ Đáp án đúng: <b>${"ABCD"[q.a]}. ${q.o[q.a]}</b></div>`;
      list.appendChild(d);
    });
  } else {
    const d = document.createElement("div");
    d.className = "wrong-item";
    d.style.borderLeftColor = "#22c55e";
    d.innerHTML = `<div class="q" style="color:#4ade80;margin:0">🎉 Tuyệt vời! Bạn không làm sai câu nào!</div>`;
    list.appendChild(d);
  }
  showScreen("screenEnd");
}

function saveScore(mon, score){
  if(score <= 0) return;
  const key = "bestScore_" + mon;
  const old = parseInt(localStorage.getItem(key) || "0");
  if(score > old) localStorage.setItem(key, score.toString());
  const playsKey = "plays_" + mon;
  const plays = parseInt(localStorage.getItem(playsKey) || "0") + 1;
  localStorage.setItem(playsKey, plays.toString());
}

/* =========================================================
   NÚT ĐIỀU KHIỂN
   ========================================================= */
$("btnQuit").onclick = ()=>{
  if(online && online.started){
    if(confirm("Rời trận đấu online?")){ leaveOnline(); showScreen("screenStart"); }
    return;
  }
  if(!S) return;
  if(confirm("Bạn có chắc muốn thoát? Kết quả sẽ không lưu.")){
    S.dead = true;
    clearInterval(S.timerId);
    clearTimeout(pendingTimeout);
    S = null;
    showScreen("screenStart");
  }
};
$("btnHome").onclick = ()=>{ 
  if(online) leaveOnline();
  S = null; 
  window.location.href = "index.html";
};
$("btnReplay").onclick = ()=>{
  if(online){ leaveOnline(); showScreen("screenStart"); return; }
  if(!S){ showScreen("screenStart"); return; }
  startGame(S.name, S.diff);
};
/* =========================================================
   ONLINE PEERJS
   ========================================================= */
function genRoomCode(){
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for(let i=0;i<4;i++) s += c[Math.floor(Math.random()*c.length)];
  return s;
}

$("btnOnlineMode").onclick = ()=>{
  if(QUESTIONS.length === 0){
    alert("Chưa có câu hỏi cho môn này!");
    return;
  }
  const name = $("playerName").value.trim();
  if(!name){
    $("playerName").classList.add("err");
    $("playerName").focus();
    setTimeout(()=>$("playerName").classList.remove("err"),450);
    return;
  }
  online = {
    myName: name, isHost: false, roomCode: null,
    peer: null, connections: [], hostConn: null,
    players: {}, myUid: null, ready: false, started: false,
    questions: null, qIndex: -1, currentShuffled: null,
    myAnswered: false, myChoice: -1
  };
  showScreen("screenLobby");
};

$("btnModeCreate").onclick = function(){
  this.classList.add("on"); $("btnModeJoin").classList.remove("on");
  $("lobbyCreate").style.display = "block";
  $("lobbyJoin").style.display = "none";
};
$("btnModeJoin").onclick = function(){
  this.classList.add("on"); $("btnModeCreate").classList.remove("on");
  $("lobbyJoin").style.display = "block";
  $("lobbyCreate").style.display = "none";
  $("inputRoomCode").focus();
};

$("btnLobbyBack").onclick = ()=>{
  if(online && online.peer){ try{online.peer.destroy()}catch(e){} }
  online = null;
  showScreen("screenStart");
};

$("btnDoCreate").onclick = ()=>{
  if(!online) return;
  const code = genRoomCode();
  const peer = new Peer("lvnm-" + code, { debug: 1 });
  peer.on("open", ()=>{
    online.peer = peer;
    online.isHost = true;
    online.roomCode = code;
    online.myUid = "host";
    online.players = { "host": { name: online.myName, ready: true, score: 0, isHost: true } };
    online.ready = true;
    $("roomCodeShow").textContent = code;
    $("roomTitle").textContent = "👑 PHÒNG CỦA BẠN";
    showScreen("screenRoom");
    renderOnlinePlayers();
    updateReadyBtn();
    peer.on("connection", conn=>setupHostConnection(conn));
  });
  peer.on("error", err=>{
    if(err.type === "unavailable-id"){
      try{ peer.destroy() }catch(e){}
      $("btnDoCreate").click();
    } else {
      alert("Lỗi kết nối: " + err.type);
      showScreen("screenLobby");
    }
  });
};

$("btnDoJoin").onclick = ()=>{
  if(!online) return;
  const code = $("inputRoomCode").value.trim().toUpperCase();
  if(code.length !== 4){
    $("inputRoomCode").style.borderColor = "#ef4444";
    $("inputRoomCode").focus();
    setTimeout(()=>$("inputRoomCode").style.borderColor = "#2b3a55", 500);
    return;
  }
  const peer = new Peer({ debug: 1 });
  peer.on("open", ()=>{
    online.peer = peer;
    online.isHost = false;
    online.roomCode = code;
    online.myUid = "p_" + Date.now();
    const conn = peer.connect("lvnm-" + code, { reliable: true });
    online.hostConn = conn;
    $("roomCodeShow").textContent = code;
    $("roomTitle").textContent = "🎮 PHÒNG CHỜ";
    showScreen("screenRoom");
    $("onlinePlayerList").innerHTML = '<div class="waiting"><i></i><i></i><i></i><span>Đang kết nối...</span></div>';
    conn.on("open", ()=>{
      conn.send({ type:"hello", uid: online.myUid, name: online.myName });
    });
    conn.on("data", handleGuestData);
    conn.on("close", ()=>{
      alert("Chủ phòng đã rời! Phòng tan.");
      online = null;
      showScreen("screenStart");
    });
  });
  peer.on("error", ()=>{
    alert("Không tìm thấy phòng " + code + "!");
    showScreen("screenLobby");
  });
};

function setupHostConnection(conn){
  conn.on("open", ()=>{
    if(online.connections.length >= MAX_ONLINE-1){
      conn.send({ type:"full" });
      setTimeout(()=>conn.close(), 500);
      return;
    }
    online.connections.push(conn);
  });
  conn.on("data", data=>handleHostData(conn, data));
  conn.on("close", ()=>{
    online.connections = online.connections.filter(c=>c !== conn);
    Object.keys(online.players).forEach(uid=>{
      if(uid !== "host" && online.players[uid].conn === conn){
        delete online.players[uid];
      }
    });
    broadcastPlayers();
    renderOnlinePlayers();
  });
}

function handleHostData(conn, data){
  if(!online) return;
  switch(data.type){
    case "hello":
      online.players[data.uid] = {
        name: data.name, ready: false, score: 0,
        isHost: false, conn: conn
      };
      broadcastPlayers();
      renderOnlinePlayers();
      break;
    case "ready":
      if(online.players[data.uid]){
        online.players[data.uid].ready = data.ready;
        broadcastPlayers();
        renderOnlinePlayers();
        updateReadyBtn();
      }
      break;
    case "answer":
      if(online.players[data.uid]){
        if(data.correct) online.players[data.uid].score += data.points;
        broadcast({ type:"scores", scores: getScoresObj() });
        renderOnlinePlayers();
        renderOnlinePvpBoard();
      }
      break;
  }
}

function handleGuestData(data){
  if(!online) return;
  switch(data.type){
    case "full":
      alert("Phòng đã đầy!");
      try{ online.peer.destroy(); }catch(e){}
      online = null;
      showScreen("screenStart");
      break;
    case "players":
      online.players = data.players;
      renderOnlinePlayers();
      updateReadyBtn();
      break;
    case "start":
      online.questions = data.questions;
      online.started = true;
      online.qIndex = -1;
      online.myAnswered = false;
      $("hudName").textContent = online.myName;
      $("avatar").textContent = online.myName.charAt(0).toUpperCase();
      $("pvpBoard").style.display = "grid";
      $("invBar").style.display = "flex";
      $("invBar").innerHTML = '<span class="empty">Trả lời đúng để nhận vật phẩm!</span>';
      $("effectBadges").style.display = "none";
      showScreen("screenQuiz");
      break;
    case "question":
      online.qIndex = data.index;
      online.currentShuffled = data.shuffled;
      online.myAnswered = false;
      online.myChoice = -1;
      renderOnlineQuestion(data);
      break;
    case "scores":
      Object.keys(data.scores).forEach(uid=>{
        if(online.players[uid]) online.players[uid].score = data.scores[uid];
      });
      renderOnlinePlayers();
      renderOnlinePvpBoard();
      break;
    case "end":
      showOnlineEnd(data.ranking);
      break;
  }
}

function broadcast(data){
  if(!online || !online.isHost) return;
  online.connections.forEach(c=>{
    try{ c.send(data) }catch(e){}
  });
}

function broadcastPlayers(){
  if(!online || !online.isHost) return;
  const clean = {};
  Object.keys(online.players).forEach(uid=>{
    const p = online.players[uid];
    clean[uid] = { name:p.name, ready:p.ready, score:p.score, isHost:p.isHost };
  });
  broadcast({ type:"players", players: clean });
}

function getScoresObj(){
  const o = {};
  Object.keys(online.players).forEach(uid=>{
    o[uid] = online.players[uid].score;
  });
  return o;
}

function renderOnlinePlayers(){
  if(!online) return;
  const list = $("onlinePlayerList");
  const uids = Object.keys(online.players);
  $("onlineCount").textContent = uids.length + "/" + MAX_ONLINE;
  uids.sort((a,b)=>{
    if(online.players[a].isHost) return -1;
    if(online.players[b].isHost) return 1;
    return 0;
  });
  list.innerHTML = "";
  uids.forEach(uid=>{
    const p = online.players[uid];
    const el = document.createElement("div");
    el.className = "online-player-item";
    if(uid === online.myUid) el.classList.add("me");
    if(p.ready) el.classList.add("ready");
    if(p.isHost) el.classList.add("host");
    el.innerHTML = `
      <div class="online-player-ava">${p.name.charAt(0).toUpperCase()}</div>
      <div class="online-player-info">
        <div class="online-player-name">${p.name}${uid===online.myUid?" (Bạn)":""}</div>
        <div class="online-player-tags">
          ${p.isHost?'<span class="tg host">👑 CHỦ PHÒNG</span>':''}
          ${p.ready?'<span class="tg ready">✔ SẴN SÀNG</span>':'<span class="tg wait">⏳ CHỜ</span>'}
        </div>
      </div>
      <div class="online-player-score">${p.score || 0}</div>
    `;
    list.appendChild(el);
  });
}

function updateReadyBtn(){
  if(!online) return;
  const btn = $("btnReady");
  if(online.isHost){
    const readyCount = Object.values(online.players).filter(p=>p.ready).length;
    const total = Object.keys(online.players).length;
    if(readyCount < 2 || total < 2){
      btn.disabled = true;
      btn.className = "btn-ready off";
      btn.textContent = total < 2 ? "ĐANG CHỜ NGƯỜI CHƠI..." : "CẦN ≥2 NGƯỜI SẴN SÀNG";
    } else {
      btn.disabled = false;
      btn.className = "btn-ready";
      btn.textContent = `🚀 BẮT ĐẦU (${readyCount}/${total})`;
    }
  } else {
    btn.disabled = false;
    if(online.ready){
      btn.className = "btn-ready";
      btn.textContent = "✔ ĐÃ SẴN SÀNG";
    } else {
      btn.className = "btn-ready off";
      btn.textContent = "CHƯA SẴN SÀNG";
    }
  }
}

$("btnReady").onclick = ()=>{
  if(!online) return;
  if(online.isHost){
    if($("btnReady").disabled) return;
    startOnlineAsHost();
  } else {
    online.ready = !online.ready;
    if(online.hostConn && online.hostConn.open){
      online.hostConn.send({ type:"ready", uid: online.myUid, ready: online.ready });
    }
    updateReadyBtn();
  }
};

function startOnlineAsHost(){
  if(!online || !online.isHost) return;
  const list = shuffle([...Array(QUESTIONS.length).keys()]).slice(0, 10);
  online.questions = list;
  online.qIndex = -1;
  online.started = true;
  broadcast({ type:"start", questions: list });
  $("hudName").textContent = online.myName;
  $("avatar").textContent = online.myName.charAt(0).toUpperCase();
  $("pvpBoard").style.display = "grid";
  $("invBar").style.display = "flex";
  $("invBar").innerHTML = '<span class="empty">Trả lời đúng để nhận vật phẩm!</span>';
  $("effectBadges").style.display = "none";
  showScreen("screenQuiz");
  setTimeout(()=>sendNextOnlineQuestion(), 800);
}

function sendNextOnlineQuestion(){
  if(!online || !online.isHost) return;
  online.qIndex++;
  if(online.qIndex >= online.questions.length){
    const ranking = getRanking();
    broadcast({ type:"end", ranking: ranking });
    showOnlineEnd(ranking);
    return;
  }
  const qi = online.questions[online.qIndex];
  const q = QUESTIONS[qi];
  let shuffled = q.o.map((t,i)=>({ text:t, correct:i===q.a }));
  shuffled = shuffle(shuffled);
  online.currentShuffled = shuffled;
  online.myAnswered = false;
  online.myChoice = -1;
  broadcast({ type:"question", index: online.qIndex, qi: qi, shuffled: shuffled });
  renderOnlineQuestion({ index: online.qIndex, qi: qi, shuffled: shuffled });
}

function renderOnlineQuestion(data){
  const q = QUESTIONS[data.qi];
  const opts = data.shuffled;
  $("qText").textContent = q.q;
  $("qBadge").textContent = `CÂU ${data.index+1}/${online.questions.length}`;
  $("qBadge").className = "badge";
  const box = $("options");
  box.innerHTML = "";
  box.classList.remove("locked");
  opts.forEach((opt, i)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = "ABCD"[i];
    const txt = document.createElement("span");
    txt.className = "otext";
    txt.textContent = opt.text;
    btn.append(letter, txt);
    btn.onclick = ()=>handleOnlineAnswer(i);
    box.appendChild(btn);
  });
  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  $("progFill").style.width = ((data.index+1) / online.questions.length * 100) + "%";
  $("progTxt").textContent = `${data.index+1}/${online.questions.length}`;
  renderOnlinePvpBoard();
  const totalTime = hardcoreMode ? 15 : 30;
  S = {
    totalTime, timeLeft: totalTime, timerId: null,
    dead: false, answered: false,
    onTimeUp: ()=>handleOnlineAnswer(-1)
  };
  startTimer();
}

function handleOnlineAnswer(idx){
  if(!online || online.myAnswered) return;
  online.myAnswered = true;
  online.myChoice = idx;
  clearInterval(S.timerId);
  const opts = online.currentShuffled;
  const correctIdx = opts.findIndex(o=>o.correct);
  const isCorrect = (idx === correctIdx);
  const btns = [...$("options").children];
  $("options").classList.add("locked");
  if(isCorrect){
    btns[correctIdx].classList.add("correct");
    setFeedback(true, "✅ Chính xác! +100 điểm");
  } else {
    if(idx >= 0) btns[idx].classList.add("wrong");
    btns[correctIdx].classList.add("correct");
    setFeedback(false, "❌ Sai rồi! Đáp án: " + "ABCD"[correctIdx]);
  }
  if(online.players[online.myUid] && isCorrect){
    online.players[online.myUid].score = (online.players[online.myUid].score || 0) + 100;
  }
  renderOnlinePvpBoard();
  if(online.isHost){
    broadcast({ type:"scores", scores: getScoresObj() });
    clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(()=>sendNextOnlineQuestion(), 2000);
  } else {
    if(online.hostConn && online.hostConn.open){
      online.hostConn.send({ type:"answer", uid: online.myUid, correct: isCorrect, points: 100 });
    }
  }
}

function renderOnlinePvpBoard(){
  if(!online) return;
  const board = $("pvpBoard");
  board.innerHTML = "";
  const uids = Object.keys(online.players).sort((a,b)=>(online.players[b].score||0) - (online.players[a].score||0));
  uids.forEach(uid=>{
    const p = online.players[uid];
    const el = document.createElement("div");
    el.className = "pvp-player";
    if(uid === online.myUid) el.classList.add("me");
    el.innerHTML = `<span class="ava">${p.name.charAt(0).toUpperCase()}</span><span class="nm">${p.name}</span><span class="sc">${p.score || 0}</span>`;
    board.appendChild(el);
  });
}

function getRanking(){
  const arr = Object.keys(online.players).map(uid=>({
    name: online.players[uid].name,
    score: online.players[uid].score || 0,
    isMe: uid === online.myUid
  }));
  arr.sort((a,b)=>b.score - a.score);
  return arr;
}

function showOnlineEnd(ranking){
  if(!online) return;
  if(!ranking || ranking.length === 0){
    leaveOnline();
    showScreen("screenStart");
    return;
  }
  const myEntry = ranking.find(r => r.name === online.myName);
  const myRank = ranking.findIndex(r => r.name === online.myName) + 1;
  const myScore = myEntry ? myEntry.score : 0;

  let title = "HOÀN THÀNH!";
  if(myRank === 1) title = "🏆 VÔ ĐỊCH!";
  else if(myRank === 2) title = "🥈 Á QUÂN!";
  else if(myRank === 3) title = "🥉 HẠNG 3!";
  else if(myRank > 0) title = "😢 HẠNG " + myRank;

  $("endTitle").textContent = title;
  $("endName").textContent = `Phòng ${online.roomCode} • ${ranking.length} người chơi`;
  $("endScore").textContent = myScore.toLocaleString("vi-VN");
  $("stCorrect").textContent = "—";
  $("stWrong").textContent = "—";
  $("stAcc").textContent = "—";
  $("stStreak").textContent = myRank > 0 ? "#" + myRank : "—";

  const list = $("wrongList");
  list.innerHTML = "<h3>🏆 BẢNG XẾP HẠNG</h3>";
  ranking.forEach((r, i)=>{
    const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"#"+(i+1);
    const d = document.createElement("div");
    d.className = "wrong-item";
    d.style.borderLeftColor = r.isMe ? "#38bdf8" : "#94a3b8";
    d.innerHTML = `
      <div class="q" style="color:${r.isMe?'#7dd3fc':'#cbd5e1'}">${medal} ${r.name}${r.isMe?" (Bạn)":""}</div>
      <div class="a" style="color:#38bdf8;font-size:15px;font-weight:900">${r.score.toLocaleString("vi-VN")} điểm</div>
    `;
    list.appendChild(d);
  });
  showScreen("screenEnd");
}

$("btnLeaveRoom").onclick = ()=>{
  if(!online) return;
  if(!confirm("Rời phòng?")) return;
  leaveOnline();
  showScreen("screenStart");
};

function leaveOnline(){
  if(!online) return;
  if(online.isHost && online.connections){
    online.connections.forEach(c=>{
      try{ c.send({ type:"end", ranking:[] }) }catch(e){}
      try{ c.close() }catch(e){}
    });
  }
  if(online.peer){
    try{ online.peer.destroy() }catch(e){}
  }
  online = null;
}

window.addEventListener("beforeunload", e=>{
  if(online) leaveOnline();
  if(S && !S.dead && S.questionNumber > 0 && !online){
    e.preventDefault();
    e.returnValue = "";
  }
});
