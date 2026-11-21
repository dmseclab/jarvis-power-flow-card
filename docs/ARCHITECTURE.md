# JARVIS Power Flow architecture

## v0.2.0-alpha cinematic milestone

A standalone **read-only** Lovelace JavaScript custom element. SVG is drawn in a 1120×515 logical viewBox and scales with its container. The component owns its internal padding, responsive gutters, status banner, power paths and daily counters.

### Visual zones

- Header and 4 compact live-system status panels
- Animated solar-to-inverter and inverter-to-home paths when source values exceed configured threshold
- Central inverter hero artwork and side solar, battery, house and grid nodes
- Bottom daily solar/home/grid import/export metrics and diagnostics footer
- Narrow-screen 2-column status and daily metric grids
- Motion reduced for accessibility

### Data and integrity

- Uses Home Assistant `hass.states`, with configurable entity IDs.
- `sensor.ss_load_power` represents home demand; do **not** reuse signed `sensor.ss_inverter_power` as house consumption.
- Unknown/unavailable numeric sources show a dash, not fabricated zero.
- Battery state of charge is clipped to 0–100 solely for the display fill.
- **Grid direction remains disabled by default.** On 20 Nov 2026 the operator confirmed positive battery power (+6.85 kW, +132.7 A) corresponded to battery discharge supplying home load. For this installation use `battery_positive_is_discharge: true`. Never assume the same sign convention for other installations. `grid_positive_is_import` remains unset until a measured import/export state is checked.
- Card never invokes Home Assistant services or inverter controls.
- Current SVG DOM rerenders on each HA update: streamline later if performance/animation jitter appears.

### Release policy

Development branch only until Home Assistant browser screenshots, responsive sizing, source comparisons, and polarity tests pass. Keep the original Sunsynk diagram intact. HACS installs default branch `main`, so this milestone is **not yet an HACS update**.

## Net flow logic (active main testing)

- Solar generating → solar to inverter animated; zero or unavailable → inactive.
- Battery positive and `battery_positive_is_discharge: true` → battery to inverter; negative → inverter to battery.
- Grid sign unconfirmed → grid animation suppressed, power reading retained.
- After observation confirms grid positive = import: `grid_positive_is_import: true`; positive grid value animates grid to inverter, negative inverter to grid. Set `false` if measured convention is opposite.
- Inverter to house animates when independently measured home demand is positive.
- Grid to battery is visualized through **grid → inverter → battery** when grid importing and battery charging; this does not claim grid is the exclusive battery source.
- No source-to-house allocation is calculated or claimed. Physical flows may include losses or unmetered branches.

## Active working process

Per operator instruction, `main` is the active HACS test branch until v1 acceptance. Once v1 is approved, freeze main for validated releases and use development for new features. Validate with Github CI and real Home Assistant screenshots before marking stable.

## v0.3.0-alpha: command-centre presentation

The card now renders four integrated intelligence modules below the SVG power-flow stage:
1. **Battery Intelligence:** actual SOC circular gauge, battery power, voltage, current and confirmed charge/discharge state.
2. **Solar Intelligence:** separate measured PV1/PV2 power, total power and daily yield. The visual solar bar has a **display-only 10 kW scale**, not a claimed equipment rating; its purpose is decorative context, not an efficiency KPI.
3. **Grid Management:** measured grid CT and daily import/export; direction remains explicitly unverified until polarity is measured.
4. **Home & Diagnostics:** actual home power, inverter status, battery/grid modes and today's consumption.

The outer HUD uses its own card padding and responsive CSS at 1050 and 650 px breakpoints. No forecast or historical plot is invented when source data is absent. All values come from existing entity mappings and no control services are called.

**Operator acceptance pending:** check HACS redownload, desktop/mobile layout, source values, circular SOC dial, and normal charging/import transitions. Keep `main` as alpha working branch until v1 approval.

## v0.5.0-alpha: independent grid connection & data sanity

- An optional binary sensor `grid_connected` (mapped to `binary_sensor.ss_grid_connected` for this Sunsynk installation) reports **CONNECTED / DISCONNECTED / UNKNOWN** independently of signed grid CT power. A connected idle grid is not described as importing.
- A nonblocking `batteryPlausibility` comparison checks absolute battery power against absolute voltage × current when all three sources are numeric and sufficiently large. An advisory `CHECK P / V / I` is shown when the mismatch exceeds the display heuristic. It is **not** a hardware alarm, and it does not substitute/reconstruct power values, calculate new energy totals, or change the charging direction.
- Because inverter sensor definitions, sampling times and sign conventions may differ, this advisory requires manual comparison with raw Sunsynk entities before any conclusion.
- Numerical presence and approximate plausibility are separate indicators. The existing `ALL CHANNELS PRESENT` label only means numeric inputs were returned.
- No Home Assistant service calls, inverter control, schedule modification or backend integration are included.

## v0.6.0-alpha: cinematic history and enhanced energy command scene

- Builds on the existing read-only inverter, solar, grid, battery and home net-flow channels. The inverter has additional illuminated instrumentation and the four lower intelligence panels remain.
- Adds **10 / ENERGY HISTORY · LAST 24 HOURS** using Home Assistant's authenticated `history/period` API through the already authenticated frontend `hass.callApi`. No separate token, backend service, or third-party network connection.
- Recorder query is bounded to five configured power sensors (PV1, PV2, home demand, grid CT and battery). A default refresh interval of **15 minutes** is enforced with a minimum of five minutes. It is not queried on every live state update.
- `show_history: false` disables history requests/visualization; `history_refresh_minutes: 15` customizes refresh.
- Recorded samples retain their actual signed values (battery charging negative, grid export negative when that convention is configured). Missing, invalid and out-of-range samples are skipped, significant history gaps are **not** interpolated, chart rendering is limited to manageable SVG point density, and missing Recorder history shows **NO RECORDED HISTORY** or **HISTORY UNAVAILABLE**, never a synthetic graph.
- Power readings are displayed in W based on configured live sensor units. This requires that recorder values use the same unit as current sensor attributes.
- No scheduling, thresholds, energy totals, automation controls or inverter operation settings are changed.
- The `main` branch remains the alpha HACS testing channel until Version 1 acceptance.

### Browser acceptance criteria
1. HACS Redownload current `main`; hard refresh.
2. Confirm new history panel below intelligence modules with actual recorder values, or explicit fallback message if Recorder lacks these entities.
3. Confirm values and direction agree with Sunsynk and the previously validated v0.5 card.
4. Check desktop and narrow layout; the history chart should not clip and the lower panels should no longer awkwardly wrap charging state.
5. Confirm browser console contains no history errors other than an explicitly handled unavailable Recorder response.
