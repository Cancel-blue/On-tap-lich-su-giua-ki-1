/* =========================================================
   ITEMS.JS - Hệ thống 13 item (CLEAN v3 - Live Binding)
   ========================================================= */

const ITEMS = {
  gold:       { name:"Túi vàng",       icon:"💰", slot:"gold",       desc:"+200 điểm ngay lập tức",                     type:"support" },
  freezeTime: { name:"Đóng băng giờ",  icon:"⏱️", slot:"freezeTime", desc:"+30 giây cho câu hiện tại",                  type:"support" },
  double:     { name:"Nhân đôi điểm",  icon:"⚡", slot:"double",     desc:"Câu đúng tiếp theo được x2 điểm",            type:"support" },
  fifty:      { name:"Gợi ý 50:50",    icon:"🎯", slot:"fifty",      desc:"Loại 2 đáp án sai (chỉ câu ABCD)",           type:"support" },
  shield:     { name:"Khiên năng lượng",icon:"🛡️",slot:"shield",     desc:"Kháng mọi sát thương trong 30 giây",         type:"defense" },
  mirror:     { name:"Gương phản chiếu",icon:"🪞",slot:"mirror",     desc:"Phản mọi đòn tấn công (trừ bom) trong 1 lượt",type:"defense" },
  freezeBot:  { name:"Đóng băng kép",  icon:"❄️", slot:"freezeBot",  desc:"Đóng băng 2 người chỉ định trong 10 giây",   type:"attack",  needTarget:2 },
  fireball:   { name:"Quả cầu lửa",    icon:"🔥", slot:"fireball",   desc:"Chỉ định 1 người: -100đ + cháy 10s",         type:"attack",  needTarget:1 },
  lightning:  { name:"Thiên lôi",      icon:"⚡", slot:"lightning",  desc:"Random 1 người -100đ (1%→5 tia ALL, 5%→2 tia)",type:"attack",  needTarget:0 },
  nuke:       { name:"Bom hạt nhân",   icon:"☢️", slot:"nuke",       desc:"-150đ TẤT CẢ + phóng xạ 25s (Gương vô hiệu)", type:"attack",  needTarget:0 },
  peace:      { name:"Lệnh bài hoà bình",icon:"🕊️",slot:"peace",     desc:"60s cấm mọi người tấn công, xóa buff phòng thủ",type:"special" },
  spear:      { name:"Giáo ngắn",      icon:"🗡️", slot:"spear",      desc:"Chỉ định 1 người: -75 điểm",                type:"attack",  needTarget:1 },
  magicHand:  { name:"Bàn tay ma thuật",icon:"🪄",slot:"magicHand",  desc:"Cướp 1 item random của người chỉ định",      type:"attack",  needTarget:1 }
};

/* ===== STATE ===== */
let myInventory = [];
let pvpPlayers = [];
let playerStatus = {};
let statusTimers = {};
let peaceActive = false;
let peaceUntil = 0;
let doubleActive = false;
let botInventories = {};
let botNukeUsed = {};
const MAX_INV = 3;

/* =========================================================
   ĐỒNG BỘ ĐIỂM PLAYER (chỉ lo phần của bạn)
   ========================================================= */
function syncGlobalToPvp() {
  if (typeof score === "undefined") return;
  const mePlayer = pvpPlayers.find(p => p.uid === "me");
  if (mePlayer) {
    const maxScore = Math.max(score, mePlayer.score);
    score = maxScore;
    mePlayer.score = maxScore;
  }
}

/* =========================================================
   KHỞI TẠO PLAYER DATA + TÚI ĐỒ BOT
   ========================================================= */
