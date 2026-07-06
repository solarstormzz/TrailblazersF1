/* =========================================================
   SITE IDENTITY — rename freely
   ========================================================= */
const SITE_NAME = "Grand Prix Championship";
const SITE_SHORT = "GPC";

/* =========================================================
   EDITABLE DATA
   ========================================================= */

// ---- TEAMS (10) — replace name/fullName/base/principal/chassis/powerUnit with real data ----
// owner:       Team Owner / CEO shown on the team profile
// wdc / wcc:   World Drivers' / Constructors' Championships won — shown as stat boxes on the team profile
// description: short "about" blurb shown on the team profile
const TEAMS = [
  {id:1,  name:"Kinghorn",      fullName:"Kinghorn Formula One Racing Team",          color:"#0c4b28", base:"Base City 1, United Kingdom",  principal:"George Tills",         chassis:"KH-26", powerUnit:"Kinghorn",            firstEntry:1973,
    owner:"Marty Barron", wdc:6, wcc:11,
    description:"Kinghorn have been producing high end cars since the 1940s, being one of the big names in automobile production in England and the world. Since 1973, they have also taken part in Formula One, quickly manifesting themselves at the top of the board. With their iconic British Racing Green liveries, they are an eye catcher on the track, often leading the pack from P1. Kinghorn has produced many champions over the years. They like to stick with their drivers, once they have proven themselves, and have a reputation of treating them like family. The Kinghorn team is very tight-knit, and former drivers and champions speak fondly of their time there."},
  {id:2,  name:"Cavalla Nera",  fullName:"Scuderia Cavalla Nera",                     color:"#424242", base:"Base City 2, Italy",           principal:"Flávio Sartini",       chassis:"CN68", powerUnit:"Cavalla Nera",        firstEntry:1958,
    owner:"Ermes Bencivenni", wdc:9, wcc:19,
    description:"Scuderia Cavalla Nera, the black mares, known for their sports and super cars, have been competing in Formula One almost since the beginning. The sleek, black cars with their silver highlights have been the pinnacle of the sport for over 60 years. However iconic, the cars have a reputation of being notoriously hard to drive— quick as lighting, but just as untameable as a wild horse. Only few drivers have been able to find the perfect synergy with their mares. Though the team likes to test rookies against their cars, only a chosen few make it more than three seasons before moving to another team. Alexander Everill and Callum Sykes are examples of drivers who debuted in Cavalla Nera and managed to carve a place for themselves within the team. "},
  {id:3,  name:"Refresh",       fullName:"Refresh F1 Racing",                         color:"#37ddb4", base:"Base City 3, United Kingdom",  principal:"Anton Lafrentz",       chassis:"REF26", powerUnit:"Refresh Powertrains", firstEntry:2000,
    owner:"Isaac Fisher", wdc:4, wcc:4,
    description:"Refresh was the first energy drink company to dip their toes into Formula One. Joining the big leagues in 2000, the brand came in with a new, modern image, contrasting sharply with the traditional teams still on the grid then. Though they were doubted and criticised a lot in the beginning, Refresh quickly showed their might— bringing forth a champion with Kieran William in 2004 and 2005, and winning the Constructors championship for the third time in a row in 2006, despite their drivers losing out to Cavalla Nera. Throughout the 2010s, Refresh lost some of their momentum. They stayed competitive, but the Cavalla Nera dominance with a driver like Alexander Everill was too strong to be broken, especially with new and upcoming teams like MerQury or Xtreme shooting to the top of the ranks. It took until 2022 and Leon Radvan for them to win again— but then they managed to take both titles for themselves in a row once more in ‘22 and ‘23."},
  {id:4,  name:"MerQury",       fullName:"MerQury Kinghorn Racing",                   color:"#ffbb00", base:"Base City 4, United Kingdom",  principal:"Joachim Schlösser",    chassis:"Q09-26", powerUnit:"Kinghorn",            firstEntry:2009,
    owner:"David Rigby", wdc:1, wcc:1,
    description:"ff the track, MerQury makes the tech that makes your cars smart— But on the circuit, they’re trying to prove that they can reach their prime once more. Joining the grid in 2009 after the Portuguese Atlantica pulled out, MerQury surprised all by having four immediate stand-out seasons, producing a world champion in 2012 and taking the Constructors’ championship the next, with their drivers coming 2nd and 3rd at the end of the year. From 2013 onwards, they had the already 2-time world champion Gerrit Van Dijk in their car, and while the Dutchman consistently performed his very best, something was missing in the next few years. MerQury fell back into the midfield in the mid and late 2010s, not living up to their debut seasons anymore."},
  {id:5,  name:"Frecciata",     fullName:"Scuderia Frecciata Di Altera Cavalla Nera", color:"#78d366", base:"Base City 5, Italy",           principal:"Rico Sessa",           chassis:"CVF-2026", powerUnit:"Cavalla Nera",        firstEntry:2021,
    owner:"Luigi Altera", wdc:0, wcc:0,
    description:"The space on the grid now belonging to Frecciata has a long history. Coming into the 2000s, it was taken up by Swiss master of excellence Lynx, and when they left Formula One in 2013, Cavalla Nera tried their hand at bringing a junior team into the paddock with VentoGrigio. But the company wasn’t satisfied with their placements, and when Italian millionaire and motorsport enthusiast Luigi Altera offered to buy the team in 2020, Cavalla Nera agreed. Now under new management and with a new coat of green paint, the team started 2021 with the name Scuderia Frecciata Di Altera.They managed to retain VG driver Magnus Osterrhein, and made a pricey buy by getting two-time world champion Gerrit Van Dijk into their other seat. While Osterrhein still drives for them with no complaints, Van Dijk was publicly critical about the team and its management, criticising the team principal and owner in interviews and making his desire to leave as soon as his two-year contract was over audible. "},
  {id:6,  name:"Faucon",        fullName:"Equipe Faucon Moteurs",                     color:"#68a5df", base:"Base City 6, France",          principal:"Jean-Pierre Fortier",  chassis:"F6-26", powerUnit:"Faucon Moteurs",      firstEntry:1995,
    owner:"Salomon Gaillard", wdc:2, wcc:2,
    description:"French automaker Falcon Moteurs have been constructors in Formula Once since 1995, also supplying their own engines since the beginning. Though their time has been rocky, Faucon has been a consistent midfield team for the last decade, with their last successes being in 2009 and 2010. Team Owner Salomon Gaillard speaks hopefully of the next years, eager to get his team back into the fold, though many say that Faucon has passed their prime and cannot recover anymore. Indeed, the team has been known to lack innovation, and there is a concerning correlation between low placing teams and those using a Faucon engine. But the team is still fully backed by its parent company and sponsors, and both team principal Jean-Pierre Fortier and driver Gerrit Van Dijk are convinced that Faucon can be and will stay competitive for a long time still. Especially their newest recruit, the already experienced Georgio Adlington, seems to bring new hope to the team, and they are aiming for a Top Five finish in 2025."},
  {id:7,  name:"ACXS",          fullName:"ACXS Davis Motorsports Cavalla Nera",       color:"#d41717", base:"Austin, USA",                  principal:"Bernardo Miranda",     chassis:"7-AXCS", powerUnit:"Cavalla Nera",        firstEntry:2018,
    owner:"Anthony Davis", wdc:0, wcc:0,
    description:"ACXS are channeling real American spirit with their red, white and blue cars. The racing team, backed by millionaire businessman Anthony Davis, has been showing their power in other motorsports like MotoGP and NASCAR for years, but they only broke into the Formula One scene in 2019. Taking over the space once occupied by Xtreme, ACXS is still in its infancy in F1, according to Davis. He sees the team compete at the top of the midfield within the next five years, and is positive that he can bring home a WDC for an American team for the first time since 2011."},
  {id:8,  name:"Equin",         fullName:"Equin Kinghorn GP Racing Team",             color:"#6d0f59", base:"Base City 8, United Kingdom",  principal:"Cecil Glynn",          chassis:"CE98-26", powerUnit:"Kinghorn",            firstEntry:1998,
    owner:"Boyd Southgate", wdc:0, wcc:0,
    description:"Many say that Equin is on their way out– After over 25 years with no wins or outstanding seasons, this team is not anything to write home about. Still, they manage to consistently keep themselves from falling into last place. Their current line up inspires hope, with the young Brazilian Rafael Silveira finishing at a phenomenal 12th place, even if his teammate fell back 4 places in comparison with his 2023 finish."},
  {id:9,  name:"Atlas",         fullName:"Atlas Petrol Faucon F1",                    color:"#223897", base:"Base City 9, Belgium",         principal:"Arturo Accorsi",       chassis:"AP37", powerUnit:"Faucon Moteurs",      firstEntry:2015,
    owner:"Allain Monet", wdc:1, wcc:1,
    description:"Atlas Petrol went through quite some name changes since their debut in Formula One, most notably competing under the name Astraea Altas Racing in the 2000s and early 2010s, in collaboration with Swedish car manufacturer Astraea Automobiles, but are now back to their original name. They merged in 2002 after Astraea did not have the money to compete on their own anymore. The teams once more split in 2014, Astraea fully pulling out of Formula One. The Belgian team has claimed the colour blue as theirs— the white and dark blue accents reminiscent of their logo, a globe with white latitude and longitude lines.The last time Atlas produced a champion was also the first and last time they won the Constructors Championship— 1999. Despite this, Atlas was seen as a top midfield team in the 2000s and 2010s— until the regulation changes in 2022, from which they have yet to recover."},
  {id:10, name:"Leonides",      fullName:"Leonides Faucon Formula One",               color:"#7e45ac", base:"Base City 10, Germany",        principal:"Markus Schuster",      chassis:"Leo-0-26", powerUnit:"Faucon Moteurs",     firstEntry:2011,
    owner:"Sascha Krumm", wdc:0, wcc:0,
    description:"Leonides made their debut on the grid in 2011, stepping into the space left by Inara’s departure. With a Faucon engine, they seemed to be following the previous team’s placement in the midfield too, but the year ended differently than they had hoped. Since then, the team has been unable to rise above an eighth place finish at the end of the year, stuck in the very back of the grid."},
];

