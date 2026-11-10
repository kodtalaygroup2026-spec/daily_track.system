---
version: 1
slug: "supervisor-html"
primary_target: "supervisor.html"
related_targets: []
---

# Supervisor view (Daily Track)

Mode: Operate. Surface: the supervisor's desktop and tablet screen, task table with a detail drawer, inside the established Enamel Signboard world (DESIGN.md). Clickable prototype in plain HTML/CSS/JS with labelled sample data; changes do not reach technician phones.

Audience and job: one supervisor (หัวหน้า) overseeing 5-10 technicians from a desk or tablet, glancing between other work. First question: who is doing what right now. Actions: create and assign a task, reassign or edit, see photo proof, spot late or stuck tasks. Thai only.

Late rule (defaulted, user confirmed brief): a task is late once its scheduled time has passed while it is not done. Photo: thumbnail that opens larger. Recurring tasks: out of scope. Reassign is done by changing the technician field and saving.

Unresolved: native OS and final stack, real sync with technician phones.

## Direction contract

THESIS: The table is the familiar tool; the world enters as flooded enamel status cells and an ink-flooded late cell. Refuses white rows with small status pills and a grey dashboard shell.

OWN-WORLD: The settled Enamel Signboard system. Ground #EDF0EE, ink #14181B, enamel red #D6261E, yellow #F5B800, green #17713D. Kanit for lettering, Noto Sans Thai for detail. Flat, no shadows. Status is the whole cell flooded plus a non-colour cue (dashed inset for to-do, hazard strip for doing, tick for done) plus a Thai word. Desktop scale keeps three steps: date 2.25rem, title 1.25rem, detail 1rem.

STORY: The supervisor sees today's date, filters by status or technician, reads the flooded status column and ink late cells, opens a row to see place, photo and edit or reassign, and creates and assigns a task from the same drawer.

FIRST VIEWPORT: 1440x900. Top bar with wordmark, date, sample clock and a Create task button. Under it a status filter group with counts and a technician select. Sortable table of about 14 rows with status, time, task with place, technician and photo columns. Right-hand drawer 26rem wide, always present on desktop (empty prompt when nothing is selected), overlay on tablet.

FORM: Task table with detail drawer, the lead structure of the surface roll (seed:90adc5414f5a69b2), user chosen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