function initItemsSystem(){
  myInventory = [];
  pvpPlayers = [];

  /* Thêm người chơi */
  pvpPlayers.push({
    uid: "me",
    name: playerName,
    ava: playerName.charAt(0).toUpperCase(),
    score: score,
    isMe: true,
    isBot: false
  });

  /* Thêm bot với LIVE BINDING:
     pvpPlayers[bot_x].score LUÔN bằng bots[x].score (cùng 1 biến) */
  bots.forEach((b, i)=>{
    const botPlayer = {
      uid: "bot_" + i,
      name: b.name,
      ava: b.ava,
      isMe: false,
      isBot: true,
      botIdx: i
    };
    Object.defineProperty(botPlayer, 'score', {
      get() { return (typeof bots[i] !== "undefined" && bots[i]) ? bots[i].score : 0; },
      set(v) { if (typeof bots[i] !== "undefined" && bots[i]) bots[i].score = v; },
      enumerable: true,
      configurable: true
    });
    pvpPlayers.push(botPlayer);
  });

  pvpPlayers.forEach(p=>{
    playerStatus[p.uid] = {
      shield: 0, mirror: 0, fire: 0, radio: 0, peace: 0, frozen: 0
    };
    statusTimers[p.uid] = {};
  });

  peaceActive = false;
  peaceUntil = 0;

  /* Khởi tạo túi đồ cho từng bot */
  botInventories = {};
  pvpPlayers.forEach(p => {
    if (p.isBot) botInventories[p.uid] = [];
  });
}
/* ===== RƠI ITEM 25% MỖI CÂU ĐÚNG ===== */
function tryDropItem(){
  if(myInventory.length >= MAX_INV){
    console.log("Túi đầy, bỏ qua item");
    return;
  }
  if(Math.random() > 0.25) return;

  const keys = Object.keys(ITEMS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  myInventory.push(key);
  renderInventory();
  showItemPopup(key);
}

/* ===== POPUP NHẬN ITEM ===== */
function showItemPopup(key){
  const item = ITEMS[key];
  const pop = document.createElement("div");
  pop.className = "item-popup";
  pop.innerHTML = `
    <div class="item-box">
      <span class="tag">🎁 NHẬN ĐƯỢC ITEM</span>
      <span class="icon">${item.icon}</span>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <button class="btn-claim" onclick="this.closest('.item-popup').remove()">TUYỆT VỜI! 🎉</button>
    </div>
  `;
  document.body.appendChild(pop);
  setTimeout(()=>{ if(pop.parentNode) pop.remove(); }, 4000);
}

/* =========================================================
   RENDER TÚI ĐỒ 3 Ô
   ========================================================= */
function renderInventory(){
  const bar = document.getElementById("invBar");
  if(!bar) return;

  bar.innerHTML = "";

  for(let i = 0; i < MAX_INV; i++){
    const slot = document.createElement("div");
    slot.className = "inv-slot";

    if(i < myInventory.length){
      const key = myInventory[i];
      const item = ITEMS[key];
      slot.classList.add("filled");
      slot.dataset.item = key;
      slot.title = item.name + " - " + item.desc;
      slot.innerHTML = '<span class="icon">' + item.icon + '</span>';

      const sameCount = myInventory.filter(k => k === key).length;
      if(sameCount > 1){
        const cnt = document.createElement("span");
        cnt.className = "cnt";
        cnt.textContent = sameCount;
        slot.appendChild(cnt);
      }

      slot.onclick = ()=>useItemByIndex(i);
    } else {
      slot.innerHTML = '<span style="color:#2b3a55;font-size:22px">+</span>';
    }

    bar.appendChild(slot);
  }
}

/* =========================================================
   DÙNG ITEM
   ========================================================= */
function useItemByIndex(idx){
  syncGlobalToPvp();
  if(idx < 0 || idx >= myInventory.length) return;
  const key = myInventory[idx];
  const item = ITEMS[key];

  if(typeof cauHienTai === "undefined" || !danhSachChoi || danhSachChoi.length === 0){
    showToast("⏸️ Chưa vào ván chơi!", "warn");
    return;
  }

  if(item.needTarget === 1){
    showTargetModal(key, 1, (targets)=>{
      if(targets.length === 0) return;
      executeItem(key, targets);
      removeItemFromInv(idx);
    });
    return;
  }

  if(item.needTarget === 2){
    showTargetModal(key, 2, (targets)=>{
      if(targets.length < 2){
        showToast("❌ Cần chọn đủ 2 người!", "danger");
        return;
      }
      executeItem(key, targets);
      removeItemFromInv(idx);
    });
    return;
  }

  executeItem(key, []);
  removeItemFromInv(idx);
}

function removeItemFromInv(idx){
  myInventory.splice(idx, 1);
  renderInventory();
}

/* =========================================================
   MODAL CHỌN MỤC TIÊU
   ========================================================= */
function showTargetModal(itemKey, needCount, callback){
  const item = ITEMS[itemKey];
  const selected = [];

  const modal = document.createElement("div");
  modal.className = "target-modal";
  modal.id = "targetModal";

  let html = '<div class="target-box">';
  html += '<h3>' + item.icon + ' ' + item.name + '</h3>';
  html += '<p style="color:#94a3b8;font-size:12.5px;text-align:center;margin-bottom:14px">Chọn ' + needCount + ' người (đã chọn: <span id="selCount">0</span>/' + needCount + ')</p>';

  pvpPlayers.forEach(p=>{
    if(p.uid === "me") return;
    html += '<button type="button" class="target-btn" data-uid="' + p.uid + '">';
    html += '<span>' + p.ava + ' ' + p.name + '</span>';
    html += '<span class="sc">' + p.score + '</span>';
    html += '</button>';
  });

  html += '<button type="button" class="target-close" id="targetCancel">Hủy</button>';
  html += '</div>';

  modal.innerHTML = html;
  document.body.appendChild(modal);

  const btns = modal.querySelectorAll(".target-btn");
  const selCountEl = modal.querySelector("#selCount");

  btns.forEach(btn=>{
    btn.onclick = ()=>{
      const uid = btn.dataset.uid;
      const pos = selected.indexOf(uid);

      if(pos === -1){
        if(selected.length >= needCount){
          showToast("⚠️ Đã chọn đủ " + needCount + " người!", "warn");
          return;
        }
        selected.push(uid);
        btn.style.borderColor = "#22c55e";
        btn.style.background = "rgba(34,197,94,.15)";
      } else {
        selected.splice(pos, 1);
        btn.style.borderColor = "#2b3a55";
        btn.style.background = "#101a2c";
      }

      selCountEl.textContent = selected.length;

      if(selected.length === needCount){
        setTimeout(()=>{
          modal.remove();
          callback(selected);
        }, 200);
      }
    };
  });

  modal.querySelector("#targetCancel").onclick = ()=>{
    modal.remove();
  };
}

/* =========================================================
   NOTE CHỨC NĂNG ITEM
   ========================================================= */
function showItemNote(){
  const note = document.createElement("div");
  note.className = "item-note";

  let html = '<div class="note-box">';
  html += '<h3>📖 CHỨC NĂNG ITEM</h3>';

  Object.entries(ITEMS).forEach(([k, item])=>{
    html += '<div class="note-item">';
    html += '<span class="ic">' + item.icon + '</span>';
    html += '<div class="info">';
    html += '<div class="nm">' + item.name + '</div>';
    html += '<div class="ds">' + item.desc + '</div>';
    html += '</div>';
    html += '</div>';
  });

  html += '<button type="button" class="target-close" id="noteCloseBtn" style="margin-top:10px">Đóng</button>';
  html += '</div>';

  note.innerHTML = html;
  document.body.appendChild(note);

  const closeBtn = note.querySelector("#noteCloseBtn");
  if(closeBtn){
    closeBtn.onclick = () => note.remove();
  }
}

/* =========================================================
   TOAST THÔNG BÁO
   ========================================================= */
function showToast(msg, type){
  const toast = document.createElement("div");
  toast.className = "toast" + (type ? " " + type : "");
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(()=>{
    toast.style.opacity = "0";
    toast.style.transition = "opacity .3s";
    setTimeout(()=>{ if(toast.parentNode) toast.remove(); }, 300);
  }, 2800);
}
/* =========================================================
   HÀM XỬ LÝ SÁT THƯƠNG (CÓ KHIÊN/GƯƠNG)
   ========================================================= */
function applyDamage(targetUid, amount, sourceUid, isNuke){
  syncGlobalToPvp();
  const target = pvpPlayers.find(p => p.uid === targetUid);
  if(!target) return 0;

  const status = playerStatus[targetUid];
  if(!status) return 0;

  /* Chặn tấn công khi có Hoà bình (trừ system) */
  if(peaceActive && sourceUid !== "system"){
    return 0;
  }

  if(isNuke){
    target.score = Math.max(0, target.score - amount);
    syncScores();
    return amount;
  }

  if(status.shield > 0){
    showToast("🛡️ Khiên đã chặn sát thương!", "info");
    return 0;
  }

  if(status.mirror > 0 && sourceUid && sourceUid !== targetUid){
    status.mirror = 0;
    const reflectDmg = amount * 2;
    const sourcePlayer = pvpPlayers.find(p => p.uid === sourceUid);
    if(sourcePlayer){
      sourcePlayer.score = Math.max(0, sourcePlayer.score - reflectDmg);
      showToast("🪞 Gương phản chiếu! " + sourcePlayer.name + " nhận " + reflectDmg + "đ!", "success");
    }
    showToast("🪞 Bạn đã phản đòn " + amount + "đ (x2)!", "success");
    syncScores();
    return -amount;
  }

  target.score = Math.max(0, target.score - amount);
  syncScores();
  return amount;
}

/* =========================================================
   ÁP DỤNG STATUS EFFECT
   Với LIVE BINDING, khi p.score thay đổi → bots[i].score cũng đổi theo
   ========================================================= */
function applyStatus(targetUid, type, duration){
  const status = playerStatus[targetUid];
  if(!status) return;

  status[type] = duration;

  if(statusTimers[targetUid][type]){
    clearInterval(statusTimers[targetUid][type]);
  }
  statusTimers[targetUid][type] = setInterval(()=>{
    if(!status[type] || status[type] <= 0){
      clearInterval(statusTimers[targetUid][type]);
      statusTimers[targetUid][type] = null;
      status[type] = 0;
      updateStatusBadges();
      return;
    }
    status[type] -= 1;

    const p = pvpPlayers.find(pp => pp.uid === targetUid);
    if(p){
      if(type === "fire"){
        p.score = Math.max(0, p.score - 3);
        if(targetUid === "me") showToast("🔥 Đang cháy! -3đ", "warn");
      } else if(type === "radio"){
        p.score = Math.max(0, p.score - 2);
        if(targetUid === "me") showToast("☢️ Phóng xạ! -2đ", "warn");
      }
    }

    syncScores();
    updateStatusBadges();
  }, 1000);
}

function clearStatus(targetUid, type){
  const status = playerStatus[targetUid];
  if(!status) return;
  status[type] = 0;
  if(statusTimers[targetUid][type]){
    clearInterval(statusTimers[targetUid][type]);
    statusTimers[targetUid][type] = null;
  }
}

/* =========================================================
   SYNC ĐIỂM — CHỈ CẦN CẬP NHẬT HUD VÀ RENDER LẠI BOARD
   (Với LIVE BINDING, điểm bot tự động đồng bộ)
   ========================================================= */
function syncScores(){
  const mePlayer = pvpPlayers.find(p => p.uid === "me");
  if(mePlayer){
    score = mePlayer.score;
    const hudScore = document.getElementById("hudScore");
    if(hudScore) hudScore.textContent = score.toLocaleString("vi-VN");
  }

  renderPvpBoardMerged();
}

/* =========================================================
   RENDER PVP BOARD (dùng pvpPlayers)
   ========================================================= */
function renderPvpBoardMerged(){
  const board = document.getElementById("pvpBoard");
  if(!board) return;
  board.innerHTML = "";

  pvpPlayers.forEach(p => {
    const el = document.createElement("div");
    el.className = "pvp-player";
    if(p.isMe) el.classList.add("me");

    el.dataset.uid = p.uid;

    const status = playerStatus[p.uid] || {};
    let badgesHTML = "";

    if(status.shield > 0) badgesHTML += '<div class="status-badge shield">🛡️<span class="cd">' + status.shield + '</span></div>';
    if(status.mirror > 0) badgesHTML += '<div class="status-badge mirror">🪞</div>';
    if(status.fire > 0)   badgesHTML += '<div class="status-badge fire">🔥<span class="cd">' + status.fire + '</span></div>';
    if(status.radio > 0)  badgesHTML += '<div class="status-badge radio">☢️<span class="cd">' + status.radio + '</span></div>';
    if(status.frozen > 0) badgesHTML += '<div class="status-badge frozen">❄️<span class="cd">' + status.frozen + '</span></div>';

    if(badgesHTML){
      const badges = document.createElement("div");
      badges.className = "status-badges";
      badges.innerHTML = badgesHTML;
      el.appendChild(badges);
    }

    const inner = document.createElement("div");
    inner.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;width:100%";
    inner.innerHTML = '<span class="ava" style="font-size:22px">' + p.ava + '</span>' +
                     '<span class="nm" style="font-size:11px;font-weight:700;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + p.name + (p.isMe ? " (Bạn)" : "") + '</span>' +
                     '<span class="sc" style="font-size:15px;font-weight:900;color:#38bdf8">' + p.score + '</span>';
    el.appendChild(inner);
    board.appendChild(el);
  });

  if(peaceActive){
    const peaceBadge = document.createElement("div");
    peaceBadge.style.cssText = "grid-column:1/-1;text-align:center;font-size:12px;font-weight:800;color:#4ade80;padding:4px";
    const remain = Math.max(0, Math.ceil((peaceUntil - Date.now())/1000));
    peaceBadge.textContent = "🕊️ HOÀ BÌNH CÒN " + remain + "s";
    board.appendChild(peaceBadge);
  }
}

function updateStatusBadges(){
  renderPvpBoardMerged();
}

/* =========================================================
   EXECUTE ITEM (Hàm điều hướng)
   ========================================================= */
function executeItem(key, targets){
  switch(key){
    case "gold":       executeGold(); break;
    case "freezeTime": executeFreezeTime(); break;
    case "double":     executeDouble(); break;
    case "fifty":      executeFifty(); break;
    case "shield":     executeShield(); break;
    case "mirror":     executeMirror(); break;
    case "freezeBot":  executeFreezeBot(targets); break;
    case "fireball":   executeFireball(targets[0]); break;
    case "lightning":  executeLightning(); break;
    case "nuke":       executeNuke(); break;
    case "peace":      executePeace(); break;
    case "spear":      executeSpear(targets[0]); break;
    case "magicHand":  executeMagicHand(targets[0]); break;
  }
  }
/* ===== 1. TÚI VÀNG ===== */
function executeGold(){
  const me = pvpPlayers.find(p => p.uid === "me");
  if(me) me.score += 200;
  syncScores();
  showToast("💰 +200 điểm!", "success");
}

/* ===== 2. ĐÓNG BĂNG GIỜ ===== */
function executeFreezeTime(){
  timeLeft = Math.min(totalTime, timeLeft + 30);
  paintTimer();
  showToast("⏱️ +30 giây!", "success");
}

/* ===== 3. NHÂN ĐÔI ĐIỂM ===== */
function executeDouble(){
  doubleActive = true;
  showToast("⚡ Câu đúng tiếp theo x2 điểm!", "success");
}

/* ===== 4. GỢI Ý 50:50 ===== */
function executeFifty(){
  const cur = danhSachChoi[cauHienTai];
  if(!cur || cur.type !== "abcd"){
    showToast("❌ Chỉ dùng được ở câu ABCD!", "danger");
    return;
  }

  const correctIdx = cur.a;
  const wrongIdx = [0,1,2,3].filter(i => i !== correctIdx);
  const shuffled = wrongIdx.sort(()=>Math.random()-0.5);
  const remove = shuffled.slice(0,2);

  const opts = document.getElementById("options");
  if(!opts) return;
  [...opts.children].forEach((btn, i)=>{
    if(remove.includes(i)) {
      btn.style.opacity = "0.25";
      btn.style.textDecoration = "line-through";
    }
  });

  showToast("🎯 Đã loại 2 đáp án sai!", "success");
}

/* ===== 5. KHIÊN NĂNG LƯỢNG ===== */
function executeShield(){
  clearStatus("me", "mirror");
  applyStatus("me", "shield", 30);
  showToast("🛡️ Khiên 30 giây đã bật!", "success");
}

/* ===== 6. GƯƠNG PHẢN CHIẾU ===== */
function executeMirror(){
  clearStatus("me", "shield");
  applyStatus("me", "mirror", 999);
  showToast("🪞 Gương phản chiếu đã bật!", "success");
}

/* ===== 7. ĐÓNG BĂNG KÉP (2 người, 10s) ===== */
function executeFreezeBot(targets){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể đóng băng ai!", "warn");
    return;
  }
  targets.forEach(uid => {
    applyStatus(uid, "frozen", 10);
    const target = pvpPlayers.find(p => p.uid === uid);
    if(target){
      showToast("❄️ " + target.name + " bị đóng băng 10s!", "info");
    }
  });

  if(targets.includes("me")){
    showFreezeOverlay();
  }
}

