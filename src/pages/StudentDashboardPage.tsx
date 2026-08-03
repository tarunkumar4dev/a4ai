// src/pages/StudentDashboardPage.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  lazy,
  Suspense,
  useRef,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTheme } from "@/context/ThemeContext";

const ScratchCard = lazy(() => import("@/components/ScratchCard"));

import {
  Bell,
  Search,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Rocket,
  BarChart3,
  Flame,
  BookOpen,
  Award,
  TrendingUp,
  User,
  Moon,
  Sun,
  Globe,
  X,
  Target,
  Send,
  Loader2
} from "lucide-react";

/* ------------------- UTILS ------------------- */

const safeStorage = {
  get(key: string) {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    } catch { return null; }
  },
  set(key: string, value: string) {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    } catch { /* no-op */ }
  },
};

/* ------------------- TRANSLATIONS ------------------- */
const translations = {
  en: {
    dashboard: "Dashboard",
    notes: "Notes",
    inbox: "Inbox",
    students: "Students",
    settings: "Settings",
    getPremium: "Get Premium",
    unlockFeatures: "Unlock all features",
    upgradePlan: "Upgrade Plan",
    logOut: "Log out",
    welcome: "Welcome back",
    courseProgress: "Your average course progress is",
    levelUp: "Level up your learning to improve your student rank!",
    takeQuiz: "Take quiz",
    learningActivity: "Learning Activity",
    totalTime: "Total Time",
    courses: "Courses",
    rank: "Rank",
    quickActions: "Quick Actions",
    joinContests: "Join Contests",
    leaderboard: "Leaderboard",
    practice: "Practice",
    upcomingAssignments: "Upcoming Assignments",
    allTests: "All tests",
    testName: "Test name",
    deadline: "Deadline",
    status: "Status",
    profile: "Profile",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    language: "Language (Hindi)",
    extraTools: "Extra Tools",
    studyNotes: "Study Notes",
    performance: "Performance",
    upcomingClasses: "Upcoming Classes",
    portal: "Portal",
    searchPlaceholder: "Search...",
    notifications: "Notifications",
    noNotifications: "No new notifications",
    chatHello: "Hello! I am your AI assistant . How can I help you?",
    typeMessage: "Type a message...",
    assistant: "a4ai Assistant",
    dragHint: "Drag me anywhere",
    thinking: "Thinking..."
  },
  hi: {
    dashboard: "डैशबोर्ड",
    notes: "नोट्स",
    inbox: "इनबॉक्स",
    students: "छात्र",
    settings: "सेटिंग्स",
    getPremium: "प्रीमियम लें",
    unlockFeatures: "सभी सुविधाएँ अनलॉक करें",
    upgradePlan: "प्लान अपग्रेड करें",
    logOut: "लॉग आउट",
    welcome: "वापसी पर स्वागत है",
    courseProgress: "आपकी औसत पाठ्यक्रम प्रगति है",
    levelUp: "अपनी रैंक सुधारने के लिए पढ़ाई का स्तर बढ़ाएं!",
    takeQuiz: "क्विज़ लें",
    learningActivity: "सीखने की गतिविधि",
    totalTime: "कुल समय",
    courses: "पाठ्यक्रम",
    rank: "रैंक",
    quickActions: "त्वरित कार्य",
    joinContests: "प्रतियोगिताओं में शामिल हों",
    leaderboard: "लीडरबोर्ड",
    practice: "अभ्यास",
    upcomingAssignments: "आगामी कार्य",
    allTests: "सभी परीक्षण",
    testName: "परीक्षण का नाम",
    deadline: "समय सीमा",
    status: "स्थिति",
    profile: "प्रोफाइल",
    darkMode: "डार्क मोड",
    lightMode: "लाइट मोड",
    language: "भाषा (English)",
    extraTools: "अतिरिक्त उपकरण",
    studyNotes: "अध्ययन नोट्स",
    performance: "प्रदर्शन",
    upcomingClasses: "आगामी कक्षाएं",
    portal: "पोर्टल",
    searchPlaceholder: "खोजें...",
    notifications: "सूचनाएं",
    noNotifications: "कोई नई सूचना नहीं",
    chatHello: "नमस्ते! मैं a4ai हूँ, भारतीय शिक्षा के लिए आपका AI सहायक। मैं कैसे मदद कर सकता हूँ?",
    typeMessage: "संदेश टाइप करें...",
    assistant: "a4ai सहायक",
    dragHint: "मुझे कहीं भी खींचें",
    thinking: "सोच रहा हूँ..."
  }
};