// ---- LEGACY TEAMS — teams that no longer compete, used to populate historical grids ----
// firstEntry / lastEntry: the span of years the team was on the grid.
// Used by the "Teams" overview year dropdown so old grids show the team that actually
// occupied that entry, instead of the current team that replaced it.
const LEGACY_TEAMS = [
  {id:101, name:"Astraea",     fullName:"Astraea Motor Racing",   color:"#a88a02", base:"Base City 9, Sweden", principal:"Henrik Palander", chassis:"AA-13", powerUnit:"Astraea Automobiles", firstEntry:1986, lastEntry:2001,
    owner:"—", wdc:2, wcc:0,
    description:"Astraea Automobiles partnered with the Belgian entry from 2002, co-branding as Astraea Atlas Racing, before pulling out of Formula One entirely in 2014 when the collaboration ended."},
  
    {id:102, name:"Lynx",        fullName:"Lynx Precision Engineering Equipe Faucon F1",               color:"#a5a5b6", base:"Basel, Switzerland", principal:"Ueli Brander", chassis:"LX-13", powerUnit:"Cavalla Nera", firstEntry:1988, lastEntry:2012,
    owner:"—", wdc:2, wcc:2,
    description:"A Swiss constructor known for precision engineering, and Faucon's first foray into Formula 1 as a partner-- they still worked together even after the French team joined on their own. The company later switched CEOs, new CEO wanted the brand to have a different image, so Lynx left Formula One in 2012, with their grid slot eventually passed to Cavalla Nera's junior team, VentoGrigio."},
  
    {id:103, name:"VentoGrigio", fullName:"Scuderia VenturoGrigio VG Racing Team", color:"#7e8a97", base:"Base City 5, Italy", principal:"Rico Sessa", chassis:"VG-20", powerUnit:"Cavalla Nera", firstEntry:2013, lastEntry:2020,
    owner:"—", wdc:0, wcc:0,
    description:"VentoGrigio filled the spot formerly taken by Lynx- Cavalla Nera's junior outfit, fielded to develop young talent. Sold to Luigi Altera in 2020 and relaunched as Scuderia Frecciata for the 2021 season."},
  
    {id:104, name:"Xtreme",      fullName:"Xtreme Motorsport Formula One Racing",  color:"#ff6a13", base:"Base City 7, USA", principal:"Marcus Doyle", chassis:"XT-18", powerUnit:"Cavalla Nera", firstEntry:2007, lastEntry:2017,
    owner:"—", wdc:0, wcc:0,
    description:"An American-backed entry that was a close competitor of Refresh. The team was replaced by ACXS after F1 wasn't profitable for them anymore."},
  
    {id:105, name:"Inara",       fullName:"Inara Technology Racing",              color:"#c29c9c", base:"Base City 10, United Arab Emirates", principal:"Muhammed Sulayem", chassis:"IN-10", powerUnit:"Astraea Automobiles", firstEntry:2002, lastEntry:2010,
    owner:"—", wdc:0, wcc:0,
    description:"The team's owner got into hot water with the government and the company went bankrupt. Inara departed Formula One at the end of 2010, with their grid slot taken up by newcomers Leonides the following season."},

    {id:106, name:"Atlantica",       fullName:"Engenharia Atlantica Formula 1",              color:"#1d502d", base:"Base City 10, Portugal", principal:"Tomás Ferreira", chassis:"AL-10", powerUnit:"Kinghorn", firstEntry:1966, lastEntry:2008,
    owner:"—", wdc:5, wcc:4,
    description:"company wanted to get out of motorsports and sold to MerQury."},

    {id:107, name:"Kimura",       fullName:"Kimura Racing Corporation",              color:"#5e82c4", base:"Okashima, Japan", principal:"Satoshi Tanaka", chassis:"KIM6", powerUnit:"Kimura Powertrains", firstEntry:1972, lastEntry:2006,
    owner:"—", wdc:0, wcc:0,
    description:"lost a lot of money in the 2003 market crash and had to close its motorsports division"},

    {id:108, name:"Atlas Astrea",     fullName:"Astraea Atlas Petrol Motor Racing",   color:"#a88a02", base:"Base City 9, Sweden", principal:"Henrik Palander", chassis:"AA-13", powerUnit:"Astraea Automobiles", firstEntry:2002, lastEntry:2014,
    owner:"—", wdc:0, wcc:0,
    description:"Astraea Automobiles partnered with the Belgian entry from 2002, co-branding as Astraea Atlas Racing, before pulling out of Formula One entirely in 2014 when the collaboration ended."},
  
    {id:109, name:"Atlas",         fullName:"Atlas Global Petrol F1",                    color:"#223897", base:"Base City 9, Belgium",         principal:"Giancarlo Tourino",       chassis:"AP2", powerUnit:"Faucon Moteurs",      firstEntry:1989, lastEntry:2001,
    owner:"—", wdc:0, wcc:0,
    description:"Astraea Automobiles partnered with the Belgian entry from 2002, co-branding as Astraea Atlas Racing, before pulling out of Formula One entirely in 2014 when the collaboration ended."},
  
];