function showFreezeOverlay(){
  if(document.getElementById("freezeOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "freeze-overlay";
  overlay.id = "freezeOverlay";
  overlay.innerHTML = `
    <div class="fr-box">
      <span class="fr-icon">❄️</span>
      <h3>BẠN ĐANG BỊ ĐÓNG BĂNG</h3>
      <div class="cd" id="freezeCountdown">10</div>
    </div>
  `;
  document.body.appendChild(overlay);

  let cd = 10;
  const cdEl = overlay.querySelector("#freezeCountdown");
  const timer = setInterval(()=>{
    cd--;
    if(cdEl) cdEl.textContent = cd;
    if(cd <= 0){
      clearInterval(timer);
      overlay.remove();
    }
  }, 1000);

  const input = document.querySelector(".tl-input");
  if(input) input.disabled = true;
  const opts = document.getElementById("options");
  if(opts) opts.classList.add("locked");
}

/* ===== 8. QUẢ CẦU LỬA ===== */
function executeFireball(targetUid){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể tấn công!", "warn");
    return;
  }
  const target = pvpPlayers.find(p => p.uid === targetUid);
  if(!target) return;

  applyDamage(targetUid, 100, "me", false);
  showToast("🔥 " + target.name + " bị cầu lửa! -100đ", "success");

  const status = playerStatus[targetUid];
  if(status && status.shield === 0){
    applyStatus(targetUid, "fire", 10);
    if(targetUid === "me") showToast("🔥 Bạn đang cháy! -3đ/s trong 10s", "danger");
  }
}

/* ===== 9. THIÊN LÔI ===== */
function executeLightning(){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể tấn công!", "warn");
    return;
  }
  const roll = Math.random();

  if(roll < 0.01){
    showToast("⚡⚡⚡ THIÊN LÔI ĐẶC BIỆT!\n5 tia giáng xuống TẤT CẢ!", "danger");
    pvpPlayers.forEach(p => {
      const dmg = applyDamage(p.uid, 100, "me", false);
      if(dmg > 0 && p.uid === "me") showToast("⚡ Bạn bị sét đánh! -100đ", "danger");
    });
    return;
  }

  if(roll < 0.06){
    const others = pvpPlayers.filter(p => p.uid !== "me");
    const shuffled = [...others].sort(()=>Math.random()-0.5);
    const twoTargets = shuffled.slice(0, 2);
    showToast("⚡ Thiên lôi kép! 2 người trúng!", "warn");
    twoTargets.forEach(t => {
      applyDamage(t.uid, 100, "me", false);
      showToast("⚡ " + t.name + " bị sét! -100đ", "success");
    });
    return;
  }

  const others = pvpPlayers.filter(p => p.uid !== "me");
  if(others.length === 0) return;
  const target = others[Math.floor(Math.random() * others.length)];
  applyDamage(target.uid, 100, "me", false);
  showToast("⚡ " + target.name + " bị sét đánh! -100đ", "success");
}

