import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes, css } from "styled-components";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ================= Brand: Contest Zone (kid-friendly) ================= */
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
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

/* ================= Layout ================= */
const Page = styled.div`
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background:
    radial-gradient(1100px 560px at 12% -10%, rgba(109,94,252,.06), transparent 60%),
    radial-gradient(1100px 560px at 88% -6%, rgba(34,193,253,.10), transparent 60%),
    ${BRAND.bg};
  padding: 28px 16px;
  position: relative;
  overflow: hidden;

  @media (prefers-color-scheme: dark) {
    background:
      radial-gradient(1100px 560px at 12% -10%, rgba(109,94,252,.14), transparent 60%),
      radial-gradient(1100px 560px at 88% -6%, rgba(34,193,253,.12), transparent 60%),
      ${BRAND.bgDark};
  }
`;

const Orb = styled(motion.div)`
  position: absolute;
  border-radius: 50%;
  filter: blur(42px);
  opacity: 0.14;
  pointer-events: none;
  z-index: 0;
`;

const Grid = styled.div`
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.08fr .92fr;
  gap: 22px;
  position: relative;
  z-index: 1;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    gap: 18px;
  }
`;

/* ================= Card ================= */
const Card = styled(motion.section) <{ glass?: boolean }>`
  background: ${({ glass }) => (glass ? "rgba(255,255,255,.94)" : BRAND.surface)};
  backdrop-filter: ${({ glass }) => (glass ? "blur(12px)" : "none")};
  border-radius: 22px;
  padding: 22px;
  border: 1px solid ${BRAND.border};
  box-shadow: 0 12px 30px rgba(17, 24, 39, .07);
  animation: ${fadeUp} .28s ease both;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(109, 94, 252, 0.45), rgba(34,193,253,.45), transparent);
  }

  @media (prefers-color-scheme: dark) {
    background: ${({ glass }) => (glass ? "rgba(12,14,25,.72)" : "#0f1221")};
    border-color: rgba(255,255,255,.08);
    box-shadow: 0 12px 32px rgba(0,0,0,.38);
  }
`;

/* ================= Headers ================= */
const HStack = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const Title = styled(motion.h2)`
  margin: 0;
  font-size: clamp(26px, 3.2vw, 34px);
  line-height: 1.06;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: ${BRAND.grad};
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: inline-flex;
  align-items: center;
  gap: 10px;

  .logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }
`;


const Subtitle = styled(motion.p)`
  color: ${BRAND.muted};
  margin: 8px 0 18px;
  font-size: 15.5px;
  @media (prefers-color-scheme: dark) { color: #9aa6d1; }
`;

/* ================= PIlls (grade filters visual only) ================= */
const PillRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 14px;
`;

const Pill = styled.span`
  font-weight: 800; font-size: 12.5px;
  border-radius: 999px; padding: 6px 10px;
  border: 1px dashed rgba(109,94,252,.28);
  background: rgba(109,94,252,.06);
  color: #5b63d6;
`;

/* ================= Form ================= */
const Form = styled(motion.form)`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: end;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

const Group = styled.div`display: grid; gap: 8px;`;
const Label = styled.label`font-size: 13px; font-weight: 900; color: #5b63d6;`;

const PrefixField = styled(motion.div) <{ invalid?: boolean }>`
  position: relative;

  .prefix {
    position: absolute;
    left: 8px; top: 50%; transform: translateY(-50%);
    font-weight: 900; font-size: 12px; letter-spacing: .045em;
    color: ${({ invalid }) => (invalid ? "#ef4444" : "#5b63d6")};
    background: ${({ invalid }) => (invalid ? "rgba(239,68,68,.10)" : "rgba(99,102,241,.10)")};
    border: 1px solid ${({ invalid }) => (invalid ? "rgba(239,68,68,.35)" : "rgba(99,102,241,.25)")};
    padding: 6px 8px; border-radius: 9px; pointer-events: none; z-index: 1;
  }

  input {
    width: 100%; height: 50px; border-radius: 14px;
    border: 1px solid ${({ invalid }) => (invalid ? "#ef4444" : "rgba(99,102,241,.22)")};
    padding: 0 14px 0 76px; font-size: 16px; color: ${BRAND.ink};
    background: #fff; transition: box-shadow .18s ease, border-color .18s ease;
    &::placeholder { color: #9aa3b2; }
    &:focus { outline: none; border-color: #6d5efc; box-shadow: 0 0 0 5px ${BRAND.ring}; }
  }

  @media (prefers-color-scheme: dark) {
    input { background: #0b0e1b; color: #e9ecff; border-color: rgba(255,255,255,.08); }
    input::placeholder { color: #63709a; }
  }
`;

