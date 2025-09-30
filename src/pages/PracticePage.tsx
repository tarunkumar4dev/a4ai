// src/pages/PracticePage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes, css } from "styled-components";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ================= Brand (reuse from Contest Zone) ================= */
const BRAND = {
  grad: "linear-gradient(90deg, #6d5efc 0%, #8b5cf6 45%, #22c1fd 100%)",
  surface: "#ffffff",
  ink: "#1f2544",
  muted: "#6f76a7",
  ring: "rgba(109,94,252,.18)",
  border: "rgba(109,94,252,.16)",
  bg: "#f4f7ff",
  bgDark: "#0b0d17",
};

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

/* ================= Layout ================= */
const Page = styled.div`
  min-height: 100dvh;
  background:
    radial-gradient(1100px 560px at 12% -10%, rgba(109,94,252,.06), transparent 60%),
    radial-gradient(1100px 560px at 88% -6%, rgba(34,193,253,.10), transparent 60%),
    ${BRAND.bg};
  padding: 28px 16px 100px;
  @media (prefers-color-scheme: dark) {
    background:
      radial-gradient(1100px 560px at 12% -10%, rgba(109,94,252,.14), transparent 60%),
      radial-gradient(1100px 560px at 88% -6%, rgba(34,193,253,.12), transparent 60%),
      ${BRAND.bgDark};
  }
`;

const Grid = styled.div`
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.06fr .94fr;
  gap: 22px;
  @media (max-width: 1000px) { grid-template-columns: 1fr; }
`;

const Card = styled(motion.section)`
  background: ${BRAND.surface};
  border: 1px solid ${BRAND.border};
  border-radius: 22px;
  padding: 22px;
  box-shadow: 0 12px 30px rgba(17,24,39,.07);
  animation: ${fadeUp} .28s ease both;
  @media (prefers-color-scheme: dark) {
    background: #0f1221;
    border-color: rgba(255,255,255,.08);
    box-shadow: 0 12px 32px rgba(0,0,0,.38);
  }
`;

const Title = styled(motion.h2)`
  margin: 0 0 12px;
  font-size: clamp(26px, 3.2vw, 34px);
  line-height: 1.06;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: ${BRAND.grad};
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: inline-block;
`;

const Subtitle = styled.p`
  margin: 6px 0 14px; color: ${BRAND.muted}; font-size: 15.5px;
  @media (prefers-color-scheme: dark){ color:#9aa6d1; }
`;

/* ================= Controls ================= */
const Row = styled.div`display:flex; gap:12px; flex-wrap:wrap; align-items:center;`;
const SectionLabel = styled.div`font-size:13px; font-weight:900; color:#5b63d6;`;

const Tag = styled.button<{active?:boolean}>`
  height: 38px; padding: 0 12px; border-radius: 12px;
  border: 1px dashed rgba(109,94,252,.30);
  background: ${({active})=> active ? "rgba(109,94,252,.15)" : "#fff"};
  color: #2d3150; font-weight: 800; font-size: 13.5px;
  cursor: pointer; transition: .2s;
  &:hover{ transform: translateY(-1px); background: rgba(99,102,241,.08); }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; color:#e6e9ff; border-color:rgba(255,255,255,.1); }
`;

const SelectLike = styled.div`
  display:flex; gap:8px; flex-wrap:wrap;
`;

const NumInput = styled.input`
  width: 82px; height: 42px; border-radius: 12px; padding: 0 10px; font-weight: 800;
  border: 1px solid rgba(99,102,241,.22); background:#fff; color:${BRAND.ink};
  &:focus{ outline:none; box-shadow:0 0 0 5px ${BRAND.ring}; border-color:#6d5efc; }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; color:#e6e9ff; border-color:rgba(255,255,255,.08); }
`;

const Switch = styled.button<{checked:boolean}>`
  height: 42px; border-radius: 999px; padding: 0 10px 0 4px;
  border: 1px solid rgba(99,102,241,.22);
  background: ${({checked})=> checked ? "rgba(16,185,129,.18)" : "#fff"};
  color: ${({checked})=> checked ? "#065f46" : "#2d3150"};
  font-weight: 900; display:flex; align-items:center; gap:8px; cursor:pointer;
  transition: .2s;
  span.bubble{ width:30px; height:30px; border-radius:999px; background:#fff; border:1px solid rgba(99,102,241,.25); }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; color:#e6e9ff; border-color:rgba(255,255,255,.08); }
`;