/* ------------------- ROBOT MASCOT ------------------- */
/**
 * a4ai's floating robot assistant.
 * White shell with radial shading, glowing blue visor, teal fins.
 * `look` offsets the eyes so the robot can glance toward the cursor.
 * Gradient IDs are per-instance so several mascots can render at once.
 */
function RobotMascot({
  size = 72,
  state = "idle",
  look = { x: 0, y: 0 },
}: {
  size?: number;
  state?: "idle" | "thinking" | "sleep";
  look?: { x: number; y: number };
}) {
  const uid = useRef(`rb${Math.random().toString(36).slice(2, 8)}`).current;
  const gHead = `${uid}-head`;
  const gBody = `${uid}-body`;
  const gArm = `${uid}-arm`;
  const gVisor = `${uid}-visor`;
  const gFin = `${uid}-fin`;
  const gChest = `${uid}-chest`;
  const fGlow = `${uid}-glow`;
  const fSoft = `${uid}-soft`;

  const ex = Math.max(-3.5, Math.min(3.5, look.x));
  const ey = Math.max(-2.5, Math.min(2.5, look.y));

  return (
    <svg width={size} height={size} viewBox="0 0 100 105" style={{ overflow: "visible" }}>
      <defs>
        {/* head — light from upper-left */}
        <radialGradient id={gHead} cx="0.34" cy="0.26" r="0.85">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="46%" stopColor="#F3F5FA" />
          <stop offset="78%" stopColor="#DCE1ED" />
          <stop offset="100%" stopColor="#B9C1D4" />
        </radialGradient>

        <radialGradient id={gBody} cx="0.38" cy="0.24" r="0.9">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="52%" stopColor="#EFF2F8" />
          <stop offset="100%" stopColor="#C3CAD9" />
        </radialGradient>

        <radialGradient id={gArm} cx="0.35" cy="0.25" r="0.9">
          <stop offset="0%" stopColor="#FDFDFF" />
          <stop offset="60%" stopColor="#E7EBF3" />
          <stop offset="100%" stopColor="#BFC7D8" />
        </radialGradient>

        {/* visor — deep glossy blue */}
        <radialGradient id={gVisor} cx="0.66" cy="0.22" r="0.95">
          <stop offset="0%" stopColor="#5C78FF" />
          <stop offset="34%" stopColor="#2438E6" />
          <stop offset="72%" stopColor="#131FBE" />
          <stop offset="100%" stopColor="#060C86" />
        </radialGradient>

        <linearGradient id={gFin} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8FE8F2" />
          <stop offset="55%" stopColor="#5BC4D8" />
          <stop offset="100%" stopColor="#2E90AE" />
        </linearGradient>

        <linearGradient id={gChest} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#6FD3E4" />
          <stop offset="100%" stopColor="#3AA7BE" />
        </linearGradient>

        <filter id={fGlow} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={fSoft} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="50" cy="100" rx="23" ry="4" fill="#0B1B3A" opacity="0.16" filter={`url(#${fSoft})`} />

      {/* ── fins (behind everything) ── */}
      <g>
        <rect x="15" y="14" width="9.5" height="29" rx="4.75" fill={`url(#${gFin})`} transform="rotate(-13 19 28)" />
        <rect x="76" y="14" width="9.5" height="29" rx="4.75" fill={`url(#${gFin})`} transform="rotate(13 81 28)" />
      </g>

      {/* ── arms ── */}
      <ellipse cx="18" cy="68" rx="14" ry="8" fill={`url(#${gArm})`} transform="rotate(32 18 68)" />
      <ellipse cx="84" cy="60" rx="15" ry="8" fill={`url(#${gArm})`} transform="rotate(-25 84 60)" />

      {/* ── body ── */}
      <ellipse cx="50" cy="76" rx="27" ry="22" fill={`url(#${gBody})`} />
      {/* body top highlight */}
      <ellipse cx="43" cy="63" rx="14" ry="6" fill="#FFFFFF" opacity="0.55" filter={`url(#${fSoft})`} />

      {/* chest plate */}
      <path d="M35 62 H65 A15 15 0 0 1 50 84 A15 15 0 0 1 35 62 Z" fill={`url(#${gChest})`} />
      <path d="M32 62 H68" stroke="#1E2450" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />

      {/* ── head ── */}
      {/* crown nub */}
      <rect x="31" y="3" width="17" height="10" rx="3.5" fill={`url(#${gHead})`} />
      <ellipse cx="50" cy="39" rx="34" ry="32" fill={`url(#${gHead})`} />
      {/* head rim highlight */}
      <ellipse cx="38" cy="18" rx="16" ry="7" fill="#FFFFFF" opacity="0.6" filter={`url(#${fSoft})`} transform="rotate(-18 38 18)" />

      {/* ear port */}
      <ellipse cx="16" cy="39" rx="8" ry="6.5" fill={`url(#${gHead})`} />
      <circle cx="13.5" cy="39" r="3.8" fill="#1E2450" />
      <circle cx="12.6" cy="37.8" r="1.1" fill="#5B6690" opacity="0.7" />

      {/* ── visor ── */}
      {/* glow spill under the visor */}
      <path d="M27 29 A23 20 0 0 1 73 29 L73 46 A23 17 0 0 1 27 46 Z" fill="#2438E6" opacity="0.35" filter={`url(#${fSoft})`} />
      <path d="M27 29 A23 20 0 0 1 73 29 L73 46 A23 17 0 0 1 27 46 Z" fill={`url(#${gVisor})`} />
      {/* glass highlight */}
      <ellipse cx="60" cy="28" rx="12.5" ry="5.5" fill="#FFFFFF" opacity="0.22" />
      <ellipse cx="35" cy="44" rx="7" ry="2.5" fill="#8FA6FF" opacity="0.18" />

      {/* ── eyes ── */}
      <g filter={`url(#${fGlow})`} transform={`translate(${ex} ${ey})`}>
        {state === "thinking" ? (
          <>
            <circle cx="39" cy="39" r="4.2" fill="#EAFBFF" />
            <circle cx="61" cy="39" r="4.2" fill="#EAFBFF" />
          </>
        ) : state === "sleep" ? (
          <>
            <path d="M33 40 H45" stroke="#EAFBFF" strokeWidth="4.6" strokeLinecap="round" />
            <path d="M55 40 H67" stroke="#EAFBFF" strokeWidth="4.6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M33 42.5 Q39 32 45 42.5" stroke="#EAFBFF" strokeWidth="5.2" strokeLinecap="round" fill="none" />
            <path d="M55 42.5 Q61 32 67 42.5" stroke="#EAFBFF" strokeWidth="5.2" strokeLinecap="round" fill="none" />
          </>
        )}
      </g>
    </svg>
  );
}

