/**
 * EARLY BIRD FANTASY - Enhanced Yahoo Fantasy API Server
 * ======================================================
 * 
 * Full Yahoo Fantasy Sports API integration with:
 * - OAuth 2.0 authentication flow
 * - Live free agent search with position/stat filters
 * - Roster management (your team + league rosters)
 * - Player stats and ownership data
 * - Schedule-aware recommendations
 * - Transaction scheduling with cron execution
 * 
 * SETUP:
 * 1. Register app at https://developer.yahoo.com/apps/
 *    - API Permissions: "Fantasy Sports" (read/write)
 *    - Redirect URI: http://localhost:3001/auth/callback
 * 
 * 2. Create .env:
 *    YAHOO_CLIENT_ID=your_client_id
 *    YAHOO_CLIENT_SECRET=your_client_secret
 *    YAHOO_REDIRECT_URI=http://localhost:3001/auth/callback
 *    PORT=3001
 * 
 * 3. npm install express axios dotenv node-cron cors
 * 4. node server.js
 * 5. Visit http://localhost:3001/auth/login
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

// ============================================================
// CONFIG & STATE
// ============================================================

const CONFIG = {
  clientId: process.env.YAHOO_CLIENT_ID,
  clientSecret: process.env.YAHOO_CLIENT_SECRET,
  redirectUri: process.env.YAHOO_REDIRECT_URI || "http://localhost:3001/auth/callback",
  port: process.env.PORT || 3001,
  apiBase: "https://fantasysports.yahooapis.com/fantasy/v2",
  authUrl: "https://api.login.yahoo.com/oauth2/request_auth",
  tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
  // NHL game key changes each season - update accordingly
  // 2024-25: 453, 2025-26: likely 460+ (check Yahoo docs)
  gameKey: "nhl",
};

console.log("YAHOO_REDIRECT_URI:", process.env.YAHOO_REDIRECT_URI);
console.log("Using redirectUri:", CONFIG.redirectUri);

let authTokens = null;
const TOKEN_FILE = path.join(__dirname, ".tokens.json");
const SCHEDULE_FILE = path.join(__dirname, "scheduled_transactions.json");
let scheduledTransactions = [];

// Persist tokens across restarts
function saveTokens() {
  if (authTokens) fs.writeFileSync(TOKEN_FILE, JSON.stringify(authTokens));
}
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      authTokens = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      console.log("🔑 Loaded saved tokens");
    }
  } catch (e) { /* first run */ }
}
function loadSchedule() {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      scheduledTransactions = JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf8"));
    }
  } catch (e) { /* first run */ }
}
function saveSchedule() {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduledTransactions, null, 2));
}

// ============================================================
// OAUTH 2.0
// ============================================================

app.get("/auth/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    response_type: "code",
    language: "en-us",
  });
  res.redirect(`${CONFIG.authUrl}?${params}`);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "No code" });

  try {
    const { data } = await axios.post(CONFIG.tokenUrl, new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CONFIG.redirectUri,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
    }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

    authTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      guid: data.xoauth_yahoo_guid,
    };
    saveTokens();
    console.log("✅ Authenticated with Yahoo");

    // Redirect to frontend after auth
    res.send(`
      <html><body style="background:#0a0e17;color:#e2e8f0;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="text-align:center">
          <div style="font-size:48px;margin-bottom:16px">✅</div>
          <h2>Connected to Yahoo Fantasy!</h2>
          <p style="color:#64748b">You can close this window and return to the app.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    console.error("Auth error:", err.response?.data || err.message);
    res.status(500).json({ error: "Auth failed", details: err.response?.data });
  }
});

app.get("/auth/status", (req, res) => {
  res.json({
    authenticated: !!authTokens,
    expiresAt: authTokens?.expiresAt,
    expired: authTokens ? Date.now() >= authTokens.expiresAt : true,
  });
});

async function refreshToken() {
  if (!authTokens?.refreshToken) throw new Error("No refresh token");
  const { data } = await axios.post(CONFIG.tokenUrl, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: authTokens.refreshToken,
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
  }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

  authTokens.accessToken = data.access_token;
  authTokens.refreshToken = data.refresh_token;
  authTokens.expiresAt = Date.now() + data.expires_in * 1000;
  saveTokens();
  return authTokens.accessToken;
}

async function getToken() {
  if (!authTokens) throw new Error("Not authenticated. Visit /auth/login");
  if (Date.now() >= authTokens.expiresAt - 60000) return refreshToken();
  return authTokens.accessToken;
}

// ============================================================
// YAHOO API HELPERS
// ============================================================

/**
 * Generic Yahoo Fantasy API request
 * Yahoo returns deeply nested JSON — this handles the common patterns
 */
async function yahooGet(endpoint) {
  const token = await getToken();
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${CONFIG.apiBase}${endpoint}${sep}format=json`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function yahooPost(endpoint, xmlBody) {
  const token = await getToken();
  const { data } = await axios.post(`${CONFIG.apiBase}${endpoint}`, xmlBody, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/xml",
    },
  });
  return data;
}

