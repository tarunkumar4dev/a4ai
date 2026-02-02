// src/pages/practice/index.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Award, 
  Clock, 
  Flame, 
  BookOpen, 
  Zap, 
  Trophy, 
  Star, 
  ChevronRight,
  Sparkles,
  Users,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase, practiceDB } from '@/lib/supabaseClient';

const PracticeSelectionPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState({
    streak: 0,
    totalCoins: 0,
    todayAttempted: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Available classes
  const classes = [
    { id: '10', name: 'Class 10', icon: '🔬' },
    { id: '12', name: 'Class 12', icon: '📚' }
  ];

  // Subjects for each class
  const subjects = {
    '10': [
      { id: 'science', name: 'Science', icon: '🧪' },
      { id: 'maths', name: 'Mathematics', icon: '📐' }
    ],
    '12': [
      { id: 'science', name: 'Science', icon: '⚛️' },
      { id: 'maths', name: 'Mathematics', icon: '📊' }
    ]
  };

  // Chapters for each subject (1-10)
  const chapters = Array.from({ length: 10 }, (_, i) => ({
    id: `chapter-${i + 1}`,
    number: i + 1,
    name: `Chapter ${i + 1}`,
    icon: '📖'
  }));

  // Questions data for Class 10 Science Chapter 1
  const chapter1Questions = [
    {
      id: 1,
      question: "Electrolysis of water is a decomposition reaction. The mass ratio (MH : MO) of hydrogen and oxygen gases liberated at the electrodes during electrolysis of water is:",
      options: ["8:1", "2:1", "1:2", "1:8"],
      correctAnswer: "1:8",
      marks: 1
    },
    {
      id: 2,
      question: "Consider the following reactions: (i) Dilute hydrochloric acid reacts with sodium hydroxide (ii) Magnesium oxide reacts with dilute hydrochloric acid (iii) Carbon dioxide reacts with sodium hydroxide. It is found that in each case:",
      options: [
        "Salt and water is formed",
        "Neutral salts are formed",
        "Hydrogen gas is formed",
        "Acidic salts are formed"
      ],
      correctAnswer: "Salt and water is formed",
      marks: 1
    },
    {
      id: 3,
      question: "In which one of the following situations a chemical reaction does not occur?",
      options: [
        "Milk is left open at room temperature during the summer",
        "Grapes get fermented",
        "An iron nail is left exposed to humid atmosphere",
        "Melting of glaciers"
      ],
      correctAnswer: "Melting of glaciers",
      marks: 1
    },
    {
      id: 4,
      question: "The correct balanced chemical equation showing exothermic reaction in which natural gas burns in air is:",
      options: [
        "CH4+O2→CO2+2H2O",
        "CH4+2O2→2CO2+2H2O+Energy",
        "CH4+2O2→CO2+2H2O",
        "CH4+2O2→CO2+2H2O+Energy"
      ],
      correctAnswer: "CH4+2O2→CO2+2H2O+Energy",
      marks: 1
    },
    {
      id: 5,
      question: "Consider the following chemical equation: pAl + qH₂O → rAl₂O₃ + sH₂. To balance this equation, the values of 'p', 'q', 'r', and 's' are:",
      options: [
        "3, 2, 2, 1",
        "2, 3, 3, 1",
        "2, 3, 1, 3",
        "3, 1, 2, 2"
      ],
      correctAnswer: "2, 3, 1, 3",
      marks: 1
    },
    {
      id: 6,
      question: "The main observations while burning magnesium ribbon in air are: (i) Magnesium ribbon burns with a dazzling white flame (ii) A white powder is formed (iii) Magnesium ribbon vaporises (iv) Aqueous solution of the white powder turns blue litmus red",
      options: [
        "(i) and (iv)",
        "(ii) and (iii)",
        "(i) and (ii)",
        "(iii) and (iv)"
      ],
      correctAnswer: "(i) and (ii)",
      marks: 1
    },
    {
      id: 7,
      question: "The values of a, b, c and d in the following balanced chemical equation are respectively: aPb(NO₃)₂ → bPbO + cNO₂ + dO₂",
      options: [
        "1, 1, 2, 1",
        "1, 1, 1, 2",
        "2, 2, 1, 4",
        "2, 2, 4, 1"
      ],
      correctAnswer: "2, 2, 4, 1",
      marks: 1
    },
    {
      id: 8,
      question: "Examples of thermal decomposition reactions are: (i) 2AgCl → 2Ag + Cl₂ (ii) CaCO₃ → CaO + CO₂ (iii) 2H₂O → 2H₂ + O₂ (iv) 2KClO₃ → 2KCl + 3O₂",
      options: [
        "(i) and (ii)",
        "(ii) and (iii)",
        "(iii) and (iv)",
        "(ii) and (iv)"
      ],
      correctAnswer: "(ii) and (iv)",
      marks: 1
    },
    {
      id: 9,
      question: "Assertion (A): Decomposition reactions are generally endothermic reactions. Reason (R): Decomposition of organic matter into compost is an exothermic process.",
      options: [
        "Both A and R are true, and R is the correct explanation of A",
        "Both A and R are true, but R is not the correct explanation of A",
        "A is true, but R is false",
        "A is false, but R is true"
      ],
      correctAnswer: "Both A and R are true, but R is not the correct explanation of A",
      marks: 1
    },
    {
      id: 10,
      question: "Assertion (A): Silver chloride turns grey in sunlight. Reason (R): It decomposes into silver and chlorine in sunlight.",
      options: [
        "Both A and R are true and R is the correct explanation of A",
        "Both A and R are true, but R is not the correct explanation of A",
        "A is true, but R is false",
        "A is false, but R is true"
      ],
      correctAnswer: "Both A and R are true and R is the correct explanation of A",
      marks: 1
    }
  ];

  // Questions data for Class 10 Science Chapter 2 (Acids, Bases & Salts)
  const chapter2Questions = [
    // PYQ 2025
    {
      id: 1,
      question: "In one formula unit of salt 'X', seven molecules of water of crystallisation are present. The salt 'X' is:",
      options: ["CuSO₄", "Na₂CO₃", "FeSO₄", "CaSO₄"],
      correctAnswer: "FeSO₄",
      marks: 1,
      year: "2025"
    },
    {
      id: 2,
      question: "Consider the following reactions: (i) Dilute hydrochloric acid reacts with sodium hydroxide (ii) Magnesium oxide reacts with dilute hydrochloric acid (iii) Carbon dioxide reacts with sodium hydroxide. It is found that in each case:",
      options: [
        "Salt and water is formed",
        "Neutral salts are formed",
        "Hydrogen gas is formed",
        "Acidic salts are formed"
      ],
      correctAnswer: "Salt and water is formed",
      marks: 1,
      year: "2025"
    },
    {
      id: 3,
      question: "Tooth enamel is made up of calcium hydroxyapatite (a crystalline form of calcium phosphate). This chemical starts corroding in the mouth when the pH is:",
      options: ["7", "5", "10", "14"],
      correctAnswer: "5",
      marks: 1,
      year: "2025"
    },
    {
      id: 4,
      question: "The warning sign shown in the given figure must invariably be displayed/pasted on the containers which contain hydroxide of:",
      options: ["Aluminium", "Calcium", "Sodium", "Magnesium"],
      correctAnswer: "Sodium",
      marks: 1,
      year: "2025"
    },
    {
      id: 5,
      question: "The body of human beings works within the pH range of:",
      options: ["6.1 to 6.8", "6.5 to 7.3", "7.0 to 7.8", "7.5 to 8.1"],
      correctAnswer: "7.0 to 7.8",
      marks: 1,
      year: "2025"
    },
    {
      id: 6,
      question: "A few pieces of granulated zinc are taken in a test tube and 2 mL of sodium hydroxide solution is added to it. When the contents are warmed, the product formed is:",
      options: ["Na₂ZnO", "Na₂ZnO₂", "Na₂Zn(OH)₂", "NaZn(OH)₂"],
      correctAnswer: "Na₂ZnO₂",
      marks: 1,
      year: "2025"
    },
    {
      id: 7,
      question: "Which of the given option represents a family of salts?",
      options: [
        "NaCl, Na₂SO₄, CaSO₄",
        "K₂SO₄, Na₂SO₄, CaSO₄",
        "NaNO₃, CaCO₃, Na₂CO₃",
        "MgSO₄, CuSO₄, MgCl₂"
      ],
      correctAnswer: "K₂SO₄, Na₂SO₄, CaSO₄",
      marks: 1,
      year: "2025"
    },
    {
      id: 8,
      question: "A common feature observed in the crystals of washing soda, copper sulphate, gypsum and ferrous sulphate is that all:",
      options: [
        "exhibit basic nature",
        "exhibit acidic nature",
        "have a fixed number of water molecules of crystallisation",
        "are coloured"
      ],
      correctAnswer: "have a fixed number of water molecules of crystallisation",
      marks: 1,
      year: "2025"
    },
    {
      id: 9,
      question: "The chlorine produced during the electrolysis of brine solution is used in the manufacture of:",
      options: ["Ammonia", "Disinfectants", "Plaster of Paris", "Soap and detergents"],
      correctAnswer: "Disinfectants",
      marks: 1,
      year: "2025"
    },
    {
      id: 10,
      question: "When a mixture of baking soda and tartaric acid is heated (or mixed in water) a product 'X' is formed, which is responsible for making breads and cakes soft and spongy. The product 'X' is:",
      options: ["Carbon dioxide", "Carbon monoxide", "Sodium tartrate", "Hydrogen"],
      correctAnswer: "Carbon dioxide",
      marks: 1,
      year: "2025"
    },
    {
      id: 11,
      question: "You have three aqueous solutions A, B and C as given below: (a) Potassium nitrate (b) Ammonium chloride (c) Sodium carbonate. Choose the correct increasing order of pH is:",
      options: ["A<B<C", "B<C<A", "C<A<B", "B<A<C"],
      correctAnswer: "B<A<C",
      marks: 1,
      year: "2025"
    },
    {
      id: 12,
      question: "The formula of washing soda is:",
      options: [
        "NaHCO₃·6H₂O",
        "Na₂CO₃·6H₂O",
        "NaHCO₃·10H₂O",
        "Na₂CO₃·10H₂O"
      ],
      correctAnswer: "Na₂CO₃·10H₂O",
      marks: 1,
      year: "2025"
    },
    {
      id: 13,
      question: "Juice of tamarind turns blue litmus to red. It is because of the presence of a chemical compound called:",
      options: ["Acetic acid", "Methanoic acid", "Oxalic acid", "Tartaric acid"],
      correctAnswer: "Tartaric acid",
      marks: 1,
      year: "2025"
    },
    {
      id: 14,
      question: "The nature of aqueous solution of potassium nitrate is:",
      options: ["Acidic", "Basic", "Neutral", "Alkaline"],
      correctAnswer: "Neutral",
      marks: 1,
      year: "2025"
    },
    {
      id: 15,
      question: "The water of crystallization is present in: (i) Bleaching Powder (ii) Plaster of Paris (iii) Washing Soda (iv) Baking Soda",
      options: [
        "(ii) and (iv)",
        "(ii) and (iii)",
        "(i) and (iii)",
        "(i) and (iv)"
      ],
      correctAnswer: "(ii) and (iii)",
      marks: 1,
      year: "2025"
    },
    // PYQ 2024
    {
      id: 16,
      question: "Select a pair of natural indicators from the following:",
      options: [
        "Litmus and methyl orange",
        "Turmeric and Litmus",
        "Phenolphthalein and methyl orange",
        "Methyl orange and Turmeric"
      ],
      correctAnswer: "Turmeric and Litmus",
      marks: 1,
      year: "2024"
    },
    {
      id: 17,
      question: "A chemical compound used in glass, soap and paper industries is:",
      options: [
        "Washing Soda",
        "Baking Soda",
        "Bleaching Powder",
        "Common Salt"
      ],
      correctAnswer: "Washing Soda",
      marks: 1,
      year: "2024"
    },
    {
      id: 18,
      question: "An aqueous solution of a salt turns blue litmus to red. The salt could be the one obtained by the reaction of:",
      options: [
        "HNO₃ and NaOH",
        "H₂SO₄ and KOH",
        "CH₃COOH and NaOH",
        "HCl and NH₄OH"
      ],
      correctAnswer: "HCl and NH₄OH",
      marks: 1,
      year: "2024"
    },
    {
      id: 19,
      question: "Consider the following compounds: FeSO₄, CuSO₄, CaSO₄, Na₂CO₃. The compound having the maximum number of water of crystallization in its crystalline form in one molecule is:",
      options: ["FeSO₄", "CuSO₄", "CaSO₄", "Na₂CO₃"],
      correctAnswer: "Na₂CO₃",
      marks: 1,
      year: "2024"
    },
    {
      id: 20,
      question: "The salt present in tooth enamel is:",
      options: [
        "Calcium phosphate",
        "Magnesium phosphate",
        "Sodium phosphate",
        "Aluminium phosphate"
      ],
      correctAnswer: "Calcium phosphate",
      marks: 1,
      year: "2024"
    },
    {
      id: 21,
      question: "An aqueous solution of sodium chloride is prepared in distilled water. The pH of this solution is:",
      options: ["6", "8", "7", "3"],
      correctAnswer: "7",
      marks: 1,
      year: "2024"
    },
    {
      id: 22,
      question: "Solid Calcium oxide reacts vigorously with water to form Calcium hydroxide accompanied by the liberation of heat. From the information given above it may be concluded that this reaction:",
      options: [
        "is endothermic and pH of the solution formed is more than 7.",
        "is exothermic and pH of the solution formed is 7.",
        "is endothermic and pH of the solution formed is 7.",
        "is exothermic and pH of the solution formed is more than 7."
      ],
      correctAnswer: "is exothermic and pH of the solution formed is more than 7.",
      marks: 1,
      year: "2024"
    },
    {
      id: 23,
      question: "Juice of tamarind turns blue litmus to red. It is because of the presence of an acid called:",
      options: ["Methanoic acid", "Acetic acid", "Tartaric acid", "Oxalic acid"],
      correctAnswer: "Tartaric acid",
      marks: 1,
      year: "2024"
    },
    {
      id: 24,
      question: "The oxide which can react with HCl as well as KOH to give corresponding salt and water is:",
      options: ["CuO", "Al₂O₃", "Na₂O", "K₂O"],
      correctAnswer: "Al₂O₃",
      marks: 1,
      year: "2024"
    },
    // PYQ 2023
    {
      id: 25,
      question: "When sodium bicarbonate reacts with dilute hydrochloric acid, the gas evolved is:",
      options: [
        "Hydrogen; it gives pop sound with burning match stick.",
        "Hydrogen; it turns lime water milky.",
        "Carbon dioxide; it turns lime water milky.",
        "Carbon dioxide; it blows off a burning match stick with a pop sound."
      ],
      correctAnswer: "Carbon dioxide; it turns lime water milky.",
      marks: 1,
      year: "2023"
    },
    {
      id: 26,
      question: "Select a pair of olfactory indicators from the following:",
      options: [
        "Clove oil and vanilla essence",
        "Onion and turmeric",
        "Clove oil and litmus paper",
        "Vanilla and methyl orange"
      ],
      correctAnswer: "Clove oil and vanilla essence",
      marks: 1,
      year: "2023"
    },
    {
      id: 27,
      question: "Sodium hydroxide is termed as alkali while ferric hydroxide is not because:",
      options: [
        "Sodium hydroxide is a strong base, while ferric hydroxide is a weak base.",
        "Sodium hydroxide is a base which is soluble in water while ferric hydroxide is also a base but it is not soluble in water.",
        "Sodium hydroxide is a strong base while ferric hydroxide is a strong acid.",
        "Sodium hydroxide and ferric hydroxide both are strong base but the solubility of sodium hydroxide in water is comparatively higher than that of ferric hydroxide."
      ],
      correctAnswer: "Sodium hydroxide is a base which is soluble in water while ferric hydroxide is also a base but it is not soluble in water.",
      marks: 1,
      year: "2023"
    },
    {
      id: 28,
      question: "Hydronium ions are formed by the reaction between:",
      options: [
        "Sodium hydroxide and water",
        "Calcium chloride and water",
        "Hydrogen chloride gas and water",
        "Ethanol and water"
      ],
      correctAnswer: "Hydrogen chloride gas and water",
      marks: 1,
      year: "2023"
    },
    {
      id: 29,
      question: "Fresh milk has a pH of 6. To delay its curdling, a chemical substance is added to it, which is:",
      options: [
        "Sodium carbonate",
        "Baking powder",
        "Sodium hydroxide (caustic soda)",
        "Baking soda (sodium hydrogen carbonate)"
      ],
      correctAnswer: "Baking soda (sodium hydrogen carbonate)",
      marks: 1,
      year: "2023"
    },
    {
      id: 30,
      question: "The name of the salt used to remove permanent hardness of water is:",
      options: [
        "Sodium hydrogen carbonate (NaHCO₃)",
        "Sodium chloride (NaCl)",
        "Sodium carbonate decahydrate (Na₂CO₃·10H₂O)",
        "Calcium sulphate hemihydrate (CaSO₄·½H₂O)"
      ],
      correctAnswer: "Sodium carbonate decahydrate (Na₂CO₃·10H₂O)",
      marks: 1,
      year: "2023"
    },
    {
      id: 31,
      question: "Select washing soda from the following:",
      options: [
        "NaHCO₃",
        "Na₂CO₃·5H₂O",
        "Na₂CO₃·10H₂O",
        "NaOH"
      ],
      correctAnswer: "Na₂CO₃·10H₂O",
      marks: 1,
      year: "2023"
    },
    // PYQ 2022
    {
      id: 32,
      question: "Which of the options in the given table are correct? Option Natural Source Acid Present (i) Orange Oxalic acid (ii) Sour milk Lactic acid (iii) Ant sting Methanoic acid (iv) Tamarind Acetic acid",
      options: [
        "(i) and (ii)",
        "(i) and (iv)",
        "(ii) and (iii)",
        "(iii) and (iv)"
      ],
      correctAnswer: "(ii) and (iii)",
      marks: 1,
      year: "2022"
    },
    {
      id: 33,
      question: "Three test tubes A, B and C contain distilled water, an acidic solution and a basic solution respectively. When red litmus solution is used for testing these solutions, the observed colour changes respectively will be:",
      options: [
        "A - no change; B - becomes dark red; C - becomes blue",
        "A - becomes light red; B - becomes blue; C - becomes red",
        "A - becomes red; B - no change; C - becomes blue",
        "A - becomes light red; B - becomes dark red; C - becomes blue"
      ],
      correctAnswer: "A - no change; B - becomes dark red; C - becomes blue",
      marks: 1,
      year: "2022"
    },
    {
      id: 34,
      question: "Concentrated H₂SO₄ is diluted by adding drop by drop:",
      options: [
        "Water to acid with constant stirring",
        "Acid to water with constant stirring",
        "Water to acid followed by a base",
        "Base to acid followed by cold water"
      ],
      correctAnswer: "Acid to water with constant stirring",
      marks: 1,
      year: "2022"
    },
    {
      id: 35,
      question: "Select from the following the statement which is true for bases:",
      options: [
        "Bases are bitter and turn blue litmus red.",
        "Bases have a pH less than 7.",
        "Bases are sour and change red litmus to blue.",
        "Bases turn pink when a drop of phenolphthalein is added to them."
      ],
      correctAnswer: "Bases turn pink when a drop of phenolphthalein is added to them.",
      marks: 1,
      year: "2022"
    },
    {
      id: 36,
      question: "A solution gives yellowish orange colour when a few drops of universal indicator are added to it. This solution is of:",
      options: [
        "Lemon juice",
        "Sodium chloride",
        "Sodium hydroxide",
        "Milk of magnesia"
      ],
      correctAnswer: "Lemon juice",
      marks: 1,
      year: "2022"
    },
    {
      id: 37,
      question: "Anita added a drop each of diluted acetic acid and diluted hydrochloric acid on pH paper and compared the colours. Which of the following is the correct conclusion?",
      options: [
        "pH of acetic acid is more than that of hydrochloric acid",
        "pH of acetic acid is less than that of hydrochloric acid.",
        "Acetic acid dissociates completely in aqueous solution",
        "Acetic acid Is a strong acid."
      ],
      correctAnswer: "pH of acetic acid is more than that of hydrochloric acid",
      marks: 1,
      year: "2022"
    }
  ];

  // All questions organized by chapter
  const allQuestions = {
    '10': {
      'science': {
        'chapter-1': chapter1Questions,
        'chapter-2': chapter2Questions
        // Add more chapters here as needed
      }
    }
  };

  // Get user info and stats
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      if (user?.id) {
        // Get user profile and stats
        const profile = await practiceDB.getUserPracticeProfile(user.id);
        const todayStats = await practiceDB.getUserPracticeStats(user.id);
        
        setUserStats({
          streak: profile?.practice_streak || 0,
          totalCoins: profile?.total_coins || 0,
          todayAttempted: todayStats.attempted
        });
      }
      
      setLoading(false);
    };
    
    initialize();
  }, []);

  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId);
    setSelectedSubject(null);
  };

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubject(subjectId);
  };

  const handleChapterSelect = (chapterId: string) => {
    if (!userId) {
      navigate('/login?redirect=/daily-practice');
      return;
    }

    // Check if user has already attempted 5 questions today
    if (userStats.todayAttempted >= 5) {
      alert('🎉 You have already completed your daily practice! Come back tomorrow for new questions.');
      return;
    }

    // Get questions for the selected chapter
    const classKey = selectedClass as keyof typeof allQuestions;
    const subjectKey = selectedSubject as keyof typeof allQuestions[typeof classKey];
    const chapterKey = chapterId as keyof typeof allQuestions[typeof classKey][typeof subjectKey];
    
    const questions = allQuestions[classKey]?.[subjectKey]?.[chapterKey];
    
    if (questions) {
      // Navigate to practice session with questions
      navigate('/daily-practice/session', { 
        state: { 
          classId: selectedClass,
          subject: selectedSubject,
          chapter: chapterId,
          questions: questions.slice(0, 5) // Send first 5 questions for practice
        }
      });
    } else {
      // For chapters without questions, navigate to session page
      navigate(`/daily-practice/session?class=${selectedClass}&subject=${selectedSubject}&chapter=${chapterId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[64px] sm:h-[72px] flex items-center justify-between gap-2">
            {/* Left: Back Button */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </button>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Daily <span className="text-indigo-600">Practice</span>
                </h1>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-3">
              {userStats.streak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                  <Flame size={14} className="text-orange-500 fill-orange-500" />
                  <span className="font-bold text-orange-700 text-sm">
                    {userStats.streak} day streak
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-100">
                <Award size={14} className="text-yellow-600" />
                <span className="font-bold text-yellow-700 text-sm">
                  {userStats.totalCoins}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                <Trophy size={14} className="text-blue-600" />
                <span className="font-bold text-blue-700 text-sm">
                  {userStats.todayAttempted}/5
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Daily Practice Challenge
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Solve 5 questions daily. Earn <span className="font-bold text-yellow-600">+5 coins</span> for each correct answer.
          </p>
        </div>

        {/* Class Selection */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" /> 
            Select Your Class
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {classes.map((cls, index) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  className={`rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedClass === cls.id 
                      ? 'border-blue-500 shadow-lg' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => handleClassSelect(cls.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{cls.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900">{cls.name}</h3>
                        <p className="text-slate-600 text-sm">
                          {cls.id === '10' ? 'Science & Mathematics' : 'Advanced Science & Mathematics'}
                        </p>
                      </div>
                      {selectedClass === cls.id && (
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Subject Selection (if class is selected) */}
        {selectedClass && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-500" /> 
              Select Subject
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subjects[selectedClass as keyof typeof subjects]?.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={`rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedSubject === subject.id 
                        ? 'border-green-500 shadow-lg' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handleSubjectSelect(subject.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{subject.icon}</div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-900">{subject.name}</h3>
                          <p className="text-slate-600 text-sm">
                            {selectedClass === '10' 
                              ? 'Class 10th curriculum' 
                              : 'Class 12th advanced curriculum'}
                          </p>
                        </div>
                        {selectedSubject === subject.id && (
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Chapter Selection (if subject is selected) */}
        {selectedClass && selectedSubject && (
          <div className="mb-12">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-500" /> 
              Select Chapter
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {chapters.map((chapter, index) => {
                // Check if this chapter has questions available
                const hasQuestions = allQuestions[selectedClass]?.[selectedSubject]?.[`chapter-${chapter.number}`];
                
                return (
                  <motion.div
                    key={chapter.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Card 
                      className={`rounded-xl border cursor-pointer transition-all ${
                        hasQuestions 
                          ? 'border-slate-200 hover:border-indigo-300 hover:shadow-md' 
                          : 'border-slate-100 hover:border-slate-200 opacity-50'
                      }`}
                      onClick={() => hasQuestions && handleChapterSelect(chapter.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl mb-2">{chapter.icon}</div>
                        <h3 className="font-semibold text-slate-900">{chapter.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {hasQuestions ? "5 Questions" : "Coming Soon"}
                        </p>
                        {hasQuestions && (
                          <div className="mt-2">
                            {selectedClass === '10' && selectedSubject === 'science' && chapter.number === 1 && (
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                                Chemical Reactions
                              </Badge>
                            )}
                            {selectedClass === '10' && selectedSubject === 'science' && chapter.number === 2 && (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                                Acids, Bases & Salts
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Questions Count */}
        {selectedClass === '10' && selectedSubject === 'science' && (
          <Card className="rounded-2xl border-slate-200 shadow-sm mb-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen size={16} className="text-indigo-500" />
                Available Questions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-bold text-blue-900 mb-2">Chapter 1: Chemical Reactions</h4>
                  <p className="text-blue-700 text-sm">10 questions available</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <h4 className="font-bold text-green-900 mb-2">Chapter 2: Acids, Bases & Salts</h4>
                  <p className="text-green-700 text-sm">37 PYQ questions (2022-2025)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card className="rounded-2xl border-slate-200 shadow-sm mb-8">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
              How Daily Practice Works
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  step: 1,
                  title: "Choose Class & Subject",
                  description: "Select your class and subject",
                  icon: "🎯"
                },
                {
                  step: 2,
                  title: "Pick Chapter",
                  description: "Select chapter 1-10",
                  icon: "📖"
                },
                {
                  step: 3,
                  title: "Solve Questions",
                  description: "Answer 5 questions with timer",
                  icon: "📝"
                },
                {
                  step: 4,
                  title: "Earn Rewards",
                  description: "Get coins for correct answers",
                  icon: "🪙"
                }
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div className="text-xs font-bold text-indigo-600 mb-2">STEP {item.step}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Safety Note */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900">Fair Practice Environment</h4>
            <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
              Your practice progress is saved automatically. Complete all 5 questions to earn bonus coins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeSelectionPage;