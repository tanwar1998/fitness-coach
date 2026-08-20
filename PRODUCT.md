# Product


## Platform

web

## Users

Self-guided fitness beginners: people who want a quick, guided way to generate workouts, look up correct exercise form, and track progress without a personal trainer. They may be new to the gym and need approachable, scaled options.

## Product Purpose

FitCoach is an all-in-one, free fitness tool. It lets a user generate a personalized workout, browse a library of exercises with video demonstrations, track progress against goals, and consult an AI coach about workouts, nutrition, and recovery — in one place, no login or trainer required.

## Positioning

A free, self-serve fitness companion: personalized workout generation plus a real exercise/video library, progress tracking, and an AI coach all in one tool, accessible to a true beginner.

## Operating Context

Used on desktop and mobile web. Core flows: generate a workout (exercise page), browse exercises and filter by category/equipment/muscle, watch exercise demonstration videos (video page), set and track goals (progress page), chat with the AI coach (ai-coach page), and read a disclaimer (disclaimer page). Dark and light modes are both supported.

## Capabilities and Constraints

- Workout generator / exercise library with search and filters (category, equipment, muscle).
- Video library with search, master-detail player, and infinite scroll.
- Goal tracker (name, current value, target value, training days per week).
- AI coach chat with saved sessions.
- All exercise and video data comes from the public wger.de API; do not fabricate exercise data.
- Next.js (App Router) + React + Tailwind CSS v4 + TypeScript.
- Existing routes and features must keep working; this is a visual restyle only.

## Brand Commitments

- Name: FitCoach. Logo: a star/spark glyph in a rounded primary square.
- Keep the violet-based identity, dark/light mode, and all current routes and pages.
- Restyle only — do not change functionality, copy meaning, or data source.

## Evidence on Hand

- Real exercise/video data available via the wger.de API (no local dataset to invent from).
- Existing pages and components carry the incumbent visual implementation.

## Product Principles

- A beginner must always know what to do next without guesswork.
- Keep everything free and accessible with no account barrier.
- Trust the real exercise data; never invent fitness claims.
- Every surface stays approachable and calm while feeling distinctive.
- Preserve working behavior across restyle.

## Accessibility & Inclusion

- Support both light and dark mode with sufficient contrast.
- Maintain keyboard focus states and semantic structure.