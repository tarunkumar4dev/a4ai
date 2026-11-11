# UI Polish — Before / After

Phase 0 (before) screenshots: `docs/ui/before/`
Phase 1 (after) screenshots: `docs/ui/after/`

Naming: `{viewport}-{theme}-{state}.png`
Viewports: 360×740, 768×1024, 1440×900. Themes: light, dark.

---

## What changed

### 1. Empty state
- **Before**: Sparkles icon, "👋 Namaste", English text, `bg-muted/50` scope pill
- **After**: a4ai logo (`/ICON.ico`), clean "Namaste", no emoji, `bg-muted` scope pill (better dark contrast)
- Compare: `360-light-empty.png`

### 2. Suggestions popup
- **Before**: "Recent" / "Try" section labels, "Clear history" button (English)
- **After**: "Pichhle sawaal" / "Ye poochiye", "History mitao" (Hindi)
- Compare: `360-light-chips.png`

### 3. Error card
- **Before**: "AI service busy hai", English "Retry" button
- **After**: "Service abhi busy hai", "Dobara try karein" button
- Compare: `360-light-error.png`

### 4. Steps timeline
- **Before**: "2 steps · 4.2s" (timing shown)
- **After**: "2 steps" (timing hidden — distracting, not actionable)

### 5. Header
- **Before**: "New chat" button (English)
- **After**: "Naya sawaal" (Hindi)
- Compare: `1440-light-empty.png`

### 6. History panel
- **Before**: "New chat", "Chat history", "Search chats", "Rename", "Delete" (English)
- **After**: "Naya sawaal", "Pichhli chats", "Chats dhoondho", "Naam badlo", "Mitao" (Hindi)

### 7. VoiceDock layout
- **Before**: Mic in a row with mute/settings; the listening text appeared twice
- **After**: One compact row: state text, mute, settings, then a 56px mic at the right edge (thumb side).
  State text is shown once: "Mic dabakar boliye" when idle, "Sun raha hoon…" in red while listening.
  (A first attempt put a 64px mic in its own centered row; at 360px that left the chat almost no room, so it was reverted.)
- Compare: `360-light-mic_idle.png`, `360-light-mic_listening.png`, `360-dark-voice_consent.png`

### 8. Safe area (mobile)
- **Before**: No `viewport-fit=cover`, no bottom safe-area padding
- **After**: `viewport-fit=cover` on `<meta viewport>`, `pb-[env(safe-area-inset-bottom,0px)]` on bottom bar

### 9. DataTable accessibility
- **Before**: Scroll container not keyboard-accessible
- **After**: `tabIndex={0} role="region" aria-label` on scroll container

### 10. Dark mode contrast
- **Before**: Scope summary pill `bg-muted/50` — low contrast in dark mode
- **After**: `bg-muted` — meets 4.5:1 contrast

### 11. Mock scenarios
- **Before**: No blueprint/paper/verification/approval in mock
- **After**: "test banao" scenario produces all four with realistic trigonometry questions + LaTeX math

### 12. Screenshot spec
- **Before**: Falls back when blueprint missing, hardcoded output dir
- **After**: Captures all card states, `AGENT_SHOTS_DIR` env var for output dir

### 13. Chart axis at 360px
- **Before**: long x labels (section or student names) overlapped, so the chart hid most of them
- **After**: tick text is cut to 9 characters with an ellipsis; the tooltip and the screen-reader table keep the full name

### 14. Logo in dark mode
- **Before**: the black a4ai logo was nearly invisible on the dark background
- **After**: white tile behind the logo in dark mode only. Compare `360-dark-empty.png`

### 15. Remaining English labels
- "Clear history" confirm button, New-chat tooltip, shortcuts list now Hindi

### 16. Tests
- Agent e2e specs updated for the Hindi labels (they still clicked "New chat", "Delete", "Chat history")
- New voice screenshots with a faked voice config and Chromium's fake mic: consent, idle, listening.
  The test asserts the mic is at least 56px wide, has an aria-label, and reaches "Sun raha hoon…"
- Pre-existing failure fixed: the history e2e test expected zero network calls, but the voice layer checks its config

---

## Files touched (Phase 1)

| File | Change |
|------|--------|
| `index.html` | `viewport-fit=cover` |
| `src/components/agent/AgentChatPanel.tsx` | `pb-[env(safe-area-inset-bottom)]` |
| `src/components/agent/AgentEmptyState.tsx` | Logo, no emoji, `bg-muted` |
| `src/components/agent/AgentEventBlock.tsx` | Hindi error titles, retry label |
| `src/components/agent/AgentEventBlock.test.ts` | Updated assertion |
| `src/components/agent/AgentHeader.tsx` | Hindi "Naya sawaal" |
| `src/components/agent/AgentHistoryPanel.tsx` | All Hindi labels |
| `src/components/agent/AgentSuggestions.tsx` | Hindi section/clear labels |
| `src/components/agent/AgentWorkspace.tsx` | Hindi history labels |
| `src/components/agent/AskA4aiLauncher.tsx` | Hindi history button |
| `src/components/agent/DataTable.tsx` | Scroll region accessible |
| `src/components/agent/SheetHistory.tsx` | Hindi labels |
| `src/components/agent/blocks.test.ts` | Updated assertion |
| `src/components/voice/VoiceDock.tsx` | Layout restructured |
| `src/lib/agent/chatState.ts` | Timing hidden from stepsSummary |
| `src/lib/agent/chatState.test.ts` | Updated assertion |
| `src/lib/agent/mock.ts` | Full test-banao scenario |
| `tests/e2e/ui-audit-shots.spec.ts` | Env var, all card states, voice states |
| `src/components/agent/AgentChart.tsx` | Short axis labels |
| `src/components/agent/AgentComposer.tsx` | Hindi confirm label |
| `src/components/agent/shortcuts.ts` | Hindi shortcut label |
| `tests/e2e/agent-v2.spec.ts`, `tests/e2e/agent.spec.ts` | Hindi labels, voice config call |
| `playwright.ui-audit.config.ts` | Fake mic launch flags |

---

## Verification

- `tsc --noEmit`: clean (pre-existing errors unchanged)
- `vitest run`: 409/409 pass
- `vite build`: succeeds, AgentChatPanel chunk 75.96 kB gzip
- Playwright screenshots: 6/6 pass (360/768/1440 × light/dark)