/* ===== 10. BOM HẠT NHÂN ===== */
function executeNuke(){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể thả bom!", "warn");
    return;
  }
  const confirmPop = document.createElement("div");
  confirmPop.className = "item-popup";
  confirmPop.innerHTML = `
    <div class="item-box" style="border-color:#dc2626;box-shadow:0 0 40px rgba(220,38,38,.6)">
      <span class="tag" style="background:rgba(220,38,38,.2);color:#f87171">⚠️ CẢNH BÁO</span>
      <span class="icon">☢️</span>
      <h3 style="color:#f87171">BOM HẠT NHÂN</h3>
      <p><b style="color:#fca5a5">Bạn cũng sẽ bị ảnh hưởng!</b><br>
      Tất cả người chơi <b>-150đ</b><br>
      (Host chịu <b>75%</b> = -112.5đ)<br>
      Tạo <b>vùng phóng xạ 25s</b> (-2đ/s)<br>
      <b style="color:#fbbf24">🪞 Gương KHÔNG phản được</b></p>
      <button class="btn-claim" id="nukeConfirm" style="background:linear-gradient(90deg,#dc2626,#991b1b);color:#fff">KÍCH HOẠT ☢️</button>
      <button class="btn-claim" id="nukeCancel" style="background:transparent;border:1px solid #475569;color:#94a3b8;margin-top:8px">HỦY</button>
    </div>
  `;
  document.body.appendChild(confirmPop);

  confirmPop.querySelector("#nukeCancel").onclick = ()=> confirmPop.remove();
  confirmPop.querySelector("#nukeConfirm").onclick = ()=>{
    confirmPop.remove();
    nukeExplode();
  };
}

