import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  Trash2, 
  Edit, 
  Save,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AdminAddQuestions = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  
  const [contest, setContest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    options: { A: '', B: '', C: '', D: '' },
    correct_answer: 'A',
    marks: 4,
    negative_marks: 1,
    subject: 'Science',
    difficulty: 'medium',
    question_order: 1,
    explanation: ''
  });

  useEffect(() => {
    if (contestId) {
      fetchContest();
      fetchQuestions();
    }
  }, [contestId]);

  const fetchContest = async () => {
    try {
      const { data, error } = await supabase
        .from('mega_contests')
        .select('*')
        .eq('contest_code', contestId)
        .single();

      if (error) {
        // Try by ID as fallback
        const { data: contestById } = await supabase
          .from('mega_contests')
          .select('*')
          .eq('id', contestId)
          .single();
        
        if (contestById) {
          setContest(contestById);
          navigate(`/admin/contests/${contestById.contest_code}/questions`, { replace: true });
        } else {
          toast.error('Contest not found');
          navigate('/admin/contests');
        }
      } else {
        setContest(data);
      }
    } catch (error) {
      console.error('Error fetching contest:', error);
      toast.error('Failed to load contest');
    }
  };

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('mega_contest_questions')
        .select('*')
        .eq('contest_id', contest?.id || contestId)
        .order('question_order', { ascending: true });

      if (error) throw error;
      
      setQuestions(data || []);
      
      // Update question order for new question
      if (data && data.length > 0) {
        setNewQuestion(prev => ({
          ...prev,
          question_order: data.length + 1
        }));
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const validateQuestion = () => {
    if (!newQuestion.question_text.trim()) {
      toast.error('Please enter question text');
      return false;
    }
    
    const options = Object.values(newQuestion.options);
    if (options.some(opt => !opt.trim())) {
      toast.error('Please fill all 4 options');
      return false;
    }
    
    if (!newQuestion.correct_answer) {
      toast.error('Please select correct answer');
      return false;
    }
    
    if (!newQuestion.subject) {
      toast.error('Please select subject');
      return false;
    }
    
    return true;
  };

  const addQuestion = async () => {
    if (!validateQuestion()) return;
    if (!contest?.id) {
      toast.error('Contest ID not found');
      return;
    }

    setSaving(true);
    try {
      const questionData = {
        contest_id: contest.id,
        question_text: newQuestion.question_text.trim(),
        question_type: newQuestion.question_type,
        options: newQuestion.options,
        correct_answer: newQuestion.correct_answer,
        marks: newQuestion.marks,
        negative_marks: newQuestion.negative_marks,
        subject: newQuestion.subject,
        difficulty: newQuestion.difficulty,
        question_order: newQuestion.question_order,
        explanation: newQuestion.explanation.trim()
      };

      const { error } = await supabase
        .from('mega_contest_questions')
        .insert([questionData]);

      if (error) throw error;
      
      toast.success(`Question #${newQuestion.question_order} added successfully!`);
      
      // Reset form for next question
      setNewQuestion({
        question_text: '',
        question_type: 'multiple_choice',
        options: { A: '', B: '', C: '', D: '' },
        correct_answer: 'A',
        marks: 4,
        negative_marks: 1,
        subject: contest.subjects?.[0] || 'Science',
        difficulty: 'medium',
        question_order: questions.length + 2,
        explanation: ''
      });
      
      // Refresh questions list
      fetchQuestions();
    } catch (error: any) {
      console.error('Error adding question:', error);
      toast.error(`Failed to add question: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase
        .from('mega_contest_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      
      toast.success('Question deleted successfully');
      fetchQuestions();
    } catch (error: any) {
      console.error('Error deleting question:', error);
      toast.error(`Failed to delete question: ${error.message}`);
    }
  };

  const updateQuestionOrder = useCallback(async (questionId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('mega_contest_questions')
        .update({ question_order: newOrder })
        .eq('id', questionId);

      if (error) throw error;
      
      fetchQuestions();
    } catch (error) {
      console.error('Error updating question order:', error);
      toast.error('Failed to update question order');
    }
  }, []);

  const handleOptionChange = (key: string, value: string) => {
    setNewQuestion(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [key]: value
      }
    }));
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading contest questions...</p>
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3 bg-rose-50 rounded-full">
                <AlertCircle className="h-12 w-12 text-rose-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Contest Not Found</h2>
              <p className="text-gray-600">The requested contest could not be loaded.</p>
            </div>
            <Button 
              onClick={() => navigate('/admin/contests')}
              className="w-full"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Contests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Button
                variant="ghost"
                onClick={() => navigate(`/admin/contests/${contest.contest_code}`)}
                className="mb-2"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Contest
              </Button>
              <h1 className="text-3xl font-bold text-gray-900">
                Manage Questions for {contest.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-gray-600">
                <Badge variant="outline">Class {contest.class}</Badge>
                <Badge variant="outline">
                  {contest.subjects?.join(', ')}
                </Badge>
                <Badge variant="outline">
                  {questions.length} Questions
                </Badge>
                <Badge variant="outline">
                  Contest Code: {contest.contest_code}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Add Question Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-blue-600" />
                  Add New Question
                </h2>
                
                <div className="space-y-6">
                  {/* Question Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Number
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={newQuestion.question_order}
                      onChange={(e) => setNewQuestion({
                        ...newQuestion, 
                        question_order: parseInt(e.target.value) || 1
                      })}
                      className="w-32"
                    />
                  </div>
                  
                  {/* Subject Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <Select
                      value={newQuestion.subject}
                      onValueChange={(value) => setNewQuestion({...newQuestion, subject: value})}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {contest.subjects?.map((subject: string) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                        <SelectItem value="General">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Difficulty */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty Level
                    </label>
                    <Select
                      value={newQuestion.difficulty}
                      onValueChange={(value: 'easy' | 'medium' | 'hard') => 
                        setNewQuestion({...newQuestion, difficulty: value})
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Question Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Text
                    </label>
                    <Textarea
                      value={newQuestion.question_text}
                      onChange={(e) => setNewQuestion({...newQuestion, question_text: e.target.value})}
                      rows={4}
                      placeholder="Enter the question here..."
                      className="resize-none"
                    />
                  </div>
                  
                  {/* Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options (Select correct answer with radio button)
                    </label>
                    <div className="space-y-3">
                      {['A', 'B', 'C', 'D'].map((key) => (
                        <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center font-bold">
                            {key}
                          </div>
                          <Input
                            value={newQuestion.options[key as keyof typeof newQuestion.options]}
                            onChange={(e) => handleOptionChange(key, e.target.value)}
                            placeholder={`Option ${key}`}
                            className="flex-1"
                          />
                          <input
                            type="radio"
                            name="correct_answer"
                            checked={newQuestion.correct_answer === key}
                            onChange={() => setNewQuestion({...newQuestion, correct_answer: key})}
                            className="w-5 h-5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Marks and Negative Marks */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Marks for Correct Answer
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={newQuestion.marks}
                        onChange={(e) => setNewQuestion({
                          ...newQuestion, 
                          marks: parseInt(e.target.value) || 0
                        })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Negative Marks for Wrong Answer
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={newQuestion.negative_marks}
                        onChange={(e) => setNewQuestion({
                          ...newQuestion, 
                          negative_marks: parseInt(e.target.value) || 0
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  {/* Explanation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Explanation (Optional)
                    </label>
                    <Textarea
                      value={newQuestion.explanation}
                      onChange={(e) => setNewQuestion({...newQuestion, explanation: e.target.value})}
                      rows={2}
                      placeholder="Add explanation for the correct answer..."
                    />
                  </div>
                  
                  {/* Submit Button */}
                  <Button 
                    onClick={addQuestion}
                    disabled={saving}
                    className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Adding Question...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-2" />
                        Add Question
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Questions List */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Questions List ({questions.length})
                  </h2>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    Total
                  </Badge>
                </div>
                
                {questions.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No questions added yet</p>
                    <p className="text-gray-400 text-sm mt-1">Start by adding your first question</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {questions.map((q, index) => (
                      <Card key={q.id} className="border border-gray-200 hover:border-blue-300 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-600 hover:bg-blue-700">
                                Q{q.question_order}
                              </Badge>
                              <Badge className={getDifficultyColor(q.difficulty)}>
                                {q.difficulty}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuestionOrder(q.id, q.question_order - 1)}
                                disabled={q.question_order <= 1}
                              >
                                ↑
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuestionOrder(q.id, q.question_order + 1)}
                                disabled={q.question_order >= questions.length}
                              >
                                ↓
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => deleteQuestion(q.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                            {q.question_text}
                          </p>
                          
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {q.subject}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Correct: {q.correct_answer}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-gray-700">
                                {q.marks} marks
                              </span>
                              <div className="text-xs text-gray-500">
                                -{q.negative_marks} for wrong
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Stats Summary */}
            <Card className="mt-6 shadow-sm">
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Question Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Questions</span>
                    <span className="font-semibold text-gray-900">{questions.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Marks</span>
                    <span className="font-semibold text-gray-900">
                      {questions.reduce((sum, q) => sum + (q.marks || 0), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Subjects</span>
                    <div className="flex gap-1">
                      {Array.from(new Set(questions.map(q => q.subject))).slice(0, 3).map(subject => (
                        <Badge key={subject} variant="outline" className="text-xs">
                          {subject}
                        </Badge>
                      ))}
                      {Array.from(new Set(questions.map(q => q.subject))).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{Array.from(new Set(questions.map(q => q.subject))).length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAddQuestions;