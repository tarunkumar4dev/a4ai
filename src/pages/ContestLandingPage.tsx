import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes, css } from "styled-components";
import { motion, useMotionTemplate, useMotionValue, AnimatePresence } from "framer-motion";

/* ==================== Brand ==================== */
const brandGrad = "linear-gradient(90deg, #4f46e5 0%, #a855f7 50%, #ec4899 100%)";
const brandGradAlt = "linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #4f46e5 100%)";

/* ==================== Animations ==================== */
const shimmer = keyframes`
  0% { background-position: 0% 50% }
  100% { background-position: 200% 50% }
`;
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px) }
  to { opacity: 1; transform: translateY(0) }
`;
const float = keyframes`
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-8px) }
`;
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;
const slideIn = keyframes`
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;
const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.3); }
  50% { box-shadow: 0 0 30px rgba(168, 85, 247, 0.6); }
`;

/* ==================== Layout ==================== */
const Page = styled.div`
  min-height: 100vh;
  background: radial-gradient(1200px 500px at 15% 10%, rgba(79,70,229,0.1), transparent 60%),
              radial-gradient(1000px 500px at 80% 0%, rgba(168,85,247,0.12), transparent 60%),
              #0b0c10;
  position: relative;
  padding-bottom: 3rem;
  overflow: hidden;
`;

/* Animated gradient background */
const GradientBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 500px;
  background: linear-gradient(180deg, rgba(79,70,229,0.15) 0%, transparent 100%);
  opacity: 0.3;
  z-index: 0;
  pointer-events: none;
`;

/* floating orbs background */
const Orb = styled(motion.div)`
  position: absolute;
  width: 260px; 
  height: 260px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
`;

const ArenaContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 2rem;
  max-width: 1200px;
  margin: 1.75rem auto;
  padding: 0 1rem;
  position: relative;
  z-index: 1;

  @media (max-width: 1024px) { grid-template-columns: 1fr; }
`;

/* ==================== Card ==================== */
const Card = styled(motion.section)<{ $hover?: boolean; $glow?: boolean }>`
  background: rgba(17, 18, 28, 0.8);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148,163,184,0.15);
  border-radius: 20px;
  padding: 1.5rem;
  animation: ${fadeUp} .45s ease both;
  box-shadow: 0 15px 35px rgba(0,0,0,0.3);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent);
  }

  ${(p) => p.$hover && css`
    transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease;
    &:hover {
      transform: translateY(-4px);
      border-color: rgba(99,102,241,0.6);
      box-shadow: 0 20px 45px rgba(99,102,241,0.25);
    }
  `}
  
  ${(p) => p.$glow && css`
    animation: ${glow} 3s ease-in-out infinite;
  `}
`;

const HeaderBand = styled.div`
  margin-bottom: 1.5rem;
  position: relative;
`;

const Title = styled(motion.h1)`
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.15;
  margin: 0 0 .35rem 0;
  background: ${brandGrad};
  -webkit-background-clip: text; 
  background-clip: text; 
  color: transparent;
  font-weight: 900; 
  letter-spacing: -0.02em;
  position: relative;
  display: inline-block;
`;

const Subtitle = styled(motion.p)`
  color: #cbd5e1; 
  margin: .25rem 0 1rem; 
  font-size: 1.02rem;
  max-width: 80%;
`;

/* Pills */
const Pill = styled(motion.span)<{ tone?: "indigo" | "emerald" | "amber" | "pink" }>`
  display: inline-flex; 
  align-items: center; 
  gap: .4rem;
  padding: .35rem .6rem; 
  border-radius: 999px; 
  font-size: .78rem; 
  font-weight: 700;
  color: #e2e8f0; 
  background: rgba(148,163,184,.12); 
  border: 1px solid rgba(148,163,184,.18);
  ${(p) => p.tone === 'indigo' && css` color:#c7d2fe; background: rgba(79,70,229,.18); border-color: rgba(79,70,229,.35);`}
  ${(p) => p.tone === 'emerald' && css` color:#a7f3d0; background: rgba(16,185,129,.18); border-color: rgba(16,185,129,.35);`}
  ${(p) => p.tone === 'amber' && css` color:#fde68a; background: rgba(245,158,11,.18); border-color: rgba(245,158,11,.35);`}
  ${(p) => p.tone === 'pink' && css` color:#fbcfe8; background: rgba(236,72,153,.18); border-color: rgba(236,72,153,.35);`}
