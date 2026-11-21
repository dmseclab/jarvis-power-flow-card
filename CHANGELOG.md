# Changelog

## v0.9.0-alpha — 21 November 2026

- **Seamless energy animation:** fixed the SVG dashed flow-line loop. The pattern repeats every 23 units (8 illuminated / 15 gap); animation now travels 46 units (exactly two full patterns) instead of 50, removing the visible jump at each animation cycle.
- **Power-flow hysteresis:** battery and grid paths use separate activation (~60 W) and release (~25 W) thresholds around the configured 40 W reference, preventing blinking when sensor values hover near the boundary.
- Opposite-sign reversals must cross the activation threshold before switching to the new direction; no phantom charge/discharge or import/export from small noise.
- **Read-only telemetry preserved:** raw power, SOC, daily totals, Recorder history, grid polarity, and independent grid-connected status remain unchanged. Hysteresis affects displayed flow states and labels, not source readings.
- Retained the v0.8 cinematic inverter, layered effects and reduced-motion accessibility handling.
- Automated JavaScript syntax, source/distribution parity, battery/grid polarity, and threshold regression tests passed. Browser confirmation of the visual jitter fix is still required.

## v0.8.0-alpha — 21 November 2026

- Rebuilt the central energy scene with a layered inverter housing, soft radial glow, moving orbital instrumentation, active-state beacon and improved neon flow rails.
- Added **measured directional HUD labels** on solar, home, battery and grid paths. Direction reflects configured net-power polarity; the card still makes no per-source-to-load attribution.
- Highlighted charging and discharging transitions, grid import/export, and retained the measured house and PV figures alongside the central diagram.
- Battery near full SOC with a measured small charging value now displays **LOW-RATE CHARGE**, rather than claiming an unverified battery float/absorption state. This affects descriptive text only; the established charge/discharge logic and operating-mode calculation remain unchanged.
- Kept the real Recorder history, rounded kW graph, quality checks, read-only controls and existing HACS configuration.
- Added regression tests for grid import/export, battery charging/discharging, active-flow labels, and read-only behavior.
- All GitHub automated tests passed. **Live Home Assistant browser layout acceptance remains outstanding**.

## v0.7.0-alpha — 21 November 2026

- Reworked recorded 24-hour chart to show rounded, engineering-style **kW** tick marks with an explicit unit and zero reference; preserves negative grid/battery power and observed extrema.
- Increased animation contrast and added layered illuminated HUD framing, decorative circuit traces and inverter accents.
- Tightened the battery, solar, grid and home intelligence-panel spacing, including a shorter diagnostic line height.
- Kept the same source telemetry, polarity settings, read-only operation, recorder refresh interval and bounded chart point count.
- **No source spikes are automatically suppressed or reconstructed.** Source anomalies remain visible for comparison against Sunsynk and Recorder.
- Automated syntax, distribution and smoke tests required before HACS redownload; browser layout confirmation pending.


## v0.6.0-alpha — 21 November 2026

- Added read-only 24-hour power-history panel, sourced from Home Assistant Recorder via the authenticated history API.
- Displays recorded PV1, PV2, home, grid and battery power streams; no simulated lines.
- History is refreshed no more often than once per 15 minutes by default (minimum five minutes).
- Missing, out-of-window, non-numeric and excessively large history values are excluded; major data gaps are not bridged.
- Explicit no-data and API-unavailable states when history is absent or inaccessible.
- Enhanced animated SVG inverter centerpiece with extra ring and illuminated accents.
- Tightened the lower intelligence-panel readout styling to reduce awkward word wrapping.
- Preserved battery/grid polarity configuration, operating modes, data quality monitoring and read-only behavior.
- No inverter actions, settings, service calls or backend integration.
- **Alpha validation:** JavaScript syntax, distributable equality and automated smoke tests passed; real browser acceptance pending.

## v0.5.0-alpha

- Grid-connected state independent of grid import/export, battery P/V/I diagnostic advisory.

## v0.4.0-alpha

- Automatic energy operating modes and data-quality indicators.

## v0.3.0-alpha

- Full cinematic battery/solar/grid/home intelligence modules.

## v0.2.0-alpha

- Responsive cinematic HUD and persistent SVG animation engine.

## v0.1.0-alpha

- Initial read-only custom Lovelace card and HACS custom-repository packaging.
