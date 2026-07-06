/* =========================================================
   DERIVED DATA HELPERS
   ========================================================= */
function teamById(id){ return TEAMS.find(t=>t.id===id); }
// Looks up a team across both current TEAMS and former LEGACY_TEAMS.
function teamByIdAny(id){ return TEAMS.find(t=>t.id===id) || LEGACY_TEAMS.find(t=>t.id===id); }
function isLegacyTeam(id){ return !TEAMS.some(t=>t.id===id); }

function driverById(id){ return DRIVERS.find(d=>d.id===id); }
// Kept as an alias for driverById -- every driver now lives in one DRIVERS array,
// there's no separate "legacy drivers" list anymore (see history model below).
function driverByIdAny(id){ return driverById(id); }
// A driver counts as "former" once they're neither still active nor an upcoming rookie.
function isFormerDriver(driver){ return !driver.stillActive && !driver.upcoming; }

// ---- PER-SEASON DRIVER HISTORY ----
// Every driver has a `history` array: [{year, teamId, rookie}, ...], one entry per season
// they were on the grid, built from the season-by-season movement data. This replaces a
// single static teamId, since real drivers change teams over their careers.
// Resolves which team a driver was actually racing for in a given season. Falls back to
// their current/incoming team if that year isn't in their history (e.g. requesting a year
// outside their career span, or an "upcoming" driver with no seasons recorded yet).
function teamOfDriverInYear(driver, year){
  const entry = driver.history.find(h=>h.year===year);
  const teamId = entry ? entry.teamId : driver.currentTeamId;
  return teamId ? teamByIdAny(teamId) : null;
}
function wasRookieInYear(driver, year){
  const entry = driver.history.find(h=>h.year===year);
  return entry ? entry.rookie : false;
}
// Every driver who raced for a given team in a given season.
function driversOfTeamInYear(teamId, year){
  return DRIVERS.filter(d=> d.history.some(h=>h.year===year && h.teamId===teamId));
}
// "Current" roster for a team, used on the team profile page -- ignores season.
function driversOfTeam(id){
  return driversOfTeamInYear(id, CURRENT_YEAR);
}
// Returns every driver who was on the grid for a given season, so the Drivers overview
// can render accurate historical grids.
function driversForYear(year){
  return DRIVERS.filter(d=> d.history.some(h=>h.year===year)).sort((a,b)=> a.name.localeCompare(b.name));
}
// Year dropdown bounded to the years a specific driver was actually on the grid.
function driverYearOptions(driver, selected){
  const maxY = driver.upcoming ? driver.debutYear : (driver.stillActive ? CURRENT_YEAR : driver.lastYear);
  const minY = driver.upcoming ? driver.debutYear : Math.max(driver.debutYear, MIN_YEAR);
  let out = "";
  for(let y=maxY; y>=minY; y--){
    out += `<option value="${y}" ${y===selected?"selected":""}>${y}</option>`;
  }
  return out;
}
// Returns every team (current + legacy) that was on the grid for a given season,
// so the Teams overview can render accurate historical grids.
function allTeamsForYear(year){
  const current = TEAMS.filter(t=>t.firstEntry<=year);
  const legacy = LEGACY_TEAMS.filter(t=>t.firstEntry<=year && year<=t.lastEntry);
  return current.concat(legacy).sort((a,b)=> a.name.localeCompare(b.name));
}
function initials(name){ return name.replace(/[^0-9]/g,"") ? "D"+name.replace(/[^0-9]/g,"") : name.slice(0,2).toUpperCase(); }