const HelpRow = styled.div`display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;`;

const buttonBase = css`
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 900; cursor: pointer; user-select: none;
  -webkit-tap-highlight-color: transparent; transition: all 0.2s ease;
  position: relative; overflow: hidden; border: none;
  &:disabled { opacity: .65; cursor: not-allowed; }
`;

const Ghost = styled(motion.button)`
  ${buttonBase};
  height: 40px; padding: 0 12px; border-radius: 12px;
  border: 1px dashed rgba(109,94,252,.30);
  background: #fff; color: #5b63d6; font-size: 13px;
  &:hover { background: rgba(99,102,241,.06); transform: translateY(-1px); border-color: rgba(99,102,241,.45); }
  @media (prefers-color-scheme: dark) { background: #0b0e1b; color: #c9cfff; }
`;

const Primary = styled(motion.button)`
  ${buttonBase};
  min-width: 188px; height: 50px; border-radius: 14px; color: #fff; font-size: 15.5px;
  background: ${BRAND.grad}; background-size: 200% 100%;
  box-shadow: 0 14px 28px rgba(109,94,252,.22);
  animation: ${shimmer} 8s linear infinite;
`;

const Error = styled(motion.div)`
  color: #ef4444; font-size: 12.5px; margin-top: 6px;
`;

/* ================= Public list ================= */
const ListHeader = styled(motion.div)`
  display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 12px;
  @media (max-width: 520px) { flex-direction: column; align-items: flex-start; gap: 10px; }
`;

const ListTitle = styled.h3`
  margin: 0; color: #2d3150; font-size: 18px; font-weight: 900;
  @media (prefers-color-scheme: dark) { color: #e6e9ff; }
`;

const Search = styled(motion.input)`
  width: 240px; height: 42px; border-radius: 12px; border: 1px solid rgba(99,102,241,.22);
  padding: 0 12px; font-size: 14px; background: #fff; color: ${BRAND.ink}; transition: all 0.2s ease;
  &::placeholder { color: #9aa3b2; }
  &:focus { outline: none; box-shadow: 0 0 0 5px ${BRAND.ring}; border-color: #6d5efc; }
  @media (max-width: 520px) { width: 100%; }
  @media (prefers-color-scheme: dark) { background: #0b0e1b; color: #e6e9ff; border-color: rgba(255,255,255,.08); }
`;

const Item = styled(motion.div)`
  border: 1px solid rgba(99,102,241,.12);
  border-radius: 16px; background: #fff; padding: 14px 16px;
  display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;
  transition: all 0.2s ease; position: relative; overflow: hidden;

  &::before{
    content:''; position:absolute; top:0; left:0; width:6px; height:100%;
    background:${BRAND.grad}; opacity:.0; transition: opacity .3s ease;
  }
  &:not(:last-child){ margin-bottom: 10px; }
  &:hover{ transform: translateY(-2px); border-color: rgba(99,102,241,.26); box-shadow: 0 12px 26px rgba(99,102,241,.10); &::before{opacity:1;} }

  @media (prefers-color-scheme: dark) { background: #0b0e1b; border-color: rgba(255,255,255,.06); }
`;

const Name = styled.div`
  color: #303659; font-weight: 900; font-size: 16px; margin-bottom: 4px;
  @media (prefers-color-scheme: dark) { color: #e6e9ff; }
`;

const Meta = styled.div`
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center; color: ${BRAND.muted}; font-size: 13.5px;
  & > .dot { width: 4px; height: 4px; border-radius: 999px; background: #ccd1de; display: inline-block; }
  @media (prefers-color-scheme: dark) { color: #9aa3c9; & > .dot { background: #2a3050; } }
`;

const Chip = styled(motion.span) <{ tone?: "green" | "amber" }>`
  font-size: 12px; font-weight: 900; border-radius: 999px; padding: 5px 9px;
  ${({ tone }) =>
    tone === "green"
      ? "color: #047857; background: rgba(16,185,129,.18);"
      : "color: #b45309; background: rgba(245,158,11,.18);"}
`;

const ItemActions = styled.div` display: flex; gap: 8px; flex-wrap: wrap; `;

