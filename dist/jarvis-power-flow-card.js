/* JARVIS Power Flow Card — v0.1.0-alpha. Read-only frontend. */
const DEFAULT_ENTITIES = {
  pv1_power: 'sensor.ss_pv1_power',
  pv2_power: 'sensor.ss_pv2_power',
  battery_soc: 'sensor.ss_battery_soc',
  battery_power: 'sensor.ss_battery_power',
  battery_voltage: 'sensor.ss_battery_voltage',
  battery_current: 'sensor.ss_battery_current',
  grid_power: 'sensor.ss_grid_ct_power',
  load_power: 'sensor.ss_load_power',
  inverter_status: 'sensor.ss_overall_state',
  day_pv_energy: 'sensor.ss_day_pv_energy',
  day_load_energy: 'sensor.ss_day_load_energy',
  day_grid_import: 'sensor.ss_day_grid_import',
  day_grid_export: 'sensor.ss_day_grid_export'
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class JarvisPowerFlowCard extends HTMLElement {
  static getStubConfig() { return {type:'custom:jarvis-power-flow-card', entities:{...DEFAULT_ENTITIES}}; }
  setConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Invalid JARVIS configuration');
    this.config = {
      title:'J.A.R.V.I.S. / ENERGY COMMAND',
      minimum_flow_w:40, grid_positive_is_import:true,
      battery_positive_is_discharge:null, ...config,
      entities:{...DEFAULT_ENTITIES,...(config.entities || {})}
    };
    if (!this.shadowRoot) this.attachShadow({mode:'open'});
    this.render();
  }
  set hass(hass) { this._hass=hass; if (this.config) this.render(); }
  getCardSize() { return 6; }
  getGridOptions() { return {columns:12,rows:6,min_columns:6,min_rows:4}; }
  state(key) {
    const id=this.config.entities[key];
    const s=id && this._hass?.states?.[id];
    if (!s || ['unavailable','unknown','none',''].includes(String(s.state).toLowerCase())) return null;
    const n=Number(s.state);
    return Number.isFinite(n) ? {value:n,unit:s.attributes?.unit_of_measurement || ''} : null;
  }
  watts(key) {
    const s=this.state(key);
    return s ? s.value*(s.unit==='kW'?1000:1) : null;
  }
  text(key) {
    const id=this.config.entities[key];
    const s=id && this._hass?.states?.[id];
    return s && !['unknown','unavailable'].includes(String(s.state).toLowerCase()) ? s.state : 'Unavailable';
  }
  fmtPower(w) { return w===null ? '—' : Math.abs(w)>=1000 ? (w/1000).toFixed(2)+' kW' : Math.round(w)+' W'; }
  fmtEnergy(key) {
    const s=this.state(key);
    return s ? (s.value/(s.unit==='Wh'?1000:1)).toFixed(1)+' kWh' : '—';
  }
  path(x1,y1,x2,y2,color,active,reverse=false) {
    const d=`M ${x1} ${y1} L ${x2} ${y2}`;
    return `<path d="${d}" stroke="${color}" stroke-width="7" opacity=".2" fill="none"/>
      <path d="${d}" class="flow ${active?'active':''} ${reverse?'reverse':''}" stroke="${color}" fill="none"/>`;
  }
  render() {
    if (!this.shadowRoot || !this.config) return;
    const pv1=this.watts('pv1_power'),pv2=this.watts('pv2_power');
    const solar=pv1===null&&pv2===null?null:(pv1||0)+(pv2||0);
    const home=this.watts('load_power'),grid=this.watts('grid_power'),battery=this.watts('battery_power');
    const soc=this.state('battery_soc')?.value??null;
    const level=soc===null?0:Math.max(0,Math.min(100,soc));
    const threshold=Math.max(0,Number(this.config.minimum_flow_w)||40);
    const battSign=this.config.battery_positive_is_discharge;
    const gridReverse=this.config.grid_positive_is_import ? grid<0 : grid>=0;
    const battReverse=battSign===true?battery<0:battery>=0;
    const status=escapeHtml(this.text('inverter_status'));
    const chip=(name,value)=>`<div class="chip"><small>${escapeHtml(name)}</small><strong>${escapeHtml(value)}</strong></div>`;
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;width:100%;color:#e8f9ff;font-family:Arial,Roboto,sans-serif}
      ha-card{display:block;overflow:hidden;border:1px solid #17c7ed;border-radius:16px;
        background:radial-gradient(ellipse at 50% 10%,#123653 0%,#061727 60%,#020a14 100%);
        box-shadow:0 0 22px #0dc9fa24,inset 0 0 35px #16cffa15}
      .shell{padding:15px 18px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;
        border-bottom:1px solid #247a97;padding-bottom:12px}
      .eyebrow{color:#6bdaef;font-size:10px;letter-spacing:2px;font-weight:bold}
      h2{font-size:clamp(16px,2.4vw,29px);letter-spacing:2px;margin:7px 0 0;color:#b1f3ff;
        text-shadow:0 0 15px #20d7ff77}
      .live{color:#51ec9a;font-weight:bold;font-size:11px;white-space:nowrap}
      svg{display:block;width:100%;height:auto;max-height:460px}
      .panel{fill:#071a2d;stroke-width:2}.title{fill:#a9e8fc;font-size:15px;font-weight:bold;letter-spacing:1px}
      .value{fill:#f0fcff;font-size:24px;font-weight:bold}.sub{fill:#99b9cb;font-size:14px}
      .flow{stroke-width:3;stroke-dasharray:12 14;opacity:.2}
      .flow.active{opacity:1;animation:travel 1.6s linear infinite;filter:drop-shadow(0 0 4px currentColor)}
      .flow.reverse{animation-direction:reverse}@keyframes travel{to{stroke-dashoffset:-52}}
      .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .chip{padding:9px;border:1px solid #245775;background:#0a263a;border-radius:8px;min-width:0}
      .chip small{display:block;color:#8bbed1;font-size:10px;margin-bottom:5px}
      .chip strong{font-size:14px}.note{color:#81a4b5;font-size:10px;text-align:right;padding-top:8px}
      @media(max-width:640px){.shell{padding:10px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
        .top{flex-wrap:wrap}}
      @media(prefers-reduced-motion:reduce){.flow.active{animation:none}}
    </style><ha-card><div class="shell"><div class="top"><div><div class="eyebrow">STARK INDUSTRIES / ENERGY TELEMETRY</div>
      <h2>${escapeHtml(this.config.title)}</h2></div><div class="live">● LIVE · READ-ONLY</div></div>
      <svg viewBox="0 0 1000 490" role="img" aria-label="JARVIS home energy flow">
      ${this.path(240,130,410,200,'#ffc83e',solar!==null&&solar>threshold)}
      ${this.path(560,212,750,128,'#48baff',home!==null&&home>threshold)}
      ${this.path(430,278,250,365,'#2ce79b',(battSign===true||battSign===false)&&battery!==null&&Math.abs(battery)>threshold,battReverse)}
      ${this.path(750,366,560,277,'#fb6882',grid!==null&&Math.abs(grid)>threshold,gridReverse)}
      <rect x="18" y="45" width="225" height="180" rx="14" fill="#071a2d" stroke="#ffcb48" stroke-width="2"/>
      <path d="M53 92 L163 65 L194 127 L78 154 Z M78 84 L107 146 M110 76 L142 138 M143 68 L175 130 M65 113 L183 91" fill="none" stroke="#ffc83e" stroke-width="4"/>
      <text x="49" y="187" class="title">SOLAR ARRAY</text>
      <text x="49" y="210" class="sub">PV1 ${escapeHtml(this.fmtPower(pv1))} · PV2 ${escapeHtml(this.fmtPower(pv2))}</text>
      <rect x="405" y="163" width="165" height="171" rx="15" fill="#0b3652" stroke="#36dafa" stroke-width="3"/>
      <circle cx="487" cy="247" r="37" fill="none" stroke="#49dfff" stroke-width="3"/>
      <path d="M492 214 L463 257 H487 L477 281 L514 238 H488 Z" fill="#8deeff"/>
      <text x="487" y="149" text-anchor="middle" class="title">INVERTER</text><text x="487" y="355" text-anchor="middle" class="sub">${status}</text>
      <rect x="747" y="45" width="235" height="180" rx="14" fill="#071a2d" stroke="#59bafd" stroke-width="2"/>
      <path d="M813 130 L865 85 L918 130 M830 118 V174 H901 V118 M853 174 V142 H879 V174" fill="none" stroke="#5dbfff" stroke-width="9"/>
      <text x="865" y="199" text-anchor="middle" class="title">HOME LOAD</text>
      <text x="865" y="222" text-anchor="middle" class="value">${escapeHtml(this.fmtPower(home))}</text>
      <rect x="18" y="282" width="240" height="180" rx="14" fill="#071a2d" stroke="#27eaa2" stroke-width="2"/>
      <rect x="45" y="312" width="64" height="118" rx="7" fill="#071c2b" stroke="#32e99c" stroke-width="3"/>
      <rect x="55" y="${421-level}" width="44" height="${level}" fill="#30e99a" rx="2"/>
      <text x="130" y="335" class="title">BATTERY</text><text x="130" y="380" class="value">${soc===null?'—':escapeHtml(Math.round(soc)+'%')}</text>
      <text x="130" y="408" class="sub">${escapeHtml(this.fmtPower(battery))}</text>
      <text x="130" y="433" class="sub">${escapeHtml(this.state('battery_voltage')?.value?.toFixed(1)??'—')} V</text>
      <rect x="747" y="282" width="235" height="180" rx="14" fill="#071a2d" stroke="#fb6882" stroke-width="2"/>
      <path d="M865 308 L806 426 H924 Z M821 360 H907 M812 388 H917 M866 310 V426" fill="none" stroke="#fb6882" stroke-width="5"/>
      <text x="865" y="449" text-anchor="middle" class="title">GRID ${escapeHtml(this.fmtPower(grid))}</text>
      </svg><div class="metrics">
      ${chip('SOLAR TODAY',this.fmtEnergy('day_pv_energy'))}
      ${chip('HOME TODAY',this.fmtEnergy('day_load_energy'))}
      ${chip('GRID IMPORT TODAY',this.fmtEnergy('day_grid_import'))}
      ${chip('GRID EXPORT TODAY',this.fmtEnergy('day_grid_export'))}
      </div><div class="note">Grid polarity is assumed. Battery direction animation is disabled until verified.</div>
      </div></ha-card>`;
  }
}
if (!customElements.get('jarvis-power-flow-card')) customElements.define('jarvis-power-flow-card',JarvisPowerFlowCard);
window.customCards=window.customCards||[];
if (!window.customCards.some(c=>c.type==='jarvis-power-flow-card'))
  window.customCards.push({type:'jarvis-power-flow-card',name:'JARVIS Power Flow',description:'Read-only custom Sunsynk SVG energy diagram'});
