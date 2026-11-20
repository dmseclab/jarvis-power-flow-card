const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const script=fs.readFileSync('dist/jarvis-power-flow-card.js','utf8');
const registrations=new Map();
class HTMLElementMock {
  attachShadow() { this.shadowRoot={innerHTML:''};return this.shadowRoot; }
}
const context={
  HTMLElement:HTMLElementMock, window:{}, 
  customElements:{get:n=>registrations.get(n),define:(n,k)=>registrations.set(n,k)},
};
vm.runInNewContext(script,context,{filename:'jarvis-power-flow-card.js'});
const Card=registrations.get('jarvis-power-flow-card');
assert.equal(typeof Card,'function');
const card=new Card();
card.setConfig({title:'TEST <HUD>'});
card.hass={states:{
  'sensor.ss_pv1_power':{state:'2500',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'unknown',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_load_power':{state:'1.5',attributes:{unit_of_measurement:'kW'}},
  'sensor.ss_battery_soc':{state:'79',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_battery_voltage':{state:'52.5',attributes:{unit_of_measurement:'V'}},
  'sensor.ss_grid_ct_power':{state:'unavailable',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_overall_state':{state:'ok',attributes:{}}
}};
const html=card.shadowRoot.innerHTML;
assert.ok(html.includes('TEST &lt;HUD&gt;'), 'escapes configured title');
assert.ok(html.includes('2.50 kW'), 'solar power displayed in kW');
assert.ok(html.includes('1.50 kW'), 'home load displayed in kW');
assert.ok(html.includes('GRID'), 'grid remains labeled when unavailable');
assert.ok(html.includes('—'), 'unavailable readings remain unavailable');
assert.ok(html.includes('grid-template-columns:repeat(2'), 'responsive narrow-screen layout');
assert.ok(html.includes('padding-right:8px'), 'footer safe-right padding');
assert.ok(!html.includes('hass.callService'), 'card must remain read-only');
assert.ok(!html.includes('NaN'), 'must not invent invalid readings');
// Positive battery power must animate toward the inverter when configured as discharge.
card.setConfig({battery_positive_is_discharge:true});
card.hass={states:{
  'sensor.ss_battery_power':{state:'6850',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_soc':{state:'89.8',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_overall_state':{state:'ok',attributes:{}}
}};
assert.match(card.shadowRoot.innerHTML,/wire on reverse/, 'positive battery discharge reverses inverter-to-battery path');
console.log('JARVIS smoke test passed');
