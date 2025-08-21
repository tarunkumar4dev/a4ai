// src/pages/ContestLandingPage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes, css } from "styled-components";

/* ==================== Theme & Motion ==================== */
const brandGrad = "linear-gradient(90deg, #4f46e5 0%, #a855f7 50%, #ec4899 100%)";

const shimmer = keyframes`
  0% { background-position: 0% 50% }
  100% { background-position: 200% 50% }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px) }
  to { opacity: 1; transform: translateY(0) }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1 }
  50% { transform: scale(1.06); opacity: 0.75 }
`;

/* ==================== Layout ==================== */
const Page = styled.div`
  min-height: 100vh;
  background: radial-gradient(1200px 500px at 15% 10%, rgba(79,70,229,0.06), transparent 60%),
              radial-gradient(1000px 500px at 80% 0%, rgba(168,85,247,0.06), transparent 60%),
              #fafafa;
`;

const ArenaContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 2rem;
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

/* ==================== Cards & Primitives ==================== */
const Card = styled.section<{ hover?: boolean }>`
  background: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(79, 70, 229, 0.12);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 10px 30px rgba(79,70,229,0.06);
  animation: ${fadeUp} 0.35s ease both;

  ${(p) =>
    p.hover &&
    css`
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
      &:hover {
        transform: translateY(-2px);
        border-color: rgba(79, 70, 229, 0.25);
        box-shadow:
          0 8px 22px rgba(79,70,229,0.12),
          0 18px 50px rgba(168,85,247,0.08);
      }
    `}
`;

const HeaderBand = styled.div`
  margin-bottom: 1.25rem;
`;

const Title = styled.h1`
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.15;
  margin: 0 0 0.25rem 0;
  background: ${brandGrad};
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  font-weight: 900;
  letter-spacing: -0.02em;
`;

const Subtitle = styled.p`
  color: #5b6070;
  margin: 0.25rem 0 1rem;
  font-size: 1.05rem;
`;

const Pill = styled.span<{ tone?: "indigo" | "emerald" | "amber" | "pink" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #1f2937;
  background: #f3f4f6;
  border: 1px solid rgba(0,0,0,0.06);

  ${(p) =>
    p.tone === "indigo" &&
    css`
      color: #4338ca;
      background: rgba(79, 70, 229, 0.08);
      border-color: rgba(79, 70, 229, 0.18);
    `}
  ${(p) =>
    p.tone === "emerald" &&
    css`
      color: #047857;
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.18);
    `}
  ${(p) =>
    p.tone === "amber" &&
    css`
      color: #92400e;
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.25);
    `}
  ${(p) =>
    p.tone === "pink" &&
    css`
      color: #be185d;
      background: rgba(236, 72, 153, 0.1);
      border-color: rgba(236, 72, 153, 0.25);
    `}
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  background: ${brandGrad};
  background-size: 200% 100%;
  color: white;
  border: 0;
  padding: 0.78rem 1.4rem;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  animation: ${shimmer} 8s linear infinite;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  box-shadow: 0 6px 18px rgba(79,70,229,0.25);

  &:hover { transform: translateY(-2px); filter: brightness(1.02); }
  &:active { transform: translateY(0px) scale(0.98); }
`;

const SecondaryButton = styled(PrimaryButton)`
  background: transparent;
  color: #4f46e5;
  border: 1px solid rgba(79, 70, 229, 0.4);
  box-shadow: none;
  animation: none;

  &:hover {
    background: rgba(79, 70, 229, 0.06);
  }
`;

const Grid2 = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const StatTile = styled.div`
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(79,70,229,0.06), rgba(168,85,247,0.06));
  border: 1px solid rgba(79,70,229,0.15);
`;

const StatTitle = styled.div`
  color: #4f46e5;
  font-weight: 700;
  font-size: 0.82rem;
  letter-spacing: 0.02em;
`;

const StatValue = styled.div`
  font-size: 1.65rem;
  font-weight: 900;
  color: #1f2353;
  margin: 0.25rem 0 0.25rem;
`;

const Muted = styled.div`
  font-size: 0.86rem;
  color: #667085;
