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
} from "lucide-react";

export default function SettingsPage() {
  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  const [dark, setDark] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [org, setOrg] = useState("a4ai");
  const [displayName, setDisplayName] = useState("Tarun Pathak");
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* Persist preview theme locally */
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
    toggleDark(false);
    toast.success("Preferences reset to defaults");
  };

  const saveProfile = () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    // TODO: Wire to Supabase/Edge function
    toast.success("Profile saved", {
      description: `${displayName} • ${org}`,
      icon: <Check className="h-4 w-4" />,
    } as any);
  };

  const deleteAccount = () => {
    setConfirmOpen(false);
    // TODO: Call destructive API here
    toast("Account deletion requested", {
      description: "We\'ll process this shortly (demo).",
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500/15 via-fuchsia-500/15 to-emerald-500/15 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200/40 dark:ring-indigo-300/20">
          <Sparkles className="h-3.5 w-3.5" />
          Personalized settings
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Update profile & preferences. Changes are previewed instantly.</p>
      </motion.div>

      <div className="grid gap-6">
        {/* Profile */}
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-medium">Profile</h2>
          <p className="mb-4 text-sm text-muted-foreground">Your public information for classes and contests.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Display name</Label>
              <div className="relative">
                <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Organization</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={org} onChange={(e) => setOrg(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={saveProfile}>Save Profile</Button>
            <Button variant="outline" onClick={resetDefaults}>Reset to Defaults</Button>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-medium">Preferences</h2>
          <p className="mb-2 text-sm text-muted-foreground">Theme, alerts, and notifications.</p>
          <Separator className="my-3" />

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

          <Row
            title="Email alerts"
            description="Contest results & important updates."
            control={<Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />}
          />

          <div className="mt-3 text-xs text-muted-foreground">
            Tip: Wire this to your backend to persist preferences per account.
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-medium">Danger Zone</h2>
          <p className="mb-4 text-sm text-muted-foreground">Delete account permanently (cannot be undone).</p>
          <Button variant="destructive" className="gap-2" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete Account
          </Button>
        </Card>
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

/* -------------------------------------------------------------------- */
/* Subcomponents                                                         */
/* -------------------------------------------------------------------- */
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
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {control}
    </div>
  );
}
