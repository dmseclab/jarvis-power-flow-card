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
// In-place reconciliation must not replace an existing SVG path when only attributes change.
const attrs=new Map([['class','wire on']]);
const svgNode={
  nodeType:1,nodeName:'path',attributes:[{name:'class'}],
  childNodes:[],
  hasAttribute:k=>attrs.has(k),
  getAttribute:k=>attrs.get(k),
  setAttribute:(k,v)=>attrs.set(k,v),
  removeAttribute:k=>attrs.delete(k),
  replaceWith:()=>{throw new Error('animation path was replaced')}
};
const newAttrs=new Map([['class','wire on reverse']]);
const incoming={
  nodeType:1,nodeName:'path',attributes:[{name:'class',value:'wire on reverse'}],
  childNodes:[],hasAttribute:k=>newAttrs.has(k),
  getAttribute:k=>newAttrs.get(k)
};
card.reconcileNode(svgNode,incoming);
assert.equal(svgNode.getAttribute('class'),'wire on reverse');
assert.equal(svgNode.nodeName,'path');
// Net flow engine: verify all supported directions without inferring a source split.
card.setConfig({battery_positive_is_discharge:true,grid_positive_is_import:true,minimum_flow_w:40});
let flows=card.flowState(3000,2500,1200,600);
assert.equal(flows.solar,'generating');
assert.equal(flows.home,'supplied');
assert.equal(flows.battery,'discharging');
assert.equal(flows.batteryReverse,true);
assert.equal(flows.grid,'importing');
assert.equal(flows.gridReverse,false);
flows=card.flowState(5000,2200,-700, -900);
assert.equal(flows.battery,'charging');
assert.equal(flows.batteryReverse,false);
assert.equal(flows.grid,'exporting');
assert.equal(flows.gridReverse,true);
flows=card.flowState(0,2100,0,0);
assert.equal(flows.battery,'idle');
assert.equal(flows.grid,'idle');
assert.equal(flows.batteryEnabled,false);
assert.equal(flows.gridEnabled,false);
card.setConfig({battery_positive_is_discharge:true});
flows=card.flowState(0,1000,1000,900);
assert.equal(flows.grid,'unverified');
assert.equal(flows.gridEnabled,false);
assert.equal(flows.battery,'discharging');
assert.ok(card.shadowRoot.innerHTML.includes('02 / HOUSE LOAD'),'house panel expanded');
// Full cinematic command-centre panels should render only measured data.
const rich=card.shadowRoot.innerHTML;
for(const heading of ['BATTERY INTELLIGENCE','SOLAR INTELLIGENCE','GRID MANAGEMENT','HOME &amp; DIAGNOSTICS','ENERGY INTELLIGENCE / LIVE SYSTEM MODULES']){
  assert.ok(rich.includes(heading), 'missing cinematic module: '+heading);
}
assert.ok(rich.includes('charge-dial'), 'live SOC instrument should render');
assert.ok(rich.includes('PV STRING 1'), 'PV diagnostics should render');
assert.ok(rich.includes('GRID CT POWER'), 'grid telemetry should render');
assert.ok(rich.includes('Daily consumption'), 'house telemetry should render');
assert.ok(!rich.includes('NaN'), 'rich panels must not fabricate numeric values');
// Operating mode is conservative, explicit and does not allocate sources.
card.setConfig({battery_positive_is_discharge:true});
let state=card.flowState(0,3000,3400,0);
let mode=card.operatingMode(state,{solar:0,home:3000,battery:3400,grid:0});
assert.equal(mode.name,'BATTERY SUPPLY');
state=card.flowState(2000,3000,1500,0);
mode=card.operatingMode(state,{solar:2000,home:3000,battery:1500,grid:0});
assert.equal(mode.name,'SOLAR + BATTERY SUPPLY');
state=card.flowState(0,3000,-900,800);
mode=card.operatingMode(state,{solar:0,home:3000,battery:-900,grid:800});
assert.equal(mode.name,'GRID FLOW UNVERIFIED');
card.setConfig({battery_positive_is_discharge:true,grid_positive_is_import:true});
state=card.flowState(0,3000,-900,1800);
mode=card.operatingMode(state,{solar:0,home:3000,battery:-900,grid:1800});
assert.equal(mode.name,'GRID IMPORT + CHARGING');
state=card.flowState(5000,2000,0,-2500);
mode=card.operatingMode(state,{solar:5000,home:2000,battery:0,grid:-2500});
assert.equal(mode.name,'GRID EXPORT');
state=card.flowState(null,null,500,null);
mode=card.operatingMode(state,{solar:null,home:null,battery:500,grid:null});
assert.equal(mode.name,'DATA INCOMPLETE');
const quality=card.dataQuality({solar:0,home:1000,battery:null,grid:0,soc:80});
assert.deepEqual([...quality.missing],['battery']);
card.hass={states:{
  'sensor.ss_overall_state':{state:'ok',attributes:{}},
  'sensor.ss_load_power':{state:'3000',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_power':{state:'3400',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_soc':{state:'80',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_grid_ct_power':{state:'0',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv1_power':{state:'0',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'0',attributes:{unit_of_measurement:'W'}}
}};
assert.ok(card.shadowRoot.innerHTML.includes('BATTERY SUPPLY'),'mode banner rendered');
assert.ok(card.shadowRoot.innerHTML.includes('ALL CHANNELS PRESENT'),'quality banner rendered');

card.setConfig({battery_positive_is_discharge:true,grid_positive_is_import:true});
card.hass={states:{
  'binary_sensor.ss_grid_connected':{state:'on',attributes:{}},
  'sensor.ss_overall_state':{state:'ok',attributes:{}},
  'sensor.ss_grid_ct_power':{state:'0',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_load_power':{state:'2200',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_power':{state:'-652',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_voltage':{state:'55.8',attributes:{unit_of_measurement:'V'}},
  'sensor.ss_battery_current':{state:'-35',attributes:{unit_of_measurement:'A'}},
  'sensor.ss_battery_soc':{state:'97',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_pv1_power':{state:'522',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'526',attributes:{unit_of_measurement:'W'}}
}};
assert.equal(card.gridConnection(),'CONNECTED');
assert.equal(card.batteryPlausibility(-652,55.8,-35).flag,true);
assert.equal(card.batteryPlausibility(-1900,55.8,-35).flag,false);
assert.equal(card.batteryPlausibility(null,55.8,-35).label,'NOT CHECKED');
assert.ok(card.shadowRoot.innerHTML.includes('GRID CONNECTION'));
assert.ok(card.shadowRoot.innerHTML.includes('CHECK P / V / I'));
card.hass={states:{'binary_sensor.ss_grid_connected':{state:'off',attributes:{}}}};
assert.equal(card.gridConnection(),'DISCONNECTED');
assert.equal(card.batteryPlausibility(null,null,null).flag,false);

// Recorded-history renderer: real recorder data only, never simulated curves.
// v0.8: detailed read-only cinematic scene and directional labels.
card.setConfig({battery_positive_is_discharge:true,grid_positive_is_import:true});
card.hass={states:{
  'sensor.ss_overall_state':{state:'ok',attributes:{}},
  'sensor.ss_pv1_power':{state:'354',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'330',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_load_power':{state:'2070',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_power':{state:'-85',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_voltage':{state:'55.8',attributes:{unit_of_measurement:'V'}},
  'sensor.ss_battery_current':{state:'-0.9',attributes:{unit_of_measurement:'A'}},
  'sensor.ss_battery_soc':{state:'100',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_grid_ct_power':{state:'1520',attributes:{unit_of_measurement:'W'}},
  'binary_sensor.ss_grid_connected':{state:'on',attributes:{}}
}};
let cinematic=card.shadowRoot.innerHTML;
for(const expected of ['LOW-RATE CHARGE','TO BATTERY','GRID TO INVERTER','PV GENERATION','HOME DEMAND','jarvisCoreGlow','inverter-halo']){
  assert.ok(cinematic.includes(expected),'cinematic scene must include '+expected);
}
assert.ok(cinematic.includes('class="wire on'), 'active measured energy paths remain animated');
assert.ok(cinematic.includes('GRID IMPORT + CHARGING'), 'measured charging mode is unchanged');
assert.ok(!cinematic.includes('hass.callService'), 'v0.8 does not control inverter');
card.hass={states:{
  ...card._hass.states,
  'sensor.ss_battery_power':{state:'3200',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_grid_ct_power':{state:'-800',attributes:{unit_of_measurement:'W'}}
}};
cinematic=card.shadowRoot.innerHTML;
assert.ok(cinematic.includes('TO INVERTER'), 'discharging label follows power sign');
assert.ok(cinematic.includes('INVERTER TO GRID'), 'export label follows configured grid sign');
assert.ok(cinematic.includes('wire on reverse'), 'directional wiring remains enabled');
// v0.9: dash-loop distance must be exactly two full 8+15 pixel patterns.
assert.ok(cinematic.includes('stroke-dasharray:8 15'), 'dash pattern remains 23 units');
assert.ok(cinematic.includes('stroke-dashoffset:-46'), 'loop boundary is seamless');
assert.ok(!cinematic.includes('stroke-dashoffset:-50'), 'old jump is removed');
// A 40 W threshold uses 60 W activation and 25 W release.
// Adjacent 39/40/41 W samples must not flicker the connection.
card.setConfig({minimum_flow_w:40,battery_positive_is_discharge:true,grid_positive_is_import:true});
let stable=card.flowState(0,1000,-39,41);
assert.equal(stable.battery,'idle');
assert.equal(stable.grid,'idle');
stable=card.flowState(0,1000,-40,40);
assert.equal(stable.battery,'idle');
stable=card.flowState(0,1000,-65,70);
assert.equal(stable.battery,'charging');
assert.equal(stable.grid,'importing');
stable=card.flowState(0,1000,-38,41);
assert.equal(stable.battery,'charging','active charge remains latched around threshold');
assert.equal(stable.grid,'importing','active import remains latched around threshold');
stable=card.flowState(0,1000,-24,24);
assert.equal(stable.battery,'idle','battery drops out below release threshold');
assert.equal(stable.grid,'idle','grid drops out below release threshold');
stable=card.flowState(0,1000,-65,70);
assert.equal(stable.battery,'charging');
stable=card.flowState(0,1000,30,-30);
assert.equal(stable.battery,'idle','opposite sign near zero must not appear active');
assert.equal(stable.grid,'idle','opposite grid sign near zero must not appear active');
stable=card.flowState(0,1000,70,-80);
assert.equal(stable.battery,'discharging','strong reverse battery flow activates');
assert.equal(stable.grid,'exporting','strong reverse grid flow activates');
// Solar contribution bar must never pretend an arbitrary 10 kW rating.
card.setConfig({battery_positive_is_discharge:true,grid_positive_is_import:true});
card.hass={states:{
  'sensor.ss_pv1_power':{state:'245',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'218',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_load_power':{state:'1000',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_soc':{state:'99',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_battery_power':{state:'0',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_grid_ct_power':{state:'500',attributes:{unit_of_measurement:'W'}}
}};
let solarVisual=card.shadowRoot.innerHTML;
assert.ok(solarVisual.includes('PV1 53% · PV2 47% OF LIVE PV POWER'));
assert.ok(solarVisual.includes('class="solar-fill secondary"'),'both PV shares visible');
assert.ok(!solarVisual.includes('10000'),'no arbitrary 10 kW rated power');
card.hass={states:{
  ...card._hass.states,
  'sensor.ss_pv1_power':{state:'0',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'0',attributes:{unit_of_measurement:'W'}}
}};
assert.ok(card.shadowRoot.innerHTML.includes('PV CONTRIBUTION · NO GENERATION'));
card.hass={states:{
  ...card._hass.states,
  'sensor.ss_pv2_power':{state:'unavailable',attributes:{unit_of_measurement:'W'}}
}};
assert.ok(card.shadowRoot.innerHTML.includes('PV CONTRIBUTION · DATA UNAVAILABLE'));
// v0.10: preserve live power readouts and protect narrow-screen usability.
card.setConfig({battery_positive_is_discharge:true,grid_positive_is_import:true});
card.hass={states:{
  'sensor.ss_overall_state':{state:'ok',attributes:{}},
  'sensor.ss_pv1_power':{state:'1100',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_pv2_power':{state:'900',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_load_power':{state:'1450',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_power':{state:'-75',attributes:{unit_of_measurement:'W'}},
  'sensor.ss_battery_soc':{state:'93',attributes:{unit_of_measurement:'%'}},
  'sensor.ss_grid_ct_power':{state:'320',attributes:{unit_of_measurement:'W'}}
}};
const candidate=card.shadowRoot.innerHTML;
assert.ok(candidate.includes('inverter-vents'),'new inverter fascia must render');
assert.ok(candidate.includes('SUNSYNK / ENERGY'),'inverter branding plate must render');
assert.ok(candidate.includes('mobile-readouts'),'responsive power values must render');
assert.ok(candidate.includes('aria-label="Accessible power flow readings"'),'mobile content is labeled');
assert.ok(candidate.includes('mobile-readouts{display:grid}'),'narrow-screen style rule is present');
assert.ok(candidate.includes('GRID · IMPORTING'),'mobile grid direction uses measured rule');
assert.ok(candidate.includes('BATTERY · CHARGING'),'mobile battery direction uses confirmed polarity');
assert.ok(candidate.includes('2.00 kW'),'mobile solar sum uses live PVs');
assert.ok(candidate.includes('1.45 kW'),'mobile home demand uses live sensor');
assert.ok(candidate.includes('stroke-dashoffset:-46'),'validated smooth animation stays intact');
assert.ok(!candidate.includes('NaN'),'candidate must not show invalid values');
// v0.7: rounded engineering kW scale must cover all observed values.
let axis=card.historyBounds([-7100,415,8000]);
assert.ok(axis.min<=-7100 && axis.max>=8000, 'axis includes signed extrema');
assert.ok(axis.min<=0 && axis.max>=0, 'axis includes zero');
assert.ok([1,2,2.5,5,10].some(n=>Number.isInteger(Math.log10(axis.step/n))), 'nice-step scale');
assert.ok(axis.count>=2 && axis.count<=8, 'manageable vertical tick count');
axis=card.historyBounds([0,0,0]);
assert.ok(axis.min<0 && axis.max>0, 'flat signals show a meaningful zero scale');
axis=card.historyBounds([500,1250,1900]);
assert.ok(axis.max>=1900 && axis.min<=0, 'import values retained');
assert.ok(card.shadowRoot.innerHTML.includes('hud-filigree'), 'illuminated framing rendered');
assert.ok(card.shadowRoot.innerHTML.includes('history-panel'), 'history section present');
const t0=Date.parse('2026-11-17T08:00:00Z');
const t1=t0+3600000;
card._historyStart=t0;
card._historyEnd=t1;
card._historyData={
  'sensor.ss_pv1_power':[
    {time:t0,value:0},
    {time:t0+900000,value:500},
    {time:t0+1800000,value:1200}
  ],
  'sensor.ss_grid_ct_power':[
    {time:t0,value:-300},
    {time:t0+900000,value:150}
  ]
};
let plot=card.historyMarkup();
assert.ok(plot.includes('polyline'), 'recorded points render as actual lines');
assert.ok(plot.includes('PV1'), 'chart legend includes PV1');
assert.ok(plot.includes('GRID'), 'chart legend includes grid');
card._historyData={};
plot=card.historyMarkup();
assert.ok(plot.includes('WAITING FOR HISTORY') || plot.includes('RECORDED HISTORY'), 'missing recorder data is clearly labeled');
assert.ok(!plot.includes('<polyline'), 'empty recorder response never invents a line');
assert.equal(card.historyKeys().length,5,'five monitored power streams');
card._hass={states:{'sensor.ss_pv1_power':{state:'500',attributes:{unit_of_measurement:'W'}}},
  callApi:async (method,url)=>{
    assert.equal(method,'GET');
    assert.ok(url.includes('history/period/'));
    assert.ok(url.includes('filter_entity_id='));
    return [[
      {entity_id:'sensor.ss_pv1_power',state:'0',last_changed:new Date(t0).toISOString()},
      {state:'200',last_changed:new Date(t0+600000).toISOString()},
      {state:'unavailable',last_changed:new Date(t0+700000).toISOString()}
    ]];
  }
};
card.loadHistory(['sensor.ss_pv1_power']).then(()=>{
  assert.equal(card._historyData['sensor.ss_pv1_power'].length,0,
    'out-of-window fixture should not appear in a current 24 hour chart');
  console.log('JARVIS smoke test passed');
}).catch(err=>{console.error(err);process.exitCode=1;});