// ---- DRIVERS (20, 2 per team) — replace name/code/nationality/dob with real data ----
// placeOfBirth / bio: shown in the "Biography" section on the driver profile
const DRIVER_NUMBERS = [1,2,3,4,5,6,7,8,9,10,11,14,16,18,20,22,23,24,27,44];
const DRIVERS = [];
(function buildDrivers(){
  let n = 1;
  for(const team of TEAMS){
    for(let k=0;k<2;k++){
      DRIVERS.push({
        id:n,
        name:"Driver "+n,
        code:"DR"+String(n).padStart(2,"0"),
        number:DRIVER_NUMBERS[n-1],
        teamId:team.id,
        nationality:"Nationality "+n,
        dob:"20"+String(90+(n%9)).slice(-2)+"-0"+((n%9)+1)+"-1"+(n%9),
        placeOfBirth:"City "+n+", Nationality "+n,
        bio:"Driver "+n+" came up through the junior single-seater ranks before earning a seat with "+team.name+", quickly settling into the team's driving style. Off the track, they are known for a methodical approach to race preparation and a close working relationship with their engineering crew, and are regarded within the paddock as a driver still building toward their full potential.",
        wins:0, podiums:0, poles:0
      });
      n++;
    }
  }
})();

// ---- LEGACY DRIVERS — drivers who raced for LEGACY_TEAMS, used to populate historical grids ----
// firstEntry / lastEntry mirror the legacy team's span on the grid.
const LEGACY_DRIVERS = [];
(function buildLegacyDrivers(){
  let n = 1;
  for(const team of LEGACY_TEAMS){
    for(let k=0;k<2;k++){
      const id = 1000 + n;
      LEGACY_DRIVERS.push({
        id,
        name:"Driver L"+n,
        code:"DL"+String(n).padStart(2,"0"),
        number:DRIVER_NUMBERS[(n-1)%DRIVER_NUMBERS.length],
        teamId:team.id,
        nationality:"Nationality L"+n,
        dob:"19"+String(70+(n%20)).slice(-2)+"-0"+((n%9)+1)+"-1"+(n%9),
        placeOfBirth:"City L"+n+", Nationality L"+n,
        bio:"Driver L"+n+" raced for "+team.name+" during the team's time on the grid, from "+team.firstEntry+" to "+team.lastEntry+", before the team departed Formula One.",
        firstEntry:team.firstEntry, lastEntry:team.lastEntry,
        wins:0, podiums:0, poles:0
      });
      n++;
    }
  }
})();