function nukeExplode(){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể thả bom!", "warn");
    return;
  }
  pvpPlayers.forEach(p => {
    clearStatus(p.uid, "shield");
    clearStatus(p.uid, "mirror");
  });

  pvpPlayers.forEach(p => {
    const dmg = p.isMe ? 112.5 : 150;
    p.score = Math.max(0, p.score - dmg);
  });

  pvpPlayers.forEach(p => {
    applyStatus(p.uid, "radio", 25);
  });

  syncScores();

  const flash = document.createElement("div");
  flash.style.cssText = "position:fixed;inset:0;background:radial-gradient(circle,rgba(251,191,36,.6),transparent 70%);z-index:9998;pointer-events:none;animation:flashOut 1s";
  document.body.appendChild(flash);
  setTimeout(()=> flash.remove(), 1000);

  showToast("☢️ BOM NỔ!\nTất cả -150đ, bạn -112.5đ\nPhóng xạ 25s bắt đầu!", "danger");
}

/* ===== 11. LỆNH BÀI HOÀ BÌNH ===== */
function executePeace(){
  peaceActive = true;
  peaceUntil = Date.now() + 60000;

  pvpPlayers.forEach(p => {
    clearStatus(p.uid, "shield");
    clearStatus(p.uid, "mirror");
  });

  syncScores();
  showToast("🕊️ HOÀ BÌNH 60s!\nMọi người không thể tấn công.\nBuff phòng thủ đã bị xóa!", "success");

  const peaceTimer = setInterval(()=>{
    const remain = Math.ceil((peaceUntil - Date.now())/1000);
    if(remain <= 0){
      peaceActive = false;
      clearInterval(peaceTimer);
      renderPvpBoardMerged();
      showToast("🕊️ Hoà bình kết thúc!", "info");
      return;
    }
    renderPvpBoardMerged();
  }, 1000);
}

