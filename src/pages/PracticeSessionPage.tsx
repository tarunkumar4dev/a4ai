// src/pages/PracticeSessionPage.tsx
// Practice "short contest" — v5 (premium gradient UI + perfect-fit avatar + real tabs)

import React, { useEffect, useMemo, useState } from "react";
import styled, { createGlobalStyle, css, keyframes } from "styled-components";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------- Global -------------------- */
const Global = createGlobalStyle`
  :root { color-scheme: light; }
  html, body, #root {
    font-family: "Plus Jakarta Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
                 Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    letter-spacing: 0.2px;
  }
  body {
    background:
      radial-gradient(1200px 800px at 6% -12%, #ecebff 0%, transparent 60%),
      radial-gradient(1200px 800px at 94% -18%, #e8fbff 0%, transparent 60%),
      linear-gradient(180deg, #f8f9ff 0%, #fbfcff 100%);
  }
`;

const BRAND = {
  grad: "linear-gradient(90deg, #6d5efc 0%, #8b5cf6 45%, #22c1fd 100%)",
  gradSoft: "linear-gradient(90deg, #e9e7ff 0%, #eaf5ff 50%, #e9fff6 100%)",
  ink: "#0f172a",
  muted: "#667085",
  surface: "#ffffff",
  surfaceSoft: "rgba(255,255,255,0.72)",
  success: "#16a34a",
  border: "#E7E9FF",
  halo: "0 16px 50px rgba(109,94,252,0.14)",
  inner: "inset 0 1px 0 rgba(255,255,255,0.7)",
};

const Page = styled.div`
  min-height: 100vh;
  padding: 28px;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
`;

const Card = styled(motion.div)`
  background: ${BRAND.surface};
  border: 1px solid rgba(231, 233, 255, .65);
  border-radius: 20px;
  box-shadow: ${BRAND.halo};
`;

/* -------------------- Header -------------------- */
const Glass = styled(Card)`
  background: ${BRAND.surfaceSoft};
  backdrop-filter: blur(10px);
  padding: 18px 20px;
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  align-items: center;
  gap: 16px;
  position: relative;
  overflow: hidden;
  &::after{
    content:"";
    position:absolute; inset:-2px -22% auto -22%;
    height: 6px; background: ${BRAND.grad};
    opacity:.25; filter: blur(10px);
    border-radius: 999px;
  }
`;

const Row = styled.div` display:flex; align-items:center; gap:12px; flex-wrap:wrap; `;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: ${BRAND.ink};
`;
const Sub = styled.div`
  font-size: 12px;
  color: ${BRAND.muted};
  font-weight: 600;
`;

const Chip = styled.span<{ tone?: "solid" | "soft" | "line" }>`
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 13px;
  ${(p) =>
    p.tone === "solid"
      ? css`background:${BRAND.grad}; color:#fff;`
      : p.tone === "soft"
      ? css`background:#f6f7ff; border:1px dashed rgba(231,233,255,.7); color:${BRAND.ink}; box-shadow:${BRAND.inner};`
      : css`background:#fff; border:1px solid rgba(231,233,255,.7); color:${BRAND.ink};`}
`;

const KeyHint = styled.div`
  padding: 8px 12px; border-radius: 12px; font-weight: 800; font-size: 12px; color: ${BRAND.ink};
  background: #f4f6ff; border: 1px dashed rgba(231,233,255,.7); box-shadow: ${BRAND.inner};
`;

const TimerPill = styled.div`
  padding: 10px 14px; border-radius: 14px; font-weight: 900; color: ${BRAND.ink};
  background: #edf2ff; border: 1px solid #dbe1ff;
  box-shadow: 0 8px 22px rgba(134,154,255,.25) inset;
