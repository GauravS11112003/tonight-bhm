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
| City map | `app/page.tsx`, `components/CityMap.tsx`, area reports in `lib/volunteers/store.ts` | The team asked for a 3D Birmingham map with pins for where homeless people are reported. The agent changed that to area-level reports (rounded, no names, 24 h) for safety and said so; the team should confirm they agree. MapLibre v5 failed to load under Next, so v4 is used. |
| Tests | `tests/core.test.ts` | 15 tests on rules, OLS, simulation, weather normalization, offline fallback, routing and the volunteer store. |
| Docs | `README.md`, `DECISIONS.md`, this file | |

Bugs the agent caught while checking its own work in the browser: keyword fallback used `\b…\b` so "freezing" and "eaten" didn't match; a double period in site summaries.

Claims the agent did **not** verify and the team should before demoing:
- Pathways' address, hours and eligibility (stored as unverified).
- Whether Firehouse offers showers (not listed as a need it meets).
- The staffing ratio (1 volunteer per 20 guests) and blanket ratio are assumptions.

## Coordination hub update (Claude Code, Fable 5.2), 2026-11-14

Built in one session on its own branch from the team's written hub spec. The framing (hub, four verbs, the formulas, the hard rules) is the team's; the agent wrote the code and chose the screens' design.

| Area | Files | Notes |
|---|---|---|
| Asks | `lib/asks/index.ts`, `components/AsksBoard.tsx`, `IsoStack.tsx`, `AskFormulas.tsx`, `app/asks`, `app/asks/public`, `app/api/asks` | Spec formulas exactly. The agent chose: "people" = predicted + spill; a night is flagged when a rule fires or the forecast spills; only Firehouse gets asks because only it has a forecast; ask status lives in the volunteer store keyed by a stable id; the public page talks to its own API that returns statuses only. Isometric stacks are plain SVG, one block = a fixed number of units. |
| One set of numbers | `lib/model/recommend.ts`, copy in `app/forecast`, `TeamBoard.tsx`, `VolunteerApp.tsx` | `planNight` now calls `lib/asks`, so volunteers are ÷ 25 and blankets × 1.5 everywhere (decision 18). This changes numbers the first build showed. |
| Notify | `lib/notify/alerts.ts`, `components/NotifyQueue.tsx`, `app/notify`, `sendAlert` in `lib/volunteers/store.ts`, `TeamBoard.tsx` | Audience mapping, message templates and lead times are the agent's choices and are labeled assumptions. No SMS: no Twilio keys were present. |
| Insights | `lib/insights/*`, `app/insights`, `app/api/intakes`, recording in `components/RouteFlow.tsx` | Simulated 14-day history (seed 311) with warmth made to rise, so the "rising need" is a property of the simulation. Suppression happens in `summarize` on the server. |
| Hub home | `app/page.tsx`, `components/CityMap.tsx`, `HubTiles.tsx`, `lib/hub.ts`, `components/Nav.tsx` | Kept the 3D map as the base. On phones the map becomes a block in a scrolling page. Nav now lists the four verbs. |
| Text a recommendation | `components/RouteFlow.tsx` | An `sms:` link that opens the volunteer's own messaging app; the number never enters this app. |
| Tests | `tests/hub.test.ts` | 5 tests: asks quantities, mild night, confidential site, one alert per audience per night, "<5". |
| Docs | `README.md`, `DECISIONS.md` 17–20, this section | |

Not verified by the agent, for the team to check before demoing:
- The multipliers (1.5, 3, 25, 3) and the alert lead times are assumptions.
- No domestic-violence shelter is in `data/sites.json`. The `confidentialLocation` flag hides such a site from the map, the tonight strip, alert recipients and the public board, and is tested, but no real site uses it yet.
- "findhelp" is named as a directory in UI copy on the team's instruction; the agent did not check it.
- Left out: Twilio SMS, the One Roof weekly summary and Spanish strings (all stretch).

## What the team changed, rejected or rewrote

_Fill this in as you go. Be specific: file, what the AI wrote, what you did instead, why._

- 
- 
- 

## How we used AI on purpose

_Fill in: where you chose to use the agent, where you chose not to, and how you checked its output (tests, reading the code, comparing to the live NWS page)._
