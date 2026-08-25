/* =========================================================
   VAULT — background driver/team/series database.
   Data lives in a private GitHub Gist (file: vault-data.json),
   synced manually via a "Save" button so edits don't spam the API.
   ========================================================= */

const GIST_FILENAME = "vault-data.json";
const CONFIG_KEY = "vaultConfig"; // {token, gistId}

let STATE = null;      // { meta, series, teams, drivers }
let DIRTY = false;
let SAVING = false;

/* ---------- helpers ---------- */
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function nextId(arr){ return arr.length ? Math.max(...arr.map(x=>x.id)) + 1 : 1; }
function teamSeriesIds(t){ return t.seriesIds || (t.seriesId != null ? [t.seriesId] : []); }
function migrateState(data){
  data.teams = (data.teams||[]).map(t=>{
    if(!t.seriesIds){
      t.seriesIds = t.seriesId != null ? [t.seriesId] : [];
      delete t.seriesId;
    }
    if(t.resultsName === undefined) t.resultsName = "";
    return t;
  });
  return data;
}
function latestNumber(history){
  const withNum = (history||[]).filter(h=>h.number !== null && h.number !== undefined && h.number !== "").sort((a,b)=>b.year-a.year);
  return withNum.length ? withNum[0].number : null;
}
function getConfig(){ try{ return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); }catch(e){ return null; } }
function setConfig(cfg){ localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }
function clearConfig(){ localStorage.removeItem(CONFIG_KEY); }
function setStatus(kind, text){
  const el = document.getElementById("vaultSaveStatus");
  el.className = "vault-save-status" + (kind ? " " + kind : "");
  el.textContent = text || "";
}
function markDirty(){
  DIRTY = true;
  document.getElementById("vaultSaveBtn").hidden = false;
  document.getElementById("vaultSaveBtn").disabled = false;
  setStatus("dirty", "Unsaved changes");
}

/* ---------- GitHub Gist API ---------- */
async function ghFetch(path, opts={}){
  const cfg = getConfig();
  const res = await fetch("https://api.github.com" + path, {
    ...opts,
    headers:{
      "Authorization": "token " + cfg.token,
      "Accept": "application/vnd.github+json",
      ...(opts.headers||{})
    }
  });
  if(!res.ok){
    const body = await res.text().catch(()=> "");
    throw new Error(`GitHub API ${res.status}: ${body.slice(0,200)}`);
  }
  return res.json();
}

async function loadFromGist(){
  const cfg = getConfig();
  if(!cfg.gistId){ return null; }
  const gist = await ghFetch("/gists/" + cfg.gistId);
  const file = gist.files && gist.files[GIST_FILENAME];
  if(!file) return null;
  // Gists truncate very large files in the summary response; fetch raw if so.
  let content = file.content;
  if(file.truncated){
    const raw = await fetch(file.raw_url);
    content = await raw.text();
  }
  return JSON.parse(content);
}

async function saveToGist(){
  if(SAVING) return;
  SAVING = true;
  document.getElementById("vaultSaveBtn").disabled = true;
  setStatus("dirty", "Saving\u2026");
  try{
    const cfg = getConfig();
    STATE.meta = STATE.meta || {};
    STATE.meta.lastUpdated = new Date().toISOString();
    const payload = { files: { [GIST_FILENAME]: { content: JSON.stringify(STATE, null, 2) } } };
    if(cfg.gistId){
      await ghFetch("/gists/" + cfg.gistId, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    } else {
      const created = await ghFetch("/gists", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ description:"TrailblazersF1 Vault data", public:false, ...payload })
      });
      cfg.gistId = created.id;
      setConfig(cfg);
    }
    DIRTY = false;
    document.getElementById("vaultSaveBtn").hidden = true;
    setStatus("saved", "Saved");
    setTimeout(()=>{ if(!DIRTY) setStatus("",""); }, 2500);
  } catch(err){
    setStatus("error", "Save failed \u2014 " + err.message);
  } finally {
    SAVING = false;
  }
}

/* ---------- setup screen ---------- */
function renderSetup(errorMsg){
  const app = document.getElementById("vaultApp");
  app.innerHTML = `
    <div class="vault-setup">
      <h1>Vault access</h1>
      <p>Enter your GitHub token to load or create the private Gist that stores Vault data. The token stays in this browser's local storage \u2014 it's never sent anywhere except directly to GitHub.</p>
      <div class="vault-field">
        <label>Personal access token (gist scope)</label>
        <input type="password" id="setupToken" placeholder="ghp_\u2026" autocomplete="off">
      </div>
      <div class="vault-field">
        <label>Gist ID (leave blank to create a new one)</label>
        <input type="text" id="setupGistId" placeholder="e.g. 8f3a1c9b2e...">
        <div class="vault-hint">Find this in the Gist's URL: gist.github.com/you/<b>this part</b></div>
      </div>
      ${errorMsg ? `<div class="vault-error">${esc(errorMsg)}</div>` : ""}
      <button class="btn-vault-add" id="setupSubmit" style="width:100%; padding:12px;">Connect</button>
    </div>
  `;
  document.getElementById("setupSubmit").addEventListener("click", async ()=>{
    const token = document.getElementById("setupToken").value.trim();
    const gistId = document.getElementById("setupGistId").value.trim();
    if(!token){ renderSetup("A token is required."); return; }
    setConfig({ token, gistId: gistId || null });
    await boot();
  });
}

