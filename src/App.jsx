import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, onSnapshot
} from "firebase/firestore";

// ── Constants ──────────────────────────────────────────────
const MEDALS = [
  { rank: 1, label: "Emas",     emoji: "🥇", color: "#FFD700", bg: "#3d2e00" },
  { rank: 2, label: "Perak",    emoji: "🥈", color: "#C0C0C0", bg: "#2a2a2a" },
  { rank: 3, label: "Perunggu", emoji: "🥉", color: "#CD7F32", bg: "#2d1a00" },
];

const SPORTS = [
  { id: "sepakbola",  label: "Sepak Bola",  emoji: "⚽" },
  { id: "voli",       label: "Voli",         emoji: "🏐" },
  { id: "basket",     label: "Basket",       emoji: "🏀" },
  { id: "badminton",  label: "Badminton",    emoji: "🏸" },
  { id: "tenis_meja", label: "Tenis Meja",   emoji: "🏓" },
  { id: "lari",       label: "Lari",         emoji: "🏃" },
  { id: "renang",     label: "Renang",       emoji: "🏊" },
  { id: "lainnya",    label: "Lainnya",      emoji: "🎽" },
];

const DEFAULT_TEAMS = [
  { id: 1, name: "Elang Biru",    points: 0, wins: 0, losses: 0 },
  { id: 2, name: "Harimau Merah", points: 0, wins: 0, losses: 0 },
  { id: 3, name: "Naga Hijau",    points: 0, wins: 0, losses: 0 },
  { id: 4, name: "Singa Putih",   points: 0, wins: 0, losses: 0 },
  { id: 5, name: "Macan Tutul",   points: 0, wins: 0, losses: 0 },
  { id: 6, name: "Badak Hitam",   points: 0, wins: 0, losses: 0 },
];

const makeMatches = (teams) => {
  const t = teams.slice(0, 6);
  const grpA = t.slice(0, 3), grpB = t.slice(3, 6);
  const matches = []; let id = 1;
  for (let i = 0; i < grpA.length; i++)
    for (let j = i + 1; j < grpA.length; j++)
      matches.push({ id: id++, phase: "Grup A", teamA: grpA[i].id, teamB: grpA[j].id, scoreA: null, scoreB: null, done: false });
  for (let i = 0; i < grpB.length; i++)
    for (let j = i + 1; j < grpB.length; j++)
      matches.push({ id: id++, phase: "Grup B", teamA: grpB[i].id, teamB: grpB[j].id, scoreA: null, scoreB: null, done: false });
  matches.push({ id: id++, phase: "Semifinal",     teamA: null, teamB: null, scoreA: null, scoreB: null, done: false, note: "Juara Grup A vs Runner-up Grup B" });
  matches.push({ id: id++, phase: "Semifinal",     teamA: null, teamB: null, scoreA: null, scoreB: null, done: false, note: "Juara Grup B vs Runner-up Grup A" });
  matches.push({ id: id++, phase: "Final 🏆",      teamA: null, teamB: null, scoreA: null, scoreB: null, done: false, note: "Pemenang SF1 vs Pemenang SF2" });
  matches.push({ id: id++, phase: "Perebutan 🥉",  teamA: null, teamB: null, scoreA: null, scoreB: null, done: false, note: "Kalah SF1 vs Kalah SF2" });
  return matches;
};

// ── Firebase helpers ────────────────────────────────────────
const DOC_ID = "tournament_state";

async function saveState(state) {
  try {
    await setDoc(doc(db, "arena_juara", DOC_ID), state);
  } catch (e) {
    console.error("Gagal simpan:", e);
  }
}

