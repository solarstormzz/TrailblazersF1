/* =========================================================
   ROUTER
   ========================================================= */
function render(){
  const hash = location.hash.replace(/^#/,"") || "/";
  const parts = hash.split("/").filter(Boolean);
  const app = document.getElementById("app");
  let html = "";

  if(parts.length===0){
    html = pageHome();
  } else if(parts[0]==="news" && parts.length===1){
    html = pageNews();
  } else if(parts[0]==="article"){
    html = pageArticle(parts[1]);
  } else if(parts[0]==="schedule"){
    html = pageSchedule();
  } else if(parts[0]==="results" && parts.length===1){
    html = pageResultsIndex();
  } else if(parts[0]==="results" && parts.length===2){
    html = pageResultsIndex(parts[1]);
  } else if(parts[0]==="race"){
    html = pageRace(parts[1], parts[2]);
  } else if(parts[0]==="drivers" && parts.length===1){
    html = pageDrivers();
  } else if(parts[0]==="drivers" && parts.length===2){
    html = pageDrivers(parts[1]);
  } else if(parts[0]==="driver"){
    html = pageDriverDetail(parts[1], parts[2]);
  } else if(parts[0]==="teams" && parts.length===1){
    html = pageTeams();
  } else if(parts[0]==="teams" && parts.length===2){
    html = pageTeams(parts[1]);
  } else if(parts[0]==="team"){
    html = pageTeamDetail(parts[1], parts[2]);
  } else {
    html = pageHome();
  }

  app.innerHTML = html;
  window.scrollTo({top:0, behavior:"instant"});
  updateActiveNav(parts);
}

function updateActiveNav(parts){
  const top = parts[0] ? "/"+parts[0] : "/";
  document.querySelectorAll("nav.main-nav a").forEach(a=>{
    a.classList.toggle("active", a.dataset.route===top);
  });
  document.getElementById("mainNav").classList.remove("open");
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("footYear").textContent = CURRENT_YEAR;
  document.getElementById("navToggle").addEventListener("click", ()=>{
    document.getElementById("mainNav").classList.toggle("open");
  });
  render();
});