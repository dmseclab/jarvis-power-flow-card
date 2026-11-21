# Changelog

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
