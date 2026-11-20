# Installation (development preview)

1. Keep the existing working Sunsynk card and the Richard/JARVIS test view untouched for rollback.
2. Download `src/jarvis-power-flow-card.js` from the **development** branch.
3. Copy it into Home Assistant at `/config/www/jarvis-power-flow-card.js`.
4. Add Dashboard Resource URL `/local/jarvis-power-flow-card.js?v=1` with type **JavaScript module**.
5. Refresh the Home Assistant browser. Add a **Manual** card using `examples/sunsynk-richard.yaml`.
6. Compare live power, SOC, daily totals, and sign conventions with the working Sunsynk card.

This is a read-only alpha and has not yet been validated on the actual Home Assistant frontend. Never use guessed numerical values when a sensor is unavailable.