/* ===== 12. GIÁO NGẮN ===== */
function executeSpear(targetUid){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể tấn công!", "warn");
    return;
  }
  const target = pvpPlayers.find(p => p.uid === targetUid);
  if(!target) return;

  const dmg = applyDamage(targetUid, 75, "me", false);
  if(dmg > 0){
    showToast("🗡️ " + target.name + " bị giáo đâm! -75đ", "success");
  } else if(dmg === 0){
    showToast("🛡️ " + target.name + " đã chặn đòn!", "warn");
  }
}

/* ===== 13. BÀN TAY MA THUẬT ===== */
function executeMagicHand(targetUid){
  if(peaceActive){
    showToast("🕊️ Hoà bình đang bật, không thể cướp item!", "warn");
    return;
  }
  const target = pvpPlayers.find(p => p.uid === targetUid);
  if(!target) return;

  if(target.isBot){
    if(botInventories[targetUid] && botInventories[targetUid].length > 0){
      const stolenIdx = Math.floor(Math.random() * botInventories[targetUid].length);
      const stolenKey = botInventories[targetUid][stolenIdx];
      botInventories[targetUid].splice(stolenIdx, 1);
      if(myInventory.length < MAX_INV){
        myInventory.push(stolenKey);
        renderInventory();
      }
      showToast("🪄 Đã cướp " + ITEMS[stolenKey].name + " từ " + target.name + "!", "success");
    } else {
      showToast("🪄 " + target.name + " không có item để cướp!", "warn");
    }
    return;
  }

  showToast("🪄 Đã cướp item thành công!", "success");
}

