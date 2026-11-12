# UI Audit — a4ai Agent, 11 Nov 2026

Screenshots in `docs/ui/before/` at 360×740 (mobile), 768×1024 (tablet), 1440×900 (desktop), light + dark.

## Severity scale

- **P0** — Blocks first use or loses trust on first visit
- **P1** — Hurts usability on every session
- **P2** — Noticeable but tolerable
- **P3** — Polish / cosmetic

---

## P0 — Blocks first use or trust

### 1. Empty state uses a Sparkles icon, not the a4ai logo
**Screenshot:** `360-light-empty.png`, `1440-light-empty.png`

The greeting "Namaste, Priya 👋" uses a purple `AgentMark` (Sparkles icon), not the a4ai logo. A first-time user has no visual connection to the product brand. The 👋 emoji adds visual noise.

### 2. No mic visible anywhere in the mock build
**Screenshot:** `360-light-mic_not_visible.png`, `1440-light-sheet.png`

The VoiceDock renders `null` when `config?.enabled` is false. In the mock build there is no voice config endpoint, so the mic never appears. The voice dock sits ABOVE the composer (right-aligned row of mute, settings, mic) — spec wants the mic BESIDE the text box as the primary control.

### 3. Blueprint, paper_preview, verification, and approval cards are not in the mock
**Screenshot:** `360-light-blueprint_missing.png`

The "Class 10 trigonometry test banao" query falls through to a generic text response. These states cannot be visually audited from the mock alone. They exist in the contract fixtures and render via `AgentEventBlock`, but need mock scenarios to appear in e2e.

---

## P1 — Hurts usability every session

### 4. Mic + text box layout — mic is not beside the text input
**Code:** `VoiceDock.tsx`, `AgentChatPanel.tsx:182`

The VoiceDock renders a separate row above the composer: `[mute] [settings] [mic]` right-aligned. Spec requires the mic to be the biggest, primary control beside the text box, with the text box secondary.

### 5. Empty state example chips are role-specific but generic
**Screenshot:** `360-light-empty.png`

The chips are "ECE-1 ki attendance / Is mahine", "ECE-2 ki attendance / Is mahine", "Class 10 trigonometry test banao", "75% se kam wale students". Spec wants role-aware examples: admin should see "Aaj ki attendance", "Sabse kam attendance wali class"; teacher should see "Class 10 trigonometry test banao".

### 6. Input area partially hidden behind keyboard on small phones
**Screenshot:** `360-light-stat_card.png`

At 360px the composer sits at the very bottom. On a real phone with the keyboard open, the input would be pushed behind the keyboard unless the viewport is adjusted. There is no `safe-area-inset-bottom` handling visible.

### 7. No skeleton / loading state visible
**Screenshot:** all states

Messages appear abruptly. When the mock delay is short, the thinking indicator shows briefly, but there is no skeleton loader for cards or content.

---

## P2 — Noticeable but tolerable

### 8. Table does not scroll horizontally inside the card at 360px
**Screenshot:** `360-light-table_chart.png`

The ranking table shows # / CLASS / % but the "CLASSES HELD" and "MARKED" columns are not visible — the table fits because they happen to be narrow, but wider tables will clip. There is no `overflow-x-auto` wrapper.

### 9. Chart x-axis labels clipped at 360px
**Screenshot:** `360-light-table_chart.png`

The bar chart at 360px clips the bottom axis labels (ECE-1, ECE-2, ECE-3 are partially visible). The chart area is too tall relative to the available height.

### 10. Dark mode: empty state contrast
**Screenshot:** `360-dark-empty.png`, `1440-dark-empty.png`

The "Namaste, Priya" heading and body text contrast is adequate, but the scope summary pill ("Aapke paas: 3 batches · 59 students") uses `bg-muted/50` which in dark mode has low contrast. The suggestion card borders are barely visible.

### 11. Voice consent (VoiceConsent.tsx) and first-use flow never shown
Not screenshotted — requires voice config mock. The consent component exists and shows example chips + "Theek hai" button, but was never triggered in these tests.

### 12. "CBSE test" in the greeting — not all users are CBSE
**Screenshot:** `360-light-empty.png`

The greeting text says "Attendance, marks ya naya CBSE test — seedha poochiye." This assumes CBSE board. Should be board-neutral or adapted to the institute's board.

### 13. User message bubble has a bright orange/red pill at 360px
**Screenshot:** `360-light-stat_card.png`

The user's message "attendance" appears as a bright orange-red rounded pill. On desktop (1440px) it looks fine, but at 360px it is the most attention-grabbing element on the screen, pulling focus from the answer.

---

## P3 — Polish / cosmetic

### 14. "Demo data" badge always visible
**Screenshot:** all states

The "Demo data" green dot + "Demo data" text is always shown in the header. This is correct in dev mode but should be verified it doesn't appear in production.

### 15. Suggestions panel uses English labels mixed with Hindi
**Screenshot:** `360-light-chips.png`

The suggestions list shows "TRY" section label in English. History items use "× Clear history" in English. The spec asks for simple Hindi/English text throughout.

### 16. Steps timeline shows milliseconds
**Screenshot:** `360-light-error.png`, `360-light-clarify.png`

"1 step · 333ms" and "1 step · 369ms" — technical detail a teacher does not need. Should be hidden or simplified.

### 17. "Which one?" clarify text is half English
**Screenshot:** `360-light-clarify.png`

"Kaun sa? / Which one?" mixes Hindi and English redundantly. Pick one.

### 18. Error card uses technical language
**Screenshot:** `360-light-error.png`

"AI service abhi busy hai" uses the word "AI" and the title says "AI service busy hai". Spec says no "AI" word.

### 19. Chat title in header shows raw query text
**Screenshot:** `360-light-stat_card.png`

The header shows the full query "attendance" as the chat title. Works fine for short queries, but will truncate badly for long Hindi queries.

### 20. Footer text differs between mobile and desktop
**Screenshot:** `360-light-empty.png` vs `1440-light-empty.png`

Mobile shows "Numbers sirf aapke institute ke data se". Desktop shows "Enter = bhejo · Shift+Enter = nayi line · ↑↓ suggestions" on the left and the same disclaimer on the right. Consistent but could be cleaner.

---

## Not captured (need mock extensions or real backend)

| State | Why not captured |
|---|---|
| blueprint | Mock has no scenario for it |
| paper_preview (with maths) | Mock has no scenario for it |
| verification_summary | Mock has no scenario for it |
| pending_approval | Mock has no scenario for it |
| mic idle / listening / transcribing / thinking / speaking | Voice config returns `enabled: false` in mock; no Sarvam key |
| mic permission denied | Cannot programmatically deny mic in headless Chromium |
| first-use consent | Voice not enabled |
| offline | Would need to simulate network disconnect after load |

---

## Summary

The agent UI is functional and well-structured. The biggest gaps for the spec's goal ("premium, one-handed on 360px, calm and obvious") are:

1. **No a4ai logo** in the empty state — brand disconnect
2. **Mic not beside the text box** — voice is secondary when it should be primary
3. **No emoji removal** — the 👋 needs to go
4. **No safe-area / keyboard handling** on mobile
5. **Table and chart overflow** at 360px
6. **"AI" word appears** in the error card
7. **Steps timing visible** — technical noise
8. **Blueprint/paper/verification/approval** states untested (need mock scenarios added)
9. **Voice states** completely untested (need voice config mock)