// ---- CIRCUITS (22 rounds used every season) — replace name/location/country/laps/length with real data ----
const CIRCUITS = [];
for(let i=1;i<=22;i++){
  CIRCUITS.push({id:i, name:"Grand Prix "+i, location:"City "+i, country:"Country "+i, laps:55+(i%8), length:(4.2+(i%6)*0.31).toFixed(3)});
}

// ---- NEWS (placeholder articles) ----
const NEWS = [
  {id:1, tag:"Race Report", date:"2026-07-01", title:"Driver 3 converts pole into commanding win at Grand Prix 11", teamId:3, driverId:5,
    excerpt:"A dominant lights-to-flag drive puts Team 3 back on top of the standings battle.",
    body:["Driver 3 controlled every phase of Grand Prix 11 from pole position, building a comfortable gap through the opening stint and managing tyre wear to cruise home for a commanding victory.",
          "Behind, the fight for the remaining podium spots went down to the final laps, with several cars separated by under a second at the flag.",
          "The result tightens the championship picture heading into the second half of the season, with four teams now within a single race win of the lead."]},
  {id:2, tag:"Technical", date:"2026-06-24", title:"Team 5 confirms major floor upgrade for upcoming rounds", teamId:5, driverId:null,
    excerpt:"A revised floor and diffuser package aims to close the gap to the front of the grid.",
    body:["Team 5 has confirmed a significant aerodynamic upgrade package will arrive over the coming races, headlined by a reworked floor and diffuser designed to recover lost downforce.",
          "Engineers say the changes were validated extensively in the simulator before being signed off for track running.",
          "The team will be hoping the upgrade closes what has so far been a consistent deficit to the midfield leaders."]},
  {id:3, tag:"Breaking", date:"2026-06-18", title:"Driver 11 signs multi-year extension with Team 6", teamId:6, driverId:11,
    excerpt:"The new deal keeps one of the grid's most consistent performers at Team 6 through the next regulation cycle.",
    body:["Team 6 has announced a multi-year contract extension for Driver 11, tying the driver to the team well into the next set of technical regulations.",
          "The announcement ends months of paddock speculation about a possible move and gives the team a settled line-up heading into a period of major rule changes.",
          "Team management praised the driver's consistency and development feedback as key reasons behind the renewal."]},
  {id:4, tag:"Feature", date:"2026-06-10", title:"Inside Team 9's rise from the back of the grid", teamId:9, driverId:null,
    excerpt:"How a small engineering group turned a difficult start to the season into genuine points contention.",
    body:["Three seasons ago, Team 9 struggled to leave the final row of the grid. Today, the team is a regular presence in the points.",
          "The turnaround has been built on a leaner development cycle, closer integration between the design office and the trackside engineers, and a clear focus on correlation between simulation and on-track data.",
          "With momentum building, the team's leadership is cautiously optimistic that a maiden podium could be within reach before the season is out."]},
  {id:5, tag:"Race Report", date:"2026-05-27", title:"Late safety car shuffles order at Grand Prix 8", teamId:2, driverId:3,
    excerpt:"A well-timed pit stop under caution hands Driver 3 an unlikely victory.",
    body:["A late safety car period completely reshuffled the order at Grand Prix 8, promoting several cars that had gambled on strategy earlier in the race.",
          "Driver 3 emerged from the pit lane in the lead after a well-timed stop and held on in a tense final restart to take a surprise win.",
          "The result was a timely boost for Team 2, who had endured a difficult run of results in the preceding rounds."]},
  {id:6, tag:"Technical", date:"2026-05-14", title:"New regulations set to reshape car design from next season", teamId:null, driverId:null,
    excerpt:"Governing body confirms sweeping changes to aerodynamic and power unit rules.",
    body:["The championship's technical working group has confirmed a fresh set of regulations that will take effect from next season, targeting closer racing and reduced development costs.",
          "The changes include revised aerodynamic surfaces, a simplified power unit specification, and new cost cap thresholds for all ten teams.",
          "Team principals broadly welcomed the changes, though several noted the compressed timeline for design work will be a significant challenge."]},
  {id:7, tag:"Feature", date:"2026-04-30", title:"Rookie watch: the standout performers of the season so far", teamId:null, driverId:null,
    excerpt:"A look at how the newest names on the grid are settling into their first campaigns.",
    body:["With the season now well underway, a handful of first-year drivers have already made their mark against more experienced team-mates.",
          "Strong qualifying performances and mature race management have stood out, even as the learning curve of new circuits and race strategy continues.",
          "Team engineers say the standard of the current rookie class has been unusually high, with several names already being talked about as future front-runners."]},
  {id:8, tag:"Breaking", date:"2026-04-16", title:"Team 8 reveals striking special livery for home race", teamId:8, driverId:null,
    excerpt:"A one-off design celebrates the team's history ahead of a landmark round.",
    body:["Team 8 has unveiled a special one-race livery to mark a landmark anniversary for the team, debuting the design at its home Grand Prix.",
          "The scheme draws heavily on the team's early liveries, reworked with modern materials and a refreshed finish.",
          "Both cars will carry the design for the single event before reverting to the standard livery for the remainder of the season."]},
];

