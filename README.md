# Tonight BHM

> We don't wait for the shelter to fill up. We see it coming and route people before the beds run out.

Built at Shipt Hacks, Birmingham ("Build a Better Birmingham"), for Firehouse Ministries and the people who staff Birmingham's front doors on cold nights.

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
- **Cold-night alert** on `/team`: "Activate cold-night plan" sends a full-screen alert to every open volunteer phone. The QR code on that page opens the volunteer app for phones on the same network as the laptop (`npm run dev -- -H 0.0.0.0 -p 3001`, or set `DEMO_URL`).

## Offline

Every live fetch saves `data/cached_forecast.json`. If NWS can't be reached, the app serves that snapshot and the header badge says "Cached forecast from <time>".

## Pages

- `/` Forecast dashboard: tonight's answer, 3D bed floor, 7-night strip with lows, rules, predicted occupancy, range, capacity line and spill; what to prepare; Birmingham facts.
- `/route` Intake → confirm needs → where to go, with excluded sites and why.
- `/volunteer` Mobile app for volunteers: tonight's briefing, sign up for shifts, send requests to staff, tap-to-call resources. Open it on a phone on the same wifi with `npm run dev -- -H 0.0.0.0` and `http://<your-laptop-ip>:3000/volunteer`.
- `/team` Staff board: forecast need vs volunteers signed up for each night, and the request inbox. Updates every few seconds.
- `/about` The formula, every symbol, fitted weights in plain English, backtest error, real vs simulated.

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
- Assumption: warming stations at a low of 32°F or below (the city decides each time).
- Simulated: nightly occupancy history, so the fitted weights and backtest error describe the method, not real-world accuracy.
- Unknown: stored as `null` and shown as "unverified — call".

See `DECISIONS.md` for why, and `AI_LOG.md` for what was AI-generated.
