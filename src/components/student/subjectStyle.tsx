// Subject → solid tile colour + icon (study-plan look), shared by contests, practice and the dashboard.
// White icons only on tiles where they keep ≥ 3:1 (non-text contrast); golden uses a dark icon.
import {
  Atom, BookOpen, Calculator, Code2, FlaskConical, Globe2, Landmark, Leaf, Microscope, Mountain, Scale, Sigma,
  TrendingUp, Trophy, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SubjectLook = { Icon: LucideIcon; bg: string; fg: string };

const RULES: [RegExp, SubjectLook][] = [
  [/phys/, { Icon: Atom, bg: "#246BCE", fg: "#FFFFFF" }],
  [/chem/, { Icon: FlaskConical, bg: "#168B59", fg: "#FFFFFF" }],
  [/bio|botany|zoology/, { Icon: Leaf, bg: "#0E6B43", fg: "#FFFFFF" }],
  [/math|algebra|geometry|calculus/, { Icon: Sigma, bg: "#14243A", fg: "#FFFFFF" }],
  [/political|civics/, { Icon: Scale, bg: "#087E8B", fg: "#FFFFFF" }], // before "science": Political Science
  [/social|sst/, { Icon: Landmark, bg: "#E5A526", fg: "#1B1B1B" }],
  [/science|evs/, { Icon: Microscope, bg: "#1D4F99", fg: "#FFFFFF" }],
  [/english|hindi|sanskrit|language|grammar|literature/, { Icon: BookOpen, bg: "#A92532", fg: "#FFFFFF" }],
  [/geograph/, { Icon: Mountain, bg: "#0B5E66", fg: "#FFFFFF" }],
  [/econom/, { Icon: TrendingUp, bg: "#8F4A0B", fg: "#FFFFFF" }],
  [/history/, { Icon: Landmark, bg: "#E5A526", fg: "#1B1B1B" }],
  [/gk|general knowledge|current/, { Icon: Globe2, bg: "#E5A526", fg: "#1B1B1B" }],
  [/account|commerce|business|statistics/, { Icon: Calculator, bg: "#14243A", fg: "#FFFFFF" }],
  [/computer|coding|programming|informatics/, { Icon: Code2, bg: "#14243A", fg: "#FFFFFF" }],
];
const DEFAULT: SubjectLook = { Icon: Trophy, bg: "#C93642", fg: "#FFFFFF" };

export function subjectStyle(subject: string | null | undefined): SubjectLook {
  const s = (subject || "").toLowerCase();
  return RULES.find(([re]) => re.test(s))?.[1] ?? DEFAULT;
}

export function SubjectTile({ subject, size = 44, className }: { subject: string | null | undefined; size?: number; className?: string }) {
  const { Icon, bg, fg } = subjectStyle(subject);
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-[10px]", className)}
      style={{ width: size, height: size, background: bg, color: fg }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
