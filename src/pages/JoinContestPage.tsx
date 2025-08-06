
// edited on 24th july 2:22AM

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const JoinContestContainer = styled.div`
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  text-align: center;
`;

const PageHeader = styled.h2`
  font-size: 2rem;
  color: #4a2c8a;
  margin-bottom: 1.5rem;
  background: linear-gradient(90deg, #6e48aa, #9d50bb);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const ContestForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
`;

const FormGroup = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FormLabel = styled.label`
  font-size: 0.95rem;
  font-weight: 600;
  color: #4a2c8a;
  text-align: left;
`;

const FormInput = styled.input`
  padding: 0.75rem 1rem;
  border: 1px solid rgba(110, 72, 170, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  width: 100%;

  &:focus {
    outline: none;
    border-color: #6e48aa;
    box-shadow: 0 0 0 3px rgba(110, 72, 170, 0.1);
  }
`;

const SubmitButton = styled.button`
  background: linear-gradient(135deg, #6e48aa, #9d50bb);
  color: white;
  border: none;
  padding: 0.85rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
  box-shadow: 0 4px 15px rgba(110, 72, 170, 0.2);
  width: 100%;
  max-width: 200px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(110, 72, 170, 0.3);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 0.25rem;
  text-align: left;
`;

const ContestListSection = styled.div`
  margin-top: 3rem;
  text-align: left;
`;

const ContestListHeader = styled.h3`
  color: #4a2c8a;
  margin-bottom: 1rem;
  font-size: 1.25rem;
`;

const ContestItem = styled.div`
  padding: 1rem;
  border: 1px solid rgba(110, 72, 170, 0.1);
  border-radius: 8px;
  margin-bottom: 1rem;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: rgba(110, 72, 170, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(110, 72, 170, 0.1);
  }
`;

const ContestTitle = styled.h4`
  color: #4a2c8a;
  margin-bottom: 0.5rem;
`;

const ContestMeta = styled.div`
  font-size: 0.85rem;
  color: #666;
  display: flex;
  gap: 1rem;
`;

const JoinContestPage = () => {
  const navigate = useNavigate();
  const [contestCode, setContestCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock data - replace with actual data from your backend
  const availableContests = [
    {
      id: 'weekly-challenge-2023',
      name: 'Weekly Coding Challenge',
      startTime: '2023-11-15T14:00:00',
      participants: 1245,
      type: 'public'
    },
    {
      id: 'algorithm-masters',
      name: 'Algorithm Masters',
      startTime: '2023-11-20T18:00:00',
      participants: 892,
      type: 'public'
    },
    {
      id: 'data-structures-sprint',
      name: 'Data Structures Sprint',
      startTime: '2023-11-25T10:00:00',
      participants: 2103,
      type: 'public'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contestCode.trim()) {
      setError('Please enter a contest code');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Simulate API call
    setTimeout(() => {
      console.log('Joining contest with code:', contestCode);
      setIsSubmitting(false);
      navigate(`/contests/live/${contestCode}`);
    }, 1000);
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <JoinContestContainer>
      <PageHeader>Join a Contest</PageHeader>
      
      <ContestForm onSubmit={handleSubmit}>
        <FormGroup>
          <FormLabel>Enter Contest Code</FormLabel>
          <FormInput
            type="text"
            placeholder="e.g. WEEKLY-2023"
            value={contestCode}
            onChange={(e) => setContestCode(e.target.value)}
            required
          />
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </FormGroup>

        <SubmitButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Joining...' : 'Join Contest'}
        </SubmitButton>
      </ContestForm>

      <ContestListSection>
        <ContestListHeader>Available Public Contests</ContestListHeader>
        {availableContests.map(contest => (
          <ContestItem key={contest.id} onClick={() => navigate(`/contests/${contest.id}`)}>
            <ContestTitle>{contest.name}</ContestTitle>
            <ContestMeta>
              <span>Starts: {formatDate(contest.startTime)}</span>
              <span>•</span>
              <span>{contest.participants.toLocaleString()} participants</span>
            </ContestMeta>
          </ContestItem>
        ))}
      </ContestListSection>
    </JoinContestContainer>
  );
};

export default JoinContestPage;