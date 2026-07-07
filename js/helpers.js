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
      date: new Date(race.date+"T00:00:00"),
      sprint: !!race.sprint
    }));
  }
  const rounds = [];
  const start = new Date(year+"-03-01");
  for(let i=0;i<CIRCUITS.length;i++){
    const d = new Date(start);
    d.setDate(d.getDate() + i*14);
    rounds.push({round:i+1, circuit:CIRCUITS[i], date:d, sprint:false});
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
// Deterministic per-round "qualifying" strength, distinct from the season strength used
// for finishing order below -- gives each round its own starting grid instead of the
// grid always matching the finish order.
function gridStrength(driverId, year, round){
  return seededRand(driverId*5303 + year*211 + round*577 + 7919);
}
function sprintGridStrength(driverId, year, round){
  return seededRand(driverId*3299 + year*151 + round*331 + 4133);
}
// Fixed, obviously-placeholder finishing order for every driver who was actually on the
// grid that season, in name order, each paired with the team they raced for that year.
// Starting grid slot is generated separately per round via gridStrength() above.
// Looks up a stored real result session (e.g. RACE_RESULTS[year][round].race) and, if
// present, converts it into the same shape the rest of the site expects. Starting grid
// isn't tracked separately yet -- until real qualifying data is added, gridStart just
// mirrors the session's own finishing order (see the note atop js/results.js).
function realSessionResult(year, round, sessionKey){
  const stored = RACE_RESULTS[year] && RACE_RESULTS[year][round] && RACE_RESULTS[year][round][sessionKey];
  if(!stored) return null;
  return stored.map((e,i)=>({
    pos: e.classified ? e.pos : "NC",
    driver: driverById(e.driverId),
    team: teamByIdAny(e.teamId),
    points: e.points,
    time: e.time,
    gridStart: i+1
  }));
}
function raceResult(year, round){
  const real = realSessionResult(year, round, "race");
  if(real) return real;
  const field = driversForYear(year);
  const gridOrder = field.slice().sort((a,b)=> gridStrength(b.id,year,round) - gridStrength(a.id,year,round));
  const gridPos = {};
  gridOrder.forEach((d,i)=>{ gridPos[d.id] = i+1; });
  return field.map((d,i)=>({
    pos:i+1,
    driver:d,
    team:teamOfDriverInYear(d, year),
    points: POINTS[i] || 0,
    time: i===0 ? "1:32:04.512" : "+"+(i*4.317).toFixed(3),
    gridStart: gridPos[d.id]
  }));
}
// Fixed, obviously-placeholder finishing order for the Saturday Sprint on weekends that
// have one. Uses each driver's season "strength" (also used for the season stats
// generator) to rank the field, so the order differs from the Sunday Grand Prix instead
// of just repeating it. Top 8 only score points, per SPRINT_POINTS.
function sprintResult(year, round){
  const real = realSessionResult(year, round, "sprint");
  if(real) return real;
  const field = driversForYear(year)
    .slice()
    .sort((a,b)=> driverStrength(b.id,year) - driverStrength(a.id,year));
  const gridOrder = field.slice().sort((a,b)=> sprintGridStrength(b.id,year,round) - sprintGridStrength(a.id,year,round));
  const gridPos = {};
  gridOrder.forEach((d,i)=>{ gridPos[d.id] = i+1; });
  return field.map((d,i)=>({
    pos:i+1,
    driver:d,
    team:teamOfDriverInYear(d, year),
    points: SPRINT_POINTS[i] || 0,
    time: i===0 ? "28:11.204" : "+"+(i*2.114).toFixed(3),
    gridStart: gridPos[d.id]
  }));
}
function seasonStandings(year){
  const rounds = seasonRounds(year).filter(r => raceStatus(year, r.date)==="completed");
  const field = driversForYear(year);
  const totals = {};
  field.forEach(d=> totals[d.id]=0 );
  rounds.forEach(r=>{
    raceResult(year, r.round).forEach(res=>{ totals[res.driver.id]+= res.points; });
    if(r.sprint){
      sprintResult(year, r.round).forEach(res=>{ totals[res.driver.id]+= res.points; });
    }
  });
  return field.map(d=>({driver:d, team:teamOfDriverInYear(d,year), points:totals[d.id]}))
    .sort((a,b)=> b.points-a.points);
}
/* =========================================================
   LAP-BY-LAP REPORT (placeholder generator)
   Builds a deterministic race-leader timeline, a pit stop log for the top
   finishers, and a fastest-lap marker for a given round -- there's no real
   per-lap telemetry, so this is generated from the same seeded-random
   approach used by the season/grid stats above.
   ========================================================= */
function raceLapReport(year, round, circuit){
  const results = raceResult(year, round);
  const totalLaps = circuit.laps;
  const poleSitter = results.slice().sort((a,b)=> a.gridStart-b.gridStart)[0];
  const winner = results[0];

  // Leader timeline: the pole-sitter leads from the start; if they aren't the
  // eventual winner, a single deterministic lead change hands it to the winner.
  const segments = [];
  if(poleSitter.driver.id === winner.driver.id){
    segments.push({from:1, to:totalLaps, driver:poleSitter.driver, team:poleSitter.team});
  } else {
    const changeLap = Math.min(totalLaps-1, Math.max(2, 1+Math.round(seededRand(year*7+round*31)*(totalLaps-2))));
    segments.push({from:1, to:changeLap, driver:poleSitter.driver, team:poleSitter.team});
    segments.push({from:changeLap+1, to:totalLaps, driver:winner.driver, team:winner.team});
  }

  // Pit stops for the top 10 finishers: 1-2 stops each, on deterministic laps.
  const pitStops = results.slice(0, Math.min(10, results.length)).map(res=>{
    const stopCount = 1 + Math.round(seededRand(res.driver.id*13 + round*3));
    const laps = [];
    for(let s=0; s<stopCount; s++){
      const lap = Math.min(totalLaps-1, Math.max(2, 3+Math.round(seededRand(res.driver.id*19 + round*5 + s*211)*(totalLaps-6))));
      laps.push(lap);
    }
    laps.sort((a,b)=>a-b);
    return {driver:res.driver, team:res.team, laps};
  });

  const fastestLapNum = Math.min(totalLaps-1, Math.max(2, 3+Math.round(seededRand(year*3+round*11)*(totalLaps-6))));

  return {totalLaps, segments, pitStops, fastestLapDriver: winner.driver, fastestLapNum};
}

function nextRace(){
  const rounds = seasonRounds(CURRENT_YEAR);
  return rounds.find(r => raceStatus(CURRENT_YEAR, r.date)==="upcoming") || null;
}

/* =========================================================
   DRIVER BIOGRAPHY DETAILS (placeholder generator)
   The dataset only stores a driver's birth year (and an occasional free-text
   "achievements" string like "8 x WDC"), not a full date/place of birth or a
   WDC count as a number. These helpers derive stable, deterministic values
   from what we do have, in the same spirit as the season-stats generators
   above -- replace with real biographical data once it exists.
   ========================================================= */
const BIRTH_CITIES = {
  "Argentina":["Buenos Aires","Córdoba","Rosario"], "Australia":["Melbourne","Sydney","Brisbane"],
  "Belgium":["Brussels","Antwerp","Liège"], "Brazil":["São Paulo","Rio de Janeiro","Curitiba"],
  "Canada":["Toronto","Montreal","Vancouver"], "China":["Shanghai","Beijing","Guangzhou"],
  "Czechia":["Prague","Brno","Ostrava"], "Denmark":["Copenhagen","Aarhus","Odense"],
  "Egypt":["Cairo","Alexandria","Giza"], "Estonia":["Tallinn","Tartu","Narva"],
  "Finland":["Helsinki","Espoo","Tampere"], "France":["Paris","Lyon","Marseille"],
  "Germany":["Berlin","Munich","Cologne"], "India":["Mumbai","Delhi","Bangalore"],
  "Ireland":["Dublin","Cork","Galway"], "Italy":["Rome","Milan","Bologna"],
  "Japan":["Tokyo","Osaka","Nagoya"], "Mexico":["Mexico City","Guadalajara","Monterrey"],
  "Netherlands":["Amsterdam","Rotterdam","Utrecht"], "New Zealand":["Auckland","Wellington","Christchurch"],
  "Poland":["Warsaw","Kraków","Wrocław"], "Portugal":["Lisbon","Porto","Braga"],
  "Russia":["Moscow","Saint Petersburg","Kazan"], "San Marino":["City of San Marino","Serravalle","Borgo Maggiore"],
  "Scotland":["Edinburgh","Glasgow","Aberdeen"], "South Africa":["Johannesburg","Cape Town","Pretoria"],
  "South Korea":["Seoul","Busan","Incheon"], "Spain":["Madrid","Barcelona","Valencia"],
  "Sweden":["Stockholm","Gothenburg","Malmö"], "Switzerland":["Zurich","Geneva","Basel"],
  "Thailand":["Bangkok","Chiang Mai","Phuket"], "UAE":["Dubai","Abu Dhabi","Sharjah"],
  "UK":["London","Manchester","Birmingham"], "USA":["Miami","Austin","Los Angeles"]
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
// Deterministic date + city of birth, seeded off the driver's id so it's stable
// across renders. Returns "—" for both fields when we don't even have a birth year.
function driverBirthDetails(driver){
  if(!driver.birthYear) return {dob:"—", place:"—"};
  const cities = BIRTH_CITIES[driver.nationality] || [driver.nationality];
  const city = cities[Math.floor(seededRand(driver.id*331+7)*cities.length)];
  const month = MONTH_NAMES[Math.floor(seededRand(driver.id*911+3)*12)];
  const day = 1 + Math.floor(seededRand(driver.id*173+11)*28);
  return {dob:`${day} ${month} ${driver.birthYear}`, place:`${city}, ${driver.nationality}`};
}
// Extracts a numeric World Drivers' Championship count out of the free-text
// "achievements" field (e.g. "8 x WDC" -> 8). Defaults to 0 when unset/unparsed.
function driverWDCCount(driver){
  if(!driver.achievements) return 0;
  const m = driver.achievements.match(/(\d+)\s*x?\s*WDC/i);
  return m ? parseInt(m[1], 10) : 0;
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