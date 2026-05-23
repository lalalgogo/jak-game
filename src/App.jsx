// ========================================================
// App.jsx  ―  JAK (大中小) Firebase ネット対戦版
// ========================================================
import { useState, useRef, useEffect } from "react";
import { db } from "./firebaseConfig";
import {
  ref, set, get, update, onValue, off, push, remove
} from "firebase/database";

// ── カード定義 ────────────────────────────────────────────
const JOKER = { id: "JOKER", label: "🃏", name: "ジョーカー", rank: 3 };
const ACE   = { id: "ACE",   label: "A",  name: "エース",     rank: 2 };
const KING  = { id: "KING",  label: "K",  name: "キング",     rank: 1 };
const DECK  = [JOKER, ACE, KING];

const INIT_CHIPS = 1000;
const ANTE       = 50;

// ── ユーティリティ ────────────────────────────────────────
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

// ── Card コンポーネント ───────────────────────────────────
function Card({ card, hidden, size, winner }) {
  const w  = size === "lg" ? 96  : size === "sm" ? 54  : 76;
  const h  = size === "lg" ? 136 : size === "sm" ? 78  : 108;
  const fs = size === "lg" ? 38  : size === "sm" ? 18  : 28;
  const cs = size === "lg" ? 44  : size === "sm" ? 22  : 34;

  if (hidden) return (
    <div style={{
      width: w, height: h, borderRadius: 10, flexShrink: 0,
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
      width: w, height: h, borderRadius: 10, flexShrink: 0,
      background: bg, border: `2px solid ${bc}`,
      display: "flex", flexDirection: "column", alignItems: "stretch",
      boxShadow: winner ? `0 0 28px ${glow},0 4px 16px #0006` : "0 4px 16px #0005",
      transform: winner ? "scale(1.07)" : "scale(1)",
      transition: "transform .3s, box-shadow .3s",
      position: "relative", overflow: "hidden",
    }}>
      {isJ && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <div style={{ fontSize: cs, lineHeight: 1 }}>🃏</div>
          <div style={{ fontSize: fs * 0.3, color: "#ff9955", fontFamily: "Georgia,serif", letterSpacing: 2 }}>JOKER</div>
        </div>
      )}
      {isA && <>
        <div style={{ position: "absolute", top: 4, left: 6, lineHeight: 1.1 }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>A</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♠</div>
        </div>
        <div style={{ position: "absolute", bottom: 4, right: 6, lineHeight: 1.1, transform: "rotate(180deg)" }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>A</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♠</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: cs * 1.15, color: tc, fontFamily: "serif", lineHeight: 1 }}>♠</span>
        </div>
      </>}
      {isK && <>
        <div style={{ position: "absolute", top: 4, left: 6, lineHeight: 1.1 }}>
          <div style={{ fontSize: fs * 0.46, fontWeight: 900, color: tc, fontFamily: "Georgia,serif" }}>K</div>
          <div style={{ fontSize: fs * 0.36, color: tc, textAlign: "center" }}>♠</div>
        </div>
        <div style={{ position: "absolute", bottom: 4, right: 6, lineHeight: 1.1, transform: "rotate(180deg)" }}>
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

// ── Chips / Log ───────────────────────────────────────────
function Chips({ label, val, gold }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "7px 12px", borderRadius: 9, minWidth: 72,
      background: gold ? "rgba(201,168,76,.14)" : "rgba(255,255,255,.05)",
      border: `1px solid ${gold ? "rgba(201,168,76,.4)" : "rgba(255,255,255,.1)"}`,
    }}>
      <div style={{ fontSize: 10, color: "#9080b8", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: gold ? "#ffe08a" : "#ddd0f0", fontFamily: "monospace" }}>
        {(val ?? 0).toLocaleString()}
      </div>
    </div>
  );
}

