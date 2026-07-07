# Quran Live Arabic UX Audit

Audited live app: https://quran-frontend-three.vercel.app/  
Date: 2026-07-01  
Method: Playwright Chromium, Arabic locale `ar-MA`, screenshots at 1440/1024/768/390/360, flow probes, keyboard traversal, refresh/offline/API-failure probes, resource timing.

No production code was modified.

## Screenshots

### Required Viewports

- Desktop 1440: `test-results/quran-live-ux/desktop-1440-initial.png`
- Laptop 1024: `test-results/quran-live-ux/laptop-1024-initial.png`
- Tablet 768: `test-results/quran-live-ux/tablet-768-initial.png`
- Mobile 390: `test-results/quran-live-ux/mobile-390-initial.png`
- Mobile 360: `test-results/quran-live-ux/mobile-360-initial.png`

### Main Flow Captures

- Initial landing: `test-results/quran-live-ux/deep-00-initial-visible.png`
- ورد يومي selected: `test-results/quran-live-ux/deep-01-daily-mode.png`
- Reciter selected: `test-results/quran-live-ux/deep-02-reciter-selected.png`
- Surah selection: `test-results/quran-live-ux/deep-03-surah-step.png`
- Ayah range: `test-results/quran-live-ux/deep-05-ayah-step.png`
- Playback/reading screen: `test-results/quran-live-ux/deep-08-after-play.png`
- API failure probe: `test-results/quran-live-ux/api-failure-mobile-390.png`
- Keyboard focus sample: `test-results/quran-live-ux/desktop-keyboard-focus.png`

## Executive Summary

The visual direction is strong: the first screen feels calm, respectful, and Quran-oriented, with appropriate Arabic typography, restrained color, and a spiritual tone. The app is much closer to a مصحف companion than a technical selector once the user enters a session.

The biggest problems are structural and interaction-related:

- The landing overlay does not hide the underlying app from DOM, screenshots, focus, or likely screen readers.
- Mobile and tablet layouts leak underlying controls beneath the first screen, making the first impression feel broken.
- Many selectable items are `div`/`span` controls instead of semantic buttons, causing keyboard and testability problems.
- The audio player overlays Quran text on the reading screen.
- Error/offline states exist partly, but are often hidden behind the first-screen overlay or unavailable on reload.

## P0 Issues

No P0 data-loss or complete-blocker issue was found in the tested live flow.

## P1 Issues

### P1: Landing overlay does not isolate underlying app

Evidence:

- Initial DOM text contains the full app behind the landing choice cards: progress, hizb map, recent sessions, reciter grid, and next button.
- Initial mobile screenshots show the underlying “التالي | اختر السورة” control visible behind the third card.
- Keyboard traversal reaches hidden/offscreen app controls before the user has chosen a mode. One sampled focus box was outside the 1440 viewport (`x: 1441`) and focused progress/history content.

Impact:

- Screen-reader users may hear content that is visually unavailable.
- Keyboard users can tab into hidden state.
- Mobile users see broken layering and lose trust immediately.

Recommendation:

- Render either the landing screen or the app shell, not both interactively.
- If the shell must remain mounted, apply `inert` and `aria-hidden="true"` to background content while the mode picker is active.
- Prevent pointer/focus access to background controls.

### P1: Mobile landing layout leaks controls and feels visually broken

Evidence:

- `mobile-390-initial.png` and `mobile-360-initial.png` show a partially visible background panel and disabled/hidden next button under the “قراءة حرة” card.
- On tablet 768, a large hidden panel is visible under the three choice cards.

Impact:

- First screen does not feel polished on common phone widths.
- Arabic Muslim user sees a calm Quranic intro disrupted by technical stepper remnants.

Recommendation:

- Make landing screen a true standalone first view with `min-height: 100dvh`, no app-shell bleed, and controlled footer positioning.
- Test 360/390/768 widths with full-page and viewport screenshots.

### P1: Selectable reciters/surahs/ayahs are not consistently semantic controls

Evidence:

