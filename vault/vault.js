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

// List filter state \u2014 kept at module level (not reset on re-render) so that
// navigating away to a detail view and back preserves whatever the user had set.
let driverFilters = { q: "", seriesId: "", year: "" };
let teamFilters = { q: "", seriesId: "" };

/* ---------- helpers ---------- */
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function nextId(arr){ return arr.length ? Math.max(...arr.map(x=>x.id)) + 1 : 1; }
// Formats a "YYYY-MM-DD" <input type="date"> value for display. Parsed as a
// local date (not via `new Date(string)`, which reads it as UTC and can land
// on the wrong day depending on the browser's timezone).
function formatRaceDate(s){
  if(!s) return "";
  const parts = String(s).split("-").map(Number);
  if(parts.length !== 3 || parts.some(isNaN)) return s;
  const dt = new Date(parts[0], parts[1]-1, parts[2]);
  return dt.toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" });
}
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
  if(!data.races) data.races = [];
  data.races = data.races.map(r=>{
    if(r.qualifying === undefined) r.qualifying = [];
    if(r.results === undefined) r.results = [];
    if(r.raceLog === undefined) r.raceLog = [];
    if(r.kind === undefined) r.kind = "race";
    if(r.circuit === undefined) r.circuit = "";
    if(r.laps === undefined) r.laps = null;
    if(r.conditions === undefined) r.conditions = "";
    if(r.date === undefined) r.date = "";
    // Backfill points/DNF on any race saved before auto-scoring existed \u2014
    // dnf defaults from the existing notes text, points are then derived.
    r.results.forEach(res=>{
      if(res.dnf === undefined) res.dnf = looksLikeDnf(res.position, res.notes);
    });
    recomputeRacePoints(r);
    return r;
  });
  return data;
}

/* ---------- RACES: name matching helpers ----------
   Used both when scanning a markdown race file (auto-matching parsed
   driver/team names against the roster) and when hand-editing a race's
   rows (the driver/team fields are free text with an autocomplete list,
   re-matched on save) \u2014 so a name that doesn't match anything is never
   a dead end, it's just kept as plain text. */
function matchDriverByName(name){
  const n = String(name||"").trim().toLowerCase();
  if(!n) return null;
  return STATE.drivers.find(d=>d.name.trim().toLowerCase()===n) || null;
}
function matchTeamByName(name, seriesId){
  const n = String(name||"").trim().toLowerCase();
  if(!n) return null;
  const candidates = STATE.teams.filter(t=>teamSeriesIds(t).includes(seriesId));
  const exact = candidates.find(t=>[t.name,t.fullName,t.resultsName].some(v=>String(v||"").trim().toLowerCase()===n));
  if(exact) return exact;
  let partial = candidates.filter(t=>{
    const tn = t.name.trim().toLowerCase();
    const fn = String(t.fullName||"").trim().toLowerCase();
    return (tn && (n.includes(tn) || tn.includes(n))) || (fn && (n.includes(fn) || fn.includes(n)));
  });
  if(partial.length > 1){
    // Same name reused by a historical entry (e.g. "Atlas" then vs. now) \u2014
    // prefer whichever candidate is still active.
    const active = partial.filter(t=>t.lastEntry == null);
    if(active.length === 1) partial = active;
  }
  return partial.length === 1 ? partial[0] : null;
}

/* ---------- RACES: points ----------
   Standard scoring: race top 10 get 25-18-15-12-10-8-6-4-2-1, sprints pay out
   top 8 at 8-7-6-5-4-3-2-1. A DNF (or an unparseable/blank position) always
   scores zero, regardless of what the position column claims. */
const RACE_POINTS = {1:25,2:18,3:15,4:12,5:10,6:8,7:6,8:4,9:2,10:1};
const SPRINT_POINTS = {1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1};
function pointsForResult(kind, position, dnf){
  if(dnf) return 0;
  const pos = parseInt(String(position ?? "").trim(), 10);
  if(!Number.isFinite(pos)) return 0;
  const table = kind === "sprint" ? SPRINT_POINTS : RACE_POINTS;
  return table[pos] || 0;
}
// Heuristic used only when importing/scanning a race file, where retirements
// are often signalled through the position or notes column rather than a
// dedicated field \u2014 a plain numeric position with no such marker is assumed
// classified/finished.
function looksLikeDnf(position, notes){
  const posText = String(position ?? "").trim();
  if(posText && !/^\d+$/.test(posText)) return true; // e.g. "DNF", "DNS", "DSQ", "Ret"
  return /\b(dnf|dns|dsq|ret(?:ired)?)\b/i.test(String(notes || ""));
}
// Recomputes every result row's points in place from its position/dnf/kind \u2014
// call this any time a race's results are saved so the stored points never
// drift out of sync with a hand-edited position or DNF flag.
function recomputeRacePoints(race){
  (race.results || []).forEach(r=>{
    r.points = pointsForResult(race.kind, r.position, !!r.dnf);
  });
}
// Career/season race record for one driver, aggregated straight from
// STATE.races \u2014 nothing here is stored on the driver record itself, so it's
// always in sync with whatever's on the Races tab. Wins/podiums/poles follow
// real-F1 convention (race sessions only); points combine race + sprint,
// since sprint points count toward the championship.
function computeDriverRaceRecord(driverId){
  const rec = {
    race: { starts:0, wins:0, podiums:0, poles:0, dnfs:0, points:0 },
    sprint: { starts:0, wins:0, podiums:0, dnfs:0, points:0 }
  };
  (STATE.races || []).forEach(race=>{
    const bucket = race.kind === "sprint" ? rec.sprint : rec.race;
    const result = (race.results || []).find(r=>r.driverId === driverId);
    if(result){
      bucket.starts++;
      bucket.points += result.points || 0;
      if(result.dnf){ bucket.dnfs++; }
      else {
        const pos = parseInt(String(result.position || "").trim(), 10);
        if(pos === 1) bucket.wins++;
        if(pos >= 1 && pos <= 3) bucket.podiums++;
      }
    }
    if(race.kind !== "sprint"){
      const pole = (race.qualifying || []).find(q=>String(q.position||"").trim()==="1" && q.driverId===driverId);
      if(pole) rec.race.poles++;
    }
  });
  rec.totalPoints = rec.race.points + rec.sprint.points;
  return rec;
}
// Sum of a driver's race+sprint points for one season/series \u2014 used on the
// Season Results board.
function seasonPointsForDriver(driverId, seriesId, year){
  return (STATE.races || [])
    .filter(r=>r.seriesId===seriesId && r.year===year)
    .reduce((sum, r)=>{
      const result = (r.results || []).find(x=>x.driverId === driverId);
      return sum + (result ? (result.points || 0) : 0);
    }, 0);
}