/**
 * Yahoo nests player data in absurd ways. This normalizes it.
 */
function parsePlayer(rawPlayer) {
  if (!rawPlayer) return null;
  try {
    // player[0] is always an array of player attributes
    const attrs = Array.isArray(rawPlayer[0]) ? rawPlayer[0] : [];
    const obj = {};

    for (const item of attrs) {
      if (!item || typeof item !== "object") continue;
      // Each item is like { player_key: "453.p.7109" } or { name: { full: "...", ... } }
      const keys = Object.keys(item);
      for (const key of keys) {
        obj[key] = item[key];
      }
    }

    // Extract ownership if present (player[1] sometimes has it)
    let ownership = null;
    if (rawPlayer[1]?.ownership) {
      ownership = rawPlayer[1].ownership;
    }

    // Extract stats if present
    let stats = null;
    if (rawPlayer[1]?.player_stats) {
      stats = rawPlayer[1].player_stats;
    } else if (rawPlayer[2]?.player_stats) {
      stats = rawPlayer[2].player_stats;
    }

    // Extract percent_owned from various locations
    let pctOwned = null;
    if (rawPlayer[1]?.percent_owned) {
      pctOwned = rawPlayer[1].percent_owned;
    }
    for (const item of attrs) {
      if (item?.percent_owned) {
        pctOwned = item.percent_owned;
      }
    }

    return {
      playerKey: obj.player_key || "",
      playerId: obj.player_id || "",
      name: obj.name?.full || obj.name?.last || "Unknown",
      firstName: obj.name?.first || "",
      lastName: obj.name?.last || "",
      team: obj.editorial_team_abbr || obj.team_abbr || "",
      teamFull: obj.editorial_team_full_name || "",
      position: obj.display_position || obj.primary_position || "",
      positionType: obj.position_type || "",
      status: obj.status || "",
      statusFull: obj.status_full || "",
      injuryNote: obj.injury_note || "",
      imageUrl: obj.image_url || obj.headshot?.url || "",
      uniformNumber: obj.uniform_number || "",
      percentOwned: pctOwned?.value || pctOwned?.coverage_value || null,
      percentOwnedChange: pctOwned?.delta || null,
      ownership,
      stats,
    };
  } catch (e) {
    console.error("Parse error:", e.message);
    return null;
  }
}

/**
 * Parse a collection of players from Yahoo's nested response
 */
function parsePlayers(data) {
  try {
    // Navigate Yahoo's nesting: fantasy_content.league[1].players
    const league = data?.fantasy_content?.league;
    if (!league) return [];

    // league can be an array [meta, {players}] or object
    let playersObj;
    if (Array.isArray(league)) {
      playersObj = league[1]?.players;
    } else {
      playersObj = league.players;
    }
    if (!playersObj) return [];

    const result = [];
    const count = playersObj.count || 0;

    for (let i = 0; i < count; i++) {
      const raw = playersObj[String(i)]?.player;
      if (raw) {
        const parsed = parsePlayer(raw);
        if (parsed) result.push(parsed);
      }
    }
    return result;
  } catch (e) {
    console.error("parsePlayers error:", e.message);
    return [];
  }
}

/**
 * Parse roster players (slightly different structure)
 */