`;

const ProgressShell = styled.div`
  height: 8px;
  background: rgba(79,70,229,0.12);
  border-radius: 999px;
  overflow: hidden;
`;

const Progress = styled.div<{ value: number }>`
  width: ${(p) => p.value}%;
  height: 100%;
  border-radius: 999px;
  background: ${brandGrad};
  transition: width 0.5s ease;
`;

/* ==================== Lists & Items ==================== */
const SectionTitle = styled.h2`
  font-size: 1.15rem;
  font-weight: 800;
  color: #1f2353;
  margin: 1.75rem 0 1rem;
  letter-spacing: -0.01em;
`;

const ContestList = styled.div``;

const ContestItem = styled.div`
  padding: 1rem 1.1rem;
  border: 1px solid rgba(79,70,229,0.12);
  border-radius: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  background: #fff;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  margin-bottom: 0.75rem;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(79,70,229,0.28);
    box-shadow: 0 10px 28px rgba(79,70,229,0.1);
  }
`;

const ContestName = styled.div`
  color: #1f2353;
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 0.25rem;
`;

const ContestMeta = styled.div`
  color: #6b7280;
  font-size: 0.9rem;
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

/* ==================== Right Column ==================== */
const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const ProfileWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 0.75rem;
`;

const Avatar = styled.div`
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: ${brandGrad};
  color: white;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 1.2rem;
  box-shadow: 0 6px 18px rgba(79,70,229,0.25);
`;

const UserName = styled.div`
  font-weight: 900;
  color: #1f2353;
`;

const Handle = styled.div`
  color: #6b7280;
  font-size: 0.9rem;
`;

const Divider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.12), transparent);
  margin: 0.75rem 0 1rem;
`;

/* ==================== Tabs ==================== */
const Tabs = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const Tab = styled.button<{ active?: boolean }>`
  border: 1px solid rgba(79,70,229,0.2);
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.86rem;
  color: ${(p) => (p.active ? "#fff" : "#4f46e5")};
  background: ${(p) => (p.active ? brandGrad : "transparent")};
  background-size: 200% 100%;
  animation: ${(p) => (p.active ? shimmer : "none")} 10s linear infinite;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;

  &:hover { transform: translateY(-1px) }
`;