/* ---------- RACES: markdown parser ----------
   Parses the "# Title / *circuit \u2014 laps \u2014 conditions* / ## Qualifying
   Result / ## ... Race Result / ## Race Log" format into a plain structure.
   Sprint files use the identical layout \u2014 the scan form is what decides
   whether the imported session is tagged "race" or "sprint". */
function parseRaceMarkdown(text){
  const lines = String(text||"").replace(/\r\n/g,"\n").split("\n");
  let title = "", circuit = "", laps = null, conditions = "";
  let i = 0;
  while(i < lines.length && !lines[i].trim().startsWith("# ")) i++;
  if(i < lines.length){ title = lines[i].trim().replace(/^#\s+/, "").trim(); i++; }
  while(i < lines.length && lines[i].trim() === "") i++;
  if(i < lines.length && /^\*.*\*$/.test(lines[i].trim())){
    const sub = lines[i].trim().replace(/^\*/, "").replace(/\*$/, "");
    const parts = sub.split(/\s*[\u2014\u2013]\s*|\s+--\s+/).map(s=>s.trim()).filter(Boolean);
    const lapsPart = parts.find(p=>/\d+\s*laps/i.test(p));
    if(lapsPart){ const m = lapsPart.match(/(\d+)/); if(m) laps = Number(m[1]); }
    if(parts[0] && parts[0] !== lapsPart) circuit = parts[0];
    const condPart = parts.find(p=>p !== lapsPart && p !== circuit);
    if(condPart) conditions = condPart;
  }

  const headings = [];
  lines.forEach((line, li)=>{
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if(m) headings.push({ level: m[1].length, text: m[2].trim(), line: li });
  });
  function sectionLines(idx){
    const start = headings[idx].line + 1;
    const end = idx + 1 < headings.length ? headings[idx+1].line : lines.length;
    return lines.slice(start, end);
  }
  function parseTable(blockLines){
    const rows = blockLines.filter(l=>l.trim().startsWith("|"));
    if(rows.length < 2) return [];
    const cellsOf = (line)=> line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c=>c.trim());
    const header = cellsOf(rows[0]).map(h=>h.toLowerCase());
    return rows.slice(2).map(r=>{
      const cells = cellsOf(r);
      const obj = {};
      header.forEach((h, idx)=>{ obj[h] = cells[idx] !== undefined ? cells[idx] : ""; });
      return obj;
    });
  }
  function parseBullets(blockLines){
    return blockLines.filter(l=>l.trim().startsWith("- ")).map(l=>l.trim().replace(/^-\s+/, ""));
  }

  let qualifying = [], results = [], raceLog = [];
  headings.forEach((h, idx)=>{
    const lower = h.text.toLowerCase();
    if(lower.includes("qualifying")) qualifying = parseTable(sectionLines(idx));
    else if(lower.includes("race result")) results = parseTable(sectionLines(idx));
    else if(lower.includes("race log")) raceLog = parseBullets(sectionLines(idx));
  });

  return { title, circuit, laps, conditions, qualifying, results, raceLog };
}
function latestNumber(history){
  const withNum = (history||[]).filter(h=>h.number !== null && h.number !== undefined && h.number !== "").sort((a,b)=>b.year-a.year);
  return withNum.length ? withNum[0].number : null;
}
// Series a driver is currently in, i.e. from their most recent season on file only
// (as opposed to every series they've ever raced in across their whole history).
function currentSeriesIds(history){
  const hist = (history||[]).filter(h=>h.year != null && !isNaN(h.year));
  if(!hist.length) return [];
  const maxYear = Math.max(...hist.map(h=>h.year));
  return [...new Set(hist.filter(h=>h.year===maxYear).map(h=>h.seriesId))];
}
// Approximate age during a given season, from birthDate if present, else birthYear.
function ageInYear(driver, year){
  if(!year) return null;
  let by = driver.birthYear;
  if(!by && driver.birthDate){ by = Number(driver.birthDate.split("-")[0]) || null; }
  if(!by) return null;
  return year - by;
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
      <button class="vault-tab ${tab==='results'?'active':''}" data-tab="results">Season Results</button>
      <button class="vault-tab ${tab==='races'?'active':''}" data-tab="races">Races</button>
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
  else if(hash==="results") renderResultsTab();
  else if(hash==="races") renderRacesTab();
  else if(hash==="races-scan") renderRaceScanForm();
  else if(hash.startsWith("raceweekend-")){
    const parts = hash.split("-");
    renderRaceWeekendForm(Number(parts[1]), Number(parts[2]), Number(parts[3]));
  }
  else renderDriversList();

  document.getElementById("vaultSaveBtn").hidden = !DIRTY;
}

window.addEventListener("hashchange", renderApp);

/* ---------- DRIVERS: list ---------- */
function renderDriversList(){
  const body = document.getElementById("vaultTabBody");
  const years = [...new Set(STATE.drivers.flatMap(d=>(d.history||[]).map(h=>h.year)))]
    .filter(y=>y!=null && !isNaN(y)).sort((a,b)=>b-a);
  body.innerHTML = `
    <div class="vault-toolbar">
      <input type="search" id="driverSearch" placeholder="Search drivers\u2026">
      <select id="driverYearFilter"><option value="">All years</option>
        ${years.map(y=>`<option value="${y}">${y}</option>`).join("")}
      </select>
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
  const yearFilter = document.getElementById("driverYearFilter");
  // Restore whatever was previously selected.
  search.value = driverFilters.q;
  seriesFilter.value = driverFilters.seriesId;
  yearFilter.value = driverFilters.year;
  const draw = ()=>{
    driverFilters = { q: search.value, seriesId: seriesFilter.value, year: yearFilter.value };
    const q = driverFilters.q.trim().toLowerCase();
    const sid = driverFilters.seriesId ? Number(driverFilters.seriesId) : null;
    const yr = driverFilters.year ? Number(driverFilters.year) : null;
    let list = STATE.drivers.filter(d=>{
      const matchesQ = !q || d.name.toLowerCase().includes(q);
      let matchesFilter;
      if(sid && yr) matchesFilter = (d.history||[]).some(h=>h.year===yr && h.seriesId===sid);
      else if(sid) matchesFilter = (d.history||[]).some(h=>h.seriesId===sid);
      else if(yr) matchesFilter = (d.history||[]).some(h=>h.year===yr);
      else matchesFilter = true;
      return matchesQ && matchesFilter;
    }).sort((a,b)=>a.name.localeCompare(b.name));
    const wrap = document.getElementById("driversListBody");
    if(!list.length){ wrap.innerHTML = `<div class="vault-empty">No drivers match.</div>`; return; }
    wrap.innerHTML = list.map(d=>{
      const num = latestNumber(d.history);
      const metaParts = [];
      if(sid && yr){
        // A specific season + series is selected \u2014 show that season's team,
        // the driver's age that year, and their academy seat if they had one.
        const entry = (d.history||[]).find(h=>h.year===yr && h.seriesId===sid);
        const team = entry ? STATE.teams.find(t=>t.id===entry.teamId) : null;
        const academyTeam = entry && entry.academyTeamId ? STATE.teams.find(t=>t.id===entry.academyTeamId) : null;
        const academyLabel = academyTeam ? (academyTeam.juniorTeam || academyTeam.name) : (entry && entry.academyCustom ? entry.academyCustom : null);
        const age = ageInYear(d, yr);
        if(team) metaParts.push(team.name);
        if(age != null) metaParts.push(`Age ${age}`);
        if(academyLabel) metaParts.push(`Academy: ${academyLabel}`);
      } else {
        // Current series only \u2014 i.e. from the driver's most recent season on file,
        // not every series they've ever raced in.
        const seriesIds = currentSeriesIds(d.history);
        metaParts.push(seriesIds.map(currentSeriesName).join(", ") || "Unassigned");
      }
      if(d.nationality) metaParts.push(d.nationality);
      const metaText = metaParts.join(" \u00b7 ");
      return `<div class="vault-row" data-id="${d.id}">
        <span class="rnumber">${num ? '#'+esc(num) : ''}</span>
        <span class="rname">${esc(d.name)}</span>
        <span class="rmeta">${esc(metaText)}</span>
        <span class="badge ${d.canon?'badge-canon':'badge-noncanon'}">${d.canon?'canon':'background'}</span>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".vault-row").forEach(row=>{
      row.addEventListener("click", ()=>{ location.hash = "driver-" + row.dataset.id; });
    });
  };
  search.addEventListener("input", draw);
  seriesFilter.addEventListener("change", draw);
  yearFilter.addEventListener("change", draw);
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
          ${!isNew ? `
          <div class="vault-field span2">
            <label>Race record</label>
            <div class="vault-hint" style="margin-top:-4px; margin-bottom:8px;">Computed live from the Races tab \u2014 not editable here.</div>
            <div class="vault-race-record" id="autoRaceRecord"></div>
          </div>` : ""}
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

  if(!isNew){
    const rec = computeDriverRaceRecord(driver.id);
    const recRow = (label, r, showPoles) => `<div class="race-record-row">
      <span class="rr-label">${esc(label)}</span>
      <span>${r.starts}</span>
      <span>${r.wins}</span>
      <span>${r.podiums}</span>
      <span>${showPoles ? r.poles : "\u2014"}</span>
      <span>${r.dnfs}</span>
      <span>${r.points}</span>
    </div>`;
    document.getElementById("autoRaceRecord").innerHTML = `
      <div class="race-record-row head"><span></span><span>Starts</span><span>Wins</span><span>Podiums</span><span>Poles</span><span>DNFs</span><span>Points</span></div>
      ${recRow("Race", rec.race, true)}
      ${recRow("Sprint", rec.sprint, false)}
      <div class="race-record-total">Career championship points (race + sprint): <strong>${rec.totalPoints}</strong></div>
    `;
  }

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
  // Restore whatever was previously selected.
  search.value = teamFilters.q;
  seriesFilter.value = teamFilters.seriesId;
  const draw = ()=>{
    teamFilters = { q: search.value, seriesId: seriesFilter.value };
    const q = teamFilters.q.trim().toLowerCase();
    const sid = teamFilters.seriesId ? Number(teamFilters.seriesId) : null;
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
      <select id="gridYear">${years.length ? years.map(y=>`<option value="${y}">${y}</option>`).join("") : `<option value="${defaultYear}">${defaultYear}</option>`}</select>
      <select id="gridSeries">${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
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
        return `<div class="grid-driver ${d.canon?'':'grid-noncanon'}" data-driver-id="${d.id}" style="cursor:pointer;">
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
    board.querySelectorAll("[data-driver-id]").forEach(el=>{
      el.addEventListener("click", ()=>{ location.hash = "driver-" + el.dataset.driverId; });
    });
  }
  seriesSel.addEventListener("change", draw);
  yearSel.addEventListener("change", draw);
  document.getElementById("gridShowNoncanon").addEventListener("change", draw);
  draw();
}

/* ---------- SEASON RESULTS tab ----------
   A flat, ranked results table for one series/season: every driver's entry for
   that season, ordered by their final standing. Entries without a standing sort
   alphabetically after everyone who has one \u2014 so if nobody has a standing on
   record, the whole list is just alphabetical, and if only some drivers do,
   those are ranked first with the rest tacked on alphabetically below. */
function renderResultsTab(){
  const body = document.getElementById("vaultTabBody");
  const years = [...new Set(STATE.drivers.flatMap(d=>(d.history||[]).map(h=>h.year)))]
    .filter(y=>y!=null && !isNaN(y)).sort((a,b)=>a-b);
  const defaultSeries = STATE.series[0]?.id;
  const defaultYear = years[years.length-1] || new Date().getFullYear();

  body.innerHTML = `
    <div class="vault-grid-controls">
      <select id="resultsYear">${years.length ? years.map(y=>`<option value="${y}">${y}</option>`).join("") : `<option value="${defaultYear}">${defaultYear}</option>`}</select>
      <select id="resultsSeries">${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      <label class="vault-checkbox"><input type="checkbox" id="resultsShowNoncanon" checked> Include background (non-canon)</label>
    </div>
    <div class="vault-list" id="resultsBoard"></div>
  `;
  const yearSel = document.getElementById("resultsYear");
  const seriesSel = document.getElementById("resultsSeries");
  yearSel.value = defaultYear;
  seriesSel.value = defaultSeries;

  function draw(){
    const seriesId = Number(seriesSel.value);
    const year = Number(yearSel.value);
    const showNoncanon = document.getElementById("resultsShowNoncanon").checked;
    const board = document.getElementById("resultsBoard");

    const rows = [];
    STATE.drivers.forEach(d=>{
      if(!showNoncanon && !d.canon) return;
      (d.history||[]).forEach(h=>{
        if(h.year===year && h.seriesId===seriesId) rows.push({ driver:d, entry:h, points: seasonPointsForDriver(d.id, seriesId, year) });
      });
    });

    if(!rows.length){ board.innerHTML = `<div class="vault-empty">No results on record for this season.</div>`; return; }

    rows.sort((a,b)=>{
      // Points lead the sort, like a normal results table \u2014 a manually-set
      // final standing only breaks a tie (e.g. equal points, or neither driver
      // has any race data on file yet), and alphabetical is the last resort.
      if(b.points !== a.points) return b.points - a.points;
      const ap = a.entry.standing, bp = b.entry.standing;
      if(ap!=null && bp!=null) return ap - bp || a.driver.name.localeCompare(b.driver.name);
      if(ap!=null) return -1;
      if(bp!=null) return 1;
      return a.driver.name.localeCompare(b.driver.name);
    });

    board.innerHTML = rows.map(r=>{
      const team = STATE.teams.find(t=>t.id===r.entry.teamId);
      const pos = r.entry.standing != null && r.entry.standing !== "" ? r.entry.standing : "\u2014";
      return `<div class="vault-row" data-id="${r.driver.id}">
        <span class="rnumber">${esc(pos)}</span>
        <span class="rname">${esc(r.driver.name)}</span>
        <span class="rmeta">${team ? esc(team.name) : ""}</span>
        <span class="rmeta">${r.points} pts</span>
        <span class="badge ${r.driver.canon?'badge-canon':'badge-noncanon'}">${r.driver.canon?'canon':'background'}</span>
      </div>`;
    }).join("");
    board.querySelectorAll(".vault-row").forEach(row=>{
      row.addEventListener("click", ()=>{ location.hash = "driver-" + row.dataset.id; });
    });
  }
  yearSel.addEventListener("change", draw);
  seriesSel.addEventListener("change", draw);
  document.getElementById("resultsShowNoncanon").addEventListener("change", draw);
  draw();
}

/* ---------- RACES tab: season list, grouped by round ----------
   A round can have a "sprint" entry and/or a "race" entry \u2014 grouping by
   (seriesId, year, round) is what bundles the two for display, since the
   markdown files themselves look identical either way. */
function renderRacesTab(){
  const body = document.getElementById("vaultTabBody");
  const years = [...new Set(STATE.races.map(r=>r.year))].sort((a,b)=>b-a);
  const defaultSeries = STATE.series[0]?.id;
  const defaultYear = years[0] || new Date().getFullYear();

  body.innerHTML = `
    <div class="vault-toolbar">
      <select id="raceYear">${years.length ? years.map(y=>`<option value="${y}">${y}</option>`).join("") : `<option value="${defaultYear}">${defaultYear}</option>`}</select>
      <select id="raceSeries">${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      <div class="spacer"></div>
      <button class="btn-vault-secondary" id="addRaceManualBtn">+ Add manually</button>
      <button class="btn-vault-add" id="scanRaceBtn">+ Scan race file</button>
    </div>
    <div class="vault-list" id="racesListBody"></div>
  `;
  const yearSel = document.getElementById("raceYear");
  const seriesSel = document.getElementById("raceSeries");
  yearSel.value = defaultYear;
  seriesSel.value = defaultSeries;

  document.getElementById("scanRaceBtn").addEventListener("click", ()=>{ location.hash = "races-scan"; });
  document.getElementById("addRaceManualBtn").addEventListener("click", ()=>{
    const seriesId = Number(seriesSel.value);
    const year = Number(yearSel.value) || new Date().getFullYear();
    const maxRound = Math.max(0, ...STATE.races.filter(r=>r.seriesId===seriesId && r.year===year).map(r=>r.round));
    location.hash = `raceweekend-${seriesId}-${year}-${maxRound + 1}`;
  });

  function draw(){
    const seriesId = Number(seriesSel.value);
    const year = Number(yearSel.value);
    const wrap = document.getElementById("racesListBody");
    const inScope = STATE.races.filter(r=>r.seriesId===seriesId && r.year===year);
    if(!inScope.length){ wrap.innerHTML = `<div class="vault-empty">No races on record for this season yet \u2014 scan a race file or add one manually.</div>`; return; }
    const rounds = [...new Set(inScope.map(r=>r.round))].sort((a,b)=>a-b);
    wrap.innerHTML = rounds.map(round=>{
      const entries = inScope.filter(r=>r.round===round);
      const race = entries.find(r=>r.kind==='race');
      const sprint = entries.find(r=>r.kind==='sprint');
      const name = (race && race.name) || (sprint && sprint.name) || "Untitled round";
      const winner = race ? race.results.find(x=>String(x.position).trim()==="1") : null;
      const date = (race && race.date) || (sprint && sprint.date);
      const metaParts = [];
      if(date) metaParts.push(formatRaceDate(date));
      if(race && race.circuit) metaParts.push(race.circuit);
      if(winner) metaParts.push("Winner: " + (winner.driverName || "\u2014"));
      return `<div class="race-weekend-card" data-series="${seriesId}" data-year="${year}" data-round="${round}">
        <span class="rw-round">RD ${round}</span>
        <span class="rw-name">${esc(name)}</span>
        <span class="rw-meta">${esc(metaParts.join(" \u00b7 "))}</span>
        <span class="rw-badges">
          ${sprint ? `<span class="badge badge-sprint">sprint</span>` : ""}
          ${race ? `<span class="badge badge-race">race</span>` : ""}
        </span>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".race-weekend-card").forEach(card=>{
      card.addEventListener("click", ()=>{
        location.hash = `raceweekend-${card.dataset.series}-${card.dataset.year}-${card.dataset.round}`;
      });
    });
  }
  yearSel.addEventListener("change", draw);
  seriesSel.addEventListener("change", draw);
  draw();
}

/* ---------- RACES: scan / import form ---------- */
let scanState = null; // holds the parsed file + auto-matches between Parse and Import

function renderRaceScanForm(){
  const body = document.getElementById("vaultTabBody");
  scanState = null;
  const years = [...new Set(STATE.races.map(r=>r.year))].sort((a,b)=>b-a);
  const defaultSeries = STATE.series[0]?.id;
  const defaultYear = years[0] || new Date().getFullYear();

  body.innerHTML = `
    <div class="vault-detail">
      <div class="vault-detail-head">
        <h2>Scan race file</h2>
        <div class="vault-detail-actions"><button class="btn-vault-secondary" id="cancelScanBtn">Back</button></div>
      </div>
      <p style="color:var(--gray-light); font-size:14px; margin-bottom:16px;">
        Paste the contents of a race markdown file, or upload it \u2014 a Qualifying Result table, a Race Result table, and
        an optional Race Log. Sprint files use the exact same layout as a normal race; just mark this one as a Sprint
        below so it bundles with its round's main race on the Races list.
      </p>
      <div class="vault-grid-form">
        <div class="vault-field"><label>Series</label><select id="scanSeries">${STATE.series.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
        <div class="vault-field"><label>Year</label><input type="number" id="scanYear" value="${defaultYear}"></div>
        <div class="vault-field"><label>Round</label><input type="number" id="scanRound" value="1" min="1"></div>
        <div class="vault-field">
          <label>Session type</label>
          <select id="scanKind"><option value="race">Race</option><option value="sprint">Sprint</option></select>
        </div>
      </div>
      <div class="vault-field span2" style="margin-top:6px;">
        <label>Markdown file</label>
        <input type="file" id="scanFileInput" accept=".md,.markdown,.txt">
      </div>
      <div class="vault-field span2">
        <label>Or paste markdown</label>
        <textarea id="scanText" style="min-height:260px; font-family:var(--font-mono); font-size:12.5px;"></textarea>
      </div>
      <button type="button" class="btn-vault-add" id="scanParseBtn">Parse</button>
      <div id="scanPreview"></div>
    </div>
  `;
  document.getElementById("cancelScanBtn").addEventListener("click", ()=>{ location.hash = "races"; });
  document.getElementById("scanSeries").value = defaultSeries;

  document.getElementById("scanFileInput").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{ document.getElementById("scanText").value = reader.result; };
    reader.readAsText(file);
  });

  document.getElementById("scanParseBtn").addEventListener("click", ()=>{
    const text = document.getElementById("scanText").value;
    if(!text.trim()){ alert("Paste or upload a markdown file first."); return; }
    const seriesId = Number(document.getElementById("scanSeries").value);
    const parsed = parseRaceMarkdown(text);
    if(!parsed.qualifying.length && !parsed.results.length){
      alert("Couldn't find a Qualifying Result or Race Result table in that file \u2014 check the format and try again.");
      return;
    }
    buildScanPreview(parsed, seriesId);
  });
}