function Log({ entries }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entries]);
  return (
    <div ref={ref} style={{
      height: 86, overflowY: "auto", padding: "7px 11px",
      background: "rgba(0,0,0,.3)", borderRadius: 9,
      border: "1px solid rgba(255,255,255,.07)",
    }}>
      {entries.map((e, i) => (
        <div key={i} style={{
          fontSize: 12, lineHeight: 1.6,
          color: e.t === "w" ? "#7dde8a" : e.t === "l" ? "#ff7878" : e.t === "i" ? "#ffe08a" : "#b8a8d0",
        }}>{e.msg}</div>
      ))}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────
export default function App() {
  // ── 画面管理 ──
  const [screen, setScreen] = useState("title"); // title | lobby | wait | game | over

  // ── ルーム情報 ──
  const [roomId,   setRoomId]   = useState("");
  const [inputId,  setInputId]  = useState("");
  const [myRole,   setMyRole]   = useState(""); // "host" | "guest"
  const [myName,   setMyName]   = useState("");
  const [nameInput,setNameInput]= useState("");
  const [opName,   setOpName]   = useState("");
  const [error,    setError]    = useState("");

  // ── ゲーム状態（Firebaseと同期） ──
  const [gs, setGs] = useState(null); // game state object

  // ── ローカル表示用 ──
  const [log,    setLog]    = useState([]);
  const [slider, setSlider] = useState(60);

  const roomRef   = useRef(null);
  const unsubRef  = useRef(null);
  const stRef     = useRef({});

  useEffect(() => { stRef.current = { gs, myRole, roomId }; }, [gs, myRole, roomId]);

  function addLog(msg, t = "n") {
    setLog(prev => [...prev.slice(-40), { msg, t }]);
  }

  // ────────────────────────────────────────────────────────
  // Firebase ゲーム状態の監視
  // ────────────────────────────────────────────────────────
  function subscribeRoom(rid) {
    if (unsubRef.current) unsubRef.current();
    const r = ref(db, `rooms/${rid}`);
    roomRef.current = r;
    const unsub = onValue(r, snap => {
      const data = snap.val();
      if (!data) return;
      const prev = stRef.current.gs;

      setGs(data);

      // ログ追加（新しいアクションが来たとき）
      if (data.lastAction && (!prev || data.lastAction.seq !== prev?.lastAction?.seq)) {
        const a = data.lastAction;
        addLog(a.msg, a.t);
      }

      // 画面遷移
      if (data.phase === "playing" && screen !== "game") setScreen("game");
      if (data.phase === "gameover") setScreen("over");
    });
    unsubRef.current = () => off(r, "value", unsub);
  }

  // ────────────────────────────────────────────────────────
  // ルーム作成
  // ────────────────────────────────────────────────────────
  async function createRoom() {
    if (!nameInput.trim()) { setError("名前を入力してや"); return; }
    const rid = genRoomId();
    const name = nameInput.trim();
    setMyName(name);
    setMyRole("host");
    setRoomId(rid);
    setError("");

    await set(ref(db, `rooms/${rid}`), {
      phase: "waiting",
      host:  { name, chips: INIT_CHIPS },
      guest: null,
      round: 0,
    });
    subscribeRoom(rid);
    setScreen("wait");
  }

  // ────────────────────────────────────────────────────────
  // ルーム参加
  // ────────────────────────────────────────────────────────
  async function joinRoom() {
    if (!nameInput.trim()) { setError("名前を入力してや"); return; }
    if (!inputId.trim())   { setError("ルームIDを入力してや"); return; }
    const rid  = inputId.trim().toUpperCase();
    const name = nameInput.trim();

    const snap = await get(ref(db, `rooms/${rid}`));
    if (!snap.exists())              { setError("ルームが見つからへん"); return; }
    if (snap.val().phase !== "waiting") { setError("そのルームはもう始まってるで"); return; }

    setMyName(name);
    setMyRole("guest");
    setRoomId(rid);
    setOpName(snap.val().host.name);
    setError("");

    await update(ref(db, `rooms/${rid}`), {
      guest: { name, chips: INIT_CHIPS },
    });

    subscribeRoom(rid);
    // ホストに対戦相手が来たことを通知 → ホストがdealing開始
    await dealNewRound(rid, INIT_CHIPS, INIT_CHIPS, 1, snap.val().host.name, name);
    setScreen("game");
  }

  // ────────────────────────────────────────────────────────
  // カードを配る（ホストだけが実行）
  // ────────────────────────────────────────────────────────
  async function dealNewRound(rid, hostChips, guestChips, rnd, hName, gName) {
    const [c0, c1, c2] = shuffle(DECK);
    const newPot = ANTE * 2;
    const seq    = Date.now();
    await set(ref(db, `rooms/${rid}`), {
      phase:      "playing",
      round:      rnd,
      host:       { name: hName,  chips: hostChips  - ANTE, card: c0.id },
      guest:      { name: gName,  chips: guestChips - ANTE, card: c1.id },
      hidden:     c2.id,
      pot:        newPot,
      toCall:     0,
      betRound:   1,
      turn:       "host",   // 先攻はhost
      showCards:  false,
      result:     null,
      lastAction: { msg: `── ラウンド ${rnd} ── アンティ各${ANTE} ポット:${newPot}`, t: "i", seq },
    });
  }

  // ────────────────────────────────────────────────────────
  // 自分のターンか判定
  // ────────────────────────────────────────────────────────
  function isMyTurn() {
    if (!gs) return false;
    return gs.turn === myRole && gs.phase === "playing" && !gs.result;
  }

  // 自分のカードオブジェクト取得
  function myCard() {
    if (!gs) return null;
    const id = myRole === "host" ? gs.host?.card : gs.guest?.card;
    return DECK.find(c => c.id === id) || null;
  }
  function opCard() {
    if (!gs) return null;
    const id = myRole === "host" ? gs.guest?.card : gs.host?.card;
    return DECK.find(c => c.id === id) || null;
  }
  function hiddenCard() {
    if (!gs) return null;
    return DECK.find(c => c.id === gs.hidden) || null;
  }

  // チップ取得
  function myChips()  { return myRole === "host" ? gs?.host?.chips  ?? 0 : gs?.guest?.chips  ?? 0; }
  function opChips()  { return myRole === "host" ? gs?.guest?.chips ?? 0 : gs?.host?.chips   ?? 0; }
  function opRole()   { return myRole === "host" ? "guest" : "host"; }
  function myNameFromGs() { return myRole === "host" ? gs?.host?.name  : gs?.guest?.name; }
  function opNameFromGs() { return myRole === "host" ? gs?.guest?.name : gs?.host?.name;  }

  // ────────────────────────────────────────────────────────
  // アクション送信
  // ────────────────────────────────────────────────────────
  async function sendAction(type, amount = 0) {
    const { gs: g, myRole: role, roomId: rid } = stRef.current;
    if (!g || !rid) return;

    const pot     = g.pot;
    const toCall  = g.toCall;
    const myC     = role === "host" ? g.host.chips  : g.guest.chips;
    const opC     = role === "host" ? g.guest.chips : g.host.chips;
    const myCardId= role === "host" ? g.host.card   : g.guest.card;
    const opCardId= role === "host" ? g.guest.card  : g.host.card;
    const myCardObj = DECK.find(c => c.id === myCardId);
    const opCardObj = DECK.find(c => c.id === opCardId);
    const meName  = role === "host" ? g.host.name   : g.guest.name;
    const seq     = Date.now();

    const updates = {};

    if (type === "fold") {
      // 相手の勝ち
      const winner = opRole();
      const winnerChips = opC + pot;
      updates[`rooms/${rid}/result`]    = winner;
      updates[`rooms/${rid}/showCards`] = true;
      updates[`rooms/${rid}/lastAction`]= { msg: `${meName}がフォールド`, t: "i", seq };
      updates[`rooms/${rid}/${winner}/chips`] = winnerChips;
      await update(ref(db), updates);
      return;
    }

    if (type === "check") {
      // 相手がすでにチェック済み（両方チェック）→ショーダウン
      if (g.betRound > 1 || g.turn === opRole()) {
        // ショーダウン
        await doShowdown(rid, g, myCardObj, opCardObj, role, meName, seq);
      } else {
        updates[`rooms/${rid}/turn`]      = opRole();
        updates[`rooms/${rid}/betRound`]  = g.betRound + 1;
        updates[`rooms/${rid}/lastAction`]= { msg: `${meName}: チェック`, t: "n", seq };
        await update(ref(db), updates);
      }
      return;
    }

    if (type === "call") {
      const c = Math.min(toCall, myC);
      const np = pot + c;
      updates[`rooms/${rid}/pot`]       = np;
      updates[`rooms/${rid}/${role}/chips`] = myC - c;
      updates[`rooms/${rid}/toCall`]    = 0;
      updates[`rooms/${rid}/lastAction`]= { msg: `${meName}: コール(+${c})`, t: "n", seq };
      // ショーダウンへ
      await update(ref(db), updates);
      await doShowdown(rid, { ...g, pot: np }, myCardObj, opCardObj, role, meName, seq + 1);
      return;
    }

    if (type === "raise") {
      const r = Math.min(amount, myC);
      const np = pot + r;
      updates[`rooms/${rid}/pot`]       = np;
      updates[`rooms/${rid}/${role}/chips`] = myC - r;
      updates[`rooms/${rid}/toCall`]    = r;
      updates[`rooms/${rid}/turn`]      = opRole();
      updates[`rooms/${rid}/betRound`]  = g.betRound + 1;
      updates[`rooms/${rid}/lastAction`]= { msg: `${meName}: レイズ(+${r})`, t: "n", seq };
      await update(ref(db), updates);
      return;
    }
  }

  async function doShowdown(rid, g, myCardObj, opCardObj, myRoleLocal, meName, seq) {
    const hostCard  = myRoleLocal === "host" ? myCardObj : opCardObj;
    const guestCard = myRoleLocal === "host" ? opCardObj : myCardObj;
    const hostWin   = hostCard.rank > guestCard.rank;
    const winner    = hostWin ? "host" : "guest";
    const winnerChips = (winner === "host" ? g.host?.chips ?? 0 : g.guest?.chips ?? 0);

    const updates = {};
    updates[`rooms/${rid}/result`]    = winner;
    updates[`rooms/${rid}/showCards`] = true;
    updates[`rooms/${rid}/${winner}/chips`] = winnerChips + g.pot;
    updates[`rooms/${rid}/lastAction`]= {
      msg: `【ショーダウン】${hostCard.name} vs ${guestCard.name} → ${winner === "host" ? g.host?.name : g.guest?.name}の勝ち！`,
      t: hostWin === (myRoleLocal === "host") ? "w" : "l",
      seq,
    };
    await update(ref(db), updates);
  }

  // ────────────────────────────────────────────────────────
  // 次のラウンド（ホストだけが開始）
  // ────────────────────────────────────────────────────────
  async function goNextRound() {
    if (myRole !== "host") return;
    const { gs: g, roomId: rid } = stRef.current;
    const hc = g.host.chips;
    const gc = g.guest.chips;
    if (hc <= 0 || gc <= 0) {
      await update(ref(db, `rooms/${rid}`), { phase: "gameover" });
      return;
    }
    await dealNewRound(rid, hc, gc, g.round + 1, g.host.name, g.guest.name);
  }

  // ────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────

  // ── タイトル ──────────────────────────────────────────
  if (screen === "title") return (
    <div style={S.root}>
      <div style={S.bg}/>
      <div style={S.center}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 68, fontFamily: "Georgia,serif", color: "#ffe08a", letterSpacing: 10, textShadow: "0 0 40px rgba(255,224,138,.7),0 2px 0 #a07010" }}>JAK</div>
          <div style={{ fontSize: 12, color: "#7060a0", letterSpacing: 5, marginTop: 4 }}>大中小カードゲーム</div>
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
          {DECK.map((c, i) => (
            <div key={c.id} style={{ animation: `fc 1.8s ease-in-out ${i*0.3}s infinite alternate` }}>
              <Card card={c} size="md" winner />
            </div>
          ))}
        </div>
        <div style={{ color: "#a090c0", fontSize: 13, textAlign: "center", lineHeight: 2.2, marginBottom: 28 }}>
          <div>🃏 ジョーカー ＞ A エース ＞ K キング</div>
          <div style={{ fontSize: 11, opacity: .6 }}>3枚・1枚は伏せ。心理戦で勝ち抜け。</div>
        </div>
        <button style={S.gold} onClick={() => setScreen("lobby")}>オンライン対戦</button>
      </div>
      <style>{`@keyframes fc{from{transform:translateY(0)}to{transform:translateY(-10px)}}`}</style>
    </div>
  );

  // ── ロビー ────────────────────────────────────────────
  if (screen === "lobby") return (
    <div style={S.root}>
      <div style={S.bg}/>
      <div style={S.center}>
        <div style={{ fontSize: 28, fontFamily: "Georgia,serif", color: "#ffe08a", letterSpacing: 6, marginBottom: 28 }}>JAK</div>

        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.inputGroup}>
            <label style={S.label}>あなたの名前</label>
            <input style={S.input} value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="名前を入力" maxLength={12} />
          </div>

          <button style={S.gold} onClick={createRoom}>ルームを作る</button>

          <div style={{ textAlign: "center", color: "#6050a0", fontSize: 12 }}>── または ──</div>

          <div style={S.inputGroup}>
            <label style={S.label}>ルームID（6文字）</label>
            <input style={S.input} value={inputId} onChange={e => setInputId(e.target.value)}
              placeholder="例: AB12CD" maxLength={6} />
          </div>
          <button style={S.blue} onClick={joinRoom}>ルームに参加</button>

          {error && <div style={{ color: "#ff7878", fontSize: 12, textAlign: "center" }}>{error}</div>}

          <button style={{ ...S.ghost, marginTop: 8 }} onClick={() => setScreen("title")}>← 戻る</button>
        </div>
      </div>
    </div>
  );

  // ── 待機中 ────────────────────────────────────────────
  if (screen === "wait") return (
    <div style={S.root}>
      <div style={S.bg}/>
      <div style={S.center}>
        <div style={{ fontSize: 22, fontFamily: "serif", color: "#ffe08a", marginBottom: 20 }}>対戦相手を待ってるで…</div>
        <div style={{ background: "rgba(201,168,76,.1)", border: "1px solid rgba(201,168,76,.3)", borderRadius: 12, padding: "18px 32px", textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#9080b8", letterSpacing: 2, marginBottom: 8 }}>ROOM ID</div>
          <div style={{ fontSize: 38, fontFamily: "monospace", fontWeight: 700, color: "#ffe08a", letterSpacing: 6 }}>{roomId}</div>
          <div style={{ fontSize: 11, color: "#7060a0", marginTop: 8 }}>友達にこのIDを教えてや</div>
        </div>
        <div style={{ color: "#6050a0", fontSize: 13, animation: "pulse .8s infinite alternate" }}>待機中…</div>
        <button style={{ ...S.ghost, marginTop: 24 }} onClick={() => { if(unsubRef.current) unsubRef.current(); remove(ref(db,`rooms/${roomId}`)); setScreen("lobby"); }}>
          キャンセル
        </button>
      </div>
      <style>{`@keyframes pulse{from{opacity:.4}to{opacity:1}}`}</style>
    </div>
  );

  // ── ゲームオーバー ────────────────────────────────────
  if (screen === "over") {
    const iWon = gs?.result === myRole;
    return (
      <div style={S.root}>
        <div style={S.bg}/>
        <div style={S.center}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>{iWon ? "🏆" : "💀"}</div>
          <div style={{ fontSize: 26, fontFamily: "serif", color: iWon ? "#7dde8a" : "#ff7878", marginBottom: 8 }}>
            {iWon ? "勝利！" : "敗北…"}
          </div>
          <div style={{ color: "#9080b0", fontSize: 13, marginBottom: 30 }}>
            最終チップ: {myChips()}
          </div>
          <button style={S.gold} onClick={() => { if(unsubRef.current) unsubRef.current(); setScreen("title"); }}>
            タイトルへ
          </button>
        </div>
      </div>
    );
  }

  // ── ゲーム画面 ────────────────────────────────────────
  if (!gs) return <div style={S.root}><div style={S.bg}/><div style={{ color: "#ffe08a", margin: "auto", marginTop: "40vh" }}>接続中…</div></div>;

  const isResult  = !!gs.result;
  const myTurn    = isMyTurn();
  const needCall  = (gs.toCall ?? 0) > 0 && myTurn;
  const canAct    = myTurn && !isResult;
  const myWin     = gs.result === myRole;
  const opWin     = gs.result === opRole();
  const showCards = gs.showCards;
  const mc        = myCard();
  const oc        = opCard();
  const hc        = hiddenCard();

  return (
    <div style={S.root}>
      <div style={S.bg}/>
      <div style={S.play}>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontFamily: "Georgia,serif", color: "#ffe08a", fontSize: 22, letterSpacing: 5 }}>JAK</span>
          <span style={{ color: "#6050a0", fontSize: 11 }}>ROUND {gs.round}</span>
        </div>

        {/* チップ */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 12 }}>
          <Chips label={myNameFromGs() || "あなた"} val={myChips()} gold />
          <Chips label="POT" val={gs.pot} />
          <Chips label={opNameFromGs() || "相手"} val={opChips()} />
        </div>

        {/* 相手のカード */}
        <div style={S.area}>
          <div style={S.aLabel}>{opNameFromGs() || "相手"}{!isResult && gs.turn === opRole() ? " 🤔" : ""}</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Card card={oc} hidden={!showCards} size="lg" winner={opWin} />
            {isResult && <div style={{ fontSize: 20, fontWeight: 700, color: opWin ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>
              {opWin ? "WIN" : "LOSE"}
            </div>}
          </div>
        </div>

        {/* 伏せ札 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "10px 0" }}>
          <div style={{ fontSize: 9, color: "#5040a0", letterSpacing: 2, marginBottom: 5 }}>HIDDEN</div>
          <Card card={hc} hidden={!isResult} size="sm" />
          {isResult && <div style={{ fontSize: 10, color: "#8070a0", marginTop: 3 }}>{hc?.name}</div>}
        </div>

        {/* 自分のカード */}
        <div style={S.area}>
          <div style={S.aLabel}>{myNameFromGs() || "あなた"}{!isResult && myTurn ? " ← あなたの番" : ""}</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Card card={mc} size="lg" winner={myWin} />
            {isResult && <div style={{ fontSize: 20, fontWeight: 700, color: myWin ? "#7dde8a" : "#ff7878", animation: "pop .4s ease" }}>
              {myWin ? "WIN" : "LOSE"}
            </div>}
          </div>
        </div>

        {/* ログ */}
        <div style={{ margin: "10px 0" }}><Log entries={log} /></div>

        {/* 相手待ち */}
        {!myTurn && !isResult && (
          <div style={{ textAlign: "center", color: "#c9a84c", fontSize: 12, padding: "6px 0", animation: "pulse .8s infinite alternate" }}>
            {opNameFromGs()}が考え中…
          </div>
        )}

        {/* アクション */}
        {canAct && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {needCall ? (
              <>
                <div style={{ textAlign: "center", color: "#ffe08a", fontSize: 12 }}>コール額: {gs.toCall}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.red,  flex: 1 }} onClick={() => sendAction("fold")}>フォールド</button>
                  <button style={{ ...S.blue, flex: 1 }} onClick={() => sendAction("call")}>コール</button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="range" min={(gs.toCall ?? 0) + 10} max={Math.min(myChips(), 600)} step={10}
                    value={slider} onChange={e => setSlider(+e.target.value)} style={{ flex: 1, accentColor: "#c9a84c" }} />
                  <span style={{ color: "#ffe08a", fontSize: 12, minWidth: 36 }}>{slider}</span>
                  <button style={{ ...S.gold, padding: "8px 10px", fontSize: 12 }} onClick={() => sendAction("raise", slider)}>リレイズ</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.red,  flex: 1 }} onClick={() => sendAction("fold")}>フォールド</button>
                  <button style={{ ...S.blue, flex: 1 }} onClick={() => sendAction("check")}>チェック</button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="range" min={10} max={Math.min(myChips(), 600)} step={10}
                    value={slider} onChange={e => setSlider(+e.target.value)} style={{ flex: 1, accentColor: "#c9a84c" }} />
                  <span style={{ color: "#ffe08a", fontSize: 12, minWidth: 36 }}>{slider}</span>
                  <button style={{ ...S.gold, padding: "8px 10px", fontSize: 12 }} onClick={() => sendAction("raise", slider)}>ベット</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 次のラウンド（ホストだけ表示） */}
        {isResult && myRole === "host" && (
          <button style={{ ...S.gold, width: "100%", marginTop: 10 }} onClick={goNextRound}>
            次のラウンドへ →
          </button>
        )}
        {isResult && myRole === "guest" && (
          <div style={{ textAlign: "center", color: "#7060a0", fontSize: 12, marginTop: 12 }}>
            ホストが次のラウンドを開始するのを待ってるで…
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

// ── スタイル ──────────────────────────────────────────────
const S = {
  root:  { minHeight: "100vh", background: "#080514", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden", fontFamily: "sans-serif" },
  bg:    { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 25%,#180d38,#080514 68%)" },
  center:{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 },
  play:  { position: "relative", zIndex: 1, width: "100%", maxWidth: 400, padding: "18px 14px", boxSizing: "border-box" },
  area:  { display: "flex", flexDirection: "column", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" },
  aLabel:{ fontSize: 10, color: "#7060a0", letterSpacing: 1, marginBottom: 8 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 11, color: "#9080b8", letterSpacing: 1 },
  input: { background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: "10px 12px", color: "#e8dff0", fontSize: 15, outline: "none" },
  gold:  { background: "linear-gradient(135deg,#c9a84c,#ffe08a)", color: "#1a0e00", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 18px rgba(201,168,76,.4)" },
  blue:  { background: "rgba(60,80,180,.3)", color: "#b0c0f0", border: "1px solid rgba(60,80,180,.55)", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  red:   { background: "rgba(160,40,40,.3)", color: "#ff9090", border: "1px solid rgba(160,40,40,.55)", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghost: { background: "transparent", color: "#7060a0", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer" },
};