/* ==================== Component ==================== */
const ContestLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"upcoming" | "ongoing" | "past">("upcoming");

  // Mock data — you can wire to API later
  const user = {
    name: "Tarun Kumar",
    handle: "tarunkiriddev",
  };

  const stats = {
    solved: 160,
    totalProblems: 4000,
    rank: 804,
    activeDays: 63,
    maxStreak: 11,
  };

  const buckets = useMemo(
    () => ({
      upcoming: [
        { id: "weekly-maths", title: "Weekly Maths Challenge", startsIn: "2 days", participants: 125, length: "60m", type: "MCQ" },
        { id: "chemistry-sprint", title: "Chemistry Sprint", startsIn: "3 days", participants: 210, length: "45m", type: "Mixed" },
      ],
      ongoing: [
        { id: "physics-masters", title: "Physics Masters", status: "Live", participants: 89, endsIn: "34m", length: "90m", type: "Mixed" },
      ],
      past: [
        { id: "aptitude-open", title: "Aptitude Open 2025 #3", date: "May 12", participants: 980, yourRank: 143 },
        { id: "cs-fundamentals", title: "CS Fundamentals Derby", date: "Apr 28", participants: 740, yourRank: 210 },
      ],
    }),
    []
  );

  const list = buckets[tab];

  return (
    <Page>
      <ArenaContainer>
        {/* ==================== LEFT: Main ==================== */}
        <Card as="main">
          <HeaderBand>
            <Title>Welcome to the Arena</Title>
            <Subtitle>Compete, learn, and win. Join exciting contests or create your own in minutes.</Subtitle>
            <ButtonRow>
              <PrimaryButton onClick={() => navigate("/contests/join")}>Join a Contest</PrimaryButton>
              <SecondaryButton onClick={() => navigate("/contests/create")}>Create a Contest</SecondaryButton>
              <Pill tone="indigo" aria-label="Proctored & secure">
                • Proctored & secure
              </Pill>
              <Pill tone="emerald" aria-label="Fair rankings">
                • Fair rankings
              </Pill>
              <Pill tone="pink" aria-label="AI anti-cheat">
                • AI anti-cheat
              </Pill>
            </ButtonRow>
          </HeaderBand>

          {/* Quick Stats */}
          <Grid2>
            <StatTile>
              <StatTitle>Problems Solved</StatTitle>
              <StatValue>
                {stats.solved.toLocaleString()}/{stats.totalProblems.toLocaleString()}
              </StatValue>
              <ProgressShell>
                <Progress value={(stats.solved / stats.totalProblems) * 100} />
              </ProgressShell>
              <Muted>Keep going — new sets unlock at 250!</Muted>
            </StatTile>

            <StatTile>
              <StatTitle>Contest Rating</StatTitle>
              <StatValue>#{stats.rank.toLocaleString()}</StatValue>
              <Muted>Top 20% — steady climb</Muted>
            </StatTile>

            <StatTile>
              <StatTitle>Active Days</StatTitle>
              <StatValue>{stats.activeDays}</StatValue>
              <Muted>Daily streak boosts XP gains</Muted>
            </StatTile>

            <StatTile>
              <StatTitle>Max Streak</StatTitle>
              <StatValue>{stats.maxStreak}</StatValue>
              <Muted>Beat your best this week</Muted>
            </StatTile>
          </Grid2>

          {/* Tabs */}
          <SectionTitle>Contests</SectionTitle>
          <Tabs>
            <Tab active={tab === "upcoming"} onClick={() => setTab("upcoming")} aria-pressed={tab === "upcoming"}>
              Upcoming
            </Tab>
            <Tab active={tab === "ongoing"} onClick={() => setTab("ongoing")} aria-pressed={tab === "ongoing"}>
              Ongoing
            </Tab>
            <Tab active={tab === "past"} onClick={() => setTab("past")} aria-pressed={tab === "past"}>
              Past
            </Tab>
          </Tabs>

          {/* List */}
          <ContestList>
            {tab === "upcoming" &&
              list.map((c) => (
                <ContestItem key={c.id}>
                  <div>
                    <ContestName>{c.title}</ContestName>
                    <ContestMeta>
                      <span>Starts in {c.startsIn}</span>
                      <span>•</span>
                      <span>{c.participants.toLocaleString()} participants</span>
                      <span>•</span>
                      <span>{c.length}</span>
                      <span>•</span>
                      <span>{c.type}</span>
                    </ContestMeta>
                  </div>
                  <PrimaryButton onClick={() => navigate(`/contests/${c.id}`)}>Preview</PrimaryButton>
                </ContestItem>
              ))}

            {tab === "ongoing" &&
              list.map((c) => (
                <ContestItem key={c.id}>
                  <div>
                    <ContestName>
                      {c.title} <Pill tone="amber" style={{ marginLeft: 8 }}>Live</Pill>
                    </ContestName>
                    <ContestMeta>
                      <span>{c.participants.toLocaleString()} participants</span>
                      <span>•</span>
                      <span>Ends in {c.endsIn}</span>
                      <span>•</span>
                      <span>{c.length}</span>
                      <span>•</span>
                      <span>{c.type}</span>
                    </ContestMeta>
                  </div>
                  <PrimaryButton onClick={() => navigate(`/contests/${c.id}`)}>Enter</PrimaryButton>
                </ContestItem>
              ))}

            {tab === "past" &&
              list.map((c) => (
                <ContestItem key={c.id}>
                  <div>
                    <ContestName>{c.title}</ContestName>
                    <ContestMeta>
                      <span>{c.date}</span>
                      <span>•</span>
                      <span>{c.participants.toLocaleString()} participants</span>
                      {"yourRank" in c && (
                        <>
                          <span>•</span>
                          <span>Your rank: {c.yourRank}</span>
                        </>
                      )}
                    </ContestMeta>
                  </div>
                  <SecondaryButton onClick={() => navigate(`/contests/${c.id}`)}>Details</SecondaryButton>
                </ContestItem>
              ))}
          </ContestList>

          {/* Highlights & Safety */}
          <SectionTitle>Highlights</SectionTitle>
          <Grid2>
            <Card hover>
              <StatTitle>Blueprinted Difficulty</StatTitle>
              <Muted>
                Lock difficulty mix & outcomes before start. All participants get deterministic sets (A/B) with equal weightage.
              </Muted>
            </Card>
            <Card hover>
              <StatTitle>Smart Proctoring</StatTitle>
              <Muted>
                Face presence, tab-switch detection, and warning scores — fairness without being intrusive.
              </Muted>
            </Card>
          </Grid2>

          <SectionTitle>Safety & Fair Play</SectionTitle>
          <Card hover>
            <Muted>
              We use camera-on verification (never stored without consent), anonymized scoring, and strict anti-cheat. See our{" "}
              <a href="/policies/contests" style={{ color: "#4f46e5", fontWeight: 700 }}>contest policy</a>.
            </Muted>
          </Card>
        </Card>

        {/* ==================== RIGHT: Aside ==================== */}
        <Aside>
          <Card>
            <ProfileWrap>
              <Avatar aria-hidden>{user.name.charAt(0)}</Avatar>
              <div>
                <UserName>{user.name}</UserName>
                <Handle>@{user.handle}</Handle>
              </div>
            </ProfileWrap>
            <Divider />
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

          <Card>
            <StatTitle>Problem Stats</StatTitle>
            <Divider />
            <MiniMeter label="Easy" value={52} total={886} />
            <MiniMeter label="Medium" value={89} total={1844} />
            <MiniMeter label="Hard" value={19} total={855} />
          </Card>

          <Card>
            <StatTitle>Achievements</StatTitle>
            <Divider />
            <BadgeRow>
              <Badge pill>100 Days</Badge>
              <Badge pill tone="pink">Top 10%</Badge>
              <Badge pill tone="emerald">Clean Run</Badge>
              <Badge pill tone="amber">Weekly Winner</Badge>
            </BadgeRow>
            <Muted style={{ marginTop: 10 }}>More badges unlock with streaks & contests.</Muted>
          </Card>
        </Aside>
      </ArenaContainer>
    </Page>
  );
};

