import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

/* ------------------- STYLES ------------------- */
const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)  scale(1); }
  }
  @keyframes blobBounce {
    0%   { transform: translate(0px, 0px) scale(1); }
    33%  { transform: translate(30px, -50px) scale(1.1); }
    66%  { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  .animate-blob { 
    animation: blobBounce 15s infinite ease-in-out alternate; 
  }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
  .animate-entrance { animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  .animate-pop      { animation: scaleIn  0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  /* Glass surfaces */
  .glass-panel {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-panel {
    background: rgba(15, 15, 15, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }
  .glass-overlay {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(48px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-overlay {
    background: rgba(10, 10, 10, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.9);
  }
  .inset-pill {
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.02),
                inset -4px -4px 10px rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  .dark .inset-pill {
    background: rgba(20, 20, 20, 0.6);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.5),
                inset -4px -4px 10px rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Theme Button */
  .btn-glossy-theme {
    background: linear-gradient(135deg, var(--theme-start) 0%, var(--theme-end) 100%);
    box-shadow: inset 0px 2px 4px rgba(255, 255, 255, 0.25),
                inset 0px -2px 4px rgba(0, 0, 0, 0.4),
                0px 8px 20px var(--theme-shadow);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: relative;
    overflow: hidden;
  }
  .btn-glossy-theme::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }
  .btn-glossy-theme:hover::before  { left: 100%; }
  .btn-glossy-theme:hover  { filter: brightness(1.15); transform: translateY(-2px); }
  .btn-glossy-theme:active { transform: translateY(0); filter: brightness(0.9); }
  
  .btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
    box-shadow: inset 0px 2px 4px rgba(255, 255, 255, 0.25),
                inset 0px -2px 4px rgba(0, 0, 0, 0.4),
                0px 8px 20px rgba(220, 38, 38, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: relative;
    overflow: hidden;
  }
  .btn-danger:hover { filter: brightness(1.15); transform: translateY(-2px); }
  .btn-danger:active { transform: translateY(0); filter: brightness(0.9); }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  User:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Building:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  Shield:      () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Lock:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Download:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Trash:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>,
  Globe:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
  Bell:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Moon:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  Sun:         () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  Mail:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  UploadCloud: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" x2="12" y1="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/></svg>,
  ArrowRight:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Check:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Sparkles:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3L8 5 6 7 4 5 6 3Z"/><path d="M18 13L20 15 18 17 16 15 18 13Z"/><path d="M10 7L13 10 13 10 7 10 10 7Z"/><path d="m13 17 2 3 2-3"/><path d="M18 3v4"/><path d="M20 5h-4"/></svg>,
  ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
};

const COLOR_SCHEMES = {
  black:      { start: '#333333', end: '#000000', shadow: 'rgba(0,0,0,0.4)' },
};

/* ------------------- REUSABLE UI COMPONENTS ------------------- */
const GlossyButton = ({ icon: Icon, label, onClick, variant = "primary", className = "" }: any) => {
  const baseClass = "relative flex items-center justify-center gap-2 rounded-[24px] px-5 py-2.5 font-bold text-sm transform transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 text-white";
  const styles = variant === "danger" ? "btn-danger" : "btn-glossy-theme";
  return (
    <button onClick={onClick} className={`${baseClass} ${styles} ${className}`}>
      {Icon && <Icon />}
      {label}
    </button>
  );
};

const OutlineButton = ({ icon: Icon, label, onClick, className = "" }: any) => (
  <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-[24px] inset-pill border-none px-5 py-2.5 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300 ${className}`}>
    {Icon && <Icon />}
    {label}
  </button>
);

const GlassInput = ({ icon: Icon, ...props }: any) => (
  <div className="relative flex items-center inset-pill rounded-[24px] focus-within:ring-2 focus-within:ring-slate-400/50 transition-all duration-200 border-none w-full group">
    {Icon && (
      <div className="pl-4 text-slate-500 dark:text-slate-400 shrink-0 group-focus-within:text-slate-800 dark:group-focus-within:text-white transition-colors">
        <Icon />
      </div>
    )}
    <input
      className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white px-4 py-3.5 placeholder-slate-400 w-full"
      {...props}
    />
  </div>
);

const GlassTextarea = (props: any) => (
  <div className="inset-pill rounded-[24px] focus-within:ring-2 focus-within:ring-slate-400/50 transition-all duration-200 border-none w-full">
    <textarea
      className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white px-5 py-4 placeholder-slate-400 min-h-[100px] resize-none"
      {...props}
    />
  </div>
);

const GlassSelect = ({ value, onChange, options }: any) => (
  <div className="relative inset-pill rounded-[24px] focus-within:ring-2 focus-within:ring-slate-400/50 transition-all duration-200 border-none w-full">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none bg-transparent px-5 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value} className="text-slate-900 bg-white">
          {opt.label}
        </option>
      ))}
    </select>
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
      <Icons.ChevronDown />
    </div>
  </div>
);

const GlassSwitch = ({ checked, onChange }: any) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-12 h-7 rounded-full shadow-inner relative flex items-center px-1 transition-colors duration-300 ${
      checked ? "bg-slate-800 dark:bg-white" : "bg-slate-300 dark:bg-slate-700"
    }`}
    style={checked ? { background: 'linear-gradient(135deg, var(--theme-start), var(--theme-end))' } : {}}
  >
    <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
      checked ? "translate-x-5" : "translate-x-0"
    }`} />
  </button>
);

const SectionTitle = ({ title, subtitle, icon: Icon }: any) => (
  <div className="mb-6">
    <div className="flex items-center gap-3 mb-1">
      {Icon && (
        <div className="p-2 rounded-[14px] inset-pill border-none text-slate-800 dark:text-white shrink-0" style={{ color: "var(--theme-start)" }}>
          <Icon />
        </div>
      )}
      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h2>
    </div>
    {subtitle && <p className="text-sm font-medium text-slate-500">{subtitle}</p>}
  </div>
);

const Row = ({ title, description, control }: any) => (
  <div className="flex items-center justify-between gap-4 py-4 rounded-[20px] hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors px-2">
    <div>
      <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{title}</p>
      {description && <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

/* ------------------- MAIN PAGE ------------------- */
export default function SettingsPage() {
  const { user } = useAuth();
  
  // Default values matching User/Google logic
  const defaultName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Educator";
  const defaultEmail = user?.email || "";

  const [dark, setDark] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [displayName, setDisplayName] = useState(defaultName);
  const [org, setOrg] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : undefined),
    [avatarFile]
  );

  const [language, setLanguage] = useState("en-IN");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [pushDesktop, setPushDesktop] = useState(true);
  const [pushContest, setPushContest] = useState(true);
  const [pushAnnouncements, setPushAnnouncements] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const [profilePublic, setProfilePublic] = useState(true);

  // Theme setup matching dashboard
  const currentThemeConfig = COLOR_SCHEMES.black;

  useEffect(() => {
    const saved = localStorage.getItem("pref-theme");
    if (saved) {
      const v = saved === "dark";
      setDark(v);
      document.documentElement.classList.toggle("dark", v);
    }
  }, []);

  const toggleDark = (v: boolean) => {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("pref-theme", v ? "dark" : "light");
  };

  const resetDefaults = () => {
    setOrg("");
    setDisplayName(defaultName);
    setEmail(defaultEmail);
    setEmailAlerts(true);
    setPushDesktop(true);
    setPushContest(true);
    setPushAnnouncements(false);
    setTwoFA(false);
    setProfilePublic(true);
    setLanguage("en-IN");
    setTimezone("Asia/Kolkata");
    setBio("");
    setAvatarFile(null);
    toggleDark(false);
    toast.success("Preferences reset to defaults");
  };

  const saveProfile = async () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    toast.success("Profile saved", {
      description: `${displayName} updated`,
    });
  };

  const deleteAccount = () => {
    setConfirmOpen(false);
    toast("Account deletion requested", {
      description: "We'll process this shortly.",
    });
  };

  const exportData = () => {
    toast.success("Export requested", {
      description: "You'll receive a download link via email.",
    });
  };

  return (
    <div 
      className={dark ? "dark" : ""}
      style={{
        '--theme-start': currentThemeConfig.start,
        '--theme-end': currentThemeConfig.end,
        '--theme-shadow': currentThemeConfig.shadow,
      } as React.CSSProperties}
    >
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] text-slate-800 dark:text-slate-100 transition-colors duration-500 relative overflow-x-hidden pb-24 font-sans">
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />

        {/* Dynamic Blobs Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-20 dark:opacity-[0.15] animate-blob" style={{ background: 'var(--theme-start)' }} />
          <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-20 dark:opacity-[0.15] animate-blob animation-delay-2000" style={{ background: 'var(--theme-end)' }} />
          <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-20 dark:opacity-[0.15] animate-blob animation-delay-4000" style={{ background: 'var(--theme-start)' }} />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 sm:pt-12">
          
          {/* Sticky action bar */}
          <div className="sticky top-4 z-30 mb-8 flex justify-end animate-entrance" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 rounded-full glass-overlay p-2 pr-2.5">
              <OutlineButton label="Reset" onClick={resetDefaults} />
              <GlossyButton label="Save Changes" icon={Icons.Check} onClick={saveProfile} />
            </div>
          </div>

          {/* Header */}
          <div className="mb-8 sm:mb-12 animate-entrance" style={{ animationDelay: "150ms" }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full inset-pill border-none mb-4 bg-white/50 dark:bg-black/20">
              <div className="text-slate-800 dark:text-white" style={{ color: "var(--theme-start)" }}>
                <Icons.Sparkles />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
                Personalized settings
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
              Settings
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium mt-2">
              Update profile & preferences. Changes are previewed instantly.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            
            {/* Left column */}
            <div className="space-y-6 sm:space-y-8 animate-entrance" style={{ animationDelay: "200ms" }}>
              
              {/* Profile Card */}
              <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10">
                <SectionTitle title="Profile" subtitle="Your public information for classes and contests." icon={Icons.User} />

                {/* Avatar Row */}
                <div className="flex flex-wrap items-center gap-5 mb-8">
                  <div className="relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-[28px] inset-pill border-none flex items-center justify-center text-slate-400 bg-white dark:bg-slate-800 shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="scale-150 text-slate-400 dark:text-slate-500"><Icons.User /></div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center justify-center gap-2 rounded-[24px] inset-pill border-none px-5 py-2.5 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">
                      <Icons.UploadCloud />
                      Upload Avatar
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {avatarFile && <OutlineButton label="Remove" onClick={() => setAvatarFile(null)} />}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2 ml-1">Display name</label>
                    <GlassInput icon={Icons.User} value={displayName} onChange={(e: any) => setDisplayName(e.target.value)} />
                    <button className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white mt-2 ml-3 transition-colors">
                      Change Display Name
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2 ml-1">Organization</label>
                    <GlassInput icon={Icons.Building} value={org} onChange={(e: any) => setOrg(e.target.value)} placeholder="E.g. a4ai Institute" />
                    <button className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white mt-2 ml-3 transition-colors">
                      Add Organization
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2 ml-1">Bio</label>
                  <GlassTextarea value={bio} onChange={(e: any) => setBio(e.target.value)} placeholder="Tell students about you..." />
                  <button className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white mt-2 ml-3 transition-colors">
                    Add Bio
                  </button>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2 ml-1">Language</label>
                    <GlassSelect 
                      value={language} 
                      onChange={setLanguage} 
                      options={[
                        { value: "en-IN", label: "English (India)" },
                        { value: "hi-IN", label: "Hindi (भारत)" },
                        { value: "en-GB", label: "English (UK)" }
                      ]} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2 ml-1">Time zone</label>
                    <GlassSelect 
                      value={timezone} 
                      onChange={setTimezone} 
                      options={[
                        { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                        { value: "Asia/Dhaka", label: "Asia/Dhaka" },
                        { value: "Asia/Dubai", label: "Asia/Dubai" }
                      ]} 
                    />
                  </div>
                </div>
              </div>

              {/* Privacy & Security Card */}
              <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10">
                <SectionTitle title="Privacy & Security" subtitle="Control who can see your profile and keep your account protected." icon={Icons.Shield} />
                
                <div className="space-y-2 mb-8">
                  <Row title="Public profile" description="Allow other a4ai users to view your name and avatar." control={<GlassSwitch checked={profilePublic} onChange={setProfilePublic} />} />
                  <div className="h-px w-full bg-slate-200/50 dark:bg-white/5 my-1" />
                  <Row title="Two-factor auth" description="Add an extra layer of security during sign-in." control={<GlassSwitch checked={twoFA} onChange={setTwoFA} />} />
                </div>

                <div className="flex flex-wrap gap-3">
                  <OutlineButton icon={Icons.Lock} label="Change Password" />
                  <OutlineButton icon={Icons.Download} label="Export My Data" onClick={exportData} />
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 border-red-500/20 shadow-[0_10px_40px_-10px_rgba(239,68,68,0.1)]">
                <SectionTitle title="Danger Zone" subtitle="Delete account permanently (cannot be undone)." icon={Icons.Trash} />
                <GlossyButton variant="danger" icon={Icons.Trash} label="Delete Account" onClick={() => setConfirmOpen(true)} className="mt-2" />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6 sm:space-y-8 animate-entrance" style={{ animationDelay: "300ms" }}>
              
              {/* Theme & Alerts */}
              <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10">
                <SectionTitle title="Theme & Alerts" subtitle="Pick your appearance and notifications." icon={Icons.Globe} />

                <Row 
                  title="Dark mode" 
                  description="Preview theme on this device." 
                  control={
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400"><Icons.Sun /></div>
                      <GlassSwitch checked={dark} onChange={toggleDark} />
                      <div className="text-slate-400"><Icons.Moon /></div>
                    </div>
                  } 
                />
                
                <div className="h-px w-full bg-slate-200/50 dark:bg-white/5 my-4" />

                <div className="space-y-1">
                  <Row title="Email alerts" description="Contest results & updates." control={<GlassSwitch checked={emailAlerts} onChange={setEmailAlerts} />} />
                  <Row title="Desktop push" description="Real-time notifications." control={<GlassSwitch checked={pushDesktop} onChange={setPushDesktop} />} />
                  <Row title="Contest reminders" description="Remind 10 mins before start." control={<GlassSwitch checked={pushContest} onChange={setPushContest} />} />
                  <Row title="Announcements" description="New features & tips." control={<GlassSwitch checked={pushAnnouncements} onChange={setPushAnnouncements} />} />
                </div>
              </div>

              {/* Email Card */}
              <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10">
                <SectionTitle title="Email settings" subtitle="Where we should reach you." icon={Icons.Bell} />
                
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2 ml-1">Primary email</label>
                  <GlassInput icon={Icons.Mail} value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="Email Address" />
                  <p className="mt-3 ml-2 text-xs font-medium text-slate-500">
                    We'll send verification if you change this address.
                  </p>
                </div>
                
                <div className="mt-6 flex flex-wrap gap-3">
                  <OutlineButton label="Verify" />
                  <OutlineButton label="Add Secondary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setConfirmOpen(false)} />
            <div className="glass-overlay p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] w-full max-w-md relative z-10 text-center border-red-500/20">
              <div className="w-16 h-16 sm:w-20 sm:h-20 inset-pill border-none text-red-500 rounded-[24px] sm:rounded-[32px] flex items-center justify-center mx-auto mb-6 bg-red-500/10 shrink-0">
                <div className="scale-125"><Icons.Trash /></div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black mb-3 text-slate-900 dark:text-white">Delete Account?</h3>
              <p className="text-sm font-medium text-slate-500 mb-8">
                This action cannot be undone. All associated data will be removed.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <OutlineButton label="Cancel" onClick={() => setConfirmOpen(false)} className="w-full" />
                <GlossyButton variant="danger" label="Confirm Delete" onClick={deleteAccount} className="w-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}