- Playwright detected reciter and surah rows as `div`/`span` controls with text and focus behavior.
- Clicking visible surah text for “الفاتحة” timed out because text resolved inside a non-clickable span; fallback clicked “البقرة”.
- Keyboard focus lands on div-based cards.

Impact:

- Keyboard and screen-reader interaction is fragile.
- E2E tests become brittle because visual text is not aligned with actionable elements.
- Users may not receive correct state announcements like selected reciter/surah.

Recommendation:

- Convert all actionable cards/rows to real `<button>` elements or add correct `role="button"`, `tabIndex=0`, Enter/Space handlers, and accessible selected state.
- Use `aria-pressed` or `aria-current="step"` where appropriate.
- Give each row a stable accessible name: `اختيار سورة الفاتحة، ٧ آيات، مكية`.

### P1: Audio player overlays Quran text

Evidence:

- `deep-08-after-play.png` shows the sticky audio player floating across the Quran text, covering the reading area.

Impact:

- Quran reading is obstructed.
- On smaller screens this will likely be more disruptive.

Recommendation:

- Reserve bottom padding/scroll margin equal to the player height.
- Dock player at bottom of viewport or bottom of reading panel without covering ayat.
- Add a compact/mobile variant with clear play/pause, current ayah, speed, repeat, and close/minimize.

### P1: Offline reload has no app-shell fallback

Evidence:

- Offline reload produced `net::ERR_INTERNET_DISCONNECTED`.
- There is no service-worker/app shell fallback for previously visited content.

Impact:

- A Quran companion should degrade gracefully, especially for reading saved state or recent progress.

Recommendation:

- Add offline shell caching for static UI.
- Show Arabic offline state: `أنت غير متصل بالإنترنت. يمكنك متابعة آخر جلسة محفوظة عند توفرها.`
- Persist selected session state locally.

## P2 Issues

### P2: Arabic wording is good but some labels are less Quran-native

Findings:

- “مُصحف الصوت” is warm and clear.
- “ورد يومي” is excellent and native.
- “حفظ” on the card is shorter than the requested mental model “حفظ ومراجعة”; the subtitle helps, but the primary label under-represents review.
- “قراءة حرة” is understandable, but “استمع بحرية بلا تتبع” frames it technically around tracking rather than intention.
- “يمكنك تغيير الوضع في أي وقت من الشريط العلوي” feels like product UI instruction rather than a calm Quran companion.

Recommendations:

- Rename card primary label to `حفظ ومراجعة`.
- Consider `تلاوة حرة` or `استماع وقراءة` depending on actual behavior.
- Replace technical instruction copy with softer contextual copy, or remove it after mode selection is obvious.

### P2: Icon direction and affordance ambiguity

Findings:

- Cards show a small `<` chevron at the bottom. In RTL this can be interpreted as forward, but visually it is too subtle and not clearly tied to action.
- The stepper uses separators like `‹` between stages. It is visually elegant but can read as previous-direction arrows.

Recommendations:

- Use explicit RTL-aware chevrons and labels only where they add clarity.
- Prefer clear button text on the card itself or a stronger visual selected/enter affordance.

### P2: Mixed English metadata in Quran context

Evidence:

- Surah rows include English translations: `The Opener`, `The Cow`, etc.

Impact:

- For Arabic Muslim users, English subtitles may feel less native and add noise.

Recommendation:

- Make English optional or secondary behind an info toggle.
- Default to Arabic metadata: مكية/مدنية، عدد الآيات، الجزء/الحزب.

### P2: Progress/history is visible too early

Evidence:

- Before mode selection, DOM and full-page screenshots include history, statistics, and hizb map.

Impact:

- The first screen asks for intention, but the hidden state already includes technical progress data.

Recommendation:

- Do not mount progress/history until after mode choice, or hide it semantically and visually.

### P2: Small controls below 44px

Evidence:

- Several controls are 28x28 or 26x26, including an unlabeled button and full-screen button.

Impact:

- Poor mobile tap targets.
- Hard to use for older users or users during prayer/reading contexts.

Recommendation:

