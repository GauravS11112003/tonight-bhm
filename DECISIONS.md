# Decisions

Each entry: what we decided, the alternative we rejected, and why. Newest at the bottom.

## 1. Activation is a rule, not machine learning
**Decided:** "Firehouse opens the day shelter on an extra day" is `lowF < 40 OR alert includes "Heat Advisory"`, stored as data in `data/activation_rules.json` and checked by a pure function (`lib/rules/engine.ts`).
**Rejected:** a classifier that learns when shelters open.
**Why:** the policy already exists in words. An exact rule is right 100% of the time; a learned guess would only approximate it, and nobody could audit it. Every badge on the dashboard prints the sentence that fired it ("Low of 28°F is below 40°F").

## 2. Linear regression, not a neural network
**Decided:** ordinary least squares with five features, solved by hand with the normal equations (`lib/model/ols.ts`, ~40 lines).
**Rejected:** gradient boosting or a neural net.
**Why:** we have two years of nightly numbers at most, and staff must be able to trust and question the forecast. Every weight reads as a sentence ("each °F colder below 50°F adds about 0.6 people"). A black box would not be more accurate on this little data, and it could not be argued with.

## 3. AI only turns the intake note into need chips
**Decided:** Claude reads the free-text note and returns `{ needs: [...] }` validated by Zod. The volunteer confirms or edits every chip. Eligibility and ranking are plain TypeScript (`lib/routing/route.ts`).
**Rejected:** letting the LLM pick the shelter, or forecast demand.
**Why:** an eligibility error sends a woman to a men's shelter in the cold. Rules are auditable and testable; LLM output is not. If the key is missing or the reply fails validation, a keyword match suggests chips and the checkboxes still work.

## 4. Predict per shelter per night, never per person
**Decided:** the model's unit is "people needing a bed at Firehouse tonight". Intake stores no name, date of birth or ID, and nothing about a person is scored.
**Rejected:** individual risk scores (who is likely to need a bed, who is likely to die outside).
**Why:** privacy, and the harm of being wrong about one person. Individual-risk models used on unhoused people (for example in Los Angeles) drew criticism for exactly this. Aggregate demand is what staffing and blankets depend on anyway.

## 5. Simulated history, labeled everywhere
**Decided:** two years of nightly occupancy generated with a fixed seed (205), calibrated so the mean equals Firehouse's real 2025 average (29,509 ÷ 365 ≈ 80.8), capped at 100 beds. Effect directions follow Jadidzadeh & Kneebone (2015). Every chart that uses it says SIMULATED.
**Rejected:** inventing a "real-looking" dataset without saying so; or skipping the model.
**Why:** no public daily counts exist. A labeled simulation proves the pipeline works end to end and lets Firehouse drop in its real counts later with no code change. Note: because nights are capped at 100, the fitted cold weight (~0.6) comes out lower than the simulator's true 0.85. That is honest censoring, and a reason the real data matters.

## 6. Rules override the model, always
**Decided:** rules and model run side by side; the model never feeds into whether a rule fires, and nothing can suppress a fired rule.
**Rejected:** combining them into one score.
**Why:** a low demand forecast must never cancel a warming station on a freezing night.

## 7. Scenario mode is a URL, not app state
**Decided:** `?scenario=arctic` overrides the next three nights (lows 28, 24, 31°F with rain). A full-width banner says "SCENARIO — not the live forecast" on every page while it is on.
**Rejected:** a hidden toggle in local storage.
**Why:** a link can be shared and reloaded during the demo, and it can't silently stay on.

## 8. Hand-written weather normalization
**Decided:** follow `/points` → `forecast` and `forecastHourly` (no hardcoded grid), pair each date's daytime high with that evening's low, attach any alert overlapping 6 p.m.–7 a.m., cache 10 minutes, save a snapshot to `data/cached_forecast.json` and fall back to it with a "cached forecast from …" badge.
**Rejected:** a weather SDK or a paid API.
**Why:** NWS is free, official, and covers Birmingham's own alerts (it is the BMX office). Planning is per night, so the night's low is the number that matters.

## 9. Ranking order
**Decided:** among eligible, open sites: most predicted spare beds first; unknown capacity counts as 0; then an active warming station on a cold night; then number of confirmed needs met.
**Rejected:** a weighted score.
**Why:** a lexicographic order can be said in one sentence to a volunteer. Treating unknown capacity as 0 means we never assume room we can't see.

## 10. Planning formulas
**Decided:** volunteers = ⌈guests ÷ 20⌉ (5 on a usual 81-guest night); blankets = 1.5 × top of the 80% range on nights below 40°F, rounded up to 10; warming cost = nights × 2 stations × $2,500.
**Rejected:** fitting staffing to data we don't have.
**Why:** staff can check these by hand and change the constants in `lib/model/recommend.ts`. The ratios are our assumptions; Firehouse should set the real ones.

## 11. Design: light, flat, one cold hue
**Decided:** DM Sans, an off-white ground tinted toward ice blue, one blue for data and actions, amber only for "a rule fired", red only for spill and freezing. 3D used where it carries data: the particle field's density follows tonight's low; the bed floor fills to tonight's prediction.
**Rejected:** a dark "ops" dashboard with gradients and glows.
**Why:** the dashboard is read at a shelter desk by daylight, and colour should mean something.

## 12. Volunteer app is a mobile web page, not a native app
**Decided:** `/volunteer` is a phone-first page in the same Next.js app, with a staff board at `/team`. Shift need comes straight from the forecast (guests ÷ 20). Data lives in one JSON file behind one API route; the browser polls every few seconds.
**Rejected:** a native iOS/Android app; a database; websockets; user accounts.
**Why:** a volunteer can open a link or scan a code with nothing to install, and it shares the forecast code instead of copying it. A JSON file and polling are enough for one shelter and can be read by hand. Volunteers give a first name or initials only, kept with a random id on their phone, so there are no passwords to manage. Guests are never recorded.

## 13. A "what if" slider, clearly labeled
**Decided:** the dashboard hero lets you drag tonight's low and rain chance. It calls the same `predictNight`, `evaluateAll` and `route` functions as the rest of the app, in the browser, and shows a "WHAT IF — not the forecast" pill until reset.
**Rejected:** a scripted animation of a cold night.
**Why:** it shows the forecast-to-routing link in one gesture without faking a number. The model retrains in the browser from the same seed, so the figures match the server exactly.

## 14. Staff alert by polling
**Decided:** "Activate cold-night plan" writes one alert into the volunteer store; phones pick it up on their next poll (every 4 seconds) and show a full-screen prompt to sign up.
**Rejected:** push notifications or SMS.
**Why:** push needs installed apps and permissions, SMS needs a paid account. Polling works on any phone with the page open, which is enough to prove the loop.