`;

const ButtonRow = styled.div`
  display: flex; 
  gap: .75rem; 
  flex-wrap: wrap;
  margin-top: 1rem;
`;

/* Buttons */
const PrimaryButton = styled(motion.button)`
  background: ${brandGrad}; 
  background-size: 200% 100%;
  color:#fff; 
  border:0; 
  padding:.78rem 1.3rem; 
  border-radius: 12px; 
  font-weight: 800;
  cursor:pointer; 
  animation:${shimmer} 8s linear infinite; 
  box-shadow: 0 10px 26px rgba(99,102,241,.28);
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: 0.5s;
  }
  
  &:hover::after {
    left: 100%;
  }
`;

const SecondaryButton = styled(PrimaryButton)`
  background: transparent; 
  color:#a5b4fc; 
  border: 1px solid rgba(99,102,241,.55); 
  box-shadow:none; 
  animation:none;
  &:hover { 
    background: rgba(99,102,241,.08); 
  }
`;

/* Grid */
const Grid2 = styled.div`
  display:grid; 
  gap: 1rem; 
  grid-template-columns: repeat(2, minmax(0, 1fr));
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const StatTile = styled(motion.div)`
  padding: 1.25rem; 
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(79,70,229,.16), rgba(168,85,247,.14));
  border: 1px solid rgba(79,70,229,.25);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%);
    background-size: 200% 200%;
    animation: ${shimmer} 6s linear infinite;
    pointer-events: none;
  }
`;

const StatTitle = styled.div`
  color:#c7d2fe; 
  font-weight: 800; 
  font-size:.82rem; 
  letter-spacing:.02em;
  margin-bottom: 0.5rem;
`;
const StatValue = styled.div`
  font-size: 1.65rem; 
  font-weight: 900; 
  color: #e5e7eb; 
  margin: .25rem 0 .25rem;
`;
const Muted = styled.div`
  font-size: .9rem; 
  color: #94a3b8;
  margin-top: 0.5rem;
`;

const ProgressShell = styled.div`
  height: 8px; 
  background: rgba(79,70,229,.25); 
  border-radius: 999px; 
  overflow:hidden;
  margin: 0.75rem 0;
`;
const Progress = styled(motion.div)<{ value:number }>`
  width: ${(p)=>p.value}%; 
  height:100%; 
  border-radius: 999px; 
  background:${brandGrad}; 
  transition: width .5s ease;
`;

/* Lists */
const SectionTitle = styled(motion.h2)`
  font-size:1.15rem; 
  font-weight:900; 
  color:#e5e7eb; 
  margin:1.75rem 0 1rem; 
  letter-spacing:-.01em;
  position: relative;
  display: inline-block;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 0;
    width: 40px;
    height: 3px;
    background: ${brandGrad};
    border-radius: 3px;
  }
`;

const ContestList = styled.div``;

const Item = styled(motion.div)`
  padding: 1.25rem; 
  border: 1px solid rgba(99,102,241,.25); 
  border-radius: 16px;
  display:grid; 
  grid-template-columns: 1fr auto; 
  gap:1rem; 
  align-items:center;
  background: rgba(17, 18, 28, .6); 
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; 
  margin-bottom:.75rem;
  box-shadow: 0 8px 22px rgba(0,0,0,.25);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: ${brandGrad};
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &:hover { 
    transform: translateY(-4px); 
    border-color: rgba(168,85,247,.6); 
    box-shadow: 0 16px 36px rgba(168,85,247,.18); 
    
    &::before {
      opacity: 1;
    }
  }
`;
const ContestName = styled.div`
  color:#f8fafc; 
  font-weight:900; 
  font-size:1.05rem; 
  margin-bottom:.25rem;
`;
const ContestMeta = styled.div`
  color:#a1a1aa; 
  font-size:.92rem; 
  display:flex; 
  gap:.6rem; 
  flex-wrap:wrap;
`;

