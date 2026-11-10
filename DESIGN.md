---
name: Daily Track
description: Thai hand-painted signboard enamel; every task is a freshly painted sign (technician) or a flooded status cell (supervisor) in red, yellow or green.
colors:
  ink: "#14181B"
  ground: "#EDF0EE"
  quiet-ink: "#3F4945"
  enamel-red: "#D6261E"
  enamel-yellow: "#F5B800"
  enamel-green: "#17713D"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Kanit, Noto Sans Thai, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Kanit, Noto Sans Thai, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Kanit, Noto Sans Thai, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
  supervisor-date:
    fontFamily: "Kanit, Noto Sans Thai, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
  supervisor-title:
    fontFamily: "Kanit, Noto Sans Thai, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  supervisor-detail:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  pill: "2rem"
spacing:
  xs: "0.25rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  pad: "clamp(1rem, 2.2vw, 2rem)"
  drawer: "26rem"
components:
  box-todo:
    backgroundColor: "{colors.enamel-red}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "1.1rem 1.25rem"
    height: "5.75rem"
  box-doing:
    backgroundColor: "{colors.enamel-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0.875rem 1rem 1rem"
  box-done:
    backgroundColor: "{colors.enamel-green}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "1rem 1.25rem"
    height: "5rem"
  button-photo:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 1.1rem"
    height: "3.5rem"
  swipe-track:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.enamel-yellow}"
    rounded: "{rounded.pill}"
    height: "4rem"
  swipe-thumb:
    backgroundColor: "{colors.enamel-yellow}"
    textColor: "{colors.ink}"
    rounded: "50%"
    size: "3.5rem"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.5rem 0.5rem 1.1rem"
    height: "4rem"
  toast-action:
    backgroundColor: "{colors.enamel-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 1.25rem"
    height: "3.5rem"
  cell-status-todo:
    backgroundColor: "{colors.enamel-red}"
    textColor: "{colors.white}"
    height: "4.25rem"
    padding: "0 1rem"
  cell-status-doing:
    backgroundColor: "{colors.enamel-yellow}"
    textColor: "{colors.ink}"
    height: "4.25rem"
    padding: "0 1rem"
  cell-status-done:
    backgroundColor: "{colors.enamel-green}"
    textColor: "{colors.white}"
    height: "4.25rem"
    padding: "0 1rem"
  cell-late:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.enamel-yellow}"
    height: "4.25rem"
    padding: "0 1rem"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 1.5rem"
    height: "3.5rem"
  button-primary-active:
    backgroundColor: "{colors.quiet-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 1.5rem"
    height: "3.5rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 0.875rem"
    height: "2.75rem"
  filter-segment:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    padding: "0 1.1rem"
    height: "3.25rem"
  filter-segment-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "3.25rem"
  field-disabled:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.quiet-ink}"
  quick-pick:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 0.875rem"
    height: "2.75rem"
  table-wrap:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
  drawer:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
    width: "26rem"
  status-block:
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "3rem"
    padding: "0 1rem"
  toast-supervisor:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "1rem 1.5rem"
---

# Design System: Daily Track

## Overview

**Creative North Star: "The Enamel Signboard"**

Hand-painted Thai shop and truck signboard enamel on a cool concrete-white ground. Each task is a sign that floods fully red, yellow or green; a state change wipes the next coat across it. The system refuses white cards with small status pills. It is flat, loud and legible in bright outdoor light, one-handed, with gloves.

Two surfaces share this one world. The **technician view** is a phone: density is low and the targets are large, three to six full-width boxes on a single 30rem column. The **supervisor view** is a desktop and tablet screen: a sortable task table beside a detail drawer, for one supervisor overseeing several technicians. The table is the familiar tool; the world enters as flooded status cells and an ink-flooded late cell, not as white rows with small pills. Lettering is Kanit, detail is Noto Sans Thai, and each surface's hierarchy is three steps (date, task title, detail).

**Key Characteristics:**
- Full-box colour floods, never tinted cards or pills.
- State is never colour alone: dashed inner outline (to-do), hazard band plus thick ink ring (doing), tick plus struck title (done), each with a Thai state word.
- Flat. No shadows anywhere.
- Large touch targets (3.5rem and up on the phone; 3.25rem fields and filters, 3.5rem primary actions on the supervisor surface), 4px ink focus ring on both.
- The supervisor table floods the status cell, not the row; late is a flooded ink cell, never a pill.