/* ------------------- CUSTOM COMPONENTS ------------------- */

const GlossyButton = ({
  icon: Icon,
  label,
  subLabel,
  variant = "blue",
  onClick,
  fullWidth = false,
  small = false,
}: {
  icon?: any;
  label: string;
  subLabel?: string;
  variant?: "blue" | "dark" | "green" | "crimson" | "yellow" | "orange" | "teal" | "purple" | "red";
  onClick?: () => void;
  fullWidth?: boolean;
  small?: boolean;
}) => {
  const styles = {
    blue: "bg-gradient-to-b from-[#60a5fa] to-[#2563eb] shadow-lg text-white border-t border-white/20",
    dark: "bg-[#111827]/80 backdrop-blur-sm shadow-lg text-white border border-white/10",
    green: "bg-gradient-to-b from-[#4ade80] to-[#16a34a] shadow-lg text-white border-t border-white/20",
    crimson: "bg-gradient-to-b from-[#f472b6] to-[#db2777] shadow-lg text-white border-t border-white/20",
    yellow: "bg-gradient-to-b from-[#facc15] to-[#ca8a04] shadow-lg text-white border-t border-white/20",
    orange: "bg-gradient-to-b from-[#fb923c] to-[#ea580c] shadow-[0_8px_20px_-6px_rgba(234,88,12,0.6)] text-white border-t border-white/20",
    teal: "bg-gradient-to-b from-[#2dd4bf] to-[#0d9488] shadow-lg text-white border-t border-white/20",
    purple: "bg-gradient-to-b from-[#a855f7] to-[#7e22ce] shadow-lg text-white border-t border-white/20",
    red: "bg-gradient-to-b from-[#ff6b81] to-[#DC143C] shadow-[0_8px_20px_-6px_rgba(220,20,60,0.6)] text-white border-t border-white/20",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative flex items-center justify-center gap-3 rounded-2xl transition-all duration-300 ${styles[variant]} ${fullWidth ? "w-full" : "w-auto"} ${small ? "px-4 py-2" : "px-5 py-4"}`}
    >
      {Icon && (
        <div className={`flex ${small ? 'h-6 w-6' : 'h-8 w-8'} items-center justify-center rounded-full bg-white/20 backdrop-blur-sm`}>
          <Icon size={small ? 14 : 18} className="text-white" />
        </div>
      )}
      <div className="flex flex-col text-left">
        <span className={`${small ? 'text-xs' : 'text-sm'} font-bold leading-none tracking-tight`}>{label}</span>
        {subLabel && !small && <span className="mt-1 text-[10px] font-medium opacity-90">{subLabel}</span>}
      </div>
      {!small && <div className="ml-auto opacity-80"><ChevronRight size={16} /></div>}
    </motion.button>
  );
};

const NavItem = ({ icon: Icon, label, active = false, to }: { icon: any, label: string, active?: boolean, to?: string }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ scale: 1.05, x: 5 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => to && navigate(to)}
      className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${active
          ? 'bg-[#111827]/90 text-white font-bold shadow-md border border-white/10'
          : 'text-slate-900 hover:bg-[#111827]/10 hover:text-black dark:text-slate-400 dark:hover:text-white'
        }`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="text-sm font-medium">{label}</span>
    </motion.div>
  )
}