`;

/* -------------------- Avatar: perfect-fit frame -------------------- */
/* No grey ring; uses conic-gradient frame that looks great with any avatar */
const pulse = keyframes`0%{transform:scale(1)}60%{transform:scale(1.03)}100%{transform:scale(1)}`;

const AvatarFrame = styled.div`
  --size: 56px;
  width: var(--size); height: var(--size); position: relative;
  border-radius: 999px;
  /* conic gradient frame */
  background:
    conic-gradient(from 220deg, #6d5efc, #8b5cf6, #22c1fd, #6d5efc);
  padding: 3px;           /* ring thickness */
  box-shadow: 0 10px 26px rgba(0,0,0,.10);
  animation: ${pulse} 2.2s ease-in-out infinite;
`;

const AvatarInner = styled.div<{ bg?: string }>`
  position: absolute; inset: 3px;
  border-radius: 999px;
  background: ${(p)=>p.bg || BRAND.grad};
  display:grid; place-items:center; overflow:hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -8px 20px rgba(0,0,0,.06);
  font-size: 24px;
`;

const AvatarImg = styled.img`
  width: 100%; height: 100%; object-fit: cover; display:block;
`;

const EditChip = styled(Chip)` cursor: pointer; `;

/* -------------------- Content -------------------- */
const ProgressCard = styled(Card)` padding: 18px 20px; display:grid; gap:12px; `;
const Bar = styled.div<{ pct:number; tint?: string }>`
  height: 12px; border-radius: 999px; background:#eef2ff; overflow:hidden; position:relative;
  &::after{content:""; position:absolute; inset:0; width:${p=>p.pct}%; background:${p=>p.tint || BRAND.grad};}
`;

const QCard = styled(Card)` padding: 20px; display:grid; gap: 18px; `;
const QTitle = styled.h2` margin:0; font-size: 22px; font-weight: 800; color:${BRAND.ink}; `;

const Opt = styled.button<{ state:"idle"|"chosen"|"correct"|"wrong" }>`
  width:100%; text-align:left; padding:16px 18px; border-radius:16px;
  font-weight: 800; font-size: 16px; letter-spacing: .2px;
  border: 2px solid #e8eaff; background: #fff; cursor:pointer; transition: .16s ease;
  display:flex; align-items:center; gap:10px;
  &:active { transform: translateY(0.5px); }
  &:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,.06); }

  ${(p)=>p.state==="chosen" && css`border-color:#cfd6ff; background:#f7f8ff;`}
  ${(p)=>p.state==="correct" && css`border-color:#86efac; background:#f0fdf4;`}
  ${(p)=>p.state==="wrong" && css`border-color:#fecaca; background:#fff1f2;`}
`;

const Footer = styled.div`
  display:flex; justify-content:space-between; align-items:center; margin-top:4px; gap:12px;
`;
const PrimaryBtn = styled.button`
  background:${BRAND.grad}; color:#fff; border:0; border-radius:14px; padding:12px 18px; font-weight:900; cursor:pointer;
`;
const GhostBtn = styled.button`
  background:#fff; color:${BRAND.ink}; border:1.5px solid rgba(231,233,255,.75); border-radius:14px; padding:12px 18px; font-weight:800; cursor:pointer;