## Colors

A three-colour enamel palette on a cool ground, with one ink for everything else.

### Primary
- **Enamel Red** (`colors.enamel-red`): to-do box flood; supervisor to-do status cell and drawer status block; field error text. White text on flood.
- **Enamel Yellow** (`colors.enamel-yellow`): doing box flood, supervisor doing status cell and drawer status block, swipe thumb, toast action, progress "doing" segment, text selection. Ink text only.
- **Enamel Green** (`colors.enamel-green`): done box flood, supervisor done status cell and drawer status block, swipe fill, progress "done" segment, all-done banner. White text.

### Neutral
- **Signboard Ink** (`colors.ink`): text on yellow and ground, 4px doing ring, hazard stripe, swipe track, toast, net-status bar, focus outline; on the supervisor surface also the pressed filter segment, primary button, 2px borders, table header rule, late cell flood, lightbox backdrop (at 70%).
- **Concrete Ground** (`colors.ground`): page background; on the supervisor surface also table header fill, selected row, row separators, disabled-field fill, and the quick-pick press.
- **Quiet Ink** (`colors.quiet-ink`): secondary text on ground (name, count, empty-state body, footer note); on the supervisor surface also the pressed state of the primary button, the clock, place text, disabled field text and the sample-data note.
- **White** (`colors.white`): text on red, green and ink; progress-segment unfilled fill; on the supervisor surface the table wrap, drawer, dialog, fields and filter segments.

### Named Rules
**The Full Flood Rule.** Status colour covers the whole box; it is never a pill, dot or left border.
**The Never Colour Alone Rule.** Every state carries a second, non-colour signal and a Thai word.
**The Full Flood Table Rule.** The Full Flood rule applied to a table: the whole status cell (`td.s`) is flooded and carries its cue and Thai word. Cues: red has an inset 2px dashed white outline, yellow a 0.5rem ink hazard strip along the top, green a tick. A late task floods its time cell ink with yellow text and a Thai late-duration line. Late is never a pill, dot or text colour on white. Row hover and selection tint (ground) skip the flooded cells.

## Typography

**Display Font:** Kanit (Noto Sans Thai, sans-serif fallback)
**Body Font:** Noto Sans Thai (system-ui fallback)

**Character:** Kanit gives sign-painter lettering for anything the eye must catch; Noto Sans Thai keeps small detail readable.

### Hierarchy
- **Display** (700, 3.5rem, 1): the Thai date.
- **Title** (700, 1.5rem, 1.25; weekday at 500, lineHeight 1.2): task titles, weekday, empty and all-done headings.
- **Body** (500, 1.0625rem, 1.4): detail, meta, count, toast text; tabular numerals on counts and meta.
- **Label** (700, 1rem Kanit; 600 on the photo button; 700 1.1875rem on the swipe label): state words, buttons.

Supervisor surface (desktop, `supervisor.css`) runs a smaller three-step scale, same families and weights:
- **Date** (700, 2.25rem, 1, Kanit): the Thai date in the top bar.
- **Title** (700, 1.25rem, 1.25): wordmark, task-title buttons in the table, drawer heading, empty-state heading.
- **Detail** (500, 1rem, 1.4): body, place, meta; errors and toast at 700. Labels, buttons, table headers, state words and field labels are Kanit 700 at 1rem (600 on quick-picks). Tabular numerals on time, counts and table cells.

### Named Rules
**The Three Steps Rule.** Date, task title, detail. Do not add a fourth size for headings or captions. The rule holds per surface: technician 3.5rem / 1.5rem / 1.0625rem, supervisor 2.25rem / 1.25rem / 1rem. Never mix the two scales on one surface.

## Layout

Single column, max-width 30rem, centred, 1rem side padding, 7rem bottom padding plus safe-area inset to clear the toast. Boxes are stacked in a grid with 0.75rem gap. The progress strip is one segment per task with 0.375rem gaps. Mobile-first; the technician view has no wider breakpoint. Heights: done box min 5rem, to-do min 5.75rem, doing tallest (band, body, tools, 4rem track).