const uniformGlassStyle = "bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 rounded-[30px] shadow-sm p-6 transition-colors duration-300";

// --- CHAT INTERFACE TYPES ---
type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

// --- API CONFIGURATION ---
const AI_CONFIG = {
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
};

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const { theme, toggleTheme } = useTheme();

  const [showScratchCard, setShowScratchCard] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const t = translations[lang];

  // Header Interaction States
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // --- CHATBOT STATE & LOGIC ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- MASCOT DRAG + 3D TILT ---
  const dragControls = useDragControls();
  const didDragRef = useRef(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [look, setLook] = useState({ x: 0, y: 0 });

  // remember where the student parked the robot
  const savedPos = useMemo(() => {
    try {
      const raw = safeStorage.get("mascotPos");
      return raw ? JSON.parse(raw) : { x: 0, y: 0 };
    } catch { return { x: 0, y: 0 }; }
  }, []);

  const handleMascotMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const py = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setTilt({ rx: -py * 15, ry: px * 20 });
    setLook({ x: px * 3.5, y: py * 2.5 });
  };

  const resetMascot = () => {
    setTilt({ rx: 0, ry: 0 });
    setLook({ x: 0, y: 0 });
  };

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // API Call Function
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!AI_CONFIG.apiKey) {
       setChatMessages(prev => [...prev, { role: 'assistant', content: "Error: API Key is missing. Please add VITE_GROQ_API_KEY to your .env.local file." }]);
       return;
    }

    const userMsg: Message = { role: 'user', content: inputMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setIsChatLoading(true);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${AI_CONFIG.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: `You are a4ai (Artificial Intelligence for All India), a practical AI tool designed specifically for Indian education.

                        Your Core Identity & Mission:
                        - You are not just another AI wrapper; you are built to solve real classroom challenges.
                        - You deeply understand Indian curriculum patterns (CBSE, ICSE, State Boards).
                        - You support multilingual content needs appropriate for India.
                        - Website: https://a4ai.in

                        Your Primary Function (For Teachers):
                        - Teachers spend hours creating tests. You help them do it in minutes.
                        - You act as an "AI Test Generator".
                        - Process: Users upload textbooks/notes (PDF/Text) -> You generate relevant questions -> They download ready-to-use tests.
                        - Future feature: Tracking student performance.

                        Current Status:
                        - Actively being tested with real educators.

                        Instructions:
                        - Keep answers helpful, encouraging, and concise.
                        - If asked about your capabilities, mention the Test Generator and Indian curriculum focus.
                        - Be polite and professional.`
                    },
                    ...chatMessages.filter(m => m.role !== 'system'),
                    userMsg
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();

        if (data.error) {
           console.error("API Error Detail:", data.error);
           throw new Error(data.error.message);
        }

        if (data.choices && data.choices[0]) {
            const aiMsg: Message = { role: 'assistant', content: data.choices[0].message.content };
            setChatMessages(prev => [...prev, aiMsg]);
        } else {
            throw new Error("No response from API");
        }

    } catch (error: any) {
        console.error("Chat Error:", error);
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message || "Connection failed"}. Please check your internet or API key.` }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
  };

  // Calendar Logic
  const date = new Date();
  const currentMonth = date.toLocaleString('default', { month: 'long' });
  const currentYear = date.getFullYear();
  const daysInMonth = new Date(currentYear, date.getMonth() + 1, 0).getDate();
  const currentDay = date.getDate();

  const recentTests = useMemo(() => [
    { id: 1, name: "Composition in web design", date: "June 09, 2026", status: "Active", type: "Web" },
    { id: 2, name: "Responsive vs. Adaptive", date: "June 10, 2026", status: "Active", type: "Design" },
    { id: 3, name: "8 point grid system in UX", date: "June 11, 2026", status: "Review", type: "UX" },
  ], []);

  const upcomingEvents = useMemo(() => [
    { id: 1, title: "Composition | Class 3A", time: "10:30", type: "Offline" },
    { id: 2, title: "Design Sys | Class 3B", time: "11:30", type: "Offline" },
  ], []);

  const studyStats = [
    { day: 'Mon', hours: 45, color: 'bg-blue-400' },
    { day: 'Tue', hours: 72, color: 'bg-purple-400' },
    { day: 'Wed', hours: 38, color: 'bg-teal-400' },
    { day: 'Thu', hours: 90, color: 'bg-orange-500' },
    { day: 'Fri', hours: 55, color: 'bg-crimson' },
    { day: 'Sat', hours: 25, color: 'bg-slate-400' },
    { day: 'Sun', hours: 15, color: 'bg-slate-300' },
  ];

  useEffect(() => {
    if (loading || !profile) return;
    if (searchParams.get("newUser") === "true" && !safeStorage.get("hasSeenCoinPopup")) {
      setTimeout(() => setShowScratchCard(true), 1500);
    }
  }, [loading, profile, searchParams]);

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'hi' : 'en');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8F9FC] dark:bg-slate-900 text-gray-400">Loading...</div>;

  return (
    <div className={`min-h-screen font-sans flex overflow-hidden relative transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-800'}`}>
      <Suspense fallback={null}>
        <ScratchCard isOpen={showScratchCard} onClose={() => setShowScratchCard(false)} coins={100} />
      </Suspense>

      {/* --- SIDEBAR --- */}
      <aside className={`w-[260px] h-screen flex flex-col p-6 fixed left-0 top-0 z-20 hidden lg:flex backdrop-blur-md border-r transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/60 border-white/10' : 'bg-white/60 border-white/50'}`}>
        <div className="flex items-center gap-4 mb-12 px-2">
          <img src="/ICON.ico" alt="Logo" className="w-12 h-12 object-contain" />
          <span className={`font-bold text-2xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>a4ai</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutGrid} label={t.dashboard} active to="/dashboard" />
          <NavItem icon={BookOpen} label={t.notes} to="/dashboard/notes" />
          <NavItem icon={MessageSquare} label={t.inbox} to="/dashboard/messages" />
          <NavItem icon={Users} label={t.students} to="/dashboard/leaderboard" />
          <NavItem icon={Settings} label={t.settings} to="/dashboard/settings" />
        </nav>

        <div className="mt-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-pink-500 p-6 text-center shadow-lg shadow-orange-200 dark:shadow-none">
            <h4 className="text-white font-bold mb-1">{t.getPremium}</h4>
            <p className="text-white/80 text-xs mb-4">{t.unlockFeatures}</p>
            <GlossyButton
                label={t.upgradePlan}
                variant="dark"
                fullWidth
                small
                onClick={() => navigate('/dashboard/subscription')}
            />
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 ml-0 lg:ml-[260px] p-4 lg:p-8 overflow-y-auto h-screen relative scroll-smooth">
        <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-8">

          {/* LEFT COLUMN (8/12) */}
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-8">
            <header>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {t.welcome}, {profile?.full_name?.split(' ')[0]}
              </h1>
              <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </header>

            {/* Banner */}
            <div className={`${uniformGlassStyle} relative p-8 flex justify-between items-center overflow-hidden`}>
              <div className="relative z-10 max-w-[70%]">
                <h2 className="text-2xl font-bold leading-tight mb-2">
                  {t.courseProgress} <span className="text-orange-600">73%</span>.
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">{t.levelUp}</p>
                <GlossyButton
                    label={t.takeQuiz}
                    variant="orange"
                    icon={Rocket}
                    onClick={() => navigate('/quiz')}
                />
              </div>
              <div className="absolute right-0 bottom-0 h-full w-[30%] bg-[url('https://illustrations.popsy.co/amber/student-going-to-school.svg')] bg-contain bg-bottom bg-no-repeat opacity-10 grayscale dark:opacity-20"></div>
            </div>

            {/* Stats & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={uniformGlassStyle}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.learningActivity}</h3>
                  <div className="flex items-center gap-1 text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-1 rounded-lg text-[10px] font-bold">
                    <TrendingUp size={12} /> +12.5%
                  </div>
                </div>

                <div className="flex items-end justify-between h-32 gap-3 px-2 mb-4">
                  {studyStats.map((item, i) => (
                    <div key={i} className="flex-1 group flex flex-col items-center gap-2">
                      <div className="w-full bg-white/40 dark:bg-black/20 rounded-2xl h-full relative overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${item.hours}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className={`absolute bottom-0 w-full rounded-2xl shadow-sm ${item.color}`}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{item.day}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-300/30 dark:border-slate-700">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t.totalTime}</p>
                    <p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>24.5 hrs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t.courses}</p>
                    <p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>08</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t.rank}</p>
                    <p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>#12</p>
                  </div>
                </div>
              </div>

              <div className={`${uniformGlassStyle} flex flex-col gap-4`}>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.quickActions}</h3>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  <Link to="/dashboard/contests"><GlossyButton label={t.joinContests} variant="blue" icon={Award} fullWidth /></Link>
                  <Link to="/dashboard/leaderboard"><GlossyButton label={t.leaderboard} variant="yellow" icon={Flame} fullWidth /></Link>
                  <Link to="/practice"><GlossyButton label={t.practice} variant="red" icon={Target} fullWidth /></Link>
                </div>
              </div>
            </div>

            {/* Assignments Table */}
            <div className={uniformGlassStyle}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.upcomingAssignments}</h3>
                <GlossyButton label={t.allTests} variant="dark" small />
              </div>
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left text-slate-600 dark:text-slate-400">
                  <thead className="text-xs text-slate-400 border-b border-slate-300/30 dark:border-slate-700">
                    <tr><th className="pb-3">{t.testName}</th><th className="pb-3">{t.deadline}</th><th className="pb-3 text-right">{t.status}</th></tr>
                  </thead>
                  <tbody>
                    {recentTests.map((row) => (
                      <tr key={row.id} className="border-b border-slate-300/20 dark:border-slate-700 last:border-0">
                        <td className={`py-4 font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{row.name}</td>
                        <td className="py-4 text-xs">{row.date}</td>
                        <td className="py-4 text-right"><span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-bold text-[10px]">{row.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (4/12) */}
          <div className="col-span-12 xl:col-span-4 flex flex-col gap-8">

            {/* --- HEADER ACTION BAR --- */}
            <div className="flex justify-end gap-4 items-center h-[50px] relative">

              {/* Expanding Search Bar */}
              <motion.div
                className={`flex items-center rounded-xl shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}
                initial={{ width: "40px" }}
                whileHover={{ width: "200px" }}
                animate={{ width: isSearchFocused ? "200px" : "40px" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <button className={`p-2.5 flex-shrink-0 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Search size={18} />
                </button>
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  className={`bg-transparent border-none outline-none text-sm w-full pr-3 placeholder-slate-400 h-full ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
              </motion.div>

              {/* Notification Bell */}
              <div
                  className="relative z-40"
                  onMouseEnter={() => setIsNotificationsOpen(true)}
                  onMouseLeave={() => setIsNotificationsOpen(false)}
              >
                  <motion.button
                    whileHover={{ rotate: [0, -20, 20, -10, 10, 0], scale: 1.1 }}
                    className={`p-2.5 rounded-xl shadow-sm relative ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}
                  >
                    <Bell size={18} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-200 dark:border-slate-800"></span>
                  </motion.button>

                  <AnimatePresence>
                    {isNotificationsOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className={`absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-xl border overflow-hidden p-4 z-50 ${theme === 'dark' ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-800'}`}
                        >
                             <h5 className="font-bold text-sm mb-3">{t.notifications}</h5>
                             <div className="flex flex-col gap-2">
                                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30">
                                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">New Test Added!</p>
                                    <p className="text-[10px] opacity-70">Physics Chapter 3 mock test is live.</p>
                                </div>
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Class Reminder</p>
                                    <p className="text-[10px] opacity-70">Math class starts in 30 mins.</p>
                                </div>
                             </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
              </div>

              {/* Profile Dropdown */}
              <div
                className="relative z-50"
                onMouseEnter={() => setIsProfileOpen(true)}
                onMouseLeave={() => setIsProfileOpen(false)}
              >
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className={`flex items-center gap-2 cursor-pointer p-1.5 pr-4 rounded-full border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-200/80 border-white/40'}`}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            profile?.full_name?.charAt(0) || "U"
                        )}
                    </div>
                    <span className={`text-sm font-bold hidden lg:block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{t.profile}</span>
                </motion.div>

                <AnimatePresence>
                    {isProfileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={`absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden p-2 backdrop-blur-xl ${theme === 'dark' ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-white/50'}`}
                        >
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{profile?.full_name || "Guest Student"}</p>
                                <p className="text-xs text-slate-500 truncate">{profile?.email || "student@example.com"}</p>
                            </div>

                            <div className="space-y-1">
                                <Link to="/dashboard/settings" className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <User size={16} /> {t.profile}
                                </Link>

                                <div onClick={toggleTheme} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                    {theme === 'dark' ? t.lightMode : t.darkMode}
                                </div>

                                <div onClick={toggleLanguage} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <Globe size={16} /> {t.language}
                                </div>

                                <Link to="/dashboard/settings" className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <Settings size={16} /> {t.settings}
                                </Link>
                                <div
                                    onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
                                    className="flex items-center gap-3 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl cursor-pointer text-sm transition-colors mt-2 border-t border-slate-100 dark:border-slate-700"
                                >
                                    <LogOut size={16} /> {t.logOut}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>

            </div>

            {/* Calendar */}
            <div className={uniformGlassStyle}>
              <h3 className={`font-bold mb-6 text-sm text-center ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{currentMonth} {currentYear}</h3>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const isToday = day === currentDay;
                    return (
                        <div key={i} className={`aspect-square flex items-center justify-center rounded-xl transition-all ${isToday ? 'bg-orange-500 text-white font-bold' : `${theme === 'dark' ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-300'}`}`}>
                            {day}
                        </div>
                    );
                })}
              </div>
            </div>

            {/* Extra Tools */}
            <div className={`${uniformGlassStyle} flex flex-col gap-4`}>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.extraTools}</h4>
              <div className="flex flex-col gap-3">
                <Link to="/dashboard/notes"><GlossyButton label={t.studyNotes} variant="green" icon={BookOpen} fullWidth /></Link>
                <Link to="/dashboard/analytics"><GlossyButton label={t.performance} variant="crimson" icon={BarChart3} fullWidth /></Link>
                <Link to="/dashboard/leaderboard"><GlossyButton label={t.students} variant="purple" icon={Users} fullWidth /></Link>
              </div>
            </div>

            {/* Upcoming Classes */}
            <div className={`${uniformGlassStyle} flex-1`}>
              <h3 className={`font-bold mb-6 text-xs uppercase tracking-widest opacity-60 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.upcomingClasses}</h3>
              <div className="space-y-4">
                {upcomingEvents.map((evt) => (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    key={evt.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800' : 'bg-white/40 border-white/60 hover:bg-white'}`}
                  >
                    <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300">{evt.time}</div>
                    <div className="flex-1 text-sm">
                      <h4 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{evt.title}</h4>
                      <p className="text-slate-400 text-[10px]">{evt.type} • {t.portal}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════
          CHATBOT — draggable 3D robot mascot
          Lives outside <main> so it floats over the whole viewport.
         ══════════════════════════════════════════════════════════ */}
      <motion.div
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.06}
        initial={{ x: savedPos.x, y: savedPos.y }}
        dragConstraints={{
          left: -(typeof window !== "undefined" ? window.innerWidth - 150 : 900),
          top: -(typeof window !== "undefined" ? window.innerHeight - 170 : 700),
          right: 16,
          bottom: 16,
        }}
        onDragStart={() => { didDragRef.current = true; }}
        onDragEnd={(_e, info) => {
          setTimeout(() => { didDragRef.current = false; }, 60);
          try {
            const prev = savedPos;
            safeStorage.set("mascotPos", JSON.stringify({
              x: prev.x + info.offset.x,
              y: prev.y + info.offset.y,
            }));
          } catch { /* no-op */ }
        }}
        className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-3 touch-none"
      >
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className={`w-80 h-96 rounded-3xl shadow-2xl overflow-hidden border flex flex-col ${
                theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              {/* header */}
              <div className="bg-gradient-to-r from-[#1B2FD8] to-[#4A66FF] p-4 flex justify-between items-center text-white shrink-0">
                <span className="font-bold text-sm flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <RobotMascot size={28} />
                  </span>
                  {t.assistant}
                </span>
                <X size={16} className="cursor-pointer hover:scale-110 transition-transform" onClick={() => setIsChatOpen(false)} />
              </div>

              {/* messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-end gap-2">
                  <RobotMascot size={26} />
                  <div className={`p-3 rounded-2xl rounded-bl-md max-w-[80%] text-sm ${
                    theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 shadow-sm'
                  }`}>
                    {t.chatHello}
                  </div>
                </div>

                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role !== 'user' && <RobotMascot size={26} />}
                    <div className={`p-3 rounded-2xl max-w-[80%] text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#1B2FD8] text-white rounded-br-md'
                        : `${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 shadow-sm'} rounded-bl-md`
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex items-end gap-2 justify-start">
                    <RobotMascot size={26} state="thinking" />
                    <div className="p-3 rounded-2xl rounded-bl-md bg-slate-200 dark:bg-slate-800 flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-slate-500" />
                      <span className="text-xs text-slate-500">{t.thinking}</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* input */}
              <div className={`p-3 border-t shrink-0 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
              }`}>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.typeMessage}
                    className={`w-full text-sm p-3 pr-10 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#1B2FD8]/40 ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isChatLoading || !inputMessage.trim()}
                    className="absolute right-2 p-1.5 bg-[#1B2FD8] text-white rounded-lg hover:bg-[#4A66FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* the robot — drag handle + chat toggle */}
        <motion.button
          onPointerDown={(e) => dragControls.start(e)}
          onClick={() => { if (!didDragRef.current) setIsChatOpen(!isChatOpen); }}
          onMouseMove={handleMascotMove}
          onMouseLeave={resetMascot}
          animate={{ y: isChatOpen ? 0 : [0, -8, 0] }}
          transition={{ duration: 3.2, repeat: isChatOpen ? 0 : Infinity, ease: "easeInOut" }}
          whileTap={{ scale: 0.92 }}
          className="cursor-grab active:cursor-grabbing select-none bg-transparent border-none p-0"
          style={{ perspective: 700 }}
          title={t.dragHint}
          aria-label={t.assistant}
        >
          <motion.div
            animate={{
              rotateX: tilt.rx,
              rotateY: tilt.ry,
              scale: tilt.ry !== 0 || tilt.rx !== 0 ? 1.08 : 1,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <RobotMascot
              size={84}
              state={isChatLoading ? "thinking" : "idle"}
              look={look}
            />
          </motion.div>
        </motion.button>
      </motion.div>
    </div>
  );
}