/* Right column */
const Aside = styled.aside` 
  display:flex; 
  flex-direction:column; 
  gap:1.25rem; 
`;

const ProfileWrap = styled(motion.div)` 
  display:flex; 
  align-items:center; 
  gap:.9rem; 
  margin-bottom:.75rem; 
`;
const Avatar = styled(motion.div)`
  width:54px; 
  height:54px; 
  border-radius: 14px; 
  background:${brandGrad}; 
  color:white; 
  display:grid; 
  place-items:center; 
  font-weight:900; 
  font-size:1.2rem; 
  box-shadow: 0 6px 18px rgba(79,70,229,.35);
  animation:${float} 6s ease-in-out infinite;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
    transform: rotate(45deg);
    animation: ${shimmer} 6s linear infinite;
  }
`;
const UserName = styled.div` 
  font-weight:900; 
  color:#e5e7eb; 
`;
const Handle = styled.div` 
  color:#9aa3b2; 
  font-size:.9rem; 
`;

const Divider = styled(motion.div)`
  height:1px; 
  background: linear-gradient(90deg, transparent, rgba(203,213,225,.25), transparent);
  margin:.75rem 0 1rem;
`;

/* Tabs */
const Tabs = styled.div` 
  display:flex; 
  gap:.4rem; 
  flex-wrap:wrap; 
  margin-bottom: 1rem;
`;
const Tab = styled(motion.button)<{ $active?:boolean }>`
  border:1px solid rgba(99,102,241,.45); 
  padding:.5rem .8rem; 
  border-radius:10px; 
  font-weight:800; 
  font-size:.88rem; 
  cursor:pointer;
  color:${(p)=>p.$active?"#0b0c10":"#c7d2fe"}; 
  background:${(p)=>p.$active?brandGrad:"transparent"};
  background-size:200% 100%; 
  animation:${(p)=>p.$active?shimmer:"none"} 10s linear infinite;
  transition: transform .15s ease, box-shadow .15s ease; 
  
  &:hover{ 
    transform: translateY(-2px); 
    box-shadow: 0 4px 12px rgba(99,102,241,0.2);
  }
`;

/* Achievements Badges */
const BadgeRow = styled.div` 
  display:flex; 
  flex-wrap:wrap; 
  gap:.5rem; 
`;
const Badge = styled(motion.span)<{ tone?: "pink" | "emerald" | "amber"; pill?: boolean }>`
  display:inline-flex; 
  align-items:center; 
  padding:.4rem .6rem; 
  border-radius:${p=>p.pill?"999px":"10px"}; 
  font-size:.8rem; 
  font-weight:800; 
  color:#e5e7eb; 
  background: rgba(148,163,184,.14); 
  border:1px solid rgba(148,163,184,.25);
  ${(p)=>p.tone==='pink' && css` color:#fbcfe8; background: rgba(236,72,153,.18); border-color: rgba(236,72,153,.35);`}
  ${(p)=>p.tone==='emerald' && css` color:#a7f3d0; background: rgba(16,185,129,.18); border-color: rgba(16,185,129,.35);`}
  ${(p)=>p.tone==='amber' && css` color:#fde68a; background: rgba(245,158,11,.18); border-color: rgba(245,158,11,.35);`}