**Supervisor surface.** A two-column grid: the main column (`minmax(0, 1fr)`) and a 26rem drawer column, 1.5rem gap, `--pad` side padding (`clamp(1rem, 2.2vw, 2rem)`), 1.25rem top and 3rem bottom. The top bar is a wrapping flex row (min-height 4.5rem, 2px ink bottom rule) with wordmark, date, sample clock and the create button pushed right. Under it a tools row holds the filter group and the technician select (right). Table rows are 4.25rem tall with 1rem cell padding; fixed column widths for status and time (9.5rem), technician (11rem, 9rem on tablet), photo (6rem). Breakpoints: at 1099px and below the grid collapses to one column and the drawer becomes a fixed full-height right panel (min(26rem, 100%), 2px left border, no radius) with a 3rem close button, opened over the table; at 699px and below the photo column is hidden. At 1100px and above the drawer is sticky (top 1rem, `max-height: calc(100vh - 2rem)`, scrolls inside) and always present, showing an empty prompt when no row is selected.

## Elevation & Depth

Flat. No shadows. Depth is conveyed only by colour flood, the 4px ink ring on the doing box, and the fixed ink toast. On the supervisor surface the drawer and dialog are separated by a 2px ink border; the tablet drawer overlays the table, and the dialog sits over a 70% ink backdrop, with no shadow.

### Named Rules
**The Flat Enamel Rule.** No box-shadow. Emphasis comes from ring, band and colour.

## Shapes

Soft sign-board corners: 14px on boxes and toast, 12px on the net bar and photo button, 10px on thumbnails and toast action, full pill (2rem) on the swipe track, circle on the thumb. Supervisor surface: 14px on the table wrap, drawer, dialog and toast; 12px on fields, primary and secondary buttons, filter group, status block, close button and photo preview; 10px on ghost buttons, quick-picks, row thumbnails, dialog image and the to-do cell's dashed outline (inset 5px). Borders are 2px ink throughout; an errored field goes to 4px. The to-do box has an inset 2px dashed outline (white at 80%, 6px inset, 9px radius). The doing box has a 4px ink border and a 0.875rem hazard band of 135-degree ink and yellow stripes (0.5rem each). Done titles are struck through at 0.1em.

## Components

### Task box
Three states share one shell (overflow hidden, 14px radius). **To-do**: red, dashed inner outline, whole box is the start button (press darkens by 12% black). **Doing**: yellow, ink ring, hazard band, state word, photo button, swipe track. **Done**: green, tick, struck title. State change plays a 0.45s wipe (`cubic-bezier(.16,1,.3,1)`) of the previous colour sliding off to the right; reduced motion disables it.

### Swipe track
Ink pill, 4rem tall, yellow Kanit label, yellow 3.5rem thumb with chevron, green fill grows behind the thumb while dragging. Keyboard: Enter finishes. Focus ring on thumb is 3px white.

### Photo button
Outlined (2px ink), transparent, 3.5rem tall, 12px radius, camera icon; thumbnail 3.5rem square, 10px radius, 2px ink border.

### Progress strip
Segments 0.875rem tall, 2px ink border, white when to-do, yellow when doing, green when done.

### Toast and net bar
Ink bar, white text, 14px (toast) or 12px (net) radius; toast action is a yellow button for undo. Offline icon on the net bar.

### Icons
Four inline SVG symbols (check, chevron, camera, offline) drawn with currentColor strokes of 2.4 to 3 units, rounded joins, 1.5rem.

### Supervisor surface components

**Status cell and late cell.** See the Full Flood Table Rule. The cell text is Kanit 700 1rem; the done cell leads with a tick icon. A late time cell shows the scheduled time with a nowrap late-duration line beneath (Kanit 700 1rem, yellow on ink). Done rows strike the task title at 0.1em.

**Filter group.** A segmented control: ink background, 2px gap between buttons, 2px ink border, 12px radius, buttons 3.25rem tall, white with ink text and counts in tabular numerals. The pressed button (`aria-pressed="true"`) floods ink with white text. Focus ring is yellow inside a pressed button, ink inside an unpressed one, inset by 6px.

