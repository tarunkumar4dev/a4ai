// src/pages/ContestLandingPage.tsx — Level-aware Contest Zone v2 (route-based Preview)
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { css, keyframes, createGlobalStyle } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { useCoins } from "@/context/CoinContext"; // named export

type LevelKey = "primary" | "middle" | "high" | "college" | "pro";

interface Contest {
  id: string;
  title: string;
  type: string;
  startTime: string;
  duration: string;
  participants: number;
  format: string;
  difficulty: string;
  description: string;
  rules: string[];
  prizes: { rank: string; prize: string }[];
  topics: string[];
}

/* ==================== Global Fonts ==================== */
const GlobalFonts = createGlobalStyle`
  @font-face {
    font-family: 'HalenoirExpDemiBold';
    src: url('/fonts/Halenoir-Expanded-DemiBold.woff2') format('woff2'),
         url('/fonts/Halenoir-Expanded-DemiBold.woff') format('woff');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }

  html, body, #root {
    font-family: 'HalenoirExpDemiBold', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji','Segoe UI Emoji';
    letter-spacing: .1px;
  }

  .keep-default-font {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans';
    letter-spacing: -0.02em;
    font-weight: 900;
  }

  * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
`;

/* ==================== Level Themes ==================== */
const LEVELS: Record<
  LevelKey,
  {
    name: string;
    bg1: string; bg2: string;
    accent1: string; accent2: string; accent3: string;
    btnGrad: [string, string];
    chipBg: string;
    backdropTint: string;
    strokeSoft: string;
  }
> = {
  primary: {
    name: "Primary",
    bg1: "#F9FEFF", bg2: "#FFF8F4",
    accent1: "#34D399", accent2: "#60A5FA", accent3: "#FCD34D",
    btnGrad: ["#34D399", "#10B981"],
    chipBg: "#EFFFF8",
    backdropTint: "rgba(252, 211, 77, 0.08)",
    strokeSoft: "rgba(17,24,39,0.08)",
  },
  middle: {
    name: "Middle",
    bg1: "#F7FBFF", bg2: "#F5F3FF",
    accent1: "#3B82F6", accent2: "#A78BFA", accent3: "#22D3EE",
    btnGrad: ["#60A5FA", "#3B82F6"],
    chipBg: "#EEF5FF",
    backdropTint: "rgba(167,139,250,0.10)",
    strokeSoft: "rgba(30,58,138,0.10)",
  },
  high: {
    name: "High",
    bg1: "#F7FFFD", bg2: "#F9FBFF",
    accent1: "#10B981", accent2: "#0EA5E9", accent3: "#111827",
    btnGrad: ["#22C55E", "#16A34A"],
    chipBg: "#EBFFF5",
    backdropTint: "rgba(14,165,233,0.10)",
    strokeSoft: "rgba(2,6,23,0.10)",
  },
  college: {
    name: "College",
    bg1: "#F6FAFF", bg2: "#F6FFF9",
    accent1: "#2563EB", accent2: "#06B6D4", accent3: "#F59E0B",
    btnGrad: ["#4F46E5", "#2563EB"],
    chipBg: "#EAF1FF",
    backdropTint: "rgba(37,99,235,0.08)",
    strokeSoft: "rgba(2,6,23,0.08)",
  },
  pro: {
    name: "Pro",
    bg1: "#F7F8FB", bg2: "#F4FAFF",
    accent1: "#EF4444", accent2: "#FB923C", accent3: "#0EA5E9",
    btnGrad: ["#EF4444", "#DC2626"],
    chipBg: "#FFF0F0",
    backdropTint: "rgba(239,68,68,0.08)",
    strokeSoft: "rgba(2,6,23,0.10)",
  },
};

const NAVY = "#0B1220";
const SUB = "#6B7280";
const RING = "rgba(11,18,32,0.08)";
const CARD = "rgba(255,255,255,0.9)";

