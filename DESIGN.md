---
name: Daily Track (Technician view)
description: Thai hand-painted signboard enamel; every task is a freshly painted sign flooded red, yellow or green.
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
---

# Design System: Daily Track (Technician view)

## Overview

**Creative North Star: "The Enamel Signboard"**

Hand-painted Thai shop and truck signboard enamel on a cool concrete-white ground. Each task is a sign that floods fully red, yellow or green; a state change wipes the next coat across it. The system refuses white cards with small status pills. It is flat, loud and legible in bright outdoor light, one-handed, with gloves.

Density is low and the targets are large: three to six full-width boxes on a single 30rem column. Lettering is Kanit, detail is Noto Sans Thai, and the whole hierarchy is three steps (date, task title, detail).

**Key Characteristics:**
- Full-box colour floods, never tinted cards or pills.
- State is never colour alone: dashed inner outline (to-do), hazard band plus thick ink ring (doing), tick plus struck title (done), each with a Thai state word.
- Flat. No shadows anywhere.
- Large touch targets (3.5rem and up), 4px ink focus ring.

## Colors

A three-colour enamel palette on a cool ground, with one ink for everything else.

### Primary
- **Enamel Red** (`colors.enamel-red`): to-do box flood. White text on it.
- **Enamel Yellow** (`colors.enamel-yellow`): doing box flood, swipe thumb, toast action, progress "doing" segment, text selection. Ink text only.
- **Enamel Green** (`colors.enamel-green`): done box flood, swipe fill, progress "done" segment, all-done banner. White text.

### Neutral
- **Signboard Ink** (`colors.ink`): text on yellow and ground, 4px doing ring, hazard stripe, swipe track, toast, net-status bar, focus outline.
- **Concrete Ground** (`colors.ground`): page background.
- **Quiet Ink** (`colors.quiet-ink`): secondary text on ground (name, count, empty-state body, footer note).
- **White** (`colors.white`): text on red, green and ink; progress-segment unfilled fill.

### Named Rules
**The Full Flood Rule.** Status colour covers the whole box; it is never a pill, dot or left border.
**The Never Colour Alone Rule.** Every state carries a second, non-colour signal and a Thai word.

## Typography

**Display Font:** Kanit (Noto Sans Thai, sans-serif fallback)
**Body Font:** Noto Sans Thai (system-ui fallback)

**Character:** Kanit gives sign-painter lettering for anything the eye must catch; Noto Sans Thai keeps small detail readable.

### Hierarchy
- **Display** (700, 3.5rem, 1): the Thai date.
- **Title** (700, 1.5rem, 1.25; weekday at 500, lineHeight 1.2): task titles, weekday, empty and all-done headings.
- **Body** (500, 1.0625rem, 1.4): detail, meta, count, toast text; tabular numerals on counts and meta.
- **Label** (700, 1rem Kanit; 600 on the photo button; 700 1.1875rem on the swipe label): state words, buttons.

### Named Rules
**The Three Steps Rule.** Date, task title, detail. Do not add a fourth size for headings or captions.

## Layout

Single column, max-width 30rem, centred, 1rem side padding, 7rem bottom padding plus safe-area inset to clear the toast. Boxes are stacked in a grid with 0.75rem gap. The progress strip is one segment per task with 0.375rem gaps. Mobile-first; there is no wider breakpoint. Heights: done box min 5rem, to-do min 5.75rem, doing tallest (band, body, tools, 4rem track).

## Elevation & Depth

Flat. No shadows. Depth is conveyed only by colour flood, the 4px ink ring on the doing box, and the fixed ink toast.

### Named Rules
**The Flat Enamel Rule.** No box-shadow. Emphasis comes from ring, band and colour.

## Shapes

Soft sign-board corners: 14px on boxes and toast, 12px on the net bar and photo button, 10px on thumbnails and toast action, full pill (2rem) on the swipe track, circle on the thumb. The to-do box has an inset 2px dashed outline (white at 80%, 6px inset, 9px radius). The doing box has a 4px ink border and a 0.875rem hazard band of 135-degree ink and yellow stripes (0.5rem each). Done titles are struck through at 0.1em.

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

## Do's and Don'ts

### Do:
- **Do** flood the whole box with the state colour and add the non-colour signal (dashed outline, hazard band and ink ring, tick and strike).
- **Do** use white text on red and green, ink text on yellow.
- **Do** keep targets at least 3.5rem and focus rings at 4px ink (white on coloured fills).
- **Do** keep copy in Thai.

### Don't:
- **Don't** use white cards with small status pills.
- **Don't** add shadows, gradients (other than the hazard stripe) or tinted pastel states.
- **Don't** add a fourth type size or a decorative display face.
- **Don't** show state by colour alone.

## Open and not canonized

- Fonts are self-hosted in `fonts/` (Kanit 500/600/700 and Noto Sans Thai 500/700, Thai and Latin subsets, woff2, SIL Open Font License 1.1), declared in `fonts.css`.
- Native OS and final stack for the technician app are undecided.
- The supervisor view is a separate, unbuilt surface; nothing here defines it.
