/* =========================================================
   GAME EXTRA - Xử lý menu + tự ẩn màn chọn bộ đề cho môn khác
   ========================================================= */

/* Ghi đè hàm chonBoDe cũ */
window.chonBoDe = function(set){
  sessionStorage.setItem("chosenSet", set);
  if(set === "full"){
    window.hienThiManHinh("screenChooseLevelFull");
  } else {
    window.hienThiManHinh("screenStart");
  }
};

window.hienThiManHinh = function(id){
  document.querySelectorAll(".screen").forEach(s=>{
    s.classList.toggle("active", s.id === id);
  });
  window.scrollTo({top:0, behavior:"smooth"});
};

window.quayLaiChonSet = function(){
  window.hienThiManHinh("screenChooseSet");
};

/* Xử lý chọn mức độ full */
let selectedFullDiff = "mediumFull";

document.addEventListener("DOMContentLoaded", ()=>{
  /* ============ PHẦN 1: TỰ ĐỘNG CHỌN MÀN HÌNH THEO MÔN ============ */
  const params = new URLSearchParams(window.location.search);
  const mon = params.get("mon") || "lich-su";

  const monInfo = {
    "lich-su": { name:"LỊCH SỬ", icon:"📜" },
    "dia-ly":  { name:"ĐỊA LÝ",  icon:"🌍" },
    "vat-ly":  { name:"VẬT LÝ",  icon:"⚛️" },
    "toan":    { name:"TOÁN",    icon:"🔢" },
    "hoa":     { name:"HÓA HỌC", icon:"🧪" }
  };
  const info = monInfo[mon] || monInfo["lich-su"];

  // Cập nhật tiêu đề màn chọn bộ đề
  const title = document.getElementById("chooseSetTitle");
  if(title) title.textContent = info.icon + " " + info.name;

  // Ẩn màn chọn bộ đề cho các môn KHÁC lịch sử
  if(mon !== "lich-su"){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    const screenStart = document.getElementById("screenStart");
    if(screenStart) screenStart.classList.add("active");
  }

  /* ============ PHẦN 2: XỬ LÝ CHỌN MỨC ĐỘ FULL ============ */
  const gridFull = document.getElementById("diffGridFull");
  if(gridFull){
    [...gridFull.querySelectorAll(".diff")].forEach(btn=>{
      btn.onclick = ()=>{
        selectedFullDiff = btn.dataset.key;
        [...gridFull.children].forEach(b=>b.classList.toggle("on", b === btn));
      };
    });
  }

  const btnStartFull = document.getElementById("btnStartFull");
  if(btnStartFull){
    btnStartFull.onclick = ()=>{
      sessionStorage.setItem("chosenSet", "full");
      sessionStorage.setItem("chosenDiff", selectedFullDiff);
      const url = new URL(window.location.href);
      url.searchParams.set("set", "full");
      window.location.href = url.toString();
    };
  }
});
