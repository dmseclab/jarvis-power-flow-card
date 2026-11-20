# JARVIS Power Flow Card

A standalone, **read-only** custom Lovelace power-flow card for Home Assistant, initially supporting Sunsynk entities.

## Status

**v0.1.0-alpha — development prototype.** Not yet browser-validated. No inverter control actions.

## Branch policy

- `main`: approved baselines only.
- `development`: current work, tests, and visual iteration.

Do not promote from `development` until the custom card renders in the Richard → JARVIS test view, sensor mapping agrees with the working Sunsynk card, and power directions are validated.

## Installation

The prototype JavaScript module and sample Lovelace YAML live on the `development` branch. Copy the compiled JavaScript to `/config/www/jarvis-power-flow-card.js`, register `/local/jarvis-power-flow-card.js` as a JavaScript module under dashboard resources, and add the example YAML as a manual card.

Never commit Home Assistant backups, secrets, tokens, or local entity state dumps.

## Roadmap

1. Read-only SVG visual prototype
2. Verify power and sign conventions against Sunsynk reference
3. Cinematic HUD artwork and animations
4. Responsive layouts and automated tests
5. Documentation and approved release
