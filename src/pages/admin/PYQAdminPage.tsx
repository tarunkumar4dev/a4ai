// src/pages/admin/PYQAdminPage.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  PlusCircle, 
  Trash2, 
  Edit, 
  Download, 
  FileText,
  BookOpen,
  Filter,
  Search,
  Save,
  Copy,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock database using localStorage
const MOCK_DATABASE_KEY = 'pyq_questions_mock_db';

export default function PYQAdminPage() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    class_level: '10',
    subject: '',
    chapter: '',
    sub_topic: '',
    question_type: 'PYQ',
    year: '',
    board: 'CBSE',
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: '',
    difficulty_level: 'Medium',
    marks: '1'
  });

  // Load questions from localStorage on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(MOCK_DATABASE_KEY);
      if (stored) {
        setQuestions(JSON.parse(stored));
      } else {
        // Load initial mock questions
        const initialQuestions = getInitialMockQuestions();
        setQuestions(initialQuestions);
        localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(initialQuestions));
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load questions',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const getInitialMockQuestions = () => {
    return [
      {
        id: '1',
        class_level: 10,
        subject: 'Mathematics',
        chapter: 'Real Numbers',
        question_type: 'PYQ',
        year: 2023,
        board: 'CBSE',
        question_text: 'Prove that √2 is an irrational number.',
        options: JSON.stringify([
          'Assume √2 is rational, then it can be expressed as a/b where a, b are co-prime',
          '√2 is irrational because it cannot be expressed as a fraction',
          'All square roots of prime numbers are irrational',
          '√2 is approximately 1.414'
        ]),
        correct_answer: 'Assume √2 is rational, then it can be expressed as a/b where a, b are co-prime',
        explanation: 'Assume √2 = a/b where a and b are co-prime integers. Squaring both sides gives 2 = a²/b² ⇒ a² = 2b². This means a² is divisible by 2, so a is divisible by 2. Let a = 2c. Then 4c² = 2b² ⇒ b² = 2c², so b is also divisible by 2. This contradicts that a and b are co-prime. Therefore, √2 is irrational.',
        difficulty_level: 'Medium',
        marks: 3,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        class_level: 10,
        subject: 'Science',
        chapter: 'Chemical Reactions',
        question_type: 'PYQ',
        year: 2023,
        board: 'CBSE',
        question_text: 'Why is respiration considered an exothermic reaction?',
        options: JSON.stringify([
          'It releases energy in the form of heat',
          'It absorbs energy from surroundings',
          'It produces light',
          'It occurs only at high temperatures'
        ]),
        correct_answer: 'It releases energy in the form of heat',
        explanation: 'Respiration is exothermic because glucose reacts with oxygen to produce carbon dioxide, water, and releases energy which is used by cells.',
        difficulty_level: 'Easy',
        marks: 2,
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        class_level: 12,
        subject: 'Physics',
        chapter: 'Electrostatics',
        question_type: 'HOTS',
        year: 2023,
        board: 'CBSE',
        question_text: 'Two point charges 4Q and Q are separated by distance r. Where should a third charge be placed for equilibrium?',
        options: JSON.stringify([
          'At distance r/3 from Q',
          'At distance r/3 from 4Q',
          'At distance r/2 from Q',
          'At the midpoint'
        ]),
        correct_answer: 'At distance r/3 from 4Q',
        explanation: 'Let the third charge q be placed at distance x from 4Q. For equilibrium: k(4Q)q/x² = kQq/(r-x)² ⇒ 4/x² = 1/(r-x)² ⇒ 2/x = 1/(r-x) ⇒ 2r - 2x = x ⇒ x = 2r/3 from Q or r/3 from 4Q.',
        difficulty_level: 'Hard',
        marks: 5,
        created_at: new Date().toISOString()
      }
    ];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const questionData = {
        id: editingId || Date.now().toString(),
        class_level: parseInt(formData.class_level),
        subject: formData.subject.trim(),
        chapter: formData.chapter.trim(),
        sub_topic: formData.sub_topic.trim() || null,
        question_type: formData.question_type,
        year: formData.year ? parseInt(formData.year) : null,
        board: formData.board.trim() || 'CBSE',
        question_text: formData.question_text.trim(),
        options: formData.options.filter(opt => opt.trim()).length > 0 
          ? JSON.stringify(formData.options.filter(opt => opt.trim()))
          : null,
        correct_answer: formData.correct_answer.trim(),
        explanation: formData.explanation.trim() || null,
        difficulty_level: formData.difficulty_level,
        marks: parseInt(formData.marks),
        created_at: new Date().toISOString()
      };

      const updatedQuestions = editingId 
        ? questions.map(q => q.id === editingId ? questionData : q)
        : [...questions, questionData];
      
      setQuestions(updatedQuestions);
      localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(updatedQuestions));

      toast({
        title: 'Success',
        description: editingId ? 'Question updated successfully!' : 'Question added successfully!',
      });

      // Reset form
      resetForm();
      loadQuestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save question',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      class_level: '10',
      subject: '',
      chapter: '',
      sub_topic: '',
      question_type: 'PYQ',
      year: '',
      board: 'CBSE',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: '',
      explanation: '',
      difficulty_level: 'Medium',
      marks: '1'
    });
    setEditingId(null);
  };

  const handleEdit = (question: any) => {
    setEditingId(question.id);
    setFormData({
      id: question.id,
      class_level: question.class_level.toString(),
      subject: question.subject,
      chapter: question.chapter,
      sub_topic: question.sub_topic || '',
      question_type: question.question_type,
      year: question.year?.toString() || '',
      board: question.board || 'CBSE',
      question_text: question.question_text,
      options: question.options ? JSON.parse(question.options) : ['', '', '', ''],
      correct_answer: question.correct_answer,
      explanation: question.explanation || '',
      difficulty_level: question.difficulty_level,
      marks: question.marks.toString()
    });
    
    // Scroll to form
    document.getElementById('add-question-tab')?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (question: any) => {
    const duplicatedQuestion = {
      ...question,
      id: Date.now().toString(),
      question_text: `Copy: ${question.question_text}`
    };
    
    const updatedQuestions = [...questions, duplicatedQuestion];
    setQuestions(updatedQuestions);
    localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(updatedQuestions));
    
    toast({
      title: 'Success',
      description: 'Question duplicated successfully!',
    });
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        const questionsToInsert = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const question: any = {};
          
          headers.forEach((header, index) => {
            if (values[index]) {
              question[header] = values[index];
            }
          });

          // Add required fields if missing
          question.id = (Date.now() + i).toString();
          question.created_at = new Date().toISOString();
          
          // Convert types
          if (question.class_level) question.class_level = parseInt(question.class_level);
          if (question.year) question.year = parseInt(question.year);
          if (question.marks) question.marks = parseInt(question.marks);
          if (question.options && typeof question.options === 'string') {
            question.options = JSON.stringify(question.options.split(';'));
          }

          questionsToInsert.push(question);
        }

        const updatedQuestions = [...questions, ...questionsToInsert];
        setQuestions(updatedQuestions);
        localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(updatedQuestions));

        toast({
          title: 'Success',
          description: `${questionsToInsert.length} questions uploaded successfully!`,
        });

        // Clear file input
        event.target.value = '';
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Invalid CSV format. Please check the template.',
          variant: 'destructive',
        });
      }
    };

    reader.readAsText(file);
  };

  const deleteQuestion = (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    const updatedQuestions = questions.filter(q => q.id !== id);
    setQuestions(updatedQuestions);
    localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(updatedQuestions));
    
    toast({
      title: 'Success',
      description: 'Question deleted successfully!',
    });
  };

  const exportToCSV = () => {
    const headers = [
      'class_level', 'subject', 'chapter', 'question_type', 'year', 'board',
      'question_text', 'options', 'correct_answer', 'explanation', 'difficulty_level', 'marks'
    ];
    
    const csvContent = [
      headers.join(','),
      ...questions.map(q => [
        q.class_level,
        q.subject,
        q.chapter,
        q.question_type,
        q.year || '',
        q.board || '',
        `"${q.question_text.replace(/"/g, '""')}"`,
        q.options ? JSON.parse(q.options).join(';') : '',
        q.correct_answer,
        q.explanation ? `"${q.explanation.replace(/"/g, '""')}"` : '',
        q.difficulty_level,
        q.marks
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pyq-questions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Questions exported to CSV successfully!',
    });
  };

  const filteredQuestions = questions.filter(q =>
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.chapter.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.question_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subjects = [...new Set(questions.map(q => q.subject))];
  const chapters = [...new Set(questions.map(q => q.chapter))];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📚 PYQ Question Bank</h1>
            <p className="text-gray-600 mt-1">Manage Previous Year Questions for Class 10 & 12</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              disabled={questions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={loadQuestions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="add" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="add" id="add-question-tab">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Question
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </TabsTrigger>
            <TabsTrigger value="manage">
              <FileText className="h-4 w-4 mr-2" />
              Manage ({questions.length})
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="h-4 w-4 mr-2" />
              Statistics
            </TabsTrigger>
          </TabsList>

          {/* Add Single Question */}
          <TabsContent value="add">
            <Card className="border-2 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  {editingId ? <Edit className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
                  {editingId ? 'Edit Question' : 'Add New Question'}
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Fill in the details below to add a new PYQ or edit existing one
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Basic Info */}
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Basic Information
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Class Level *</Label>
                            <Select
                              value={formData.class_level}
                              onValueChange={(value) => setFormData({...formData, class_level: value})}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">Class 10</SelectItem>
                                <SelectItem value="12">Class 12</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Difficulty *</Label>
                            <Select
                              value={formData.difficulty_level}
                              onValueChange={(value) => setFormData({...formData, difficulty_level: value})}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Easy">Easy</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Label>Subject *</Label>
                          <Input
                            value={formData.subject}
                            onChange={(e) => setFormData({...formData, subject: e.target.value})}
                            required
                            placeholder="e.g., Mathematics, Physics, Chemistry"
                            className="bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <Label>Chapter *</Label>
                            <Input
                              value={formData.chapter}
                              onChange={(e) => setFormData({...formData, chapter: e.target.value})}
                              required
                              placeholder="e.g., Real Numbers, Electrostatics"
                              className="bg-white"
                            />
                          </div>
                          <div>
                            <Label>Sub Topic</Label>
                            <Input
                              value={formData.sub_topic}
                              onChange={(e) => setFormData({...formData, sub_topic: e.target.value})}
                              placeholder="Optional"
                              className="bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Question Type & Details */}
                      <div className="bg-green-50 p-3 rounded-lg">
                        <h3 className="font-semibold text-green-800 mb-2">Question Details</h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Question Type *</Label>
                            <Select
                              value={formData.question_type}
                              onValueChange={(value) => setFormData({...formData, question_type: value})}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PYQ">PYQ (Previous Year)</SelectItem>
                                <SelectItem value="HOTS">HOTS (Higher Order)</SelectItem>
                                <SelectItem value="MOST_REPEATED">Most Repeated</SelectItem>
                                <SelectItem value="MOST_POPULAR">Most Popular</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Board</Label>
                            <Select
                              value={formData.board}
                              onValueChange={(value) => setFormData({...formData, board: value})}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CBSE">CBSE</SelectItem>
                                <SelectItem value="ICSE">ICSE</SelectItem>
                                <SelectItem value="State Board">State Board</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <Label>Year (PYQs)</Label>
                            <Input
                              type="number"
                              value={formData.year}
                              onChange={(e) => setFormData({...formData, year: e.target.value})}
                              placeholder="e.g., 2023"
                              className="bg-white"
                              min="2010"
                              max="2025"
                            />
                          </div>
                          <div>
                            <Label>Marks *</Label>
                            <Input
                              type="number"
                              value={formData.marks}
                              onChange={(e) => setFormData({...formData, marks: e.target.value})}
                              required
                              min="1"
                              max="10"
                              className="bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Question & Options */}
                    <div className="space-y-4">
                      <div>
                        <Label>Question Text *</Label>
                        <Textarea
                          value={formData.question_text}
                          onChange={(e) => setFormData({...formData, question_text: e.target.value})}
                          required
                          placeholder="Enter the question here... You can include mathematical expressions in LaTeX format: $$\\sqrt{2}$$"
                          className="min-h-[150px] bg-white text-lg"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          For math formulas, use LaTeX: $E = mc^2$ for inline or $$\\frac{1}{2}$$ for block
                        </p>
                      </div>

                      {/* Options Section */}
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <Label className="font-semibold text-yellow-800">Multiple Choice Options</Label>
                        <p className="text-sm text-gray-600 mb-3">Leave empty for subjective questions</p>
                        
                        <div className="space-y-3">
                          {formData.options.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded font-bold">
                                {String.fromCharCode(65 + index)}
                              </div>
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...formData.options];
                                  newOptions[index] = e.target.value;
                                  setFormData({...formData, options: newOptions});
                                }}
                                placeholder={`Option ${index + 1}`}
                                className="bg-white"
                              />
                              {index >= 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newOptions = formData.options.filter((_, i) => i !== index);
                                    setFormData({...formData, options: newOptions});
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          
                          {formData.options.length < 6 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFormData({...formData, options: [...formData.options, '']});
                              }}
                              className="mt-2"
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Another Option
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Correct Answer & Explanation */}
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-purple-800 mb-3">Answer & Explanation</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <Label>Correct Answer *</Label>
                            <Textarea
                              value={formData.correct_answer}
                              onChange={(e) => setFormData({...formData, correct_answer: e.target.value})}
                              required
                              placeholder="Enter the correct answer"
                              className="min-h-[80px] bg-white"
                            />
                          </div>

                          <div>
                            <Label>Detailed Explanation</Label>
                            <Textarea
                              value={formData.explanation}
                              onChange={(e) => setFormData({...formData, explanation: e.target.value})}
                              placeholder="Step-by-step explanation of the answer..."
                              className="min-h-[120px] bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                      <Save className="h-4 w-4 mr-2" />
                      {editingId ? 'Update Question' : 'Save Question'}
                    </Button>
                    {editingId && (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Upload */}
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Upload via CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <Upload className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Upload CSV File</h3>
                  <p className="text-gray-600 mb-4">Upload a CSV file containing multiple questions</p>
                  
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <Button asChild>
                      <span className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                        <Upload className="h-4 w-4 mr-2" />
                        Choose CSV File
                      </span>
                    </Button>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleCSVUpload}
                    />
                  </Label>
                  <p className="text-sm text-gray-500 mt-3">
                    Maximum file size: 10MB • Supports .csv format only
                  </p>
                </div>

                {/* CSV Template */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">CSV Format Template</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm">
{`class_level,subject,chapter,question_type,year,board,question_text,options,correct_answer,explanation,difficulty_level,marks
10,Mathematics,Trigonometry,PYQ,2023,CBSE,"What is sin(90°)?","1;0;0.5;√2/2",1,"sin(90°) = 1",Easy,1
12,Physics,Electrostatics,HOTS,,CBSE,"Explain Coulomb's law in detail.",,"F = k*q1*q2/r^2","Coulomb's law states...",Hard,5
10,Science,Chemical Reactions,MOST_REPEATED,2022,CBSE,"Why is respiration exothermic?","Releases heat;Absorbs heat;No energy change;Produces light","Releases heat","Respiration releases energy...",Medium,2`}
                      </pre>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="p-2 bg-blue-50 rounded">
                        <span className="font-semibold">Tips:</span>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">Use quotes for text with commas</div>
                      <div className="p-2 bg-blue-50 rounded">Separate options with semicolons</div>
                      <div className="p-2 bg-blue-50 rounded">Year is optional for non-PYQs</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
                    <div className="text-3xl font-bold text-blue-600">{questions.length}</div>
                    <div className="text-sm text-gray-600">Current Questions</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {questions.filter(q => q.question_type === 'PYQ').length}
                    </div>
                    <div className="text-sm text-gray-600">PYQ Questions</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {[...new Set(questions.map(q => q.subject))].length}
                    </div>
                    <div className="text-sm text-gray-600">Subjects</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Questions */}
          <TabsContent value="manage">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle>Manage Questions</CardTitle>
                    <p className="text-sm text-gray-600">
                      View, edit, or delete questions from the database
                    </p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by question, subject, chapter..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>
                    <Select value="all" onValueChange={() => {}}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="PYQ">PYQ Only</SelectItem>
                        <SelectItem value="HOTS">HOTS Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading questions...</p>
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No questions found</h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm ? 'Try a different search term' : 'Start by adding your first question!'}
                    </p>
                    {searchTerm && (
                      <Button variant="outline" onClick={() => setSearchTerm('')}>
                        Clear Search
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredQuestions.map((question) => (
                      <div key={question.id} className="border rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                Class {question.class_level}
                              </Badge>
                              <Badge className={
                                question.question_type === 'PYQ' ? 'bg-green-100 text-green-800 border-green-300' :
                                question.question_type === 'HOTS' ? 'bg-red-100 text-red-800 border-red-300' :
                                'bg-purple-100 text-purple-800 border-purple-300'
                              }>
                                {question.question_type}
                              </Badge>
                              <Badge variant="outline" className={
                                question.difficulty_level === 'Easy' ? 'text-green-700' :
                                question.difficulty_level === 'Medium' ? 'text-yellow-700' :
                                'text-red-700'
                              }>
                                {question.difficulty_level}
                              </Badge>
                              {question.year && (
                                <Badge variant="secondary">
                                  {question.year}
                                </Badge>
                              )}
                            </div>
                            
                            <h4 className="font-semibold text-lg mb-1 text-gray-800">
                              {question.subject} • {question.chapter}
                              {question.sub_topic && ` • ${question.sub_topic}`}
                            </h4>
                            
                            <p className="text-gray-700 mb-2 line-clamp-2">
                              {question.question_text}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {question.board || 'CBSE'}
                              </span>
                              <span>Marks: {question.marks}</span>
                              <span>Added: {new Date(question.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(question)}
                              className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicate(question)}
                              className="border-green-300 text-green-700 hover:bg-green-50"
                            >
                              <Copy className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">Duplicate</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteQuestion(question.id)}
                              className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Database Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard 
                    title="Total Questions" 
                    value={questions.length} 
                    color="blue"
                    icon={<FileText className="h-5 w-5" />}
                  />
                  <StatCard 
                    title="Class 10" 
                    value={questions.filter(q => q.class_level === 10).length} 
                    color="green"
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                  <StatCard 
                    title="Class 12" 
                    value={questions.filter(q => q.class_level === 12).length} 
                    color="purple"
                    icon={<GraduationCap className="h-5 w-5" />}
                  />
                  <StatCard 
                    title="PYQ Count" 
                    value={questions.filter(q => q.question_type === 'PYQ').length} 
                    color="orange"
                    icon={<Award className="h-5 w-5" />}
                  />
                </div>

                {/* Question Type Distribution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Question Type Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {['PYQ', 'HOTS', 'MOST_REPEATED', 'MOST_POPULAR'].map(type => {
                          const count = questions.filter(q => q.question_type === type).length;
                          const percentage = questions.length ? Math.round((count / questions.length) * 100) : 0;
                          return (
                            <div key={type} className="space-y-1">
                              <div className="flex justify-between">
                                <span className="font-medium">{type}</span>
                                <span>{count} ({percentage}%)</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Difficulty Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {['Easy', 'Medium', 'Hard'].map(difficulty => {
                          const count = questions.filter(q => q.difficulty_level === difficulty).length;
                          const percentage = questions.length ? Math.round((count / questions.length) * 100) : 0;
                          return (
                            <div key={difficulty} className="space-y-1">
                              <div className="flex justify-between">
                                <span className="font-medium">{difficulty}</span>
                                <span>{count} ({percentage}%)</span>
                              </div>
                              <Progress 
                                value={percentage} 
                                className={`h-2 ${
                                  difficulty === 'Easy' ? 'bg-green-100' :
                                  difficulty === 'Medium' ? 'bg-yellow-100' :
                                  'bg-red-100'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper component for stat cards
function StatCard({ title, value, color, icon }: any) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]} flex flex-col items-center`}>
      <div className="mb-2">{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm font-medium">{title}</div>
    </div>
  );
}

// Import missing icons
import { RefreshCw, BarChart3, GraduationCap } from 'lucide-react';