function parseRoster(data) {
  try {
    const team = data?.fantasy_content?.team;
    if (!team) return [];

    let roster;
    if (Array.isArray(team)) {
      roster = team[1]?.roster;
    } else {
      roster = team.roster;
    }
    if (!roster) return [];

    const players = roster["0"]?.players || roster.players;
    if (!players) return [];

    const result = [];
    const count = players.count || 0;

    for (let i = 0; i < count; i++) {
      const raw = players[String(i)]?.player;
      if (raw) {
        const parsed = parsePlayer(raw);
        if (parsed) {
          // Get selected position from roster
          const selPos = raw[1]?.selected_position;
          parsed.selectedPosition = selPos?.[1]?.position || selPos?.position || "";
          result.push(parsed);
        }
      }
    }
    return result;
  } catch (e) {
    console.error("parseRoster error:", e.message);
    return [];
  }
}

// ============================================================
// API ENDPOINTS — LEAGUES & TEAMS
// ============================================================

/**
 * GET /api/leagues
 * Returns all NHL fantasy leagues for the authenticated user
 */
app.get("/api/leagues", async (req, res) => {
  try {
    const data = await yahooGet(`/users;use_login=1/games;game_keys=${CONFIG.gameKey}/leagues`);

    // Parse the nested league data
    const games = data?.fantasy_content?.users?.[0]?.user?.[1]?.games;
    if (!games) return res.json([]);

    const leagues = [];
    const gameCount = games.count || 0;

    for (let g = 0; g < gameCount; g++) {
      const game = games[String(g)]?.game;
      if (!game) continue;

      const leaguesObj = Array.isArray(game) ? game[1]?.leagues : game.leagues;
      if (!leaguesObj) continue;

      const leagueCount = leaguesObj.count || 0;
      for (let l = 0; l < leagueCount; l++) {
        const lg = leaguesObj[String(l)]?.league;
        if (!lg) continue;

        const meta = Array.isArray(lg) ? lg[0] : lg;
        leagues.push({
          leagueKey: meta.league_key,
          leagueId: meta.league_id,
          name: meta.name,
          numTeams: meta.num_teams,
          currentWeek: meta.current_week,
          startWeek: meta.start_week,
          endWeek: meta.end_week,
          scoringType: meta.scoring_type,
          url: meta.url,
        });
      }
    }

    res.json(leagues);
  } catch (err) {
    console.error("GET /api/leagues error:", err.response?.data || err.message);
    res.status(err.message.includes("Not authenticated") ? 401 : 500)
       .json({ error: err.message });
  }
});

/**
 * GET /api/teams/:leagueKey
 * Returns all teams in a league
 */