**Table.** White wrap with 2px ink border and 14px radius, scrolls horizontally when narrow. Header cells are ground-filled with a 2px ink rule below; each sortable header is a full-width button (3rem tall, Kanit 700) with a direction icon and `aria-sort` set to ascending, descending or none. Rows are fully clickable; hover tints non-flooded cells `#F6F8F7`; the selected row sets non-flooded cells to ground and underlines the task title (0.12em). Row separators are 2px ground. Task cell: title button (Kanit 700 1.25rem) over place in quiet ink.

**Buttons.** Primary: ink fill, white text, 3.5rem, 12px radius, Kanit 700, press goes quiet ink. Secondary: transparent, 2px ink border, 3.5rem, 12px. Ghost: transparent, 2px ink border, 2.75rem, 10px, used for the sample-clock +30 step. Text buttons in the note are underlined, 2.75rem tall.

**Fields.** Text, time and select controls are 3.25rem tall, white, 2px ink border, 12px radius, weight 500, full width in the drawer, label above in Kanit 700. Disabled: ground fill, quiet-ink text, dashed border, not-allowed cursor. Error: 4px border plus a bold red message under the field (`role="alert"`). Quick-pick buttons (2.75rem, white, 2px ink, 10px, Kanit 600) wrap in a row under the title field in create mode only.

**Drawer.** White panel, 2px ink border, 14px radius, 1.25rem padding. Header holds the 1.25rem title and quiet-ink sub line; the close button (3rem, 2px ink, 12px) shows only at tablet width and below. Contents: a status block (3rem tall flood in the status colour, 12px radius, Kanit 700, same colours and text rules as the table cell), fields, photo preview (9rem tall, 2px ink border, 12px; dashed when no photo), a lock note for read-only cases, and an action row (primary fills, secondary beside it). Reassignment is done by changing the technician field and saving.

**Lightbox.** Native dialog, min(92vw, 48rem), 2px ink border, 14px radius, white; image contained up to 70vh on a ground fill, a caption, and a primary close button.

**Toast.** Fixed, bottom-centre, ink with white bold text, 14px radius, max min(92vw, 34rem). The live region (`role="status"`, `aria-live="polite"`) is always rendered and toggles visibility with a 0.15s linear opacity fade.

## Do's and Don'ts

### Do:
- **Do** flood the whole box with the state colour and add the non-colour signal (dashed outline, hazard band and ink ring, tick and strike).
- **Do** use white text on red and green, ink text on yellow.
- **Do** keep targets at least 3.5rem and focus rings at 4px ink (white on coloured fills).
- **Do** keep copy in Thai.
- **Do** flood the whole status cell in the table, and the whole time cell in ink for late tasks.
- **Do** keep the three-step scale within each surface (technician 3.5 / 1.5 / 1.0625rem, supervisor 2.25 / 1.25 / 1rem).
- **Do** use 2px ink borders, 12px radius on controls, 14px on containers, and let errors thicken the border to 4px.

### Don't:
- **Don't** use white cards with small status pills.
- **Don't** add shadows, gradients (other than the hazard stripe) or tinted pastel states.
- **Don't** add a fourth type size or a decorative display face.
- **Don't** show state by colour alone.
- **Don't** render supervisor status or lateness as a pill, dot, coloured text on a white row, or left border.
- **Don't** carry technician sizes onto the supervisor surface or the reverse.

## Open and not canonized

- Fonts are self-hosted in `fonts/` (Kanit 500/600/700 and Noto Sans Thai 500/700, Thai and Latin subsets, woff2, SIL Open Font License 1.1), declared in `fonts.css`.
- Native OS and final stack are undecided for both surfaces.
- The supervisor view is a clickable prototype on sample data (frozen sample clock 11:20, +30 step); real sync with technician phones does not exist.
- The late rule (late once the scheduled time passes while not done) and reassign-by-editing the technician field are defaults confirmed by the user in the brief.
- Supervisor tokens are duplicated in `supervisor.css` on purpose so the technician files stay untouched; there is no shared token file yet.
- Contrast ratios were not measured for any pair, including red error text on white.
- Build details not canonized: the one-off row hover tint (`#F6F8F7`) is outside the palette; `.x` close button is declared twice in the CSS (hidden, then shown at tablet width); the sort direction span has no style of its own.