/* ---------- seed prompt (empty gist / brand new) ---------- */
function renderSeedPrompt(){
  const app = document.getElementById("vaultApp");
  app.innerHTML = `
    <div class="vault-setup">
      <h1>No data yet</h1>
      <p>This Gist is empty. Start from scratch, or load your existing Formula One roster (${VAULT_SEED_DATA.teams.length} teams, ${VAULT_SEED_DATA.drivers.length} drivers) as a working example \u2014 the other three series start blank for you to fill in.</p>
      <button class="btn-vault-add" id="seedBtn" style="width:100%; padding:12px; margin-bottom:10px;">Load F1 example data</button>
      <button class="btn-vault-secondary" id="emptyBtn" style="width:100%; padding:12px;">Start completely empty</button>
    </div>
  `;
  document.getElementById("seedBtn").addEventListener("click", ()=>{
    STATE = migrateState(JSON.parse(JSON.stringify(VAULT_SEED_DATA)));
    markDirty();
    saveToGist().then(renderApp);
  });
  document.getElementById("emptyBtn").addEventListener("click", ()=>{
    STATE = migrateState({ meta:{}, series:[
      {id:1,name:"Formula One",shortName:"F1",color:"#E10600"},
      {id:2,name:"Series 2",shortName:"S2",color:"#3E7CB1"},
      {id:3,name:"Series 3",shortName:"S3",color:"#7C4DFF"},
      {id:4,name:"Series 4",shortName:"S4",color:"#E8A33D"}
    ], teams:[], drivers:[] });
    markDirty();
    saveToGist().then(renderApp);
  });
}

/* ---------- boot ---------- */
async function boot(){
  const app = document.getElementById("vaultApp");
  const cfg = getConfig();
  if(!cfg || !cfg.token){ renderSetup(); return; }
  app.innerHTML = `<div class="vault-loading">Loading vault\u2026</div>`;
  try{
    const data = await loadFromGist();
    if(!data){
      STATE = null;
      renderSeedPrompt();
      return;
    }
    STATE = migrateState(data);
    renderApp();
  } catch(err){
    renderSetup("Couldn't load that Gist \u2014 " + err.message);
  }
}

/* ---------- app shell + router ---------- */
function currentSeriesName(id){ const s = STATE.series.find(s=>s.id===id); return s ? s.name : "Unknown"; }
function currentTeamName(id){ const t = STATE.teams.find(t=>t.id===id); return t ? t.name : "Unknown"; }
function teamColor(id){ const t = STATE.teams.find(t=>t.id===id); return t ? t.color : "#666"; }

function renderApp(){
  const app = document.getElementById("vaultApp");
  const hash = location.hash.replace(/^#/,"") || "drivers";
  const tab = hash.split("-")[0].split("/")[0];

  app.innerHTML = `
    <div class="vault-tabs">
      <button class="vault-tab ${tab==='drivers'?'active':''}" data-tab="drivers">Drivers</button>
      <button class="vault-tab ${tab==='teams'?'active':''}" data-tab="teams">Teams</button>
      <button class="vault-tab ${tab==='series'?'active':''}" data-tab="series">Series</button>
      <button class="vault-tab ${tab==='grid'?'active':''}" data-tab="grid">Season Grid</button>
    </div>
    <div id="vaultTabBody"></div>
  `;
  app.querySelectorAll(".vault-tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{ location.hash = btn.dataset.tab; });
  });

  if(hash.startsWith("driver-")) renderDriverForm(hash.split("-")[1]);
  else if(hash==="drivers") renderDriversList();
  else if(hash.startsWith("team-")) renderTeamForm(hash.split("-")[1]);
  else if(hash==="teams") renderTeamsList();
  else if(hash==="series") renderSeriesTab();
  else if(hash==="grid") renderGridTab();
  else renderDriversList();

  document.getElementById("vaultSaveBtn").hidden = !DIRTY;
}

window.addEventListener("hashchange", renderApp);