function buildScanPreview(parsed, seriesId){
  const qualiRows = parsed.qualifying.map(row=>({
    position: row['pos'] || '', driverRaw: (row['driver']||'').trim(), teamRaw: (row['team']||'').trim(),
    time: row['time'] || '', gap: row['gap'] || ''
  }));
  const resultRows = parsed.results.map(row=>({
    position: row['pos'] || '', driverRaw: (row['driver']||'').trim(), teamRaw: (row['team']||'').trim(),
    grid: row['grid'] || '', timeGap: row['time/gap'] || row['time'] || '',
    notes: row['traits / note'] || row['notes'] || row['note'] || ''
  }));
  const driverNames = [...new Set([...qualiRows, ...resultRows].map(r=>r.driverRaw).filter(Boolean))];
  const teamNames = [...new Set([...qualiRows, ...resultRows].map(r=>r.teamRaw).filter(Boolean))];
  const unmatchedDrivers = driverNames.filter(n=>!matchDriverByName(n));
  const unmatchedTeams = teamNames.filter(n=>!matchTeamByName(n, seriesId));

  scanState = { parsed, seriesId, qualiRows, resultRows };

  const preview = document.getElementById("scanPreview");
  preview.innerHTML = `
    <div class="race-scan-preview">
      <h3 style="font-family:var(--font-display); font-weight:800; font-size:17px; text-transform:uppercase; margin-bottom:10px;">${esc(parsed.title || "Untitled race")}</h3>
      <div class="vault-hint" style="margin-bottom:14px; line-height:1.6;">
        ${[parsed.circuit, parsed.laps ? parsed.laps + ' laps' : '', parsed.conditions].filter(Boolean).map(esc).join(" \u00b7 ")}<br>
        ${qualiRows.length} qualifying rows \u00b7 ${resultRows.length} result rows${parsed.raceLog.length ? ' \u00b7 ' + parsed.raceLog.length + ' log lines' : ''}
      </div>
      <div class="vault-hint" style="margin-bottom:14px;">
        Points will be assigned automatically on import (${document.getElementById("scanKind").value === "sprint" ? "sprint scoring, top 8: 8-7-6-5-4-3-2-1" : "race scoring, top 10: 25-18-15-12-10-8-6-4-2-1"}),
        and any position or note that looks like a retirement (DNF/DNS/DSQ/Ret) will be flagged as a DNF automatically \u2014 you can fix either on the round's edit page after saving.
      </div>
      ${(unmatchedDrivers.length || unmatchedTeams.length) ? `
        <div class="vault-hint" style="color:var(--amber); margin-bottom:14px;">
          Couldn't auto-match against your roster: ${[...unmatchedDrivers, ...unmatchedTeams].map(esc).join(", ")}.
          They'll still import as plain text \u2014 you can fix or link them up on the round's edit page after saving.
        </div>
      ` : `<div class="vault-hint" style="color:#5ec26a; margin-bottom:14px;">Every driver and team name matched your roster.</div>`}
      <button type="button" class="btn-vault-add" id="scanSaveBtn">Import race</button>
    </div>
  `;
  document.getElementById("scanSaveBtn").addEventListener("click", saveScannedRace);
}

