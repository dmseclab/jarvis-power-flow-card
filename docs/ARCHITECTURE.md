# Architecture

- **Runtime:** standalone Home Assistant Lovelace custom element (`jarvis-power-flow-card`).
- **Data:** `hass.states`, using configured entity IDs. No external network calls or inverter control commands.
- **Presentation:** SVG rendered inside Shadow DOM, with CSS animation on confirmed nonzero paths.
- **Read-only contract:** no toggle actions, automation services, or inverter settings changes.
- **Mapping caveats:** use `sensor.ss_load_power` for home demand, not signed `sensor.ss_inverter_power`. Grid sign convention is initially assumed; battery direction must be verified before enabling animations.
- **Failure mode:** unknown/unavailable sensor values display a dash; no invented values.
- **Future:** separate state logic from visual renderer, add verified power-direction test cases, browser testing and richer JARVIS artwork.