/* ---------- DRIVERS: list ---------- */
function renderDriversList(){
  const body = document.getElementById("vaultTabBody");
  body.innerHTML = `
    <div class="vault-toolbar">
      <input type="search" id="driverSearch" placeholder="Search drivers\u2026">
      <select id="driverSeriesFilter"><option value="">All series</option>
        ${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}
      </select>
      <div class="spacer"></div>
      <button class="btn-vault-add" id="addDriverBtn">+ New driver</button>
    </div>
    <div class="vault-list" id="driversListBody"></div>
  `;
  document.getElementById("addDriverBtn").addEventListener("click", ()=>{ location.hash = "driver-new"; });
  const search = document.getElementById("driverSearch");
  const seriesFilter = document.getElementById("driverSeriesFilter");
  const draw = ()=>{
    const q = search.value.trim().toLowerCase();
    const sid = seriesFilter.value ? Number(seriesFilter.value) : null;
    let list = STATE.drivers.filter(d=>{
      const matchesQ = !q || d.name.toLowerCase().includes(q);
      const seriesIds = new Set((d.history||[]).map(h=>h.seriesId));
      const matchesSeries = !sid || seriesIds.has(sid);
      return matchesQ && matchesSeries;
    }).sort((a,b)=>a.name.localeCompare(b.name));
    const wrap = document.getElementById("driversListBody");
    if(!list.length){ wrap.innerHTML = `<div class="vault-empty">No drivers match.</div>`; return; }
    wrap.innerHTML = list.map(d=>{
      const seriesIds = [...new Set((d.history||[]).map(h=>h.seriesId))];
      const seriesNames = seriesIds.map(currentSeriesName).join(", ") || "Unassigned";
      const num = latestNumber(d.history);
      return `<div class="vault-row" data-id="${d.id}">
        <span class="rnumber">${num ? '#'+esc(num) : ''}</span>
        <span class="rname">${esc(d.name)}</span>
        <span class="rmeta">${esc(seriesNames)}</span>
        <span class="badge ${d.canon?'badge-canon':'badge-noncanon'}">${d.canon?'canon':'background'}</span>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".vault-row").forEach(row=>{
      row.addEventListener("click", ()=>{ location.hash = "driver-" + row.dataset.id; });
    });
  };
  search.addEventListener("input", draw);
  seriesFilter.addEventListener("change", draw);
  draw();
}

/* ---------- DRIVERS: form ---------- */
function renderDriverForm(idParam){
  const isNew = idParam === "new";
  const driver = isNew ? {
    id: nextId(STATE.drivers), name:"", code:"", number:null, nationality:"", birthYear:null,
    birthDate:"", birthPlace:"",
    stillActive:false, canon:false, achievements:"", wins:0, podiums:0, poles:0, bio:"", history:[],
    seriesStats:[]
  } : STATE.drivers.find(d=>d.id===Number(idParam));

  if(!driver){ location.hash = "drivers"; return; }
  if(!driver.seriesStats) driver.seriesStats = [];
  const body = document.getElementById("vaultTabBody");

  function teamOptionsForSeries(seriesId, selectedTeamId){
    seriesId = Number(seriesId);
    selectedTeamId = selectedTeamId ? Number(selectedTeamId) : null;
    let candidates = STATE.teams.filter(t=>teamSeriesIds(t).includes(seriesId)).sort((a,b)=>a.name.localeCompare(b.name));
    // Keep the currently-selected team selectable even if it's since moved series,
    // so switching things around doesn't silently blank a saved entry.
    if(selectedTeamId && !candidates.some(t=>t.id===selectedTeamId)){
      const forced = STATE.teams.find(t=>t.id===selectedTeamId);
      if(forced) candidates = [forced, ...candidates];
    }
    return candidates.map(t=>`<option value="${t.id}" ${t.id===selectedTeamId?'selected':''}>${esc(t.name)}</option>`).join("");
  }

  // Only top-tier (first-listed series, e.g. Formula One) teams with a Junior Team
  // name filled in are offered here \u2014 anything else is free text (h-academy-custom).
  function academySelectOptions(selectedTeamId){
    selectedTeamId = selectedTeamId ? Number(selectedTeamId) : null;
    const topSeriesId = STATE.series[0]?.id;
    const candidates = STATE.teams
      .filter(t=>teamSeriesIds(t).includes(topSeriesId) && (t.juniorTeam||"").trim())
      .sort((a,b)=>a.name.localeCompare(b.name));
    return `<option value="">\u2014 none / custom \u2014</option>` +
      candidates.map(t=>`<option value="${t.id}" ${t.id===selectedTeamId?'selected':''}>${esc(t.name)}</option>`).join("");
  }

  const historyCardHtml = (h, i) => {
    const topSeriesId = STATE.series[0]?.id;
    const isTopSeries = Number(h.seriesId) === topSeriesId;
    return `
    <div class="vault-history-entry" data-idx="${i}">
      <div class="vault-history-row">
        <input type="number" class="h-number" value="${h.number ?? ''}" placeholder="#">
        <input type="number" class="h-year" value="${h.year ?? ''}" placeholder="Year">
        <select class="h-series">${STATE.series.map(s=>`<option value="${s.id}" ${s.id===h.seriesId?'selected':''}>${esc(s.name)}</option>`).join("")}</select>
        <select class="h-team">${teamOptionsForSeries(h.seriesId, h.teamId)}</select>
        <input type="number" class="h-standing" value="${h.standing ?? ''}" placeholder="WDC pos.">
        <label class="vault-checkbox"><input type="checkbox" class="h-rookie" ${h.rookie?'checked':''}> Rookie</label>
        <button type="button" class="btn-remove-row" data-remove="${i}">&times;</button>
      </div>
      <div class="vault-history-subrow ${isTopSeries ? 'no-academy' : ''}">
        <select class="h-academy">${academySelectOptions(isTopSeries ? null : h.academyTeamId)}</select>
        <input type="text" class="h-academy-custom" value="${esc(isTopSeries ? '' : (h.academyCustom||''))}" placeholder="Or custom academy name">
        <input type="text" class="h-notes" value="${esc(h.notes||'')}" placeholder="Notes, e.g. replaced Driver X from round 10">
      </div>
    </div>`;
  };

  const statsRowHtml = (s, i) => `
    <div class="vault-stats-row" data-idx="${i}">
      <select class="st-series">${STATE.series.map(sr=>`<option value="${sr.id}" ${sr.id===s.seriesId?'selected':''}>${esc(sr.name)}</option>`).join("")}</select>
      <input type="number" class="st-wins" value="${s.wins ?? 0}" placeholder="Wins">
      <input type="number" class="st-podiums" value="${s.podiums ?? 0}" placeholder="Podiums">
      <input type="number" class="st-poles" value="${s.poles ?? 0}" placeholder="Poles">
      <input type="text" class="st-achievements" value="${esc(s.achievements||'')}" placeholder="e.g. 2019 F2 champion">
      <button type="button" class="btn-remove-row" data-remove-stats="${i}">&times;</button>
    </div>`;

  body.innerHTML = `
    <div class="vault-detail">
      <div class="vault-detail-head">
        <h2>${isNew ? "New driver" : esc(driver.name || "Untitled")}${!isNew && latestNumber(driver.history) ? `<span class="current-number">#${esc(latestNumber(driver.history))}</span>` : ""}</h2>
        <div class="vault-detail-actions">
          ${!isNew ? `<button class="btn-vault-secondary btn-vault-danger" id="deleteDriverBtn">Delete</button>` : ""}
          <button class="btn-vault-secondary" id="cancelDriverBtn">Back</button>
        </div>
      </div>
      <form id="driverForm">
        <div class="vault-grid-form">
          <div class="vault-field"><label>Name</label><input type="text" name="name" value="${esc(driver.name)}" required></div>
          <div class="vault-field"><label>Code</label><input type="text" name="code" maxlength="3" value="${esc(driver.code)}"></div>
          <div class="vault-field"><label>Nationality</label><input type="text" name="nationality" value="${esc(driver.nationality)}"></div>
          <div class="vault-field"><label>Birth place</label><input type="text" name="birthPlace" value="${esc(driver.birthPlace||'')}"></div>
          <div class="vault-field">
            <label>Birth date</label>
            <input type="date" name="birthDate" id="birthDateInput" value="${esc(driver.birthDate||'')}">
          </div>
          <div class="vault-field">
            <label>Birth year</label>
            <input type="number" name="birthYear" id="birthYearInput" value="${driver.birthYear ?? ''}">
            <div class="vault-hint" id="ageHint"></div>
          </div>
          <div class="vault-field"><label>Achievements</label><input type="text" name="achievements" value="${esc(driver.achievements)}" placeholder="e.g. 3x WDC"></div>
          <div class="vault-field"><label>Wins</label><input type="number" name="wins" value="${driver.wins ?? 0}"></div>
          <div class="vault-field"><label>Podiums</label><input type="number" name="podiums" value="${driver.podiums ?? 0}"></div>
          <div class="vault-field"><label>Poles</label><input type="number" name="poles" value="${driver.poles ?? 0}"></div>
          <div class="vault-field">
            <label>Status</label>
            <div class="vault-checkbox"><input type="checkbox" name="stillActive" ${driver.stillActive?'checked':''}> Still active</div>
          </div>
          <div class="vault-field span2">
            <label>Canon status</label>
            <div class="vault-checkbox"><input type="checkbox" name="canon" ${driver.canon?'checked':''}> Made it into the public site (canon)</div>
          </div>
          <div class="vault-field span2"><label>Bio / longform notes</label><textarea name="bio">${esc(driver.bio)}</textarea></div>
          <div class="vault-field span2">
            <label>Season history (drives the grid view)</label>
            <div class="vault-hint" style="margin-top:-4px; margin-bottom:8px;">Team choices are filtered to that season's series. A third driver replacing someone mid-season is just its own entry \u2014 use Notes to say so.</div>
            <div class="vault-history-labels">
              <span>No.</span><span>Year</span><span>Series</span><span>Team</span><span>Final pos.</span><span>Rookie</span><span></span>
            </div>
            <div class="vault-history-sublabels">
              <span>Academy (grid team)</span><span>Custom academy</span><span>Notes</span>
            </div>
            <div class="vault-history" id="historyRows">
              ${driver.history.map(historyCardHtml).join("")}
            </div>
            <button type="button" class="btn-add-row" id="addHistoryRow" style="margin-top:8px;">+ Add season</button>
          </div>
          <div class="vault-field span2">
            <label>Stats by series (junior categories, etc.)</label>
            <div class="vault-hint" style="margin-top:-4px; margin-bottom:8px;">The Wins/Podiums/Poles/Achievements fields above are the driver's headline stats. Use this to break stats down per series \u2014 useful for junior career results.</div>
            <div class="vault-stats-labels">
              <span>Series</span><span>Wins</span><span>Podiums</span><span>Poles</span><span>Achievements</span><span></span>
            </div>
            <div class="vault-stats" id="statsRows">
              ${driver.seriesStats.map(statsRowHtml).join("")}
            </div>
            <button type="button" class="btn-add-row" id="addStatsRow" style="margin-top:8px;">+ Add series stats</button>
          </div>
        </div>
        <div style="margin-top:24px;">
          <button type="submit" class="btn-vault-add">Save driver</button>
        </div>
      </form>
    </div>
  `;

  function updateAgeHint(){
    const bdVal = document.getElementById("birthDateInput").value;
    const byVal = document.getElementById("birthYearInput").value;
    const hint = document.getElementById("ageHint");
    const now = new Date();
    if(bdVal){
      // Parse "YYYY-MM-DD" as a local date rather than via new Date(string), which
      // parses as UTC and can be off by a day depending on the browser's timezone.
      const parts = bdVal.split("-").map(Number);
      if(parts.length===3 && !parts.some(isNaN)){
        const bd = new Date(parts[0], parts[1]-1, parts[2]);
        let age = now.getFullYear() - bd.getFullYear();
        const m = now.getMonth() - bd.getMonth();
        if(m < 0 || (m===0 && now.getDate() < bd.getDate())) age--;
        hint.textContent = `Age: ${age}`;
        return;
      }
    }
    if(byVal){
      hint.textContent = `Age: ~${now.getFullYear() - Number(byVal)} (from birth year only)`;
      return;
    }
    hint.textContent = "";
  }
  document.getElementById("birthDateInput").addEventListener("input", updateAgeHint);
  document.getElementById("birthYearInput").addEventListener("input", updateAgeHint);
  updateAgeHint();

  document.getElementById("cancelDriverBtn").addEventListener("click", ()=>{ location.hash = "drivers"; });
  const delBtn = document.getElementById("deleteDriverBtn");
  if(delBtn) delBtn.addEventListener("click", ()=>{
    if(!confirm(`Delete ${driver.name}? This can't be undone until you Save.`)) return;
    STATE.drivers = STATE.drivers.filter(d=>d.id!==driver.id);
    markDirty();
    location.hash = "drivers";
  });

  function renderHistoryRows(){
    document.getElementById("historyRows").innerHTML = driver.history.map(historyCardHtml).join("");
    wireHistoryCards();
  }
  function wireHistoryCards(){
    document.querySelectorAll("#historyRows .vault-history-entry").forEach(entry=>{
      entry.querySelector("[data-remove]").addEventListener("click", (e)=>{
        driver.history.splice(Number(e.currentTarget.dataset.remove), 1);
        renderHistoryRows();
      });
      const seriesSel = entry.querySelector(".h-series");
      const teamSel = entry.querySelector(".h-team");
      const subrow = entry.querySelector(".vault-history-subrow");
      const academySel = entry.querySelector(".h-academy");
      const academyCustom = entry.querySelector(".h-academy-custom");
      seriesSel.addEventListener("change", ()=>{
        teamSel.innerHTML = teamOptionsForSeries(seriesSel.value, teamSel.value);
        const topSeriesId = STATE.series[0]?.id;
        const isTopSeries = Number(seriesSel.value) === topSeriesId;
        subrow.classList.toggle("no-academy", isTopSeries);
        if(isTopSeries){
          academySel.innerHTML = academySelectOptions(null);
          academyCustom.value = "";
        }
      });
    });
  }
  renderHistoryRows();

  document.getElementById("addHistoryRow").addEventListener("click", ()=>{
    // Careers are usually entered most-recent-first, so each new row counts one year
    // further back than the earliest season already on file.
    const existingYears = driver.history.map(h=>h.year).filter(y=>y!=null && !isNaN(y));
    const year = existingYears.length ? Math.min(...existingYears) - 1 : new Date().getFullYear();
    const seriesId = STATE.series[0]?.id ?? null;
    const teamId = STATE.teams.find(t=>teamSeriesIds(t).includes(seriesId))?.id ?? STATE.teams[0]?.id ?? null;
    driver.history.push({ number:null, year, seriesId, teamId, standing:null, academyTeamId:null, academyCustom:"", notes:"", rookie:false });
    renderHistoryRows();
  });

  function wireRemoveStatsButtons(){
    document.querySelectorAll("[data-remove-stats]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        driver.seriesStats.splice(Number(btn.dataset.removeStats), 1);
        document.getElementById("statsRows").innerHTML = driver.seriesStats.map(statsRowHtml).join("");
        wireRemoveStatsButtons();
      });
    });
  }
  wireRemoveStatsButtons();

  document.getElementById("addStatsRow").addEventListener("click", ()=>{
    driver.seriesStats.push({ seriesId: STATE.series[0]?.id, wins:0, podiums:0, poles:0, achievements:"" });
    document.getElementById("statsRows").innerHTML = driver.seriesStats.map(statsRowHtml).join("");
    wireRemoveStatsButtons();
  });

  document.getElementById("driverForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const updated = {
      ...driver,
      name: fd.get("name").trim(),
      code: fd.get("code").trim().toUpperCase(),
      number: fd.get("number") ? Number(fd.get("number")) : null,
      nationality: fd.get("nationality").trim(),
      birthYear: fd.get("birthYear") ? Number(fd.get("birthYear")) : null,
      birthDate: fd.get("birthDate") || "",
      birthPlace: fd.get("birthPlace").trim(),
      achievements: fd.get("achievements").trim(),
      wins: Number(fd.get("wins")) || 0,
      podiums: Number(fd.get("podiums")) || 0,
      poles: Number(fd.get("poles")) || 0,
      stillActive: fd.get("stillActive") === "on",
      canon: fd.get("canon") === "on",
      bio: fd.get("bio"),
      history: [...document.querySelectorAll("#historyRows .vault-history-entry")].map(entry=>({
        number: entry.querySelector(".h-number").value ? Number(entry.querySelector(".h-number").value) : null,
        year: Number(entry.querySelector(".h-year").value) || null,
        seriesId: Number(entry.querySelector(".h-series").value),
        teamId: Number(entry.querySelector(".h-team").value),
        standing: entry.querySelector(".h-standing").value ? Number(entry.querySelector(".h-standing").value) : null,
        academyTeamId: entry.querySelector(".h-academy").value ? Number(entry.querySelector(".h-academy").value) : null,
        academyCustom: entry.querySelector(".h-academy-custom").value.trim(),
        notes: entry.querySelector(".h-notes").value.trim(),
        rookie: entry.querySelector(".h-rookie").checked
      })).filter(h=>h.year),
      seriesStats: [...document.querySelectorAll("#statsRows .vault-stats-row")].map(row=>({
        seriesId: Number(row.querySelector(".st-series").value),
        wins: Number(row.querySelector(".st-wins").value) || 0,
        podiums: Number(row.querySelector(".st-podiums").value) || 0,
        poles: Number(row.querySelector(".st-poles").value) || 0,
        achievements: row.querySelector(".st-achievements").value.trim()
      }))
    };
    updated.number = latestNumber(updated.history);
    if(isNew){ STATE.drivers.push(updated); } else {
      const idx = STATE.drivers.findIndex(d=>d.id===driver.id);
      STATE.drivers[idx] = updated;
    }
    markDirty();
    location.hash = "drivers";
  });
}

