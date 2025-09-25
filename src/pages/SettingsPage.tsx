import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Moon,
  Sun,
  Mail,
  Building2,
  User2,
  Trash2,
  Check,
  Sparkles,
  Shield,
  Globe,
  Bell,
  Lock,
  Download,
  ArrowRight,
  UploadCloud,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ===================== Brand tokens (Cluely vibe) ===================== */
const CARD =
  "rounded-2xl border border-[#E9EEF8] dark:border-white/10 bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm shadow-[0_6px_30px_-12px_rgba(10,20,70,0.18)]";
const RING = "ring-1 ring-[#E6EBF5] dark:ring-white/10";
const PRIMARY_BTN =
  "bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1E40AF] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_30px_-10px_rgba(37,99,235,.75)] hover:brightness-[1.03] active:translate-y-[1px]";

/* ===================================================================== */

export default function SettingsPage() {
  const [dark, setDark] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [org, setOrg] = useState("a4ai");
  const [displayName, setDisplayName] = useState("Tarun Pathak");
  const [bio, setBio] = useState(
    "Teacher • Founder @ a4ai • Building smart, simple, secure assessments."
  );
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
    setOrg("a4ai");
    setDisplayName("Tarun Pathak");
    setEmailAlerts(true);
    setPushDesktop(true);
    setPushContest(true);
    setPushAnnouncements(false);
    setTwoFA(false);
    setProfilePublic(true);
    setLanguage("en-IN");
    setTimezone("Asia/Kolkata");
    setBio(
      "Teacher • Founder @ a4ai • Building smart, simple, secure assessments."
    );
    setAvatarFile(null);
    toggleDark(false);
    toast.success("Preferences reset to defaults");
  };

  const saveProfile = async () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    // TODO: Persist to Supabase (profiles + storage)
    toast.success("Profile saved", {
      description: `${displayName} • ${org}`,
      icon: <Check className="h-4 w-4" />,
    } as any);
  };

  const deleteAccount = () => {
    setConfirmOpen(false);
    // TODO: destructive API (soft-delete + grace)
    toast("Account deletion requested", {
      description: "We'll process this shortly (demo).",
    });
  };

  const exportData = () => {
    // TODO: server-side ZIP export
    toast.success("Export requested", {
      description: "You'll receive a download link via email.",
    });
  };

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-8">
      <BackdropGradients mode={dark ? "dark" : "light"} />

      {/* Sticky action bar */}
      <div className="sticky top-3 z-30 mb-4 flex justify-end">
        <div
          className={`flex items-center gap-2 rounded-full border border-[#E7ECF7] bg-white/80 px-2 py-2 shadow-[0_10px_30px_-12px_rgba(15,25,60,.18)] backdrop-blur ${RING}`}
        >
          <Button variant="outline" onClick={resetDefaults} className="rounded-full">
            Reset
          </Button>
          <Button className={`rounded-full px-4 ${PRIMARY_BTN}`} onClick={saveProfile}>
            Save Changes <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-[#E3E9F6] backdrop-blur dark:bg-white/10 dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" />
          Personalized settings
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="text-[15px] text-muted-foreground">
          Update profile & preferences. Changes are previewed instantly.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        {/* Left column */}
        <div className="grid gap-6">
          {/* Profile */}
          <Card className={`p-6 lg:p-7 ${CARD}`}>
            <SectionTitle
              title="Profile"
              subtitle="Your public information for classes and contests."
            />

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Display name" icon={User2}>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 pl-9"
                />
              </Field>
              <Field label="Organization" icon={Building2}>
                <Input
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="h-11 pl-9"
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-3">
              <Label className="text-sm font-medium">Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[96px]"
                placeholder="Tell students/teachers about you"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-IN">English (India)</SelectItem>
                    <SelectItem value="hi-IN">Hindi (भारत)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium">Time zone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="Asia/Dhaka">Asia/Dhaka</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Avatar */}
            <Separator className="my-6" />
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative h-20 w-20 overflow-hidden rounded-full ring-4 ring-white shadow-[0_10px_30px_-12px_rgba(30,64,175,.45)]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-slate-100 text-slate-500">
                    TP
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent">
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload avatar</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {avatarFile && (
                  <Button variant="outline" onClick={() => setAvatarFile(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Privacy & Security */}
          <Card className={`p-6 lg:p-7 ${CARD}`}>
            <SectionTitle
              title="Privacy & Security"
              subtitle="Control who can see your profile and keep your account protected."
              icon={Shield}
            />

            <Row
              title="Public profile"
              description="Allow other a4ai users to view your name, org and avatar."
              control={<Switch checked={profilePublic} onCheckedChange={setProfilePublic} />}
            />
            <Row
              title="Two-factor authentication"
              description="Add an extra layer of security during sign-in."
              control={<Switch checked={twoFA} onCheckedChange={setTwoFA} />}
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2">
                <Lock className="h-4 w-4" /> Change password
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportData}>
                <Download className="h-4 w-4" /> Export my data
              </Button>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className={`p-6 lg:p-7 ${CARD}`}>
            <SectionTitle
              title="Danger Zone"
              subtitle="Delete account permanently (cannot be undone)."
            />
            <Button variant="destructive" className="gap-2" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete Account
            </Button>
          </Card>
        </div>

        {/* Right column */}
        <div className="grid gap-6">
          {/* Theme & Alerts */}
          <Card className={`p-6 lg:p-7 ${CARD}`}>
            <SectionTitle
              title="Theme & Alerts"
              subtitle="Pick your appearance and notification preferences."
              icon={Globe}
            />

            <Row
              title="Dark mode"
              description="Preview theme on this device."
              control={
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 opacity-60" />
                  <Switch checked={dark} onCheckedChange={toggleDark} />
                  <Moon className="h-4 w-4 opacity-60" />
                </div>
              }
            />

            <Separator className="my-4" />

            <Row
              title="Email alerts"
              description="Contest results & important updates."
              control={<Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />}
            />
            <Row
              title="Desktop push"
              description="Real-time notifications in your browser."
              control={<Switch checked={pushDesktop} onCheckedChange={setPushDesktop} />}
            />
            <Row
              title="Contest reminders"
              description="Remind me 10 minutes before a contest begins."
              control={<Switch checked={pushContest} onCheckedChange={setPushContest} />}
            />
            <Row
              title="Product announcements"
              description="New features, tips and best practices."
              control={<Switch checked={pushAnnouncements} onCheckedChange={setPushAnnouncements} />}
            />

            <p className="mt-3 text-xs text-muted-foreground">
              Tip: Wire these to your backend to persist preferences per account.
            </p>
          </Card>

          {/* Email */}
          <Card className={`p-6 lg:p-7 ${CARD}`}>
            <SectionTitle title="Email settings" subtitle="Choose where we should reach you." icon={Bell} />
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Primary email</Label>
              <Field icon={Mail}>
                <Input defaultValue="tarun@a4ai.in" className="h-11 pl-9" />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              We’ll send verification if you change this address.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline">Verify</Button>
              <Button variant="outline">Add secondary</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirm dialog (headless) */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setConfirmOpen(false)} />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative z-10 w-[min(520px,92vw)] rounded-xl border border-border bg-background p-5 shadow-xl"
            >
              <h3 className="text-lg font-semibold">Delete account?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This action cannot be undone. All associated data may be removed.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={deleteAccount}>Confirm Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------ Backdrop (aligned) ------------------------ */
/* Uses centered spotlight + side glows + masked vignette to avoid harsh edges */
function BackdropGradients({ mode = "light" as "light" | "dark" }: { mode?: "light" | "dark" }) {
  const isDark = mode === "dark";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* base tint */}
      <div
        className={
          isDark
            ? "absolute inset-0 bg-[linear-gradient(180deg,#0B1220_0%,#0B1220_30%,#0D1426_100%)]"
            : "absolute inset-0 bg-[linear-gradient(180deg,#F7F9FD_0%,#F8FAFF_35%,#FFFFFF_100%)]"
        }
      />
      {/* center spotlight */}
      <div
        className={
          (isDark
            ? "absolute -top-32 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-[50%]"
            : "absolute -top-28 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-[50%]") +
          " bg-[radial-gradient(closest-side,rgba(59,130,246,.28),rgba(59,130,246,0)_70%)] blur-2xl"
        }
        style={{ maskImage: "radial-gradient(closest-side, black 55%, transparent 75%)" }}
      />
      {/* left soft glow */}
      <div
        className="absolute -top-10 -left-32 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(147,197,253,.45),rgba(147,197,253,0)_70%)] blur-3xl"
        style={{ maskImage: "radial-gradient(closest-side, black 45%, transparent 75%)" }}
      />
      {/* right soft glow */}
      <div
        className="absolute -top-6 -right-32 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,.38),rgba(99,102,241,0)_70%)] blur-3xl"
        style={{ maskImage: "radial-gradient(closest-side, black 45%, transparent 75%)" }}
      />
      {/* bottom vignette */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40"
        style={{
          background: isDark
            ? "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(7,10,20,.35) 70%, rgba(7,10,20,.65) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(243,246,253,.7) 90%, rgba(255,255,255,1) 100%)",
        }}
      />
    </div>
  );
}

/* ------------------------------ UI bits ------------------------------ */
function SectionTitle({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 opacity-70" />}
        <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Row({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-[15px] font-medium">{title}</p>
        {description && <p className="text-[13.5px] text-muted-foreground">{description}</p>}
      </div>
      {control}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {label && <Label className="mb-1 text-sm font-medium">{label}</Label>}
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <div className={Icon ? "pl-9" : ""}>{children}</div>
    </div>
  );
}