// Build the round list + dates for a given season year.
// If a real calendar exists in SCHEDULES (js/data.js), use it; otherwise fall back
// to the generic uniform placeholder calendar built from CIRCUITS.
function seasonRounds(year){
  if(SCHEDULES[year]){
    return SCHEDULES[year].map((race,i)=>({
      round: i+1,
      circuit: {id:`${year}-${i+1}`, name:race.name, location:race.location, country:race.country, laps:race.laps, length:race.length},
      date: new Date(race.date+"T00:00:00")
    }));
  }
  const rounds = [];
  const start = new Date(year+"-03-01");
  for(let i=0;i<CIRCUITS.length;i++){
    const d = new Date(start);
    d.setDate(d.getDate() + i*14);
    rounds.push({round:i+1, circuit:CIRCUITS[i], date:d});
  }
  return rounds;
}
function raceStatus(year, date){
  if(year < CURRENT_YEAR) return "completed";
  if(year > CURRENT_YEAR) return "upcoming";
  return date <= TODAY ? "completed" : "upcoming";
}
function fmtDate(d){
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
// Fixed, obviously-placeholder finishing order for every driver who was actually on the
// grid that season, in name order, each paired with the team they raced for that year.
function raceResult(year, round){
  const field = driversForYear(year);
  return field.map((d,i)=>({
    pos:i+1,
    driver:d,
    team:teamOfDriverInYear(d, year),
    points: POINTS[i] || 0,
    time: i===0 ? "1:32:04.512" : "+"+(i*4.317).toFixed(3),
    gridStart: i+1
  }));
}
function seasonStandings(year){
  const rounds = seasonRounds(year).filter(r => raceStatus(year, r.date)==="completed");
  const field = driversForYear(year);
  const totals = {};
  field.forEach(d=> totals[d.id]=0 );
  rounds.forEach(()=>{
    raceResult(year,1).forEach(r=>{ totals[r.driver.id]+= r.points; });
  });
  return field.map(d=>({driver:d, team:teamOfDriverInYear(d,year), points:totals[d.id]}))
    .sort((a,b)=> b.points-a.points);
}
function nextRace(){
  const rounds = seasonRounds(CURRENT_YEAR);
  return rounds.find(r => raceStatus(CURRENT_YEAR, r.date)==="upcoming") || null;
}

/* =========================================================
   TEAM SEASON STATS (placeholder generator)
   Produces a stable, deterministic set of season numbers for any
   team/year combination — including legacy teams and past seasons,
   for which there is no real per-race data. Replace with a real
   season-results lookup once that data exists.
   ========================================================= */
function seededRand(seed){
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function teamStrength(teamId, year){
  return seededRand(teamId*10007 + year*97);
}
function teamSeasonStats(teamId, year){
  const teams = allTeamsForYear(year);
  const ranked = teams.map(t=>({id:t.id, s:teamStrength(t.id, year)})).sort((a,b)=> b.s-a.s);
  const position = Math.max(1, ranked.findIndex(r=>r.id===teamId) + 1);
  const strength = teamStrength(teamId, year);

  const gpRounds = seasonRounds(year).filter(r=> raceStatus(year, r.date)==="completed").length;
  const sprintRounds = Math.min(gpRounds, Math.round(gpRounds * 0.27));

  const gpWins = Math.round(strength*strength*gpRounds*0.4);
  const gpPodiums = Math.max(gpWins, Math.round(strength*gpRounds*0.85));
  const gpPoles = Math.round(strength*strength*gpRounds*0.35);
  const gpTop10 = Math.min(gpRounds*2, Math.max(gpPodiums, Math.round((0.25+strength*0.65)*gpRounds*2)));
  const gpPoints = Math.round(strength*gpRounds*17 + gpWins*4);
  const dns = Math.round((1-strength)*1.3);
  const dnf = Math.round((1-strength)*gpRounds*0.18);

  const sprintWins = Math.round(strength*strength*sprintRounds*0.4);
  const sprintPodiums = Math.max(sprintWins, Math.round(strength*sprintRounds*0.8));
  const sprintPoles = Math.round(strength*strength*sprintRounds*0.3);
  const sprintTop8 = Math.min(sprintRounds*2, Math.max(sprintPodiums, Math.round((0.25+strength*0.65)*sprintRounds*2)));
  const sprintPoints = Math.round(strength*sprintRounds*7 + sprintWins);

  return {
    position, seasonPoints: gpPoints + sprintPoints,
    gpRounds, gpPoints, gpWins, gpPodiums, gpPoles, gpTop10, dns, dnf,
    sprintRounds, sprintPoints, sprintWins, sprintPodiums, sprintPoles, sprintTop8
  };
}

/* =========================================================
   DRIVER SEASON STATS (placeholder generator)
   Mirrors teamSeasonStats above: a stable, deterministic set of season
   numbers for any driver/year combination — including legacy drivers and
   past seasons, for which there is no real per-race data. Replace with a
   real season-results lookup once that data exists.
   ========================================================= */
function driverStrength(driverId, year){
  return seededRand(driverId*8123 + year*131);
}
function driverSeasonStats(driverId, year){
  const drivers = driversForYear(year);
  const ranked = drivers.map(d=>({id:d.id, s:driverStrength(d.id, year)})).sort((a,b)=> b.s-a.s);
  const position = Math.max(1, ranked.findIndex(r=>r.id===driverId) + 1);
  const strength = driverStrength(driverId, year);

  const gpRounds = seasonRounds(year).filter(r=> raceStatus(year, r.date)==="completed").length;
  const sprintRounds = Math.min(gpRounds, Math.round(gpRounds * 0.27));

  const gpWins = Math.round(strength*strength*strength*gpRounds*0.5);
  const gpPodiums = Math.max(gpWins, Math.round(strength*strength*gpRounds*0.6));
  const gpPoles = Math.round(strength*strength*strength*gpRounds*0.45);
  const gpTop10 = Math.min(gpRounds, Math.max(gpPodiums, Math.round((0.2+strength*0.7)*gpRounds)));
  const gpPoints = Math.round(strength*gpRounds*15 + gpWins*5);
  const dns = Math.round((1-strength)*1.1);
  const dnf = Math.round((1-strength)*gpRounds*0.15);

  const sprintWins = Math.round(strength*strength*strength*sprintRounds*0.5);
  const sprintPodiums = Math.max(sprintWins, Math.round(strength*strength*sprintRounds*0.55));
  const sprintPoles = Math.round(strength*strength*strength*sprintRounds*0.4);
  const sprintTop8 = Math.min(sprintRounds, Math.max(sprintPodiums, Math.round((0.2+strength*0.7)*sprintRounds)));
  const sprintPoints = Math.round(strength*sprintRounds*6 + sprintWins);

  return {
    position, seasonPoints: gpPoints + sprintPoints,
    gpRounds, gpPoints, gpWins, gpPodiums, gpPoles, gpTop10, dns, dnf,
    sprintRounds, sprintPoints, sprintWins, sprintPodiums, sprintPoles, sprintTop8
  };
}