- Minimum 44x44px hit target for all icon buttons.
- Add visible focus and accessible labels.

## Arabic UX Assessment

### What Works

- Strong calm first impression on desktop.
- Basmalah and title create an appropriate spiritual frame.
- Dark, quiet palette works for night listening/reading.
- The flow concept is natural: intention -> reciter -> surah/hizb -> ayah range -> listening/reading.
- Reciter cards with portraits and country/style metadata are useful.
- Hizb progress concept is valuable for ورد and حفظ.

### What Does Not Work Yet

- Mobile first screen is not clean because background app controls leak through.
- The app sometimes feels like a staged selector rather than a guided Quran companion because progress/history and technical controls are present too early.
- “حفظ” should communicate review more explicitly.
- The audio player obstructs the Quran text, which is especially sensitive in this domain.
- Empty/error states are functional but hidden or disconnected from the first-screen experience.

## Accessibility Findings

### Keyboard

- Focus states exist visually: gold outline was captured.
- Focus order is problematic because hidden/offscreen app content is reachable from the initial landing state.
- Selectable cards/rows are often divs/spans, not semantic buttons.

### Labels and Semantics

- Theme button has a useful label: `التبديل إلى المظهر الفاتح`.
- At least one 28x28 button has no accessible text.
- Reciter and surah items need stronger accessible names and selected state.
- Search input uses placeholder text; it needs a persistent label.

### Dynamic Announcements

- Playback screen includes one `aria-live="polite"` region, but it was empty in the captured state.
- No useful announcement was observed for selected reciter, selected surah, ayah range, playback status, or progress saved.

### Contrast

- Main gold text on dark background is readable.
- Secondary muted gold/gray text is visually low contrast in several places, especially footer text, helper copy, disabled buttons, and card subtitles.

## Responsive/Mobile Findings

- 390 and 360 widths stack the three mode cards correctly, but the page reveals underlying app controls below the stack.
- Cards are large enough for touch, but small icon buttons are not.
- The footer is visible before the app flow is complete and adds visual noise on mobile.
- Tablet 768 keeps a three-column card layout; it fits, but a two-column or stacked layout may feel calmer and reduce crowding.
- Playback screen needs a dedicated mobile audit after fixing semantic flow; current desktop capture already shows overlay risk.

## Reliability Findings

### Loading

- Initial load completed in about 1s in the tested environment.
- No obvious loading skeleton was captured for backend-dependent panels.

### API Failure

Blocked calls:

- `/history`
- `/notes`
- `/recitations`
- `/surahs`
- `/ahzab`

Observed state:

- App showed `تعذّر تحميل قائمة القراء تحقق من اتصالك بالإنترنت ثم أعد المحاولة`.
- Progress fell back to `٠ حزب مكتمل`, `٠٪`, `٠ جلسة`.
- Error content was mostly hidden below the initial landing overlay on mobile, so the user may not see the recovery action.

Recommendation:

- Surface API failure in the active visible context.
- Avoid showing zero progress as if true when backend failed; distinguish “لا يوجد سجل” from “تعذّر تحميل السجل”.

### Audio Failure

- Playback UI uses a custom player; no native `<audio>` element was present in the DOM capture.
- A targeted audio failure probe could not validate a visible playback error because the app did not expose direct audio requests before completing the flow.

Recommendation:

- Add explicit audio error UI and tests: `تعذّر تشغيل التلاوة. حاول مرة أخرى أو اختر قارئًا آخر.`
- Announce audio errors via `aria-live`.

### Refresh and Persistence

- `localStorage` persisted `quran.prefs.v1`, including theme, speed, repeat settings, and `lastReciter`.
- After selecting a reciter, `lastReciter` persisted.
- No durable local progress state was observed from the tested playback path.

Recommendation:

- Persist active session draft: mode, reciter, surah/hizb, ayah range, current ayah/time.
- On refresh, offer `متابعة آخر جلسة`.

## Performance Findings

Initial navigation:

- Duration: ~998ms
- DOMContentLoaded: ~643ms
- Load: ~998ms

