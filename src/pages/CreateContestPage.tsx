// src/pages/CreateContestPage.tsx

// 24th july 2:11AM edited


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const CreateContestContainer = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FormLabel = styled.label`
  font-size: 0.95rem;
  font-weight: 600;
  color: #4a2c8a;
`;

const FormInput = styled.input`
  padding: 0.75rem 1rem;
  border: 1px solid rgba(110, 72, 170, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6e48aa;
    box-shadow: 0 0 0 3px rgba(110, 72, 170, 0.1);
  }
`;

const FormTextarea = styled.textarea`
  padding: 0.75rem 1rem;
  border: 1px solid rgba(110, 72, 170, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6e48aa;
    box-shadow: 0 0 0 3px rgba(110, 72, 170, 0.1);
  }
`;

const FormSelect = styled.select`
  padding: 0.75rem 1rem;
  border: 1px solid rgba(110, 72, 170, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6e48aa;
    box-shadow: 0 0 0 3px rgba(110, 72, 170, 0.1);
  }
`;

const DateTimeContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const SubmitButton = styled.button`
  background: linear-gradient(135deg, #6e48aa, #9d50bb);
  color: white;
  border: none;
  padding: 0.85rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
  box-shadow: 0 4px 15px rgba(110, 72, 170, 0.2);

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
`;

const DifficultyOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const DifficultyTag = styled.span<{ selected: boolean }>`
  padding: 0.5rem 1rem;
  background: ${props => props.selected ? '#6e48aa' : 'rgba(110, 72, 170, 0.1)'};
  color: ${props => props.selected ? 'white' : '#6e48aa'};
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.selected ? '#6e48aa' : 'rgba(110, 72, 170, 0.2)'};
  }
`;

const CreateContestPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    contestType: 'public',
    difficulty: [] as string[],
    maxParticipants: '',
    rules: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const difficultyLevels = ['Easy', 'Medium', 'Hard'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDifficultyToggle = (level: string) => {
    setFormData(prev => {
      const newDifficulty = prev.difficulty.includes(level)
        ? prev.difficulty.filter(d => d !== level)
        : [...prev.difficulty, level];
      return { ...prev, difficulty: newDifficulty };
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = 'Contest name is required';
    if (!formData.startTime) newErrors.startTime = 'Start time is required';
    if (!formData.endTime) newErrors.endTime = 'End time is required';
    if (formData.difficulty.length === 0) newErrors.difficulty = 'Select at least one difficulty level';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setIsSubmitting(true);
      // Simulate API call
      setTimeout(() => {
        console.log('Contest created:', formData);
        setIsSubmitting(false);
        navigate('/contests');
      }, 1500);
    }
  };

  return (
    <CreateContestContainer>
      <PageHeader>Create a New Contest</PageHeader>
      
      <ContestForm onSubmit={handleSubmit}>
        <FormGroup>
          <FormLabel>Contest Name *</FormLabel>
          <FormInput
            type="text"
            name="name"
            placeholder="Enter contest name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
        </FormGroup>

        <FormGroup>
          <FormLabel>Description</FormLabel>
          <FormTextarea
            name="description"
            placeholder="Describe your contest (rules, prizes, etc.)"
            value={formData.description}
            onChange={handleChange}
          />
        </FormGroup>

        <DateTimeContainer>
          <FormGroup>
            <FormLabel>Start Time *</FormLabel>
            <FormInput
              type="datetime-local"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              required
            />
            {errors.startTime && <ErrorMessage>{errors.startTime}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <FormLabel>End Time *</FormLabel>
            <FormInput
              type="datetime-local"
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
              required
            />
            {errors.endTime && <ErrorMessage>{errors.endTime}</ErrorMessage>}
          </FormGroup>
        </DateTimeContainer>

        <FormGroup>
          <FormLabel>Contest Type</FormLabel>
          <FormSelect
            name="contestType"
            value={formData.contestType}
            onChange={handleChange}
          >
            <option value="public">Public (Anyone can join)</option>
            <option value="private">Private (Invite only)</option>
          </FormSelect>
        </FormGroup>

        <FormGroup>
          <FormLabel>Difficulty Levels *</FormLabel>
          <DifficultyOptions>
            {difficultyLevels.map(level => (
              <DifficultyTag
                key={level}
                selected={formData.difficulty.includes(level)}
                onClick={() => handleDifficultyToggle(level)}
              >
                {level}
              </DifficultyTag>
            ))}
          </DifficultyOptions>
          {errors.difficulty && <ErrorMessage>{errors.difficulty}</ErrorMessage>}
        </FormGroup>

        <FormGroup>
          <FormLabel>Maximum Participants (Leave empty for unlimited)</FormLabel>
          <FormInput
            type="number"
            name="maxParticipants"
            placeholder="Enter maximum number of participants"
            value={formData.maxParticipants}
            onChange={handleChange}
            min="1"
          />
        </FormGroup>

        <FormGroup>
          <FormLabel>Additional Rules</FormLabel>
          <FormTextarea
            name="rules"
            placeholder="Specify any special rules or constraints"
            value={formData.rules}
            onChange={handleChange}
          />
        </FormGroup>

        <SubmitButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Contest'}
        </SubmitButton>
      </ContestForm>
    </CreateContestContainer>
  );
};

export default CreateContestPage;