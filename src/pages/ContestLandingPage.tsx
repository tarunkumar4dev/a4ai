
// 24th july 2:07AM edited

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

// Gradient animation for the header
const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const ArenaContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const MainContent = styled.section`
  background: #fff;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
`;

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(152, 84, 246, 0.1);
`;

const Header = styled.h1`
  font-size: 2.5rem;
  color: #4a2c8a;
  margin-bottom: 1rem;
  background: linear-gradient(90deg, #6e48aa, #9d50bb);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Subheader = styled.p`
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  background: linear-gradient(135deg, #6e48aa, #9d50bb);
  color: white;
  border: none;
  padding: 0.75rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(110, 72, 170, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(110, 72, 170, 0.3);
  }
`;

const SecondaryButton = styled.button`
  background: white;
  color: #6e48aa;
  border: 1px solid #6e48aa;
  padding: 0.75rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(110, 72, 170, 0.05);
    transform: translateY(-2px);
  }
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 2rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  padding: 1.25rem;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(110, 72, 170, 0.05), rgba(157, 80, 187, 0.05));
  border: 1px solid rgba(110, 72, 170, 0.1);
`;

const StatTitle = styled.h3`
  font-size: 0.9rem;
  color: #6e48aa;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const StatValue = styled.p`
  font-size: 1.75rem;
  font-weight: 700;
  color: #4a2c8a;
  margin: 0.25rem 0;
`;

const ContestList = styled.div`
  margin-top: 2rem;
`;

const ContestItem = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid rgba(110, 72, 170, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  border-radius: 8px;

  &:hover {
    background: rgba(110, 72, 170, 0.03);
    transform: translateY(-2px);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ContestTitle = styled.h3`
  font-size: 1.1rem;
  color: #4a2c8a;
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const ContestMeta = styled.div`
  font-size: 0.85rem;
  color: #888;
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const Avatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6e48aa, #9d50bb);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.4rem;
  box-shadow: 0 4px 10px rgba(110, 72, 170, 0.2);
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const Username = styled.span`
  font-weight: 700;
  color: #4a2c8a;
`;

const Handle = styled.span`
  font-size: 0.9rem;
  color: #888;
`;

const ProgressBar = styled.div`
  height: 8px;
  background: rgba(110, 72, 170, 0.1);
  border-radius: 4px;
  margin: 0.75rem 0;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ width: number }>`
  height: 100%;
  width: ${props => props.width}%;
  background: linear-gradient(90deg, #6e48aa, #9d50bb);
  border-radius: 4px;
  transition: width 0.5s ease;
`;

const ContestLandingPage = () => {
  const navigate = useNavigate();

  // Mock data - replace with actual data from your backend
  const userStats = {
    username: 'Tarun Kumar',
    handle: 'tarunkiriddev',
    rank: 804,
    solved: 160,
    totalProblems: 4000,
    easy: { solved: 52, total: 886 },
    medium: { solved: 89, total: 1844 },
    hard: { solved: 19, total: 855 },
    activeDays: 63,
    maxStreak: 11,
    badges: 4,
    recentBadge: '100 Days Badge 2024'
  };

  const contests = [
    { id: 1, title: 'Weekly Maths Challenge', date: 'Starts in 2 days', participants: 125 },
    { id: 2, title: 'Physics Masters', date: 'Ongoing', participants: 89 },
    { id: 3, title: 'Chemistry Sprint', date: 'Ends tomorrow', participants: 210 }
  ];

  return (
    <ArenaContainer>
      <MainContent>
        <Header>Welcome to the Arena!</Header>
        <Subheader>Compete, learn, and win. Here You can Join exciting contests or create your own.</Subheader>
        
        <ButtonGroup>
          <PrimaryButton onClick={() => navigate('/contests/join')}>Join a Contest</PrimaryButton>
          <SecondaryButton onClick={() => navigate('/contests/create')}>Create a Contest</SecondaryButton>
        </ButtonGroup>

        <StatsContainer>
          <StatCard>
            <StatTitle>Problems Solved</StatTitle>
            <StatValue>{userStats.solved}/{userStats.totalProblems}</StatValue>
            <ProgressBar>
              <ProgressFill width={(userStats.solved / userStats.totalProblems) * 100} />
            </ProgressBar>
          </StatCard>
          
          <StatCard>
            <StatTitle>Contest Rating</StatTitle>
            <StatValue>{userStats.rank.toLocaleString()}</StatValue>
            <ProgressBar>
              <ProgressFill width={30} />
            </ProgressBar>
          </StatCard>
          
          <StatCard>
            <StatTitle>Active Days</StatTitle>
            <StatValue>{userStats.activeDays}</StatValue>
          </StatCard>
          
          <StatCard>
            <StatTitle>Max Streak</StatTitle>
            <StatValue>{userStats.maxStreak}</StatValue>
          </StatCard>
        </StatsContainer>

        <ContestList>
          <h2 style={{ color: '#4a2c8a', marginBottom: '1.5rem' }}>Featured Contests</h2>
          {contests.map(contest => (
            <ContestItem key={contest.id}>
              <div>
                <ContestTitle>{contest.title}</ContestTitle>
                <ContestMeta>{contest.date} • {contest.participants.toLocaleString()} participants</ContestMeta>
              </div>
              <PrimaryButton onClick={() => navigate(`/contests/${contest.id}`)}>View</PrimaryButton>
            </ContestItem>
          ))}
        </ContestList>
      </MainContent>

      <Sidebar>
        <Card>
          <UserProfile>
            <Avatar>{userStats.username.charAt(0)}</Avatar>
            <UserInfo>
              <Username>{userStats.username}</Username>
              <Handle>@{userStats.handle}</Handle>
            </UserInfo>
          </UserProfile>
          
          <div>
            <StatTitle>Rank</StatTitle>
            <StatValue>#{userStats.rank.toLocaleString()}</StatValue>
          </div>
        </Card>

        <Card>
          <h3 style={{ color: '#4a2c8a', marginBottom: '1rem' }}>Problem Stats</h3>
          <div>
            <StatTitle>Easy</StatTitle>
            <StatValue>{userStats.easy.solved}/{userStats.easy.total}</StatValue>
            <ProgressBar>
              <ProgressFill width={(userStats.easy.solved / userStats.easy.total) * 100} />
            </ProgressBar>
          </div>
          
          <div style={{ marginTop: '1.25rem' }}>
            <StatTitle>Medium</StatTitle>
            <StatValue>{userStats.medium.solved}/{userStats.medium.total}</StatValue>
            <ProgressBar>
              <ProgressFill width={(userStats.medium.solved / userStats.medium.total) * 100} />
            </ProgressBar>
          </div>
          
          <div style={{ marginTop: '1.25rem' }}>
            <StatTitle>Hard</StatTitle>
            <StatValue>{userStats.hard.solved}/{userStats.hard.total}</StatValue>
            <ProgressBar>
              <ProgressFill width={(userStats.hard.solved / userStats.hard.total) * 100} />
            </ProgressBar>
          </div>
        </Card>

        <Card>
          <h3 style={{ color: '#4a2c8a', marginBottom: '1rem' }}>Achievements</h3>
          <div>
            <StatTitle>Badges</StatTitle>
            <StatValue>{userStats.badges}</StatValue>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <StatTitle>Recent Badge</StatTitle>
            <StatValue style={{ fontSize: '1rem' }}>{userStats.recentBadge}</StatValue>
          </div>
        </Card>
      </Sidebar>
    </ArenaContainer>
  );
};

export default ContestLandingPage;