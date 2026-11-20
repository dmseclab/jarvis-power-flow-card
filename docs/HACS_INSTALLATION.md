# HACS / Home Assistant Marketplace installation

## Status

The `development` branch contains **v0.1.0-alpha**. Keep the working Sunsynk power-flow card in place until JARVIS has been checked against real readings.

## Install an approved release

1. Open **HACS** (or **Marketplace** in Home Assistant 2026.11 and later).
2. Add a custom repository: `https://github.com/dmseclab/jarvis-power-flow-card`, category **Dashboard**.
3. Install **JARVIS Power Flow Card**. Let the manager configure the JavaScript module resource; refresh the browser.
4. In the **Richard → JARVIS** test view, add a Manual card using `examples/sunsynk-richard.yaml`.
5. Compare PV1, PV2, home load, grid CT, SOC and daily totals with the known-good Sunsynk card. Do not infer charging/export direction from colours until signs are verified.

### Troubleshooting

- **Custom element doesn't exist:** check the dashboard resource is a JavaScript module, refresh the browser and inspect developer console errors.
- **Unexpected 0 / —:** inspect the configured entities under Developer Tools → States.
- **Unexpected directions:** sign conventions for grid and battery need validation. No equipment controls are included.
- **Updates:** install a newly approved release in HACS/Marketplace and refresh browser if required. GitHub commits alone do not push updates into Home Assistant.

The package is a frontend dashboard card, not a Home Assistant backend `custom_components` integration. It requires no server restart.

## Developer note

The built single-file artifact is `dist/jarvis-power-flow-card.js`. The Marketplace/HACS looks for this file under `dist` unless a release asset overrides it. Avoid enabling `content_in_root` in `hacs.json`.

**Do not manually register a second JavaScript resource if HACS/Marketplace has already registered the card.**