`;

/* -------------------- Avatar Picker -------------------- */
type AvatarChoice = { id: string; label: string; emoji: string; gradient: string; category: string };
const AVATAR_PRESETS: AvatarChoice[] = [
  { id:"ani-cat",   label:"Cat",    emoji:"🐱", gradient:"linear-gradient(135deg,#c084fc,#60a5fa)", category:"Animal" },
  { id:"ani-panda", label:"Panda",  emoji:"🐼", gradient:"linear-gradient(135deg,#60a5fa,#34d399)", category:"Animal" },
  { id:"ani-tiger", label:"Tiger",  emoji:"🐯", gradient:"linear-gradient(135deg,#fca5a5,#fdba74)", category:"Animal" },
  { id:"kid-boy",   label:"Kid Boy",   emoji:"🧒", gradient:"linear-gradient(135deg,#93c5fd,#a7f3d0)", category:"Kid" },
  { id:"kid-girl",  label:"Kid Girl",  emoji:"👧", gradient:"linear-gradient(135deg,#a78bfa,#f9a8d4)", category:"Kid" },
  { id:"leg-king",  label:"Legend", emoji:"👑", gradient:"linear-gradient(135deg,#fcd34d,#f472b6)", category:"Legend" },
  { id:"leg-light", label:"Light",  emoji:"⚡", gradient:"linear-gradient(135deg,#60a5fa,#c084fc)", category:"Legend" },
  { id:"sp-ball",   label:"Ball",   emoji:"🏀", gradient:"linear-gradient(135deg,#fb7185,#f59e0b)", category:"Sport" },
  { id:"sp-run",    label:"Runner", emoji:"🏃", gradient:"linear-gradient(135deg,#34d399,#60a5fa)", category:"Sport" },
  { id:"ab-star",   label:"Star",   emoji:"⭐", gradient:"linear-gradient(135deg,#fbbf24,#60a5fa)", category:"Abstract" },
  { id:"ab-dna",    label:"DNA",    emoji:"🧬", gradient:"linear-gradient(135deg,#22c1fd,#8b5cf6)", category:"Abstract" },
];

type AvatarState = { kind: "preset"; presetId: string } | { kind: "url"; url: string };
const DEFAULT_AVATAR: AvatarState = { kind: "preset", presetId: "leg-light" };
const AVATAR_KEY = "a4ai:avatar";

const mockUser = { name: "Tarun", rank: 1427, streak: 9, xp: 3240 };

/* -------------------- utils -------------------- */
type Q = { id: string; text: string; options: string[]; answerIdx: number };
function useQueryParams() {
  const [sp] = useSearchParams();
  const subject = sp.get("subject") || "Practice";
  const difficulty = sp.get("difficulty") || "Easy";
  const minutes = Math.max(1, parseInt(sp.get("minutes") || "15", 10));
  const count = Math.max(1, parseInt(sp.get("count") || "10", 10));
  const topics = (sp.get("topics") || "").split(",").filter(Boolean);
  return { subject, difficulty, minutes, count, topics };
}
function generateQuestions(count:number, subject:string):Q[] {
  return Array.from({ length: count }).map((_, i) => {
    const x = i + 2;
    return { id:`q${i+1}`, text:`${subject}: If x = ${x}, what is x²?`, options:["x + 2", String(x*x), "x / 2", "2x"], answerIdx:1 };
  });
}

/* -------------------- avatar hooks -------------------- */
function useAvatar(): [AvatarState, (a:AvatarState)=>void] {
  const [state, setState] = useState<AvatarState>(() => {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? (JSON.parse(raw) as AvatarState) : DEFAULT_AVATAR;
  });
  const save = (a: AvatarState) => {
    setState(a);
    localStorage.setItem(AVATAR_KEY, JSON.stringify(a));
  };
  return [state, save];
}
function avatarVisual(a: AvatarState): { bg: string; emoji?: string; url?: string } {
  if (a.kind === "url") return { bg: BRAND.grad, url: a.url };
  const p = AVATAR_PRESETS.find(x => x.id === a.presetId) || AVATAR_PRESETS[0];
  return { bg: p.gradient, emoji: p.emoji };
}

/* -------------------- Component -------------------- */
export default function PracticeSessionPage() {
  const nav = useNavigate();
  const { subject, difficulty, minutes, count, topics } = useQueryParams();

  const [questions] = useState<Q[]>(() => generateQuestions(count, subject));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [revealed, setRevealed] = useState(false);
  const [secsLeft, setSecsLeft] = useState(minutes * 60);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);

  const [avatar, setAvatar] = useAvatar();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState<AvatarChoice["category"]>("Animal");

  const current = questions[idx];
  const answeredCount = Object.values(answers).filter(v => v !== null && v !== undefined).length;
  const score = useMemo(() => questions.reduce((a,q)=>a+(answers[q.id]===q.answerIdx?1:0),0), [answers, questions]);

  const xpEarned = score * 5;
  const rankDelta = score >= Math.ceil(questions.length * 0.8) ? -3 : score >= Math.ceil(questions.length * 0.5) ? -1 : 0;

  useEffect(() => {
    if (finished || paused) return;
    const t = setInterval(() => setSecsLeft(s => (s>0? s-1 : 0)), 1000);
    return () => clearInterval(t);
  }, [finished, paused]);

  useEffect(() => { if (secsLeft === 0 && !finished) submit(); }, [secsLeft]); // eslint-disable-line

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      const k = e.key.toLowerCase();
      if (k >= "1" && k <= "5") onChoose(parseInt(k,10)-1);
      else if (k === "n") next();
      else if (k === "p") prev();
      else if (k === "s") submit();
      else if (k === " ") { e.preventDefault(); setPaused(v=>!v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, answers, finished]);

  function onChoose(i:number) { setAnswers(m=>({ ...m, [current.id]: i })); setRevealed(true); }
  function next() { setRevealed(false); setIdx(i=>Math.min(i+1, questions.length-1)); }
  function prev() { setRevealed(false); setIdx(i=>Math.max(i-1, 0)); }
  function submit() { setFinished(true); setRevealed(true); }

  const pct = Math.round(((idx + 1) / questions.length) * 100);
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const ss = String(secsLeft % 60).padStart(2, "0");
  const timePct = Math.max(0, Math.min(1, secsLeft/(minutes*60)));
  const R = 30, C = 2*Math.PI*R, offset = C*(1-timePct);

  const visual = avatarVisual(avatar);

  return (
    <>
      <Global />
      <Page>
        {/* LEFT */}
        <div style={{ display:"grid", gap:16 }}>
          <Glass initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
            <div>
              <Row>
                <div title="Edit avatar" onClick={()=>setPickerOpen(true)} style={{ cursor:"pointer" }}>
                  {/* Timer ring behind, then our frame (no grey ring) */}
                  <div style={{ position:"relative", width:64, height:64 }}>
                    <svg width="64" height="64" viewBox="0 0 64 64" style={{ position:"absolute", inset:0 }}>
                      <circle cx="32" cy="32" r={R} stroke="#eef2ff" strokeWidth="6" fill="none" />
                      <motion.circle
                        cx="32" cy="32" r={R} stroke="url(#g1)" strokeWidth="6" fill="none"
                        strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: offset }}
                        transition={{ ease:"linear", duration:.3 }}
                      />
                      <defs>
                        <linearGradient id="g1" x1="0" x2="1">
                          <stop offset="0%" stopColor="#6d5efc"/><stop offset="50%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#22c1fd"/>
                        </linearGradient>
                      </defs>
                    </svg>
                    <div style={{ position:"absolute", inset:4, display:"grid", placeItems:"center" }}>
                      <AvatarFrame>
                        <AvatarInner bg={visual.bg}>
                          {visual.url ? <AvatarImg alt="avatar" src={visual.url} /> : <span>{visual.emoji}</span>}
                        </AvatarInner>
                      </AvatarFrame>
                    </div>
                  </div>
                </div>

                <div>
                  <Title>{subject} • {difficulty}</Title>
                  <Sub>{topics.length ? topics.join(", ") : "General practice"}</Sub>
                </div>
              </Row>

              <Row style={{ marginTop: 10 }}>
                <Chip tone="soft">Q {idx + 1}/{questions.length}</Chip>
                <Chip tone="line">Rank #{mockUser.rank + rankDelta}</Chip>
                <Chip tone="line">XP {mockUser.xp + xpEarned}</Chip>
                <Chip tone="soft">🔥 Streak {mockUser.streak} days</Chip>
                <EditChip tone="line" onClick={() => setPickerOpen(true)}>Edit Avatar</EditChip>
              </Row>
            </div>

            <Row>
              <KeyHint>Space = Pause/Resume</KeyHint>
              <TimerPill>⏱ {mm}:{ss}</TimerPill>
              <GhostBtn onClick={()=>setPaused(v=>!v)}>{paused ? "Resume" : "Pause"}</GhostBtn>
            </Row>
          </Glass>

          <ProgressCard>
            <div style={{ fontWeight:800, color:BRAND.ink, fontSize:16 }}>Progress</div>
            <Bar pct={pct} />
            <div style={{ display:"flex", justifyContent:"space-between", color:BRAND.muted, fontWeight:700 }}>
              <span>Answered: {answeredCount}</span><span>Score: {score}</span>
            </div>
          </ProgressCard>

          <QCard key={current.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}>
            <QTitle dangerouslySetInnerHTML={{ __html: current.text }} />
            <div style={{ display:"grid", gap:12 }}>
              {current.options.map((op, i) => {
                const chosen = answers[current.id] === i;
                const isCorrect = i === current.answerIdx;
                const state: "idle"|"chosen"|"correct"|"wrong" =
                  revealed ? (isCorrect ? "correct" : chosen ? "wrong" : "idle") : chosen ? "chosen" : "idle";
                return (
                  <Opt key={i} state={state} onClick={() => onChoose(i)}>
                    <strong style={{ width:24, textAlign:"center" }}>{String.fromCharCode(65+i)}.</strong> {op}
                  </Opt>
                );
              })}
            </div>

            <Footer>
              <div style={{ display:"flex", gap:10 }}>
                <GhostBtn onClick={prev} disabled={idx===0}>← Prev (P)</GhostBtn>
                <GhostBtn onClick={next} disabled={idx===questions.length-1}>Next (N) →</GhostBtn>
              </div>
              <PrimaryBtn onClick={submit}>Submit (S)</PrimaryBtn>
            </Footer>
          </QCard>
        </div>

        {/* RIGHT */}
        <div style={{ display:"grid", gap:16 }}>
          <Card style={{ padding:20, backgroundImage:BRAND.gradSoft }}>
            <div style={{ fontWeight:800, color:BRAND.ink, marginBottom:10, fontSize:16 }}>Session</div>
            <div style={{ display:"grid", gap:10 }}>
              <div><Chip tone="solid">Timed: {minutes}m</Chip></div>
              <div style={{ color:BRAND.muted, fontWeight:600 }}>Quick practice mode. Earn streaks & badges after submit.</div>
            </div>
          </Card>

          <Card style={{ padding:20 }}>
            <div style={{ fontWeight:800, color:BRAND.ink, marginBottom:10, fontSize:16 }}>Leaderboard (Today)</div>
            <div style={{ display:"grid", gap:10 }}>
              {[
                { name:"Aditi", score:9, rank:1 },
                { name:"Rohan", score:8, rank:2 },
                { name:mockUser.name, score, rank: Math.max(3, 12 - score) },
              ].map((u,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"12px 14px", borderRadius:14, background:"#f7f7ff", border:"1px solid rgba(231,233,255,.7)", boxShadow:BRAND.inner }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:28, height:28, borderRadius:999, background:BRAND.grad }} />
                    <b style={{ fontWeight:800 }}>{u.rank}. {u.name}</b>
                  </div>
                  <span style={{ fontWeight:900 }}>{u.score}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding:20 }}>
            <div style={{ fontWeight:800, color:BRAND.ink, marginBottom:10, fontSize:16 }}>Badge Target</div>
            <div style={{ display:"grid", gap:8 }}>
              <span>Score ≥ 80% to unlock <b>Fast Thinker</b></span>
              <Bar pct={Math.min(100, Math.round((score/questions.length)*100))} tint={BRAND.success} />
            </div>
          </Card>
        </div>
      </Page>

      {/* RESULT */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed", inset:0, background:"rgba(17,24,39,.45)", display:"grid", placeItems:"center", padding:20 }}
          >
            <Card
              initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:.95, opacity:0 }}
              style={{ padding:26, maxWidth:560, width:"100%" }}
            >
              <div style={{ display:"grid", gap:14, textAlign:"center" }}>
                <h2 style={{ margin:0, color:BRAND.ink, fontWeight:800 }}>Nice work, {mockUser.name}! 🎯</h2>
                <div style={{ color:BRAND.muted, fontWeight:700 }}>
                  You scored <b>{score}</b> / {questions.length}. Time left: {mm}:{ss}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginTop:6 }}>
                  <div style={{ padding:12, borderRadius:12, background:"#f7f7ff", border:"1px solid rgba(231,233,255,.7)", boxShadow:BRAND.inner }}>
                    <div style={{ fontSize:12, color:BRAND.muted }}>XP Earned</div>
                    <div style={{ fontWeight:900, fontSize:18 }}>{xpEarned}</div>
                  </div>
                  <div style={{ padding:12, borderRadius:12, background:"#f7f7ff", border:"1px solid rgba(231,233,255,.7)", boxShadow:BRAND.inner }}>
                    <div style={{ fontSize:12, color:BRAND.muted }}>Rank Change</div>
                    <div style={{ fontWeight:900, fontSize:18, color: rankDelta<0?BRAND.success:BRAND.muted }}>
                      {rankDelta<0 ? `${rankDelta}` : "+0"}
                    </div>
                  </div>
                  <div style={{ padding:12, borderRadius:12, background:"#f7f7ff", border:"1px solid rgba(231,233,255,.7)", boxShadow:BRAND.inner }}>
                    <div style={{ fontSize:12, color:BRAND.muted }}>Badge</div>
                    <div style={{ fontWeight:900, fontSize:18 }}>
                      {Math.round((score/questions.length)*100) >= 80 ? "🏅 Fast Thinker" : "—"}
                    </div>
                  </div>
                </div>

                <Bar pct={Math.round((score/questions.length)*100)} tint={BRAND.success} />

                <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:8 }}>
                  <GhostBtn onClick={() => { setFinished(false); setIdx(0); setAnswers({}); setSecsLeft(minutes*60); setRevealed(false); }}>
                    Redo
                  </GhostBtn>
                  <PrimaryBtn onClick={() => nav("/practice")}>Back to Practice</PrimaryBtn>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AVATAR PICKER */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", display:"grid", placeItems:"center", padding:20, zIndex:50 }}
          >
            <Card
              initial={{ scale:.96, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:.98, opacity:0 }}
              style={{ padding:22, maxWidth:820, width:"100%" }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:BRAND.ink }}>Choose your avatar</h3>
                <GhostBtn onClick={()=>setPickerOpen(false)}>Close</GhostBtn>
              </div>

              {/* Tabs */}
              <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                {["Animal","Kid","Legend","Sport","Abstract"].map(cat=>{
                  const active = tab===cat;
                  return (
                    <button key={cat}
                      onClick={()=>setTab(cat as any)}
                      style={{
                        padding:"8px 12px", borderRadius:999, fontWeight:800, fontSize:13,
                        background: active ? "white" : "#f3f5ff",
                        border: active ? "1px solid rgba(231,233,255,.9)" : "1px dashed rgba(231,233,255,.9)",
                        cursor:"pointer"
                      }}>
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Grid (auto-fit + scroll if needed) */}
              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:12 }}>
                  {AVATAR_PRESETS.filter(p=>p.category===tab).map(p=>(
                    <button key={p.id}
                      onClick={()=>{ setAvatar({ kind:"preset", presetId:p.id }); setPickerOpen(false); }}
                      style={{
                        border:"1px solid rgba(231,233,255,.9)", background:"#fff", borderRadius:16, padding:14, cursor:"pointer",
                        textAlign:"center", boxShadow:"0 6px 22px rgba(17,24,39,.06)"
                      }}>
                      <div style={{
                        width:64, height:64, margin:"0 auto 10px", borderRadius:999,
                        background:p.gradient, display:"grid", placeItems:"center", fontSize:26,
                        boxShadow:"inset 0 1px 0 rgba(255,255,255,.8)"
                      }}>{p.emoji}</div>
                      <div style={{ fontWeight:900, color:BRAND.ink }}>{p.label}</div>
                      <div style={{ fontSize:12, color:BRAND.muted }}>{p.category}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom URL */}
              <div style={{ marginTop:16, display:"grid", gap:8 }}>
                <div style={{ fontWeight:800, color:BRAND.ink }}>Or use an image URL</div>
                <UrlRow
                  placeholder="https://…/my-photo.png"
                  onSubmit={(url) => { setAvatar({ kind:"url", url }); setPickerOpen(false); }}
                />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* small controlled URL form component */
function UrlRow({ placeholder, onSubmit }: { placeholder:string; onSubmit:(url:string)=>void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ display:"flex", gap:8 }}>
      <input
        value={val}
        onChange={(e)=>setVal(e.target.value)}
        placeholder={placeholder}
        style={{ flex:1, padding:"12px 14px", borderRadius:12, border:"1px solid rgba(231,233,255,.9)", outline:"none", fontWeight:700 }}
      />
      <button
        onClick={()=>val && onSubmit(val)}
        style={{ padding:"12px 16px", borderRadius:12, border:0, background:BRAND.grad, color:"#fff", fontWeight:900, cursor:"pointer" }}
      >
        Use
      </button>
    </div>
  );
}