// ── Main App ────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [tab, setTab]                 = useState("bracket");
  const [sportScreen, setSportScreen] = useState(true);
  const [selectedSport, setSelectedSport] = useState(null);
  const [classInput, setClassInput]   = useState("");
  const [className, setClassName]     = useState("");
  const [teams, setTeams]             = useState(DEFAULT_TEAMS);
  const [matches, setMatches]         = useState(makeMatches(DEFAULT_TEAMS));
  const [celebration, setCelebration] = useState(false);
  const [editMatch, setEditMatch]     = useState(null);
  const [scoreInput, setScoreInput]   = useState({ a: "", b: "" });
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Load & subscribe from Firestore ──
  useEffect(() => {
    const ref = doc(db, "arena_juara", DOC_ID);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.className)     setClassName(d.className);
        if (d.selectedSport) setSelectedSport(d.selectedSport);
        if (d.teams)         setTeams(d.teams);
        if (d.matches)       setMatches(d.matches);
        if (d.celebration)   setCelebration(d.celebration);
        if (d.className && d.selectedSport) setSportScreen(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Save helper ──
  const persist = async (patch) => {
    setSaving(true);
    const next = {
      className, selectedSport, teams, matches, celebration,
      ...patch,
    };
    await saveState(next);
    setSaving(false);
  };

  // ── Handlers ──
  const startTournament = async () => {
    if (!selectedSport || !classInput.trim()) return;
    const cn = classInput.trim();
    setClassName(cn);
    setSportScreen(false);
    await persist({ className: cn, selectedSport, teams, matches, celebration: false });
  };

  const submitScore = async (matchId) => {
    const sA = parseInt(scoreInput.a), sB = parseInt(scoreInput.b);
    if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0) return;

    const match = matches.find((m) => m.id === matchId);
    const newMatches = matches.map((m) =>
      m.id !== matchId ? m : { ...m, scoreA: sA, scoreB: sB, done: true }
    );

    let newTeams = teams;
    let newCelebration = celebration;
    if (match?.teamA && match?.teamB) {
      newTeams = teams.map((t) => {
        if (t.id === match.teamA) return { ...t, points: t.points + (sA > sB ? 3 : sA === sB ? 1 : 0), wins: t.wins + (sA > sB ? 1 : 0), losses: t.losses + (sA < sB ? 1 : 0) };
        if (t.id === match.teamB) return { ...t, points: t.points + (sB > sA ? 3 : sA === sB ? 1 : 0), wins: t.wins + (sB > sA ? 1 : 0), losses: t.losses + (sB < sA ? 1 : 0) };
        return t;
      });
      if (match.phase === "Final 🏆") newCelebration = true;
    }

    setMatches(newMatches);
    setTeams(newTeams);
    setCelebration(newCelebration);
    setEditMatch(null);
    setScoreInput({ a: "", b: "" });
    await persist({ matches: newMatches, teams: newTeams, celebration: newCelebration });
  };

  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    const updated = [...teams, { id: Date.now(), name: newTeamName.trim(), points: 0, wins: 0, losses: 0 }];
    const newMatches = makeMatches(updated);
    setTeams(updated); setMatches(newMatches); setNewTeamName("");
    await persist({ teams: updated, matches: newMatches });
  };

  const saveEditTeam = async (id) => {
    if (!editTeamName.trim()) return;
    const updated = teams.map((t) => t.id === id ? { ...t, name: editTeamName.trim() } : t);
    setTeams(updated); setEditingTeam(null); setEditTeamName("");
    await persist({ teams: updated });
  };

  const deleteTeam = async (id) => {
    const updated = teams.filter((t) => t.id !== id);
    const newMatches = makeMatches(updated);
    setTeams(updated); setMatches(newMatches); setConfirmDelete(null);
    await persist({ teams: updated, matches: newMatches });
  };

  const resetAll = async () => {
    const freshTeams   = DEFAULT_TEAMS;
    const freshMatches = makeMatches(DEFAULT_TEAMS);
    setTeams(freshTeams); setMatches(freshMatches);
    setCelebration(false); setSportScreen(true);
    setClassName(""); setClassInput(""); setSelectedSport(null);
    await saveState({ className: "", selectedSport: null, teams: freshTeams, matches: freshMatches, celebration: false });
  };

  // ── Derived ──
  const getTeam    = (id) => teams.find((t) => t.id === id);
  const getRanking = () => [...teams].sort((a, b) => b.points - a.points || b.wins - a.wins);
  const phases     = [...new Set(matches.map((m) => m.phase))];
  const groupMatches = (phase) => matches.filter((m) => m.phase === phase);
  const getMedal   = (idx) => MEDALS[idx] || null;
  const sport      = SPORTS.find((s) => s.id === selectedSport);
  const canStart   = selectedSport && classInput.trim();

  const S = { // shared inline styles
    card: { background: "#0e1e38", border: "1px solid #1e3560", borderRadius: 12, padding: "14px 18px", marginBottom: 10 },
    label: { fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: "#FFD700", marginBottom: 10, fontWeight: 700 },
  };

  // ── Loading Screen ──
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0a0f1e,#0d1f3c)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Trebuchet MS',sans-serif", color: "#e8f0ff" }}>
      <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>⚡</div>
      <div style={{ color: "#7090c0", fontSize: 14 }}>Memuat data dari Firebase...</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Setup Screen ──
  if (sportScreen) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0a0f1e,#0d1f3c,#091428)", fontFamily: "'Trebuchet MS',sans-serif", color: "#e8f0ff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 11, letterSpacing: 5, color: "#FFD700", textTransform: "uppercase", marginBottom: 8 }}>MTs Sports Tournament</div>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 4px", textAlign: "center" }}>⚡ ARENA JUARA ⚡</h1>
      <p style={{ color: "#7090c0", fontSize: 13, marginBottom: 28, textAlign: "center" }}>Turnamen Olahraga Akhir Semester</p>

      {/* Nama Kelas */}
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 24 }}>
        <div style={S.label}>📋 Nama Kelas</div>
        <input placeholder="Contoh: VIII-A, IX Maju, 7B..." value={classInput}
          onChange={(e) => setClassInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canStart && startTournament()}
          style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `2px solid ${classInput.trim() ? "#FFD700" : "#1e3560"}`, background: "#0e1e38", color: "#fff", fontSize: 15, fontWeight: 700, boxSizing: "border-box", outline: "none", transition: "border-color 0.2s" }} />
      </div>

      {/* Pilih Cabang */}
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 28 }}>
        <div style={S.label}>🏅 Cabang Olahraga</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {SPORTS.map((s) => (
            <button key={s.id} onClick={() => setSelectedSport(s.id)} style={{ background: selectedSport === s.id ? "#1a3a6a" : "#0e1e38", border: `2px solid ${selectedSport === s.id ? "#FFD700" : "#1e3560"}`, borderRadius: 12, padding: "12px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, transition: "all 0.2s" }}>
              <span style={{ fontSize: 24 }}>{s.emoji}</span>
              <span style={{ fontSize: 10, color: selectedSport === s.id ? "#FFD700" : "#a0c0e0", fontWeight: 700, textAlign: "center" }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={startTournament} style={{ background: canStart ? "#FFD700" : "#1a2a3a", color: canStart ? "#000" : "#445", border: "none", borderRadius: 12, padding: "14px 44px", fontWeight: 900, fontSize: 16, cursor: canStart ? "pointer" : "not-allowed", boxShadow: canStart ? "0 4px 24px rgba(255,215,0,0.4)" : "none", transition: "all 0.2s" }}>
        {canStart ? `Mulai Turnamen ${sport?.emoji}` : "Isi nama kelas & pilih cabang dulu..."}
      </button>
    </div>
  );

  // ── Main App ──
  const tabs = [
    { id: "bracket", label: "🗂 Bagan" },
    { id: "score",   label: `${sport?.emoji} Input Skor` },
    { id: "ranking", label: "🏅 Peringkat" },
    { id: "teams",   label: "👥 Tim" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0a0f1e,#0d1f3c,#091428)", fontFamily: "'Trebuchet MS',sans-serif", color: "#e8f0ff", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(90deg,#003580,#0057cc)", padding: "16px 24px 14px", textAlign: "center", borderBottom: "3px solid #FFD700", boxShadow: "0 4px 30px rgba(0,80,200,0.4)" }}>
        <div style={{ fontSize: 11, color: "#a0c4ff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>Turnamen Akhir Semester</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff" }}>⚡ ARENA JUARA ⚡</h1>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ background: "#FFD700", color: "#000", borderRadius: 20, padding: "3px 14px", fontWeight: 900, fontSize: 13 }}>🏫 Kelas {className}</span>
          <span style={{ background: "#1a3a6a", color: "#7ab0ff", borderRadius: 20, padding: "3px 14px", fontWeight: 700, fontSize: 13, border: "1px solid #2a5090" }}>{sport?.emoji} {sport?.label}</span>
          {saving && <span style={{ background: "#1a2a1a", color: "#4a8", borderRadius: 20, padding: "3px 14px", fontSize: 12, border: "1px solid #2a5a2a" }}>💾 Menyimpan...</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <button onClick={() => { setSportScreen(true); }} style={{ background: "transparent", border: "1px solid #2a5090", borderRadius: 6, color: "#7090c0", fontSize: 11, padding: "3px 10px", cursor: "pointer" }}>✏️ Ubah Kelas / Cabang</button>
          <button onClick={resetAll} style={{ background: "transparent", border: "1px solid #5a2020", borderRadius: 6, color: "#f08080", fontSize: 11, padding: "3px 10px", cursor: "pointer" }}>🔄 Reset Turnamen</button>
        </div>
      </div>

      {celebration && (
        <div style={{ background: "linear-gradient(90deg,#FFD700,#FFA500,#FFD700)", color: "#000", textAlign: "center", padding: "13px", fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>
          🏆 JUARA KELAS {className.toUpperCase()} TELAH DITENTUKAN! CEK PERINGKAT! 🏆
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 16px 0", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: tab === t.id ? "#FFD700" : "#132040", color: tab === t.id ? "#000" : "#7090c0", boxShadow: tab === t.id ? "0 4px 16px rgba(255,215,0,0.35)" : "none", transition: "all 0.2s" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 0" }}>

        {/* ── BAGAN ── */}
        {tab === "bracket" && phases.map((phase) => (
          <div key={phase} style={{ marginBottom: 24 }}>
            <div style={S.label}>{phase}</div>
            {groupMatches(phase).map((m) => {
              const tA = m.teamA ? getTeam(m.teamA) : null;
              const tB = m.teamB ? getTeam(m.teamB) : null;
              const wA = m.done && m.scoreA > m.scoreB, wB = m.done && m.scoreB > m.scoreA;
              return (
                <div key={m.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, textAlign: "right", fontWeight: wA ? 900 : 500, color: wA ? "#FFD700" : tA ? "#fff" : "#445", fontSize: 15 }}>{tA ? tA.name : (m.note ? "—" : "TBD")}</div>
                  <div style={{ minWidth: 80, textAlign: "center", background: m.done ? "#0a2a0a" : "#111d30", borderRadius: 8, padding: "8px 12px", border: `1px solid ${m.done ? "#2a6a2a" : "#1e3560"}` }}>
                    {m.done ? <span style={{ fontSize: 20, fontWeight: 900 }}>{m.scoreA}<span style={{ color: "#445" }}> : </span>{m.scoreB}</span> : <span style={{ fontSize: 12, color: "#445" }}>VS</span>}
                  </div>
                  <div style={{ flex: 1, fontWeight: wB ? 900 : 500, color: wB ? "#FFD700" : tB ? "#fff" : "#445", fontSize: 15 }}>{tB ? tB.name : (m.note ? "—" : "TBD")}</div>
                  <div style={{ fontSize: 11, background: m.done ? "#1a3a1a" : "#1a2a3a", color: m.done ? "#4a8" : "#445", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>{m.done ? "Selesai" : "Menunggu"}</div>
                </div>
              );
            })}
          </div>
        ))}

        {/* ── INPUT SKOR ── */}
        {tab === "score" && (
          <div>
            <p style={{ color: "#7090c0", fontSize: 13, marginBottom: 16 }}>Input skor {sport?.label} {sport?.emoji} — Kelas {className}. Data otomatis tersimpan ke Firebase ☁️</p>
            {phases.map((phase) => (
              <div key={phase} style={{ marginBottom: 24 }}>
                <div style={S.label}>{phase}</div>
                {groupMatches(phase).map((m) => {
                  const tA = m.teamA ? getTeam(m.teamA) : null;
                  const tB = m.teamB ? getTeam(m.teamB) : null;
                  const isEditing = editMatch === m.id;
                  if (!tA || !tB) return (
                    <div key={m.id} style={{ background: "#0b1828", border: "1px solid #1a2e50", borderRadius: 10, padding: "12px 16px", marginBottom: 8, color: "#445", fontSize: 13 }}>
                      {m.note || "Menunggu babak sebelumnya..."}
                    </div>
                  );
                  return (
                    <div key={m.id} style={{ ...S.card, background: m.done ? "#0a1e0a" : "#0e1e38", borderColor: m.done ? "#1e4a1e" : "#1e3560" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{tA.name}</div>
                        <div style={{ color: "#445", fontWeight: 900 }}>VS</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{tB.name}</div>
                      </div>
                      {m.done ? (
                        <div style={{ textAlign: "center", marginTop: 10 }}>
                          <span style={{ fontSize: 22, fontWeight: 900, color: "#FFD700" }}>{m.scoreA} : {m.scoreB}</span>
                          <span style={{ marginLeft: 10, fontSize: 11, color: "#4a8", background: "#1a3a1a", borderRadius: 6, padding: "2px 8px" }}>✓ Selesai</span>
                        </div>
                      ) : isEditing ? (
                        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                          <input type="number" min="0" placeholder="0" value={scoreInput.a} onChange={(e) => setScoreInput((s) => ({ ...s, a: e.target.value }))} style={{ width: 60, padding: 8, textAlign: "center", fontSize: 18, fontWeight: 900, borderRadius: 8, border: "2px solid #FFD700", background: "#0a1428", color: "#fff" }} />
                          <span style={{ color: "#445", fontWeight: 900, fontSize: 20 }}>:</span>
                          <input type="number" min="0" placeholder="0" value={scoreInput.b} onChange={(e) => setScoreInput((s) => ({ ...s, b: e.target.value }))} style={{ width: 60, padding: 8, textAlign: "center", fontSize: 18, fontWeight: 900, borderRadius: 8, border: "2px solid #FFD700", background: "#0a1428", color: "#fff" }} />
                          <button onClick={() => submitScore(m.id)} style={{ background: "#FFD700", color: "#000", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 900, cursor: "pointer", fontSize: 13 }}>Simpan ✓</button>
                          <button onClick={() => setEditMatch(null)} style={{ background: "#1a2a3a", color: "#7090c0", border: "none", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", marginTop: 10 }}>
                          <button onClick={() => { setEditMatch(m.id); setScoreInput({ a: "", b: "" }); }} style={{ background: "#1a3a6a", color: "#7ab0ff", border: "1px solid #2a5090", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Input Skor</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── PERINGKAT ── */}
        {tab === "ranking" && (
          <div>
            <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>🏫</span>
              <div>
                <div style={{ fontWeight: 900, color: "#FFD700", fontSize: 15 }}>Kelas {className}</div>
                <div style={{ fontSize: 12, color: "#7090c0" }}>{sport?.emoji} {sport?.label} · Turnamen Akhir Semester</div>
              </div>
            </div>
            {getRanking().map((team, idx) => {
              const medal = getMedal(idx);
              return (
                <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 14, background: medal ? medal.bg : "#0b1828", border: `1px solid ${medal ? medal.color + "55" : "#1a2e50"}`, borderRadius: 14, padding: "16px 20px", marginBottom: 10, boxShadow: idx === 0 && team.points > 0 ? "0 0 24px rgba(255,215,0,0.25)" : "none" }}>
                  <div style={{ fontSize: idx < 3 ? 32 : 20, minWidth: 40, textAlign: "center" }}>{medal ? medal.emoji : `#${idx + 1}`}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: medal ? medal.color : "#fff" }}>{team.name}</div>
                    <div style={{ fontSize: 12, color: "#7090c0", marginTop: 2 }}>{team.wins}M · {team.losses}K · {team.points} poin</div>
                  </div>
                  {medal && <div style={{ background: medal.color, color: "#000", fontWeight: 900, fontSize: 11, borderRadius: 8, padding: "4px 10px" }}>{medal.label.toUpperCase()}</div>}
                  {idx === 0 && team.points > 0 && <div style={{ fontSize: 22 }}>🏆</div>}
                </div>
              );
            })}
            <div style={{ background: "#0b1828", border: "1px solid #1a2e50", borderRadius: 10, padding: "10px 16px", marginTop: 4, fontSize: 12, color: "#445", textAlign: "center" }}>
              M = Menang · K = Kalah · Poin: Menang 3 · Seri 1 · Kalah 0
            </div>
          </div>
        )}

        {/* ── TIM ── */}
        {tab === "teams" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input placeholder="Nama tim baru..." value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTeam()} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #1e3560", background: "#0b1828", color: "#fff", fontSize: 14 }} />
              <button onClick={addTeam} style={{ background: "#FFD700", color: "#000", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 900, cursor: "pointer", fontSize: 14 }}>+ Tambah</button>
            </div>
            {teams.map((team, idx) => (
              <div key={team.id} style={S.card}>
                {editingTeam === team.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input autoFocus value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEditTeam(team.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "2px solid #FFD700", background: "#0a1428", color: "#fff", fontSize: 14 }} />
                    <button onClick={() => saveEditTeam(team.id)} style={{ background: "#FFD700", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 900, cursor: "pointer" }}>Simpan</button>
                    <button onClick={() => setEditingTeam(null)} style={{ background: "#1a2a3a", color: "#7090c0", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>✕</button>
                  </div>
                ) : confirmDelete === team.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, color: "#f08080", fontSize: 13 }}>Hapus <strong>{team.name}</strong>?</span>
                    <button onClick={() => deleteTeam(team.id)} style={{ background: "#8b0000", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer" }}>Ya, Hapus</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: "#1a2a3a", color: "#7090c0", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>Batal</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `hsl(${idx * 55},70%,35%)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff", flexShrink: 0 }}>{team.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{team.name}</div>
                      <div style={{ fontSize: 12, color: "#7090c0" }}>{team.wins}M · {team.losses}K · {team.points} poin</div>
                    </div>
                    <button onClick={() => { setEditingTeam(team.id); setEditTeamName(team.name); }} style={{ background: "#1a3a6a", color: "#7ab0ff", border: "1px solid #2a5090", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Edit</button>
                    <button onClick={() => setConfirmDelete(team.id)} style={{ background: "#2a1010", color: "#f08080", border: "1px solid #5a2020", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🗑 Hapus</button>
                  </div>
                )}
              </div>
            ))}
            <p style={{ color: "#445", fontSize: 12, textAlign: "center", marginTop: 8 }}>*Mengubah tim akan mereset bagan pertandingan</p>
          </div>
        )}
      </div>
      <style>{`button:hover{filter:brightness(1.15)} input:focus{outline:2px solid #FFD700;outline-offset:0}`}</style>
    </div>
  );
}
