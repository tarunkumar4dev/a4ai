// src/pages/JoinContestPage.tsx — refreshed, cool & authentic
// - Subtle glassmorphism + brand gradient accents
// - Crisp typography + consistent spacing
// - Better accessibility (labels, aria), keyboard UX, paste-from-clipboard
// - Tiny micro‑interactions (hover/press), unobtrusive animations
// - Public contests with lightweight skeletons and empty state

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes, css } from "styled-components";

/* ================= Brand ================= */
const GRAD_PRIMARY = "linear-gradient(90deg, #6d5efc 0%, #a855f7 100%)"; // a4ai indigo→purple
const SURFACE = "#ffffff";
const INK = "#25293f";
const MUTED = "#7b829a";
const BORDER = "rgba(109, 94, 252, .18)";
const RING = "rgba(109, 94, 252, .18)";

/* ================= Motion ================= */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
`;

const shimmer = keyframes`
  0% {background-position: -200% 0}
  100% {background-position: 200% 0}
`;

/* ================= Layout ================= */
const Page = styled.div`
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background:
    radial-gradient(1000px 520px at 12% -10%, rgba(109,94,252,.06), transparent 60%),
    radial-gradient(1000px 520px at 88% -6%, rgba(168,85,247,.06), transparent 60%),
    #fbfbfe;
  padding: 28px 16px;

  @media (prefers-color-scheme: dark) {
    background:
      radial-gradient(1000px 520px at 12% -10%, rgba(109,94,252,.14), transparent 60%),
      radial-gradient(1000px 520px at 88% -6%, rgba(168,85,247,.12), transparent 60%),
      #0b0d17;
  }
`;

const Grid = styled.div`
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: 1.08fr .92fr; gap: 22px;
  @media (max-width: 980px) { grid-template-columns: 1fr; gap: 18px; }
`;

/* ================= Card ================= */
const Card = styled.section<{ glass?: boolean }>`
  background: ${({ glass }) => (glass ? "rgba(255,255,255,.92)" : SURFACE)};
  backdrop-filter: ${({ glass }) => (glass ? "blur(8px)" : "none")};
  border-radius: 18px; padding: 22px; border: 1px solid ${BORDER};
  box-shadow: 0 10px 24px rgba(17, 24, 39, .06);
  animation: ${fadeUp} .28s ease both;

  @media (prefers-color-scheme: dark) {
    background: ${({ glass }) => (glass ? "rgba(12,14,25,.72)" : "#0f1221")};
    border-color: rgba(255,255,255,.06);
    box-shadow: 0 10px 28px rgba(0,0,0,.35);
  }
`;

/* ================= Headers ================= */
const Title = styled.h2`
  margin: 0 0 6px; font-size: clamp(26px, 3.2vw, 34px); line-height: 1.08;
  font-weight: 900; letter-spacing: -0.02em;
  background: ${GRAD_PRIMARY}; -webkit-background-clip: text; background-clip: text; color: transparent;