/* ================= Lists ================= */
const List = styled.div` display:grid; gap:10px; `;
const Item = styled(motion.div)`
  border: 1px solid rgba(99,102,241,.12); border-radius: 16px; background:#fff;
  padding: 14px 16px; display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center;
  transition:.2s; position:relative; overflow:hidden;
  &:hover{ transform: translateY(-2px); border-color: rgba(99,102,241,.26); box-shadow: 0 12px 26px rgba(99,102,241,.1); }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; border-color:rgba(255,255,255,.06); }
`;
const Name = styled.div` font-weight:900; color:#303659; @media (prefers-color-scheme: dark){ color:#e6e9ff; }`;
const Meta = styled.div`
  color:${BRAND.muted}; font-size:13px; display:flex; gap:10px; flex-wrap:wrap;
  .dot{ width:4px; height:4px; background:#ccd1de; border-radius:999px; display:inline-block; }
  @media (prefers-color-scheme: dark){ color:#9aa3c9; .dot{background:#2a3050;} }
`;

/* ================= Buttons ================= */
const buttonBase = css`
  display:inline-flex; align-items:center; justify-content:center; font-weight:900;
  cursor:pointer; user-select:none; transition:.2s; border:none;
`;

const Primary = styled(motion.button)`
  ${buttonBase}; height:50px; border-radius:14px; color:#fff; min-width:180px; font-size:15.5px;
  background:${BRAND.grad}; box-shadow:0 14px 28px rgba(109,94,252,.22);
  animation:${shimmer} 8s linear infinite; background-size:200% 100%;
`;

const Secondary = styled.button`
  ${buttonBase}; height:40px; padding:0 14px; border-radius:12px;
  border:1px solid rgba(99,102,241,.35); background:#fff; color:#5b63d6;
  &:hover{ transform:translateY(-1px); background:rgba(99,102,241,.06);}
  @media (prefers-color-scheme: dark){ background:#0b0e1b; color:#c9cfff; border-color:rgba(255,255,255,.1); }
`;

/* ================= Sticky footer CTA ================= */
const Sticky = styled.div`
  position: fixed; inset: auto 0 16px 0; display:flex; justify-content:center; pointer-events:none;
`;
const StickyInner = styled.div`
  pointer-events: auto; background: ${BRAND.surface}; border:1px solid ${BRAND.border};
  padding: 10px; border-radius: 16px; box-shadow: 0 10px 26px rgba(17,24,39,.18);
  display:flex; gap:12px; align-items:center;
  max-width: 1120px; margin: 0 16px;
  @media (prefers-color-scheme: dark){ background:#0f1221; border-color:rgba(255,255,255,.08); }
`;

/* ================= Mock data ================= */
const SUBJECTS = ["Math", "Science", "Coding", "GK", "Business", "English", "Reasoning"] as const;
type Subj = typeof SUBJECTS[number];

const TOPICS: Record<Subj, string[]> = {
  Math: ["Algebra", "Geometry", "Trigonometry", "Probability"],
  Science: ["Physics", "Chemistry", "Biology"],
  Coding: ["Arrays", "Strings", "DP", "Graphs"],
  GK: ["India", "World", "Current Affairs"],
  Business: ["Marketing", "Accounts", "Economics"],
  English: ["Grammar", "Reading", "Writing"],
  Reasoning: ["Series", "Analogy", "Puzzles"],
};

const RECENT = [
  { id: "r1", name: "Math Sprint — Algebra", score: "8/10", time: "12m", when: "2h ago" },
  { id: "r2", name: "Science Quickie — Physics", score: "6/8", time: "9m", when: "yesterday" },
];

