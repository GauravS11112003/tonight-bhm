# AI log

Honest record of what was AI-assisted. The team fills in the second half.

## What the coding agent (Claude Code, Opus 5.5) generated

Built in one session on 2026-11-14 from the team's written brief.

| Area | Files | Notes |
|---|---|---|
| Scaffold and config | `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.mts`, `postcss.config.mjs` | Pinned TypeScript 5 after TypeScript 7 broke `next dev`. |
| Seed data | `data/sites.json`, `data/activation_rules.json` | From the brief's public sources. Unknown values left `null`. The agent first wrote website URLs for First Light and One Roof, then removed them because the brief gave no source; they show "No public source yet". |
| Weather client | `lib/weather/nws.ts`, `lib/weather/scenario.ts` | Probed the live NWS API first to see the real period and alert shapes. |
| Rules engine | `lib/rules/engine.ts` | |
| Simulation and model | `lib/model/simulate.ts`, `ols.ts`, `forecast.ts`, `recommend.ts` | OLS written by hand (normal equations + Gaussian elimination). Seasonal temperature curve is approximate, not pulled from NOAA files. |
| Routing | `lib/routing/route.ts` | |
| Intake AI | `app/api/extract/route.ts`, `lib/intake/schema.ts` | Uses the Anthropic TypeScript SDK with structured output (`output_config.format`) and Zod validation. Default model `claude-opus-5-5`, low effort; override with `ANTHROPIC_MODEL`. Server-side refusal fallbacks were not enabled, to keep the call simple; any failure drops to keyword matching. |
| UI | `app/*`, `components/*` | Design direction from two skills: Taste (app-screen "accent ladder", DM Sans, no gradients, shadows or eyebrows) and UI/UX Pro Max (Swiss minimal, contrast, reduced motion, stagger motion). three.js for the particle field and the 3D bed floor. |
| Volunteer app and staff board | `app/volunteer`, `app/team`, `components/VolunteerApp.tsx`, `TeamBoard.tsx`, `useVolunteerStore.ts`, `lib/volunteers/*`, `app/api/volunteers` | The team asked for a volunteer mobile app with shift management, requests and resources; the agent chose the screens and wrote the code. First version imported `fs` into browser code and failed to build; fixed by splitting `store.server.ts`. |
| Demo features | `components/LiveHero.tsx`, alert actions in `lib/volunteers/store.ts`, `TeamBoard.tsx`, `VolunteerApp.tsx`, QR in `app/team/page.tsx` | The team asked for memorable demo moments and chose the cold slider and the phone alert from options the agent listed; the agent wrote the code. Wind sound, screen shake and the QR code were the agent's additions. |
| Tests | `tests/core.test.ts` | 14 tests on rules, OLS, simulation, weather normalization, offline fallback, routing and the volunteer store. |
| Docs | `README.md`, `DECISIONS.md`, this file | |

Bugs the agent caught while checking its own work in the browser: keyword fallback used `\b…\b` so "freezing" and "eaten" didn't match; a double period in site summaries.

Claims the agent did **not** verify and the team should before demoing:
- Pathways' address, hours and eligibility (stored as unverified).
- Whether Firehouse offers showers (not listed as a need it meets).
- The staffing ratio (1 volunteer per 20 guests) and blanket ratio are assumptions.

## What the team changed, rejected or rewrote

_Fill this in as you go. Be specific: file, what the AI wrote, what you did instead, why._

- 
- 
- 

## How we used AI on purpose

_Fill in: where you chose to use the agent, where you chose not to, and how you checked its output (tests, reading the code, comparing to the live NWS page)._