function saveScannedRace(){
  const seriesId = Number(document.getElementById("scanSeries").value);
  const year = Number(document.getElementById("scanYear").value);
  const round = Number(document.getElementById("scanRound").value);
  const kind = document.getElementById("scanKind").value;
  if(!year || !round){ alert("Year and round are required."); return; }
  const { parsed, qualiRows, resultRows } = scanState;

  const buildEntry = (r, driverKey, extra) => {
    const dm = matchDriverByName(r[driverKey]);
    const tm = matchTeamByName(r.teamRaw, seriesId);
    return {
      position: r.position,
      driverId: dm ? dm.id : null, driverName: dm ? dm.name : r[driverKey],
      teamId: tm ? tm.id : null, teamName: tm ? tm.name : r.teamRaw,
      ...extra
    };
  };

  const race = {
    id: nextId(STATE.races),
    seriesId, year, round, kind,
    name: parsed.title || "Untitled race",
    circuit: parsed.circuit || "",
    laps: parsed.laps || null,
    conditions: parsed.conditions || "",
    date: "",
    qualifying: qualiRows.map(r=>buildEntry(r, 'driverRaw', { time: r.time, gap: r.gap })),
    results: resultRows.map(r=>buildEntry(r, 'driverRaw', {
      grid: r.grid, timeGap: r.timeGap, notes: r.notes,
      dnf: looksLikeDnf(r.position, r.notes)
    })),
    raceLog: parsed.raceLog
  };
  recomputeRacePoints(race);
  STATE.races.push(race);
  markDirty();
  scanState = null;
  location.hash = `raceweekend-${seriesId}-${year}-${round}`;
}

