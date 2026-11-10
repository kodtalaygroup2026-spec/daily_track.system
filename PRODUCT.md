# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated to Claude; not yet chosen. The brief suggested React/Next.js + Tailwind CSS with Firebase or Supabase (or Node.js) as candidates. Technician native app: iOS/Android not yet decided (see Capabilities and Constraints).

## Users

- **Technicians (ช่าง / ลูกน้อง):** field workers who check what they must do today and report progress, almost entirely from a phone. They should not need to type much.
- **Supervisor (หัวหน้า):** oversees the technicians from a desktop or tablet. Needs the overview at a glance and creates and assigns tasks.

Confirmed: one supervisor group working with several technicians. Multiple supervisors with separate teams were not confirmed.

## Product Purpose

Daily Track is a daily task reporting system for technicians and their supervisor. Success: a technician opens it and knows immediately what today's work is, and updates a task in 1-2 taps; the supervisor sees immediately which technician is doing which task and how far along it is.

## Positioning

Reporting reduced to "task boxes" (กล่องภารกิจ): each task is one box the technician taps or swipes to progress, with photo attachment instead of typed text. Extremely simple, fast and minimal clicks is the defining claim; no heavy forms or reports.

## Operating Context

- Technicians use mobile phones, mobile-first, in the field.
- The supervisor uses desktop or tablet for the overview.
- Work is organised per day: each technician sees their own boxes for each day.

## Capabilities and Constraints

- Task statuses: To Do, Doing, Done. Colour coding is required: red = not started, yellow = in progress, green = done.
- Technician: personal daily dashboard of task boxes; start a task by tapping its box; finish by tap or swipe; attach a photo when needed; select-or-tap input in preference to typing.
- Supervisor: dashboard showing who is doing what and its status; create tasks and assign them to technicians.
- Interface language: Thai only.
- Platform: supervisor side is web (desktop/tablet). Technician side was first described as mobile-first web, then confirmed as "web + native technician app". The native OS (iOS, Android or both) and whether the mobile-web version also ships are undecided. Recorded platform is `web` until that is settled.
- Data needed (from the brief): users (technicians, supervisor) and tasks; schema not yet designed.

## Brand Commitments

Name: "Daily Track". No logo, voice or identity assets provided.

## Evidence on Hand

Nothing yet: the project folder is empty. No real tasks, technician names, photos, customer data or usage figures exist; future work must not fabricate them.

## Product Principles

1. Minimum effort for the technician: every common action takes 1-2 taps; typing is the exception.
2. Today first: opening the app answers "what do I have to do today?" without navigation.
3. Status is glanceable: the red/yellow/green state of every task is readable instantly, for technician and supervisor alike.
4. The supervisor reads the whole team in one view: who, what, how far.
5. Remove steps rather than add features.
