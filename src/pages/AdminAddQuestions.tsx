import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Plus } from 'lucide-react';

const AdminAddQuestions = () => {
  const { contestId } = useParams();
  const [contest, setContest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    question_number: 1,
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: 0,
    marks: 4,
    subject: 'Science',
    explanation: ''
  });
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchContest();
    fetchQuestions();
  }, [contestId]);

  const fetchContest = async () => {
    const { data } = await supabase
      .from('mega_contests')
      .select('*')
      .eq('id', contestId)
      .single();
    setContest(data);
  };

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from('mega_contest_questions')
      .select('*')
      .eq('contest_id', contestId)
      .order('question_number');
    setQuestions(data || []);
    setLoading(false);
  };

  const addQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      alert('Please enter question text');
      return;
    }
    if (newQuestion.options.some(opt => !opt.trim())) {
      alert('Please fill all 4 options');
      return;
    }

    const { error } = await supabase
      .from('mega_contest_questions')
      .insert([{ 
        ...newQuestion, 
        contest_id: contestId,
        options: newQuestion.options.map(opt => opt.trim())
      }]);
    
    if (error) {
      alert('Error adding question: ' + error.message);
      return;
    }
    
    setSuccessMessage(`Question #${newQuestion.question_number} added successfully!`);
    setNewQuestion({
      question_number: questions.length + 1,
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      marks: 4,
      subject: 'Science',
      explanation: ''
    });
    
    setTimeout(() => setSuccessMessage(''), 3000);
    fetchQuestions();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Add Questions to {contest?.title}
          </h1>
          <p className="text-gray-600">
            Contest ID: {contestId} • Class: {contest?.class} • Subjects: {contest?.subjects?.join(', ')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Add Question Form */}
          <div className="lg:col-span-2">
            <Card className="mb-6 shadow-lg">
              <CardContent className="p-6">
                {successMessage && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="text-green-800 font-medium">{successMessage}</span>
                  </div>
                )}
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Number
                    </label>
                    <Input
                      type="number"
                      value={newQuestion.question_number}
                      onChange={(e) => setNewQuestion({...newQuestion, question_number: parseInt(e.target.value) || 1})}
                      className="w-32"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <select
                      value={newQuestion.subject}
                      onChange={(e) => setNewQuestion({...newQuestion, subject: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="Science">Science</option>
                      <option value="Maths">Maths</option>
                      <option value="English">English</option>
                      <option value="SST">SST</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                    </select>
                  </div>
                  
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options (Select correct answer with radio button)
                    </label>
                    {[0,1,2,3].map(idx => (
                      <div key={idx} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center font-bold">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <Input
                          value={newQuestion.options[idx]}
                          onChange={(e) => {
                            const newOptions = [...newQuestion.options];
                            newOptions[idx] = e.target.value;
                            setNewQuestion({...newQuestion, options: newOptions});
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          className="flex-1"
                        />
                        <input
                          type="radio"
                          name="correct_answer"
                          checked={newQuestion.correct_answer === idx}
                          onChange={() => setNewQuestion({...newQuestion, correct_answer: idx})}
                          className="w-5 h-5"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Marks
                    </label>
                    <Input
                      type="number"
                      value={newQuestion.marks}
                      onChange={(e) => setNewQuestion({...newQuestion, marks: parseInt(e.target.value) || 4})}
                      className="w-32"
                    />
                  </div>
                  
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
                  
                  <Button 
                    onClick={addQuestion}
                    className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={20} className="mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Questions List */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Added Questions ({questions.length})
                </h2>
                
                {questions.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No questions added yet</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {questions.map((q, idx) => (
                      <Card key={q.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-blue-600">Q{q.question_number}</span>
                            <Badge variant="outline" className="bg-gray-100">
                              {q.subject}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {q.question_text}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-500">
                              Correct: {String.fromCharCode(65 + q.correct_answer)}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              {q.marks} marks
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="mt-6 text-center">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.history.back()}
              >
                Back to Contest
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAddQuestions;