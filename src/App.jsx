import { useState, useRef, useEffect } from "react";
import { db } from "./firebaseConfig";
import { ref, set, get, update, onValue, off, remove } from "firebase/database";

const JOKER = { id: "JOKER", label: "🃏", name: "ジョーカー", rank: 3 };
const ACE   = { id: "ACE",   label: "A",  name: "エース",     rank: 2 };
const KING  = { id: "KING",  label: "K",  name: "キング",     rank: 1 };
const DECK  = [JOKER, ACE, KING];
const INIT_CHIPS = 1000;
const ANTE = 50;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function aiAction(card, pot, toCall, aiChips, round) {
  const r = card.rank;
  if (r === 3) {
    const amt = Math.min(Math.max(toCall * 2, Math.floor(pot * 0.5)), aiChips);
    return { type: "raise", amt };
  }
  if (r === 2) {
    const pressure = toCall > 0 ? toCall / Math.max(pot, 1) : 0;
    const foldChance = toCall > 0 ? Math.min(0.55, pressure * 0.5 + (round >= 3 ? 0.15 : 0)) : 0;
    if (toCall > 0 && Math.random() < foldChance) return { type: "fold" };
    if (round === 1) {
      if (Math.random() < 0.6) {
        const amt = Math.min(toCall + Math.floor(pot * 0.25) + 20, aiChips);
        return { type: "raise", amt };
      }
      return toCall > 0 ? { type: "call" } : { type: "check" };
    }
    return toCall > 0 ? { type: "call" } : { type: "check" };
  }
  if (toCall > 0) {
    if (Math.random() < 0.35) {
      const amt = Math.min(toCall + Math.floor(pot * 0.4) + 30, aiChips);
      return { type: "raise", amt };
    }
    return { type: "fold" };
  }
  if (Math.random() < 0.3) {
    const amt = Math.min(Math.floor(pot * 0.4) + 30, aiChips);
    return { type: "raise", amt };
  }
  return { type: "check" };
}