/* ==================== Animations ==================== */
const floaty = keyframes`
  0% { transform: translateY(0px) }
  50% { transform: translateY(-6px) }
  100% { transform: translateY(0px) }
`;
const drift = keyframes`
  0% { transform: translateY(0) translateX(0) rotate(0); opacity:.6 }
  50% { transform: translateY(-12px) translateX(6px) rotate(6deg); opacity:.9 }
  100% { transform: translateY(0) translateX(0) rotate(0); opacity:.6 }
`;

/* ==================== Layout ==================== */
const Page = styled.div<{ $lvl: LevelKey }>`
  min-height: 100vh;
  background: ${({ $lvl }) => `
    radial-gradient(900px 550px at 10% -5%, ${LEVELS[$lvl].bg1} 0%, transparent 60%),
    radial-gradient(900px 550px at 95% 110%, ${LEVELS[$lvl].bg2} 0%, transparent 60%),
    linear-gradient(180deg, ${LEVELS[$lvl].bg1}, ${LEVELS[$lvl].bg2})
  `};
  position: relative;
  overflow: hidden;
`;

const Shell = styled.div`
  max-width: 1200px; margin: 0 auto; padding: 24px 16px 56px;
  display: grid; grid-template-columns: 1.25fr .75fr; gap: 24px;
  @media (max-width: 1024px){ grid-template-columns: 1fr; }
`;

/* ==================== Card & UI ==================== */
const CardWrap = styled(motion.section)`
  background: ${CARD};
  backdrop-filter: blur(10px);
  border: 1px solid ${RING};
  border-radius: 20px;
  box-shadow: 0 14px 38px -16px rgba(2,6,23,.18);
  padding: 16px;
`;

const TitleRow = styled.div`display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;`;

const H1 = styled.h1`
  margin: 0;
  font-size: clamp(1.9rem, 3.2vw, 2.7rem);
  line-height: 1.1;
`;

const Sub = styled.p`
  margin: 6px 0 0;
  color: ${SUB};
  font-size: .98rem;
`;

const Tag = styled.span<{ $lvl: LevelKey }>`
  display:inline-flex; align-items:center; gap:.4rem; padding:.38rem .6rem;
  border-radius:999px; font-size:.78rem; color:${NAVY}; font-weight:800;
  background:${({$lvl})=>LEVELS[$lvl].chipBg}; border:1px solid ${RING};
`;

const BtnRow = styled.div`display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;`;

const Btn = styled(motion.button)<{ $lvl: LevelKey; $tone?: "solid" | "ghost" }>`
  ${({ $lvl, $tone }) => $tone === "ghost" ? css`
    background: transparent; color:${NAVY}; border: 1px solid ${RING};
    &:hover{ background: rgba(0,0,0,.03); }
  ` : css`
    background: linear-gradient(180deg, ${LEVELS[$lvl].btnGrad[0]}, ${LEVELS[$lvl].btnGrad[1]});
    color: white; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 10px 22px rgba(0,0,0,.12);
    &:hover{ filter: brightness(1.05); box-shadow: 0 14px 28px rgba(0,0,0,.16); }
  `}
  padding:.78rem 1.05rem; border-radius:14px; font-weight:900; letter-spacing:.01em; cursor:pointer;
  transition: transform .15s ease, box-shadow .2s ease, filter .2s ease;
  &:active{ transform: translateY(0) scale(.99); }
`;

/* ==================== Switcher ==================== */
const Switcher = styled.div`display:inline-flex; gap:6px; padding:6px; background:#fff; border:1px solid ${RING}; border-radius:14px;`;
const Pill = styled.button<{ active?: boolean }>`
  padding:6px 10px; border-radius:10px; font-weight:800; font-size:.82rem; cursor:pointer;
  color:${({active})=>active?"#0B1220":"#6B7280"}; background:${({active})=>active?"#F2F6FF":"transparent"}; border:1px solid ${RING};
`;

