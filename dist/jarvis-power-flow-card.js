/* JARVIS Power Flow Card v0.4.0-alpha — read-only cinematic HUD. */
const JARVIS_DEFAULTS = {
  pv1_power:"sensor.ss_pv1_power", pv2_power:"sensor.ss_pv2_power",
  battery_soc:"sensor.ss_battery_soc", battery_power:"sensor.ss_battery_power",
  battery_voltage:"sensor.ss_battery_voltage", battery_current:"sensor.ss_battery_current",
  grid_power:"sensor.ss_grid_ct_power", load_power:"sensor.ss_load_power",
  inverter_status:"sensor.ss_overall_state", day_pv_energy:"sensor.ss_day_pv_energy",
  day_load_energy:"sensor.ss_day_load_energy", day_grid_import:"sensor.ss_day_grid_import",
  day_grid_export:"sensor.ss_day_grid_export"
};
const jEsc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[char]);
const jClamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
class JarvisPowerFlowCard extends HTMLElement {
  static getStubConfig() { return {type:"custom:jarvis-power-flow-card", entities:{...JARVIS_DEFAULTS}}; }
  setConfig(config) {
    if (!config || typeof config!=="object") throw new Error("JARVIS requires a configuration");
    this.cfg = {
      title:"J.A.R.V.I.S.", subtitle:"SMART ENERGY COMMAND CENTRE",
      minimum_flow_w:40, grid_positive_is_import:null,
      battery_positive_is_discharge:null, ...config,
      entities:{...JARVIS_DEFAULTS,...(config.entities || {})}
    };
    if (!this.shadowRoot) this.attachShadow({mode:"open"});
    this.render();
  }
  set hass(hass) { this._hass=hass; if (this.cfg) this.render(); }
  getCardSize() { return 7; }
  getGridOptions() { return {columns:12,rows:7,min_columns:6,min_rows:5}; }
  entity(key) { return this._hass?.states?.[this.cfg.entities[key]]; }
  number(key) {
    const s=this.entity(key);
    if (!s || !s.state || ["unknown","unavailable","none"].includes(String(s.state).toLowerCase())) return null;
    const value=Number(s.state);
    return Number.isFinite(value) ? {value,unit:s.attributes?.unit_of_measurement||""}:null;
  }
  power(key) {
    const n=this.number(key);
    if (!n) return null;
    return n.value * (n.unit==="kW"?1000:1);
  }
  // Each measured link is independent: do not infer a fictional power split to the house.
  flowState(solar, home, battery, grid) {
    const t=Math.max(0,Number(this.cfg.minimum_flow_w) || 40);
    const batterySign=this.cfg.battery_positive_is_discharge;
    const gridSign=this.cfg.grid_positive_is_import;
    const active=v=>v!==null && Math.abs(v)>t;
    const batteryMode=!active(battery) ? (battery===null?"unknown":"idle") :
      typeof batterySign!=="boolean" ? "unverified" :
      (batterySign ? battery>0 : battery<0) ? "discharging" : "charging";
    const gridMode=!active(grid) ? (grid===null?"unknown":"idle") :
      typeof gridSign!=="boolean" ? "unverified" :
      (gridSign ? grid>0 : grid<0) ? "importing" : "exporting";
    return {
      solar: solar!==null && solar>t ? "generating" : (solar===null?"unknown":"idle"),
      home: home!==null && home>t ? "supplied" : (home===null?"unknown":"idle"),
      battery:batteryMode,grid:gridMode,
      // Link directions describe net measured transfer through inverter, not final attribution.
      batteryEnabled:batteryMode==="charging"||batteryMode==="discharging",
      batteryReverse:batteryMode==="discharging",
      gridEnabled:gridMode==="importing"||gridMode==="exporting",
      gridReverse:gridMode==="exporting"
    };
  }
  // Operating mode is an interpretation of *net measured channels*.
  // Never claim a grid source/destination without verified grid polarity.
  operatingMode(flows, values) {
    const {solar,home,battery,grid}=values;
    const primaryMissing=[solar,home,battery,grid].filter(v=>v===null).length;
    if (primaryMissing>=2 || home===null) return {name:"DATA INCOMPLETE",detail:"Insufficient live sources",tone:"warn"};
    if (flows.grid==="unverified") {
      return {name:"GRID FLOW UNVERIFIED",detail:"Grid active · confirm CT sign",tone:"warn"};
    }
    if (flows.grid==="importing" && flows.battery==="charging") {
      return {name:"GRID IMPORT + CHARGING",detail:"Grid import and battery charging detected",tone:"blue"};
    }
    if (flows.grid==="exporting") {
      return {name:"GRID EXPORT",detail:"Net power exporting to grid",tone:"green"};
    }
    if (flows.battery==="charging") {
      return {name:flows.solar==="generating"?"SOLAR + BATTERY CHARGING":"BATTERY CHARGING",
        detail:"Battery receiving energy · source not allocated",tone:"green"};
    }
    if (flows.grid==="importing" && flows.battery==="discharging") {
      return {name:"HYBRID SUPPLY",detail:"Grid import and battery discharge both active",tone:"blue"};
    }
    if (flows.grid==="importing") {
      return {name:flows.solar==="generating"?"SOLAR + GRID SUPPLY":"GRID SUPPLY",
        detail:"Net grid import active",tone:"blue"};
    }
    if (flows.battery==="discharging") {
      return {name:flows.solar==="generating"?"SOLAR + BATTERY SUPPLY":"BATTERY SUPPLY",
        detail:"Battery discharging · grid import not detected",tone:"green"};
    }
    if (flows.solar==="generating") return {name:"SOLAR GENERATION",detail:"Solar is producing · source allocation unverified",tone:"amber"};
    if (flows.home==="supplied") return {name:"HOUSE LOAD ACTIVE",detail:"House consuming · power source not fully identified",tone:"blue"};
    return {name:"STANDBY",detail:"Measured transfer below activity threshold",tone:"muted"};
  }
  dataQuality(values) {
    const keys=["solar","home","battery","grid","soc"];
    const missing=keys.filter(k=>values[k]===null);
    return {missing,complete:missing.length===0,label:missing.length===0?"ALL CHANNELS PRESENT":missing.length+" CHANNELS UNAVAILABLE"};
  }
  powerText(value) {
    if (value===null) return "—";
    if (Math.abs(value)>=1000) return (value/1000).toFixed(2)+" kW";
    return Math.round(value)+" W";
  }
  energy(key) {
    const n=this.number(key);
    if (!n) return "—";
    return (n.value/(n.unit==="Wh"?1000:1)).toFixed(1)+" kWh";
  }
  status(key) {
    const s=this.entity(key);
    return s && !["unknown","unavailable"].includes(String(s.state).toLowerCase()) ? String(s.state) : "Unavailable";
  }
  // Reconcile DOM nodes in place: animated SVG paths keep their animation timelines
  // across frequent Home Assistant state updates.
  reconcileNode(current, incoming) {
    if (current.nodeType !== incoming.nodeType || current.nodeName !== incoming.nodeName) {
      current.replaceWith(incoming.cloneNode(true));
      return;
    }
    if (current.nodeType === 3 || current.nodeType === 8) {
      if (current.nodeValue !== incoming.nodeValue) current.nodeValue = incoming.nodeValue;
      return;
    }
    if (current.nodeType !== 1) return;
    for (const attr of [...current.attributes]) {
      if (!incoming.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    }
    for (const attr of [...incoming.attributes]) {
      if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    }
    this.reconcileChildren(current, incoming);
  }
  reconcileChildren(current, incoming) {
    let index=0;
    while (index < incoming.childNodes.length) {
      const fresh=incoming.childNodes[index];
      const existing=current.childNodes[index];
      if (!existing) current.appendChild(fresh.cloneNode(true));
      else this.reconcileNode(existing, fresh);
      index++;
    }
    while (current.childNodes.length > incoming.childNodes.length) current.lastChild.remove();
  }
  applyMarkup(html) {
    // Initial load and headless smoke tests use a direct assignment.
    if (!this.shadowRoot.firstChild || typeof document==="undefined") {
      this.shadowRoot.innerHTML=html;
      return;
    }
    const template=document.createElement("template");
    template.innerHTML=html;
    this.reconcileChildren(this.shadowRoot,template.content);
  }
  render() {
    if (!this.cfg || !this.shadowRoot) return;
    const a=this.power("pv1_power"), b=this.power("pv2_power"), home=this.power("load_power");
    const solar=a===null&&b===null?null:(a||0)+(b||0);
    const battery=this.power("battery_power"), grid=this.power("grid_power");
    const soc=this.number("battery_soc")?.value??null;
    const voltage=this.number("battery_voltage")?.value??null;
    const current=this.number("battery_current")?.value??null;
    const threshold=Math.max(0,Number(this.cfg.minimum_flow_w)||40);
    const flows=this.flowState(solar,home,battery,grid);
    const mode=this.operatingMode(flows,{solar,home,battery,grid});
    const quality=this.dataQuality({solar,home,battery,grid,soc});
    const pct=soc===null?null:jClamp(soc,0,100);
    const fmt=(x)=>jEsc(x);
    const metric=(label,value,color)=>'<div class="metric" style="--accent:'+color+'"><span>'+
      fmt(label)+'</span><strong>'+fmt(value)+'</strong></div>';
    const cap=(x,y,text,color)=>'<text x="'+x+'" y="'+y+'" fill="'+color+
      '" font-size="13" font-weight="700" letter-spacing="1.5">'+fmt(text)+'</text>';
    const txt=(x,y,text,sz=23,color="#ecfbff",weight=700)=>'<text x="'+x+'" y="'+y+'" fill="'+color+
      '" font-size="'+sz+'" font-weight="'+weight+'">'+fmt(text)+'</text>';
    const wire=(d,color,on,reverse=false)=>'<path d="'+d+'" fill="none" stroke="'+color+
      '" stroke-width="9" opacity=".13"/><path d="'+d+'" fill="none" stroke="'+color+
      '" stroke-width="3.5" class="wire '+(on?'on':'')+(reverse?' reverse':'')+'"/>';
    const solarOn=flows.solar==="generating",homeOn=flows.home==="supplied";
    const gridOn=flows.gridEnabled,battOn=flows.batteryEnabled;
    const gridReverse=flows.gridReverse,battReverse=flows.batteryReverse;
    const isAvailable=this.status("inverter_status")!=="Unavailable";
    const stateClass=(mode)=>mode==="generating"||mode==="supplied"||mode==="discharging"||mode==="importing"?"engaged":mode==="charging"||mode==="exporting"?"reversing":"idle";
    const telemetryPanel=(num,title,subtitle,color,body)=>'<section class="hud-panel" style="--hud:'+color+'"><div class="hud-head"><span>'+fmt(num+' // '+title)+'</span><small>'+fmt(subtitle)+'</small></div><div class="hud-body">'+body+'</div></section>';
    const readout=(label,value)=>'<div class="readout"><small>'+fmt(label)+'</small><strong>'+fmt(value)+'</strong></div>';
    const battLabel=flows.battery==="discharging"?"DISCHARGING":flows.battery==="charging"?"CHARGING":flows.battery.toUpperCase();
    const gridLabel=flows.grid==="importing"?"IMPORTING":flows.grid==="exporting"?"EXPORTING":flows.grid.toUpperCase();
    const dialValue=pct===null?0:pct;
    const chargeDial='<div class="charge-dial" style="--pct:'+dialValue+'%"><div class="dial-inner"><strong>'+fmt(soc===null?'—':soc.toFixed(1)+'%')+'</strong><small>STATE OF CHARGE</small></div></div>';
    const barValue=solar===null?0:jClamp(solar/10000*100,0,100);
    const miniBar='<div class="solar-track"><div class="solar-fill" style="width:'+barValue+'%"></div></div>';
    const markup='<style>'+
      ':host{display:block;width:100%;min-width:0;box-sizing:border-box;color:#e7f9ff;font-family:Arial,Roboto,sans-serif}'+
      '*,*::before,*::after{box-sizing:border-box}ha-card{display:block;min-width:0;width:100%;overflow:hidden;position:relative;border:1px solid #20c9ec;border-radius:17px;'+
      'background:radial-gradient(ellipse at 53% 22%,#103754 0%,#061c2d 53%,#030b17 100%);box-shadow:inset 0 0 32px #21d8ff11,0 0 18px #0abef21e}'+
      'ha-card:before{content:"";position:absolute;inset:6px;pointer-events:none;border:1px solid #1dc9e71a;clip-path:polygon(0 0,100% 0,100% 94%,97% 100%,0 100%)}'+
      '.shell{padding:20px clamp(18px,2.4vw,34px) 22px;min-width:0}'+
      '.header{display:flex;gap:12px;justify-content:space-between;align-items:center;border-bottom:1px solid #30829a;padding:0 0 13px;min-width:0}'+
      '.eyebrow{font-size:10px;letter-spacing:2.5px;color:#71dffc;font-weight:700}'+
      'h2{margin:7px 0 2px;font-size:clamp(19px,3vw,34px);letter-spacing:4px;color:#b5f2ff;text-shadow:0 0 16px #4dd7ff77}'+
      '.subtitle{font-size:10px;letter-spacing:2px;color:#a1c9dd}.live{white-space:nowrap;font-size:10px;color:#46e6a9;font-weight:700}'+
      '.mode-banner{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;margin:12px 0 5px;padding:11px 14px;border:1px solid #285979;background:linear-gradient(110deg,#0a2c41,#081a2c);border-radius:8px}'+
      '.mode-banner strong{display:block;color:#c9faff;font-size:17px;letter-spacing:1.2px}.mode-banner small{display:block;color:#a1cbdb;font-size:10px;margin-top:5px}'+
      '.mode-banner[data-tone="green"]{border-left:4px solid #29e9aa}.mode-banner[data-tone="blue"]{border-left:4px solid #46bfff}.mode-banner[data-tone="amber"]{border-left:4px solid #f8c45b}.mode-banner[data-tone="warn"]{border-left:4px solid #ff9d66}.mode-banner[data-tone="muted"]{border-left:4px solid #7892a5}'+
      '.quality-pill{font-size:10px;letter-spacing:.3px;text-align:right;color:#91d7ec;white-space:normal;max-width:180px}'+
      '.status{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:13px 0 3px}'+
      '.stat{padding:8px 10px;border:1px solid #2b6378;background:#091f30b8;border-radius:8px;min-width:0}'+
      '.stat small{display:block;color:#84bed1;font-size:10px;margin-bottom:3px;letter-spacing:.8px}.stat b{display:block;font-size:15px;color:#e9faff;overflow-wrap:anywhere}'+
      '.stage{width:100%;display:block;height:auto;margin-top:4px;overflow:visible}'+
      '.wire{stroke-dasharray:10 15;opacity:.17}.wire.on{opacity:1;filter:drop-shadow(0 0 5px currentColor);animation:jflow 1.9s linear infinite}'+
      '.wire.reverse{animation-direction:reverse}@keyframes jflow{to{stroke-dashoffset:-50}}'+
      '.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:3px}'+
      '.metric{min-width:0;padding:12px 11px;background:#081e2e;border:1px solid #28566e;border-top:2px solid var(--accent);border-radius:7px}'+
      '.metric span{display:block;color:#a2bac9;font-size:10px;letter-spacing:.4px;overflow-wrap:anywhere}'+
      '.metric strong{display:block;color:#f1fcff;font-size:16px;margin-top:5px}'+
      '.foot{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:space-between;color:#89b9c8;font-size:10px;line-height:1.5;margin-top:12px;padding-right:8px}'+
      '.command-line{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:9px 0 0;font-size:10px;color:#80bdd4;letter-spacing:1.5px}'+
      '.command-line:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#28def5aa,transparent)}'+
      '.systems{display:grid;grid-template-columns:1.05fr 1.05fr 1fr 1fr;gap:10px;margin-top:15px}'+
      '.hud-panel{min-width:0;border:1px solid color-mix(in srgb,var(--hud) 65%,#14304a);border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#0b2336,#061421);box-shadow:inset 0 0 22px #11b7ed0b}'+
      '.hud-head{padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--hud) 35%,#183449);box-shadow:inset 3px 0 var(--hud);display:flex;justify-content:space-between;gap:8px;align-items:center}'+
      '.hud-head span{color:var(--hud);font-size:12px;letter-spacing:.8px;font-weight:700}.hud-head small{color:#85a9be;font-size:9px;text-align:right}'+
      '.hud-body{padding:12px;min-width:0}.dual{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.readout{min-width:0;padding:7px 9px;background:#102c403d;border:1px solid #20435a;border-radius:6px}'+
      '.readout small{display:block;color:#8fbbd0;font-size:10px}.readout strong{display:block;margin-top:3px;color:#effcff;font-size:15px;overflow-wrap:anywhere}'+
      '.batt-layout{display:flex;align-items:center;gap:12px}.batt-layout .dual{flex:1}.charge-dial{width:84px;height:84px;flex:none;border-radius:50%;padding:8px;background:conic-gradient(#2de5a3 var(--pct),#20374a 0);box-shadow:0 0 16px #1dda9850}'+
      '.dial-inner{border-radius:50%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#082033}.dial-inner strong{font-size:17px}.dial-inner small{font-size:7px;color:#9dd9c9;text-align:center}'+
      '.solar-track{margin-top:10px;height:8px;overflow:hidden;border-radius:10px;background:#21364a}.solar-fill{height:100%;border-radius:10px;background:linear-gradient(90deg,#f1af32,#ffe987);box-shadow:0 0 10px #ffcc38}'+
      '.mode{font-size:11px;letter-spacing:1px;margin-top:8px;color:var(--hud)}.diagnostic{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #28465b;font-size:11px}.diagnostic span{color:#89b9cc}.diagnostic b{color:#eaf9ff;text-align:right}'+
      '.legend{color:#44e4ad}'+
      '@media(max-width:1050px){.systems{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
      '@media(max-width:650px){.systems{grid-template-columns:minmax(0,1fr)}.hud-head{padding:9px 11px}.shell{padding:12px 15px 16px}.status,.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}'+
      '.header{flex-wrap:wrap}.mode-banner{grid-template-columns:minmax(0,1fr)}.quality-pill{text-align:left;max-width:unset}.stage{min-width:0}.metric strong{font-size:14px}}'+
      '@media(prefers-reduced-motion:reduce){.wire.on{animation:none}}'+
      '</style><ha-card><div class="shell"><div class="header"><div><div class="eyebrow">STARK INDUSTRIES / LIVE ENERGY TELEMETRY</div>'+
      '<h2>'+fmt(this.cfg.title)+'</h2><div class="subtitle">'+fmt(this.cfg.subtitle)+'</div></div>'+
      '<div class="live">● '+(isAvailable?'LIVE TELEMETRY':'SOURCE UNAVAILABLE')+' · READ ONLY</div></div>'+
      '<div class="status">'+
        '<div class="stat"><small>INVERTER</small><b>'+fmt(this.status("inverter_status"))+'</b></div>'+
        '<div class="stat"><small>PV GENERATION</small><b>'+fmt(this.powerText(solar))+'</b></div>'+
        '<div class="stat"><small>BATTERY SOC</small><b>'+(soc===null?'—':fmt(soc.toFixed(1)+'%'))+'</b></div>'+
        '<div class="stat"><small>HOME DEMAND</small><b>'+fmt(this.powerText(home))+'</b></div>'+
      '</div><div class="mode-banner" data-tone="'+fmt(mode.tone)+'"><div><strong>'+fmt(mode.name)+'</strong><small>'+fmt(mode.detail)+'</small></div>'+
      '<div class="quality-pill">'+fmt(quality.label)+(quality.complete?'':' · '+fmt(quality.missing.join(', ')))+'</div></div>'+
      '<svg class="stage" viewBox="0 0 1120 515" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Solar inverter battery home and grid live energy diagram">'+
      '<defs><linearGradient id="jarvisBg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#123d57"/><stop offset="1" stop-color="#07192b"/></linearGradient>'+
      '<linearGradient id="jarvisMeter" x1="0" x2="0" y1="1" y2="0"><stop stop-color="#18b97b"/><stop offset="1" stop-color="#64ffd2"/></linearGradient></defs>'+
      '<path d="M15 45 L40 18 H1080 L1102 43 V476 L1075 498 H41 L15 473 Z" fill="none" stroke="#276b85" opacity=".72" stroke-width="2"/>'+
      '<path d="M27 54 H205 M905 54 H1090 M27 466 H206 M907 466 H1091" stroke="#31dcfb" opacity=".55" stroke-width="3"/>'+
      wire("M279 143 L428 205","#f2bd39",solarOn)+
      wire("M692 205 L842 143","#44bfff",homeOn)+
      wire("M428 302 L279 381","#32e99e",battOn,battReverse)+
      wire("M842 381 L692 302","#fb6c80",gridOn,gridReverse)+
      '<g><rect x="45" y="76" width="238" height="165" rx="12" fill="url(#jarvisBg)" stroke="#f6c33e" stroke-width="2"/>'+
      '<path d="M94 128 L195 103 L232 163 L130 185 Z M127 121 L159 175 M160 113 L192 167 M193 105 L225 159 M110 155 L216 128" stroke="#f4c13c" stroke-width="4" fill="none"/>'+
      cap(64,206,"01 / SOLAR","#f5c848")+txt(64,231,this.powerText(solar),22)+
      '<rect x="838" y="64" width="235" height="185" rx="12" fill="url(#jarvisBg)" stroke="#52bfff" stroke-width="2"/>'+
      '<path d="M908 126 L955 87 L1001 126 M922 117 V170 H988 V117 M945 170 V143 H965 V170" stroke="#61bbfa" fill="none" stroke-width="7"/>'+
      cap(857,204,"02 / HOUSE LOAD","#6abfff")+txt(857,233,this.powerText(home),25)+
      '<rect x="427" y="153" width="266" height="210" rx="17" fill="#0b354e" stroke="#45dcfa" stroke-width="3"/>'+
      '<rect x="438" y="164" width="244" height="188" rx="10" fill="none" stroke="#66dfff" opacity=".25"/>'+
      '<circle cx="560" cy="245" r="49" stroke="#40dffc" fill="#0e2942" stroke-width="3"/>'+
      '<path d="M570 201 L530 259 H558 L547 291 L599 229 H566 Z" fill="#8ceefe"/>'+
      cap(477,184,"03 / INVERTER","#8eeaff")+
      '<text x="560" y="325" fill="#c9f6ff" text-anchor="middle" font-size="19">'+fmt(this.status("inverter_status"))+'</text>'+
      '<rect x="45" y="302" width="239" height="165" rx="12" fill="url(#jarvisBg)" stroke="#36e4a4" stroke-width="2"/>'+
      '<rect x="69" y="331" width="65" height="104" rx="6" fill="#071b2a" stroke="#39e9ac" stroke-width="3"/>'+
      '<rect x="79" y="'+(425-(pct??0)*.84)+'" width="45" height="'+((pct??0)*.84)+'" rx="2" fill="url(#jarvisMeter)"/>'+
      cap(151,339,"04 / BATTERY","#44efa8")+
      txt(151,373,soc===null?"—":soc.toFixed(1)+"%",26)+
      txt(151,403,this.powerText(battery),16,"#b4d7e7",400)+
      txt(151,429,voltage===null?"—":voltage.toFixed(1)+" V",15,"#a2c4d7",400)+
      '<rect x="838" y="302" width="235" height="165" rx="12" fill="url(#jarvisBg)" stroke="#ff6983" stroke-width="2"/>'+
      '<path d="M958 321 L911 414 H1005 Z M927 375 H991 M919 393 H999 M958 324 V415" fill="none" stroke="#fb6982" stroke-width="5"/>'+
      cap(855,441,"05 / GRID","#ff8497")+txt(855,462,this.powerText(grid),19)+
      '</g>'+
      '</svg><div class="command-line"><strong>ENERGY INTELLIGENCE / LIVE SYSTEM MODULES</strong></div><div class="systems">'+
      telemetryPanel('06','BATTERY INTELLIGENCE',battLabel,'#2de9aa',
        '<div class="batt-layout">'+chargeDial+'<div class="dual">'+
        readout('BATTERY POWER',this.powerText(battery))+readout('VOLTAGE',voltage===null?'—':voltage.toFixed(1)+' V')+
        readout('CURRENT',current===null?'—':current.toFixed(1)+' A')+readout('FLOW',flows.battery.toUpperCase())+'</div></div>')+
      telemetryPanel('07','SOLAR INTELLIGENCE','PV STRINGS','#f9c74b',
        '<div class="dual">'+readout('PV STRING 1',this.powerText(a))+readout('PV STRING 2',this.powerText(b))+
        readout('LIVE GENERATION',this.powerText(solar))+readout('DAILY YIELD',this.energy('day_pv_energy'))+
        '</div>'+miniBar+'<div class="mode">'+fmt(flows.solar.toUpperCase())+'</div>')+
      telemetryPanel('08','GRID MANAGEMENT',gridLabel,'#fb7185',
        '<div class="dual">'+readout('GRID CT POWER',this.powerText(grid))+
        readout('FLOW STATE',gridLabel)+readout('IMPORT TODAY',this.energy('day_grid_import'))+
        readout('EXPORT TODAY',this.energy('day_grid_export'))+'</div>')+
      telemetryPanel('09','HOME & DIAGNOSTICS','LIVE SYSTEM','#57bdff',
        '<div class="diagnostic"><span>House demand</span><b>'+fmt(this.powerText(home))+'</b></div>'+
        '<div class="diagnostic"><span>Inverter status</span><b>'+fmt(this.status('inverter_status'))+'</b></div>'+
        '<div class="diagnostic"><span>Battery flow</span><b>'+fmt(battLabel)+'</b></div>'+
        '<div class="diagnostic"><span>Grid flow</span><b>'+fmt(gridLabel)+'</b></div>
        '<div class="diagnostic"><span>Operating mode</span><b>'+fmt(mode.name)+'</b></div>
        '<div class="diagnostic"><span>Sensor quality</span><b>'+fmt(quality.label)+'</b></div>''+
        '<div class="diagnostic"><span>Daily consumption</span><b>'+fmt(this.energy('day_load_energy'))+'</b></div>')+
      '</div><div class="metrics">'+
      metric("SOLAR TODAY",this.energy("day_pv_energy"),"#f8c54a")+
      metric("HOME TODAY",this.energy("day_load_energy"),"#42bfff")+
      metric("GRID IMPORT TODAY",this.energy("day_grid_import"),"#fd8096")+
      metric("GRID EXPORT TODAY",this.energy("day_grid_export"),"#36e7a2")+
      '</div><div class="foot"><span class="legend">● POWER FLOW · LOCAL HOME ASSISTANT DATA</span><span>'+
      'Battery '+fmt(flows.battery)+' ('+fmt(current===null?'—':current.toFixed(1)+' A')+')'+
      ' · Grid '+fmt(flows.grid)+(flows.grid==="unverified"?' · SET GRID POLARITY AFTER CHECK':'')+
      '</span></div></div></ha-card>';
    this.applyMarkup(markup);
  }
}
if (!customElements.get("jarvis-power-flow-card")) customElements.define("jarvis-power-flow-card",JarvisPowerFlowCard);
window.customCards=window.customCards||[];
if (!window.customCards.some(c=>c.type==="jarvis-power-flow-card"))
  window.customCards.push({type:"jarvis-power-flow-card",name:"JARVIS Power Flow",description:"Read-only cinematic SVG energy dashboard"});