/* ---------- RACES: round editor (bundles sprint + race) ---------- */
function renderRaceWeekendForm(seriesId, year, round){
  if(!seriesId || !year || !round){ location.hash = "races"; return; }
  const body = document.getElementById("vaultTabBody");
  const race = STATE.races.find(r=>r.seriesId===seriesId && r.year===year && r.round===round && r.kind==='race');
  const sprint = STATE.races.find(r=>r.seriesId===seriesId && r.year===year && r.round===round && r.kind==='sprint');

  const driverNamesList = [...STATE.drivers].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`<option value="${esc(d.name)}">`).join("");
  const teamNamesList = STATE.teams.filter(t=>teamSeriesIds(t).includes(seriesId)).sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<option value="${esc(t.name)}">`).join("");

  const qualiRowHtml = (r, i) => `
    <div class="race-table-row race-quali-row" data-idx="${i}">
      <input type="text" class="rq-pos" value="${esc(r.position||'')}" placeholder="Pos">
      <input type="text" class="rq-driver" list="raceDriverNames" value="${esc(r.driverName||'')}" placeholder="Driver">
      <input type="text" class="rq-team" list="raceTeamNames" value="${esc(r.teamName||'')}" placeholder="Team">
      <input type="text" class="rq-time" value="${esc(r.time||'')}" placeholder="Time">
      <input type="text" class="rq-gap" value="${esc(r.gap||'')}" placeholder="Gap">
      <button type="button" class="btn-remove-row" data-remove-quali="${i}">&times;</button>
    </div>`;
  const resultRowHtml = (r, i, kind) => `
    <div class="race-table-row race-result-row" data-idx="${i}">
      <input type="text" class="rr-pos" value="${esc(r.position||'')}" placeholder="Pos">
      <input type="text" class="rr-driver" list="raceDriverNames" value="${esc(r.driverName||'')}" placeholder="Driver">
      <input type="text" class="rr-team" list="raceTeamNames" value="${esc(r.teamName||'')}" placeholder="Team">
      <input type="text" class="rr-grid" value="${esc(r.grid||'')}" placeholder="Grid">
      <input type="text" class="rr-timegap" value="${esc(r.timeGap||'')}" placeholder="Time/Gap">
      <input type="text" class="rr-notes" value="${esc(r.notes||'')}" placeholder="Notes">
      <label class="vault-checkbox rr-dnf-label"><input type="checkbox" class="rr-dnf" ${r.dnf?'checked':''}> DNF</label>
      <span class="rr-points" data-kind="${kind}">${pointsForResult(kind, r.position, !!r.dnf)}</span>
      <button type="button" class="btn-remove-row" data-remove-result="${i}">&times;</button>
    </div>`;

  const sessionBlock = (entry, kind, label) => {
    if(!entry){
      return `<div class="race-session-block">
        <div class="race-session-head"><h3>${label}</h3></div>
        <button type="button" class="btn-add-row add-session-btn" data-kind="${kind}">+ Add ${label.toLowerCase()} results</button>
      </div>`;
    }
    return `<div class="race-session-block" data-kind="${kind}">
      <div class="race-session-head">
        <h3>${label}</h3>
        <button type="button" class="btn-vault-secondary btn-vault-danger delete-session-btn" data-kind="${kind}">Delete ${label.toLowerCase()}</button>
      </div>
      <div class="vault-grid-form">
        <div class="vault-field span2"><label>Name</label><input type="text" class="sess-name" value="${esc(entry.name||'')}"></div>
        <div class="vault-field"><label>Date</label><input type="date" class="sess-date" value="${esc(entry.date||'')}"></div>
        <div class="vault-field"><label>Circuit</label><input type="text" class="sess-circuit" value="${esc(entry.circuit||'')}"></div>
        <div class="vault-field"><label>Laps</label><input type="number" class="sess-laps" value="${entry.laps ?? ''}"></div>
        <div class="vault-field span2"><label>Conditions</label><input type="text" class="sess-conditions" value="${esc(entry.conditions||'')}"></div>
      </div>
      <div class="vault-field">
        <label>Qualifying</label>
        <div class="race-table">
          <div class="race-table-row head race-quali-row"><span>Pos</span><span>Driver</span><span>Team</span><span>Time</span><span>Gap</span><span></span></div>
          <div class="quali-rows">${entry.qualifying.map(qualiRowHtml).join("")}</div>
        </div>
        <button type="button" class="btn-add-row add-quali-row" style="margin-top:8px;">+ Add qualifying row</button>
      </div>
      <div class="vault-field">
        <label>Race result</label>
        <div class="race-table">
          <div class="race-table-row head race-result-row"><span>Pos</span><span>Driver</span><span>Team</span><span>Grid</span><span>Time/Gap</span><span>Notes</span><span>DNF</span><span>Pts</span><span></span></div>
          <div class="result-rows">${entry.results.map((r,i)=>resultRowHtml(r, i, kind)).join("")}</div>
        </div>
        <button type="button" class="btn-add-row add-result-row" style="margin-top:8px;">+ Add result row</button>
      </div>
      <div class="vault-field span2">
        <label>Race log (one entry per line)</label>
        <textarea class="sess-log" style="min-height:120px; font-family:var(--font-mono); font-size:12.5px;">${esc((entry.raceLog||[]).join("\n"))}</textarea>
      </div>
    </div>`;
  };

  body.innerHTML = `
    <datalist id="raceDriverNames">${driverNamesList}</datalist>
    <datalist id="raceTeamNames">${teamNamesList}</datalist>
    <div class="vault-detail">
      <div class="vault-detail-head">
        <h2>Round ${round} <span class="current-number">${esc(currentSeriesName(seriesId))} \u00b7 ${year}</span></h2>
        <div class="vault-detail-actions">
          <button class="btn-vault-secondary btn-vault-danger" id="deleteWeekendBtn">Delete round</button>
          <button class="btn-vault-secondary" id="cancelWeekendBtn">Back</button>
        </div>
      </div>
      ${sessionBlock(sprint, 'sprint', 'Sprint')}
      ${sessionBlock(race, 'race', 'Race')}
      <div style="margin-top:24px;"><button type="button" class="btn-vault-add" id="saveWeekendBtn">Save round</button></div>
    </div>
  `;

  document.getElementById("cancelWeekendBtn").addEventListener("click", ()=>{ location.hash = "races"; });
  document.getElementById("deleteWeekendBtn").addEventListener("click", ()=>{
    if(!confirm(`Delete round ${round} entirely \u2014 sprint and race both? This can't be undone until you Save.`)) return;
    STATE.races = STATE.races.filter(r=>!(r.seriesId===seriesId && r.year===year && r.round===round));
    markDirty();
    location.hash = "races";
  });
  body.querySelectorAll(".delete-session-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const kind = btn.dataset.kind;
      if(!confirm(`Delete the ${kind}? This can't be undone until you Save.`)) return;
      STATE.races = STATE.races.filter(r=>!(r.seriesId===seriesId && r.year===year && r.round===round && r.kind===kind));
      markDirty();
      renderRaceWeekendForm(seriesId, year, round);
    });
  });
  body.querySelectorAll(".add-session-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const kind = btn.dataset.kind;
      STATE.races.push({ id: nextId(STATE.races), seriesId, year, round, kind, name:"", circuit:"", laps:null, conditions:"", date:"", qualifying:[], results:[], raceLog:[] });
      markDirty();
      renderRaceWeekendForm(seriesId, year, round);
    });
  });
  body.querySelectorAll(".add-quali-row").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const kind = btn.closest(".race-session-block").dataset.kind;
      const entry = kind==='race' ? race : sprint;
      entry.qualifying.push({ position:"", driverId:null, driverName:"", teamId:null, teamName:"", time:"", gap:"" });
      markDirty();
      renderRaceWeekendForm(seriesId, year, round);
    });
  });
  body.querySelectorAll(".add-result-row").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const kind = btn.closest(".race-session-block").dataset.kind;
      const entry = kind==='race' ? race : sprint;
      entry.results.push({ position:"", driverId:null, driverName:"", teamId:null, teamName:"", grid:"", timeGap:"", notes:"", dnf:false, points:0 });
      markDirty();
      renderRaceWeekendForm(seriesId, year, round);
    });
  });
  body.querySelectorAll("[data-remove-quali]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const kind = btn.closest(".race-session-block").dataset.kind;
      const entry = kind==='race' ? race : sprint;
      entry.qualifying.splice(Number(btn.dataset.removeQuali), 1);
      markDirty();
      renderRaceWeekendForm(seriesId, year, round);
    });
  });
  // Live-updates a result row's Pts column as its position or DNF flag
  // changes, purely cosmetic here \u2014 the authoritative value is recomputed
  // from scratch again on Save.
  body.querySelectorAll(".race-result-row").forEach(row=>{
    const ptsEl = row.querySelector(".rr-points");
    if(!ptsEl) return;
    const kind = ptsEl.dataset.kind;
    const refresh = ()=>{
      ptsEl.textContent = pointsForResult(kind, row.querySelector(".rr-pos").value, row.querySelector(".rr-dnf").checked);
    };
    row.querySelector(".rr-pos").addEventListener("input", refresh);
    row.querySelector(".rr-dnf").addEventListener("change", refresh);
  });
  body.querySelectorAll("[data-remove-result]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const kind = btn.closest(".race-session-block").dataset.kind;
      const entry = kind==='race' ? race : sprint;
      entry.results.splice(Number(btn.dataset.removeResult), 1);
      markDirty();
      renderRaceWeekendForm(seriesId, year, round);
    });
  });

  document.getElementById("saveWeekendBtn").addEventListener("click", ()=>{
    [['race', race], ['sprint', sprint]].forEach(([kind, entry])=>{
      if(!entry) return;
      const block = body.querySelector(`.race-session-block[data-kind="${kind}"]`);
      if(!block) return;
      entry.name = block.querySelector(".sess-name").value.trim();
      entry.date = block.querySelector(".sess-date").value;
      entry.circuit = block.querySelector(".sess-circuit").value.trim();
      entry.laps = block.querySelector(".sess-laps").value ? Number(block.querySelector(".sess-laps").value) : null;
      entry.conditions = block.querySelector(".sess-conditions").value.trim();
      entry.qualifying = [...block.querySelectorAll(".quali-rows .race-quali-row")].map(row=>{
        const driverName = row.querySelector(".rq-driver").value.trim();
        const teamName = row.querySelector(".rq-team").value.trim();
        const dm = matchDriverByName(driverName), tm = matchTeamByName(teamName, seriesId);
        return {
          position: row.querySelector(".rq-pos").value.trim(),
          driverId: dm ? dm.id : null, driverName,
          teamId: tm ? tm.id : null, teamName,
          time: row.querySelector(".rq-time").value.trim(),
          gap: row.querySelector(".rq-gap").value.trim()
        };
      });
      entry.results = [...block.querySelectorAll(".result-rows .race-result-row")].map(row=>{
        const driverName = row.querySelector(".rr-driver").value.trim();
        const teamName = row.querySelector(".rr-team").value.trim();
        const dm = matchDriverByName(driverName), tm = matchTeamByName(teamName, seriesId);
        return {
          position: row.querySelector(".rr-pos").value.trim(),
          driverId: dm ? dm.id : null, driverName,
          teamId: tm ? tm.id : null, teamName,
          grid: row.querySelector(".rr-grid").value.trim(),
          timeGap: row.querySelector(".rr-timegap").value.trim(),
          notes: row.querySelector(".rr-notes").value.trim(),
          dnf: row.querySelector(".rr-dnf").checked
        };
      });
      // Points are always derived fresh from position/DNF/kind here \u2014 never
      // trust whatever the live preview last showed.
      recomputeRacePoints(entry);
      entry.raceLog = block.querySelector(".sess-log").value.split("\n").map(l=>l.trim()).filter(Boolean);
    });
    markDirty();
    location.hash = "races";
  });
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