/* ==================== Mascot ==================== */
const MascotBox = styled(motion.div)<{ $lvl: LevelKey }>`
  width: 152px; height: 152px; border-radius: 20px; border:1px solid ${RING};
  display:grid; place-items:center; animation:${floaty} 4.5s ease-in-out infinite;
  background: ${({$lvl})=>`linear-gradient(180deg, ${LEVELS[$lvl].bg1}, ${LEVELS[$lvl].bg2})`};
  box-shadow: 0 12px 30px rgba(0,0,0,.1);
`;

function Mascot({ lvl }: { lvl: LevelKey }) {
  const L = LEVELS[lvl];
  const band = L.accent2, deco = L.accent3;

  const accessory = (() => {
    switch (lvl) {
      case "primary": return <circle cx="68" cy="26" r="10" fill={L.accent1} stroke={NAVY} strokeWidth="2"/>;
      case "middle":  return <g transform="translate(66,22)"><circle r="9" fill={deco} stroke={NAVY} strokeWidth="2"/><path d="M-4,2 h8 v6 h-8z" fill="#fff" stroke={NAVY} strokeWidth="1.5"/></g>;
      case "high":    return <g transform="translate(68,24)"><path d="M0 -10 L6 0 L0 10 L-6 0 Z" fill={deco} stroke={NAVY} strokeWidth="2"/></g>;
      case "college": return <g transform="translate(68,22)"><path d="M-8 -4 H8 V4 H-8 Z" fill={deco} stroke={NAVY} strokeWidth="2"/><path d="M-6 4 V10 H6 V4" stroke={NAVY} strokeWidth="2"/></g>;
      case "pro":     return <g transform="translate(66,22)"><path d="M0 -10 C4 -6, 6 -2, 0 0 C-6 2,-2 8,0 10" fill="none" stroke={deco} strokeWidth="3" strokeLinecap="round"/></g>;
      default: return null;
    }
  })();

  return (
    <svg width="104" height="104" viewBox="0 0 96 96" fill="none" aria-label="Contest Mascot">
      <circle cx="48" cy="46" r="26" fill="#FFF" stroke={NAVY} strokeWidth="3"/>
      <path d="M26 40 C32 26, 64 26, 70 40" stroke={NAVY} strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M22 42 H74" stroke={band} strokeWidth="7" strokeLinecap="round"/>
      <ellipse cx="38" cy="48" rx="6" ry="7" fill={NAVY}/>
      <ellipse cx="58" cy="48" rx="6" ry="7" fill={NAVY}/>
      <circle cx="36.4" cy="46.2" r="1.6" fill="#fff"/><circle cx="56.4" cy="46.2" r="1.6" fill="#fff"/>
      <path d="M38 60 C44 66, 52 66, 58 60" stroke={NAVY} strokeWidth="3" strokeLinecap="round" fill="none"/>
      {accessory}
    </svg>
  );
}

/* ==================== Stats ==================== */
const Grid = styled.div`
  display:grid; gap:12px; grid-template-columns: repeat(4, minmax(0,1fr));
  @media (max-width: 900px){ grid-template-columns: repeat(2, minmax(0,1fr)); }
  @media (max-width: 520px){ grid-template-columns: 1fr; }
`;
const Stat = styled(CardWrap)`padding:14px 16px;`;
const StatH = styled.div`color:${SUB}; font-weight:800; font-size:.82rem;`;
const StatV = styled.div`color:${NAVY}; font-weight:900; font-size:1.5rem; margin-top:4px;`;
const Meter = styled.div`height:8px; background:#E5E7EB; border-radius:999px; overflow:hidden; margin-top:8px;`;
const Fill = styled.div<{ w:number; c1:string; c2:string }>`
  width:${p=>p.w}%; height:100%; background: linear-gradient(90deg, ${p=>p.c1}, ${p=>p.c2});
`;