/* =========================================================
   HỆ THỐNG ITEM CHO BOT — Bot tự động dùng item ngẫu nhiên
   ========================================================= */

/* Hook được gọi từ game-mix.html khi bot trả lời đúng */
function onBotCorrectAnswer(botUid){
  if(!botInventories[botUid]) botInventories[botUid] = [];
  if(botInventories[botUid].length >= MAX_INV) return;
  if(Math.random() > 0.15) return;

  const keys = Object.keys(ITEMS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  botInventories[botUid].push(key);

  const delay = 2000 + Math.random() * 4000;
  setTimeout(() => botUseRandomItem(botUid), delay);
}

/* Bot chọn ngẫu nhiên 1 item trong túi và dùng */
function botUseRandomItem(botUid){
  syncGlobalToPvp();
  const inv = botInventories[botUid];
  if(!inv || inv.length === 0) return;
  if(typeof cauHienTai === "undefined" || !danhSachChoi || danhSachChoi.length === 0) return;

  let availableKeys = [...inv];
  if(peaceActive){
    availableKeys = inv.filter(k => {
      const t = ITEMS[k].type;
      return t === "support" || t === "defense";
    });
    if(availableKeys.length === 0) return;
  }

  const chosenKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
  const idx = inv.indexOf(chosenKey);
  const item = ITEMS[chosenKey];
  inv.splice(idx, 1);

  const targets = [];
  if(item.needTarget === 1){
    const others = pvpPlayers.filter(p => p.uid !== botUid);
    if(others.length > 0) targets.push(others[Math.floor(Math.random() * others.length)].uid);
  } else if(item.needTarget === 2){
    const others = [...pvpPlayers.filter(p => p.uid !== botUid)].sort(() => Math.random() - 0.5);
    targets.push(...others.slice(0, 2).map(p => p.uid));
  }

  executeBotItem(botUid, chosenKey, targets);
}

/* Thực thi item từ phía Bot */
function executeBotItem(botUid, key, targets){
  const bot = pvpPlayers.find(p => p.uid === botUid);
  if(!bot) return;
  const botName = bot.name;
  const botAva = bot.ava;
  const itemType = ITEMS[key].type;

  /* Chặn item tấn công khi Hoà bình đang bật */
  if(peaceActive && itemType === "attack"){
    showToast("🕊️ Hoà bình đang bật, " + botName + " không thể tấn công!", "warn");
    return;
  }

  switch(key){
    case "gold":
      bot.score += 200;
      syncScores();
      showToast(botAva + " " + botName + " dùng 💰 Túi vàng! +200đ", "warn");
      break;

    case "double":
      bot.score += 50;
      syncScores();
      showToast(botAva + " " + botName + " dùng ⚡ Nhân đôi điểm! +50đ", "warn");
      break;

    case "freezeTime":
      bot.score += 20;
      syncScores();
      showToast(botAva + " " + botName + " dùng ⏱️ Đóng băng giờ!", "warn");
      break;

    case "fifty":
      bot.score += 30;
      syncScores();
      showToast(botAva + " " + botName + " dùng 🎯 Gợi ý 50:50!", "warn");
      break;

    case "shield":
      clearStatus(botUid, "mirror");
      applyStatus(botUid, "shield", 30);
      showToast(botAva + " " + botName + " bật 🛡️ Khiên 30s!", "warn");
      break;

    case "mirror":
      clearStatus(botUid, "shield");
      applyStatus(botUid, "mirror", 999);
      showToast(botAva + " " + botName + " bật 🪞 Gương phản chiếu!", "warn");
      break;

    case "fireball":
      if(targets[0]){
        const t = pvpPlayers.find(p => p.uid === targets[0]);
        if(t){
          applyDamage(targets[0], 100, botUid, false);
          const st = playerStatus[targets[0]];
          if(st && st.shield === 0) applyStatus(targets[0], "fire", 10);
          showToast(botAva + " " + botName + " ném 🔥 Cầu lửa vào " + t.name + "!", "danger");
        }
      }
      break;

    case "spear":
      if(targets[0]){
        const t = pvpPlayers.find(p => p.uid === targets[0]);
        if(t){
          applyDamage(targets[0], 75, botUid, false);
          showToast(botAva + " " + botName + " đâm 🗡️ Giáo vào " + t.name + "!", "danger");
        }
      }
      break;

    case "freezeBot":
      if(targets.length === 2){
        targets.forEach(uid => {
          applyStatus(uid, "frozen", 10);
          if(uid === "me") showFreezeOverlay();
        });
        showToast(botAva + " " + botName + " đóng băng ❄️ 2 người!", "danger");
      }
      break;

    case "lightning":
      const others = pvpPlayers.filter(p => p.uid !== botUid);
      if(others.length > 0){
        const t = others[Math.floor(Math.random() * others.length)];
        applyDamage(t.uid, 100, botUid, false);
        showToast(botAva + " " + botName + " gọi ⚡ Thiên lôi vào " + t.name + "!", "danger");
      }
      break;

    case "nuke":
      if(botNukeUsed[botUid]){
        showToast("🛑 " + botName + " đã dùng Bom rồi, không thể dùng lại!", "info");
        return;
      }
      botNukeUsed[botUid] = true;

      pvpPlayers.forEach(p => {
        clearStatus(p.uid, "shield");
        clearStatus(p.uid, "mirror");
        const dmg = p.uid === botUid ? 112.5 : 150;
        p.score = Math.max(0, p.score - dmg);
        applyStatus(p.uid, "radio", 25);
      });
      syncScores();

      const flash = document.createElement("div");
      flash.style.cssText = "position:fixed;inset:0;background:radial-gradient(circle,rgba(251,191,36,.6),transparent 70%);z-index:9998;pointer-events:none;animation:flashOut 1s";
      document.body.appendChild(flash);
      setTimeout(()=> flash.remove(), 1000);

      showToast("☢️ " + botName + " THẢ BOM HẠT NHÂN!", "danger");
      break;

    case "peace":
      peaceActive = true;
      peaceUntil = Date.now() + 60000;
      pvpPlayers.forEach(p => {
        clearStatus(p.uid, "shield");
        clearStatus(p.uid, "mirror");
      });
      syncScores();
      showToast("🕊️ " + botName + " dùng Lệnh bài hoà bình 60s!", "warn");
      const peaceTimer = setInterval(() => {
        const remain = Math.ceil((peaceUntil - Date.now())/1000);
        if(remain <= 0){
          peaceActive = false;
          clearInterval(peaceTimer);
          renderPvpBoardMerged();
          showToast("🕊️ Hoà bình kết thúc!", "info");
        }
      }, 1000);
      break;

    case "magicHand":
      if(targets[0] === "me" && myInventory.length > 0){
        const stolenIdx = Math.floor(Math.random() * myInventory.length);
        const stolenKey = myInventory[stolenIdx];
        myInventory.splice(stolenIdx, 1);
        renderInventory();
        botInventories[botUid].push(stolenKey);
        showToast("🪄 " + botName + " đã CƯỚP " + ITEMS[stolenKey].name + " của bạn!", "danger");
      } else if(targets[0]){
        const t = pvpPlayers.find(p => p.uid === targets[0]);
        showToast("🪄 " + botName + " cố cướp item của " + (t ? t.name : "ai đó") + " nhưng thất bại!", "warn");
      }
      break;
  }

  renderPvpBoardMerged();
}

/* =========================================================
   TÍCH HỢP ITEM VÀO FLOW GAME
   ========================================================= */

setInterval(() => {
  if (typeof peaceActive !== "undefined" && peaceActive) {
    renderPvpBoardMerged();
  }
}, 1000);

function onCorrectAnswer(){
  syncGlobalToPvp();
  tryDropItem();
}

function onNextQuestion(){
  const overlay = document.getElementById("freezeOverlay");
  if(overlay){
    overlay.remove();
  }
}

/* =========================================================
   INIT — GỌI KHI BẮT ĐẦU VÁN
   ========================================================= */
function initItemSystem(){
  if (typeof playerName === "undefined" || typeof bots === "undefined" || typeof score === "undefined") {
    console.warn("⏳ Item System chưa thể khởi tạo: Đang đợi game-mix.js...");
    return;
  }

  if (typeof isPvP !== "undefined" && isPvP === true && (!bots || bots.length === 0)) {
    console.warn("⚠️ PvP mode nhưng bots rỗng, đang khởi tạo lại bots...");
    if (typeof setupBots === "function") {
      setupBots();
    }
  }

  /* Reset giới hạn Bom cho từng bot */
  botNukeUsed = {};

  initItemsSystem();
  renderInventory();

  const invBar = document.getElementById("invBar");
  if(invBar && typeof isPvP !== "undefined" && isPvP){
    invBar.style.display = "flex";
  }

  renderPvpBoardMerged();
  }