app.get("/api/teams/:leagueKey", async (req, res) => {
  try {
    const data = await yahooGet(`/league/${req.params.leagueKey}/teams`);
    const league = data?.fantasy_content?.league;
    const teamsObj = Array.isArray(league) ? league[1]?.teams : league?.teams;
    if (!teamsObj) return res.json([]);

    const teams = [];
    for (let i = 0; i < (teamsObj.count || 0); i++) {
      const t = teamsObj[String(i)]?.team;
      if (!t) continue;
      const meta = Array.isArray(t) ? t[0] : t;
      // meta is itself an array of attribute objects
      const obj = {};
      if (Array.isArray(meta)) {
        for (const item of meta) {
          if (item && typeof item === "object") Object.assign(obj, item);
        }
      }
      teams.push({
        teamKey: obj.team_key,
        teamId: obj.team_id,
        name: obj.name,
        managerNickname: obj.managers?.[0]?.manager?.nickname || "",
        logoUrl: obj.team_logos?.[0]?.team_logo?.url || "",
        waiverPriority: obj.waiver_priority,
        numberOfMoves: obj.number_of_moves,
        numberOfTrades: obj.number_of_trades,
        isMyTeam: !!obj.is_owned_by_current_login,
      });
    }
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/my-team/:leagueKey
 * Returns the authenticated user's team key in a given league
 */
app.get("/api/my-team/:leagueKey", async (req, res) => {
  try {
    const data = await yahooGet(`/league/${req.params.leagueKey}/teams`);
    const league = data?.fantasy_content?.league;
    const teamsObj = Array.isArray(league) ? league[1]?.teams : league?.teams;

    for (let i = 0; i < (teamsObj?.count || 0); i++) {
      const t = teamsObj[String(i)]?.team;
      if (!t) continue;
      const meta = Array.isArray(t) ? t[0] : t;
      const attrs = Array.isArray(meta) ? meta : [meta];
      for (const item of attrs) {
        if (item?.is_owned_by_current_login) {
          const obj = {};
          for (const a of attrs) {
            if (a && typeof a === "object") Object.assign(obj, a);
          }
          return res.json({
            teamKey: obj.team_key,
            name: obj.name,
          });
        }
      }
    }
    res.status(404).json({ error: "Your team not found in this league" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API ENDPOINTS — ROSTER
// ============================================================

/**
 * GET /api/roster/:teamKey
 * Returns full roster for a team with player details
 */
app.get("/api/roster/:teamKey", async (req, res) => {
  try {
    const { week } = req.query;
    let endpoint = `/team/${req.params.teamKey}/roster/players`;
    if (week) endpoint += `;week=${week}`;
    const data = await yahooGet(endpoint);
    const players = parseRoster(data);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API ENDPOINTS — FREE AGENT SEARCH (THE MAIN EVENT)
// ============================================================

/**
 * GET /api/free-agents/:leagueKey
 * 
 * Search for available free agents with extensive filtering.
 * This is the core endpoint that powers the player search UI.
 * 
 * Query params:
 *   search    - Player name search (e.g., "kyrou")
 *   position  - Position filter: C, LW, RW, D, G
 *   status    - A (all free agents), W (waivers), FA (free agents only)
 *   sort      - Sort by stat: AR (actual rank), OR (overall rank), 
 *               PTS, G, A, SOG, PPP, HIT, BLK, +/-, W, SV, GAA, SV%
 *   sortType  - "season" or "lastweek" or "lastmonth"
 *   sortOrder - 1 (desc, default) or 0 (asc)
 *   count     - Results per page (max 50, default 25)
 *   start     - Pagination offset
 * 
 * Response includes:
 *   - Player identity (name, team, position, headshot)
 *   - Ownership % and trend
 *   - Injury/status info
 *   - Week 23 schedule data for the player's team
 */
app.get("/api/free-agents/:leagueKey", async (req, res) => {
  try {
    const {
      search,
      position,
      status = "A",        // A = available, W = waivers, FA = free agents
      sort = "AR",         // AR = actual rank (Yahoo's default sort)
      sortType = "season",
      sortOrder = "1",
      count = "25",
      start = "0",
    } = req.query;

    // Build the Yahoo API endpoint with all filters
    let endpoint = `/league/${req.params.leagueKey}/players;status=${status}`;
    endpoint += `;count=${Math.min(parseInt(count), 50)}`;
    endpoint += `;start=${start}`;

    // Sort parameter - Yahoo uses stat_id numbers for sorting
    // Common stat IDs for NHL:
    // 1=GP, 2=G, 3=A, 4=PTS, 5=+/-, 6=PIM, 8=PPG, 9=PPA, 10=PPP,
    // 12=SHG, 14=GWG, 16=SOG, 18=FW, 31=HIT, 32=BLK
    // Goalie: 19=W, 22=GA, 23=GAA, 24=SA, 25=SV, 26=SV%
    const SORT_MAP = {
      AR: "AR",
      OR: "OR", 
      PTS: "S;type=season;stat_id=4",
      G: "S;type=season;stat_id=2",
      A: "S;type=season;stat_id=3",
      SOG: "S;type=season;stat_id=16",
      PPP: "S;type=season;stat_id=10",
      HIT: "S;type=season;stat_id=31",
      BLK: "S;type=season;stat_id=32",
      "+/-": "S;type=season;stat_id=5",
      PIM: "S;type=season;stat_id=6",
      W: "S;type=season;stat_id=19",
      SV: "S;type=season;stat_id=25",
      GAA: "S;type=season;stat_id=23",
      "SV%": "S;type=season;stat_id=26",
    };

    if (sort && SORT_MAP[sort]) {
      let sortParam = SORT_MAP[sort];
      // Override type if specified
      if (sortType && sortParam.startsWith("S;")) {
        sortParam = sortParam.replace(/type=\w+/, `type=${sortType}`);
      }
      endpoint += `;sort=${sortParam}`;
    }
    if (sortOrder === "0") endpoint += `;sort_order=asc`;

    if (search) endpoint += `;search=${encodeURIComponent(search)}`;
    if (position) endpoint += `;position=${position}`;

    // Request with percent_owned subresource for ownership data
    endpoint += `/percent_owned`;

    const data = await yahooGet(endpoint);
    const players = parsePlayers(data);

    res.json({
      players,
      count: players.length,
      total: data?.fantasy_content?.league?.[1]?.players?.count || players.length,
      query: { search, position, status, sort, sortType, count, start },
    });
  } catch (err) {
    console.error("Free agent search error:", err.response?.data || err.message);
    res.status(err.message.includes("Not authenticated") ? 401 : 500)
       .json({ error: err.message, details: err.response?.data });
  }
});

/**
 * GET /api/player-stats/:leagueKey/:playerKey
 * 
 * Get detailed season stats for a specific player.
 * Useful for the player detail panel / comparison view.
 */
app.get("/api/player-stats/:leagueKey/:playerKey", async (req, res) => {
  try {
    const { timeframe } = req.query; // "season", "lastweek", "lastmonth"
    let endpoint = `/league/${req.params.leagueKey}/players;player_keys=${req.params.playerKey}/stats`;
    if (timeframe) endpoint += `;type=${timeframe}`;

    const data = await yahooGet(endpoint);
    const players = parsePlayers(data);
    res.json(players[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/player-ownership/:leagueKey/:playerKey
 * 
 * Get ownership details including which team owns a player
 */
app.get("/api/player-ownership/:leagueKey/:playerKey", async (req, res) => {
  try {
    const endpoint = `/league/${req.params.leagueKey}/players;player_keys=${req.params.playerKey}/ownership`;
    const data = await yahooGet(endpoint);
    const players = parsePlayers(data);
    res.json(players[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/trending/:gameKey
 * 
 * Get trending players (most added/dropped in the last day/week)
 * Great for seeing what the field is doing
 */
app.get("/api/trending", async (req, res) => {
  try {
    const { type = "add", count = "15" } = req.query;
    const endpoint = `/game/${CONFIG.gameKey}/players;sort=ownership;sort_type=date;sort_season=2026;count=${count}`;
    const data = await yahooGet(endpoint);
    // Trending endpoint has different structure
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/all-taken/:leagueKey
 * 
 * Get all rostered players in the league.
 * Cross-reference to know exactly who's available vs taken.
 * This is expensive — cache results for 15+ minutes.
 */
let rosterCache = { data: null, timestamp: 0 };

app.get("/api/all-taken/:leagueKey", async (req, res) => {
  try {
    // Cache for 15 minutes
    if (rosterCache.data && Date.now() - rosterCache.timestamp < 900000) {
      return res.json(rosterCache.data);
    }

    // Get all teams first
    const teamsData = await yahooGet(`/league/${req.params.leagueKey}/teams`);
    const league = teamsData?.fantasy_content?.league;
    const teamsObj = Array.isArray(league) ? league[1]?.teams : league?.teams;
    const teamKeys = [];

    for (let i = 0; i < (teamsObj?.count || 0); i++) {
      const t = teamsObj[String(i)]?.team;
      if (!t) continue;
      const meta = Array.isArray(t) ? t[0] : t;
      if (Array.isArray(meta)) {
        for (const item of meta) {
          if (item?.team_key) teamKeys.push(item.team_key);
        }
      }
    }

    // Fetch each team's roster
    const allPlayers = {};
    for (const tk of teamKeys) {
      try {
        const rData = await yahooGet(`/team/${tk}/roster/players`);
        const players = parseRoster(rData);
        for (const p of players) {
          allPlayers[p.playerKey] = {
            ...p,
            ownedByTeamKey: tk,
          };
        }
        // Respect Yahoo rate limits
        await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        console.warn(`Failed to fetch roster for ${tk}:`, e.message);
      }
    }

    rosterCache = { data: allPlayers, timestamp: Date.now() };
    res.json(allPlayers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TRANSACTIONS
// ============================================================

/**
 * POST /api/add-drop
 * Execute an add/drop transaction immediately
 */
app.post("/api/add-drop", async (req, res) => {
  const { leagueKey, teamKey, addPlayerKey, dropPlayerKey } = req.body;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fantasy_content>
  <transaction>
    <type>add/drop</type>
    <players>
      <player>
        <player_key>${addPlayerKey}</player_key>
        <transaction_data>
          <type>add</type>
          <destination_team_key>${teamKey}</destination_team_key>
        </transaction_data>
      </player>
      <player>
        <player_key>${dropPlayerKey}</player_key>
        <transaction_data>
          <type>drop</type>
          <source_team_key>${teamKey}</source_team_key>
        </transaction_data>
      </player>
    </players>
  </transaction>
</fantasy_content>`;

  try {
    const result = await yahooPost(`/league/${leagueKey}/transactions`, xml);
    res.json({ success: true, result });
  } catch (err) {
    console.error("Add/drop error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Transaction failed",
      details: err.response?.data || err.message,
    });
  }
});

/**
 * POST /api/add-only
 * Add a free agent (when you have an open roster spot)
 */
app.post("/api/add-only", async (req, res) => {
  const { leagueKey, teamKey, addPlayerKey } = req.body;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fantasy_content>
  <transaction>
    <type>add</type>
    <player>
      <player_key>${addPlayerKey}</player_key>
      <transaction_data>
        <type>add</type>
        <destination_team_key>${teamKey}</destination_team_key>
      </transaction_data>
    </player>
  </transaction>
</fantasy_content>`;

  try {
    const result = await yahooPost(`/league/${leagueKey}/transactions`, xml);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

/**
 * POST /api/drop-only
 * Drop a player to free agency
 */
app.post("/api/drop-only", async (req, res) => {
  const { leagueKey, teamKey, dropPlayerKey } = req.body;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fantasy_content>
  <transaction>
    <type>drop</type>
    <player>
      <player_key>${dropPlayerKey}</player_key>
      <transaction_data>
        <type>drop</type>
        <source_team_key>${teamKey}</source_team_key>
      </transaction_data>
    </player>
  </transaction>
</fantasy_content>`;

  try {
    const result = await yahooPost(`/league/${leagueKey}/transactions`, xml);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

/**
 * POST /api/waiver-claim
 * Place a waiver claim (add/drop with waiver priority)
 */
app.post("/api/waiver-claim", async (req, res) => {
  const { leagueKey, teamKey, addPlayerKey, dropPlayerKey, faabBid } = req.body;

  let playersXml = `
      <player>
        <player_key>${addPlayerKey}</player_key>
        <transaction_data>
          <type>add</type>
          <destination_team_key>${teamKey}</destination_team_key>
        </transaction_data>
      </player>`;

  if (dropPlayerKey) {
    playersXml += `
      <player>
        <player_key>${dropPlayerKey}</player_key>
        <transaction_data>
          <type>drop</type>
          <source_team_key>${teamKey}</source_team_key>
        </transaction_data>
      </player>`;
  }

  let faabXml = "";
  if (faabBid !== undefined) {
    faabXml = `<faab_bid>${faabBid}</faab_bid>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fantasy_content>
  <transaction>
    <type>${dropPlayerKey ? "add/drop" : "add"}</type>
    ${faabXml}
    <players>${playersXml}
    </players>
  </transaction>
</fantasy_content>`;

  try {
    const result = await yahooPost(`/league/${leagueKey}/transactions`, xml);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// ============================================================
// SCHEDULED TRANSACTIONS (CRON)
// ============================================================

app.post("/api/schedule", (req, res) => {
  const { leagueKey, teamKey, addPlayer, dropPlayer, executeAt, note, conditionalCheck } = req.body;

  const tx = {
    id: Date.now().toString(),
    leagueKey,
    teamKey,
    addPlayer,
    dropPlayer,
    executeAt: new Date(executeAt).toISOString(),
    note: note || "",
    // Optional: only execute if player is still available
    conditionalCheck: conditionalCheck !== false,
    status: "scheduled",
    createdAt: new Date().toISOString(),
    retryCount: 0,
    result: null,
    error: null,
  };

  scheduledTransactions.push(tx);
  saveSchedule();
  console.log(`📅 Scheduled: ${tx.dropPlayer?.name} → ${tx.addPlayer?.name} at ${tx.executeAt}`);
  res.json({ success: true, transaction: tx });
});

app.get("/api/schedule", (req, res) => {
  res.json(scheduledTransactions);
});

app.delete("/api/schedule/:id", (req, res) => {
  scheduledTransactions = scheduledTransactions.filter(t => t.id !== req.params.id);
  saveSchedule();
  res.json({ success: true });
});

// Cron: check every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  const now = new Date();
  const pending = scheduledTransactions.filter(
    t => t.status === "scheduled" && new Date(t.executeAt) <= now
  );

  for (const tx of pending) {
    tx.status = "executing";
    console.log(`⚡ Executing: ${tx.dropPlayer?.name} → ${tx.addPlayer?.name}`);

    try {
      // Optional: verify the player is still a free agent before executing
      if (tx.conditionalCheck && tx.addPlayer?.playerKey) {
        try {
          const checkEndpoint = `/league/${tx.leagueKey}/players;player_keys=${tx.addPlayer.playerKey}/ownership`;
          const checkData = await yahooGet(checkEndpoint);
          // If player is owned, skip
          const players = parsePlayers(checkData);
          if (players[0]?.ownership?.ownership_type === "team") {
            tx.status = "failed";
            tx.error = `${tx.addPlayer.name} is no longer available (owned by another team)`;
            tx.executedAt = new Date().toISOString();
            console.log(`⚠️ Skipped: ${tx.addPlayer.name} already owned`);
            saveSchedule();
            continue;
          }
        } catch (e) {
          // If check fails, proceed anyway
          console.warn("Ownership check failed, proceeding:", e.message);
        }
      }

      // Build XML
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fantasy_content>
  <transaction>
    <type>add/drop</type>
    <players>
      <player>
        <player_key>${tx.addPlayer.playerKey}</player_key>
        <transaction_data>
          <type>add</type>
          <destination_team_key>${tx.teamKey}</destination_team_key>
        </transaction_data>
      </player>
      <player>
        <player_key>${tx.dropPlayer.playerKey}</player_key>
        <transaction_data>
          <type>drop</type>
          <source_team_key>${tx.teamKey}</source_team_key>
        </transaction_data>
      </player>
    </players>
  </transaction>
</fantasy_content>`;

      const result = await yahooPost(`/league/${tx.leagueKey}/transactions`, xml);
      tx.status = "completed";
      tx.result = result;
      tx.executedAt = new Date().toISOString();
      console.log(`✅ Done: ${tx.dropPlayer.name} → ${tx.addPlayer.name}`);

    } catch (err) {
      tx.retryCount++;
      if (tx.retryCount <= 3) {
        tx.status = "scheduled";
        tx.executeAt = new Date(Date.now() + 120000).toISOString();
        tx.error = err.response?.data || err.message;
        console.log(`🔄 Retry ${tx.retryCount}/3 for ${tx.addPlayer.name}`);
      } else {
        tx.status = "failed";
        tx.error = err.response?.data || err.message;
        tx.executedAt = new Date().toISOString();
        console.error(`❌ Failed permanently: ${tx.addPlayer.name}`, tx.error);
      }
    }

    saveSchedule();
  }
});

// ============================================================
// YOUTUBE AUDIO URL EXTRACTOR
// ============================================================

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Use locally downloaded yt-dlp binary (installed via postinstall script)
const YTDLP_PATH = path.join(__dirname, 'bin', 'yt-dlp');

app.post('/api/youtube-audio-url', async (req, res) => {
  const cookieFile = path.join('/tmp', `yt-cookies-${Date.now()}.txt`);
  const audioFile = path.join('/tmp', `yt-audio-${Date.now()}.mp4`);
  try {
    const { videoUrl, assemblyaiKey } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl is required' });
    if (!assemblyaiKey) return res.status(400).json({ error: 'assemblyaiKey is required' });

    // Write YouTube cookies from env var to temp file
    let cookieFlag = '';
    if (process.env.YOUTUBE_COOKIES) {
      fs.writeFileSync(cookieFile, process.env.YOUTUBE_COOKIES);
      cookieFlag = `--cookies "${cookieFile}"`;
    }

    // Step 1: Download audio to local temp file
    console.log(`⬇️ Downloading audio for: ${videoUrl}`);
    await execAsync(
      `"${YTDLP_PATH}" -f "bestaudio[ext=m4a]/bestaudio" --js-runtimes "node:$(which node)" ${cookieFlag} -o "${audioFile}" "${videoUrl}"`,
      { timeout: 120000 }
    );

    // Step 2: Upload to AssemblyAI
    console.log(`⬆️ Uploading audio to AssemblyAI...`);
    const fileBuffer = fs.readFileSync(audioFile);
    const uploadResp = await axios.post('https://api.assemblyai.com/v2/upload', fileBuffer, {
      headers: {
        'Authorization': assemblyaiKey,
        'Content-Type': 'application/octet-stream',
        'Transfer-Encoding': 'chunked',
      },
      maxBodyLength: Infinity,
    });

    const uploadUrl = uploadResp.data.upload_url;
    console.log(`✅ Uploaded to AssemblyAI: ${uploadUrl}`);
    res.json({ audioUrl: uploadUrl });

  } catch (err) {
    console.error('YouTube audio URL error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (fs.existsSync(cookieFile)) fs.unlinkSync(cookieFile);
    if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
  }
});


// ============================================================
// STATUS & HEALTH
// ============================================================

app.get("/api/status", (req, res) => {
  res.json({
    server: "Early Bird Fantasy v2.0",
    authenticated: !!authTokens,
    tokenExpires: authTokens?.expiresAt ? new Date(authTokens.expiresAt).toISOString() : null,
    scheduled: scheduledTransactions.filter(t => t.status === "scheduled").length,
    completed: scheduledTransactions.filter(t => t.status === "completed").length,
    failed: scheduledTransactions.filter(t => t.status === "failed").length,
    rosterCacheAge: rosterCache.timestamp
      ? `${Math.round((Date.now() - rosterCache.timestamp) / 60000)}m ago`
      : "empty",
  });
});

// ============================================================
// START
// ============================================================

loadTokens();
loadSchedule();

app.listen(CONFIG.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           EARLY BIRD FANTASY v2.0                     ║
║           Yahoo Fantasy Transaction Scheduler         ║
╠═══════════════════════════════════════════════════════╣
║  Server:     http://localhost:${CONFIG.port}                    ║
║  Auth:       http://localhost:${CONFIG.port}/auth/login          ║
║  Status:     http://localhost:${CONFIG.port}/api/status          ║
╠═══════════════════════════════════════════════════════╣
║  Endpoints:                                           ║
║    GET  /api/leagues              Your leagues        ║
║    GET  /api/teams/:leagueKey     League teams        ║
║    GET  /api/roster/:teamKey      Team roster         ║
║    GET  /api/free-agents/:lk      Search free agents  ║
║    GET  /api/player-stats/:lk/:pk Player details      ║
║    GET  /api/all-taken/:lk        All rostered        ║
║    POST /api/add-drop             Execute add/drop    ║
║    POST /api/waiver-claim         Waiver claim        ║
║    POST /api/schedule             Schedule future tx  ║
║    GET  /api/schedule             View scheduled      ║
║    DEL  /api/schedule/:id         Cancel scheduled    ║
╠═══════════════════════════════════════════════════════╣
║  Scheduler:  Polling every 30 seconds                 ║
║  Pending:    ${String(scheduledTransactions.filter(t => t.status === "scheduled").length).padEnd(40)}║
║  Auth:       ${(authTokens ? "✅ Connected" : "❌ Not connected — visit /auth/login").padEnd(40)}║
╚═══════════════════════════════════════════════════════╝
  `);
});