Largest early resources were reciter portraits:

- Multiple `/reciters/*.png` images loaded around 53-79KB each.
- Many portraits load up front, even before the user chooses a mode.
- Backend fetches for history, notes, recitations, surahs, and ahzab start on initial page load.

Recommendations:

- Lazy-load reciter portraits after mode selection.
- Defer history/hizb/progress calls until visible or needed.
- Use responsive image sizing and modern formats if possible.
- Keep Quran font loading, but reduce duplicate Google font families if unused.

## Recommended Implementation Tasks for Claude Code

1. Fix landing isolation:
   - Render only landing until a mode is selected, or apply `inert`/`aria-hidden` to the background app.
   - Ensure hidden controls are not focusable or visible in mobile full-page screenshots.

2. Repair mobile first screen:
   - Remove leaked underlying stepper/card panel.
   - Re-test 360, 390, 768, 1024, 1440 screenshots.

3. Make controls semantic:
   - Convert reciter cards, surah rows, ayah range options, hizb cells, and ayah spans that are clickable into proper buttons.
   - Add accessible labels, selected states, and keyboard Enter/Space behavior.

4. Fix flow selection reliability:
   - Make clicking the visible surah row select that exact surah.
   - Add stable selectors or accessible names for tests.

5. Fix playback layout:
   - Prevent the audio player from covering Quran text.
   - Add reserved bottom space and mobile-safe docking.

6. Add dynamic accessibility:
   - Use `aria-live="polite"` for reciter selected, surah selected, range selected, playback started/paused, ayah changed, and progress saved.
   - Make the current ayah programmatically identifiable.

7. Improve error states:
   - Separate empty progress from failed progress loading.
   - Show visible retry states for reciters, surahs, history, hizb map, and audio failure.
   - Add offline shell fallback or at least a graceful offline page.

8. Improve Arabic UX copy:
   - Change `حفظ` to `حفظ ومراجعة`.
   - Reduce technical helper copy on the landing screen.
   - Make English surah translations optional or secondary.

9. Performance cleanup:
   - Defer hidden panels and backend calls until after mode selection.
   - Lazy-load reciter images.
   - Audit duplicate font imports.

10. Add E2E coverage:
   - Landing isolation and no hidden focus.
   - Mode choice -> reciter -> surah -> ayah -> playback.
   - API failure visible retry.
   - Offline reload.
   - Mobile screenshot diff at 360/390/768.

## Final Claude Code Implementation Prompt

```text
Act as a senior frontend engineer on this Quran app. Implement fixes from reports/quran-live-ux-audit.md without changing the core visual direction.

Priorities:
1. Fix the landing mode picker so the underlying app is neither visible nor focusable before a mode is selected. Use conditional rendering or inert/aria-hidden. Verify mobile 360/390 and tablet 768 no longer show leaked stepper/panel controls.
2. Convert all actionable reciter cards, surah rows, ayah range choices, hizb cells, and clickable ayah items to semantic accessible controls with stable names, keyboard support, selected state, and visible focus.
3. Fix the main flow: ورد يومي / حفظ ومراجعة / قراءة حرة -> القارئ -> السورة/الحزب -> الآيات -> الاستماع. Clicking visible “الفاتحة” must select الفاتحة, not a child span or neighboring row.
4. Fix playback layout so the sticky audio player never covers Quran text on desktop, tablet, or mobile. Add reserved space and a compact mobile-safe player.
5. Add visible Arabic error and retry states for backend failures, audio failures, and offline/slow network. Distinguish true empty progress from failed loading.
6. Add aria-live announcements for selection changes, playback state, ayah changes, and saved progress.
7. Improve Arabic copy: change “حفظ” to “حفظ ومراجعة”, reduce technical helper text, and make English surah names optional/secondary.
8. Defer hidden backend fetches and lazy-load reciter portraits until the related UI is visible.

Add Playwright tests for the critical flows and responsive screenshots at 1440, 1024, 768, 390, and 360. Do not redesign the app; keep the calm Quranic visual language.
```
