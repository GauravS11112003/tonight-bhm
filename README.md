# Tonight BHM

> We don't wait for the shelter to fill up. We see it coming and route people before the beds run out.

Built at Shipt Hacks, Birmingham ("Build a Better Birmingham"), for Firehouse Ministries and the people who staff Birmingham's front doors on cold nights.

Tonight BHM is Birmingham's homelessness **coordination hub**, powered by its forecast. It is a layer over the systems that exist, not a replacement: One Roof Coordinated Entry stays the housing path, and findhelp and 2-1-1 stay the program directory. The hub adds four verbs before the cold night: **Understand** (which needs are rising), **Route** (where a person can go tonight), **Notify** (tell staff, warming stations, volunteers and donors early) and **Ask** (turn the forecast into specific requests).

- **Forecast layer** for shelter staff and the city: live NWS forecast, the activation rules shelters already use, predicted Firehouse bed demand for 7 nights with a range, staffing and supplies.
- **Routing layer** for volunteers: a three-step intake (no names), AI-suggested need chips the volunteer confirms, and a ranked list of where to go tonight with the reasons.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
```

Needs Node 20+.

## Environment variables (all optional)

Copy `.env.example` to `.env.local`.

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Turns on Claude for intake notes → need chips. Without it, a keyword match suggests chips and everything else works. |
| `ANTHROPIC_MODEL` | Model for extraction. Default `claude-opus-5-5`. |
| `NWS_CONTACT` | Email put in the NWS `User-Agent` header (NWS asks every client for one). Set it to your team email. |

## Scenario mode

Today's weather may be mild. Click **Demo scenario: arctic front** in the header, or add `?scenario=arctic` to any URL. The next 3 nights become lows of 28, 24 and 31°F with rain. A banner reading **SCENARIO — not the live forecast** stays on every page until you switch it off.

## Live demo features

- **Cold slider** on the dashboard: drag tonight's low (and the chance of rain) to see the beds, rules and routing recompute live. A "WHAT IF — not the forecast" pill shows whenever the sliders differ from the real forecast; click it to reset.
- **Cold-night alert** on `/team` (and tonight's volunteer alert on `/notify`): "Activate cold-night plan" sends a full-screen alert to every open volunteer phone. The QR code on that page opens the volunteer app for phones on the same network as the laptop (`npm run dev -- -H 0.0.0.0 -p 3001`, or set `DEMO_URL`).

## Offline

Every live fetch saves `data/cached_forecast.json`. If NWS can't be reached, the app serves that snapshot and the header badge says "Cached forecast from <time>".

## Pages

- `/` **Hub home.** The 3D map of Birmingham (MapLibre + free OpenFreeMap tiles, needs internet) with the hub floating over it: tonight's low and active activations, one live tile per verb (top rising need, people routed today, alerts queued, open requests) and a "Tonight" strip of which places are open, the room predicted at each and which warming stations are active. Outreach reports are still made here: an area, a head count and needs, rounded to about 300 m, no names, gone after 24 hours.
- `/insights` **Understand.** Aggregate counts of confirmed need tags by day and by need, week-over-week change, and the demand forecast beside them. Groups under 5 show "<5". The 14-day history is SIMULATED; today's column is real.
- `/route` **Route.** Intake → confirm needs → where to go, with excluded sites and why. Reaching the results records one aggregate line (date, need tags, top site id). A volunteer can text the person the recommendation from their own messaging app.
- `/notify` **Notify.** The alert queue on a week rail: one alert per audience per night, each with its trigger rule and forecast numbers. "Send" marks it sent in the app; no SMS is connected.
- `/asks` **Ask.** The needs board: for each flagged night, how many blankets, water bottles, volunteers and meals Firehouse needs, by when and why, drawn as isometric stacks that fill as an ask goes open → pledged → fulfilled. `/asks/public` is the shareable view with no staff notes.
- `/forecast` Forecast dashboard: tonight's answer, 3D bed floor, 7-night strip with lows, rules, predicted occupancy, range, capacity line and spill; what to prepare; Birmingham facts.
- `/volunteer` Mobile app for volunteers: tonight's briefing, sign up for shifts, send requests to staff, tap-to-call resources. Open it on a phone on the same wifi with `npm run dev -- -H 0.0.0.0` and `http://<your-laptop-ip>:3000/volunteer`.
- `/team` Staff board: forecast need vs volunteers signed up for each night, and the request inbox. Updates every few seconds. Its cold-night alert is the same alert as tonight's volunteer alert in `/notify`.
- `/about` The formula, every symbol, fitted weights in plain English, backtest error, real vs simulated, the asks multipliers and small-cell suppression.

A 3-minute path: `/` → switch on **Demo scenario: arctic front** → **Ask** (the board fills; pledge one) → **Notify** (send an alert) → **Route** one person → back to `/` (the tiles have moved).

## Architecture

```
            api.weather.gov  ──►  lib/weather/nws.ts  (points → forecast + hourly + alerts,
                                        │               10-min memo, snapshot fallback)
                     ?scenario=arctic ──┤  lib/weather/scenario.ts
                                        ▼
                               ForecastDay[7]  { date, lowF, highF, precipProb, alerts }
                    ┌───────────────────┼─────────────────────┐
                    ▼                   ▼                     │
   data/activation_rules.json   lib/model/forecast.ts         │
   lib/rules/engine.ts          (OLS fitted on SIMULATED      │
   evaluate(day, rule)           history, lib/model/*)        │
   → { fired, reason }          → B̂, range, spill             │
                    │                   │                     │
                    └─────────┬─────────┘                     │
                              ▼                               │
                  lib/plan.ts  buildWeek()  ──►  /  dashboard  │
                  lib/model/recommend.ts (volunteers, blankets)│
                  lib/asks        → needs board   (formulas)   │
                  lib/notify      → alert queue   (rules)      │
                  lib/insights    → need counts   (aggregates) │
                              │                               │
                              ▼ tonight                       │
   intake note ─► /api/extract (Claude, Zod) ─► chips ─► volunteer confirms
                                                              ▼
              data/sites.json ─► lib/routing/route.ts  route(intake, sites, tonight)
                                 eligibility (rules as data) → open tonight → rank
                                 → passed[], failed[], caveats, spare beds
```

Rules never read the model. The LLM never reads sites or rules.

## Data honesty

- Real: NWS weather and alerts, Firehouse's capacity and 40°F/Heat Advisory policy, Firehouse 2025 totals, the 2024 point-in-time count.
- Assumption: warming stations at a low of 32°F or below (the city decides each time); the asks multipliers (× 1.5 blankets, × 3 water, ÷ 25 volunteers, × 3 meals); alert lead times.
- Simulated: nightly occupancy history, so the fitted weights and backtest error describe the method, not real-world accuracy; and the 14-day intake history on `/insights`.
- Unknown: stored as `null` and shown as "unverified — call".

See `DECISIONS.md` for why, and `AI_LOG.md` for what was AI-generated.