`;

/* Micro-interaction: magnetic button */
function MagneticButton({ children, onClick, asSecondary }: { children: React.ReactNode; onClick?: () => void; asSecondary?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const transform = useMotionTemplate`translate(${x}px, ${y}px)`;

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width/2;
    const relY = e.clientY - rect.top - rect.height/2;
    x.set(relX * 0.15); y.set(relY * 0.15);
  }
  function reset() { x.set(0); y.set(0); }

  const Btn = asSecondary ? SecondaryButton : PrimaryButton;
  return (
    <Btn
      as={motion.button}
      ref={ref}
      style={{ transform }}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      onClick={onClick}
    >{children}</Btn>
  );
}

/* Mini meter */
const MeterShell = styled.div` 
  background: rgba(99,102,241,.2); 
  height:10px; 
  border-radius:999px; 
  overflow:hidden; 
  margin:.4rem 0 .75rem; 
`;
const MeterFill = styled(motion.div)<{ pct:number }>`
  width:${p=>p.pct}%; 
  height:100%; 
  border-radius:999px; 
  background:${brandGrad}; 
  transition: width .45s ease;
`;
const MeterLabel = styled.div` 
  display:flex; 
  justify-content:space-between; 
  color:#c7d2fe; 
  font-weight:800; 
  font-size:.85rem; 
`;
function MiniMeter({ label, value, total }:{ label:string; value:number; total:number }){
  const pct = Math.max(0, Math.min(100, (value/total)*100));
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MeterLabel><span>{label}</span><span>{value}/{total}</span></MeterLabel>
      <MeterShell>
        <MeterFill 
          pct={pct} 
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        />
      </MeterShell>
    </motion.div>
  );
}

// Animated background particles
const Particle = styled(motion.div)`
  position: absolute;
  border-radius: 50%;
  background: ${brandGrad};
  opacity: 0.1;
  pointer-events: none;
  z-index: 0;