// ---- REAL SEASON SCHEDULES (override the generic placeholder calendar for specific years) ----
// Add an entry here for any year you have a real calendar for; other years keep using the
// generic 22-round placeholder built from CIRCUITS in helpers.js (seasonRounds).
const SCHEDULES = {
  2024: [
    {name:"Bahrain Grand Prix",          location:"Bahrain International Circuit, Sakhir",                      country:"Bahrain",              laps:57, length:"5.412", date:"2024-03-02"},
    {name:"Saudi Arabian Grand Prix",    location:"Jeddah Corniche Circuit, Jeddah",                             country:"Saudi Arabia",         laps:50, length:"6.174", date:"2024-03-09"},
    {name:"Australian Grand Prix",       location:"Albert Park Grand Prix Circuit, Melbourne",                   country:"Australia",            laps:58, length:"5.278", date:"2024-03-24"},
    {name:"Japanese Grand Prix",         location:"Suzuka Circuit, Suzuka",                                      country:"Japan",                laps:53, length:"5.807", date:"2024-04-07"},
    {name:"Chinese Grand Prix",          location:"Shanghai International Circuit, Shanghai",                    country:"China",                laps:56, length:"5.451", date:"2024-04-21"},
    {name:"Miami Grand Prix",            location:"Miami International Autodrome, Miami",                       country:"United States",        laps:57, length:"5.412", date:"2024-05-05"},
    {name:"Emilia Romagna Grand Prix",   location:"Autodromo Internazionale Enzo e Dino Ferrari, Imola",         country:"Italy",                laps:63, length:"4.909", date:"2024-05-19"},
    {name:"Monaco Grand Prix",           location:"Circuit de Monaco, Monaco",                                   country:"Monaco",               laps:78, length:"3.337", date:"2024-05-26"},
    {name:"Canadian Grand Prix",         location:"Circuit Gilles Villeneuve, Montréal",                         country:"Canada",               laps:70, length:"4.361", date:"2024-06-09"},
    {name:"Spanish Grand Prix",          location:"Circuit de Barcelona-Catalunya, Barcelona",                   country:"Spain",                laps:66, length:"4.657", date:"2024-06-23"},
    {name:"Austrian Grand Prix",         location:"Red Bull Ring, Spielberg",                                    country:"Austria",              laps:71, length:"4.318", date:"2024-06-30"},
    {name:"British Grand Prix",          location:"Silverstone Circuit, Silverstone",                            country:"United Kingdom",        laps:52, length:"5.891", date:"2024-07-07"},
    {name:"Hungarian Grand Prix",        location:"Hungaroring, Budapest",                                       country:"Hungary",              laps:70, length:"4.381", date:"2024-07-21"},
    {name:"Belgian Grand Prix",          location:"Circuit de Spa-Francorchamps, Spa-Francorchamps",             country:"Belgium",              laps:44, length:"7.004", date:"2024-07-28"},
    {name:"Dutch Grand Prix",            location:"Circuit Zandvoort, Zandvoort",                                country:"Netherlands",          laps:72, length:"4.259", date:"2024-08-25"},
    {name:"Italian Grand Prix",          location:"Autodromo Nazionale Monza, Monza",                            country:"Italy",                laps:53, length:"5.793", date:"2024-09-01"},
    {name:"Azerbaijan Grand Prix",       location:"Baku City Circuit, Baku",                                     country:"Azerbaijan",           laps:51, length:"6.003", date:"2024-09-15"},
    {name:"Singapore Grand Prix",        location:"Marina Bay Street Circuit, Marina Bay",                       country:"Singapore",            laps:62, length:"4.940", date:"2024-09-22"},
    {name:"United States Grand Prix",    location:"Circuit of The Americas, Austin",                             country:"United States",        laps:56, length:"5.513", date:"2024-10-20"},
    {name:"Mexico City Grand Prix",      location:"Autódromo Hermanos Rodríguez, Mexico City",                   country:"Mexico",               laps:71, length:"4.304", date:"2024-10-27"},
    {name:"São Paulo Grand Prix",        location:"Autódromo José Carlos Pace, São Paulo",                       country:"Brazil",               laps:71, length:"4.309", date:"2024-11-03"},
    {name:"Las Vegas Grand Prix",        location:"Las Vegas Strip Circuit, Las Vegas",                          country:"United States",        laps:50, length:"6.201", date:"2024-11-23"},
    {name:"Qatar Grand Prix",            location:"Lusail International Circuit, Lusail",                        country:"Qatar",                laps:57, length:"5.419", date:"2024-12-01"},
    {name:"Abu Dhabi Grand Prix",        location:"Yas Marina Circuit, Yas Island",                              country:"United Arab Emirates", laps:58, length:"5.281", date:"2024-12-08"},
  ],
  2025: [
    {name:"Australian Grand Prix",       location:"Albert Park Grand Prix Circuit, Melbourne",                   country:"Australia",            laps:58, length:"5.278", date:"2025-03-16"},
    {name:"Chinese Grand Prix",          location:"Shanghai International Circuit, Shanghai",                    country:"China",                laps:56, length:"5.451", date:"2025-03-23"},
    {name:"Japanese Grand Prix",         location:"Suzuka Circuit, Suzuka",                                      country:"Japan",                laps:53, length:"5.807", date:"2025-04-06"},
    {name:"Bahrain Grand Prix",          location:"Bahrain International Circuit, Sakhir",                       country:"Bahrain",              laps:57, length:"5.412", date:"2025-04-13"},
    {name:"Saudi Arabian Grand Prix",    location:"Jeddah Corniche Circuit, Jeddah",                             country:"Saudi Arabia",         laps:50, length:"6.174", date:"2025-04-20"},
    {name:"Miami Grand Prix",            location:"Miami International Autodrome, Miami",                        country:"United States",        laps:57, length:"5.412", date:"2025-05-04"},
    {name:"Emilia Romagna Grand Prix",   location:"Autodromo Internazionale Enzo e Dino Ferrari, Imola",         country:"Italy",                laps:63, length:"4.909", date:"2025-05-18"},
    {name:"Monaco Grand Prix",           location:"Circuit de Monaco, Monaco",                                   country:"Monaco",               laps:78, length:"3.337", date:"2025-05-25"},
    {name:"Spanish Grand Prix",          location:"Circuit de Barcelona-Catalunya, Barcelona",                   country:"Spain",                laps:66, length:"4.657", date:"2025-06-01"},
    {name:"Canadian Grand Prix",         location:"Circuit Gilles Villeneuve, Montréal",                         country:"Canada",               laps:70, length:"4.361", date:"2025-06-15"},
    {name:"Austrian Grand Prix",         location:"Red Bull Ring, Spielberg",                                    country:"Austria",              laps:71, length:"4.318", date:"2025-06-29"},
    {name:"British Grand Prix",          location:"Silverstone Circuit, Silverstone",                            country:"United Kingdom",       laps:52, length:"5.891", date:"2025-07-06"},
    {name:"Belgian Grand Prix",          location:"Circuit de Spa-Francorchamps, Spa-Francorchamps",             country:"Belgium",              laps:44, length:"7.004", date:"2025-07-27"},
    {name:"Hungarian Grand Prix",        location:"Hungaroring, Budapest",                                       country:"Hungary",              laps:70, length:"4.381", date:"2025-08-03"},
    {name:"Dutch Grand Prix",            location:"Circuit Zandvoort, Zandvoort",                                country:"Netherlands",          laps:72, length:"4.259", date:"2025-08-31"},
    {name:"Italian Grand Prix",          location:"Autodromo Nazionale Monza, Monza",                            country:"Italy",                laps:53, length:"5.793", date:"2025-09-07"},
    {name:"Azerbaijan Grand Prix",       location:"Baku City Circuit, Baku",                                     country:"Azerbaijan",           laps:51, length:"6.003", date:"2025-09-21"},
    {name:"Singapore Grand Prix",        location:"Marina Bay Street Circuit, Marina Bay",                       country:"Singapore",            laps:62, length:"4.940", date:"2025-10-05"},
    {name:"United States Grand Prix",    location:"Circuit of The Americas, Austin",                             country:"United States",        laps:56, length:"5.513", date:"2025-10-19"},
    {name:"Mexico City Grand Prix",      location:"Autódromo Hermanos Rodríguez, Mexico City",                   country:"Mexico",               laps:71, length:"4.304", date:"2025-10-26"},
    {name:"São Paulo Grand Prix",        location:"Autódromo José Carlos Pace, São Paulo",                       country:"Brazil",               laps:71, length:"4.309", date:"2025-11-09"},
    {name:"Las Vegas Grand Prix",        location:"Las Vegas Strip Circuit, Las Vegas",                          country:"United States",        laps:50, length:"6.201", date:"2025-11-22"},
    {name:"Qatar Grand Prix",            location:"Lusail International Circuit, Lusail",                        country:"Qatar",                laps:57, length:"5.419", date:"2025-11-30"},
    {name:"Abu Dhabi Grand Prix",        location:"Yas Marina Circuit, Yas Island",                              country:"United Arab Emirates", laps:58, length:"5.281", date:"2025-12-07"},
  ],
  2026: [
    {name:"Australian Grand Prix",       location:"Albert Park Grand Prix Circuit, Melbourne",                   country:"Australia",            laps:58, length:"5.278", date:"2026-03-08"},
    {name:"Chinese Grand Prix",          location:"Shanghai International Circuit, Shanghai",                    country:"China",                laps:56, length:"5.451", date:"2026-03-15"},
    {name:"Japanese Grand Prix",         location:"Suzuka Circuit, Suzuka",                                      country:"Japan",                laps:53, length:"5.807", date:"2026-04-29"},
    {name:"Bahrain Grand Prix",          location:"Bahrain International Circuit, Sakhir",                       country:"Bahrain",              laps:57, length:"5.412", date:"2026-04-12"},
    {name:"Saudi Arabian Grand Prix",    location:"Jeddah Corniche Circuit, Jeddah",                             country:"Saudi Arabia",         laps:50, length:"6.174", date:"2026-04-19"},
    {name:"Miami Grand Prix",            location:"Miami International Autodrome, Miami",                        country:"United States",        laps:57, length:"5.412", date:"2026-05-03"},
    {name:"Canadian Grand Prix",         location:"Circuit Gilles Villeneuve, Montréal",                         country:"Canada",               laps:70, length:"4.361", date:"2026-06-24"},
    {name:"Monaco Grand Prix",           location:"Circuit de Monaco, Monaco",                                   country:"Monaco",               laps:78, length:"3.337", date:"2026-06-07"},
    {name:"Barcelona-Catalunya Grand Prix",location:"Circuit de Barcelona-Catalunya, Barcelona",                 country:"Spain",                laps:66, length:"4.657", date:"2026-06-14"},
    {name:"Austrian Grand Prix",         location:"Red Bull Ring, Spielberg",                                    country:"Austria",              laps:71, length:"4.318", date:"2026-06-28"},
    {name:"British Grand Prix",          location:"Silverstone Circuit, Silverstone",                            country:"United Kingdom",       laps:52, length:"5.891", date:"2026-07-05"},
    {name:"Belgian Grand Prix",          location:"Circuit de Spa-Francorchamps, Spa-Francorchamps",             country:"Belgium",              laps:44, length:"7.004", date:"2026-07-19"},
    {name:"Hungarian Grand Prix",        location:"Hungaroring, Budapest",                                       country:"Hungary",              laps:70, length:"4.381", date:"2026-07-26"},
    {name:"Dutch Grand Prix",            location:"Circuit Zandvoort, Zandvoort",                                country:"Netherlands",          laps:72, length:"4.259", date:"2026-08-23"},
    {name:"Italian Grand Prix",          location:"Autodromo Nazionale Monza, Monza",                            country:"Italy",                laps:53, length:"5.793", date:"2026-09-06"},
    {name:"Spanish Grand Prix",          location:"Madring, Madrid",                                             country:"Spain",                laps:57, length:"5.416", date:"2026-09-13"},
    {name:"Azerbaijan Grand Prix",       location:"Baku City Circuit, Baku",                                     country:"Azerbaijan",           laps:51, length:"6.003", date:"2026-09-26"},
    {name:"Singapore Grand Prix",        location:"Marina Bay Street Circuit, Marina Bay",                       country:"Singapore",            laps:62, length:"4.940", date:"2026-10-11"},
    {name:"United States Grand Prix",    location:"Circuit of The Americas, Austin",                             country:"United States",        laps:56, length:"5.513", date:"2026-10-25"},
    {name:"Mexico City Grand Prix",      location:"Autódromo Hermanos Rodríguez, Mexico City",                   country:"Mexico",               laps:71, length:"4.304", date:"2026-11-01"},
    {name:"São Paulo Grand Prix",        location:"Autódromo José Carlos Pace, São Paulo",                       country:"Brazil",               laps:71, length:"4.309", date:"2026-11-08"},
    {name:"Las Vegas Grand Prix",        location:"Las Vegas Strip Circuit, Las Vegas",                          country:"United States",        laps:50, length:"6.201", date:"2026-11-21"},
    {name:"Qatar Grand Prix",            location:"Lusail International Circuit, Lusail",                        country:"Qatar",                laps:57, length:"5.419", date:"2026-11-29"},
    {name:"Abu Dhabi Grand Prix",        location:"Yas Marina Circuit, Yas Island",                              country:"United Arab Emirates", laps:58, length:"5.281", date:"2026-12-06"},
  ]
};

const CURRENT_YEAR = 2026;
const TODAY = new Date("2026-07-06T00:00:00");
const MIN_YEAR = 2000;
const POINTS = [25,18,15,12,10,8,6,4,2,1];