`;

const Subtitle = styled.p`
  color: ${MUTED}; margin: 0 0 18px; font-size: 15.5px;
  @media (prefers-color-scheme: dark) { color: #98a1c0; }
`;

/* ================= Form ================= */
const Form = styled.form`
  display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: end;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

const Group = styled.div`display: grid; gap: 8px;`;
const Label = styled.label`font-size: 13px; font-weight: 800; color: #5b63d6;`;

const PrefixField = styled.div<{ invalid?: boolean }>`
  position: relative;
  .prefix {
    position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
    font-weight: 900; font-size: 12px; letter-spacing: .045em;
    color: ${({ invalid }) => (invalid ? "#ef4444" : "#5b63d6")};
    background: ${({ invalid }) => (invalid ? "rgba(239,68,68,.10)" : "rgba(99,102,241,.10)")};
    border: 1px solid ${({ invalid }) => (invalid ? "rgba(239,68,68,.35)" : "rgba(99,102,241,.25)")};
    padding: 6px 8px; border-radius: 9px; pointer-events: none;
  }
  input {
    width: 100%; height: 46px; border-radius: 12px; border: 1px solid ${({ invalid }) => (invalid ? "#ef4444" : "rgba(99,102,241,.24)")};
    padding: 0 14px 0 72px; font-size: 15px; color: ${INK}; background: #fff;
    transition: box-shadow .18s ease, border-color .18s ease, background .18s ease;
    &::placeholder { color: #9aa3b2; }
    &:focus { outline: none; border-color: #6d5efc; box-shadow: 0 0 0 4px ${RING}; }
  }
  @media (prefers-color-scheme: dark) {
    input { background: #0b0e1b; color: #e9ecff; border-color: rgba(255,255,255,.08); }
    input::placeholder { color: #63709a; }
  }
`;

const HelpRow = styled.div`display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;`;

const buttonBase = css`
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: background .18s ease, transform .14s ease, border-color .18s ease, filter .16s ease;
`;

const Ghost = styled.button`
  ${buttonBase}; height: 38px; padding: 0 12px; border-radius: 10px;
  border: 1px dashed rgba(109,94,252,.30); background: #fff; color: #5b63d6; font-size: 13px;
  &:hover { background: rgba(99,102,241,.06); transform: translateY(-1px); border-color: rgba(99,102,241,.45); }
  @media (prefers-color-scheme: dark) { background: #0b0e1b; color: #c9cfff; }
`;

const Primary = styled.button<{ disabled?: boolean }>`
  ${buttonBase}; min-width: 178px; height: 46px; border-radius: 12px; border: none; color: #fff; font-size: 15px;
  background: ${GRAD_PRIMARY}; box-shadow: 0 12px 26px rgba(109,94,252,.22);
  &:hover { transform: translateY(-2px); filter: brightness(1.04); }
  &:active { transform: translateY(-1px) scale(.98); }
  &:disabled { opacity: .65; cursor: not-allowed; transform: none; box-shadow: none; }
`;

const Error = styled.div` color:#ef4444;font-size:12.5px;margin-top:6px; `;

/* ================= Public list ================= */
const ListHeader = styled.div`
  display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px;
  @media (max-width:520px){flex-direction:column;align-items:flex-start;gap:10px;}
`;
const ListTitle = styled.h3` margin:0;color:#2d3150;font-size:16px;font-weight:900; @media (prefers-color-scheme: dark){ color:#e6e9ff; }`;
const Search = styled.input`
  width: 220px; height: 40px; border-radius: 12px; border: 1px solid rgba(99,102,241,.22);
  padding: 0 12px; font-size: 14px; background: #fff; color: ${INK};
  &::placeholder { color: #9aa3b2; }
  &:focus { outline: none; box-shadow: 0 0 0 4px ${RING}; border-color: #6d5efc; }
  @media (max-width:520px){ width: 100%; }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; color:#e6e9ff; border-color: rgba(255,255,255,.08); }
`;

const Item = styled.div`
  border:1px solid rgba(99,102,241,.12); border-radius: 14px; background: #fff; padding: 14px 16px;
  display:grid; grid-template-columns:1fr auto; gap: 12px; align-items:center;
  transition:transform .16s ease, box-shadow .20s ease, border-color .16s ease; will-change: transform;
  &:not(:last-child){ margin-bottom: 10px; }
  &:hover{ transform: translateY(-2px); border-color: rgba(99,102,241,.26); box-shadow: 0 12px 26px rgba(99,102,241,.10); }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; border-color: rgba(255,255,255,.06); }
`;

const Name = styled.div` color:#303659; font-weight:900; font-size:16px; margin-bottom: 4px; @media (prefers-color-scheme: dark){ color:#e6e9ff; }`;

const Meta = styled.div`
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center; color: ${MUTED}; font-size: 13.5px;
  & > .dot { width: 4px; height: 4px; border-radius: 999px; background: #ccd1de; display: inline-block; }
  @media (prefers-color-scheme: dark){ color:#9aa3c9; &>.dot{ background:#2a3050; } }
`;

const Chip = styled.span<{ tone?: "green" | "amber" }>`
  font-size: 12px; font-weight: 900; border-radius: 999px; padding: 4px 8px;
  ${({ tone }) =>
    tone === "green"
      ? "color:#0f766e;background:rgba(45,212,191,.16);"
      : "color:#b45309;background:rgba(245,158,11,.18);"}
`;

const ItemActions = styled.div`display:flex;gap:8px;flex-wrap:wrap;`;

const Outline = styled.button`
  ${buttonBase}; height: 38px; padding: 0 14px; border-radius: 10px;
  border: 1px solid rgba(99,102,241,.35); background: #fff; color: #5b63d6;
  &:hover { background: rgba(99,102,241,.06); transform: translateY(-1px); border-color: rgba(99,102,241,.48); }
  @media (prefers-color-scheme: dark){ background:#0b0e1b; color:#c9cfff; border-color: rgba(255,255,255,.10); }
`;

/* ================= Helpers ================= */
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

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

/* ================= Page ================= */
const JoinContestPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mock data (swap for API)
  const contests = useMemo(() => [
    { id: "weekly-coding",     name: "Weekly Coding Challenge", startTime: "2025-08-26T14:00:00", participants: 1245, type: "public" as const },
    { id: "algorithm-masters", name: "Algorithm Masters",       startTime: "2025-08-28T18:00:00", participants: 892,  type: "public" as const },
    { id: "ds-sprint",         name: "Data Structures Sprint",  startTime: "2025-09-02T10:00:00", participants: 2103, type: "public" as const },
  ], []);

  const filtered = useMemo(() => contests.filter(c => c.name.toLowerCase().includes(q.toLowerCase())), [contests, q]);

  const pattern = /^[A-Z0-9][A-Z0-9\-]{3,24}$/i;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setErr("Please enter a contest code");
    if (!pattern.test(code.trim())) return setErr("Invalid code. Use letters/numbers/dash (4–25 chars)");

    setErr(""); setBusy(true);
    setTimeout(() => { setBusy(false); navigate(`/contests/live/${code.trim()}`); }, 650);
  };

  // Shortcut: Cmd/Ctrl+V on input wrapper to paste code directly
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    const onPaste = async (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && pattern.test(text)) { setCode(text.toUpperCase()); setErr(""); }
    };
    el.addEventListener("paste", onPaste as any);
    return () => el.removeEventListener("paste", onPaste as any);
  }, [pattern]);

  return (
    <Page>
      <Grid>
        {/* LEFT: Join via code */}
        <Card glass>
          <Title>Join a Contest</Title>
          <Subtitle>Enter the code your host shared. Or pick from public contests on the right.</Subtitle>

          <Form onSubmit={submit} aria-label="Join contest by code">
            <Group>
              <Label htmlFor="code">Contest Code</Label>
              <PrefixField invalid={!!err}>
                <span className="prefix">CODE</span>
                <input
                  id="code"
                  ref={inputRef}
                  placeholder="e.g. WEEKLY-2025-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  aria-invalid={!!err}
                  aria-describedby={err ? "code-error" : undefined}
                />
              </PrefixField>
              {err && <Error id="code-error">{err}</Error>}

              <HelpRow>
                <Ghost type="button" onClick={() => { setCode("WEEKLY-2025-01"); setErr(""); }}>Try demo code</Ghost>
                <Ghost type="button" onClick={() => { setCode(""); setErr(""); }}>Clear</Ghost>
              </HelpRow>
            </Group>

            <Primary type="submit" disabled={busy} aria-busy={busy} aria-label="Join contest">
              {busy ? "Joining…" : "Join Contest"}
            </Primary>
          </Form>

          <div style={{ marginTop: 14, color: MUTED, fontSize: 13.5 }}>
            <strong style={{ background: GRAD_PRIMARY, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Tip:</strong>
            {" "}If the contest is proctored, enable your camera and close other tabs for best performance.
          </div>
        </Card>

        {/* RIGHT: Public contests */}
        <Card>
          <ListHeader>
            <ListTitle>Available Public Contests</ListTitle>
            <Search placeholder="Search contests…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search public contests" />
          </ListHeader>

          {filtered.length === 0 && (
            <div style={{
              marginTop: 8,
              padding: 16,
              borderRadius: 12,
              border: "1px dashed rgba(99,102,241,.25)",
              color: MUTED,
              textAlign: "center",
              background: "linear-gradient(90deg, rgba(109,94,252,.06), rgba(168,85,247,.06))",
            }}>
              No contests match “{q}”.
            </div>
          )}

          {filtered.map((c) => {
            const starts = timeUntil(c.startTime);
            const live = starts === "now";
            return (
              <Item key={c.id} role="article" aria-label={`${c.name} ${live ? "live" : "upcoming"}`}>
                <div>
                  <Name>
                    {c.name}{" "}
                    {live ? <Chip tone="green">Live</Chip> : <Chip tone="amber">Starts in {starts}</Chip>}
                  </Name>
                  <Meta>
                    <span>{formatDate(c.startTime)}</span>
                    <span className="dot" />
                    <span>{c.participants.toLocaleString()} participants</span>
                    <span className="dot" />
                    <span>{c.type}</span>
                  </Meta>
                </div>

                <ItemActions>
                  <Outline onClick={() => navigate(`/contests/${c.id}`)} aria-label={`Preview ${c.name}`}>Preview</Outline>
                  <Primary onClick={() => navigate(`/contests/${c.id}/register`)} aria-label={`Register for ${c.name}`}>Register</Primary>
                </ItemActions>
              </Item>
            );
          })}
        </Card>
      </Grid>
    </Page>
  );
};

export default JoinContestPage;