// ── ローカルストレージ ────────────────────────────────
function loadProfile(mode) {
  try {
    const key = mode === "ai" ? "jak_ai" : "jak_online";
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function saveProfile(mode, name, chips) {
  try {
    const key = mode === "ai" ? "jak_ai" : "jak_online";
    localStorage.setItem(key, JSON.stringify({ name, chips }));
  } catch {}
}

// ── Card ─────────────────────────────────────────────
function Card({ card, hidden, size, winner }) {
  const isWide = typeof window !== "undefined" && window.innerWidth >= 600;
  const w  = size === "lg" ? (isWide ? 120 : 88)  : size === "sm" ? (isWide ? 60 : 44)  : (isWide ? 96 : 70);
  const h  = size === "lg" ? (isWide ? 168 : 124) : size === "sm" ? (isWide ? 84 : 62)  : (isWide ? 134 : 98);
  const fs = size === "lg" ? (isWide ? 46 : 34)   : size === "sm" ? (isWide ? 22 : 16)  : (isWide ? 34 : 25);
  const cs = size === "lg" ? (isWide ? 54 : 40)   : size === "sm" ? (isWide ? 24 : 18)  : (isWide ? 40 : 30);

  if (hidden) return (
    <div style={{
      width: w, height: h, borderRadius: 8, flexShrink: 0,
      background: "linear-gradient(135deg,#1a1040,#2d1b69,#1a1040)",
      border: "2px solid #5a3fa0",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 16px rgba(90,63,160,0.4)",
    }}>
      <span style={{ color: "#ffffff22", fontSize: fs * 0.8 }}>✦</span>
    </div>
  );

  const isJ = card.id === "JOKER";
  const isA = card.id === "ACE";
  const isK = card.id === "KING";
  const bg   = isJ ? "linear-gradient(160deg,#1a0800,#3a1200)" : "#fff9f2";
  const bc   = isJ ? "#ff6b35" : "#bbb";
  const glow = isJ ? "rgba(255,107,53,.7)" : isA ? "rgba(180,0,0,.5)" : "rgba(30,30,30,.4)";
  const tc   = isJ ? "#ff9955" : isA ? "#cc0000" : "#111";

  return (
    <div style={{
      width: w, height: h, borderRadius: 8, flexShrink: 0,
      background: bg, border: `2px solid ${bc}`,
      display: "flex", flexDirection: "column", alignItems: "stretch",
      boxShadow: winner ? `0 0 28px ${glow},0 4px 16px #0006` : "0 4px 16px #0005",
      transform: winner ? "scale(1.07)" : "scale(1)",
      transition: "transform .3s, box-shadow .3s",
      position: "relative", overflow: "hidden",
    }}>
      {isJ && <>
        <div style={{ position: "absolute", top: 3, left: 5, lineHeight: 1.1 }}>
          <div style={{ fontSize: fs * 0.44, fontWeight: 900, color: "#cc4400", fontFamily: "Georgia,serif" }}>J</div>
          <div style={{ fontSize: fs * 0.3, color: "#cc4400", textAlign: "center" }}>★</div>
        </div>
        <div style={{ position: "absolute", bottom: 3, right: 5, lineHeight: 1.1, transform: "rotate(180deg)" }}>
          <div style={{ fontSize: fs * 0.44, fontWeight: 900, color: "#cc4400", fontFamily: "Georgia,serif" }}>J</div>
          <div style={{ fontSize: fs * 0.3, color: "#cc4400", textAlign: "center" }}>★</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={w * 0.86} height={h * 0.84} viewBox="0 0 60 90">
            <path d="M14,30 Q8,12 17,4 Q22,16 30,20 Q38,16 43,4 Q52,12 46,30Z" fill="#cc3300"/>
            <path d="M22,16 Q30,22 38,16 Q35,24 30,26 Q25,24 22,16Z" fill="#ff4400" opacity=".6"/>
            <circle cx="17" cy="4"  r="3.5" fill="#FFD700" stroke="#b8860b" strokeWidth=".8"/>
            <circle cx="43" cy="4"  r="3.5" fill="#FFD700" stroke="#b8860b" strokeWidth=".8"/>
            <rect x="9" y="28" width="42" height="5" rx="2.5" fill="#aa2200"/>
            <rect x="27" y="60" width="6" height="7" rx="2" fill="#f0c87a"/>
            <path d="M10,90 Q10,68 18,62 Q30,57 42,62 Q50,68 50,90Z" fill="#cc3300"/>
            <path d="M18,62 Q30,70 42,62 Q38,78 30,80 Q22,78 18,62Z" fill="#ff4400" opacity=".6"/>
            <polygon points="30,68 34,73 30,78 26,73" fill="#FFD700" opacity=".8"/>
            <ellipse cx="30" cy="47" rx="19" ry="19" fill="#f5e6c0" stroke="#d4a000" strokeWidth="1.2"/>
            <ellipse cx="22" cy="44" rx="4" ry="4.5" fill="#fff" stroke="#444" strokeWidth="1"/>
            <ellipse cx="38" cy="44" rx="4" ry="4.5" fill="#fff" stroke="#444" strokeWidth="1"/>
            <circle cx="23" cy="45" r="2.5" fill="#1a0a00"/>
            <circle cx="39" cy="45" r="2.5" fill="#1a0a00"/>
            <circle cx="24" cy="43.5" r=".9" fill="#fff"/>
            <circle cx="40" cy="43.5" r=".9" fill="#fff"/>
            <path d="M17 37 Q22 33 27 37" fill="none" stroke="#553300" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M33 36 Q38 32 43 36" fill="none" stroke="#553300" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="30" cy="50" r="3.5" fill="#ff4444"/>
            <path d="M20 57 Q30 64 40 57" fill="#cc1100"/>
            <path d="M20 57 Q30 63 40 57 Q35 61 30 62 Q25 61 20 57Z" fill="#ee2200"/>
          </svg>
        </div>
      </>}
      {isA && <>
        <div style={{ position: "absolute", top: 3, left: 5, lineHeight: 1.1 }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>A</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♥</div>
        </div>
        <div style={{ position: "absolute", bottom: 3, right: 5, lineHeight: 1.1, transform: "rotate(180deg)" }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>A</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♥</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: cs * 1.15, color: tc, fontFamily: "serif", lineHeight: 1 }}>♥</span>
        </div>
      </>}
      {isK && <>
        <div style={{ position: "absolute", top: 3, left: 5, lineHeight: 1.1 }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>K</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♠</div>
        </div>
        <div style={{ position: "absolute", bottom: 3, right: 5, lineHeight: 1.1, transform: "rotate(180deg)" }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>K</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♠</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={w * 0.82} height={h * 0.78} viewBox="0 0 80 110">
            <path d="M10 110 Q10 70 20 62 Q40 56 60 62 Q70 70 70 110Z" fill="#8B0000"/>
            <path d="M20 62 Q40 68 60 62 Q55 80 40 82 Q25 80 20 62Z" fill="#a00000"/>
            <path d="M28 64 Q40 70 52 64 Q48 75 40 76 Q32 75 28 64Z" fill="#f0e8d0" stroke="#ccc" strokeWidth=".5"/>
            <rect x="34" y="50" width="12" height="14" rx="4" fill="#f0c87a"/>
            <ellipse cx="40" cy="36" rx="19" ry="22" fill="#f5d090" stroke="#c8a060" strokeWidth="1"/>
            <polygon points="21,18 21,6 30,13 40,2 50,13 59,6 59,18" fill="#DAA520" stroke="#b8860b" strokeWidth="1"/>
            <circle cx="21" cy="6"  r="3"   fill="#ff4444"/>
            <circle cx="40" cy="2"  r="3.5" fill="#4444ff"/>
            <circle cx="59" cy="6"  r="3"   fill="#44cc44"/>
            <rect x="19" y="17" width="42" height="5" rx="2" fill="#DAA520" stroke="#b8860b" strokeWidth=".8"/>
            <path d="M25 26 Q31 22 37 26" fill="none" stroke="#5a3a10" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M43 26 Q49 22 55 26" fill="none" stroke="#5a3a10" strokeWidth="2.5" strokeLinecap="round"/>
            <ellipse cx="31" cy="31" rx="4.5" ry="4" fill="#fff" stroke="#888" strokeWidth=".8"/>
            <ellipse cx="49" cy="31" rx="4.5" ry="4" fill="#fff" stroke="#888" strokeWidth=".8"/>
            <circle cx="31" cy="31.5" r="2.8" fill="#1a0a00"/>
            <circle cx="49" cy="31.5" r="2.8" fill="#1a0a00"/>
            <circle cx="32" cy="30"   r="1"   fill="#ffffff88"/>
            <circle cx="50" cy="30"   r="1"   fill="#ffffff88"/>
            <path d="M38 35 Q36 40 38 42 Q40 43 42 42 Q44 40 42 35" fill="#e0a870" stroke="#c8956a" strokeWidth=".5"/>
            <path d="M29 48 Q40 50 51 48" fill="none" stroke="#8B4513" strokeWidth="2" strokeLinecap="round"/>
            <path d="M26 52 Q33 57 40 55 Q47 57 54 52" fill="#6b4226"/>
            <path d="M24 54 Q32 60 40 58 Q48 60 56 54 Q48 62 40 61 Q32 62 24 54Z" fill="#5a3520"/>
            <line x1="62" y1="58" x2="72" y2="20" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"/>
            <rect x="58" y="54" width="10" height="3" rx="1" fill="#DAA520"/>
            <ellipse cx="63" cy="60" rx="3" ry="4" fill="#DAA520"/>
          </svg>
        </div>
      </>}
    </div>
  );
}

function Chips({ label, val, gold, diff }) {
  const isWide = typeof window !== "undefined" && window.innerWidth >= 600;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: isWide ? "8px 16px" : "5px 10px", borderRadius: 9, minWidth: isWide ? 90 : 66,
      background: gold ? "rgba(201,168,76,.14)" : "rgba(255,255,255,.05)",
      border: `1px solid ${gold ? "rgba(201,168,76,.4)" : "rgba(255,255,255,.1)"}`,
    }}>
      <div style={{ fontSize: isWide ? 11 : 9, color: "#9080b8", letterSpacing: 1, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: isWide ? 20 : 16, fontWeight: 700, color: gold ? "#ffe08a" : "#ddd0f0", fontFamily: "monospace" }}>
        {(val ?? 0).toLocaleString()}
      </div>
      {diff !== undefined && diff !== 0 && (
        <div style={{ fontSize: 10, fontWeight: 700, color: diff > 0 ? "#7dde8a" : "#ff7878", fontFamily: "monospace", animation: "pop .4s ease" }}>
          {diff > 0 ? `+${diff}` : `${diff}`}
        </div>
      )}
    </div>
  );
}

function Log({ entries }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entries]);
  return (
    <div ref={ref} style={{
      height: typeof window !== "undefined" && window.innerWidth >= 600 ? 100 : 72, overflowY: "auto", padding: "6px 10px",
      background: "rgba(0,0,0,.3)", borderRadius: 8,
      border: "1px solid rgba(255,255,255,.07)",
    }}>
      {entries.map((e, i) => (
        <div key={i} style={{
          fontSize: 11, lineHeight: 1.5,
          color: e.t === "w" ? "#7dde8a" : e.t === "l" ? "#ff7878" : e.t === "i" ? "#ffe08a" : "#b8a8d0",
        }}>{e.msg}</div>
      ))}
    </div>
  );
}

