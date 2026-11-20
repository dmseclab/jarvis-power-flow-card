# JARVIS v0.2.0-alpha — isolated browser preview

The installed HACS card (v0.1) is unchanged. This preview registers a **different** Lovelace element: `custom:jarvis-power-flow-preview`, allowing side-by-side testing.

1. Download `preview/jarvis-power-flow-preview.js` from the `development` branch.
2. Upload it to Home Assistant `/config/www/jarvis-power-flow-preview.js` using File Editor.
3. Under **Settings → Dashboards → Resources**, add `/local/jarvis-power-flow-preview.js?v=020` as a JavaScript module. **Do not delete or modify** the HACS-managed production card resource.
4. Refresh Home Assistant with Ctrl+F5. In **Richard → JARVIS Sensor Test**, add a Manual card:

```yaml
type: custom:jarvis-power-flow-preview
title: J.A.R.V.I.S.
subtitle: SMART ENERGY COMMAND CENTRE
minimum_flow_w: 40
# Positive battery power confirmed as discharge in this installation.
battery_positive_is_discharge: true
entities:
  pv1_power: sensor.ss_pv1_power
  pv2_power: sensor.ss_pv2_power
  inverter_status: sensor.ss_overall_state
  load_power: sensor.ss_load_power
  battery_soc: sensor.ss_battery_soc
  battery_power: sensor.ss_battery_power
  battery_voltage: sensor.ss_battery_voltage
  battery_current: sensor.ss_battery_current
  grid_power: sensor.ss_grid_ct_power
  day_pv_energy: sensor.ss_day_pv_energy
  day_load_energy: sensor.ss_day_load_energy
  day_grid_import: sensor.ss_day_grid_import
  day_grid_export: sensor.ss_day_grid_export
```

5. Compare v0.2 with the installed JARVIS v0.1 and working Sunsynk diagram: load power, grid CT, SOC, PV, daily totals, unknown sensor behavior, right-side clipping and mobile layout.
6. The observed +6.85 kW battery power / +132.7 A condition was confirmed by the operator as discharging into the home. Set `battery_positive_is_discharge: true` in the preview YAML. Grid import/export polarity remains unverified, so leave `grid_positive_is_import` unset.

**After acceptance:** remove the preview card, delete its manual resource and preview file. Merge validated v0.2 to `main` and update through HACS.

**Rollback:** if the preview fails, delete only the preview card/resource/file. The original HACS-installed JARVIS card remains operational.