const Outline = styled(motion.button)`
  ${buttonBase};
  height: 40px; padding: 0 14px; border-radius: 12px;
  border: 1px solid rgba(99,102,241,.35); background: #fff; color: #5b63d6;
  &:hover { background: rgba(99,102,241,.06); transform: translateY(-1px); border-color: rgba(99,102,241,.48); }
  @media (prefers-color-scheme: dark) { background: #0b0e1b; color: #c9cfff; border-color: rgba(255,255,255,.10); }
`;

/* ================= Skeleton Loader ================= */
const Skeleton = styled(motion.div)`
  background: linear-gradient(90deg, #f1f3ff 25%, #e5e9ff 50%, #f1f3ff 75%);
  background-size: 200% 100%; animation: ${shimmer} 1.5s infinite; border-radius: 12px;
  @media (prefers-color-scheme: dark) {
    background: linear-gradient(90deg, #1a1d2e 25%, #25293f 50%, #1a1d2e 75%); background-size: 200% 100%;
  }
`;
const SkeletonItem = styled(Skeleton)` height: 92px; margin-bottom: 10px; `;

/* ================= Helpers ================= */
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const timeUntil = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return `${h}h ${r}m`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

const generateOrbs = (count: number) =>
  Array.from({ length: count }).map((_, i) => ({
    id: i,
    size: Math.random() * 120 + 60,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));

/* ================= Row (memoized) ================= */
type Contest = {
  id: string;
  name: string;
  startTime: string;
  participants: number;
  type: "public" | "private";
};

const ContestRow = memo(function ContestRow({
  c,
  index,
  onPreview,
  onRegister,
}: {
  c: Contest;
  index: number;
  onPreview: (id: string) => void;
  onRegister: (id: string) => void;
}) {
  const starts = timeUntil(c.startTime);
  const live = starts === "now";

  return (
    <Item
      role="article"
      aria-label={`${c.name} ${live ? "live" : "upcoming"}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
    >
      <div>
        <Name>
          {c.name}{" "}
          {live ? (
            <Chip
              tone="green"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
            >
              🟢 Live
            </Chip>
          ) : (
            <Chip tone="amber">⏰ Starts in {starts}</Chip>
          )}
        </Name>

        <Meta>
          <span>{formatDate(c.startTime)}</span>
          <span className="dot" />
          <span>👥 {c.participants.toLocaleString()} players</span>
          <span className="dot" />
          <span>{c.type}</span>
        </Meta>
      </div>

      <ItemActions>
        <Outline
          onClick={() => onPreview(c.id)}
          aria-label={`Preview ${c.name}`}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
        >
          Preview
        </Outline>

        <Primary
          onClick={() => onRegister(c.id)}
          aria-label={`Register for ${c.name}`}
          style={{ minWidth: "auto", padding: "0 14px", fontSize: "14px" }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
        >
          🎮 Register
        </Primary>
      </ItemActions>
    </Item>
  );
});

/* ================= Page ================= */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9\-]{3,24}$/i;

const JoinContestPage: React.FC = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const orbs = useMemo(() => generateOrbs(4), []);

  // Mock data (swap to API)
  const contests: Contest[] = useMemo(
    () =>
      [
        { id: "weekly-coding", name: "Weekly Coding Challenge", startTime: "2025-08-26T14:00:00", participants: 1245, type: "public" },
        { id: "algorithm-masters", name: "Algorithm Masters", startTime: "2025-08-28T18:00:00", participants: 892, type: "public" },
        { id: "ds-sprint", name: "Data Structures Sprint", startTime: "2025-09-02T10:00:00", participants: 2103, type: "public" },
      ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    []
  );

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(
    () => contests.filter(c => c.name.toLowerCase().includes(q.toLowerCase())),
    [contests, q]
  );

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return setErr("Please enter a contest code");
    if (!CODE_PATTERN.test(trimmed)) return setErr("Invalid code. Use letters/numbers/dash (4–25 chars)");
    setErr("");
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      navigate(`/contests/live/${trimmed}`);
    }, 450);
  }, [code, navigate]);

  const onPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    const text = e.clipboardData?.getData("text")?.trim();
    if (text && CODE_PATTERN.test(text)) {
      setCode(text.toUpperCase());
      setErr("");
      e.preventDefault();
    }
  };

  const handlePreview = useCallback((id: string) => navigate(`/contests/${id}`), [navigate]);
  const handleRegister = useCallback((id: string) => navigate(`/contests/${id}/register`), [navigate]);

  return (
    <Page>
      {/* Animated background orbs */}
      {!reduceMotion &&
        orbs.map((orb) => (
          <Orb
            key={orb.id}
            style={{ width: orb.size, height: orb.size, top: `${orb.y}%`, left: `${orb.x}%`, background: BRAND.grad }}
            animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
            transition={{ duration: orb.duration, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
          />
        ))}

      <Grid>
        {/* LEFT: Join via code */}
        <Card
          glass
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          whileHover={!reduceMotion ? { y: -2 } : undefined}
        >
          <HStack>
            <Title
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.14 }}
            >
              <img src="/images/LOGO.png" alt="a4ai Logo" className="logo" />
              Join a Contest
            </Title>

          </HStack>

          <PillRow>
            <Pill>Primary</Pill>
            <Pill>Middle</Pill>
            <Pill>High</Pill>
            <Pill>College</Pill>
            <Pill>Pro</Pill>
          </PillRow>

          <Subtitle
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            Pop in your code and hop right in. Or pick a public round from the list. Friendly, fair, and fun. ✨
          </Subtitle>

          <Form
            onSubmit={submit}
            aria-label="Join contest by code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.26 }}
          >
            <Group>
              <Label htmlFor="code">Contest Code</Label>
              <PrefixField
                invalid={!!err}
                whileHover={!reduceMotion ? { y: -1 } : undefined}
                transition={{ duration: 0.2 }}
              >
                <span className="prefix">CODE</span>
                <input
                  id="code"
                  ref={inputRef}
                  placeholder="e.g. WEEKLY-2025-01"
                  value={code}
                  onPaste={onPaste}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  aria-invalid={!!err}
                  aria-describedby={err ? "code-error" : undefined}
                />
              </PrefixField>

              <AnimatePresence>
                {err && (
                  <Error
                    id="code-error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {err}
                  </Error>
                )}
              </AnimatePresence>

              <HelpRow>
                <Ghost
                  type="button"
                  onClick={() => { setCode("WEEKLY-2025-01"); setErr(""); }}
                  whileHover={!reduceMotion ? { scale: 1.05 } : undefined}
                  whileTap={!reduceMotion ? { scale: 0.97 } : undefined}
                >
                  🔑 Try demo code
                </Ghost>

                <Ghost
                  type="button"
                  onClick={() => { setCode(""); setErr(""); inputRef.current?.focus(); }}
                  whileHover={!reduceMotion ? { scale: 1.05 } : undefined}
                  whileTap={!reduceMotion ? { scale: 0.97 } : undefined}
                >
                  🧹 Clear
                </Ghost>
              </HelpRow>
            </Group>

            <Primary
              type="submit"
              disabled={busy}
              aria-busy={busy}
              aria-label="Join contest"
              whileHover={!reduceMotion ? { scale: 1.02 } : undefined}
              whileTap={!reduceMotion ? { scale: 0.98 } : undefined}
            >
              {busy ? "Joining…" : "🚀 Join Contest"}
            </Primary>
          </Form>

          <motion.div
            style={{ marginTop: 14, color: BRAND.muted, fontSize: 13.5 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.34 }}
          >
            <strong
              style={{
                background: BRAND.grad,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Tip:
            </strong>{" "}
            If the contest is proctored, keep your camera on and close extra tabs for smooth play.
          </motion.div>
        </Card>

        {/* RIGHT: Public contests */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          whileHover={!reduceMotion ? { y: -2 } : undefined}
        >
          <ListHeader
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18 }}
          >
            <ListTitle>Available Public Contests</ListTitle>

            <Search
              placeholder="Search contests…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search public contests"
              whileFocus={!reduceMotion ? { scale: 1.02 } : undefined}
              transition={{ duration: 0.18 }}
            />
          </ListHeader>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {[1, 2, 3].map((i) => (
                  <SkeletonItem key={i} />
                ))}
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div
                key="empty"
                style={{
                  marginTop: 8,
                  padding: 22,
                  borderRadius: 16,
                  border: "1px dashed rgba(99,102,241,.25)",
                  color: BRAND.muted,
                  textAlign: "center",
                  background:
                    "linear-gradient(90deg, rgba(109,94,252,.06), rgba(34,193,253,.06))",
                  fontWeight: 800,
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
              >
                No contests match “{q}”. Try another keyword 🙂
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {filtered.map((c, index) => (
                  <ContestRow
                    key={c.id}
                    c={c}
                    index={index}
                    onPreview={handlePreview}
                    onRegister={handleRegister}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </Grid>
    </Page>
  );
};

export default JoinContestPage;
