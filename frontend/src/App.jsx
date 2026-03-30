import React, { useState, useEffect, useCallback } from "react";

const API_BASE = "https://yahoo-fantasy-tool-production.up.railway.app";

// ─── Inline Styles ────────────────────────────────────────────────────────────

const styles = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0e17 0%, #0d1526 50%, #0a0e17 100%)",
    color: "#e2e8f0",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    padding: "0",
    margin: "0",
  },
  header: {
    background: "rgba(255,255,255,0.03)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: "20px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.5px",
  },
  authBadge: (ok) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
    background: ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
    border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
    color: ok ? "#4ade80" : "#f87171",
    cursor: ok ? "default" : "pointer",
    transition: "all 0.2s",
  }),
  dot: (ok) => ({
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: ok ? "#4ade80" : "#f87171",
    boxShadow: ok ? "0 0 6px #4ade80" : "0 0 6px #f87171",
  }),
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px 20px",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    marginBottom: "24px",
    background: "rgba(255,255,255,0.04)",
    padding: "4px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.07)",
    width: "fit-content",
  },
  tab: (active) => ({
    padding: "8px 18px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
    background: active ? "rgba(59,130,246,0.2)" : "transparent",
    color: active ? "#60a5fa" : "#64748b",
    borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
  }),
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: "16px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontSize: "11px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
  },
  leagueCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    padding: "16px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  leagueCardActive: {
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.3)",
    borderRadius: "12px",
    padding: "16px",
    cursor: "pointer",
  },
  leagueName: {
    fontWeight: "600",
    fontSize: "15px",
    marginBottom: "6px",
    color: "#e2e8f0",
  },
  leagueMeta: {
    fontSize: "12px",
    color: "#64748b",
    display: "flex",
    gap: "12px",
  },
  btn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
    background: "rgba(59,130,246,0.15)",
    color: "#60a5fa",
    border: "1px solid rgba(59,130,246,0.3)",
  },
  btnPrimary: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    color: "#fff",
    transition: "all 0.2s",
    boxShadow: "0 4px 15px rgba(59,130,246,0.3)",
  },
  btnDanger: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(239,68,68,0.3)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    background: "rgba(239,68,68,0.1)",
    color: "#f87171",
    transition: "all 0.2s",
  },
  btnSuccess: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(34,197,94,0.3)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    background: "rgba(34,197,94,0.1)",
    color: "#4ade80",
    transition: "all 0.2s",
  },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#e2e8f0",
    fontSize: "13px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#e2e8f0",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
  },
  playerRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: "6px",
    gap: "12px",
    transition: "all 0.15s",
  },
  playerName: {
    fontWeight: "600",
    fontSize: "14px",
    color: "#e2e8f0",
    flex: 1,
  },
  badge: (color) => ({
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
    background: `rgba(${color},0.15)`,
    color: `rgb(${color})`,
    border: `1px solid rgba(${color},0.25)`,
    whiteSpace: "nowrap",
  }),
  statusBadge: (status) => {
    const map = {
      IR: "239,68,68",
      DTD: "234,179,8",
      O: "239,68,68",
      Q: "234,179,8",
      "": "100,116,139",
    };
    const c = map[status] || "100,116,139";
    return {
      padding: "2px 7px",
      borderRadius: "4px",
      fontSize: "10px",
      fontWeight: "700",
      background: `rgba(${c},0.15)`,
      color: `rgb(${c})`,
      border: `1px solid rgba(${c},0.25)`,
    };
  },
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.1)",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 24px",
    color: "#475569",
  },
  filterRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "16px",
    alignItems: "center",
  },
  toast: (type) => ({
    position: "fixed",
    bottom: "24px",
    right: "24px",
    padding: "12px 20px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "500",
    zIndex: 9999,
    background: type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
    border: `1px solid ${type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
    color: type === "success" ? "#4ade80" : "#f87171",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    maxWidth: "320px",
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function posColor(pos) {
  const map = {
    C: "59,130,246", LW: "139,92,246", RW: "168,85,247",
    D: "34,197,94", G: "234,179,8", W: "139,92,246",
    F: "59,130,246", IR: "239,68,68", BN: "100,116,139",
  };
  return map[pos] || "100,116,139";
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={styles.spinner} />
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div style={styles.toast(type)}>{msg}</div>;
}

function PlayerRow({ player, actions }) {
  return (
    <div style={styles.playerRow}>
      <div style={{ minWidth: "36px", textAlign: "center" }}>
        <span style={styles.badge(posColor(player.position))}>{player.position || "—"}</span>
      </div>
      <div style={styles.playerName}>
        {player.name}
        {player.status && (
          <span style={{ ...styles.statusBadge(player.status), marginLeft: "8px" }}>
            {player.status}
          </span>
        )}
      </div>
      <div style={{ fontSize: "12px", color: "#64748b", minWidth: "32px", textAlign: "center" }}>
        {player.team || "—"}
      </div>
      {player.percentOwned != null && (
        <div style={{ fontSize: "12px", color: "#94a3b8", minWidth: "50px", textAlign: "right" }}>
          {player.percentOwned}%
        </div>
      )}
      {actions}
    </div>
  );
}

// ─── Roster Tab ───────────────────────────────────────────────────────────────

function RosterTab({ leagueKey }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myTeamKey, setMyTeamKey] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!leagueKey) return;
    setLoading(true);
    try {
      const team = await apiFetch(`/api/my-team/${leagueKey}`);
      setMyTeamKey(team.teamKey);
      const players = await apiFetch(`/api/roster/${team.teamKey}`);
      setRoster(players);
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [leagueKey]);

  useEffect(() => { load(); }, [load]);

  const grouped = roster.reduce((acc, p) => {
    const g = p.selectedPosition === "BN" ? "Bench"
      : p.selectedPosition === "IR" ? "Injured Reserve"
      : "Active";
    (acc[g] = acc[g] || []).push(p);
    return acc;
  }, {});

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>My Roster</h2>
        <button style={styles.btn} onClick={load} disabled={loading}>
          {loading ? <Spinner /> : "↻ Refresh"}
        </button>
      </div>
      {!leagueKey && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🏒</div>
          <div>Select a league to view your roster</div>
        </div>
      )}
      {leagueKey && loading && roster.length === 0 && (
        <div style={styles.emptyState}><Spinner /></div>
      )}
      {Object.entries(grouped).map(([group, players]) => (
        <div key={group} style={{ marginBottom: "20px" }}>
          <div style={styles.sectionTitle}>{group} ({players.length})</div>
          {players.map((p) => (
            <PlayerRow key={p.playerKey} player={p} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Free Agents Tab ──────────────────────────────────────────────────────────

function FreeAgentsTab({ leagueKey }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState("");
  const [sort, setSort] = useState("AR");
  const [count, setCount] = useState(25);
  const [toast, setToast] = useState(null);
  const [adding, setAdding] = useState({});

  const search = useCallback(async () => {
    if (!leagueKey) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, count });
      if (position) params.set("position", position);
      const data = await apiFetch(`/api/free-agents/${leagueKey}?${params}`);
      setPlayers(data);
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [leagueKey, position, sort, count]);

  useEffect(() => { search(); }, [search]);

  const addPlayer = async (playerKey) => {
    if (!leagueKey) return;
    setAdding((a) => ({ ...a, [playerKey]: true }));
    try {
      const team = await apiFetch(`/api/my-team/${leagueKey}`);
      await apiFetch(`/api/add-player/${leagueKey}`, {
        method: "POST",
        body: JSON.stringify({ teamKey: team.teamKey, playerKey }),
      });
      setToast({ msg: "Player added to roster!", type: "success" });
      setPlayers((prev) => prev.filter((p) => p.playerKey !== playerKey));
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    } finally {
      setAdding((a) => ({ ...a, [playerKey]: false }));
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Free Agents</h2>
      </div>
      {!leagueKey ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
          <div>Select a league to search free agents</div>
        </div>
      ) : (
        <>
          <div style={styles.filterRow}>
            <select style={styles.select} value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">All Positions</option>
              <option value="C">Center</option>
              <option value="LW">Left Wing</option>
              <option value="RW">Right Wing</option>
              <option value="W">Wing</option>
              <option value="F">Forward</option>
              <option value="D">Defense</option>
              <option value="G">Goalie</option>
            </select>
            <select style={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="AR">Overall Rank</option>
              <option value="PTS">Points</option>
              <option value="G">Goals</option>
              <option value="A">Assists</option>
              <option value="PPP">Power Play Pts</option>
              <option value="SOG">Shots on Goal</option>
              <option value="W">Wins (G)</option>
              <option value="SV">Saves (G)</option>
            </select>
            <select style={styles.select} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              <option value={10}>10 players</option>
              <option value={25}>25 players</option>
              <option value={50}>50 players</option>
            </select>
            <button style={styles.btnPrimary} onClick={search} disabled={loading}>
              {loading ? <Spinner /> : "Search"}
            </button>
          </div>
          {loading && players.length === 0 && (
            <div style={styles.emptyState}><Spinner /></div>
          )}
          {players.map((p) => (
            <PlayerRow
              key={p.playerKey}
              player={p}
              actions={
                <button
                  style={styles.btnSuccess}
                  onClick={() => addPlayer(p.playerKey)}
                  disabled={adding[p.playerKey]}
                >
                  {adding[p.playerKey] ? <Spinner /> : "+ Add"}
                </button>
              }
            />
          ))}
          {!loading && players.length === 0 && (
            <div style={styles.emptyState}>No free agents found</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ leagueKey }) {
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ playerKey: "", dropPlayerKey: "", executeAt: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/scheduled-transactions");
      setScheduled(data);
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const schedule = async () => {
    if (!leagueKey || !form.playerKey || !form.executeAt) {
      setToast({ msg: "League, player key, and time are required", type: "error" });
      return;
    }
    try {
      const team = await apiFetch(`/api/my-team/${leagueKey}`);
      await apiFetch("/api/schedule-transaction", {
        method: "POST",
        body: JSON.stringify({
          leagueKey,
          teamKey: team.teamKey,
          addPlayerKey: form.playerKey,
          dropPlayerKey: form.dropPlayerKey || undefined,
          executeAt: form.executeAt,
        }),
      });
      setToast({ msg: "Transaction scheduled!", type: "success" });
      setForm({ playerKey: "", dropPlayerKey: "", executeAt: "" });
      load();
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    }
  };

  const cancel = async (id) => {
    try {
      await apiFetch(`/api/scheduled-transactions/${id}`, { method: "DELETE" });
      setToast({ msg: "Transaction cancelled", type: "success" });
      load();
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: "600" }}>Scheduled Transactions</h2>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Schedule a Transaction</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Add Player Key *</div>
            <input
              style={styles.input}
              placeholder="e.g. 453.p.7109"
              value={form.playerKey}
              onChange={(e) => setForm((f) => ({ ...f, playerKey: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Drop Player Key</div>
            <input
              style={styles.input}
              placeholder="Optional"
              value={form.dropPlayerKey}
              onChange={(e) => setForm((f) => ({ ...f, dropPlayerKey: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Execute At *</div>
            <input
              style={styles.input}
              type="datetime-local"
              value={form.executeAt}
              onChange={(e) => setForm((f) => ({ ...f, executeAt: e.target.value }))}
            />
          </div>
          <button style={styles.btnPrimary} onClick={schedule}>Schedule</button>
        </div>
      </div>

      {loading && <div style={styles.emptyState}><Spinner /></div>}
      {!loading && scheduled.length === 0 && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📅</div>
          <div>No scheduled transactions</div>
        </div>
      )}
      {scheduled.map((tx) => (
        <div key={tx.id} style={styles.playerRow}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "600", fontSize: "14px" }}>
              + {tx.addPlayerKey}
              {tx.dropPlayerKey && <span style={{ color: "#f87171" }}> / − {tx.dropPlayerKey}</span>}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
              {new Date(tx.executeAt).toLocaleString()} · {tx.status}
            </div>
          </div>
          <button style={styles.btnDanger} onClick={() => cancel(tx.id)}>Cancel</button>
        </div>
      ))}
    </div>
  );
}

// ─── League Selector ──────────────────────────────────────────────────────────

function LeagueSelector({ leagues, selected, onSelect }) {
  if (leagues.length === 0) return null;
  return (
    <div style={{ ...styles.card, marginBottom: "24px" }}>
      <div style={styles.sectionTitle}>Select League</div>
      <div style={styles.grid}>
        {leagues.map((lg) => (
          <div
            key={lg.leagueKey}
            style={selected === lg.leagueKey ? styles.leagueCardActive : styles.leagueCard}
            onClick={() => onSelect(lg.leagueKey)}
          >
            <div style={styles.leagueName}>{lg.name}</div>
            <div style={styles.leagueMeta}>
              <span>{lg.numTeams} teams</span>
              <span>Week {lg.currentWeek}</span>
              <span style={{ textTransform: "capitalize" }}>{lg.scoringType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [leagues, setLeagues] = useState([]);
  const [leagueKey, setLeagueKey] = useState(null);
  const [tab, setTab] = useState("roster");
  const [toast, setToast] = useState(null);

  // Check auth status on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await apiFetch("/auth/status");
        setAuthed(status.authenticated && !status.expired);
        if (status.authenticated && !status.expired) {
          const data = await apiFetch("/api/leagues");
          setLeagues(data);
          if (data.length > 0) setLeagueKey(data[0].leagueKey);
        }
      } catch (e) {
        console.error("Auth check failed:", e.message);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const handleLogin = () => {
    window.open(`${API_BASE}/auth/login`, "_blank", "width=600,height=700");
    // Poll for auth completion
    const poll = setInterval(async () => {
      try {
        const status = await apiFetch("/auth/status");
        if (status.authenticated && !status.expired) {
          clearInterval(poll);
          setAuthed(true);
          const data = await apiFetch("/api/leagues");
          setLeagues(data);
          if (data.length > 0) setLeagueKey(data[0].leagueKey);
          setToast({ msg: "Connected to Yahoo Fantasy!", type: "success" });
        }
      } catch {}
    }, 2000);
    setTimeout(() => clearInterval(poll), 120000);
  };

  const TABS = [
    { id: "roster", label: "🏒 My Roster" },
    { id: "freeagents", label: "🔍 Free Agents" },
    { id: "transactions", label: "📅 Transactions" },
  ];

  return (
    <div style={styles.app}>
      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:hover { opacity: 0.85; }
        a { color: #60a5fa; }
      `}</style>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>⛸ Early Bird Fantasy</div>
        {authLoading ? (
          <Spinner />
        ) : (
          <div
            style={styles.authBadge(authed)}
            onClick={authed ? undefined : handleLogin}
            title={authed ? "Connected to Yahoo" : "Click to connect Yahoo account"}
          >
            <span style={styles.dot(authed)} />
            {authed ? "Yahoo Connected" : "Connect Yahoo"}
          </div>
        )}
      </header>

      <main style={styles.main}>
        {!authed && !authLoading && (
          <div style={{ ...styles.card, textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏒</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "22px" }}>Early Bird Fantasy</h2>
            <p style={{ color: "#64748b", marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
              Connect your Yahoo Fantasy account to manage your roster, search free agents, and schedule transactions.
            </p>
            <button style={styles.btnPrimary} onClick={handleLogin}>
              Connect Yahoo Fantasy
            </button>
          </div>
        )}

        {authed && (
          <>
            <LeagueSelector leagues={leagues} selected={leagueKey} onSelect={setLeagueKey} />

            <div style={styles.tabs}>
              {TABS.map((t) => (
                <button key={t.id} style={styles.tab(tab === t.id)} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={styles.card}>
              {tab === "roster" && <RosterTab leagueKey={leagueKey} />}
              {tab === "freeagents" && <FreeAgentsTab leagueKey={leagueKey} />}
              {tab === "transactions" && <TransactionsTab leagueKey={leagueKey} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