/* ---------- TEAMS: list ---------- */
function renderTeamsList(){
  const body = document.getElementById("vaultTabBody");
  body.innerHTML = `
    <div class="vault-toolbar">
      <input type="search" id="teamSearch" placeholder="Search teams\u2026">
      <select id="teamSeriesFilter"><option value="">All series</option>
        ${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}
      </select>
      <div class="spacer"></div>
      <button class="btn-vault-add" id="addTeamBtn">+ New team</button>
    </div>
    <div class="vault-list" id="teamsListBody"></div>
  `;
  document.getElementById("addTeamBtn").addEventListener("click", ()=>{ location.hash = "team-new"; });
  const search = document.getElementById("teamSearch");
  const seriesFilter = document.getElementById("teamSeriesFilter");
  const draw = ()=>{
    const q = search.value.trim().toLowerCase();
    const sid = seriesFilter.value ? Number(seriesFilter.value) : null;
    let list = STATE.teams.filter(t=>(!q || t.name.toLowerCase().includes(q)) && (!sid || teamSeriesIds(t).includes(sid)))
      .sort((a,b)=>a.name.localeCompare(b.name));
    const wrap = document.getElementById("teamsListBody");
    if(!list.length){ wrap.innerHTML = `<div class="vault-empty">No teams match.</div>`; return; }
    wrap.innerHTML = list.map(t=>{
      const seriesNames = teamSeriesIds(t).map(currentSeriesName).join(", ") || "Unassigned";
      return `<div class="vault-row" data-id="${t.id}">
        <span class="swatch" style="background:${esc(t.color||'#666')}"></span>
        <span class="rname">${esc(t.name)}</span>
        <span class="rmeta">${esc(seriesNames)}${t.resultsName ? ' \u00b7 ' + esc(t.resultsName) : ''}</span>
        <span class="badge ${t.canon?'badge-canon':'badge-noncanon'}">${t.canon?'canon':'background'}</span>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".vault-row").forEach(row=>{
      row.addEventListener("click", ()=>{ location.hash = "team-" + row.dataset.id; });
    });
  };
  search.addEventListener("input", draw);
  seriesFilter.addEventListener("change", draw);
  draw();
}

/* ---------- TEAMS: form ---------- */
function renderTeamForm(idParam){
  const isNew = idParam === "new";
  const team = isNew ? {
    id: nextId(STATE.teams), seriesIds: [STATE.series[0]?.id].filter(x=>x!=null), name:"", fullName:"", resultsName:"", color:"#888888",
    base:"", principal:"", chassis:"", powerUnit:"", firstEntry:null, lastEntry:null,
    owner:"", wdc:0, wcc:0, canon:false, description:"", juniorTeam:""
  } : STATE.teams.find(t=>t.id===Number(idParam));

  if(!team){ location.hash = "teams"; return; }
  const body = document.getElementById("vaultTabBody");
  body.innerHTML = `
    <div class="vault-detail">
      <div class="vault-detail-head">
        <h2>${isNew ? "New team" : esc(team.name || "Untitled")}</h2>
        <div class="vault-detail-actions">
          ${!isNew ? `<button class="btn-vault-secondary btn-vault-danger" id="deleteTeamBtn">Delete</button>` : ""}
          <button class="btn-vault-secondary" id="cancelTeamBtn">Back</button>
        </div>
      </div>
      <form id="teamForm">
        <div class="vault-grid-form">
          <div class="vault-field"><label>Name</label><input type="text" name="name" value="${esc(team.name)}" required></div>
          <div class="vault-field"><label>Full name</label><input type="text" name="fullName" value="${esc(team.fullName)}"></div>
          <div class="vault-field span2">
            <label>Series</label>
            <div class="vault-checkbox-group">
              ${STATE.series.map(s=>`<label class="vault-checkbox"><input type="checkbox" class="team-series-cb" value="${s.id}" ${teamSeriesIds(team).includes(s.id)?'checked':''}> ${esc(s.name)}</label>`).join("")}
            </div>
            <div class="vault-hint">Junior/feeder teams are often the same outfit across multiple series \u2014 check all that apply.</div>
          </div>
          <div class="vault-field"><label>Color</label><input type="color" name="color" value="${team.color||'#888888'}"></div>
          <div class="vault-field">
            <label>Manufacturer name (ResultsName)</label>
            <input type="text" name="resultsName" value="${esc(team.resultsName||'')}" placeholder="e.g. Kinghorn Osella">
            <div class="vault-hint">Formula One only \u2014 short team name + engine manufacturer, as it'd appear in a results table. Leave blank if this team isn't in F1.</div>
          </div>
          <div class="vault-field"><label>Base</label><input type="text" name="base" value="${esc(team.base)}"></div>
          <div class="vault-field"><label>Principal</label><input type="text" name="principal" value="${esc(team.principal)}"></div>
          <div class="vault-field"><label>Owner</label><input type="text" name="owner" value="${esc(team.owner)}"></div>
          <div class="vault-field"><label>Chassis</label><input type="text" name="chassis" value="${esc(team.chassis)}"></div>
          <div class="vault-field"><label>Power unit</label><input type="text" name="powerUnit" value="${esc(team.powerUnit)}"></div>
          <div class="vault-field"><label>First entry (year)</label><input type="number" name="firstEntry" value="${team.firstEntry ?? ''}"></div>
          <div class="vault-field"><label>Last entry (blank = still active)</label><input type="number" name="lastEntry" value="${team.lastEntry ?? ''}"></div>
          <div class="vault-field"><label>WDC titles</label><input type="number" name="wdc" value="${team.wdc ?? 0}"></div>
          <div class="vault-field"><label>WCC titles</label><input type="number" name="wcc" value="${team.wcc ?? 0}"></div>
          <div class="vault-field span2">
            <label>Junior team / academy name</label>
            <input type="text" name="juniorTeam" value="${esc(team.juniorTeam||'')}" placeholder="e.g. Red Bull Junior Team">
            <div class="vault-hint">Only meaningful for top-tier (e.g. Formula One) teams. Fill this in and this team becomes selectable as a junior/academy affiliation on drivers elsewhere \u2014 leave it blank and it won't show up as an option.</div>
          </div>
          <div class="vault-field span2">
            <label>Canon status</label>
            <div class="vault-checkbox"><input type="checkbox" name="canon" ${team.canon?'checked':''}> Made it into the public site (canon)</div>
          </div>
          <div class="vault-field span2"><label>Description / notes</label><textarea name="description">${esc(team.description)}</textarea></div>
        </div>
        <div style="margin-top:24px;">
          <button type="submit" class="btn-vault-add">Save team</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById("cancelTeamBtn").addEventListener("click", ()=>{ location.hash = "teams"; });
  const delBtn = document.getElementById("deleteTeamBtn");
  if(delBtn) delBtn.addEventListener("click", ()=>{
    if(!confirm(`Delete ${team.name}? This can't be undone until you Save.`)) return;
    STATE.teams = STATE.teams.filter(t=>t.id!==team.id);
    markDirty();
    location.hash = "teams";
  });
  document.getElementById("teamForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const seriesIds = [...document.querySelectorAll(".team-series-cb:checked")].map(cb=>Number(cb.value));
    if(!seriesIds.length){ alert("Select at least one series for this team."); return; }
    const updated = {
      ...team,
      name: fd.get("name").trim(),
      fullName: fd.get("fullName").trim(),
      resultsName: fd.get("resultsName").trim(),
      seriesIds,
      color: fd.get("color"),
      base: fd.get("base").trim(),
      principal: fd.get("principal").trim(),
      owner: fd.get("owner").trim(),
      chassis: fd.get("chassis").trim(),
      powerUnit: fd.get("powerUnit").trim(),
      firstEntry: fd.get("firstEntry") ? Number(fd.get("firstEntry")) : null,
      lastEntry: fd.get("lastEntry") ? Number(fd.get("lastEntry")) : null,
      wdc: Number(fd.get("wdc")) || 0,
      wcc: Number(fd.get("wcc")) || 0,
      juniorTeam: fd.get("juniorTeam").trim(),
      canon: fd.get("canon") === "on",
      description: fd.get("description")
    };
    delete updated.seriesId;
    if(isNew){ STATE.teams.push(updated); } else {
      const idx = STATE.teams.findIndex(t=>t.id===team.id);
      STATE.teams[idx] = updated;
    }
    markDirty();
    location.hash = "teams";
  });
}

/* ---------- SERIES tab ---------- */
function renderSeriesTab(){
  const body = document.getElementById("vaultTabBody");
  const rowHtml = (s) => `
    <div class="vault-series-row" data-id="${s.id}">
      <input type="text" class="s-name" value="${esc(s.name)}">
      <input type="text" class="s-short" value="${esc(s.shortName)}" maxlength="4">
      <input type="color" class="s-color" value="${s.color||'#888888'}">
      <button type="button" class="btn-remove-row" data-remove-series="${s.id}">&times;</button>
    </div>`;
  body.innerHTML = `
    <div class="vault-detail">
      <div class="vault-detail-head"><h2>Series</h2></div>
      <p style="color:var(--gray-light); font-size:14px; margin-bottom:16px;">Your four series. Renaming here updates how they're labeled everywhere \u2014 it won't reassign any driver/team data.</p>
      <div class="vault-series-list" id="seriesRows">${STATE.series.map(rowHtml).join("")}</div>
      <button type="button" class="btn-add-row" id="addSeriesBtn" style="margin-top:14px;">+ Add series</button>
      <div style="margin-top:24px;"><button class="btn-vault-add" id="saveSeriesBtn">Save series</button></div>
    </div>
  `;
  function wireRemove(){
    document.querySelectorAll("[data-remove-series]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = Number(btn.dataset.removeSeries);
        const inUse = STATE.teams.some(t=>t.seriesId===id) || STATE.drivers.some(d=>(d.history||[]).some(h=>h.seriesId===id));
        if(inUse && !confirm("Teams or driver history reference this series. Remove anyway?")) return;
        STATE.series = STATE.series.filter(s=>s.id!==id);
        markDirty();
        renderSeriesTab();
      });
    });
  }
  wireRemove();
  document.getElementById("addSeriesBtn").addEventListener("click", ()=>{
    STATE.series.push({ id: nextId(STATE.series), name:"New Series", shortName:"NEW", color:"#888888" });
    markDirty();
    renderSeriesTab();
  });
  document.getElementById("saveSeriesBtn").addEventListener("click", ()=>{
    document.querySelectorAll("#seriesRows .vault-series-row").forEach(row=>{
      const id = Number(row.dataset.id);
      const s = STATE.series.find(s=>s.id===id);
      if(!s) return;
      s.name = row.querySelector(".s-name").value.trim();
      s.shortName = row.querySelector(".s-short").value.trim();
      s.color = row.querySelector(".s-color").value;
    });
    markDirty();
    setStatus("dirty", "Unsaved changes \u2014 click header Save to sync");
  });
}