/* ==================== Small Pieces ==================== */
const MeterShell = styled.div`
  background: rgba(79,70,229,0.10);
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  margin: 0.4rem 0 0.75rem;
`;
const MeterFill = styled.div<{ pct: number }>`
  width: ${(p) => p.pct}%;
  height: 100%;
  border-radius: 999px;
  background: ${brandGrad};
  transition: width 0.45s ease;
`;
const MeterLabel = styled.div`
  display: flex;
  justify-content: space-between;
  color: #4f46e5;
  font-weight: 700;
  font-size: 0.85rem;
`;

function MiniMeter({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (value / total) * 100));
  return (
    <div>
      <MeterLabel>
        <span>{label}</span>
        <span>
          {value}/{total}
        </span>
      </MeterLabel>
      <MeterShell>
        <MeterFill pct={pct} />
      </MeterShell>
    </div>
  );
}

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;
const Badge = styled.span<{ tone?: "pink" | "emerald" | "amber"; pill?: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: ${(p) => (p.pill ? "999px" : "8px")};
  font-size: 0.78rem;
  font-weight: 700;
  color: #1f2937;
  background: #f3f4f6;
  border: 1px solid rgba(0,0,0,0.06);

  ${(p) =>
    p.tone === "pink" &&
    css`
      color: #be185d;
      background: rgba(236,72,153,0.1);
      border-color: rgba(236,72,153,0.25);
    `}
  ${(p) =>
    p.tone === "emerald" &&
    css`
      color: #047857;
      background: rgba(16,185,129,0.1);
      border-color: rgba(16,185,129,0.25);
    `}
  ${(p) =>
    p.tone === "amber" &&
    css`
      color: #92400e;
      background: rgba(245,158,11,0.12);
      border-color: rgba(245,158,11,0.3);
    `}
`;

export default ContestLandingPage;
