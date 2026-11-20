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
- **Grid and battery direction animations remain disabled by default.** Direction must be checked against the working Sunsynk card before setting `grid_positive_is_import` and `battery_positive_is_discharge` explicitly.
- Card never invokes Home Assistant services or inverter controls.
- Current SVG DOM rerenders on each HA update: streamline later if performance/animation jitter appears.

### Release policy

Development branch only until Home Assistant browser screenshots, responsive sizing, source comparisons, and polarity tests pass. Keep the original Sunsynk diagram intact. HACS installs default branch `main`, so this milestone is **not yet an HACS update**.