/* ---------- GRID tab ---------- */
function renderGridTab(){
  const body = document.getElementById("vaultTabBody");
  const years = [...new Set(STATE.drivers.flatMap(d=>(d.history||[]).map(h=>h.year)))].sort((a,b)=>a-b);
  const defaultSeries = STATE.series[0]?.id;
  const defaultYear = years[years.length-1] || new Date().getFullYear();

  body.innerHTML = `
    <div class="vault-grid-controls">
      <select id="gridSeries">${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      <select id="gridYear">${years.length ? years.map(y=>`<option value="${y}">${y}</option>`).join("") : `<option value="${defaultYear}">${defaultYear}</option>`}</select>
      <label class="vault-checkbox"><input type="checkbox" id="gridShowNoncanon" checked> Include background (non-canon)</label>
    </div>
    <div class="grid-board" id="gridBoard"></div>
  `;
  const seriesSel = document.getElementById("gridSeries");
  const yearSel = document.getElementById("gridYear");
  seriesSel.value = defaultSeries;
  yearSel.value = defaultYear;

  function draw(){
    const seriesId = Number(seriesSel.value);
    const year = Number(yearSel.value);
    const showNoncanon = document.getElementById("gridShowNoncanon").checked;
    const teamsInSeries = STATE.teams.filter(t=>teamSeriesIds(t).includes(seriesId));
    const board = document.getElementById("gridBoard");
    const isTopSeries = seriesId === STATE.series[0]?.id;

    if(!teamsInSeries.length){
      board.innerHTML = `<div class="vault-empty">No teams in this series yet.</div>`;
      return;
    }

    // Teams with no drivers on record for this season/series are left off the
    // grid entirely (rather than showing as an empty slot) \u2014 this also
    // naturally hides teams that aren't active yet or aren't active anymore.
    const cards = teamsInSeries.map(team=>{
      const lineupDrivers = STATE.drivers.filter(d=>
        (d.history||[]).some(h=>h.year===year && h.seriesId===seriesId && h.teamId===team.id)
        && (showNoncanon || d.canon)
      );
      if(!lineupDrivers.length) return null;
      const lineup = lineupDrivers.map(d=>{
        const h = d.history.find(h=>h.year===year && h.seriesId===seriesId && h.teamId===team.id);
        const academyTeam = h.academyTeamId ? STATE.teams.find(t=>t.id===h.academyTeamId) : null;
        const academyLabel = academyTeam ? (academyTeam.juniorTeam || academyTeam.name) : (h.academyCustom || null);
        const academyColor = academyTeam ? (academyTeam.color || '#666') : '#666';
        return `<div class="grid-driver ${d.canon?'':'grid-noncanon'}">
          <div class="grid-driver-main">
            ${h.number ? `<span class="rookie-tag" style="color:var(--gray-light); border-color:var(--line);">#${esc(h.number)}</span>` : ""}
            ${esc(d.name)} ${h.rookie ? `<span class="rookie-tag">ROOKIE</span>` : ""}
          </div>
          ${academyLabel ? `<div class="academy-tag" style="border-color:${esc(academyColor)}; color:${esc(academyColor)}">Academy: ${esc(academyLabel)}</div>` : ""}
          ${h.notes ? `<div class="grid-driver-notes">${esc(h.notes)}</div>` : ""}
        </div>`;
      }).join("");
      return `<div class="grid-team" style="border-left-color:${esc(team.color||'#666')}">
        <div class="tname">${esc(team.name)}</div>
        ${(isTopSeries && team.resultsName) ? `<div class="tmanufacturer">${esc(team.resultsName)}</div>` : ""}
        <div class="tdrivers">${lineup}</div>
      </div>`;
    }).filter(Boolean);

    board.innerHTML = cards.length ? cards.join("") : `<div class="vault-empty">No teams with drivers on record for this season.</div>`;
  }
  seriesSel.addEventListener("change", draw);
  yearSel.addEventListener("change", draw);
  document.getElementById("gridShowNoncanon").addEventListener("change", draw);
  draw();
}

/* ---------- settings panel (reachable any time via the header gear) ---------- */
function renderSettingsPanel(){
  const cfg = getConfig() || {};
  const app = document.getElementById("vaultApp");
  app.innerHTML = `
    <div class="vault-setup">
      <h1>Connection settings</h1>
      <p>Update your token if it's expired or been rotated. Your Gist ID stays the same \u2014 this only changes how the Vault authenticates.</p>
      <div class="vault-field">
        <label>New personal access token (gist scope)</label>
        <input type="password" id="settingsToken" placeholder="ghp_\u2026" autocomplete="off">
      </div>
      <div class="vault-field">
        <label>Gist ID</label>
        <input type="text" id="settingsGistId" value="${esc(cfg.gistId || '')}" placeholder="e.g. 8f3a1c9b2e...">
      </div>
      <div id="settingsError" class="vault-error"></div>
      <button class="btn-vault-add" id="settingsSubmit" style="width:100%; padding:12px; margin-bottom:10px;">Update & reconnect</button>
      <button class="btn-vault-secondary" id="settingsCancel" style="width:100%; padding:12px; margin-bottom:10px;">Cancel</button>
      <button class="btn-vault-secondary btn-vault-danger" id="settingsSignOut" style="width:100%; padding:12px;">Sign out (clear saved token)</button>
    </div>
  `;
  document.getElementById("settingsCancel").addEventListener("click", ()=>{ renderApp(); });
  document.getElementById("settingsSignOut").addEventListener("click", ()=>{
    if(DIRTY && !confirm("You have unsaved changes that will be lost. Sign out anyway?")) return;
    clearConfig();
    location.reload();
  });
  document.getElementById("settingsSubmit").addEventListener("click", async ()=>{
    const token = document.getElementById("settingsToken").value.trim();
    const gistId = document.getElementById("settingsGistId").value.trim();
    if(!token){ document.getElementById("settingsError").textContent = "Enter a token to reconnect."; return; }
    setConfig({ token, gistId: gistId || null });
    if(DIRTY){
      // keep in-memory edits, just retry saving with the new token
      await saveToGist();
      if(!DIRTY) renderApp();
    } else {
      await boot();
    }
  });
}

/* ---------- init ---------- */
document.getElementById("vaultSaveBtn").addEventListener("click", saveToGist);
document.getElementById("vaultSettingsBtn").addEventListener("click", renderSettingsPanel);
window.addEventListener("beforeunload", (e)=>{ if(DIRTY){ e.preventDefault(); e.returnValue=""; } });
boot();