`;

// Create random particles for background
const generateParticles = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    size: Math.random() * 6 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));
};

/* ==================== Component ==================== */
const ContestLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"upcoming" | "ongoing" | "past">("upcoming");
  const [mounted, setMounted] = useState(false);
  const particles = useMemo(() => generateParticles(20), []);

  useEffect(()=>{ 
    setMounted(true); 
  },[]);

  // Mock data — replace with API later
  const user = { name: "Tarun Kumar", handle: "tarunkiriddev" };
  const stats = { solved: 160, totalProblems: 4000, rank: 804, activeDays: 63, maxStreak: 11 };

  const buckets = useMemo(() => ({
    upcoming: [
      { id: "weekly-maths", title: "Weekly Maths Challenge", startsIn: "2 days", participants: 125, length: "60m", type: "MCQ" },
      { id: "chemistry-sprint", title: "Chemistry Sprint", startsIn: "3 days", participants: 210, length: "45m", type: "Mixed" },
      { id: "ai-gk", title: "AI + GK Blitz", startsIn: "5 days", participants: 340, length: "30m", type: "Rapid" },
    ],
    ongoing: [
      { id: "physics-masters", title: "Physics Masters", status: "Live", participants: 89, endsIn: "34m", length: "90m", type: "Mixed" },
    ],
    past: [
      { id: "aptitude-open", title: "Aptitude Open 2025 #3", date: "May 12", participants: 980, yourRank: 143 },
      { id: "cs-fundamentals", title: "CS Fundamentals Derby", date: "Apr 28", participants: 740, yourRank: 210 },
    ],
  }), []);

  const list = buckets[tab];

  return (
    <Page>
      {/* Animated background elements */}
      <GradientBackground />
      
      {/* Floating orbs */}
      <Orb 
        style={{ top: 0, left: -60, background: "#6366f1" }} 
        animate={{ 
          x: [0, 40, -10, 0], 
          y: [0, 20, -10, 0],
          scale: [1, 1.1, 1]
        }} 
        transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }} 
      />
      <Orb 
        style={{ bottom: -60, right: -40, background: "#ec4899" }} 
        animate={{ 
          x: [0, -20, 10, 0], 
          y: [0, -30, 10, 0],
          scale: [1, 1.1, 1]
        }} 
        transition={{ repeat: Infinity, duration: 24, ease: "easeInOut" }} 
      />
      
      {/* Background particles */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          style={{
            width: particle.size,
            height: particle.size,
            top: `${particle.y}%`,
            left: `${particle.x}%`,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      <ArenaContainer>
        {/* ==================== LEFT ==================== */}
        <Card
          as={motion.main}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          $hover
        >
          <HeaderBand>
            <Title
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Welcome to the Arena
            </Title>
            <Subtitle
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Compete, learn, and win. Join exciting contests or create your own in minutes.
            </Subtitle>
            <ButtonRow>
              <MagneticButton onClick={() => navigate("/contests/join")}>Join a Contest</MagneticButton>
              <MagneticButton asSecondary onClick={() => navigate("/contests/create")}>Create a Contest</MagneticButton>
              <Pill 
                tone="indigo"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >• Proctored & secure</Pill>
              <Pill 
                tone="emerald"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >• Fair rankings</Pill>
              <Pill 
                tone="pink"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >• AI anti-cheat</Pill>
            </ButtonRow>
          </HeaderBand>

          {/* Quick Stats */}
          <Grid2>
            {[
              { 
                title: "Problems Solved", 
                value: `${stats.solved.toLocaleString()}/${stats.totalProblems.toLocaleString()}`,
                progress: (stats.solved / stats.totalProblems) * 100,
                text: "Keep going — new sets unlock at 250!"
              },
              { 
                title: "Contest Rating", 
                value: `#${stats.rank.toLocaleString()}`,
                text: "Top 20% — steady climb"
              },
              { 
                title: "Active Days", 
                value: stats.activeDays.toString(),
                text: "Daily streak boosts XP gains"
              },
              { 
                title: "Max Streak", 
                value: stats.maxStreak.toString(),
                text: "Beat your best this week"
              }
            ].map((stat, index) => (
              <StatTile
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <StatTitle>{stat.title}</StatTitle>
                <StatValue>{stat.value}</StatValue>
                {"progress" in stat && (
                  <ProgressShell>
                    <Progress 
                      value={stat.progress} 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.progress}%` }}
                      transition={{ duration: 1, delay: 0.6 + index * 0.1 }}
                    />
                  </ProgressShell>
                )}
                <Muted>{stat.text}</Muted>
              </StatTile>
            ))}
          </Grid2>

          {/* Tabs */}
          <SectionTitle
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            Contests
          </SectionTitle>
          <Tabs>
            {[
              { id: "upcoming", label: "Upcoming" },
              { id: "ongoing", label: "Ongoing" },
              { id: "past", label: "Past" }
            ].map((tabItem) => (
              <Tab
                key={tabItem.id}
                $active={tab === tabItem.id}
                onClick={() => setTab(tabItem.id as any)}
                aria-pressed={tab === tabItem.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tabItem.label}
              </Tab>
            ))}
          </Tabs>

          {/* List */}
          <ContestList>
            <AnimatePresence mode="wait">
              {list.map((c:any, idx:number) => (
                <Item
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: mounted ? idx * 0.05 : 0 }}
                  whileHover={{ y: -4 }}
                >
                  <div>
                    <ContestName>
                      {c.title}
                      {c.status === 'Live' && (
                        <Pill 
                          tone="amber" 
                          style={{ marginLeft: 8 }}
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          • Live
                        </Pill>
                      )}
                    </ContestName>
                    <ContestMeta>
                      {tab === 'upcoming' && (<>
                        <span>Starts in {c.startsIn}</span><span>•</span>
                        <span>{c.participants.toLocaleString()} participants</span><span>•</span>
                        <span>{c.length}</span><span>•</span>
                        <span>{c.type}</span>
                      </>)}
                      {tab === 'ongoing' && (<>
                        <span>{c.participants.toLocaleString()} participants</span><span>•</span>
                        <span>Ends in {c.endsIn}</span><span>•</span>
                        <span>{c.length}</span><span>•</span>
                        <span>{c.type}</span>
                      </>)}
                      {tab === 'past' && (<>
                        <span>{c.date}</span><span>•</span>
                        <span>{c.participants.toLocaleString()} participants</span>
                        {"yourRank" in c && (<><span>•</span><span>Your rank: {c.yourRank}</span></>)}
                      </>)}
                    </ContestMeta>
                  </div>
                  {tab === 'upcoming' && (
                    <PrimaryButton 
                      whileHover={{ y: -2, scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(`/contests/${c.id}`)}
                    >
                      Preview
                    </PrimaryButton>
                  )}
                  {tab === 'ongoing' && (
                    <PrimaryButton 
                      whileHover={{ y: -2, scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(`/contests/${c.id}`)}
                    >
                      Enter
                    </PrimaryButton>
                  )}
                  {tab === 'past' && (
                    <SecondaryButton 
                      whileHover={{ y: -2, scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(`/contests/${c.id}`)}
                    >
                      Details
                    </SecondaryButton>
                  )}
                </Item>
              ))}
            </AnimatePresence>
          </ContestList>

          {/* Highlights & Safety */}
          <SectionTitle
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1 }}
          >
            Highlights
          </SectionTitle>
          <Grid2>
            <Card 
              $hover
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.1 }}
              whileHover={{ y: -5 }}
            >
              <StatTitle>Blueprinted Difficulty</StatTitle>
              <Muted>Lock difficulty mix & outcomes before start. All participants get deterministic sets (A/B) with equal weightage.</Muted>
            </Card>
            <Card 
              $hover
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.2 }}
              whileHover={{ y: -5 }}
            >
              <StatTitle>Smart Proctoring</StatTitle>
              <Muted>Face presence, tab-switch detection, and warning scores — fairness without being intrusive.</Muted>
            </Card>
          </Grid2>

          <SectionTitle
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.3 }}
          >
            Safety & Fair Play
          </SectionTitle>
          <Card 
            $hover
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.4 }}
            whileHover={{ y: -5 }}
          >
            <Muted>
              We use camera-on verification (never stored without consent), anonymized scoring, and strict anti-cheat. See our {" "}
              <a href="/policies/contests" style={{ color: "#c7d2fe", fontWeight: 800 }}>contest policy</a>.
            </Muted>
          </Card>
        </Card>

        {/* ==================== RIGHT ==================== */}
        <Aside>
          <Card
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            $hover
          >
            <ProfileWrap
              whileHover={{ x: 5 }}
            >
              <Avatar 
                aria-hidden
                whileHover={{ rotate: 5, scale: 1.1 }}
              >
                {user.name.charAt(0)}
              </Avatar>
              <div>
                <UserName>{user.name}</UserName>
                <Handle>@{user.handle}</Handle>
              </div>
            </ProfileWrap>
            <Divider
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            />
            <Grid2>
              <div>
                <StatTitle>Total Solved</StatTitle>
                <StatValue style={{ fontSize: "1.4rem" }}>{stats.solved}</StatValue>
              </div>
              <div>
                <StatTitle>Global Rank</StatTitle>
                <StatValue style={{ fontSize: "1.4rem" }}>#{stats.rank}</StatValue>
              </div>
            </Grid2>
          </Card>

          <Card
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            $hover
          >
            <StatTitle>Problem Stats</StatTitle>
            <Divider
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            />
            <MiniMeter label="Easy" value={52} total={886} />
            <MiniMeter label="Medium" value={89} total={1844} />
            <MiniMeter label="Hard" value={19} total={855} />
          </Card>

          <Card
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            $hover
          >
            <StatTitle>Achievements</StatTitle>
            <Divider
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            />
            <BadgeRow>
              <Badge 
                pill
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                100 Days
              </Badge>
              <Badge 
                pill 
                tone="pink"
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Top 10%
              </Badge>
              <Badge 
                pill 
                tone="emerald"
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Clean Run
              </Badge>
              <Badge 
                pill 
                tone="amber"
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Weekly Winner
              </Badge>
            </BadgeRow>
            <Muted style={{ marginTop: 10 }}>More badges unlock with streaks & contests.</Muted>
          </Card>
        </Aside>
      </ArenaContainer>
    </Page>
  );
};

export default ContestLandingPage;