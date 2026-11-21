/* JARVIS Power Flow Card v0.6.0-alpha — read-only cinematic HUD. */
const JARVIS_DEFAULTS = {
  pv1_power:"sensor.ss_pv1_power", pv2_power:"sensor.ss_pv2_power",
  battery_soc:"sensor.ss_battery_soc", battery_power:"sensor.ss_battery_power",
  battery_voltage:"sensor.ss_battery_voltage", battery_current:"sensor.ss_battery_current",
  grid_power:"sensor.ss_grid_ct_power", grid_connected:"binary_sensor.ss_grid_connected", load_power:"sensor.ss_load_power",
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
      battery_positive_is_discharge:null, show_history:true, history_refresh_minutes:15, ...config,
      entities:{...JARVIS_DEFAULTS,...(config.entities || {})}
    };
    if (!this.shadowRoot) this.attachShadow({mode:"open"});
    this.render();
  }
  set hass(hass) {
    this._hass=hass;
    if (this.cfg) this.render();
    this.maybeLoadHistory();
  }
  connectedCallback() { this.maybeLoadHistory(); }
  historyKeys() { return ["pv1_power","pv2_power","load_power","grid_power","battery_power"]; }
  maybeLoadHistory() {
    if (!this.isConnected || !this.cfg || this.cfg.show_history===false || !this._hass?.callApi) return;
    const ids=this.historyKeys().map(key=>this.cfg.entities[key]).filter(id=>typeof id==="string" && id.length);
    const signature=ids.join(",");
    if (signature!==this._historySignature) {
      this._historySignature=signature;
      this._historyData={};
      this._historyLastAttempt=0;
    }
    const now=Date.now();
    const interval=Math.max(300000,Number(this.cfg.history_refresh_minutes||15)*60000);
    if (this._historyLoading || now-(this._historyLastAttempt||0)<interval) return;
    this._historyLastAttempt=now;
    this._historyLoading=true;
    this._historyStatus="LOADING RECORDED HISTORY";
    this.loadHistory(ids).then(()=>{
      this._historyStatus=Object.values(this._historyData||{}).some(rows=>rows.length)?"RECORDED HISTORY":"NO RECORDED HISTORY";
    }).catch(()=>{
      this._historyStatus="HISTORY UNAVAILABLE";
    }).finally(()=>{
      this._historyLoading=false;
      if (this.cfg && this.isConnected) this.render();
    });
  }
  async loadHistory(ids) {
    if (!ids.length) { this._historyData={}; return; }
    const end=new Date(), start=new Date(end.getTime()-24*3600000);
    // Home Assistant's authenticated frontend API; never sends tokens elsewhere.
    const url="history/period/"+encodeURIComponent(start.toISOString())+
      "?filter_entity_id="+ids.map(encodeURIComponent).join(",")+
      "&end_time="+encodeURIComponent(end.toISOString())+"&minimal_response&no_attributes";
    const response=await this._hass.callApi("GET",url);
    if (!Array.isArray(response)) throw new Error("History API returned invalid payload");
    const parsed={};
    response.forEach((series,index)=>{
      if (!Array.isArray(series) || !series.length) return;
      const id=series[0].entity_id || (response.length===ids.length?ids[index]:null);
      if (!id || !ids.includes(id)) return;
      parsed[id]=series.map(point=>({
        time:Date.parse(point.last_changed||point.last_updated||""),
        value:point.state===null||point.state===undefined||point.state===""?NaN:Number(point.state)
      })).filter(point=>Number.isFinite(point.time) &&
        point.time>=start.getTime() && point.time<=end.getTime() &&
        Number.isFinite(point.value) &&
        point.value>=-1000000 && point.value<=1000000);
    });
    this._historyData=parsed;
    this._historyStart=start.getTime();
    this._historyEnd=end.getTime();
  }
  historyMarkup() {
    const keys=this.historyKeys(), data=this._historyData||{};
    const palette=["#ffc747","#f8a45a","#55baff","#fa7086","#32e6a1"];
    const titles=["PV1","PV2","HOUSE","GRID","BATTERY"];
    const all=[];
    const series=keys.map((key,index)=>{
      const id=this.cfg.entities[key], unit=this.entity(key)?.attributes?.unit_of_measurement;
      const factor=unit==="kW"?1000:1;
      const points=(data[id]||[]).map(p=>({time:p.time,value:p.value*factor}));
      points.forEach(p=>all.push(p.value));
      return {key,title:titles[index],color:palette[index],points};
    });
    const keyHtml=series.map(s=>'<span style="color:'+s.color+'">● '+s.title+'</span>').join("");
    if (!all.length) return '<div class="history-empty">'+jEsc(this._historyStatus||"WAITING FOR HISTORY")+
      '<small>Requires Home Assistant Recorder history for these power sensors</small></div><div class="history-legend">'+keyHtml+'</div>';
    let low=0,high=0;
    for(const value of all){if(value<low)low=value;if(value>high)high=value;}
    const min=low===high?low-100:low, max=low===high?high+100:high;
    const width=1060,height=215,left=67,right=1037,top=16,bottom=183;
    const xmin=this._historyStart || Date.now()-86400000;
    const xmax=this._historyEnd || Date.now();
    const x=t=>left+(t-xmin)/(xmax-xmin)*(right-left);
    const y=v=>top+(max-v)/(max-min)*(bottom-top);
    const fmtV=v=>Math.abs(v)>=1000?(v/1000).toFixed(1)+"k":Math.round(v)+"";
    const axes=[0,.5,1].map(r=>{
      const val=min+r*(max-min), yy=y(val);
      return '<line x1="'+left+'" x2="'+right+'" y1="'+yy.toFixed(1)+'" y2="'+yy.toFixed(1)+
        '" stroke="#315069" stroke-width="1"/><text x="59" y="'+(yy+4).toFixed(1)+
        '" text-anchor="end" fill="#8fbbcc" font-size="13">'+jEsc(fmtV(val))+'</text>';
    }).join("");
    const paths=series.map(s=>{
      // Limit SVG point density; retain the first and last sample for each slice.
      // Broken recorder intervals are not bridged with invented samples.
      let chunks=[],run=[],prev=null;
      for(const p of s.points){
        if(prev!==null && p.time-prev>45*60000){if(run.length)chunks.push(run);run=[];}
        run.push(p);prev=p.time;
      }
      if(run.length)chunks.push(run);
      return chunks.map(group=>{
        const maxPoints=420;
        if(group.length>maxPoints){
          const step=Math.ceil(group.length/maxPoints),reduced=[];
          for(let k=0;k<group.length;k+=step) reduced.push(group[k]);
          if(reduced[reduced.length-1]!==group[group.length-1]) reduced.push(group[group.length-1]);
          group=reduced;
        }
        return group.length>1?'<polyline fill="none" stroke="'+s.color+
        '" stroke-width="2" opacity=".95" vector-effect="non-scaling-stroke" points="'+
        group.map(p=>x(p.time).toFixed(1)+','+y(p.value).toFixed(1)).join(' ')+'"/>':
        '<circle cx="'+x(group[0].time).toFixed(1)+'" cy="'+y(group[0].value).toFixed(1)+
        '" r="2.5" fill="'+s.color+'"/>';
      }).join("");
    }).join("");
    const tick=Array.from({length:5},(_,i)=>{
      const t=xmin+(xmax-xmin)*i/4;
      const label=new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date(t));
      return '<text x="'+x(t).toFixed(1)+'" y="205" text-anchor="middle" fill="#8fb1c5" font-size="13">'+
        jEsc(label)+'</text>';
    }).join("");
    return '<svg class="history-svg" viewBox="0 0 1060 215" role="img" aria-label="Last 24 hours of recorded power data">'+
      axes+'<line x1="'+left+'" x2="'+right+'" y1="'+y(0).toFixed(1)+'" y2="'+y(0).toFixed(1)+
      '" stroke="#70b7ce" stroke-width="1.5" stroke-dasharray="5 6"/>'+
      paths+tick+'</svg><div class="history-legend">'+keyHtml+'</div>';
  }
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
  gridConnection() {
    const state=this.entity("grid_connected")?.state;
    if (state==="on") return "CONNECTED";
    if (state==="off") return "DISCONNECTED";
    return "UNKNOWN";
  }
  batteryPlausibility(power, voltage, current) {
    if ([power,voltage,current].some(v=>v===null)) return {label:"NOT CHECKED",note:"Battery P / V / I not all available",flag:false};
    const vi=Math.abs(voltage*current);
    const measured=Math.abs(power);
    if (Math.max(measured,vi)<250) return {label:"LOW POWER",note:"Below comparison threshold",flag:false};
    const delta=Math.abs(vi-measured);
    const threshold=Math.max(350,0.4*Math.max(vi,measured));
    return delta>threshold ?
      {label:"CHECK P / V / I",note:"Battery power differs from V × I; compare sensor definitions and timestamps",flag:true} :
      {label:"P / V / I CONSISTENT",note:"Approximate power and V × I agree",flag:false};
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
    const connection=this.gridConnection();
    const plausibility=this.batteryPlausibility(battery,voltage,current);
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
      '.health-line{display:flex;flex-wrap:wrap;gap:8px;margin:9px 0 4px}.health-chip{border:1px solid #28506b;background:#0a2638;border-radius:6px;padding:7px 10px;color:#aad9e9;font-size:10px}.health-chip b{color:#ecfbff;margin-left:6px}.health-chip.warning{border-color:#bd8b47;color:#ffd88c}.health-chip.warning b{color:#ffd88c}'+
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
      '.history-panel{border:1px solid #2789a6;border-radius:10px;padding:12px 17px;margin-top:12px;background:linear-gradient(160deg,#092b40,#061526);box-shadow:inset 0 0 18px #19cbff15}'+
      '.history-heading{display:flex;justify-content:space-between;gap:10px;align-items:center;color:#a0eaff;font-size:12px;letter-spacing:1.3px;font-weight:700}'+
      '.history-heading small{font-size:10px;color:#7facbf;letter-spacing:0;font-weight:400}'+
      '.history-svg{width:100%;max-height:220px;display:block;margin-top:7px}'+
      '.history-empty{min-height:110px;display:flex;flex-direction:column;gap:9px;align-items:center;justify-content:center;color:#94bfd4;font-size:13px}'+
      '.history-empty small{font-size:10px;color:#79a4bc}.history-legend{display:flex;justify-content:center;flex-wrap:wrap;gap:15px;font-size:11px;margin-top:3px}'+
      '.readout strong{font-size:14px!important;line-height:1.15;overflow-wrap:normal;word-break:normal}.readout small{font-size:9px!important}'+
      '.batt-layout .dual{min-width:0}.hud-panel{min-width:0}.hud-head span{overflow-wrap:anywhere}'+
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
      '<div class="health-line"><div class="health-chip">GRID CONNECTION <b>'+fmt(connection)+'</b></div>'+
      '<div class="health-chip'+(plausibility.flag?' warning':'')+'">BATTERY SENSOR CHECK <b>'+fmt(plausibility.label)+'</b></div></div>'+
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
      '<path d="M448 176 H465 M655 176 H670 M445 333 H466 M653 333 H672" stroke="#56dfff" stroke-width="3" opacity=".75"/>'+
      '<circle cx="560" cy="245" r="61" stroke="#44dafa" stroke-dasharray="4 12" fill="none" opacity=".45"/>'+
      '<path d="M463 291 H482 M638 291 H658 M473 300 H647" stroke="#3bb9dd" stroke-width="2" opacity=".35"/>'+
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
        readout('FLOW STATE',gridLabel)+readout('GRID CONNECTION',connection)+readout('IMPORT TODAY',this.energy('day_grid_import'))+
        readout('EXPORT TODAY',this.energy('day_grid_export'))+'</div>')+
      telemetryPanel('09','HOME & DIAGNOSTICS','LIVE SYSTEM','#57bdff',
        '<div class="diagnostic"><span>House demand</span><b>'+fmt(this.powerText(home))+'</b></div>'+
        '<div class="diagnostic"><span>Inverter status</span><b>'+fmt(this.status('inverter_status'))+'</b></div>'+
        '<div class="diagnostic"><span>Battery flow</span><b>'+fmt(battLabel)+'</b></div>'+
        '<div class="diagnostic"><span>Grid flow</span><b>'+fmt(gridLabel)+'</b></div>'+
        '<div class="diagnostic"><span>Operating mode</span><b>'+fmt(mode.name)+'</b></div>'+
        '<div class="diagnostic"><span>Sensor quality</span><b>'+fmt(quality.label)+'</b></div>'+
        '<div class="diagnostic"><span>Grid connected</span><b>'+fmt(connection)+'</b></div>'+
        '<div class="diagnostic"><span>Battery P / V / I</span><b>'+fmt(plausibility.label)+'</b></div>'+
        '<div class="diagnostic"><span>Daily consumption</span><b>'+fmt(this.energy('day_load_energy'))+'</b></div>')+
      '</div>'+(this.cfg.show_history===false?'':'<section class="history-panel"><div class="history-heading"><span>10 // ENERGY HISTORY · LAST 24 HOURS</span><small>'+fmt(this._historyStatus||"RECORDED SENSOR VALUES")+'</small></div>'+this.historyMarkup()+'</section>')+
      '<div class="metrics">'+
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
