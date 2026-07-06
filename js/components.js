/* =========================================================
   RENDER HELPERS (shared markup pieces)
   ========================================================= */
function newsCard(article){
  const team = article.teamId ? teamById(article.teamId) : null;
  const color = team ? team.color : "#38383F";
  const label = team ? team.name.replace("Team ","T") : "GPC";
  return `<a class="news-card" href="#/article/${article.id}">
    <div class="news-thumb" style="background:linear-gradient(135deg, ${color}, #0D0D12)">
      <span class="news-tag">${article.tag}</span>
      <span>${label}</span>
    </div>
    <div class="news-body">
      <div class="news-date">${fmtDate(new Date(article.date))}</div>
      <h3>${article.title}</h3>
      <p>${article.excerpt}</p>
    </div>
  </a>`;
}
function driverCard(d){
  const team = teamByIdAny(d.teamId);
  const legacy = isLegacyDriver(d.id);
  return `<a class="driver-card" href="#/driver/${d.id}">
    <div class="driver-plate" style="background:linear-gradient(160deg, ${team.color}, #0D0D12 85%)">
      <span class="bignum">${d.number}</span>
      <span class="team-chip">${team.name}${legacy ? " — Former" : ""}</span>
    </div>
    <div class="driver-card-body">
      <div class="num-sm">#${d.number} — ${d.code}</div>
      <h3>${d.name}</h3>
      <div class="nat">${d.nationality}</div>
    </div>
  </a>`;
}
function teamCard(t){
  const drivers = driversOfTeam(t.id);
  const legacy = isLegacyTeam(t.id);
  return `<a class="team-card" href="#/team/${t.id}">
    <div class="team-color-bar" style="background:${t.color}"></div>
    <div class="team-card-body">
      <h3>${t.name}${legacy ? ` <span class="status-pill status-done" style="font-size:11px; vertical-align:middle;">Former</span>` : ""}</h3>
      <div class="full">${t.fullName}</div>
      <div class="team-drivers-mini">
        ${drivers.map(d=>`<span class="mini-chip">#${d.number} ${d.name}</span>`).join("")}
      </div>
    </div>
  </a>`;
}
function yearOptions(selected){
  let out = "";
  for(let y=CURRENT_YEAR; y>=MIN_YEAR; y--){
    out += `<option value="${y}" ${y===selected?"selected":""}>${y}</option>`;
  }
  return out;
}
// Year dropdown bounded to the years a specific team was actually on the grid.
function teamYearOptions(team, selected){
  const legacy = isLegacyTeam(team.id);
  const maxY = legacy ? team.lastEntry : CURRENT_YEAR;
  const minY = Math.max(team.firstEntry, MIN_YEAR);
  let out = "";
  for(let y=maxY; y>=minY; y--){
    out += `<option value="${y}" ${y===selected?"selected":""}>${y}</option>`;
  }
  return out;
}