/* ==================== Tabs + List ==================== */
const Tabs = styled.div`display:flex; gap:8px; flex-wrap:wrap;`;
const Tab = styled(motion.button)<{ $active?:boolean }>`
  padding:.55rem .9rem; border-radius:12px; font-weight:800; font-size:.9rem; border:1px solid ${RING};
  cursor:pointer; color:${p=>p.$active?NAVY:SUB}; background:${p=>p.$active?"#fff":"transparent"};
  &:hover{ background:#fff; color:${NAVY}; }
`;
const List = styled.div``;
const Row = styled(motion.div)`
  display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center;
  padding:14px; border:1px solid ${RING}; border-radius:16px; background:#fff; box-shadow:0 10px 22px rgba(0,0,0,.06); margin-bottom:10px;
`;
const Name = styled.div`font-weight:900; color:${NAVY}; font-size:1.04rem;`;
const Meta = styled.div`color:${SUB}; display:flex; flex-wrap:wrap; gap:.6rem; font-size:.92rem;`;

/* ==================== Themed Backdrop (per level) ==================== */
const Backdrop = styled.div<{ $lvl: LevelKey }>`
  position:absolute; inset:0; pointer-events:none;
  &:before, &:after { content:''; position:absolute; inset:0; }
  &:before { background:${({$lvl})=>LEVELS[$lvl].backdropTint}; }
  ${({$lvl}) => $lvl === "primary" && css`
    &:after{
      background:
        radial-gradient(60px 60px at 8% 16%, rgba(96,165,250,.18) 0, transparent 70%),
        radial-gradient(60px 60px at 92% 22%, rgba(52,211,153,.18) 0, transparent 70%),
        repeating-linear-gradient(45deg, ${LEVELS[$lvl].strokeSoft}, ${LEVELS[$lvl].strokeSoft} 2px, transparent 2px, transparent 18px);
      mask-image: radial-gradient(80% 60% at 50% 30%, #000, transparent 75%);
      animation:${drift} 10s ease-in-out infinite;
    }
  `}
  ${({$lvl}) => $lvl === "middle" && css`
    &:after{
      background:
        radial-gradient(50px 50px at 12% 18%, rgba(167,139,250,.22) 0, transparent 70%),
        radial-gradient(50px 50px at 84% 12%, rgba(34,211,238,.18) 0, transparent 70%),
        linear-gradient(90deg, transparent 48%, ${LEVELS[$lvl].strokeSoft} 48%, ${LEVELS[$lvl].strokeSoft} 52%, transparent 52%),
        linear-gradient(0deg, transparent 48%, ${LEVELS[$lvl].strokeSoft} 48%, ${LEVELS[$lvl].strokeSoft} 52%, transparent 52%);
      mask-image: radial-gradient(80% 60% at 50% 30%, #000, transparent 75%);
      opacity:.8; animation:${drift} 12s ease-in-out infinite;
    }
  `}
  ${({$lvl}) => $lvl === "high" && css`
    &:after{
      background:
        radial-gradient(70px 70px at 14% 22%, rgba(14,165,233,.22) 0, transparent 70%),
        radial-gradient(80px 80px at 86% 18%, rgba(16,185,129,.20) 0, transparent 70%),
        linear-gradient(0deg, rgba(2,6,23,.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(2,6,23,.06) 1px, transparent 1px);
      background-size: auto, auto, 28px 28px, 28px 28px;
      mask-image: radial-gradient(80% 60% at 50% 30%, #000, transparent 75%);
      opacity:.7; animation:${drift} 14s ease-in-out infinite;
    }
  `}
  ${({$lvl}) => $lvl === "college" && css`
    &:after{
      background:
        radial-gradient(60px 60px at 20% 12%, rgba(37,99,235,.18) 0, transparent 70%),
        radial-gradient(60px 60px at 80% 24%, rgba(6,182,212,.18) 0, transparent 70%),
        radial-gradient(40px 40px at 70% 80%, rgba(245,158,11,.16) 0, transparent 70%);
      mask-image: radial-gradient(80% 60% at 50% 30%, #000, transparent 75%);
      animation:${drift} 11s ease-in-out infinite;
    }
  `}
  ${({$lvl}) => $lvl === "pro" && css`
    &:after{
      background:
        radial-gradient(80px 80px at 18% 14%, rgba(239,68,68,.20) 0, transparent 70%),
        radial-gradient(70px 70px at 82% 18%, rgba(251,146,60,.18) 0, transparent 70%),
        radial-gradient(60px 60px at 60% 86%, rgba(14,165,233,.16) 0, transparent 70%);
      mask-image: radial-gradient(80% 60% at 50% 30%, #000, transparent 75%);
      animation:${drift} 9s ease-in-out infinite;
    }
  `}
`;

/* ==================== Component ==================== */
const ContestLandingPage: React.FC = () => {
  const nav = useNavigate();
  const [lvl, setLvl] = useState<LevelKey>("college");
  const [tab, setTab] = useState<"upcoming"|"ongoing"|"past">("upcoming");

  const { coins, addCoins } = useCoins();

  const user = { name: "Tarun", handle: "a4ai_student" };
  const stats = { solved: 162, total: 1200, rating: 1420, streak: 9, badges: 7 };
  const tracks = ["Math", "Science", "Coding", "GK", "Business"];

  const contestData: Record<string, Contest> = {
    "math-weekly": {
      id: "math-weekly",
      title: "Math Weekly #24",
      type: "Weekly Challenge",
      startTime: "2 days",
      duration: "60 minutes",
      participants: 220,
      format: "MCQ",
      difficulty: "Intermediate",
      description:
        "Test your mathematical skills in this weekly challenge covering algebra, geometry, and calculus. Perfect for students preparing for competitive exams.",
      rules: [
        "No external calculators allowed",
        "Must complete within time limit",
        "One attempt per participant",
        "Answers cannot be changed after submission",
        "Score based on accuracy and speed",
      ],
      prizes: [
        { rank: "1st", prize: "$500 + 500 coins" },
        { rank: "2nd", prize: "$300 + 300 coins" },
        { rank: "3rd", prize: "$200 + 200 coins" },
        { rank: "4th-10th", prize: "$50 + 100 coins" },
      ],
      topics: ["Algebra", "Geometry", "Calculus", "Trigonometry", "Statistics"],
    },
    "sci-lab": {
      id: "sci-lab",
      title: "Science Lab Sprint",
      type: "Lab Challenge",
      startTime: "3 days",
      duration: "45 minutes",
      participants: 310,
      format: "Mixed",
      difficulty: "Advanced",
      description:
        "A fast-paced science challenge testing your knowledge in physics, chemistry, and biology with interactive lab scenarios.",
      rules: [
        "Scientific calculators allowed",
        "Time-bound sections",
        "Partial credit for steps shown",
        "No external resources",
        "Auto-submit when time ends",
      ],
      prizes: [
        { rank: "1st", prize: "$750 + 500 coins" },
        { rank: "2nd", prize: "$400 + 300 coins" },
        { rank: "3rd", prize: "$250 + 200 coins" },
        { rank: "4th-10th", prize: "$75 + 100 coins" },
      ],
      topics: ["Physics", "Chemistry", "Biology", "Scientific Methods"],
    },
    "gk-rapid": {
      id: "gk-rapid",
      title: "GK Rapid Fire",
      type: "Rapid Fire",
      startTime: "5 days",
      duration: "25 minutes",
      participants: 540,
      format: "Rapid",
      difficulty: "Beginner",
      description:
        "Quick-fire general knowledge questions covering current affairs, history, geography, and more. Test your quick thinking!",
      rules: [
        "5 seconds per question",
        "No skipping questions",
        "Points decrease with time",
        "Instant feedback",
        "Leaderboard updates in real-time",
      ],
      prizes: [
        { rank: "1st", prize: "$300 + 500 coins" },
        { rank: "2nd", prize: "$150 + 300 coins" },
        { rank: "3rd", prize: "$100 + 200 coins" },
        { rank: "4th-20th", prize: "$25 + 50 coins" },
      ],
      topics: ["Current Affairs", "History", "Geography", "Sports", "Entertainment"],
    },
  };

  const buckets = useMemo(
    () => ({
      upcoming: [
        { id: "math-weekly", title: "Math Weekly #24", startsIn: "2d", participants: 220, len: "60m", type: "MCQ" },
        { id: "sci-lab", title: "Science Lab Sprint", startsIn: "3d", participants: 310, len: "45m", type: "Mixed" },
        { id: "gk-rapid", title: "GK Rapid Fire", startsIn: "5d", participants: 540, len: "25m", type: "Rapid" },
      ],
      ongoing: [
        { id: "phy-masters", title: "Physics Masters (Live)", endsIn: "32m", participants: 96, len: "90m", type: "Mixed" },
      ],
      past: [
        { id: "apt-open", title: "Aptitude Open 2025 #3", date: "May 12", participants: 980, rank: 143 },
        { id: "cs-derby", title: "CS Fundamentals Derby", date: "Apr 28", participants: 740, rank: 210 },
      ],
    }),
    []
  );

  const handlePreviewClick = (contestId: string) => {
    if (!contestId) {
      console.warn("No contest.id for Preview");
      return;
    }
    nav(`/contests/preview/${contestId}`, { state: { from: "/contests" } });
  };

  const handleJoinContest = (contestId: string) => {
    addCoins(50, `Joined contest: ${contestData[contestId]?.title || "Unknown Contest"}`, contestId);
    nav(`/contests/live/${contestId}`);
  };

  const L = LEVELS[lvl];
  const list = (buckets as any)[tab] as any[];

  return (
    <>
      <GlobalFonts />
      <Page $lvl={lvl}>
        <Backdrop $lvl={lvl} />
        <Shell>
          {/* LEFT */}
          <CardWrap initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <TitleRow>
              <H1 className="keep-default-font">Contest Zone</H1>
              <Switcher role="tablist" aria-label="Select level">
                {(["primary", "middle", "high", "college", "pro"] as LevelKey[]).map((k) => (
                  <Pill key={k} active={lvl === k} onClick={() => setLvl(k)} aria-pressed={lvl === k}>
                    {LEVELS[k].name}
                  </Pill>
                ))}
              </Switcher>
            </TitleRow>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 16,
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <MascotBox $lvl={lvl}>
                <Mascot lvl={lvl} />
              </MascotBox>
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Tag $lvl={lvl}>Safe & Fair</Tag>
                  <Tag $lvl={lvl}>No Cheating</Tag>
                  <Tag $lvl={lvl}>Earn Coins</Tag>
                </div>
                <Sub>
                  Play live contests, earn coins, rank up, and win badges. Join a round or create your own in a few
                  clicks.
                </Sub>
                <BtnRow>
                  <Btn $lvl={lvl} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => nav("/contests/join")} type="button">
                    Join a Contest
                  </Btn>
                  <Btn $lvl={lvl} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => nav("/contests/create")} type="button">
                    Create Contest
                  </Btn>
                  <Btn $lvl={lvl} $tone="ghost" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => nav("/rules")} type="button">
                    Rules
                  </Btn>
                </BtnRow>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {tracks.map((t) => (
                    <Tag $lvl={lvl} key={t}>
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 16 }}>
              <Grid>
                <Stat>
                  <StatH>Problems Solved</StatH>
                  <StatV>
                    {stats.solved.toLocaleString()} / {stats.total.toLocaleString()}
                  </StatV>
                  <Meter>
                    <Fill w={(stats.solved / stats.total) * 100} c1={L.accent1} c2={L.accent2} />
                  </Meter>
                </Stat>
                <Stat>
                  <StatH>Contest Rating</StatH>
                  <StatV>{stats.rating}</StatV>
                  <Meter>
                    <Fill w={Math.min(100, (stats.rating / 2000) * 100)} c1={L.accent2} c2={L.accent3} />
                  </Meter>
                </Stat>
                <Stat>
                  <StatH>Daily Streak</StatH>
                  <StatV>{stats.streak} days</StatV>
                  <Meter>
                    <Fill w={Math.min(100, (stats.streak / 30) * 100)} c1={L.accent3} c2={L.accent1} />
                  </Meter>
                </Stat>
                <Stat>
                  <StatH>Coins Earned</StatH>
                  <StatV>{coins.toLocaleString()}</StatV>
                  <Meter>
                    <Fill w={Math.min(100, (coins / 5000) * 100)} c1="#FFD700" c2="#FFA500" />
                  </Meter>
                </Stat>
              </Grid>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <h2 style={{ margin: 0, fontSize: "1.06rem", color: NAVY }}>Contests</h2>
              <Tabs>
                {["upcoming", "ongoing", "past"].map((t) => (
                  <Tab key={t} $active={tab === (t as any)} onClick={() => setTab(t as any)} whileHover={{ y: -1 }}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </Tab>
                ))}
              </Tabs>
            </div>

            {/* List */}
            <List>
              <AnimatePresence mode="wait">
                {list.map((c: any, i: number) => (
                  <Row
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, delay: i * 0.04 }}
                  >
                    <div>
                      <Name>
                        {c.title} {tab === "ongoing" && <Tag $lvl={lvl}>Live 🔴</Tag>}
                      </Name>
                      <Meta>
                        {tab === "upcoming" && (
                          <>
                            <span>Starts in {c.startsIn}</span>
                            <span>•</span>
                            <span>{c.participants} players</span>
                            <span>•</span>
                            <span>{c.len}</span>
                            <span>•</span>
                            <span>{c.type}</span>
                            <span>•</span>
                            <span>🎯 +50 coins</span>
                          </>
                        )}
                        {tab === "ongoing" && (
                          <>
                            <span>Ends in {c.endsIn}</span>
                            <span>•</span>
                            <span>{c.participants} players</span>
                            <span>•</span>
                            <span>{c.len}</span>
                            <span>•</span>
                            <span>🎯 +50 coins</span>
                          </>
                        )}
                        {tab === "past" && (
                          <>
                            <span>{c.date}</span>
                            <span>•</span>
                            <span>{c.participants} players</span>
                            <span>•</span>
                            <span>Your rank: {c.rank}</span>
                          </>
                        )}
                      </Meta>
                    </div>
                    <div style={{ display: "grid" }}>
                      {tab === "upcoming" && (
                        <Btn
                          $lvl={lvl}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handlePreviewClick(c.id)}
                          type="button"
                          aria-label={`Preview ${c.title}`}
                        >
                          Preview
                        </Btn>
                      )}
                      {tab === "ongoing" && (
                        <Btn
                          $lvl={lvl}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleJoinContest(c.id)}
                          type="button"
                        >
                          Enter (+50 coins)
                        </Btn>
                      )}
                      {tab === "past" && (
                        <Btn
                          $lvl={lvl}
                          $tone="ghost"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => nav(`/contests/${c.id}`)}
                          type="button"
                        >
                          Details
                        </Btn>
                      )}
                    </div>
                  </Row>
                ))}
              </AnimatePresence>
            </List>

            {/* Safety */}
            <CardWrap style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span role="img" aria-label="shield">
                  🛡️
                </span>
                <strong style={{ color: NAVY }}>Fair Play & Privacy</strong>
              </div>
              <p style={{ color: SUB, margin: "6px 2px 0" }}>
                Smart proctoring, tab-switch detection, and camera checks only during live rounds (never stored without
                consent).
              </p>
            </CardWrap>
          </CardWrap>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Coin Balance Card */}
            <CardWrap>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    background: "linear-gradient(135deg, #FFD700, #FFA500)",
                    width: 48,
                    height: 48,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${RING}`,
                    boxShadow: "0 4px 12px rgba(255, 215, 0, 0.3)",
                  }}
                >
                  <span style={{ fontSize: "24px", fontWeight: "bold" }}>🪙</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, color: NAVY, fontSize: "1.5rem" }}>{coins.toLocaleString()}</div>
                  <div style={{ fontSize: "0.9rem", color: SUB }}>Available Coins</div>
                  <div style={{ fontSize: "0.8rem", color: "#16A34A", fontWeight: 600 }}>
                    Redeem for Amazon, Flipkart & more! 🎁
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 0, 0.1))",
                  padding: "12px",
                  borderRadius: "12px",
                  border: `1px solid ${RING}`,
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "8px" }}>
                  <span style={{ color: NAVY, fontWeight: 600 }}>Contest Join:</span>
                  <span style={{ color: "#16A34A", fontWeight: 700 }}>+50 coins</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "8px" }}>
                  <span style={{ color: NAVY, fontWeight: 600 }}>Top 3 Finish:</span>
                  <span style={{ color: "#16A34A", fontWeight: 700 }}>+200-500 coins</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: NAVY, fontWeight: 600 }}>Daily Streak:</span>
                  <span style={{ color: "#16A34A", fontWeight: 700 }}>+25 coins</span>
                </div>
              </div>

              <Btn
                $lvl={lvl}
                $tone="solid"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => nav("/coinshop")}
                type="button"
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #FFD700, #FFA500)",
                  color: "#7C2D12",
                  border: "none",
                  marginBottom: "8px",
                }}
              >
                🛍️ Visit Reward Store
              </Btn>
              <div style={{ textAlign: "center", fontSize: "0.8rem", color: SUB }}>
                Amazon • Flipkart • AJIO • Swiggy • Netflix • PUBG
              </div>
            </CardWrap>

            <CardWrap>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: `linear-gradient(180deg, ${L.accent2}, ${L.accent1})`,
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    fontWeight: 900,
                    border: `1px solid ${RING}`,
                  }}
                >
                  {user.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, color: NAVY }}>{user.name}</div>
                  <div style={{ fontSize: ".9rem", color: SUB }}>@{user.handle}</div>
                </div>
                <Tag $lvl={lvl}>Ranked</Tag>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <Tag $lvl={lvl}>Starter</Tag>
                <Tag $lvl={lvl}>Friendly</Tag>
                <Tag $lvl={lvl}>Learner</Tag>
              </div>
            </CardWrap>

            <CardWrap>
              <h3 style={{ margin: 0, color: NAVY, fontSize: "1rem" }}>Daily Missions</h3>
              <ul style={{ margin: "10px 0 0 18px", color: SUB }}>
                <li>Solve 3 Easy questions (+30 coins)</li>
                <li>Join 1 live contest (+50 coins)</li>
                <li>Review 1 past attempt (+15 coins)</li>
              </ul>
              <BtnRow style={{ marginTop: 10 }}>
                <Btn $lvl={lvl} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => nav("/practice")} type="button">
                  Practice
                </Btn>
                <Btn $lvl={lvl} $tone="ghost" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => nav("/contests/history")} type="button">
                  History
                </Btn>
              </BtnRow>
            </CardWrap>

            <CardWrap>
              <h3 style={{ margin: 0, color: NAVY, fontSize: "1rem" }}>Badges</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <Tag $lvl={lvl}>🔥 Streak 7</Tag>
                <Tag $lvl={lvl}>💡 Fast Thinker</Tag>
                <Tag $lvl={lvl}>🏆 Top 20%</Tag>
                <Tag $lvl={lvl}>📚 Scholar</Tag>
              </div>
            </CardWrap>
          </div>
        </Shell>
      </Page>
    </>
  );
};

export default ContestLandingPage;
