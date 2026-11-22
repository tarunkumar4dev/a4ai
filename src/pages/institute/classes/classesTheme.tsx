// src/pages/institute/classes/classesTheme.tsx
// Look of the Classes screen and of the Teachers tab (look only — no behaviour). Same design language as the rest of the
// institute dashboard: orange #FF7043 accent, 16–20 px card radius, soft shadows, pill chips; light + dark (.dark-mode on
// .dashboard-root). Subject colours come from src/lib/subjectColors.ts (subjectVars → --s-*), mapped to --t-* by `.csb-s`.
// lite.css switches every transition off by design (Play Store WebView), so nothing here depends on motion.
import React from "react";

const css = `
.csb-root { --c-card:#fff; --c-card2:#F8FAFC; --c-border:#E8ECF3; --c-dash:#CBD5E1; --c-text:#0F172A; --c-muted:#64748B; --c-accent:#FF7043; --c-accent-text:#C2410C;
  color: var(--c-text); }
.dark-mode .csb-root { --c-card:#171D2B; --c-card2:#1B2231; --c-border:#2A3446; --c-dash:#3A465B; --c-text:#E8EDF5; --c-muted:#A3B1C6; --c-accent-text:#FF8A65; }

/* tones: --t-* (light) / --t-*-d (dark) */
.csb-t-orange { --t-fg:#C2410C; --t-bg:#FFF7ED; --t-bd:#FED7AA; --t-fg-d:#FDBA74; --t-bg-d:rgba(194,65,12,.22); --t-bd-d:rgba(194,65,12,.45); }
.csb-t-indigo { --t-fg:#4338CA; --t-bg:#EEF2FF; --t-bd:#C7D2FE; --t-fg-d:#A5B4FC; --t-bg-d:rgba(67,56,202,.24); --t-bd-d:rgba(67,56,202,.5); }
.csb-t-green  { --t-fg:#15803D; --t-bg:#F0FDF4; --t-bd:#BBF7D0; --t-fg-d:#86EFAC; --t-bg-d:rgba(21,128,61,.22); --t-bd-d:rgba(21,128,61,.5); }
.csb-t-amber  { --t-fg:#B45309; --t-bg:#FFFBEB; --t-bd:#FDE68A; --t-fg-d:#FCD34D; --t-bg-d:rgba(180,83,9,.24); --t-bd-d:rgba(180,83,9,.5); }
.csb-t-slate  { --t-fg:#475569; --t-bg:#F1F5F9; --t-bd:#E2E8F0; --t-fg-d:#CBD5E1; --t-bg-d:rgba(100,116,139,.22); --t-bd-d:rgba(100,116,139,.45); }
.csb-s { --t-fg:var(--s-fg); --t-bg:var(--s-bg); --t-bd:var(--s-bd); --t-fg-d:var(--s-fg-d); --t-bg-d:var(--s-bg-d); --t-bd-d:var(--s-bd-d); }

.csb-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:700; line-height:1.35;
  white-space:nowrap; background:var(--t-bg); color:var(--t-fg); border:1px solid var(--t-bd); }
.dark-mode .csb-pill, .dark-mode .csb-avatar, .dark-mode .csb-select { background:var(--t-bg-d); color:var(--t-fg-d); border-color:var(--t-bd-d); }

/* cards */
.csb-card { position:relative; background:var(--c-card); border:1px solid var(--c-border); border-radius:20px; overflow:hidden;
  box-shadow:0 4px 20px rgba(0,0,0,.03); transition:box-shadow .2s ease; }
.csb-card:hover { box-shadow:0 10px 30px rgba(0,0,0,.08); }
.dark-mode .csb-card { box-shadow:0 4px 20px rgba(0,0,0,.25); }
.dark-mode .csb-card:hover { box-shadow:0 10px 30px rgba(0,0,0,.4); }
.csb-card::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#FF7043,#FFA270); }
.csb-head { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; padding:16px 16px 12px;
  background:linear-gradient(120deg, rgba(255,112,67,.13), rgba(92,103,242,.07) 60%, transparent); border-bottom:1px solid var(--c-border); }
.dark-mode .csb-head { background:linear-gradient(120deg, rgba(255,112,67,.18), rgba(92,103,242,.11) 60%, transparent); }
.csb-tile { width:34px; height:34px; border-radius:12px; display:grid; place-items:center; flex:none; color:#fff;
  background:linear-gradient(135deg,#FF7043,#FF9A70); box-shadow:0 6px 14px rgba(255,112,67,.28); }
.csb-title { font-size:17px; font-weight:800; letter-spacing:-.01em; color:var(--c-text); }
.csb-body { padding:6px 12px 14px; }
.csb-hint { font-size:12px; font-weight:500; color:var(--c-muted); }

/* expand / collapse (grid-rows trick; lite.css turns the transition off, the final state is identical) */
.csb-collapse { display:grid; grid-template-rows:1fr; opacity:1; transition:grid-template-rows .25s ease, opacity .2s ease; }
.csb-collapse[data-open="false"] { grid-template-rows:0fr; opacity:0; visibility:hidden; transition:grid-template-rows .25s ease, opacity .2s ease, visibility 0s .25s; }
.csb-collapse > .csb-collapse-inner { overflow:hidden; min-height:0; }
.csb-chev { display:inline-grid; place-items:center; width:26px; height:26px; border-radius:8px; border:0; background:transparent; color:var(--c-muted); cursor:pointer; transition:transform .2s ease, background .15s; }
.csb-chev:hover { background:rgba(100,116,139,.14); color:var(--c-text); }
.csb-chev[data-open="false"] { transform:rotate(-90deg); }

/* subject block: tinted, coloured left border, dot */
.csb-subject { margin-top:10px; border-radius:16px; padding:8px 10px 10px; border:1px solid var(--s-bd); border-left:5px solid var(--s-fg); background:var(--s-bg); }
.dark-mode .csb-subject { border-color:var(--s-bd-d); border-left-color:var(--s-fg-d); background:var(--s-bg-d); }
@supports (background: color-mix(in srgb, red 50%, blue)) {
  .csb-subject { background:color-mix(in srgb, var(--s-bg) 45%, var(--c-card)); }
  .dark-mode .csb-subject { background:color-mix(in srgb, var(--s-bg-d) 55%, transparent); }
}
.csb-dot { width:11px; height:11px; border-radius:50%; flex:none; background:var(--s-fg); box-shadow:0 0 0 3px var(--s-bd); }
.dark-mode .csb-dot { background:var(--s-fg-d); box-shadow:0 0 0 3px var(--s-bd-d); }
.csb-subj-name { font-size:14px; font-weight:800; color:var(--s-fg); }
.dark-mode .csb-subj-name { color:var(--s-fg-d); }

/* batch row */
.csb-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; margin-top:6px; padding:8px 10px; border-radius:12px;
  background:var(--s-bg); border:1px solid var(--s-bd); transition:box-shadow .15s ease, transform .15s ease; }
.dark-mode .csb-row { background:var(--s-bg-d); border-color:var(--s-bd-d); }
.csb-row:hover { box-shadow:0 5px 16px rgba(0,0,0,.08); transform:translateY(-1px); }
.csb-chip { display:inline-flex; align-items:center; padding:3px 12px; border-radius:999px; font-size:13px; font-weight:800; background:var(--c-card);
  color:var(--s-fg); border:1px solid var(--s-bd); }
.dark-mode .csb-chip { color:var(--s-fg-d); border-color:var(--s-bd-d); background:var(--c-card2); }
.csb-chip-muted { font-weight:600; color:var(--c-muted) !important; background:transparent !important; border-style:dashed; }
.csb-grow { flex:1 1 auto; }
.csb-teacher { display:flex; align-items:center; gap:8px; margin-left:auto; }
.csb-avatar { width:26px; height:26px; border-radius:50%; flex:none; display:grid; place-items:center; font-size:10px; font-weight:800;
  background:var(--t-bg); color:var(--t-fg); border:1px solid var(--t-bd); }
.csb-select { font:inherit; font-size:12px; font-weight:700; padding:4px 8px; border-radius:999px; max-width:210px; cursor:pointer; outline:none;
  background:var(--t-bg); color:var(--t-fg); border:1px solid var(--t-bd); transition:border-color .15s, box-shadow .15s; }
.csb-select:hover, .csb-select:focus-visible { border-color:#FF7043; box-shadow:0 0 0 3px rgba(255,112,67,.18); }
.csb-select option, .csb-select optgroup { background:#fff; color:#0F172A; }
.dark-mode .csb-select option, .dark-mode .csb-select optgroup { background:#171D2B; color:#E8EDF5; }
@media (max-width: 640px) {
  .csb-teacher { flex-basis:100%; margin-left:0; }
  .csb-teacher .csb-select { flex:1 1 auto; max-width:none; }
  .csb-head { padding:14px 12px 10px; }
}

/* ghost icon buttons: dim until the row is hovered / focused, always visible on touch */
.csb-icon-btn { width:28px; height:28px; display:inline-grid; place-items:center; flex:none; border:0; border-radius:9px; background:transparent;
  color:var(--c-muted); cursor:pointer; opacity:.72; transition:opacity .15s, background .15s, color .15s; }
.csb-hov:hover .csb-icon-btn, .csb-hov:focus-within .csb-icon-btn, .csb-icon-btn:focus-visible { opacity:1; }
.csb-icon-btn:hover { background:rgba(100,116,139,.16); color:var(--c-text); }
.csb-icon-btn.is-danger:hover, .csb-icon-btn.is-danger:focus-visible { background:rgba(239,68,68,.13); color:#DC2626; }
.dark-mode .csb-icon-btn.is-danger:hover, .dark-mode .csb-icon-btn.is-danger:focus-visible { background:rgba(239,68,68,.22); color:#FCA5A5; }
@media (hover: none) { .csb-icon-btn { opacity:1; } }

/* dashed "+ Add …" */
.csb-add { display:inline-flex; align-items:center; gap:6px; margin-top:8px; padding:6px 12px; border-radius:10px; cursor:pointer;
  border:1.5px dashed var(--c-dash); background:transparent; color:var(--c-muted); font:inherit; font-size:12px; font-weight:700; transition:border-color .15s, color .15s, background .15s; }
.csb-add:hover, .csb-add:focus-visible { border-color:#FF7043; color:var(--c-accent-text); background:rgba(255,112,67,.07); outline:none; }
.csb-add-top { margin-top:0; }
.csb-input { padding:5px 10px; border-radius:10px; width:12rem; max-width:100%; font:inherit; font-size:12px; font-weight:600; outline:none;
  background:var(--c-card); color:var(--c-text); border:1px solid var(--c-dash); }
.csb-input:focus { border-color:#FF7043; box-shadow:0 0 0 3px rgba(255,112,67,.18); }
.csb-link { border:0; background:transparent; padding:4px 8px; border-radius:8px; font:inherit; font-size:11px; font-weight:700; color:var(--c-muted); cursor:pointer; }
.csb-link:hover { background:rgba(100,116,139,.14); color:var(--c-text); }

/* empty + warning boxes */
.csb-empty { border:1.5px dashed var(--c-dash); border-radius:20px; padding:36px 16px; text-align:center; background:var(--c-card); color:var(--c-muted); font-size:14px; font-weight:500; }
.csb-warn { margin-top:12px; padding:10px 12px; border-radius:14px; background:var(--t-bg); border:1px solid var(--t-bd); color:var(--t-fg); }
.dark-mode .csb-warn { background:var(--t-bg-d); border-color:var(--t-bd-d); color:var(--t-fg-d); }
.csb-warn .csb-chip { color:var(--c-text); border-color:var(--c-dash); }
`;

/** Rendered once by each screen (the dashboard injects its own customStyles the same way). */
export const ClassesStyles = () => <style dangerouslySetInnerHTML={{ __html: css }} />;
