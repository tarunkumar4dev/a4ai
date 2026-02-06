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

  // Chapters for each subject (Increased to 15 to accommodate Maths Ch 14)
  const chapters = Array.from({ length: 15 }, (_, i) => ({
    id: `chapter-${i + 1}`,
    number: i + 1,
    name: `Chapter ${i + 1}`,
    icon: '📖'
  }));

  // --- SCIENCE DATA (Existing) ---
  const chapter1Questions = [
    {
      id: 1,
      question: "Electrolysis of water is a decomposition reaction. The mass ratio (MH : MO) of hydrogen and oxygen gases liberated at the electrodes during electrolysis of water is:",
      options: ["8:1", "2:1", "1:2", "1:8"],
      correctAnswer: "1:8",
      marks: 1
    },
    // ... (Your existing science questions would remain here, truncated for brevity in this snippet but assumed present)
  ];
  const chapter2Questions = [
    // ... (Your existing science questions would remain here)
  ];


  // --- MATHEMATICS DATA (Updated) ---

  // Chapter 8: Introduction to Trigonometry
  const mathsChapter8Questions = [
    // 2025
    { id: 1, question: "If x(2tan30°/(1+tan²30°)) = y(2tan30°/(1-tan²30°)), then x:y =", options: ["1:1", "1:2", "2:1", "4:1"], correctAnswer: "2:1", marks: 1, year: "2025" },
    { id: 2, question: "In a right triangle ABC, right-angled at A, if sin B = 1/4, then the value of sec B is", options: ["4", "√15/4", "√15", "4/√15"], correctAnswer: "4/√15", marks: 1, year: "2025" },
    { id: 3, question: "If x = cos30° – sin30° and y = tan60° – cot60°, then", options: ["x = y", "x > y", "x < y", "x > 1, y < 1"], correctAnswer: "x < y", marks: 1, year: "2025" },
    { id: 4, question: "Which of the following is a trigonometric identity?", options: ["sin²θ = 1 + cos²θ", "cosec²θ + cot²θ = 1", "sec²θ = 1 + tan²θ", "sin2θ = 2sinθ"], correctAnswer: "sec²θ = 1 + tan²θ", marks: 1, year: "2025" },
    // 2024
    { id: 5, question: "If sin θ = cos θ, (0° < θ < 90°), then value of (sec θ · sin θ) is:", options: ["1/√2", "√2", "1", "0"], correctAnswer: "1", marks: 1, year: "2024" },
    { id: 6, question: "If cos θ = √3/2 and sin φ = 1/2, then tan (θ + φ) is:", options: ["√3", "1/√3", "1", "not defined"], correctAnswer: "√3", marks: 1, year: "2024" },
    { id: 7, question: "If 4 sec θ – 5 = 0, then the value of cot θ is:", options: ["3/4", "4/5", "5/3", "4/3"], correctAnswer: "4/3", marks: 1, year: "2024" },
    { id: 8, question: "If x/3 = 2 sin A, y/3 = 2 cos A, then the value of x² + y² is:", options: ["36", "9", "6", "18"], correctAnswer: "36", marks: 1, year: "2024" },
    { id: 9, question: "If 5 tan θ – 12 = 0, then the value of sin θ is:", options: ["5/12", "12/13", "5/13", "12/5"], correctAnswer: "12/13", marks: 1, year: "2024" },
    // 2023
    { id: 10, question: "(1 − tan² 30°)/(1 + tan² 30°) is equal to:", options: ["sin 60°", "cos 60°", "tan 60°", "cos 30°"], correctAnswer: "cos 60°", marks: 1, year: "2023" },
    { id: 11, question: "(2 tan 30°)/(1 + tan² 30°) is equal to:", options: ["sin 60°", "cos 60°", "tan 60°", "sin 30°"], correctAnswer: "sin 60°", marks: 1, year: "2023" },
    { id: 12, question: "cos² θ/sin² θ − 1/sin² θ, in simplified form, is:", options: ["tan² θ", "sec² θ", "1", "–1"], correctAnswer: "–1", marks: 1, year: "2023" },
    { id: 13, question: "If tan θ = 5/12, then the value of (sin θ + cos θ)/(sin θ − cos θ) is:", options: ["−17/7", "17/7", "17/13", "−7/13"], correctAnswer: "−17/7", marks: 1, year: "2023" },
    { id: 14, question: "If sec θ − tan θ = 1/3, then the value of (sec θ + tan θ) is:", options: ["4/3", "2/3", "1/3", "3"], correctAnswer: "3", marks: 1, year: "2023" },
    { id: 15, question: "If tan θ = x/y, then cos θ is equal to", options: ["x/√(x² + y²)", "y/√(x² + y²)", "x/√(x² − y²)", "y/√(x² − y²)"], correctAnswer: "y/√(x² + y²)", marks: 1, year: "2023" },
    { id: 16, question: "If θ is an acute angle of a right angled triangle, then which of the following equation is not true?", options: ["sin θ cot θ = cos θ", "cos θ tan θ = sin θ", "csc² θ − cot² θ = 1", "tan² θ − sec² θ = 1"], correctAnswer: "tan² θ − sec² θ = 1", marks: 1, year: "2023" },
    { id: 17, question: "(cos⁴ A − sin⁴ A) on simplification, gives", options: ["2 sin² A − 1", "2 sin² A + 1", "2 cos² A + 1", "2 cos² A − 1"], correctAnswer: "2 cos² A − 1", marks: 1, year: "2023" },
    { id: 18, question: "Assertion (A): For 0 < θ ≤ 90°, csc θ − cot θ and csc θ + cot θ are reciprocal of each other. Reason (R): csc² θ − cot² θ = 1", options: ["Both Assertion (A) and Reason (R) are true; and Reason (R) is the correct explanation of Assertion (A).", "Both Assertion (A) and Reason (R) are true; but Reason (R) is not the correct explanation of Assertion (A).", "Assertion (A) is true but Reason (R) is false.", "Assertion (A) is false but Reason (R) is true."], correctAnswer: "Both Assertion (A) and Reason (R) are true; and Reason (R) is the correct explanation of Assertion (A).", marks: 1, year: "2023" },
    { id: 19, question: "The hour-hand of a clock is 6 cm long. The angle swept by it between 7:20 a.m. and 7:55 a.m. is:", options: ["(35/4)°", "(35/2)°", "35°", "70°"], correctAnswer: "(35/2)°", marks: 1, year: "2023" },
    { id: 20, question: "sec θ when expressed in terms of cot θ, is equal to:", options: ["√(1 + cot² θ)/cot θ", "√(1 + cot² θ)", "cot θ/√(1 + cot² θ)", "√(1 − cot² θ)/cot θ"], correctAnswer: "√(1 + cot² θ)/cot θ", marks: 1, year: "2023" },
    { id: 21, question: "Which of the following is true for all values of θ (0° ≤ θ ≤ 90°)?", options: ["cos² θ − sin² θ = 1", "csc² θ − sec² θ = 1", "sec² θ − tan² θ = 1", "cot² θ − tan² θ = 1"], correctAnswer: "sec² θ − tan² θ = 1", marks: 1, year: "2023" },
    { id: 22, question: "(sec² θ − 1)(csc² θ − 1) is equal to:", options: ["–1", "1", "0", "2"], correctAnswer: "1", marks: 1, year: "2023" },
    { id: 23, question: "If 2 tan A = 3, then the value of (4 sin A + 3 cos A)/(4 sin A − 3 cos A) is", options: ["7/13", "1/13", "3", "does not exist"], correctAnswer: "3", marks: 1, year: "2023" },
    { id: 24, question: "[3/4 tan² 30° − sec² 45° + sin² 60°] is equal to", options: ["–1", "5/6", "−3/2", "1/6"], correctAnswer: "–1", marks: 1, year: "2023" },
    { id: 25, question: "[5/8 sec² 60° − tan² 60° + cos² 45°] is equal to", options: ["−5/3", "−1/2", "0", "−1/4"], correctAnswer: "0", marks: 1, year: "2023" }
  ];

  // Chapter 9: Applications of Trigonometry
  const mathsChapter9Questions = [
    // 2025
    { id: 1, question: "A peacock sitting on the top of a tree of height 10 m observes a snake moving on the ground. If the snake is 10√3 m away from the base of the tree, then angle of depression of the snake from the eye of the peacock is", options: ["30°", "45°", "60°", "90°"], correctAnswer: "30°", marks: 1, year: "2025" },
    { id: 2, question: "A 30 m long rope is tightly stretched and tied from the top of a pole to the ground. If the rope makes an angle of 60° with the ground, the height of the pole is:", options: ["10√3 m", "30√3 m", "15 m", "15√3 m"], correctAnswer: "15√3 m", marks: 1, year: "2025" },
    // 2024
    { id: 3, question: "From a point on the ground, which is 30 m away from the foot of a vertical tower, the angle of elevation of the top of the tower is found to be 60°. The height (in metres) of the tower is:", options: ["10√3", "30√3", "60", "30"], correctAnswer: "30√3", marks: 1, year: "2024" },
    { id: 4, question: "At some time of the day, the length of the shadow of a tower is equal to its height. Then, the Sun's altitude at that time is:", options: ["30°", "45°", "60°", "90°"], correctAnswer: "45°", marks: 1, year: "2024" },
    { id: 5, question: "The ratio of the length of a pole and its shadow on the ground is 1 : √3. The angle of elevation of the Sun is:", options: ["90°", "60°", "45°", "30°"], correctAnswer: "30°", marks: 1, year: "2024" },
    { id: 6, question: "The length of the shadow of a tower on the plane ground is √3 times the height of the tower. The angle of elevation of the Sun is:", options: ["30°", "45°", "60°", "90°"], correctAnswer: "30°", marks: 1, year: "2024" },
    { id: 7, question: "If a vertical pole of length 7.5 m casts a shadow 5 m long on the ground and at the same time, a tower casts a shadow 24 m long, then the height of the tower is:", options: ["20 m", "40 m", "60 m", "36 m"], correctAnswer: "36 m", marks: 1, year: "2024" },
    // 2023
    { id: 8, question: "If a pole 6 m high casts a shadow 2√3 m long on the ground, then sun's elevation is:", options: ["60°", "45°", "30°", "90°"], correctAnswer: "60°", marks: 1, year: "2023" }
  ];

  // Chapter 10: Circles
  const mathsChapter10Questions = [
    // 2025
    { id: 1, question: "In the adjoining figure, PA and PB are tangents to a circle with centre O such that ∠P = 90°. If AB = 3√2 cm, then the diameter of the circle is", options: ["3√2 cm", "6√2 cm", "3 cm", "6 cm"], correctAnswer: "6 cm", marks: 1, year: "2025" },
    { id: 2, question: "If tangents PA and PB drawn from an external point P to the circle with centre O are inclined to each other at an angle of 80°, then the measure of ∠POA is:", options: ["40°", "50°", "60°", "80°"], correctAnswer: "50°", marks: 1, year: "2025" },
    { id: 3, question: "A parallelogram having one of its sides 5 cm circumscribes a circle. The perimeter of the parallelogram is:", options: ["20 cm", "less than 20 cm", "more than 20 cm but less than 40 cm", "40 cm"], correctAnswer: "20 cm", marks: 1, year: "2025" },
    // 2024
    { id: 4, question: "In the given figure, tangents PA and PB to the circle centred at O, from point P are perpendicular to each other. If PA = 5 cm, then length of AB is equal to:", options: ["5 cm", "5√2 cm", "2√5 cm", "10 cm"], correctAnswer: "5√2 cm", marks: 1, year: "2024" },
    { id: 5, question: "AB and CD are two chords of a circle intersecting at P. Choose the correct statement:", options: ["ΔADP ~ ΔCBA", "ΔADP ~ ΔBPC", "ΔADP ~ ΔBCP", "ΔADP ~ ΔCBP"], correctAnswer: "ΔADP ~ ΔCBP", marks: 1, year: "2024" },
    { id: 6, question: "In the given figure, AT is tangent to a circle centred at O. If ∠CAT = 40°, then ∠CBA is equal to:", options: ["70°", "50°", "65°", "40°"], correctAnswer: "40°", marks: 1, year: "2024" },
    { id: 7, question: "Maximum number of common tangents that can be drawn to two circles intersecting at two distinct points is:", options: ["4", "3", "2", "1"], correctAnswer: "2", marks: 1, year: "2024" },
    { id: 8, question: "In the given figure, if PT is a tangent to a circle with centre O and ∠TPO = 35°, then the measure of ∠x is:", options: ["110°", "115°", "120°", "125°"], correctAnswer: "110°", marks: 1, year: "2024" },
    // 2023
    { id: 9, question: "The length of tangent drawn to a circle of radius 9 cm from a point 41 cm from the centre is:", options: ["40 cm", "9 cm", "41 cm", "50 cm"], correctAnswer: "40 cm", marks: 1, year: "2023" },
    { id: 10, question: "Assertion (A): A tangent to a circle is perpendicular to the radius through the point of contact. Reason (R): The lengths of tangents drawn from an external point to a circle are equal.", options: ["Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A).", "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).", "Assertion (A) is true but Reason (R) is false.", "Assertion (A) is false but Reason (R) is true."], correctAnswer: "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).", marks: 1, year: "2023" },
    { id: 11, question: "Assertion (A): If from an external point P of a circle with centre O, two tangents PA and PB are drawn, then quadrilateral AOBP will be cyclic. Reason (R): The angle between two tangents drawn from an external point to a circle is supplementary to the angle subtended by the line segment joining the points of contact at the centre.", options: ["Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).", "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).", "Assertion (A) is true but Reason (R) is false.", "Assertion (A) is false but Reason (R) is true."], correctAnswer: "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).", marks: 1, year: "2023" }
  ];

  // Chapter 11: Areas Related to Circles
  const mathsChapter11Questions = [
    // 2025
    { id: 1, question: "If the area of a sector of a circle of radius 36 cm is 54π cm², then the length of the corresponding arc of the sector is:", options: ["8π cm", "6π cm", "4π cm", "3π cm"], correctAnswer: "6π cm", marks: 1, year: "2025" },
    // 2024
    { id: 2, question: "Perimeter of a sector of a circle whose central angle is 90° and radius 7 cm is:", options: ["35 cm", "11 cm", "22 cm", "25 cm"], correctAnswer: "25 cm", marks: 1, year: "2024" },
    { id: 3, question: "If the area of a sector of a circle is 7/20 of the area of the circle, then the angle at the centre is equal to:", options: ["110°", "130°", "100°", "126°"], correctAnswer: "126°", marks: 1, year: "2024" },
    { id: 4, question: "The perimeter of the sector of a circle of radius 21 cm which subtends an angle of 60° at the centre of circle, is:", options: ["22 cm", "43 cm", "64 cm", "462 cm"], correctAnswer: "64 cm", marks: 1, year: "2024" },
    { id: 5, question: "The area of the square inscribed in a circle of radius 5√2 cm is:", options: ["50 cm²", "100 cm²", "25 cm²", "200 cm²"], correctAnswer: "100 cm²", marks: 1, year: "2024" },
    { id: 6, question: "If an arc subtends an angle of 90° at the centre of a circle, then the ratio of its length to the circumference of the circle is:", options: ["2:3", "1:4", "4:1", "1:3"], correctAnswer: "1:4", marks: 1, year: "2024" },
    // 2023
    { id: 7, question: "What is the length of the arc of the sector of a circle with radius 14 cm and of central angle 90°?", options: ["22 cm", "44 cm", "88 cm", "11 cm"], correctAnswer: "22 cm", marks: 1, year: "2023" },
    { id: 8, question: "What is the area of a semi-circle of diameter 'd'?", options: ["(1/16)πd²", "(1/4)πd²", "(1/8)πd²", "(1/2)πd²"], correctAnswer: "(1/8)πd²", marks: 1, year: "2023" }
  ];

  // Chapter 12: Surface Areas and Volumes
  const mathsChapter12Questions = [
    // 2025
    { id: 1, question: "If a cone of greatest possible volume is hollowed out from a solid wooden cylinder, then the ratio of the volume of remaining wood to the volume of cone hollowed out is", options: ["1:1", "1:3", "2:1", "3:1"], correctAnswer: "2:1", marks: 1, year: "2025" },
    { id: 2, question: "On the top face of a wooden cube of side 7 cm, hemispherical depressions of radius 0.35 cm are to be formed by taking out the wood. The maximum number of depressions that can be formed is:", options: ["400", "100", "20", "10"], correctAnswer: "100", marks: 1, year: "2025" },
    // 2024
    { id: 3, question: "The volume of the largest right circular cone that can be carved out from a solid cube of edge 2 cm is:", options: ["(4π)/3 cm³", "(5π)/3 cm³", "(8π)/3 cm³", "(2π)/3 cm³"], correctAnswer: "(2π)/3 cm³", marks: 1, year: "2024" },
    { id: 4, question: "A solid sphere is cut into two hemispheres. The ratio of the surface areas of sphere to that of two hemispheres taken together, is:", options: ["1:1", "1:4", "2:3", "3:2"], correctAnswer: "2:3", marks: 1, year: "2024" },
    { id: 5, question: "The ratio of total surface area of a solid hemisphere to the square of its radius is:", options: ["2π : 1", "4π : 1", "3π : 1", "1 : 4π"], correctAnswer: "3π : 1", marks: 1, year: "2024" },
    { id: 6, question: "Two identical solid cubes of side 'a' are joined end-to-end. The total surface area of the resulting cuboid is:", options: ["6a²", "10a²", "5a²", "4a²"], correctAnswer: "10a²", marks: 1, year: "2024" },
    { id: 7, question: "Assertion (A): Two cubes each of edge length 10 cm are joined together. The total surface area of newly formed cuboid is 1200 cm². Reason (R): Area of each surface of a cube of side 10 cm is 100 cm².", options: ["Both A and R are true and R is the correct explanation of A.", "Both A and R are true but R is not the correct explanation of A.", "A is true but R is false.", "A is false but R is true."], correctAnswer: "A is false but R is true.", marks: 1, year: "2024" },
    // 2023
    { id: 8, question: "Water in a river which is 3 m deep and 40 m wide is flowing at the rate of 2 km/h. How much water will fall into the sea in 2 minutes?", options: ["800 m³", "4000 m³", "8000 m³", "2000 m³"], correctAnswer: "8000 m³", marks: 1, year: "2023" },
    { id: 9, question: "The volume of a right circular cone whose area of the base is 156 cm² and the vertical height is 8 cm, is", options: ["2496 cm³", "1248 cm³", "1664 cm³", "416 cm³"], correctAnswer: "416 cm³", marks: 1, year: "2023" },
    { id: 10, question: "If the area of the base of a cone is 51 cm² and its volume is 85 cm³, then the vertical height of the cone is given as:", options: ["5/6 cm", "5/3 cm", "5/2 cm", "5 cm"], correctAnswer: "5 cm", marks: 1, year: "2023" },
    { id: 11, question: "Curved surface area of a cylinder of height 5 cm is 94.2 cm². Radius of the cylinder is (Take π = 3.14)", options: ["2 cm", "3 cm", "2.9 cm", "6 cm"], correctAnswer: "3 cm", marks: 1, year: "2023" },
    { id: 12, question: "The curved surface area of a cone having height 24 cm and radius 7 cm, is", options: ["528 cm²", "1056 cm²", "550 cm²", "500 cm²"], correctAnswer: "550 cm²", marks: 1, year: "2023" },
    { id: 13, question: "The area of metal sheet required to make a closed hollow cylinder of height 2.4 m and base radius 0.7 m, is", options: ["10.56 m²", "13.52 m²", "13.64 m²", "14.08 m²"], correctAnswer: "13.64 m²", marks: 1, year: "2023" },
    { id: 14, question: "What is the total surface area of a solid hemisphere of diameter 'd'?", options: ["3πd²", "2πd²", "1/2 πd²", "3/4 πd²"], correctAnswer: "3/4 πd²", marks: 1, year: "2023" }
  ];

  // Chapter 13: Statistics
  const mathsChapter13Questions = [
    // 2025
    { id: 1, question: "If the mode of some observations is 10 and sum of mean and median is 25, then the mean and median respectively are", options: ["12 and 13", "13 and 12", "10 and 15", "15 and 10"], correctAnswer: "13 and 12", marks: 1, year: "2025" },
    { id: 2, question: "If the maximum number of students has obtained 52 marks out of 80, then", options: ["52 is the mean of the data.", "52 is the median of the data.", "52 is the mode of the data.", "52 is the range of the data."], correctAnswer: "52 is the mode of the data.", marks: 1, year: "2025" },
    { id: 3, question: "Mode and Mean of a data are 15x and 18x, respectively. Then the median of the data is:", options: ["x", "11x", "17x", "34x"], correctAnswer: "17x", marks: 1, year: "2025" },
    // 2024
    { id: 4, question: "After an examination, a teacher wants to know the marks obtained by maximum number of the students in her class. She requires to calculate of marks:", options: ["median", "mode", "mean", "range"], correctAnswer: "mode", marks: 1, year: "2024" },
    { id: 5, question: "If value of each observation in a data is increased by 2, then median of the new data:", options: ["increases by 2", "increases by 2n", "remains same", "decreases by 2"], correctAnswer: "increases by 2", marks: 1, year: "2024" },
    { id: 6, question: "The mean of five observations is 15. If the mean of first three observations is 14 and that of the last three observations is 17, then the third observation is:", options: ["20", "19", "18", "17"], correctAnswer: "18", marks: 1, year: "2024" },
    { id: 7, question: "If the mean of five observations x, x+2, x+4, x+6, x+8 is 11, then the value of x is:", options: ["4", "7", "11", "6"], correctAnswer: "7", marks: 1, year: "2024" },
    { id: 8, question: "If the difference of mode and median of a data is 24, then the difference of its median and mean is:", options: ["12", "24", "8", "36"], correctAnswer: "12", marks: 1, year: "2024" },
    // 2023
    { id: 9, question: "If the mean and the median of a data are 12 and 15 respectively, then its mode is:", options: ["13.5", "21", "6", "14"], correctAnswer: "21", marks: 1, year: "2023" },
    { id: 10, question: "If the mean and the mode of a distribution are 15 and 18 respectively, then the median of the distribution is:", options: ["17", "15", "16", "18"], correctAnswer: "16", marks: 1, year: "2023" },
    { id: 11, question: "If every term of the statistical data consisting of n terms is decreased by 2, then the mean of the data:", options: ["decreases by 2", "remains unchanged", "decreases by 2n", "decreases by 1"], correctAnswer: "decreases by 2", marks: 1, year: "2023" },
    { id: 12, question: "The empirical relation between the mode, median and mean of a distribution is:", options: ["Mode = 3 Median – 2 Mean", "Mode = 3 Mean – 2 Median", "Mode = 2 Median – 3 Mean", "Mode = 2 Mean – 3 Median"], correctAnswer: "Mode = 3 Median – 2 Mean", marks: 1, year: "2023" },
    { id: 13, question: "For the following distribution (Class: 0-5...20-25; Freq: 10...9), sum of lower limits of median class and modal class is:", options: ["15", "25", "30", "35"], correctAnswer: "25", marks: 1, year: "2023" },
    { id: 14, question: "For the following distribution (Marks Below: 10...60; Students: 3...80), the modal class is:", options: ["10-20", "20-30", "30-40", "50-60"], correctAnswer: "30-40", marks: 1, year: "2023" },
    { id: 15, question: "If the value of each observation of a statistical data is increased by 3, then the mean of the data", options: ["remains unchanged", "increases by 3", "increases by 6", "increases by 3n"], correctAnswer: "increases by 3", marks: 1, year: "2023" }
  ];

  // Chapter 14: Probability
  const mathsChapter14Questions = [
    // 2025
    { id: 1, question: "Two coins are tossed simultaneously. The probability of getting at least one head is", options: ["1/4", "1/2", "3/4", "1"], correctAnswer: "3/4", marks: 1, year: "2025" },
    { id: 2, question: "Assertion (A): In an experiment of throwing a die, Event E1 (<3) and E2 (>3) are complementary. Reason (R): If E and F are complementary, P(E) + P(F) = 1.", options: ["Both A and R are true and R is correct explanation of A.", "Both A and R are true, but R is not correct explanation of A.", "A is true, but R is false.", "A is false, but R is true."], correctAnswer: "A is false, but R is true.", marks: 1, year: "2025" },
    { id: 3, question: "A die is thrown once. The probability of getting a number which is not a factor of 36 is:", options: ["1/2", "2/3", "1/6", "5/6"], correctAnswer: "1/2", marks: 1, year: "2025" },
    { id: 4, question: "A card is selected at random from a deck of 52 playing cards. The probability of it being a red face card is:", options: ["3/13", "2/13", "1/2", "3/26"], correctAnswer: "3/26", marks: 1, year: "2025" },
    // 2024
    { id: 5, question: "A box contains cards numbered 6 to 55. A card is drawn at random. The probability that the card has a perfect square number is:", options: ["7/50", "7/55", "1/10", "5/49"], correctAnswer: "1/10", marks: 1, year: "2024" },
    { id: 6, question: "Two dice are rolled together. The probability of getting the sum of the two numbers to be more than 10, is:", options: ["1/9", "1/6", "7/12", "1/12"], correctAnswer: "1/12", marks: 1, year: "2024" },
    { id: 7, question: "Two dice are thrown together. The probability that they show different numbers is:", options: ["1/6", "5/6", "1/3", "2/3"], correctAnswer: "5/6", marks: 1, year: "2024" },
    { id: 8, question: "The probability of guessing correct is x/6. If probability of not guessing correct is 2/3, then x is:", options: ["2", "3", "4", "6"], correctAnswer: "2", marks: 1, year: "2024" },
    { id: 9, question: "If a digit is chosen at random from 1-9, the probability that this digit is an odd prime number is:", options: ["1/3", "2/3", "4/9", "5/9"], correctAnswer: "1/3", marks: 1, year: "2024" },
    // 2023
    { id: 10, question: "Two dice are rolled together. What is the probability of getting a sum greater than 10?", options: ["1/9", "1/6", "1/12", "5/18"], correctAnswer: "1/12", marks: 1, year: "2023" },
    { id: 11, question: "In a lottery with 5 prizes and 20 blanks, the probability of getting a prize is:", options: ["1/4", "1/20", "1/25", "1/5"], correctAnswer: "1/5", marks: 1, year: "2023" },
    { id: 12, question: "If three coins are tossed simultaneously, what is the probability of getting at most one tail?", options: ["3/8", "4/8", "5/8", "7/8"], correctAnswer: "4/8", marks: 1, year: "2023" },
    { id: 13, question: "Two dice are thrown together. The probability of getting the difference of numbers on their upper faces equals to 3 is:", options: ["1/9", "2/9", "1/6", "1/12"], correctAnswer: "1/6", marks: 1, year: "2023" },
    { id: 14, question: "A card is drawn from 52 cards. The probability that the card drawn is not an ace is:", options: ["1/13", "9/13", "4/13", "12/13"], correctAnswer: "12/13", marks: 1, year: "2023" },
    { id: 15, question: "A bag contains 5 red balls and n green balls. If P(green) = 3 * P(red), then n is:", options: ["18", "15", "10", "20"], correctAnswer: "15", marks: 1, year: "2023" },
    { id: 16, question: "Two coins are tossed together. The probability of getting at least one tail is:", options: ["1/2", "1/2", "3/4", "1"], correctAnswer: "3/4", marks: 1, year: "2023" },
    { id: 17, question: "Relation between p (happening) and q (non-happening) is", options: ["p + q = 1", "p = 1, q = 1", "p = q – 1", "p + q + 1 = 0"], correctAnswer: "p + q = 1", marks: 1, year: "2023" },
    { id: 18, question: "A girl calculates probability of winning first prize is 0.08. If 6000 tickets are sold, how many did she buy?", options: ["40", "240", "480", "750"], correctAnswer: "480", marks: 1, year: "2023" },
    { id: 19, question: "In a group of 20 people, 5 can't swim. Probability that a selected person can swim is", options: ["3/4", "1/3", "1", "1/4"], correctAnswer: "3/4", marks: 1, year: "2023" },
    { id: 20, question: "In a survey, every fifth person has a vehicle. Probability of NOT having a vehicle is", options: ["1/5", "5%", "4/5", "95%"], correctAnswer: "4/5", marks: 1, year: "2023" },
    { id: 21, question: "Bag has cards 1-100. Probability that a drawn card is a perfect cube is?", options: ["1/20", "3/50", "1/25", "7/100"], correctAnswer: "1/25", marks: 1, year: "2023" },
    { id: 22, question: "In a single throw of two dice, probability of getting 12 as a product is", options: ["1/9", "2/9", "4/9", "5/9"], correctAnswer: "1/9", marks: 1, year: "2023" },
    { id: 23, question: "Assertion (A): Probability that a leap year has 53 Sundays is 2/7. Reason (R): Probability that a non-leap year has 53 Sundays is 5/7.", options: ["Both A and R are true and R is correct explanation of A.", "Both A and R are true, but R is not correct explanation of A.", "A is true, but R is false.", "A is false, but R is true."], correctAnswer: "A is true, but R is false.", marks: 1, year: "2023" }
  ];

  // All questions organized by class, subject, and chapter
  const allQuestions = {
    '10': {
      'science': {
        'chapter-1': chapter1Questions,
        'chapter-2': chapter2Questions
      },
      'maths': {
        'chapter-8': mathsChapter8Questions,
        'chapter-9': mathsChapter9Questions,
        'chapter-10': mathsChapter10Questions,
        'chapter-11': mathsChapter11Questions,
        'chapter-12': mathsChapter12Questions,
        'chapter-13': mathsChapter13Questions,
        'chapter-14': mathsChapter14Questions
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
      // For daily practice, send only 5 random questions
      const shuffledQuestions = [...questions].sort(() => 0.5 - Math.random());
      const dailyQuestions = shuffledQuestions.slice(0, 5);
      
      navigate('/daily-practice/session', { 
        state: { 
          classId: selectedClass,
          subject: selectedSubject,
          chapter: chapterId,
          questions: dailyQuestions,
          totalQuestions: questions.length // Send total count for reference
        }
      });
    } else {
      // For chapters without questions, navigate to session page
      navigate(`/daily-practice/session?class=${selectedClass}&subject=${selectedSubject}&chapter=${chapterId}`);
    }
  };

  // Function to get chapter name
  const getChapterName = (chapterNumber: number, subject: string) => {
    if (subject === 'science') {
      switch(chapterNumber) {
        case 1: return "Chemical Reactions";
        case 2: return "Acids, Bases & Salts";
        default: return `Chapter ${chapterNumber}`;
      }
    } else if (subject === 'maths') {
      switch(chapterNumber) {
        case 8: return "Introduction to Trigonometry";
        case 9: return "Applications of Trigonometry";
        case 10: return "Circles";
        case 11: return "Areas Related to Circles";
        case 12: return "Surface Areas and Volumes";
        case 13: return "Statistics";
        case 14: return "Probability";
        default: return `Chapter ${chapterNumber}`;
      }
    }
    return `Chapter ${chapterNumber}`;
  };

  // Function to get chapter question count
  const getChapterQuestionCount = (chapterNumber: number, subject: string) => {
    if (subject === 'science') {
      switch(chapterNumber) {
        case 1: return "10 Qs";
        case 2: return "37 Qs";
        default: return "";
      }
    } else if (subject === 'maths') {
      switch(chapterNumber) {
        case 8: return "25 Qs";
        case 9: return "8 Qs";
        case 10: return "11 Qs";
        case 11: return "8 Qs";
        case 12: return "14 Qs";
        case 13: return "15 Qs";
        case 14: return "23 Qs";
        default: return "";
      }
    }
    return "";
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
                const chapterKey = `chapter-${chapter.number}`;
                const hasQuestions = allQuestions[selectedClass]?.[selectedSubject]?.[chapterKey];
                const questionCount = getChapterQuestionCount(chapter.number, selectedSubject);
                
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
                          : 'border-slate-100 hover:border-slate-200 opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => hasQuestions && handleChapterSelect(chapter.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl mb-2">{chapter.icon}</div>
                        <h3 className="font-semibold text-slate-900">
                          {getChapterName(chapter.number, selectedSubject)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {hasQuestions ? "5 Questions Daily" : "Coming Soon"}
                        </p>
                        {hasQuestions && questionCount && (
                          <div className="mt-2">
                            <Badge className={
                              selectedSubject === 'science' 
                                ? "bg-green-100 text-green-800 hover:bg-green-100 text-xs"
                                : "bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs"
                            }>
                              {questionCount}
                            </Badge>
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

        {/* Questions Count Summary */}
        {selectedClass === '10' && selectedSubject && (
          <Card className="rounded-2xl border-slate-200 shadow-sm mb-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen size={16} className="text-indigo-500" />
                Available Questions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedSubject === 'science' && (
                  <>
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <h4 className="font-bold text-blue-900 mb-2">Chapter 1: Chemical Reactions</h4>
                      <p className="text-blue-700 text-sm">10 questions available</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl">
                      <h4 className="font-bold text-green-900 mb-2">Chapter 2: Acids, Bases & Salts</h4>
                      <p className="text-green-700 text-sm">37 questions available</p>
                    </div>
                  </>
                )}
                {selectedSubject === 'maths' && (
                  <>
                    <div className="p-4 bg-purple-50 rounded-xl">
                      <h4 className="font-bold text-purple-900 mb-2">Trigonometry & Apps</h4>
                      <p className="text-purple-700 text-sm">33 questions available</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl">
                      <h4 className="font-bold text-indigo-900 mb-2">Circles & Areas</h4>
                      <p className="text-indigo-700 text-sm">19 questions available</p>
                    </div>
                    <div className="p-4 bg-pink-50 rounded-xl">
                      <h4 className="font-bold text-pink-900 mb-2">Stats & Prob</h4>
                      <p className="text-pink-700 text-sm">38 questions available</p>
                    </div>
                  </>
                )}
                <div className="p-4 bg-yellow-50 rounded-xl">
                  <h4 className="font-bold text-yellow-900 mb-2">Daily Practice</h4>
                  <p className="text-yellow-700 text-sm">5 random questions daily</p>
                  <p className="text-yellow-600 text-xs mt-1">New questions each day</p>
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
                  description: "Select chapter 1-15",
                  icon: "📖"
                },
                {
                  step: 3,
                  title: "Solve Questions",
                  description: "Answer 5 random questions",
                  icon: "📝"
                },
                {
                  step: 4,
                  title: "Earn Rewards",
                  description: "Get 5 coins for each correct answer",
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
              Your practice progress is saved automatically. Complete all 5 questions daily to maintain your streak and earn bonus coins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeSelectionPage;
