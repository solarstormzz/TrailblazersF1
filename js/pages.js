/* =========================================================
   PAGE RENDERERS
   ========================================================= */
function pageHome(){
  const nr = nextRace();
  const latestNews = NEWS.slice(0,3);
  let countdown = "";
  if(nr){
    const diff = Math.max(0, nr.date - TODAY);
    const days = Math.floor(diff/86400000);
    countdown = `<div class="countdown">
      <div><div class="num">${days}</div><div class="u">Days</div></div>
    </div>`;
  }
  return `
  <section class="hero">
    <div class="container">
      <div class="hero-eyebrow">${CURRENT_YEAR} Season</div>
      <h1>Every team.<br>Every driver.<br>Every result since ${MIN_YEAR}.</h1>
      <p class="sub">Follow the ${SITE_NAME} — schedules, race-by-race results, driver and team profiles, all the way back to the ${MIN_YEAR} season.</p>
      <div class="hero-cta">
        <a class="btn btn-solid" href="#/schedule">View Schedule</a>
        <a class="btn btn-outline" href="#/results">Browse Results</a>
      </div>
      ${nr ? `
      <div class="next-race">
        <div>
          <div class="label">Next Round</div>
          <h3>${nr.circuit.name}</h3>
          <div class="meta">${nr.circuit.location}, ${nr.circuit.country} — ${fmtDate(nr.date)}</div>
        </div>
        ${countdown}
      </div>` : `
      <div class="next-race">
        <div>
          <div class="label">Season Status</div>
          <h3>${CURRENT_YEAR} calendar complete</h3>
          <div class="meta">All rounds of the ${CURRENT_YEAR} season have been completed.</div>
        </div>
      </div>`}
    </div>
  </section>

  <section class="section container">
    <div class="section-head">
      <h2>Latest News</h2>
      <a class="link-more" href="#/news">All News →</a>
    </div>
    <div class="news-grid">${latestNews.map(newsCard).join("")}</div>
  </section>

  <section class="section container">
    <div class="section-head">
      <h2>Championship Standings</h2>
      <a class="link-more" href="#/results/${CURRENT_YEAR}">Full Results →</a>
    </div>
    ${standingsTable(seasonStandings(CURRENT_YEAR).slice(0,5))}
  </section>
  `;
}

