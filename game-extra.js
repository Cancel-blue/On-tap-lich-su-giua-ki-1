/* =========================================================
   GAME EXTRA - Xử lý menu chọn bộ đề và mức độ full
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
