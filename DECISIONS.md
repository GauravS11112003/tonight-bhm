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

## 10. Planning formulas (superseded by 18)
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

## 15. Citywide map; reports are areas, never people
**Decided:** the landing page is a 3D map of Birmingham. Volunteers can report people seen outside as an **area**: a head count and needs, with the location rounded to a ~300 m grid before it is stored, no names or photos, shown for 24 hours only.
**Rejected:** a pin per person showing where individuals live or sleep.
**Why:** a map of where specific unhoused people sleep can be used to harass or displace them, and it breaks our own rule of never tracking an individual (decision 4). Outreach teams need to know where to send blankets and a van, which an area and a count answers. Sample reports for demos sit at public landmarks and are labeled SAMPLE.

## 16. MapLibre with OpenFreeMap tiles
**Decided:** MapLibre GL (v4) with OpenFreeMap's free vector tiles; buildings extruded from OpenStreetMap heights. Site coordinates were geocoded once from their street addresses with OpenStreetMap Nominatim and saved in `data/sites.json`; sites with unverified addresses get no pin.
**Rejected:** Mapbox or Google Maps (keys, billing); hand-building a 3D city in three.js.
**Why:** no key, no cost, real building data. Trade-off: the map needs internet; if tiles fail the panels still work. (The original brief said "no maps"; the team reversed that when widening the scope to the whole city.)

## 17. Hub, not front door
**Decided:** Tonight BHM is Birmingham's coordination hub for homelessness response: a layer over the systems that exist. One Roof Coordinated Entry stays the housing path; findhelp and 2-1-1 stay the program directory. The hub adds four verbs around the forecast: Understand (needs insights), Route (unchanged), Notify (alert queue) and Ask (needs board). The home page keeps the 3D city and floats the four verbs and tonight's places over it.
**Rejected:** replacing those systems, or calling the product "the front door".
**Why:** duplicating the system of record helps no one. A second intake or a second directory would split the data and the trust. What nobody has yet is foresight: knowing on Saturday what Tuesday night will need.

## 18. Asks are formulas, not AI
**Decided:** every request on the needs board is the shelter's predicted people for a flagged night times a fixed multiplier (`lib/asks`): blankets = people × 1.5 on nights below 40°F; water = people × 3 on Heat Advisory days; volunteers = ⌈people ÷ 25⌉; meals = people × 3. "People" is the model's expected demand including anyone beyond capacity. A night is flagged when an activation rule fires or the forecast passes capacity. Only Firehouse has a forecast, so only Firehouse gets asks.
**Rejected:** letting an LLM write or size requests; guessing quantities for sites with no forecast.
**Why:** auditable. A shelter director can check "104 people × 1.5 = 156 blankets" by hand and correct the multiplier. The multipliers are our assumptions and the board says so on every card.
**This replaces decision 10's ratios.** The first build used volunteers = ⌈guests ÷ 20⌉ and blankets = 1.5 × the top of the range, rounded up to 10. The team's hub spec set ÷ 25 and × 1.5 exactly (100 people → 150 blankets, 4 volunteers). `lib/model/recommend.ts` now calls `lib/asks`, so the forecast table, the volunteer screens and the needs board show one number, not two. A usual 81-guest night now needs 4 volunteers, not 5. Warming cost is unchanged.

## 19. Alerts are rules, one per audience per night
**Decided:** the notify queue (`lib/notify/alerts.ts`) is built from fired activation rules, forecast spills and open asks. Each alert names its trigger and the forecast numbers behind it; several triggers on one night merge into one alert per audience. Audiences are shelter staff, warming-station operators, volunteers and donors. "Send" marks the alert sent in the app; no SMS leaves it. The staff board's "Activate cold-night plan" sends the same queued volunteer alert rather than a second one.
**Rejected:** AI-written alerts; texting people experiencing homelessness from a stored number.
**Why:** an alert that moves staff and money must be traceable to a rule. And we store no guest phone numbers, by design: a volunteer may text a person their own recommendation once from the routing screen, through the volunteer's own messaging app, so the number never touches this app. Lead times (donors two days ahead, volunteers the day before, staff the evening before) are assumptions.

## 20. Small-cell suppression on insights
**Decided:** the insights page shows aggregate counts of confirmed need tags. Any group with fewer than 5 intakes displays as "<5", its week-over-week change is not calculated, and the exact number is removed on the server before the page is sent. A routing records one line: the date, the confirmed need tags and the top site id. No note, age, gender, device id or time of day. `/api/intakes` returns a count only.
**Rejected:** a table of intakes; exact small counts; storing the intake form.
**Why:** "2 people needed medical help on Tuesday at one shelter" can identify someone. A total cannot. One exception, stated plainly: the hub's "people routed today" is a single running total with no breakdown, shown exactly so volunteers can see their work count.
**Honesty note:** the 14 days of intake history are SIMULATED (seed 311) and labeled wherever they appear; only today's routings are real.