function standingsTable(rows){
  return `<table class="results-table">
    <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Points</th></tr></thead>
    <tbody>
      ${rows.map((r,i)=>`<tr>
        <td class="pos">${i+1}</td>
        <td><a href="#/driver/${r.driver.id}">${r.driver.name}</a></td>
        <td><a href="#/team/${r.team.id}">${r.team.name}</a></td>
        <td>${r.points}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function pageNews(){
  return `<section class="section container">
    <div class="section-head"><h2>News</h2></div>
    <div class="news-grid full">${NEWS.map(newsCard).join("")}</div>
  </section>`;
}

function pageArticle(id){
  const a = NEWS.find(x=>x.id===Number(id));
  if(!a) return notFound("Article");
  const team = a.teamId ? teamById(a.teamId) : null;
  const color = team ? team.color : "#38383F";
  return `<section class="container">
    <div class="breadcrumb" style="padding-top:20px;"><a href="#/news">News</a> / ${a.title}</div>
  </section>
  <section class="article-head container">
    <div class="tagline">${a.tag}</div>
    <h1>${a.title}</h1>
    <div class="meta">${fmtDate(new Date(a.date))}${team ? " — "+team.name : ""}</div>
    <div class="article-thumb-lg" style="background:linear-gradient(135deg, ${color}, #0D0D12)">${team ? team.name.replace("Team ","T") : SITE_SHORT}</div>
  </section>
  <section class="section container">
    <div class="article-body">
      ${a.body.map(p=>`<p>${p}</p>`).join("")}
    </div>
  </section>`;
}

function pageSchedule(){
  const rounds = seasonRounds(CURRENT_YEAR);
  return `<section class="section container">
    <div class="section-head"><h2>${CURRENT_YEAR} Schedule</h2></div>
    <div class="round-list">
      ${rounds.map(r=>{
        const status = raceStatus(CURRENT_YEAR, r.date);
        const isDone = status==="completed";
        return `<a class="round-card ${isDone?"done":""}" href="${isDone ? "#/race/"+CURRENT_YEAR+"/"+r.round : "#/schedule"}">
          <div class="round-num">${String(r.round).padStart(2,"0")}</div>
          <div class="round-info">
            <h3>${r.circuit.name}</h3>
            <div class="loc">${r.circuit.location}, ${r.circuit.country} — ${r.circuit.laps} laps, ${r.circuit.length} km</div>
          </div>
          <div class="round-date">
            ${fmtDate(r.date)}
            <div><span class="status-pill ${isDone?"status-done":"status-upcoming"}">${isDone?"Completed":"Upcoming"}</span></div>
          </div>
        </a>`;
      }).join("")}
    </div>
  </section>`;
}

function pageResultsIndex(year){
  const y = year ? Number(year) : CURRENT_YEAR;
  const rounds = seasonRounds(y).filter(r=> raceStatus(y, r.date)==="completed");
  const standings = seasonStandings(y);
  const champ = standings[0];
  return `<section class="section container">
    <div class="section-head"><h2>Results</h2></div>
    <div class="select-row">
      <label for="yearSelect">Season</label>
      <select id="yearSelect" onchange="location.hash='#/results/'+this.value">
        ${yearOptions(y)}
      </select>
    </div>
    <div class="season-banner">
      <h3>${y} Season</h3>
      <div class="champ">${rounds.length ? "Standings leader: <b>"+champ.driver.name+"</b> ("+champ.points+" pts)" : "Season has not started yet."}</div>
    </div>

    <div class="section-head" style="border:none; margin-bottom:16px;"><h2 style="font-size:22px;">Races</h2></div>
    <div class="round-list">
      ${rounds.length ? rounds.map(r=>`<a class="round-card done" href="#/race/${y}/${r.round}">
          <div class="round-num">${String(r.round).padStart(2,"0")}</div>
          <div class="round-info">
            <h3>${r.circuit.name}</h3>
            <div class="loc">${r.circuit.location}, ${r.circuit.country}</div>
          </div>
          <div class="round-date">${fmtDate(r.date)}</div>
        </a>`).join("") : `<p class="empty-note">No completed rounds for ${y} yet.</p>`}
    </div>

    <div class="section-head" style="margin-top:44px;"><h2 style="font-size:22px;">${y} Standings</h2></div>
    ${standingsTable(standings)}
  </section>`;
}

function pageRace(year, round){
  const y = Number(year), rd = Number(round);
  const rounds = seasonRounds(y);
  const r = rounds.find(x=>x.round===rd);
  if(!r) return notFound("Race");
  const results = raceResult(y, rd);
  const top3 = results.slice(0,3);
  const pole = results[0];
  const fastest = results[0];
  return `<section class="container">
    <div class="breadcrumb" style="padding-top:20px;"><a href="#/results/${y}">Results ${y}</a> / Round ${rd}</div>
  </section>
  <section class="article-head container" style="padding-top:0;">
    <div class="tagline">Round ${rd} — ${y} Season</div>
    <h1>${r.circuit.name}</h1>
    <div class="meta">${r.circuit.location}, ${r.circuit.country} — ${fmtDate(r.date)} — ${r.circuit.laps} laps / ${r.circuit.length} km</div>
  </section>
  <section class="section container">
    <div class="podium">
      ${top3.map((res,i)=>`<div class="podium-card p${i+1}">
        <div class="podium-pos">P${i+1}</div>
        <div class="podium-name">${res.driver.name}</div>
        <div class="podium-team">${res.team.name}</div>
      </div>`).join("")}
    </div>

    <div class="fastlap-strip">
      <div><div class="k">Pole Position</div><div class="v">${pole.driver.name}</div></div>
      <div><div class="k">Fastest Lap</div><div class="v">${fastest.driver.name}</div></div>
      <div><div class="k">Winning Time</div><div class="v">${results[0].time}</div></div>
    </div>

    <table class="results-table">
      <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Grid</th><th>Time / Gap</th><th>Points</th></tr></thead>
      <tbody>
        ${results.map(res=>`<tr>
          <td class="pos">${res.pos}</td>
          <td><a href="#/driver/${res.driver.id}">${res.driver.name}</a></td>
          <td><a href="#/team/${res.team.id}">${res.team.name}</a></td>
          <td>${res.gridStart}</td>
          <td>${res.time}</td>
          <td>${res.points || "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </section>`;
}

function pageDrivers(year){
  const y = year ? Number(year) : CURRENT_YEAR;
  const drivers = driversForYear(y);
  return `<section class="section container">
    <div class="section-head"><h2>Drivers — ${y}</h2></div>
    <div class="select-row">
      <label for="driversYearSelect">Season</label>
      <select id="driversYearSelect" onchange="location.hash='#/drivers/'+this.value">
        ${yearOptions(y)}
      </select>
    </div>
    <div class="grid-3">${drivers.map(driverCard).join("")}</div>
  </section>`;
}

function pageDriverDetail(id, year){
  const d = driverByIdAny(Number(id));
  if(!d) return notFound("Driver");
  const legacy = isLegacyDriver(d.id);
  const team = teamByIdAny(d.teamId);
  const defaultYear = legacy ? d.lastEntry : CURRENT_YEAR;
  const y = year ? Number(year) : defaultYear;
  const stats = driverSeasonStats(d.id, y);
  return `<section class="container">
    <div class="breadcrumb" style="padding-top:20px;"><a href="#/drivers">Drivers</a> / ${d.name}</div>
  </section>
  <section class="detail-hero container">
    <div class="detail-num" style="color:${team.color}">${d.number}</div>
    <div class="detail-titles">
      <h1>${d.name}</h1>
      <div class="team-line"><a href="#/team/${team.id}">${team.name}</a> — ${d.code}${legacy ? ` <span class="status-pill status-done" style="font-size:11px; vertical-align:middle;">Former</span>` : ""}</div>
    </div>
  </section>
  <section class="section container">
    <div class="stat-grid">
      <div class="stat-box"><div class="val">${d.wins}</div><div class="lab">Wins</div></div>
      <div class="stat-box"><div class="val">${d.podiums}</div><div class="lab">Podiums</div></div>
      <div class="stat-box"><div class="val">${d.poles}</div><div class="lab">Pole Positions</div></div>
    </div>
    <div class="info-list">
      <div class="info-row"><div class="k">Nationality</div><div class="v">${d.nationality}</div></div>
      <div class="info-row"><div class="k">Date of Birth</div><div class="v">${d.dob}</div></div>
      <div class="info-row"><div class="k">Team</div><div class="v">${team.name}</div></div>
      <div class="info-row"><div class="k">Car Number</div><div class="v">#${d.number}</div></div>
    </div>

    <div class="section-head" style="margin-top:44px;"><h2 style="font-size:22px;">Biography</h2></div>
    <div class="info-list">
      <div class="info-row"><div class="k">Date of Birth</div><div class="v">${d.dob}</div></div>
      <div class="info-row"><div class="k">Place of Birth</div><div class="v">${d.placeOfBirth || "—"}</div></div>
    </div>
    ${d.bio ? `<p class="team-description">${d.bio}</p>` : ""}

    ${driverResultsSection(d, y, stats)}
  </section>`;
}

function driverResultsSection(d, y, stats){
  const team = teamByIdAny(d.teamId);
  return `
    <div class="section-head" style="margin-top:44px;"><h2 style="font-size:22px;">Results</h2></div>
    <div class="select-row">
      <label for="driverResultsYear">Season</label>
      <select id="driverResultsYear" onchange="location.hash='#/driver/${d.id}/'+this.value">
        ${driverYearOptions(d, y)}
      </select>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="val">${stats.position}</div><div class="lab">Season Position</div></div>
      <div class="stat-box"><div class="val">${stats.seasonPoints}</div><div class="lab">Season Points</div></div>
    </div>
    <div class="section-head" style="border:none; margin:28px 0 0;"><h2 style="font-size:18px;">${team.name}</h2></div>
    <div class="section-head" style="border:none; margin:16px 0 0;"><h2 style="font-size:16px;">Grand Prix</h2></div>
    <div class="info-list">
      <div class="info-row"><div class="k">Races</div><div class="v">${stats.gpRounds}</div></div>
      <div class="info-row"><div class="k">Points</div><div class="v">${stats.gpPoints}</div></div>
      <div class="info-row"><div class="k">Wins</div><div class="v">${stats.gpWins}</div></div>
      <div class="info-row"><div class="k">Podiums</div><div class="v">${stats.gpPodiums}</div></div>
      <div class="info-row"><div class="k">Poles</div><div class="v">${stats.gpPoles}</div></div>
      <div class="info-row"><div class="k">Top 10s</div><div class="v">${stats.gpTop10}</div></div>
      <div class="info-row"><div class="k">DNSs</div><div class="v">${stats.dns}</div></div>
      <div class="info-row"><div class="k">DNFs</div><div class="v">${stats.dnf}</div></div>
    </div>
    <div class="section-head" style="border:none; margin:28px 0 0;"><h2 style="font-size:16px;">Sprint</h2></div>
    <div class="info-list">
      <div class="info-row"><div class="k">Races</div><div class="v">${stats.sprintRounds}</div></div>
      <div class="info-row"><div class="k">Points</div><div class="v">${stats.sprintPoints}</div></div>
      <div class="info-row"><div class="k">Wins</div><div class="v">${stats.sprintWins}</div></div>
      <div class="info-row"><div class="k">Podiums</div><div class="v">${stats.sprintPodiums}</div></div>
      <div class="info-row"><div class="k">Poles</div><div class="v">${stats.sprintPoles}</div></div>
      <div class="info-row"><div class="k">Top 8s</div><div class="v">${stats.sprintTop8}</div></div>
    </div>
  `;
}

function pageTeams(year){
  const y = year ? Number(year) : CURRENT_YEAR;
  const teams = allTeamsForYear(y);
  return `<section class="section container">
    <div class="section-head"><h2>Teams — ${y}</h2></div>
    <div class="select-row">
      <label for="teamsYearSelect">Season</label>
      <select id="teamsYearSelect" onchange="location.hash='#/teams/'+this.value">
        ${yearOptions(y)}
      </select>
    </div>
    <div class="grid-3">${teams.map(teamCard).join("")}</div>
  </section>`;
}

function pageTeamDetail(id, year){
  const t = teamByIdAny(Number(id));
  if(!t) return notFound("Team");
  const legacy = isLegacyTeam(t.id);
  const drivers = driversOfTeam(t.id);
  const defaultYear = legacy ? t.lastEntry : CURRENT_YEAR;
  const y = year ? Number(year) : defaultYear;
  const stats = teamSeasonStats(t.id, y);
  return `<section class="container">
    <div class="breadcrumb" style="padding-top:20px;"><a href="#/teams">Teams</a> / ${t.name}</div>
  </section>
  <section class="team-banner container">
    <div class="team-banner-bar" style="background:${t.color}"></div>
    <h1>${t.name}</h1>
    <div class="full">${t.fullName}</div>
    ${legacy ? `<div class="status-pill status-done" style="margin-top:10px; display:inline-block;">Former Team — ${t.firstEntry}–${t.lastEntry}</div>` : ""}
    ${t.description ? `<p class="team-description">${t.description}</p>` : ""}
  </section>
  <section class="section container">
    <div class="section-head"><h2>Team Profile</h2></div>
    <div class="stat-grid">
      <div class="stat-box"><div class="val">${t.wdc || 0}</div><div class="lab">WDC Titles</div></div>
      <div class="stat-box"><div class="val">${t.wcc || 0}</div><div class="lab">WCC Titles</div></div>
      <div class="stat-box"><div class="val">${t.firstEntry}</div><div class="lab">First Entry</div></div>
      <div class="stat-box"><div class="val">${(legacy ? t.lastEntry : CURRENT_YEAR) - t.firstEntry}</div><div class="lab">Seasons</div></div>
    </div>
    <div class="info-list">
      <div class="info-row"><div class="k">Base</div><div class="v">${t.base}</div></div>
      <div class="info-row"><div class="k">Team Owner / CEO</div><div class="v">${t.owner || "—"}</div></div>
      <div class="info-row"><div class="k">Team Principal</div><div class="v">${t.principal}</div></div>
      <div class="info-row"><div class="k">Chassis</div><div class="v">${t.chassis}</div></div>
      <div class="info-row"><div class="k">Power Unit</div><div class="v">${t.powerUnit}</div></div>
    </div>
    ${drivers.length ? `
    <div class="section-head" style="margin-top:44px;"><h2 style="font-size:22px;">Drivers</h2></div>
    <div class="grid-3">${drivers.map(driverCard).join("")}</div>` : ""}
    ${teamResultsSection(t, y, stats)}
  </section>`;
}

function teamResultsSection(t, y, stats){
  return `
    <div class="section-head" style="margin-top:44px;"><h2 style="font-size:22px;">Results</h2></div>
    <div class="select-row">
      <label for="teamResultsYear">Season</label>
      <select id="teamResultsYear" onchange="location.hash='#/team/${t.id}/'+this.value">
        ${teamYearOptions(t, y)}
      </select>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="val">${stats.position}</div><div class="lab">Season Position</div></div>
      <div class="stat-box"><div class="val">${stats.seasonPoints}</div><div class="lab">Season Points</div></div>
    </div>
    <div class="section-head" style="border:none; margin:28px 0 0;"><h2 style="font-size:18px;">Grand Prix</h2></div>
    <div class="info-list">
      <div class="info-row"><div class="k">Races</div><div class="v">${stats.gpRounds}</div></div>
      <div class="info-row"><div class="k">Points</div><div class="v">${stats.gpPoints}</div></div>
      <div class="info-row"><div class="k">Wins</div><div class="v">${stats.gpWins}</div></div>
      <div class="info-row"><div class="k">Podiums</div><div class="v">${stats.gpPodiums}</div></div>
      <div class="info-row"><div class="k">Poles</div><div class="v">${stats.gpPoles}</div></div>
      <div class="info-row"><div class="k">Top 10s</div><div class="v">${stats.gpTop10}</div></div>
      <div class="info-row"><div class="k">DNSs</div><div class="v">${stats.dns}</div></div>
      <div class="info-row"><div class="k">DNFs</div><div class="v">${stats.dnf}</div></div>
    </div>
    <div class="section-head" style="border:none; margin:28px 0 0;"><h2 style="font-size:18px;">Sprint</h2></div>
    <div class="info-list">
      <div class="info-row"><div class="k">Races</div><div class="v">${stats.sprintRounds}</div></div>
      <div class="info-row"><div class="k">Points</div><div class="v">${stats.sprintPoints}</div></div>
      <div class="info-row"><div class="k">Wins</div><div class="v">${stats.sprintWins}</div></div>
      <div class="info-row"><div class="k">Podiums</div><div class="v">${stats.sprintPodiums}</div></div>
      <div class="info-row"><div class="k">Poles</div><div class="v">${stats.sprintPoles}</div></div>
      <div class="info-row"><div class="k">Top 8s</div><div class="v">${stats.sprintTop8}</div></div>
    </div>
  `;
}

function notFound(kind){
  return `<section class="section container"><p class="empty-note">${kind} not found.</p></section>`;
}