const S = {
  root:  { minHeight: "100vh", background: "#080514", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden", fontFamily: "sans-serif" },
  bg:    { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 25%,#180d38,#080514 68%)" },
  center:{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 },
  play:  { position: "relative", zIndex: 1, width: "100%", maxWidth: 640, padding: "12px 20px", boxSizing: "border-box" },
  area:  { display: "flex", flexDirection: "column", alignItems: "center", padding: 8, borderRadius: 10, marginBottom: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" },
  aLabel:{ fontSize: 9, color: "#7060a0", letterSpacing: 1, marginBottom: 5 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 11, color: "#9080b8", letterSpacing: 1 },
  input: { background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: "10px 12px", color: "#e8dff0", fontSize: 15, outline: "none" },
  gold:  { background: "linear-gradient(135deg,#c9a84c,#ffe08a)", color: "#1a0e00", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 18px rgba(201,168,76,.4)" },
  blue:  { background: "rgba(60,80,180,.3)", color: "#b0c0f0", border: "1px solid rgba(60,80,180,.55)", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  red:   { background: "rgba(160,40,40,.3)", color: "#ff9090", border: "1px solid rgba(160,40,40,.55)", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghost: { background: "transparent", color: "#7060a0", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer" },
};

// ══════════════════════════════════════════════
// AI対戦
// ══════════════════════════════════════════════
function AIGame({ onBack }) {
  const profile = loadProfile("ai");
  const [pChips, setPChips]   = useState(profile?.chips >= INIT_CHIPS ? profile.chips : INIT_CHIPS);
  const [aChips, setAChips]   = useState(INIT_CHIPS);
  const [pot, setPot]         = useState(0);
  const [pCard, setPCard]     = useState(null);
  const [aCard, setACard]     = useState(null);
  const [hCard, setHCard]     = useState(null);
  const [toCall, setToCall]   = useState(0);
  const [slider, setSlider]   = useState(100);
  const [log, setLog]         = useState([]);
  const [stage, setStage]     = useState("bet");
  const [showAI, setShowAI]   = useState(false);
  const [result, setResult]   = useState(null);
  const [rnd, setRnd]         = useState(1);
  const [busy, setBusy]       = useState(false);
  const [playerFirst, setPlayerFirst] = useState(true);
  const [isGameOver, setIsGameOver]   = useState(false);
  const [overMsg, setOverMsg]         = useState("");
  const [roundStartChips, setRoundStartChips] = useState(pChips);
  const [chipDiff, setChipDiff]       = useState(0);
  const [playerName]                  = useState(loadProfile("ai")?.name || "あなた");

  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { pChips, aChips, pot, pCard, aCard, toCall, playerFirst, roundStartChips };
  });

  function addLog(msg, t = "n") {
    setLog(prev => [...prev.slice(-40), { msg, t }]);
  }

  const [started, setStarted] = useState(false);
  useEffect(() => { if (!started) { setStarted(true); startGame(); } }, []);

  function startGame() {
    const saved = loadProfile("ai")?.chips ?? INIT_CHIPS;
    const pc = saved >= INIT_CHIPS ? saved : INIT_CHIPS;
    setPChips(pc); setAChips(INIT_CHIPS);
    setLog([]); setRnd(1); setChipDiff(0);
    const first = Math.random() < 0.5;
    setPlayerFirst(first);
    dealRound(pc, INIT_CHIPS, 1, first);
  }

  function dealRound(pc, ac, r, first) {
    const [c0, c1, c2] = shuffle(DECK);
    const pAnte = Math.min(ANTE, pc);
    const aAnte = Math.min(ANTE, ac);
    const newPot = pAnte + aAnte;
    const newPC = pc - pAnte;
    const newAC = ac - aAnte;
    setPCard(c0); setACard(c1); setHCard(c2);
    setPChips(newPC); setAChips(newAC);
    setPot(newPot); setToCall(0);
    setShowAI(false); setResult(null); setStage("bet");
    setBusy(false); setIsGameOver(false); setChipDiff(0);
    setRoundStartChips(pc);

    // どちらかがオールインなら即ショーダウン
    if (newPC <= 0 || newAC <= 0) {
      addLog(`── ラウンド ${r} ── 先攻: ${first ? playerName : "AI"}`, "i");
      addLog(`アンティ各${pAnte}。ポット:${newPot} / オールイン→即ショーダウン`, "i");
      setTimeout(() => {
        const pw = c0.rank > c1.rank;
        addLog(`【ショーダウン】${c0.name} vs ${c1.name} → ${pw ? playerName + "の勝ち！" : "AIの勝ち"}`, pw ? "w" : "l");
        setShowAI(true);
        endRound(pw ? "p" : "a", newPot, newPC, newAC, c0, c1, pc);
      }, 800);
      return;
    }

    addLog(`── ラウンド ${r} ── 先攻: ${first ? playerName : "AI"}`, "i");
    addLog(`アンティ各${pAnte}。ポット:${newPot}`);

    if (!first) {
      setBusy(true);
      setTimeout(() => {
        const d = aiAction(c1, newPot, 0, newAC, 1);
        if (d.type === "raise") {
          const r2 = Math.min(Math.max(d.amt, 10), newAC, newPC);
          if (r2 > 0) { setAChips(newAC - r2); setPot(newPot + r2); setToCall(r2); addLog(`AI: ベット(+${r2})！どうする？`, "i"); }
          else addLog("AI: チェック");
        } else addLog("AI: チェック");
        setBusy(false);
      }, 900);
    }
  }

  function endRound(winner, finalPot, pc, ac, pcd, acd, startChips) {
    let newPC = pc, newAC = ac;
    if (winner === "p") { newPC = pc + finalPot; setPChips(newPC); }
    else                { newAC = ac + finalPot; setAChips(newAC); }
    setResult(winner); setShowAI(true); setStage("result"); setBusy(false);
    const diff = newPC - (startChips ?? roundStartChips);
    setChipDiff(diff);
    addLog(`収支: ${diff >= 0 ? "+" : ""}${diff}`, diff >= 0 ? "w" : "l");
    saveProfile("ai", playerName, newPC);
    if (newPC <= 0) { setOverMsg("チップが尽きた…"); setIsGameOver(true); }
    else if (newAC <= 0) { setOverMsg(`AIを破産させた！最終チップ: ${newPC}`); setIsGameOver(true); }
  }

  function doAI(currentPot, callAmt, round, pCardObj, aCardObj, pch, ach) {
    setBusy(true);
    setTimeout(() => {
      const d = aiAction(aCardObj, currentPot, callAmt, ach, round);
      if (d.type === "fold") { addLog("AIがフォールド → " + playerName + "の勝ち！", "w"); endRound("p", currentPot, pch, ach); return; }
      if (d.type === "check") {
        addLog("AI: チェック");
        setTimeout(() => {
          const pw = pCardObj.rank > aCardObj.rank;
          addLog(`【ショーダウン】${pCardObj.name} vs ${aCardObj.name} → ${pw ? playerName + "の勝ち！" : "AIの勝ち"}`, pw ? "w" : "l");
          endRound(pw ? "p" : "a", currentPot, pch, ach);
        }, 500);
        return;
      }
      if (d.type === "call") {
        const c = Math.min(callAmt, ach); const np = currentPot + c;
        setAChips(ach - c); setPot(np); addLog(`AI: コール(+${c})`);
        setTimeout(() => {
          const pw = pCardObj.rank > aCardObj.rank;
          addLog(`【ショーダウン】${pCardObj.name} vs ${aCardObj.name} → ${pw ? playerName + "の勝ち！" : "AIの勝ち"}`, pw ? "w" : "l");
          endRound(pw ? "p" : "a", np, pch, ach - c);
        }, 500);
        return;
      }
      if (d.type === "raise") {
        const r = Math.min(Math.max(d.amt, 10), ach, pch + callAmt);
        if (r <= 0 || ach <= 0) {
          addLog("AI: チェック");
          setTimeout(() => {
            const pw = pCardObj.rank > aCardObj.rank;
            addLog(`【ショーダウン】${pCardObj.name} vs ${aCardObj.name} → ${pw ? playerName + "の勝ち！" : "AIの勝ち"}`, pw ? "w" : "l");
            endRound(pw ? "p" : "a", currentPot, pch, ach);
          }, 500);
          return;
        }
        const np = currentPot + r;
        setAChips(ach - r); setPot(np); setToCall(r); setBusy(false);
        addLog(`AI: レイズ(+${r})！どうする？`, "i");
      }
    }, 800);
  }

  function actFold() {
    const { aChips: ac, pot: p, pChips: pc } = stateRef.current;
    addLog("あなた: フォールド → AIの勝ち", "l"); endRound("a", p, pc, ac);
  }
  function actCheck() {
    const { pot: p, pChips: pc, aChips: ac, pCard: pcd, aCard: acd, playerFirst: pf } = stateRef.current;
    addLog(playerName + ": チェック");
    if (!pf) {
      setTimeout(() => {
        const pw = pcd.rank > acd.rank;
        addLog(`【ショーダウン】${pcd.name} vs ${acd.name} → ${pw ? playerName + "の勝ち！" : "AIの勝ち"}`, pw ? "w" : "l");
        setShowAI(true); endRound(pw ? "p" : "a", p, pc, ac);
      }, 400);
    } else doAI(p, 0, 1, pcd, acd, pc, ac);
  }
  function actCall() {
    const { pot: p, toCall: tc, pChips: pc, aChips: ac, pCard: pcd, aCard: acd } = stateRef.current;
    const c = Math.min(tc, pc); const np = p + c;
    setPChips(pc - c); setPot(np); setToCall(0); addLog(playerName + `: コール(+${c})`);
    const pw = pcd.rank > acd.rank;
    setTimeout(() => {
      addLog(`【ショーダウン】${pcd.name} vs ${acd.name} → ${pw ? playerName + "の勝ち！" : "AIの勝ち"}`, pw ? "w" : "l");
      setShowAI(true); endRound(pw ? "p" : "a", np, pc - c, ac);
    }, 600);
  }
  function actBet() {
    const { pot: p, pChips: pc, aChips: ac, pCard: pcd, aCard: acd } = stateRef.current;
    const r = Math.min(Math.max(slider, 10), Math.min(pc, ac));
    const np = p + r; setPChips(pc - r); setPot(np);
    addLog(playerName + `: ベット(+${r})`); doAI(np, r, 2, pcd, acd, pc - r, ac);
  }
  function actReraise() {
    const { pot: p, pChips: pc, aChips: ac, toCall: tc, pCard: pcd, aCard: acd } = stateRef.current;
    const r = Math.min(Math.max(slider, (tc || 0) + 10), Math.min(pc, ac + (tc || 0)));
    const np = p + r; setPChips(pc - r); setPot(np); setToCall(0);
    addLog(playerName + `: リレイズ(+${r})`); doAI(np, r, 3, pcd, acd, pc - r, ac);
  }
  function goNextRound() {
    const { pChips: pc, aChips: ac, playerFirst: pf } = stateRef.current;
    if (pc <= 0 || ac <= 0) { setOverMsg(pc <= 0 ? "チップが尽きた…" : `AIを破産させた！最終チップ:${pc}`); setIsGameOver(true); return; }
    const nextR = rnd + 1; const nextFirst = !pf;
    setRnd(nextR); setPlayerFirst(nextFirst); dealRound(pc, ac, nextR, nextFirst);
  }

  const isResult = stage === "result";
  const needCall = toCall > 0 && !busy && stage === "bet";
  const canAct   = stage === "bet" && !busy;
  const pWin = result === "p"; const aWin = result === "a";

  if (!pCard || !aCard) return (
    <div style={S.root}><div style={S.bg}/>
      <div style={{ color: "#ffe08a", position: "relative", zIndex: 1, margin: "auto", marginTop: "40vh" }}>読み込み中…</div>
    </div>
  );

  return (
    <div style={S.root}>
      <div style={S.bg}/>
      <div style={S.play}>
        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: "Georgia,serif", color: "#ffe08a", fontSize: 20, letterSpacing: 3 }}>J.A.K.</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#6050a0", fontSize: 10 }}>R{rnd} | <span style={{ color: playerFirst ? "#c9a84c" : "#a080d0" }}>{playerFirst ? "あなた先攻" : "AI先攻"}</span></span>
            <button style={{ ...S.ghost, padding: "3px 8px", fontSize: 10 }} onClick={onBack}>← 戻る</button>
          </div>
        </div>

        {/* チップ */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 5, marginBottom: 8 }}>
          <Chips label={playerName} val={pChips} gold diff={isResult ? chipDiff : undefined} />
          <Chips label="POT" val={pot} />
          <Chips label="AI" val={aChips} />
        </div>

        {/* カード横並び：左：あなた、中：HIDDEN、右：AI */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: 8, padding: "8px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={S.aLabel}>{playerName}</div>
            <Card card={pCard} size="lg" winner={pWin} />
            {isResult && <div style={{ fontSize: 14, fontWeight: 700, color: pWin ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>{pWin ? "WIN" : "LOSE"}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 8, color: "#5040a0", letterSpacing: 1 }}>HIDDEN</div>
            <Card card={hCard} hidden={!isResult} size="sm" />
            {isResult && <div style={{ fontSize: 9, color: "#8070a0" }}>{hCard?.name}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={S.aLabel}>AI</div>
            <Card card={aCard} hidden={!showAI} size="lg" winner={aWin} />
            {isResult && <div style={{ fontSize: 14, fontWeight: 700, color: aWin ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>{aWin ? "WIN" : "LOSE"}</div>}
          </div>
        </div>

        {/* ログ */}
        <div style={{ marginBottom: 8 }}><Log entries={log} /></div>

        {busy && <div style={{ textAlign: "center", color: "#c9a84c", fontSize: 11, padding: "3px 0", animation: "pulse .7s infinite alternate" }}>AIが考え中…</div>}

        {canAct && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {needCall ? (
              <>
                <div style={{ textAlign: "center", color: "#ffe08a", fontSize: 11 }}>コール額: {toCall}</div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={{ ...S.red, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={actFold}>フォールド</button>
                  <button style={{ ...S.blue, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={actCall}>コール</button>
                </div>
                {toCall < pChips && aChips > 0 && (
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <input type="range" min={Math.max(toCall + 10, 20)} max={Math.max(Math.min(pChips, aChips + toCall, 600), Math.max(toCall + 10, 20))} step={10}
                      value={Math.min(slider, Math.max(Math.min(pChips, aChips + toCall), Math.max(toCall + 10, 20)))}
                      onChange={e => setSlider(+e.target.value)} style={{ flex: 1, accentColor: "#c9a84c" }} />
                    <span style={{ color: "#ffe08a", fontSize: 11, minWidth: 32 }}>{Math.min(slider, pChips, aChips + toCall)}</span>
                    <button style={{ ...S.gold, padding: "7px 9px", fontSize: 11 }} onClick={actReraise}>リレイズ</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={{ ...S.red, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={actFold}>フォールド</button>
                  <button style={{ ...S.blue, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={actCheck}>チェック</button>
                </div>
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="range" min={10} max={Math.max(Math.min(pChips, aChips, 600), 10)} step={10}
                    value={Math.min(slider, Math.max(Math.min(pChips, aChips), 10))}
                    onChange={e => setSlider(+e.target.value)} style={{ flex: 1, accentColor: "#c9a84c", opacity: pChips <= 0 ? 0.3 : 1 }} disabled={pChips <= 0} />
                  <span style={{ color: "#ffe08a", fontSize: 11, minWidth: 32 }}>{Math.min(slider, pChips, aChips)}</span>
                  <button style={{ ...S.gold, padding: "7px 9px", fontSize: 11, opacity: pChips <= 0 ? 0.4 : 1 }} onClick={actBet} disabled={pChips <= 0}>ベット</button>
                </div>
              </>
            )}
          </div>
        )}

        {isResult && !isGameOver && <button style={{ ...S.gold, width: "100%", marginTop: 8, padding: "10px", fontSize: 13 }} onClick={goNextRound}>次のラウンドへ →</button>}
        {isResult && isGameOver && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, color: overMsg.includes("破産") ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>
              {overMsg.includes("破産") ? "🏆 完全勝利！" : "💀 ゲームオーバー"}
            </div>
            <div style={{ textAlign: "center", color: "#9080b0", fontSize: 11 }}>{overMsg}</div>
            <button style={{ ...S.gold, width: "100%", padding: "10px" }} onClick={startGame}>もう一度プレイ</button>
            <button style={{ ...S.ghost, width: "100%" }} onClick={onBack}>タイトルへ</button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse{from{opacity:.4}to{opacity:1}}
        @keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        button:active{opacity:.75}
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
// オンライン対戦
// ══════════════════════════════════════════════
function OnlineGame({ onBack }) {
  const profile = loadProfile("online");
  const [screen, setScreen] = useState("lobby");
  const [roomId,   setRoomId]   = useState("");
  const [inputId,  setInputId]  = useState("");
  const [myRole,   setMyRole]   = useState("");
  const [myName,   setMyName]   = useState("");
  const [nameInput,setNameInput]= useState(profile?.name || "");
  const [error,    setError]    = useState("");
  const [gs, setGs] = useState(null);
  const [log, setLog]    = useState([]);
  const [slider, setSlider] = useState(60);
  const [timeLeft, setTimeLeft] = useState(20);

  const roomRef   = useRef(null);
  const unsubRef  = useRef(null);
  const stRef     = useRef({});
  const timerRef  = useRef(null);

  useEffect(() => { stRef.current = { gs, myRole, roomId }; }, [gs, myRole, roomId]);

  // タイマー（全return文より前）
  useEffect(() => {
    if (!gs || gs.phase !== "playing" || gs.result) {
      clearInterval(timerRef.current);
      return;
    }
    const acting = gs.turn === myRole;
    if (acting) {
      setTimeLeft(20);
      let t = 20;
      timerRef.current = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(timerRef.current);
          const { gs: g, myRole: role, roomId: rid } = stRef.current;
          if (!g || !rid || g.result) return;
          const opC = role === "host" ? g.guest?.chips ?? 0 : g.host?.chips ?? 0;
          const meName = role === "host" ? g.host?.name : g.guest?.name;
          const winner = role === "host" ? "guest" : "host";
          const seq = Date.now();
          const updates = {};
          updates[`rooms/${rid}/result`] = winner;
          updates[`rooms/${rid}/showCards`] = true;
          updates[`rooms/${rid}/lastAction`] = { msg: `${meName}が時間切れ → フォールド`, t: "i", seq };
          updates[`rooms/${rid}/${winner}/chips`] = opC + (g.pot ?? 0);
          update(ref(db), updates);
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gs?.turn, gs?.result, gs?.phase, myRole]);

  function addLog(msg, t = "n") { setLog(prev => [...prev.slice(-40), { msg, t }]); }

  function subscribeRoom(rid) {
    if (unsubRef.current) unsubRef.current();
    const r = ref(db, `rooms/${rid}`);
    roomRef.current = r;
    const unsub = onValue(r, snap => {
      const data = snap.val();
      if (!data) return;
      const prev = stRef.current.gs;
      setGs(data);
      if (data.lastAction && (!prev || data.lastAction.seq !== prev?.lastAction?.seq)) {
        addLog(data.lastAction.msg, data.lastAction.t);
      }
      if (data.phase === "playing" && screen !== "game") setScreen("game");
      if (data.phase === "gameover") setScreen("over");
    });
    unsubRef.current = () => off(r, "value", unsub);
  }

  async function createRoom() {
    if (!nameInput.trim()) { setError("名前を入力してや"); return; }
    const rid = genRoomId(); const name = nameInput.trim();
    setMyName(name); setMyRole("host"); setRoomId(rid); setError("");
    saveProfile("online", name, profile?.chips || INIT_CHIPS);
    await set(ref(db, `rooms/${rid}`), { phase: "waiting", host: { name, chips: INIT_CHIPS }, guest: null, round: 0 });
    subscribeRoom(rid); setScreen("wait");
  }

  async function joinRoom() {
    if (!nameInput.trim()) { setError("名前を入力してや"); return; }
    if (!inputId.trim())   { setError("ルームIDを入力してや"); return; }
    const rid = inputId.trim().toUpperCase(); const name = nameInput.trim();
    const snap = await get(ref(db, `rooms/${rid}`));
    if (!snap.exists()) { setError("ルームが見つからへん"); return; }
    if (snap.val().phase !== "waiting") { setError("そのルームはもう始まってるで"); return; }
    setMyName(name); setMyRole("guest"); setRoomId(rid); setError("");
    saveProfile(name, profile?.chips || INIT_CHIPS);
    await update(ref(db, `rooms/${rid}`), { guest: { name, chips: INIT_CHIPS } });
    subscribeRoom(rid);
    await dealNewRound(rid, INIT_CHIPS, INIT_CHIPS, 1, snap.val().host.name, name, null);
    setScreen("game");
  }

  async function quickMatch() {
    if (!nameInput.trim()) { setError("名前を入力してや"); return; }
    const name = nameInput.trim();
    setMyName(name); setError("");
    saveProfile("online", name, profile?.chips || INIT_CHIPS);
    setScreen("matching");
    const waitingRef = ref(db, "matching/waiting");
    const snap = await get(waitingRef);
    if (snap.exists()) {
      const data = snap.val();
      const rid = data.roomId; const hostName = data.name;
      await remove(waitingRef);
      setMyRole("guest"); setRoomId(rid);
      const roomSnap = await get(ref(db, `rooms/${rid}`));
      if (!roomSnap.exists()) { await registerAsWaiting(rid, name); return; }
      await update(ref(db, `rooms/${rid}`), { guest: { name, chips: INIT_CHIPS } });
      subscribeRoom(rid);
      await dealNewRound(rid, INIT_CHIPS, INIT_CHIPS, 1, hostName, name, null);
      setScreen("game");
    } else {
      const rid = genRoomId(); setRoomId(rid);
      await registerAsWaiting(rid, name);
    }
  }

  async function registerAsWaiting(rid, name) {
    await set(ref(db, `rooms/${rid}`), { phase: "waiting", host: { name, chips: INIT_CHIPS }, guest: null, round: 0 });
    await set(ref(db, "matching/waiting"), { roomId: rid, name, ts: Date.now() });
    setMyRole("host"); subscribeRoom(rid);
    const matchRef = ref(db, `rooms/${rid}/guest`);
    const unsub = onValue(matchRef, async (snap) => {
      if (snap.exists() && snap.val() !== null) {
        off(matchRef, "value", unsub);
        await remove(ref(db, "matching/waiting"));
      }
    });
  }

  async function cancelMatching() {
    await remove(ref(db, "matching/waiting"));
    if (roomId) await remove(ref(db, `rooms/${roomId}`));
    if (unsubRef.current) unsubRef.current();
    setScreen("lobby"); setRoomId("");
  }

  async function dealNewRound(rid, hostChips, guestChips, rnd, hName, gName, prevFirst) {
    const [c0, c1, c2] = shuffle(DECK);
    const newPot = ANTE * 2; const seq = Date.now();
    const firstPlayer = rnd === 1 ? (Math.random() < 0.5 ? "host" : "guest") : (prevFirst === "host" ? "guest" : "host");
    await set(ref(db, `rooms/${rid}`), {
      phase: "playing", round: rnd,
      host:  { name: hName,  chips: hostChips  - ANTE, card: c0.id },
      guest: { name: gName,  chips: guestChips - ANTE, card: c1.id },
      hidden: c2.id, pot: newPot, toCall: 0, betRound: 1,
      turn: firstPlayer, firstPlayer,
      showCards: false, result: null,
      lastAction: { msg: `── ラウンド ${rnd} ── 先攻:${firstPlayer === "host" ? hName : gName} ポット:${newPot}`, t: "i", seq },
    });
  }

  function isMyTurn() { if (!gs) return false; return gs.turn === myRole && gs.phase === "playing" && !gs.result; }
  function myCard() { if (!gs) return null; const id = myRole === "host" ? gs.host?.card : gs.guest?.card; return DECK.find(c => c.id === id) || null; }
  function opCard() { if (!gs) return null; const id = myRole === "host" ? gs.guest?.card : gs.host?.card; return DECK.find(c => c.id === id) || null; }
  function hiddenCard() { if (!gs) return null; return DECK.find(c => c.id === gs.hidden) || null; }
  function myChips()  { return myRole === "host" ? gs?.host?.chips  ?? 0 : gs?.guest?.chips  ?? 0; }
  function opChips()  { return myRole === "host" ? gs?.guest?.chips ?? 0 : gs?.host?.chips   ?? 0; }
  function opRole()   { return myRole === "host" ? "guest" : "host"; }
  function myNameFromGs() { return myRole === "host" ? gs?.host?.name  : gs?.guest?.name; }
  function opNameFromGs() { return myRole === "host" ? gs?.guest?.name : gs?.host?.name;  }

  async function sendAction(type, amount = 0) {
    const { gs: g, myRole: role, roomId: rid } = stRef.current;
    if (!g || !rid) return;
    const pot = g.pot; const toCall = g.toCall;
    const myC = role === "host" ? g.host.chips : g.guest.chips;
    const opC = role === "host" ? g.guest.chips : g.host.chips;
    const myCardId = role === "host" ? g.host.card : g.guest.card;
    const opCardId = role === "host" ? g.guest.card : g.host.card;
    const myCardObj = DECK.find(c => c.id === myCardId);
    const opCardObj = DECK.find(c => c.id === opCardId);
    const meName = role === "host" ? g.host.name : g.guest.name;
    const seq = Date.now();
    const updates = {};

    if (type === "fold") {
      const winner = opRole(); const winnerChips = opC + pot;
      updates[`rooms/${rid}/result`] = winner;
      updates[`rooms/${rid}/showCards`] = true;
      updates[`rooms/${rid}/lastAction`] = { msg: `${meName}がフォールド`, t: "i", seq };
      updates[`rooms/${rid}/${winner}/chips`] = winnerChips;
      await update(ref(db), updates); return;
    }
    if (type === "check") {
      const iAmFirst = g.firstPlayer === role;
      if (!iAmFirst || g.betRound > 1) {
        await doShowdown(rid, g, myCardObj, opCardObj, role, meName, seq);
      } else {
        updates[`rooms/${rid}/turn`] = opRole();
        updates[`rooms/${rid}/betRound`] = g.betRound + 1;
        updates[`rooms/${rid}/lastAction`] = { msg: `${meName}: チェック`, t: "n", seq };
        await update(ref(db), updates);
      }
      return;
    }
    if (type === "call") {
      const c = Math.min(toCall, myC); const np = pot + c;
      updates[`rooms/${rid}/pot`] = np;
      updates[`rooms/${rid}/${role}/chips`] = myC - c;
      updates[`rooms/${rid}/toCall`] = 0;
      updates[`rooms/${rid}/lastAction`] = { msg: `${meName}: コール(+${c})`, t: "n", seq };
      await update(ref(db), updates);
      await doShowdown(rid, { ...g, pot: np }, myCardObj, opCardObj, role, meName, seq + 1);
      return;
    }
    if (type === "raise") {
      const r = Math.min(amount, myC); const np = pot + r;
      updates[`rooms/${rid}/pot`] = np;
      updates[`rooms/${rid}/${role}/chips`] = myC - r;
      updates[`rooms/${rid}/toCall`] = r;
      updates[`rooms/${rid}/turn`] = opRole();
      updates[`rooms/${rid}/betRound`] = g.betRound + 1;
      updates[`rooms/${rid}/lastAction`] = { msg: `${meName}: レイズ(+${r})`, t: "n", seq };
      await update(ref(db), updates);
    }
  }

  async function doShowdown(rid, g, myCardObj, opCardObj, myRoleLocal, meName, seq) {
    const hostCard  = myRoleLocal === "host" ? myCardObj : opCardObj;
    const guestCard = myRoleLocal === "host" ? opCardObj : myCardObj;
    const hostWin   = hostCard.rank > guestCard.rank;
    const winner    = hostWin ? "host" : "guest";
    const winnerChips = (winner === "host" ? g.host?.chips ?? 0 : g.guest?.chips ?? 0);
    const updates = {};
    updates[`rooms/${rid}/result`] = winner;
    updates[`rooms/${rid}/showCards`] = true;
    updates[`rooms/${rid}/${winner}/chips`] = winnerChips + g.pot;
    updates[`rooms/${rid}/lastAction`] = {
      msg: `【ショーダウン】${hostCard.name} vs ${guestCard.name} → ${winner === "host" ? g.host?.name : g.guest?.name}の勝ち！`,
      t: hostWin === (myRoleLocal === "host") ? "w" : "l", seq,
    };
    await update(ref(db), updates);
  }

  async function goNextRound() {
    if (myRole !== "host") return;
    const { gs: g, roomId: rid } = stRef.current;
    const hc = g.host.chips; const gc = g.guest.chips;
    if (hc <= 0 || gc <= 0) { await update(ref(db, `rooms/${rid}`), { phase: "gameover" }); return; }
    await dealNewRound(rid, hc, gc, g.round + 1, g.host.name, g.guest.name, g.firstPlayer);
  }

  // マッチング待機
  if (screen === "matching") return (
    <div style={S.root}><div style={S.bg}/>
      <div style={S.center}>
        <div style={{ fontSize: 20, fontFamily: "serif", color: "#ffe08a", marginBottom: 20 }}>対戦相手を探してるで…</div>
        <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 24px" }}/>
        <button style={S.ghost} onClick={cancelMatching}>キャンセル</button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ロビー
  if (screen === "lobby") return (
    <div style={S.root}><div style={S.bg}/>
      <div style={S.center}>
        <div style={{ fontSize: 26, fontFamily: "Georgia,serif", color: "#ffe08a", letterSpacing: 6, marginBottom: 24 }}>J.A.K.</div>
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.inputGroup}>
            <label style={S.label}>あなたの名前</label>
            <input style={S.input} value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="名前を入力" maxLength={12} />
          </div>
          <button style={S.gold} onClick={quickMatch}>🔍 対戦相手を探す</button>
          <div style={{ textAlign: "center", color: "#6050a0", fontSize: 12 }}>── または友達と ──</div>
          <button style={{ ...S.blue, fontSize: 13 }} onClick={createRoom}>ルームを作る</button>
          <div style={S.inputGroup}>
            <label style={S.label}>ルームID（6文字）</label>
            <input style={S.input} value={inputId} onChange={e => setInputId(e.target.value)} placeholder="例: AB12CD" maxLength={6} />
          </div>
          <button style={{ ...S.blue, fontSize: 13 }} onClick={joinRoom}>ルームに参加</button>
          {error && <div style={{ color: "#ff7878", fontSize: 12, textAlign: "center" }}>{error}</div>}
          <button style={{ ...S.ghost, marginTop: 4 }} onClick={onBack}>← 戻る</button>
        </div>
      </div>
    </div>
  );

  // 待機中
  if (screen === "wait") return (
    <div style={S.root}><div style={S.bg}/>
      <div style={S.center}>
        <div style={{ fontSize: 20, fontFamily: "serif", color: "#ffe08a", marginBottom: 20 }}>対戦相手を待ってるで…</div>
        <div style={{ background: "rgba(201,168,76,.1)", border: "1px solid rgba(201,168,76,.3)", borderRadius: 12, padding: "16px 28px", textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: "#9080b8", letterSpacing: 2, marginBottom: 6 }}>ROOM ID</div>
          <div style={{ fontSize: 34, fontFamily: "monospace", fontWeight: 700, color: "#ffe08a", letterSpacing: 6 }}>{roomId}</div>
        </div>
        <button style={{ ...S.ghost }} onClick={() => { if(unsubRef.current) unsubRef.current(); remove(ref(db,`rooms/${roomId}`)); setScreen("lobby"); }}>キャンセル</button>
      </div>
    </div>
  );

  // ゲームオーバー
  if (screen === "over") {
    const iWon = gs?.result === myRole;
    return (
      <div style={S.root}><div style={S.bg}/>
        <div style={S.center}>
          <div style={{ fontSize: 46, marginBottom: 10 }}>{iWon ? "🏆" : "💀"}</div>
          <div style={{ fontSize: 22, fontFamily: "serif", color: iWon ? "#7dde8a" : "#ff7878", marginBottom: 6 }}>{iWon ? "勝利！" : "敗北…"}</div>
          <div style={{ color: "#9080b0", fontSize: 12, marginBottom: 24 }}>最終チップ: {myChips()}</div>
          <button style={S.gold} onClick={() => { if(unsubRef.current) unsubRef.current(); onBack(); }}>タイトルへ</button>
        </div>
      </div>
    );
  }

  if (!gs) return <div style={S.root}><div style={S.bg}/><div style={{ color: "#ffe08a", position: "relative", zIndex: 1, margin: "auto", marginTop: "40vh" }}>接続中…</div></div>;

  const isResult  = !!gs.result;
  const myTurn    = isMyTurn();
  const needCall  = (gs.toCall ?? 0) > 0 && myTurn;
  const canAct    = myTurn && !isResult;
  const myWin     = gs.result === myRole;
  const opWin     = gs.result === opRole();
  const mc = myCard(); const oc = opCard(); const hc = hiddenCard();

  return (
    <div style={S.root}><div style={S.bg}/>
      <div style={S.play}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: "Georgia,serif", color: "#ffe08a", fontSize: 20, letterSpacing: 3 }}>J.A.K.</span>
          <span style={{ color: "#6050a0", fontSize: 10 }}>
            R{gs.round} | <span style={{ color: gs.firstPlayer === myRole ? "#c9a84c" : "#a080d0" }}>{gs.firstPlayer === myRole ? "あなた先攻" : "相手先攻"}</span>
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 5, marginBottom: 8 }}>
          <Chips label={myNameFromGs() || "あなた"} val={myChips()} gold />
          <Chips label="POT" val={gs.pot} />
          <Chips label={opNameFromGs() || "相手"} val={opChips()} />
        </div>

        {/* カードを横並びに：左：自分、中：HIDDEN、右：相手 */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: 8, padding: "8px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={S.aLabel}>{myNameFromGs() || "あなた"}{!isResult && myTurn ? " ←" : ""}</div>
            <Card card={mc} size="lg" winner={myWin} />
            {isResult && <div style={{ fontSize: 14, fontWeight: 700, color: myWin ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>{myWin ? "WIN" : "LOSE"}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 8, color: "#5040a0", letterSpacing: 1 }}>HIDDEN</div>
            <Card card={hc} hidden={!isResult} size="sm" />
            {isResult && <div style={{ fontSize: 9, color: "#8070a0" }}>{hc?.name}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={S.aLabel}>{opNameFromGs() || "相手"}{!isResult && gs.turn === opRole() ? " 🤔" : ""}</div>
            <Card card={oc} hidden={!gs.showCards} size="lg" winner={opWin} />
            {isResult && <div style={{ fontSize: 14, fontWeight: 700, color: opWin ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>{opWin ? "WIN" : "LOSE"}</div>}
          </div>
        </div>

        <div style={{ marginBottom: 6 }}><Log entries={log} /></div>

        {/* タイマーバー */}
        {canAct && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(timeLeft / 20) * 100}%`, background: timeLeft <= 5 ? "#ff7878" : timeLeft <= 10 ? "#ffe08a" : "#7dde8a", transition: "width 1s linear, background .3s" }}/>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: timeLeft <= 5 ? "#ff7878" : "#ffe08a", minWidth: 26, fontFamily: "monospace" }}>{timeLeft}s</div>
          </div>
        )}

        {!myTurn && !isResult && (
          <div style={{ textAlign: "center", color: "#c9a84c", fontSize: 11, padding: "4px 0", animation: "pulse .8s infinite alternate" }}>
            {opNameFromGs()}が考え中…
          </div>
        )}

        {canAct && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {needCall ? (
              <>
                <div style={{ textAlign: "center", color: "#ffe08a", fontSize: 11 }}>コール額: {gs.toCall}</div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={{ ...S.red, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={() => sendAction("fold")}>フォールド</button>
                  <button style={{ ...S.blue, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={() => sendAction("call")}>コール</button>
                </div>
                {gs.toCall < myChips() && opChips() > 0 && (
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <input type="range" min={Math.max((gs.toCall ?? 0) + 10, 20)} max={Math.max(Math.min(myChips(), opChips() + (gs.toCall ?? 0), 600), Math.max((gs.toCall ?? 0) + 10, 20))} step={10}
                      value={slider} onChange={e => setSlider(+e.target.value)} style={{ flex: 1, accentColor: "#c9a84c" }} />
                    <span style={{ color: "#ffe08a", fontSize: 11, minWidth: 32 }}>{slider}</span>
                    <button style={{ ...S.gold, padding: "7px 9px", fontSize: 11 }} onClick={() => sendAction("raise", slider)}>リレイズ</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={{ ...S.red, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={() => sendAction("fold")}>フォールド</button>
                  <button style={{ ...S.blue, flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={() => sendAction("check")}>チェック</button>
                </div>
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="range" min={10} max={Math.max(Math.min(myChips(), opChips(), 600), 10)} step={10}
                    value={slider} onChange={e => setSlider(+e.target.value)} style={{ flex: 1, accentColor: "#c9a84c" }} />
                  <span style={{ color: "#ffe08a", fontSize: 11, minWidth: 32 }}>{slider}</span>
                  <button style={{ ...S.gold, padding: "7px 9px", fontSize: 11 }} onClick={() => sendAction("raise", slider)}>ベット</button>
                </div>
              </>
            )}
          </div>
        )}

        {isResult && myRole === "host" && (
          <button style={{ ...S.gold, width: "100%", marginTop: 8, padding: "10px", fontSize: 13 }} onClick={goNextRound}>次のラウンドへ →</button>
        )}
        {isResult && myRole === "guest" && (
          <div style={{ textAlign: "center", color: "#7060a0", fontSize: 11, marginTop: 10 }}>ホストが次のラウンドを開始するのを待ってるで…</div>
        )}
      </div>
      <style>{`
        @keyframes pulse{from{opacity:.4}to{opacity:1}}
        @keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        button:active{opacity:.75}
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
// タイトル画面
// ══════════════════════════════════════════════
export default function App() {
  const [mode, setMode] = useState("title");
  const savedProfile = loadProfile("ai") || loadProfile("online");
  const [nameInput, setNameInput] = useState(savedProfile?.name || "");
  const [nameSet, setNameSet] = useState(!!savedProfile?.name);

  function saveName() {
    if (!nameInput.trim()) return;
    const aiChips    = loadProfile("ai")?.chips ?? INIT_CHIPS;
    const onlineChips = loadProfile("online")?.chips ?? INIT_CHIPS;
    saveProfile("ai",     nameInput.trim(), aiChips);
    saveProfile("online", nameInput.trim(), onlineChips);
    setNameSet(true);
  }

  if (mode === "ai")     return <AIGame     onBack={() => setMode("title")} />;
  if (mode === "online") return <OnlineGame onBack={() => setMode("title")} />;

  const ai = loadProfile("ai");
  const online = loadProfile("online");
  const isWide = typeof window !== "undefined" && window.innerWidth >= 600;

  return (
    <div style={S.root}>
      <div style={S.bg}/>
      <div style={S.center}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: isWide ? 96 : 64, fontFamily: "Georgia,serif", color: "#ffe08a", letterSpacing: 8, textShadow: "0 0 40px rgba(255,224,138,.7),0 2px 0 #a07010" }}>J.A.K.</div>
          <div style={{ fontSize: 11, color: "#7060a0", letterSpacing: 4, marginTop: 2 }}>大中小カードゲーム</div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {DECK.map((c, i) => (
            <div key={c.id} style={{ animation: `fc 1.8s ease-in-out ${i*0.3}s infinite alternate` }}>
              <Card card={c} size="md" winner />
            </div>
          ))}
        </div>

        <div style={{ color: "#a090c0", fontSize: 12, textAlign: "center", lineHeight: 2, marginBottom: 20 }}>
          <div>🃏 ジョーカー ＞ A エース ＞ K キング</div>
          <div style={{ fontSize: 10, opacity: .6 }}>3枚・1枚は伏せ。心理戦で勝ち抜け。</div>
        </div>

        {/* 名前入力 */}
        <div style={{ width: "100%", maxWidth: 280, marginBottom: 16 }}>
          {nameSet ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#c9a84c", marginBottom: 4 }}>
                {nameInput}
              </div>
              <div style={{ fontSize: 10, color: "#9080b8", marginBottom: 8 }}>
                AI: {(ai?.chips >= INIT_CHIPS ? ai.chips : INIT_CHIPS).toLocaleString()} | オンライン: {(online?.chips ?? INIT_CHIPS).toLocaleString()}
              </div>
              <button style={{ ...S.ghost, fontSize: 11, padding: "4px 12px" }} onClick={() => setNameSet(false)}>名前を変更</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, flex: 1, fontSize: 14 }}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveName()}
                placeholder="名前を入力してや"
                maxLength={12} />
              <button style={{ ...S.gold, padding: "10px 14px", fontSize: 13 }} onClick={saveName}>決定</button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
          <button style={S.gold} onClick={() => { saveName(); setMode("ai"); }}>AI対戦</button>
          <button style={{ ...S.blue, padding: "12px 22px", fontSize: 14, fontWeight: 700 }} onClick={() => { saveName(); setMode("online"); }}>オンライン対戦</button>
        </div>
      </div>
      <style>{`@keyframes fc{from{transform:translateY(0)}to{transform:translateY(-10px)}}`}</style>
    </div>
  );
}
