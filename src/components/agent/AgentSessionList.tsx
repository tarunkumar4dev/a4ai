// Past chats: this device's history merged with GET /agent/sessions. Rename and Delete act on this device only
// (a deleted server session is hidden here, the server copy is untouched).
import { useState, type KeyboardEvent } from "react";
import { MessageSquare, MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatListItem } from "@/lib/agent/store";
import { shortWhen } from "./format";

const DAY = 86_400_000;
function groupLabel(ms: number, now: number): string {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (ms >= start.getTime()) return "Aaj";
  if (ms >= start.getTime() - 6 * DAY) return "Pichhle 7 din";
  return "Purane";
}

function Row({ item, active, disabled, onOpen, onRename, onDelete }: {
  item: ChatListItem; active: boolean; disabled: boolean;
  onOpen: () => void; onRename: (t: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [title, setTitle] = useState(item.title);

  if (editing) {
    const done = (save: boolean) => { if (save && title.trim()) onRename(title); setEditing(false); };
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") { e.preventDefault(); done(true); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
    };
    return (
      <li className="px-1 py-0.5">
        <label className="sr-only" htmlFor={`rename-${item.key}`}>Chat ka naam</label>
        <input id={`rename-${item.key}`} autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKey} onBlur={() => done(true)}
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </li>
    );
  }
  if (confirm) {
    return (
      <li className="rounded-md border border-border bg-muted/50 px-2 py-2 text-xs">
        <p className="text-foreground">Is device se hata dein?</p>
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" onClick={onDelete} className="h-9 rounded-md bg-destructive px-3 font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Delete</button>
          <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-md px-3 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel</button>
        </div>
      </li>
    );
  }
  return (
    <li className={`group relative flex items-center rounded-md ${active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
      <button type="button" onClick={onOpen} disabled={disabled && !active} aria-current={active ? "true" : undefined}
        title={item.remoteOnly ? `${item.title} (history server par, is device par nahi)` : item.title}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md py-1.5 pl-2.5 pr-9 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
        <span className={`block truncate text-sm ${active ? "font-medium" : "text-foreground"}`}>{item.title}</span>
        <span className="block text-[11px] text-muted-foreground">{shortWhen(item.updatedAt)}</span>
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`${item.title} — options`}
            className="absolute right-0.5 grid h-10 w-9 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[240] w-44">
          {!item.remoteOnly ? (
            <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => { setTitle(item.title); setEditing(true); }}><Pencil aria-hidden="true" className="h-4 w-4" />Rename</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="min-h-10 gap-2 text-destructive focus:text-destructive dark:text-red-400" onSelect={() => setConfirm(true)}><Trash2 aria-hidden="true" className="h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function AgentSessionList({ items, activeKey, busy, onOpen, onNew, onRename, onDelete }: {
  items: ChatListItem[]; activeKey: string; busy: boolean;
  onOpen: (key: string) => void; onNew: () => void; onRename: (key: string, title: string) => void; onDelete: (key: string) => void;
}) {
  const now = Date.now();
  const groups: { label: string; items: ChatListItem[] }[] = [];
  for (const it of items) {
    const label = groupLabel(it.updatedAt, now);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(it); else groups.push({ label, items: [it] });
  }
  return (
    <nav aria-label="Pichhli chats" className="flex h-full min-h-0 flex-col" data-testid="agent-sessions">
      <div className="p-3">
        <button type="button" onClick={onNew}
          className="flex h-11 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SquarePen aria-hidden="true" className="h-4 w-4" />New chat
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <MessageSquare aria-hidden="true" className="h-5 w-5" />
            Aapki chats yahan dikhengi.
          </div>
        ) : groups.map((g) => (
          <div key={g.label} className="mb-2">
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <Row key={it.key} item={it} active={it.key === activeKey} disabled={busy}
                  onOpen={() => onOpen(it.key)} onRename={(t) => onRename(it.key, t)} onDelete={() => onDelete(it.key)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-border px-4 py-2.5 text-[11px] leading-4 text-muted-foreground">History sirf is device par save hoti hai. Sign out karne par mit jaati hai.</p>
    </nav>
  );
}
