# Overnight soak — JARVIS v0.4.0-alpha

## Scope

Read-only Home Assistant dashboard test. **Do not change inverter schedules, priorities, switches, CT wiring or firmware to induce a test.** Existing Sunsynk Power Flow Card remains the reference.

## Tonight (after HACS Redownload)

1. In HACS / Marketplace, redownload the latest default branch build and hard-refresh the browser.
2. Keep the same JARVIS Lovelace YAML with `battery_positive_is_discharge: true`.
3. Leave `grid_positive_is_import` **unset** until an import/export condition is positively matched with the Sunsynk reference.
4. Confirm new **Operating Mode** banner and **Sensor Quality** indicator appear. At night, battery discharging with zero grid and no solar should show `BATTERY SUPPLY`, assuming all source readings are available.
5. Confirm SOC gauge, PV1/PV2, load and battery readings agree with the existing Sunsynk reference. Check card remains read-only.
6. Leave the view accessible; this is only a frontend display test, not a scheduled service. No automatic report or external monitoring is performed by this repository.

## Morning observations (South Africa local time)

- At sunrise/when PV starts producing: record PV1, PV2, total PV, current operating-mode banner, battery power (+ discharge / − charge), grid CT and home load.
- When the system **naturally** imports or exports: compare signed `sensor.ss_grid_ct_power` with the existing Sunsynk display and record a screenshot before enabling any polarity setting.
- If the grid sign is confirmed: set `grid_positive_is_import: true` only for positive=import; otherwise `false`.
- Compare energy daily totals from both cards. Values may reset at a source-defined midnight/day boundary; JARVIS displays source data as-is.
- Check responsive layout and right-edge clipping on the intended screen.

## Expected detection logic

- PV > 40 W: generating; battery positive with configured discharge sign: discharging.
- Battery negative < −40 W: charging; battery near zero: idle.
- Grid nonzero with unknown polarity: `GRID FLOW UNVERIFIED`, grid animation disabled.
- Grid importing/exporting is only named after sign verification.
- No estimated attribution of specific energy sources to individual loads.

## Recovery

If card shows a blank area, unexpected numbers, or severe UI issues, use HACS to redownload the last known working revision (or restore the saved JavaScript) and keep using the original Sunsynk card. Do not remove the Sunsynk integration or its HACS resource.

## What to share tomorrow

Full JARVIS screenshot (including lower intelligence panels); current Sunsynk diagram; source power signs for battery and grid; and any error from the browser console if present.