/* ================= Page ================= */
const PracticePage: React.FC = () => {
  const nav = useNavigate();
  const reduce = useReducedMotion();

  const [subject, setSubject] = useState<Subj>("Math");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [timed, setTimed] = useState(true);
  const [minutes, setMinutes] = useState(15);
  const [questionCount, setQuestionCount] = useState(10);
  const [chosenTopics, setChosenTopics] = useState<string[]>([]);

  const topics = useMemo(() => TOPICS[subject], [subject]);

  const toggleTopic = (t: string) =>
    setChosenTopics((prev) => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));

  const startPractice = () => {
    // Replace with API call or nav to live practice room
    const params = new URLSearchParams({
      subject,
      difficulty,
      timed: String(timed),
      minutes: String(minutes),
      count: String(questionCount),
      topics: chosenTopics.join(","),
    });
    nav(`/practice/session?${params.toString()}`);
  };

  return (
    <Page>
      <Grid>
        {/* LEFT: Setup */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .35 }}
        >
          <Title>Practice</Title>
          <Subtitle>Choose a subject, topics, and difficulty. Then hit Start—earn streaks and badges!</Subtitle>

          {/* Subject */}
          <SectionLabel>Subject</SectionLabel>
          <Row style={{marginBottom:12}}>
            {SUBJECTS.map((s) => (
              <Tag key={s} active={s===subject} onClick={()=>setSubject(s)}>
                {s}
              </Tag>
            ))}
          </Row>

          {/* Topics */}
          <SectionLabel>Topics ({subject})</SectionLabel>
          <SelectLike style={{marginBottom:12}}>
            {topics.map((t) => (
              <Tag key={t} active={chosenTopics.includes(t)} onClick={()=>toggleTopic(t)}>
                {chosenTopics.includes(t) ? "✅ " : ""}{t}
              </Tag>
            ))}
          </SelectLike>

          {/* Difficulty */}
          <SectionLabel>Difficulty</SectionLabel>
          <Row style={{marginBottom:12}}>
            {(["Easy","Medium","Hard"] as const).map((d) => (
              <Tag key={d} active={d===difficulty} onClick={()=>setDifficulty(d)}>{d}</Tag>
            ))}
          </Row>

          {/* Count & Time */}
          <SectionLabel>Session setup</SectionLabel>
          <Row style={{marginBottom:6}}>
            <NumInput
              type="number"
              min={5}
              max={50}
              value={questionCount}
              onChange={(e)=>setQuestionCount(Math.max(5, Math.min(50, Number(e.target.value) || 0)))}
              aria-label="Number of questions"
              title="Number of questions"
            />
            <Switch checked={timed} onClick={()=>setTimed(v=>!v)} aria-label="Timed mode">
              <span className="bubble" />
              {timed ? "⏱️ Timed" : "Free Mode"}
            </Switch>
            {timed && (
              <NumInput
                type="number"
                min={5}
                max={90}
                value={minutes}
                onChange={(e)=>setMinutes(Math.max(5, Math.min(90, Number(e.target.value) || 0)))}
                aria-label="Minutes"
                title="Minutes"
              />
            )}
          </Row>

          <Row>
            <Secondary onClick={()=>{ setChosenTopics([]); setQuestionCount(10); setMinutes(15); setTimed(true); setDifficulty("Easy"); }}>
              Reset
            </Secondary>
          </Row>
        </Card>

        {/* RIGHT: Daily goals, streak, recent */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .35, delay:.05 }}
        >
          <Title>Daily Missions</Title>
          <List>
            <Item
              initial={{opacity:0,y:8}}
              animate={{opacity:1,y:0}}
              transition={{duration:.25}}
            >
              <div>
                <Name>🎯 Solve 3 Easy questions</Name>
                <Meta><span>Progress: 2 / 3</span></Meta>
              </div>
              <Secondary>Practice</Secondary>
            </Item>

            <Item
              initial={{opacity:0,y:8}}
              animate={{opacity:1,y:0}}
              transition={{duration:.25, delay:.05}}
            >
              <div>
                <Name>🧠 Try 1 timed round</Name>
                <Meta><span>Progress: 0 / 1</span></Meta>
              </div>
              <Secondary>Start</Secondary>
            </Item>

            <Item
              initial={{opacity:0,y:8}}
              animate={{opacity:1,y:0}}
              transition={{duration:.25, delay:.1}}
            >
              <div>
                <Name>📘 Review 1 past attempt</Name>
                <Meta><span>Progress: 0 / 1</span></Meta>
              </div>
              <Secondary>History</Secondary>
            </Item>
          </List>

          <div style={{height:12}} />

          <Title>Streak & Badges</Title>
          <Item
            initial={{opacity:0,y:8}}
            animate={{opacity:1,y:0}}
            transition={{duration:.25}}
          >
            <div>
              <Name>🔥 Daily Streak: 9 days</Name>
              <Meta><span>Keep it up to unlock “Fast Thinker”</span></Meta>
            </div>
            <Secondary>See badges</Secondary>
          </Item>

          <div style={{height:12}} />

          <Title>Recent Attempts</Title>
          <List>
            {RECENT.map((r, i) => (
              <Item
                key={r.id}
                initial={{opacity:0,y:8}}
                animate={{opacity:1,y:0}}
                transition={{duration:.25, delay: i*0.05}}
              >
                <div>
                  <Name>{r.name}</Name>
                  <Meta>
                    <span>Score: {r.score}</span>
                    <span className="dot" />
                    <span>Time: {r.time}</span>
                    <span className="dot" />
                    <span>{r.when}</span>
                  </Meta>
                </div>
                <Secondary onClick={()=>nav(`/practice/result/${r.id}`)}>Review</Secondary>
              </Item>
            ))}
          </List>
        </Card>
      </Grid>

      {/* Sticky CTA */}
      <Sticky>
        <StickyInner as={motion.div}
          initial={{opacity:0, y:10}}
          animate={{opacity:1, y:0}}
          transition={{duration:.25}}
        >
          <div style={{fontWeight:900}}>Ready?</div>
          <div style={{color:BRAND.muted, fontSize:13.5}}>Subject: {subject} • {difficulty} • {questionCount} Q{timed? ` • ${minutes}m`: ""}</div>
          <div style={{flex:1}} />
          <Primary
            whileHover={!useReducedMotion() ? {scale:1.02} : undefined}
            whileTap={!useReducedMotion() ? {scale:0.98} : undefined}
            onClick={startPractice}
          >
            🚀 Start Practice
          </Primary>
        </StickyInner>  
      </Sticky>
    </Page>
  );
};

export default PracticePage;
