/* =========================================================
   GAME EXTRA - Xử lý màn chọn mức độ full
   ========================================================= */
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
