---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Technician view (Daily Track)

Mode: Operate. Surface: the technician's mobile screen showing today's task boxes. Clickable prototype in plain HTML/CSS/JS with labelled sample data, no backend.

Audience and job: field technicians (ช่าง), outdoors in bright light, gloves, one-handed, sometimes offline. They must know today's work at once, start a task with one tap, finish with one swipe, optionally attach a photo. Thai only. Typical 3-6 tasks per day. Finish can be undone for a few seconds; later changes go through the supervisor.

Unresolved: native OS for the technician app, final stack, supervisor view (separate surface).

## Direction contract

THESIS: Every task is a freshly painted sign. The whole box floods red, yellow or green, and a state change wipes the next coat across it. Refuses the category default of white cards with small status pills.

OWN-WORLD: Hand-painted Thai shop and truck signboard enamel on a cool concrete-white ground (#EDF0EE, ink #14181B). Enamel red #D6261E, yellow #F5B800, green #17713D as full-box floods. Kanit for lettering, Noto Sans Thai for detail. One strict three-step scale (date, task title, detail). Flat, no shadows. State is never colour alone: to-do has a dashed inner outline, doing has a hazard-stripe band and thick ink ring, done has a tick and struck title, each plus a Thai word.

STORY: The technician opens it and sees today's date, how many are done, and the boxes. They tap a red box to start it, swipe the thumb across the doing box to finish, and can undo for a few seconds.

FIRST VIEWPORT: Phone width 390. Small wordmark and name bar, then the Thai date at 56px with weekday at right, a five-segment progress strip with a count, then full-width boxes: the done box short, the doing box tallest with photo button and a 64px swipe track, remaining to-do boxes at least 92px. Only the doing box carries the thick ring and swipe track.

FORM: Enamel Signboard, candidate 7 of my own grounded list (assigned by the roll, chosen by the user). seed:330dd28d0d17be3f

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
