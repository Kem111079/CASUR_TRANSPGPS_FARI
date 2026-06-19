/* CASUR Transportes GPS V5.8 Conductor Envío
   PWA de campo para recorridos, lotes/fincas, paradas y exportación operativa.
   Sin backend. Rastreo manual, visible y controlado por el usuario. */
(function(){
  'use strict';

  const APP_VERSION = (window.CASUR_BOOT && window.CASUR_BOOT.version) || '5.8.0-conductor-envio';
  const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === '1' || /(^|#)demo(=1)?/i.test(window.location.hash || '');
  const STORAGE_ACTIVE = 'casur_transportes_active_trip_v4';
  const STORAGE_HISTORY = 'casur_transportes_history_v4';
  const STORAGE_CFG = 'casur_transportes_cfg_v4';
  const TECHNICAL_BADGE_IDS = new Set(['shapeBadge','saveBadge']);
  const STORAGE_REFS = 'casur_transportes_referencias_v4';
  const STORAGE_FOLIO = 'casur_transportes_folio_v4';
  const STORAGE_MODE = 'casur_transportes_ui_mode_v5';
  const STORAGE_DEVICE = 'casur_transportes_device_id_v5';
  const LEGACY_STORAGE_ACTIVE = 'casur_transportes_active_trip_v3';
  const LEGACY_STORAGE_HISTORY = 'casur_transportes_history_v3';
  const LEGACY_STORAGE_CFG = 'casur_transportes_cfg_v3';
  const LEGACY_STORAGE_REFS = 'casur_transportes_referencias_v3';
  const MAX_HISTORY = 300;
  const MAX_POINT_ASSIGN_FEATURES = 12000;

  const $ = (id) => document.getElementById(id);
  const el = {
    bootMsg: $('bootMsg'), appShell: $('appShell'), mapWrap: $('mapWrap'), map: $('map'), gpsBadge: $('gpsBadge'), refBadge: $('refBadge'), shapeBadge: $('shapeBadge'), saveBadge: $('saveBadge'),
    btnInstall: $('btnInstall'), btnMode: $('btnMode'), roleTopChip: $('roleTopChip'), panelEyebrow: $('panelEyebrow'), panelTitle: $('panelTitle'), roleBanner: $('roleBanner'), roleSymbol: $('roleSymbol'), roleTitle: $('roleTitle'), roleSubtitle: $('roleSubtitle'), supTripCount: $('supTripCount'), supPendingCount: $('supPendingCount'), supKmTotal: $('supKmTotal'), supLastFolio: $('supLastFolio'), btnLocate: $('btnLocate'), btnFitRoute: $('btnFitRoute'), btnToggleNorth: $('btnToggleNorth'), btnToggleLots: $('btnToggleLots'), compassBox: $('compassBox'),
    panel: $('controlPanel'), btnCollapse: $('btnCollapse'), panelGrip: $('panelGrip'),
    mDistance: $('mDistance'), mDuration: $('mDuration'), mSpeed: $('mSpeed'), mStops: $('mStops'),
    driver: $('driver'), plate: $('plate'), equipment: $('equipment'), tripType: $('tripType'), origin: $('origin'), destination: $('destination'), initialNote: $('initialNote'),
    cfgMinSec: $('cfgMinSec'), cfgMinMeters: $('cfgMinMeters'), cfgStopMin: $('cfgStopMin'), cfgStopSpeed: $('cfgStopSpeed'), cfgBadAcc: $('cfgBadAcc'), cfgGapMin: $('cfgGapMin'),
    btnStart: $('btnStart'), btnStop: $('btnStop'), btnRestartGps: $('btnRestartGps'), btnSaveCheckpoint: $('btnSaveCheckpoint'), btnMarkPlace: $('btnMarkPlace'), btnDriverData: $('btnDriverData'), btnDriverSend: $('btnDriverSend'),
    autoReading: $('autoReading'), contextBox: $('contextBox'), locationLine: $('locationLine'),
    btnExcel: $('btnExcel'), btnReport: $('btnReport'), btnWhatsapp: $('btnWhatsapp'), btnCard: $('btnCard'), btnPdf: $('btnPdf'), btnShare: $('btnShare'),
    historyList: $('historyList'), btnClearHistory: $('btnClearHistory'), btnNewTrip: $('btnNewTrip'), btnExportAll: $('btnExportAll'),
    exportBlock: $('exportBlock'), historyBlock: $('historyBlock'), advancedBlock: $('advancedBlock'), tripDataBlock: $('tripDataBlock'), summaryBlock: $('summaryBlock'), driverGuide: $('driverGuide'),
    activeBar: $('activeBar'), activeBarText: $('activeBarText'), btnStopBar: $('btnStopBar'), toast: $('toast'),
    demoBar: $('demoBar'), btnDemoGuided: $('btnDemoGuided'), btnDemoInstant: $('btnDemoInstant'), btnDemoFinish: $('btnDemoFinish'), btnDemoClear: $('btnDemoClear'), demoStatus: $('demoStatus')
  };

  const state = {
    map:null,
    lotsLayer:null,
    routeLayer:null,
    arrowLayer:null,
    markerLayer:null,
    lastKnownMarker:null,
    referenceLayer:null,
    currentPosition:null,
    currentContext:null,
    lotsVisible:true,
    lotsGeojson:null,
    lotFeatures:[],
    references:[],
    watchId:null,
    activeTrip:null,
    history:[],
    timer:null,
    deferredInstall:null,
    isHidden:false,
    lastVisibilityHiddenAt:null,
    routeFitDone:false,
    mode:'driver',
    logoDataUrl:null,
    wakeLock:null,
    wakeLockWanted:false,
    followMode:true,
    demoMode: DEMO_MODE,
    demoTimer:null,
    demoRunning:false,
    demoIndex:0,
    demoPoints:[],
    demoLastPhase:null
  };

  const defaultCfg = {
    minSec:4,
    minMeters:8,
    stopMin:3,
    stopSpeed:3,
    badAcc:60,
    gapMin:3,
    nearbyLotRadius:120,
    referenceRadius:350
  };

  function nowIso(){ return new Date().toISOString(); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function localStamp(dateLike){
    const d = dateLike ? new Date(dateLike) : new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function fileStamp(dateLike){
    const d = dateLike ? new Date(dateLike) : new Date();
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  function safeName(s){ return String(s||'SIN_DATO').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48) || 'SIN_DATO'; }
  function getDeviceId(){
    let id = localStorage.getItem(STORAGE_DEVICE);
    if(!id){
      id = 'DEV_' + fileStamp() + '_' + Math.random().toString(36).slice(2,8).toUpperCase();
      localStorage.setItem(STORAGE_DEVICE, id);
    }
    return id;
  }
  function simpleHash(str){
    str = String(str || '');
    let h = 2166136261;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16).toUpperCase()).slice(-8);
  }
  function nextFolio(fields){
    fields = fields || {};
    const ident = safeName(fields.placa || fields.equipo || fields.conductor || 'MOVIL');
    const folio = `CASUR_${ident}_${fileStamp()}`;
    const n = parseInt(localStorage.getItem(STORAGE_FOLIO) || '0', 10) || 0;
    localStorage.setItem(STORAGE_FOLIO, String(n + 1));
    return folio;
  }
  async function loadLogoDataUrl(){
    if(state.logoDataUrl) return state.logoDataUrl;
    try{
      const res = await fetch('assets/logo_casur.png', { cache:'force-cache' });
      if(!res.ok) throw new Error('logo no disponible');
      const blob = await res.blob();
      state.logoDataUrl = await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(blob); });
    }catch(e){ console.warn('Logo CASUR no cargado para PDF', e); state.logoDataUrl = null; }
    return state.logoDataUrl;
  }
  function fmtKm(m){ return `${(Number(m||0)/1000).toFixed(2)} km`; }
  function fmtKmh(v){ return `${Number(v||0).toFixed(1)} km/h`; }
  function fmtMeters(v){ return `${Number(v||0).toFixed(0)} m`; }
  function durationMs(start, end){ if(!start) return 0; return Math.max(0, new Date(end || nowIso()) - new Date(start)); }
  function fmtDuration(ms){
    ms = Math.max(0, Number(ms||0));
    const s = Math.floor(ms/1000); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }
  function fmtDurationText(ms){
    ms = Math.max(0, Number(ms||0));
    const totalMin = Math.round(ms/60000);
    const h = Math.floor(totalMin/60); const m = totalMin%60;
    if(h && m) return `${h}h ${m}min`;
    if(h) return `${h}h`;
    return `${m}min`;
  }
  function degToCompass(deg){
    if(deg===null || deg===undefined || Number.isNaN(Number(deg))) return 'Sin rumbo';
    const dirs = ['N','NE','E','SE','S','SO','O','NO'];
    return dirs[Math.round((((Number(deg)%360)+360)%360)/45)%8];
  }
  function toast(msg, ms=3200){
    el.toast.textContent = msg; el.toast.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(()=>el.toast.classList.add('hidden'), ms);
  }
  function setBadge(node, text, kind){
    if(!node) return;
    node.textContent = text;
    // Estos indicadores son técnicos. Se actualizan internamente, pero nunca deben volver a aparecer en la vista de campo.
    if(TECHNICAL_BADGE_IDS.has(node.id)){
      node.className = 'hidden';
      node.setAttribute('aria-hidden','true');
      node.style.display = 'none';
      return;
    }
    const hidden = node.classList.contains('soft-hidden') || node.classList.contains('hidden') ? ' hidden' : '';
    node.className = `badge ${kind || 'neutral'}${hidden}`;
  }
  function on(node, ev, fn, opts){ if(node) node.addEventListener(ev, fn, opts || false); }
  function setPanelCollapsed(collapsed){
    if(!el.panel) return;
    el.panel.classList.toggle('collapsed', !!collapsed);
    el.panel.classList.toggle('expanded', !collapsed);
    document.body.classList.toggle('panel-open', !collapsed);
    if(el.btnCollapse) el.btnCollapse.textContent = collapsed ? '⌃' : '⌄';
    if(state.map) setTimeout(()=>state.map.invalidateSize(), 180);
  }
  function collapsePanel(){ setPanelCollapsed(true); }
  function expandPanel(){ setPanelCollapsed(false); }
  function togglePanel(){ setPanelCollapsed(!el.panel.classList.contains('collapsed')); }
  function openDriverBlocks(){
    // En modo conductor, lo esencial debe quedar accesible siempre: captura de datos y envío/exportación.
    if(el.tripDataBlock) el.tripDataBlock.open = true;
    if(el.summaryBlock) el.summaryBlock.open = !!(state.activeTrip || latestTrip());
    if(el.exportBlock) el.exportBlock.open = true;
  }
  function openSupervisorBlocks(){
    if(el.historyBlock) el.historyBlock.open = true;
    if(el.advancedBlock) el.advancedBlock.open = true;
    if(el.exportBlock) el.exportBlock.open = true;
    if(el.summaryBlock) el.summaryBlock.open = true;
  }
  function showDriverData(){
    setMode('driver');
    expandPanel();
    if(el.tripDataBlock) el.tripDataBlock.open = true;
    if(el.summaryBlock && !state.activeTrip) el.summaryBlock.open = false;
    setTimeout(()=>{
      try{ (el.tripDataBlock || el.driver || el.panel).scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
      if(el.driver && !el.driver.value) el.driver.focus({preventScroll:true});
    }, 80);
    toast('Ingrese conductor, placa/equipo, origen y destino. Luego active GPS e inicie el recorrido.');
  }
  function showDriverSend(){
    setMode('driver');
    expandPanel();
    if(el.summaryBlock) el.summaryBlock.open = true;
    if(el.exportBlock) el.exportBlock.open = true;
    const trip = state.activeTrip || latestTrip();
    setTimeout(()=>{ try{ (el.exportBlock || el.panel).scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){} }, 80);
    if(state.activeTrip){
      toast('El recorrido está activo. Puede descargar respaldo parcial, pero lo recomendable es finalizar antes de enviar.');
    } else if(trip){
      toast('Listo para enviar o descargar el último recorrido.');
    } else {
      toast('Aún no hay recorrido para enviar. Primero registre y finalice un recorrido.');
    }
  }
  function getCfg(){
    return {
      minSec: clamp(parseFloat(el.cfgMinSec.value), 2, 30, defaultCfg.minSec),
      minMeters: clamp(parseFloat(el.cfgMinMeters.value), 3, 100, defaultCfg.minMeters),
      stopMin: clamp(parseFloat(el.cfgStopMin.value), 1, 30, defaultCfg.stopMin),
      stopSpeed: clamp(parseFloat(el.cfgStopSpeed.value), 0, 10, defaultCfg.stopSpeed),
      badAcc: clamp(parseFloat(el.cfgBadAcc.value), 20, 300, defaultCfg.badAcc),
      gapMin: clamp(parseFloat(el.cfgGapMin.value), 1, 60, defaultCfg.gapMin),
      nearbyLotRadius: defaultCfg.nearbyLotRadius,
      referenceRadius: defaultCfg.referenceRadius
    };
  }
  function clamp(v,min,max,fallback){ v=Number(v); if(!Number.isFinite(v)) return fallback; return Math.min(max, Math.max(min, v)); }
  function saveCfg(){ localStorage.setItem(STORAGE_CFG, JSON.stringify(getCfg())); }
  function loadCfg(){
    try{
      const cfg = Object.assign({}, defaultCfg, JSON.parse(localStorage.getItem(STORAGE_CFG) || localStorage.getItem(LEGACY_STORAGE_CFG) || '{}'));
      el.cfgMinSec.value = cfg.minSec; el.cfgMinMeters.value = cfg.minMeters; el.cfgStopMin.value = cfg.stopMin;
      el.cfgStopSpeed.value = cfg.stopSpeed; el.cfgBadAcc.value = cfg.badAcc; el.cfgGapMin.value = cfg.gapMin;
    }catch(e){ console.warn(e); }
  }

  // -------------------- Geografía --------------------
  function haversine(a,b){
    if(!a || !b) return 0;
    const R = 6371000, toRad = d => Number(d) * Math.PI / 180;
    const dLat = toRad(b.lat-a.lat), dLng = toRad(b.lng-a.lng);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
    const x = s1*s1 + Math.cos(lat1)*Math.cos(lat2)*s2*s2;
    return 2*R*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
  function bearing(a,b){
    if(!a || !b) return null;
    const toRad = d => d*Math.PI/180, toDeg = r => r*180/Math.PI;
    const y = Math.sin(toRad(b.lng-a.lng))*Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat))*Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.cos(toRad(b.lng-a.lng));
    return (toDeg(Math.atan2(y,x)) + 360) % 360;
  }
  function pointInRing(pt, ring){
    const x = pt.lng, y = pt.lat;
    let inside = false;
    for(let i=0,j=ring.length-1; i<ring.length; j=i++){
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj-xi) * (y-yi) / ((yj-yi) || 1e-12) + xi);
      if(intersect) inside = !inside;
    }
    return inside;
  }
  function pointInPolygonCoords(pt, coords){
    if(!coords || !coords.length) return false;
    if(!pointInRing(pt, coords[0])) return false;
    for(let i=1;i<coords.length;i++){ if(pointInRing(pt, coords[i])) return false; }
    return true;
  }
  function pointInFeature(pt, feature){
    const g = feature && feature.geometry;
    if(!g) return false;
    if(g.type === 'Polygon') return pointInPolygonCoords(pt, g.coordinates);
    if(g.type === 'MultiPolygon') return g.coordinates.some(poly => pointInPolygonCoords(pt, poly));
    return false;
  }

  function eachCoord(geom, cb){
    if(!geom) return;
    if(geom.type === 'Polygon') geom.coordinates.forEach(ring => ring.forEach(c => cb(c)));
    else if(geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(c => cb(c))));
  }
  function featureBBox(feature){
    let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;
    eachCoord(feature && feature.geometry, c => { const lng=Number(c[0]), lat=Number(c[1]); if(Number.isFinite(lat)&&Number.isFinite(lng)){ minLng=Math.min(minLng,lng); maxLng=Math.max(maxLng,lng); minLat=Math.min(minLat,lat); maxLat=Math.max(maxLat,lat); } });
    return Number.isFinite(minLng) ? [minLng,minLat,maxLng,maxLat] : null;
  }
  function pointToBBoxDistanceM(pt, bbox){
    if(!pt || !bbox) return Infinity;
    const lng = Math.max(bbox[0], Math.min(bbox[2], pt.lng));
    const lat = Math.max(bbox[1], Math.min(bbox[3], pt.lat));
    return haversine(pt, {lat,lng});
  }
  function normalizeContext(c){
    if(!c) return { tipo:'Sin referencia', lugar:'Sin referencia', finca:'', lote:'', zona:'', distanciaM:null, fuente:'' };
    c.finca = c.finca || ''; c.lote = c.lote || ''; c.zona = c.zona || '';
    c.tipo = c.tipo || (c.finca || c.lote ? 'Lote/Finca' : 'Referencia');
    c.lugar = c.lugar || (c.finca || c.lote ? `${c.finca || 'Sin finca'}${c.lote ? ' · Lote '+c.lote : ''}` : 'Sin referencia');
    return c;
  }
  function propAny(props, keys){
    props = props || {};
    for(const k of keys){
      if(Object.prototype.hasOwnProperty.call(props,k) && props[k] !== null && props[k] !== undefined && String(props[k]).trim() !== '') return props[k];
    }
    const lower = Object.fromEntries(Object.entries(props).map(([k,v]) => [k.toLowerCase(), v]));
    for(const k of keys){
      const v = lower[k.toLowerCase()];
      if(v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return '';
  }
  function lotInfoFromFeature(feature){
    const p = feature && feature.properties || {};
    return {
      finca: String(propAny(p, ['Finca','Nombre_Hacienda','FINCA','Hacienda','HACIENDA','MP_Finca','MP_FINCA','MP_Nom_Fin','MP_NOM_FIN','NOMBRE_FIN','Nombre_Finca','Zona','MP_ZONA']) || 'Sin finca'),
      lote: String(propAny(p, ['CodSuerte','Codsuerte','CODSUERTE','MP_Cod_Lot','MP_Cod_Lote','MP_COD_LOT','Codigo','CODIGO','Lote','LOTE','Suerte','Cod_Lote','ID_LOTE']) || 'Sin lote'),
      zona: String(propAny(p, ['MP_ZONA','Zona','ZONA','Sector','SECTOR']) || ''),
      area: propAny(p, ['Area_Ha','Area','AREA','AREA_HA','Ha','Hectareas','HECTAREAS','MP_AREA']) || ''
    };
  }
  function locateLot(pt){
    if(!pt || !state.lotFeatures.length) return null;
    const features = state.lotFeatures.length > MAX_POINT_ASSIGN_FEATURES ? state.lotFeatures.slice(0, MAX_POINT_ASSIGN_FEATURES) : state.lotFeatures;
    for(const f of features){
      if(f._bbox && pointToBBoxDistanceM(pt, f._bbox) > 2) continue;
      if(pointInFeature(pt, f)) return Object.assign(lotInfoFromFeature(f), { tipo:'Lote/Finca', distanciaM:0, fuente:'Shape CASUR' });
    }
    return null;
  }
  function locateNearbyLot(pt, radiusM){
    if(!pt || !state.lotFeatures.length) return null;
    const limit = radiusM || defaultCfg.nearbyLotRadius;
    let best=null;
    const features = state.lotFeatures.length > MAX_POINT_ASSIGN_FEATURES ? state.lotFeatures.slice(0, MAX_POINT_ASSIGN_FEATURES) : state.lotFeatures;
    for(const f of features){
      const d = pointToBBoxDistanceM(pt, f._bbox);
      if(d <= limit && (!best || d < best.distanciaM)) best = Object.assign(lotInfoFromFeature(f), { tipo:'Cerca de lote/finca', distanciaM:round(d,0), fuente:'Shape CASUR cercano' });
    }
    return best;
  }
  function locateOperationalReference(pt, radiusM){
    if(!pt || !state.references.length) return null;
    const limit = radiusM || defaultCfg.referenceRadius;
    let best=null;
    for(const r of state.references){
      if(!Number.isFinite(Number(r.lat)) || !Number.isFinite(Number(r.lng))) continue;
      const d = haversine(pt, {lat:Number(r.lat), lng:Number(r.lng)});
      if(d <= limit && (!best || d < best.distanciaM)) best = Object.assign({}, r, { tipo:r.tipo || 'Referencia', lugar:r.nombre || 'Referencia operativa', distanciaM:round(d,0), fuente:r.source || 'Referencia local' });
    }
    return best;
  }
  function resolveContext(pt){
    const inside = locateLot(pt);
    if(inside) return normalizeContext(Object.assign(inside, { lugar:`${inside.finca} · Lote ${inside.lote}` }));
    const near = locateNearbyLot(pt, defaultCfg.nearbyLotRadius);
    if(near) return normalizeContext(Object.assign(near, { lugar:`Cerca de ${near.finca} · Lote ${near.lote}` }));
    const ref = locateOperationalReference(pt, defaultCfg.referenceRadius);
    if(ref) return normalizeContext(ref);
    return normalizeContext(null);
  }
  function contextForExport(c){
    c = normalizeContext(c);
    const dist = c.distanciaM !== null && c.distanciaM !== undefined ? ` (${Math.round(c.distanciaM)} m)` : '';
    return `${c.lugar || 'Sin referencia'}${dist}`;
  }
  function routeLotSummary(trip){
    const map = new Map();
    const pts = trip.points || [];
    for(let i=0;i<pts.length;i++){
      const p = pts[i];
      const key = `${p.finca || 'Sin finca'}|${p.lote || 'Sin lote'}`;
      if(!p.finca && !p.lote) continue;
      if(!map.has(key)) map.set(key, { finca:p.finca||'Sin finca', lote:p.lote||'Sin lote', zona:p.zona||'', first:p.timestamp, last:p.timestamp, points:0, distanceM:0 });
      const r = map.get(key);
      r.last = p.timestamp; r.points += 1;
      if(i>0){
        const prev = pts[i-1];
        if((prev.finca||'') === (p.finca||'') && (prev.lote||'') === (p.lote||'')) r.distanceM += haversine(prev,p);
      }
    }
    return Array.from(map.values()).sort((a,b)=>b.points-a.points);
  }

  function routePlaceSummary(trip){
    const map = new Map();
    const pts = trip.points || [];
    for(let i=0;i<pts.length;i++){
      const p = pts[i];
      const lugar = p.referencia || (p.finca || p.lote ? `${p.finca || 'Sin finca'} · Lote ${p.lote || 'Sin lote'}` : 'Sin referencia');
      const tipo = p.tipoReferencia || (p.finca || p.lote ? 'Lote/Finca' : 'Sin referencia');
      const key = `${tipo}|${lugar}`;
      if(!map.has(key)) map.set(key, { lugar, tipo, finca:p.finca||'', lote:p.lote||'', zona:p.zona||'', first:p.timestamp, last:p.timestamp, points:0, distanceM:0 });
      const r = map.get(key);
      r.last = p.timestamp; r.points += 1;
      if(i>0){
        const prev = pts[i-1];
        const prevLugar = prev.referencia || (prev.finca || prev.lote ? `${prev.finca || 'Sin finca'} · Lote ${prev.lote || 'Sin lote'}` : 'Sin referencia');
        if(prevLugar === lugar) r.distanceM += haversine(prev,p);
      }
    }
    return Array.from(map.values()).sort((a,b)=>b.points-a.points);
  }

  // -------------------- Mapa --------------------
  async function initMap(){
    if(!window.L){ throw new Error('Leaflet no está disponible'); }
    state.map = L.map('map', { zoomControl:false, preferCanvas:true }).setView([11.44, -85.83], 12);
    L.control.zoom({ position:'bottomleft' }).addTo(state.map);
    state.map.on('click', ()=>{ if(el.panel && !el.panel.classList.contains('collapsed')) collapsePanel(); });
    state.map.on('dragstart', ()=>{ if(state.activeTrip) state.followMode = false; });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:20, attribution:'&copy; OpenStreetMap' });
    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:20, attribution:'Tiles &copy; Esri' });
    esri.addTo(state.map);
    L.control.layers({ 'Satélite':esri, 'Mapa':osm }, {}, { position:'topright', collapsed:true }).addTo(state.map);
    state.routeLayer = L.layerGroup().addTo(state.map);
    state.arrowLayer = L.layerGroup().addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);
    state.referenceLayer = L.layerGroup().addTo(state.map);
    await loadReferences();
    await loadLots();
    setTimeout(()=>state.map.invalidateSize(), 250);
  }
  async function loadLots(){
    try{
      const res = await fetch('data/poligonos_casur.geojson?v=5.7.0', { cache:'no-store' });
      if(!res.ok) throw new Error('GeoJSON no disponible');
      state.lotsGeojson = await res.json();
      state.lotFeatures = (state.lotsGeojson.features || []).filter(f => f.geometry && ['Polygon','MultiPolygon'].includes(f.geometry.type));
      state.lotFeatures.forEach(f => { f._bbox = featureBBox(f); f._lotInfo = lotInfoFromFeature(f); });
      state.lotsLayer = L.geoJSON(state.lotsGeojson, {
        style: lotStyle,
        onEachFeature: function(feature, layer){
          const info = lotInfoFromFeature(feature);
          layer.bindPopup(`<b>${escapeHtml(info.finca)}</b><br>Lote: ${escapeHtml(info.lote)}${info.zona ? `<br>Zona: ${escapeHtml(info.zona)}` : ''}${info.area ? `<br>Área: ${escapeHtml(info.area)}` : ''}`);
        }
      }).addTo(state.map);
      setBadge(el.shapeBadge, `${state.lotFeatures.length.toLocaleString('es-NI')} lotes/fincas cargados`, 'ok');
      try { state.map.fitBounds(state.lotsLayer.getBounds(), { padding:[20,20] }); } catch(e) {}
    }catch(e){
      console.warn(e);
      setBadge(el.shapeBadge, 'Sin capa de lotes', 'warn');
      toast('No se pudo cargar la capa de lotes/fincas. La ruta GPS seguirá funcionando.');
    }
  }
  async function loadReferences(){
    const local = loadLocalReferences();
    let defaults = [];
    try{
      const res = await fetch('data/referencias_operativas.json?v=5.7.0', { cache:'no-store' });
      if(res.ok){ const json = await res.json(); defaults = Array.isArray(json) ? json : (json.referencias || []); }
    }catch(e){ console.warn('Referencias operativas no cargadas', e); }
    const all = [];
    const seen = new Set();
    defaults.concat(local).forEach(r=>{
      const id = r.id || `${r.nombre || 'ref'}_${r.lat}_${r.lng}`;
      if(!seen.has(id)){ seen.add(id); all.push(Object.assign({id, source:'Referencia local'}, r)); }
    });
    state.references = all.filter(r => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)));
    drawReferences();
  }
  function loadLocalReferences(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_REFS) || localStorage.getItem(LEGACY_STORAGE_REFS) || '[]') || []; }
    catch(e){ return []; }
  }
  function saveLocalReferences(){
    const local = state.references.filter(r => (r.source || '').includes('local') || (r.source || '').includes('usuario') || r.manual);
    localStorage.setItem(STORAGE_REFS, JSON.stringify(local.slice(-500)));
  }
  function drawReferences(){
    if(!state.referenceLayer) return;
    state.referenceLayer.clearLayers();
    state.references.forEach(r=>{
      L.marker([Number(r.lat),Number(r.lng)], { icon:L.divIcon({ html:'<div class="ref-marker">⌖</div>', className:'', iconSize:[26,26], iconAnchor:[13,13] }) })
        .bindPopup(`<b>${escapeHtml(r.nombre || 'Referencia')}</b><br>${escapeHtml(r.tipo || 'Lugar operativo')}<br>${escapeHtml(r.observacion || '')}`)
        .addTo(state.referenceLayer);
    });
  }
  function lotStyle(){ return { color:'#1F6B46', weight:.9, opacity:.55, fillColor:'#D7EADC', fillOpacity:.16 }; }
  function drawTrip(trip, opts={}){
    state.routeLayer.clearLayers(); state.arrowLayer.clearLayers(); state.markerLayer.clearLayers();
    const pts = trip && trip.points || [];
    if(!pts.length) return;
    const latlngs = pts.map(p => [p.lat,p.lng]);
    L.polyline(latlngs, { color:'#F2B705', weight:5, opacity:.98 }).addTo(state.routeLayer);
    L.polyline(latlngs, { color:'#123C2C', weight:2, opacity:.98 }).addTo(state.routeLayer);
    addRouteArrows(pts);
    addSpecialMarkers(trip);
    const last = pts[pts.length-1];
    const markerHtml = `<div class="vehicle-marker"><span style="transform:rotate(${last.heading || 0}deg)">➤</span></div>`;
    state.lastKnownMarker = L.marker([last.lat,last.lng], { icon:L.divIcon({ html:markerHtml, className:'', iconSize:[28,28], iconAnchor:[14,14] }) })
      .bindPopup(`<b>Última posición</b><br>${localStamp(last.timestamp)}<br>Velocidad: ${fmtKmh(last.speedKmh)}<br>Rumbo: ${Number(last.heading||0).toFixed(0)}° ${degToCompass(last.heading)}<br>${escapeHtml(last.referencia || contextText(last))}`)
      .addTo(state.markerLayer);
    if(opts.fit || !state.routeFitDone){ fitRoute(); state.routeFitDone = true; }
  }
  function addRouteArrows(pts){
    if(pts.length < 2) return;
    const step = Math.max(1, Math.floor(pts.length / 14));
    for(let i=1; i<pts.length; i+=step){
      const p = pts[i], prev = pts[i-1];
      const brg = bearing(prev,p) || p.heading || 0;
      const html = `<div class="route-arrow" style="transform:rotate(${brg}deg)">➤</div>`;
      L.marker([p.lat,p.lng], { icon:L.divIcon({ html, className:'', iconSize:[20,20], iconAnchor:[10,10] }), interactive:false }).addTo(state.arrowLayer);
    }
  }
  function addSpecialMarkers(trip){
    const pts = trip.points || [];
    if(!pts.length) return;
    L.marker([pts[0].lat, pts[0].lng], { icon:L.divIcon({ html:'<div class="stop-marker start-marker">I</div>', className:'', iconSize:[24,24], iconAnchor:[12,12] }) })
      .bindPopup('<b>Inicio del recorrido</b><br>'+localStamp(pts[0].timestamp)).addTo(state.markerLayer);
    const last = pts[pts.length-1];
    if(trip.endedAt){
      L.marker([last.lat, last.lng], { icon:L.divIcon({ html:'<div class="stop-marker end-marker">F</div>', className:'', iconSize:[24,24], iconAnchor:[12,12] }) })
        .bindPopup('<b>Fin del recorrido</b><br>'+localStamp(last.timestamp)).addTo(state.markerLayer);
    }
    (trip.stops || []).forEach((s, idx)=>{
      L.marker([s.lat, s.lng], { icon:L.divIcon({ html:`<div class="stop-marker">${idx+1}</div>`, className:'', iconSize:[24,24], iconAnchor:[12,12] }) })
        .bindPopup(`<b>Parada ${idx+1}</b><br>${fmtDurationText(s.durationMs)}<br>${localStamp(s.start)} - ${localStamp(s.end)}<br>${escapeHtml(s.referencia || contextText(s))}`)
        .addTo(state.markerLayer);
    });
    (trip.checkpoints || []).forEach((c, idx)=>{
      L.marker([c.lat, c.lng], { icon:L.divIcon({ html:`<div class="checkpoint-marker">★</div>`, className:'', iconSize:[24,24], iconAnchor:[12,12] }) })
        .bindPopup(`<b>Punto clave ${idx+1}</b><br>${localStamp(c.timestamp)}<br>${escapeHtml(c.note || '')}`).addTo(state.markerLayer);
    });
  }
  function fitRoute(){
    const trip = state.activeTrip || latestTrip();
    const pts = trip && trip.points || [];
    if(!pts.length || !state.map) return;
    state.followMode = false;
    const b = L.latLngBounds(pts.map(p=>[p.lat,p.lng]));
    state.map.fitBounds(b, { padding:[35,35], maxZoom:18 });
  }
  function toggleLots(){
    if(!state.lotsLayer) return;
    if(state.lotsVisible){ state.map.removeLayer(state.lotsLayer); state.lotsVisible=false; toast('Capa de lotes oculta.'); }
    else { state.lotsLayer.addTo(state.map); state.lotsVisible=true; toast('Capa de lotes visible.'); }
  }

  // -------------------- Recorrido --------------------
  function buildTrip(){
    const cfg = getCfg(); saveCfg();
    const fields = {
      conductor: clean(el.driver.value), placa: clean(el.plate.value), equipo: clean(el.equipment.value), tipoViaje: el.tripType.value,
      origen: clean(el.origin.value), destino: clean(el.destination.value), observacionInicial: clean(el.initialNote.value), observacionFinal:''
    };
    const deviceId = getDeviceId();
    return {
      id: `CASUR-${Date.now()}`,
      folio: nextFolio(fields),
      deviceId,
      version: APP_VERSION,
      status:'active',
      syncStatus:'activo_local',
      synced:false,
      hashLocal:'',
      createdAt: nowIso(), startedAt:null, endedAt:null,
      fields,
      cfg, points:[], rawCount:0, rejectedCount:0, distanceM:0, maxSpeedKmh:0,
      stops:[], stopCandidate:null, checkpoints:[], events:[], quality:{ good:0, regular:0, poor:0, avgAcc:0 },
      startContext:null, endContext:null, lastSavedAt:null, lastRaw:null
    };
  }
  function clean(s){ return String(s||'').trim(); }
  function startTrip(){
    if(state.activeTrip){ toast('Ya existe un recorrido activo. Finalícelo antes de iniciar otro.'); return; }
    const faltan = [];
    if(!clean(el.driver.value)) faltan.push('Conductor');
    if(!clean(el.plate.value)) faltan.push('Placa');
    if(faltan.length){
      const seguir = confirm(`Para un control completo conviene registrar: ${faltan.join(' y ')}.\n\n¿Iniciar el recorrido de todos modos?`);
      if(!seguir){ expandPanel(); toast('Complete los datos del viaje y vuelva a iniciar.'); return; }
    }
    state.activeTrip = buildTrip();
    state.routeFitDone = false;
    state.followMode = true;
    setActiveUi(true);
    saveActiveTrip('Inicio de recorrido');
    requestWakeLock();
    toast(`Recorrido ${state.activeTrip.folio} creado. Mantenga la app abierta; la pantalla se quedará encendida. Solicitando GPS…`, 5200);
    startWatch(true);
  }
  function stopTrip(){
    const trip = state.activeTrip;
    if(!trip){ toast('No hay recorrido activo.'); return; }
    const finalNote = prompt('Observación final del recorrido (opcional):', '') || '';
    trip.fields = trip.fields || {};
    trip.fields.observacionFinal = clean(finalNote);
    closeStopCandidate(trip, nowIso(), true);
    trip.endedAt = nowIso(); trip.status = 'finished';
    const last = trip.points[trip.points.length-1];
    if(last) trip.endContext = { finca:last.finca, lote:last.lote, zona:last.zona, referencia:last.referencia, tipoReferencia:last.tipoReferencia, lat:last.lat, lng:last.lng };
    trip.metrics = computeMetrics(trip);
    trip.syncStatus = 'local_pendiente';
    trip.synced = false;
    trip.deviceId = trip.deviceId || getDeviceId();
    trip.hashLocal = simpleHash(JSON.stringify({ folio:trip.folio, id:trip.id, deviceId:trip.deviceId, startedAt:trip.startedAt, endedAt:trip.endedAt, points:(trip.points||[]).length, distanceM:trip.metrics.distanceM }));
    state.history.unshift(stripRuntime(trip));
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    localStorage.removeItem(STORAGE_ACTIVE);
    stopWatch();
    releaseWakeLock();
    state.activeTrip = null;
    setActiveUi(false);
    if(el.exportBlock) el.exportBlock.open = true;
    drawTrip(trip, { fit:true });
    updateMetrics(trip);
    renderHistory();
    toast('Recorrido finalizado y guardado en historial local. Descargue Excel para respaldo externo.', 5200);
  }
  function stripRuntime(trip){
    const copy = JSON.parse(JSON.stringify(trip));
    delete copy.stopCandidate; delete copy.lastRaw;
    copy.metrics = computeMetrics(copy);
    return copy;
  }
  // -------------------- Wake Lock (pantalla activa en campo) --------------------
  async function requestWakeLock(){
    state.wakeLockWanted = true;
    if(!('wakeLock' in navigator)) return;
    try{
      if(state.wakeLock) return;
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', ()=>{ state.wakeLock = null; });
    }catch(e){ console.warn('Wake Lock no disponible', e); state.wakeLock = null; }
  }
  async function releaseWakeLock(){
    state.wakeLockWanted = false;
    try{ if(state.wakeLock){ await state.wakeLock.release(); } }catch(e){}
    state.wakeLock = null;
  }
  function startWatch(force){
    if(!state.activeTrip && !force) return;
    if(!navigator.geolocation){
      toast('Este navegador no tiene GPS disponible.');
      setBadge(el.gpsBadge, 'GPS no disponible', 'danger');
      addEvent('GPS_NO_DISPONIBLE', 'El navegador no soporta geolocalización.');
      return;
    }
    stopWatch(false);
    const options = { enableHighAccuracy:true, maximumAge:0, timeout:14000 };
    navigator.geolocation.getCurrentPosition(handlePosition, handleGeoError, options);
    state.watchId = navigator.geolocation.watchPosition(handlePosition, handleGeoError, options);
    setBadge(el.gpsBadge, 'GPS activo', 'ok');
    addEvent('GPS_ACTIVO', 'Seguimiento GPS iniciado por el usuario.');
  }
  function stopWatch(show=true){
    if(state.watchId !== null && navigator.geolocation){ navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
    if(show) setBadge(el.gpsBadge, 'GPS detenido', 'danger');
  }
  function handleGeoError(err){
    const msg = err && err.message ? err.message : 'Error de ubicación';
    setBadge(el.gpsBadge, 'GPS con problema', 'warn');
    addEvent('GPS_ERROR', msg);
    toast('GPS: '+msg+'. Puede finalizar el recorrido aunque la señal sea mala.', 5200);
  }


  function renderContextLine(ctx, extra){
    ctx = normalizeContext(ctx || state.currentContext);
    const simple = ctx.tipo === 'Sin referencia' ? 'Sin referencia cercana' : (ctx.lugar || 'Sin referencia');
    const distText = ctx.distanciaM !== null && ctx.distanciaM !== undefined ? `${Math.round(ctx.distanciaM)} m` : '';
    const typeText = ctx.tipo || 'Referencia';
    const sourceText = ctx.fuente || '';
    const accuracyText = extra && Number.isFinite(Number(extra.accuracy)) ? `Precisión ${fmtMeters(extra.accuracy)}` : '';
    const rumboText = extra && extra.rumbo ? `Rumbo ${extra.rumbo}` : '';
    const detailParts = state.mode === 'supervisor'
      ? [typeText, distText ? `Distancia aprox. ${distText}` : '', sourceText, accuracyText, rumboText].filter(Boolean)
      : [typeText, distText ? `${distText} aprox.` : '', accuracyText].filter(Boolean);
    if(el.locationLine){
      el.locationLine.classList.toggle('no-ref', ctx.tipo === 'Sin referencia');
      el.locationLine.classList.toggle('near-ref', /^Cerca/i.test(typeText));
      el.locationLine.classList.toggle('inside-ref', typeText === 'Lote/Finca');
      el.locationLine.innerHTML = `<span class="location-kicker">${state.mode === 'supervisor' ? 'Referencia actual' : 'Ubicación'}</span><b>${escapeHtml(simple)}</b><small>${escapeHtml(detailParts.join(' · ') || 'Active GPS para actualizar.')}</small>`;
    }
    if(el.contextBox){
      if(state.mode === 'supervisor'){
        const det = [contextForExport(ctx), typeText, sourceText, accuracyText, rumboText].filter(Boolean).join(' · ');
        el.contextBox.textContent = `Referencia actual: ${det}`;
      } else {
        el.contextBox.textContent = `Ubicación: ${contextForExport(ctx)}${accuracyText ? ' · '+accuracyText : ''}.`;
      }
    }
  }
  function updateLivePosition(raw){
    state.currentPosition = { lat:raw.lat, lng:raw.lng, timestamp:raw.timestamp, accuracy:raw.accuracy, heading:raw.headingRaw };
    const ctx = resolveContext(state.currentPosition);
    state.currentContext = ctx;
    if(el.refBadge) setBadge(el.refBadge, ctx.tipo === 'Sin referencia' ? 'Sin referencia cercana' : ctx.lugar, ctx.tipo === 'Sin referencia' ? 'warn' : 'ok');
    renderContextLine(ctx, { accuracy: raw.accuracy, rumbo: degToCompass(raw.headingRaw) });
    if(state.map){
      const html = `<div class="vehicle-marker"><span style="transform:rotate(${raw.headingRaw || 0}deg)">➤</span></div>`;
      if(state.lastKnownMarker){ state.lastKnownMarker.setLatLng([raw.lat, raw.lng]); state.lastKnownMarker.setPopupContent(`<b>Ubicación actual</b><br>${localStamp(raw.timestamp)}<br>${escapeHtml(contextForExport(ctx))}<br>Precisión: ${fmtMeters(raw.accuracy)}`); }
      else { state.lastKnownMarker = L.marker([raw.lat,raw.lng], { icon:L.divIcon({ html, className:'', iconSize:[28,28], iconAnchor:[14,14] }) }).addTo(state.markerLayer).bindPopup('Ubicación actual'); }
      if(state.activeTrip && state.followMode){
        const ll = L.latLng(raw.lat, raw.lng);
        if(!state.map.getBounds().pad(-0.25).contains(ll)){
          state.map.panTo(ll, { animate:true, duration:0.6 });
        }
      }
    }
  }
  function handlePosition(pos){
    const c = pos.coords || {};
    const t = pos.timestamp ? new Date(pos.timestamp).toISOString() : nowIso();
    const raw = {
      timestamp:t, lat:Number(c.latitude), lng:Number(c.longitude), accuracy:Number(c.accuracy || 9999),
      altitude: Number.isFinite(c.altitude) ? Number(c.altitude) : null,
      speedMps: Number.isFinite(c.speed) ? Number(c.speed) : null,
      headingRaw: Number.isFinite(c.heading) ? Number(c.heading) : null
    };
    if(!Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) return;
    updateLivePosition(raw);
    const trip = state.activeTrip;
    if(!trip) return;
    trip.rawCount += 1;
    const cfg = trip.cfg || getCfg();
    classifyQuality(trip, raw.accuracy, cfg);
    const lastSaved = trip.points[trip.points.length-1];
    const segM = lastSaved ? haversine(lastSaved, raw) : 0;
    const dtSec = lastSaved ? Math.max(0, (new Date(raw.timestamp)-new Date(lastSaved.timestamp))/1000) : Infinity;
    let speedKmh = Number.isFinite(raw.speedMps) ? raw.speedMps*3.6 : (dtSec>0 && Number.isFinite(dtSec) ? (segM/dtSec)*3.6 : 0);
    if(!Number.isFinite(speedKmh)) speedKmh = 0;
    const head = raw.headingRaw !== null ? raw.headingRaw : (lastSaved ? bearing(lastSaved, raw) : null);
    updateStopDetection(trip, raw, speedKmh, segM);

    const shouldSave = !lastSaved || dtSec >= cfg.minSec || segM >= cfg.minMeters;
    const duplicate = lastSaved && segM < 2 && dtSec < 20;
    const veryBad = raw.accuracy > Math.max(250, cfg.badAcc*4);
    if(!shouldSave || duplicate || veryBad){
      trip.rejectedCount += 1;
      trip.lastRaw = raw;
      if(veryBad) setBadge(el.gpsBadge, `GPS baja precisión ${fmtMeters(raw.accuracy)}`, 'warn');
      updateMetrics(trip);
      saveActiveTrip('Raw GPS');
      return;
    }
    const ctx = resolveContext(raw);
    const point = {
      index: trip.points.length + 1,
      timestamp:raw.timestamp, lat:raw.lat, lng:raw.lng, accuracy:raw.accuracy,
      speedKmh:round(speedKmh,2), heading:round(head,1), rumbo:degToCompass(head), segmentM:round(segM,2),
      distanceM:round((trip.distanceM || 0) + (lastSaved ? segM : 0),2),
      finca: ctx.finca || '', lote: ctx.lote || '', zona: ctx.zona || '',
      referencia: ctx.lugar || '', tipoReferencia: ctx.tipo || '', distanciaReferenciaM: ctx.distanciaM, fuenteReferencia: ctx.fuente || '',
      gpsQuality: qualityLabel(raw.accuracy, cfg)
    };
    if(!trip.startedAt){
      trip.startedAt = point.timestamp;
      trip.startContext = { finca:point.finca, lote:point.lote, zona:point.zona, referencia:point.referencia, tipoReferencia:point.tipoReferencia, lat:point.lat, lng:point.lng };
    }
    trip.distanceM = point.distanceM;
    trip.maxSpeedKmh = Math.max(trip.maxSpeedKmh||0, point.speedKmh||0);
    trip.lastSavedAt = point.timestamp;
    trip.points.push(point);
    trip.lastRaw = raw;
    setBadge(el.gpsBadge, raw.accuracy > cfg.badAcc ? `GPS activo · precisión baja ${fmtMeters(raw.accuracy)}` : `GPS activo · ${fmtMeters(raw.accuracy)}`, raw.accuracy > cfg.badAcc ? 'warn' : 'ok');
    drawTrip(trip);
    updateMetrics(trip);
    saveActiveTrip('Punto GPS');
  }
  function round(v,d=2){ return Number.isFinite(Number(v)) ? Number(Number(v).toFixed(d)) : 0; }
  function classifyQuality(trip, acc, cfg){
    if(!trip.quality) trip.quality = {good:0,regular:0,poor:0,avgAcc:0};
    if(acc <= Math.max(20, cfg.badAcc/2)) trip.quality.good += 1;
    else if(acc <= cfg.badAcc) trip.quality.regular += 1;
    else trip.quality.poor += 1;
    const n = trip.quality.good + trip.quality.regular + trip.quality.poor;
    trip.quality.avgAcc = ((trip.quality.avgAcc * (n-1)) + acc) / n;
  }
  function qualityLabel(acc,cfg){ if(acc <= Math.max(20,cfg.badAcc/2)) return 'Buena'; if(acc <= cfg.badAcc) return 'Regular'; return 'Baja'; }
  function updateStopDetection(trip, raw, speedKmh, segM){
    const cfg = trip.cfg || getCfg();
    const stationary = speedKmh <= cfg.stopSpeed || (trip.lastRaw && haversine(trip.lastRaw, raw) < 8);
    if(stationary){
      if(!trip.stopCandidate){ trip.stopCandidate = { start:raw.timestamp, lat:raw.lat, lng:raw.lng, samples:1, maxRadiusM:0 }; }
      else {
        trip.stopCandidate.samples += 1;
        const n = trip.stopCandidate.samples;
        trip.stopCandidate.lat = ((trip.stopCandidate.lat*(n-1)) + raw.lat)/n;
        trip.stopCandidate.lng = ((trip.stopCandidate.lng*(n-1)) + raw.lng)/n;
        trip.stopCandidate.maxRadiusM = Math.max(trip.stopCandidate.maxRadiusM||0, haversine({lat:trip.stopCandidate.lat,lng:trip.stopCandidate.lng}, raw));
      }
    } else {
      closeStopCandidate(trip, raw.timestamp, false);
    }
  }
  function closeStopCandidate(trip, endTime, force){
    const c = trip.stopCandidate;
    if(!c) return;
    const dur = durationMs(c.start, endTime);
    const threshold = (trip.cfg && trip.cfg.stopMin || defaultCfg.stopMin) * 60000;
    if(force || dur >= threshold){
      const ctx = resolveContext({lat:c.lat, lng:c.lng}) || {};
      trip.stops.push({
        index: trip.stops.length+1, start:c.start, end:endTime, durationMs:dur, lat:round(c.lat,6), lng:round(c.lng,6),
        samples:c.samples, maxRadiusM:round(c.maxRadiusM||0,1), finca:ctx.finca||'', lote:ctx.lote||'', zona:ctx.zona||'',
        referencia:ctx.lugar||'', tipoReferencia:ctx.tipo||'', distanciaReferenciaM:ctx.distanciaM, fuenteReferencia:ctx.fuente||'', note:''
      });
      addEvent('PARADA_DETECTADA', `Parada ${trip.stops.length} de ${fmtDurationText(dur)}`);
    }
    trip.stopCandidate = null;
  }
  function addCheckpoint(){
    const trip = state.activeTrip;
    if(!trip || !trip.points.length){ toast('No hay punto GPS para guardar punto clave.'); return; }
    const last = trip.points[trip.points.length-1];
    const note = prompt('Comentario para el punto clave:', '') || '';
    trip.checkpoints.push({ timestamp:nowIso(), lat:last.lat, lng:last.lng, finca:last.finca, lote:last.lote, zona:last.zona, referencia:last.referencia, tipoReferencia:last.tipoReferencia, note });
    addEvent('PUNTO_CLAVE', note || 'Punto clave agregado por usuario.');
    drawTrip(trip);
    saveActiveTrip('Punto clave');
    toast('Punto clave guardado.');
  }

  function markOperationalPlace(){
    const pt = state.currentPosition || (state.activeTrip && state.activeTrip.points && state.activeTrip.points[state.activeTrip.points.length-1]);
    if(!pt){ toast('Active GPS primero para marcar este lugar.'); startWatch(true); return; }
    const nombre = prompt('Nombre de referencia para este lugar (ej. Entrada Pansaco, Carretera Nandaime-CASUR, Taller, Báscula):', '') || '';
    if(!clean(nombre)){ toast('No se guardó referencia: falta nombre.'); return; }
    const tipo = prompt('Tipo de lugar: carretera, entrada, báscula, taller, patio, comunidad, cruce u otro:', 'carretera') || 'otro';
    const observacion = prompt('Observación opcional:', '') || '';
    const ref = { id:`REF-${Date.now()}`, nombre:clean(nombre), tipo:clean(tipo), lat:round(pt.lat,6), lng:round(pt.lng,6), observacion:clean(observacion), createdAt:nowIso(), source:'usuario local', manual:true };
    state.references.push(ref);
    saveLocalReferences(); drawReferences();
    const trip = state.activeTrip;
    if(trip){
      trip.checkpoints.push({ timestamp:nowIso(), lat:ref.lat, lng:ref.lng, referencia:ref.nombre, tipoReferencia:ref.tipo, note:'Referencia operativa creada: '+ref.nombre });
      addEvent('REFERENCIA_CREADA', `${ref.nombre} (${ref.tipo})`);
      saveActiveTrip('Referencia operativa');
    }
    updateLivePosition({ lat:ref.lat, lng:ref.lng, accuracy:pt.accuracy || 0, timestamp:nowIso(), headingRaw:pt.heading || 0 });
    toast('Referencia guardada. En próximos recorridos se usará para identificar esta zona.');
  }
  function addEvent(type, detail){
    const trip = state.activeTrip;
    if(!trip) return;
    trip.events.push({ timestamp:nowIso(), type, detail: String(detail||'') });
  }
  function computeMetrics(trip){
    const pts = trip.points || [];
    const demoNow = trip.demo && trip.demoVirtualNow ? trip.demoVirtualNow : null;
    const dur = durationMs(trip.startedAt || trip.createdAt, trip.endedAt || demoNow || nowIso());
    const dist = trip.distanceM || (pts.length > 1 ? pts.reduce((a,p,i)=>a+(i?haversine(pts[i-1],p):0),0) : 0);
    const stopMs = (trip.stops || []).reduce((a,s)=>a+Number(s.durationMs||0),0) + (trip.stopCandidate ? durationMs(trip.stopCandidate.start, demoNow || nowIso()) : 0);
    const movingMs = Math.max(0, dur - stopMs);
    const avgKmh = dur>0 ? (dist/1000)/(dur/3600000) : 0;
    const movingKmh = movingMs>0 ? (dist/1000)/(movingMs/3600000) : 0;
    const q = trip.quality || {};
    const qCount = (q.good||0)+(q.regular||0)+(q.poor||0);
    const qualityGps = qCount ? (q.poor/qCount > .35 ? 'Baja' : (q.good/qCount > .60 ? 'Buena' : 'Regular')) : 'Sin datos';
    return { durationMs:dur, distanceM:dist, avgSpeedKmh:avgKmh, movingSpeedKmh:movingKmh, maxSpeedKmh:trip.maxSpeedKmh||0, stops:(trip.stops||[]).length, stopMs, movingMs, points:pts.length, rawCount:trip.rawCount||0, rejectedCount:trip.rejectedCount||0, gpsQuality:qualityGps, avgAccuracy:q.avgAcc||0, stoppedPct: dur ? stopMs/dur : 0 };
  }
  function updateMetrics(trip){
    trip = trip || state.activeTrip || latestTrip();
    if(!trip){
      el.mDistance.textContent = '0.00 km'; el.mDuration.textContent = '00:00:00'; el.mSpeed.textContent = '0.0 km/h'; el.mStops.textContent = '0';
      return;
    }
    const m = computeMetrics(trip);
    el.mDistance.textContent = fmtKm(m.distanceM); el.mDuration.textContent = fmtDuration(m.durationMs); el.mSpeed.textContent = fmtKmh(m.avgSpeedKmh); el.mStops.textContent = String(m.stops);
    el.activeBarText.textContent = `${fmtKm(m.distanceM)} · ${fmtDuration(m.durationMs)} · ${m.stops} paradas`;
    el.autoReading.textContent = autoReading(trip, m);
    const last = trip.points && trip.points[trip.points.length-1];
    if(last){
      const ctx = normalizeContext({finca:last.finca, lote:last.lote, zona:last.zona, lugar:last.referencia, tipo:last.tipoReferencia, distanciaM:last.distanciaReferenciaM, fuente:last.fuenteReferencia});
      renderContextLine(ctx, { accuracy: last.accuracy, rumbo: last.rumbo || degToCompass(last.heading) });
      if(el.refBadge) setBadge(el.refBadge, ctx.tipo === 'Sin referencia' ? 'Sin referencia cercana' : ctx.lugar, ctx.tipo === 'Sin referencia' ? 'warn' : 'ok');
    }
  }
  function autoReading(trip, m){
    const lugares = routePlaceSummary(trip).filter(x=>x.tipo !== 'Sin referencia').slice(0,4).map(x => x.lugar).join('; ');
    const sinRef = routePlaceSummary(trip).find(x=>x.tipo === 'Sin referencia');
    const alerta = m.stoppedPct > .35 ? 'Revisar tiempos muertos: el recorrido muestra una proporción alta de tiempo detenido.' : 'El recorrido no muestra una proporción crítica de tiempo detenido.';
    const gps = m.gpsQuality === 'Baja' ? 'La calidad GPS fue baja en una parte relevante del trayecto.' : `La calidad GPS fue ${m.gpsQuality.toLowerCase()} en la mayor parte del trayecto.`;
    const refMsg = lugares ? ' Lugares principales: '+lugares+'.' : (sinRef ? ' Hay tramos sin referencia; use “Marcar lugar” para nombrar carretera, entrada o punto operativo.' : '');
    return `Recorrido ${trip.status === 'active' ? 'en proceso' : 'finalizado'} con ${fmtKm(m.distanceM)}, duración ${fmtDurationText(m.durationMs)}, ${m.stops} paradas detectadas y velocidad promedio de ${m.avgSpeedKmh.toFixed(1)} km/h. ${gps} ${alerta}${refMsg}`;
  }

  // -------------------- Persistencia --------------------
  function saveActiveTrip(reason){
    try{
      if(state.activeTrip){ localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(stripRuntimeLight(state.activeTrip))); setBadge(el.saveBadge, 'Guardado local '+localStamp(), 'ok'); }
    }catch(e){ console.warn(e); setBadge(el.saveBadge, 'Error autosave', 'danger'); }
  }
  function stripRuntimeLight(trip){ return JSON.parse(JSON.stringify(trip)); }
  function loadActiveTrip(){
    try{
      const raw = localStorage.getItem(STORAGE_ACTIVE) || localStorage.getItem(LEGACY_STORAGE_ACTIVE);
      if(!raw) return;
      const trip = JSON.parse(raw);
      if(trip && trip.status === 'active'){
        state.activeTrip = trip;
        state.followMode = true;
        setActiveUi(true);
        drawTrip(trip, { fit:true }); updateMetrics(trip);
        toast('Se recuperó el recorrido en curso. Reanudando GPS automáticamente…', 6000);
        setBadge(el.gpsBadge, 'Reanudando GPS…', 'warn');
        requestWakeLock();
        startWatch(true);
      }
    }catch(e){ console.warn(e); }
  }
  function loadHistory(){
    try{ state.history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || localStorage.getItem(LEGACY_STORAGE_HISTORY) || '[]') || []; }
    catch(e){ state.history = []; }
    renderHistory();
  }
  function saveHistory(){ localStorage.setItem(STORAGE_HISTORY, JSON.stringify(state.history.slice(0,MAX_HISTORY))); updateSupervisorDashboard(); }
  function latestTrip(){ return state.history && state.history[0] || null; }
  function updateSupervisorDashboard(){
    const list = state.history || [];
    const count = list.length;
    const pending = list.filter(t => !(t.synced || t.syncStatus === 'sincronizado')).length;
    const totalM = list.reduce((acc,t)=> acc + Number((t.metrics || computeMetrics(t)).distanceM || 0), 0);
    const last = list[0];
    if(el.supTripCount) el.supTripCount.textContent = String(count);
    if(el.supPendingCount) el.supPendingCount.textContent = String(pending);
    if(el.supKmTotal) el.supKmTotal.textContent = (totalM/1000).toFixed(2);
    if(el.supLastFolio) el.supLastFolio.textContent = last && last.folio ? last.folio : '—';
  }
  function renderHistory(){
    if(!state.history.length){ el.historyList.textContent = 'Sin recorridos guardados.'; updateSupervisorDashboard(); return; }
    el.historyList.innerHTML = state.history.slice(0,25).map((t,idx)=>{
      const m = t.metrics || computeMetrics(t);
      const f = t.fields || {};
      const name = `${escapeHtml(f.placa || 'Sin placa')} · ${escapeHtml(f.conductor || 'Sin conductor')}`;
      const folio = t.folio ? `<span class="folio-chip">${escapeHtml(t.folio)}</span>` : '';
      const sync = t.synced || t.syncStatus === 'sincronizado';
      const chip = sync ? '<span class="sync-chip ok">Sincronizado</span>' : '<span class="sync-chip">Pendiente local</span>';
      return `<div class="history-item"><b>${name}</b> ${folio}<br>${escapeHtml(f.origen || 'Origen no declarado')} → ${escapeHtml(f.destino || 'Destino no declarado')}<br>${localStamp(t.startedAt || t.createdAt)} · ${fmtKm(m.distanceM)} · ${fmtDurationText(m.durationMs)} · ${m.stops} paradas<br>${chip}
        <div class="history-actions"><button data-act="view" data-idx="${idx}">Ver ruta</button><button data-act="pdf" data-idx="${idx}">PDF</button><button data-act="excel" data-idx="${idx}">Excel</button><button data-act="wa" data-idx="${idx}">Compartir</button><button data-act="report" data-idx="${idx}">Imprimir</button><button class="danger-mini" data-act="delete" data-idx="${idx}">Borrar</button></div></div>`;
    }).join('');
    updateSupervisorDashboard();
  }
  function setActiveUi(active){
    document.body.classList.toggle('trip-active', !!active);
    document.body.classList.toggle('trip-inactive', !active);
    if(el.btnStart) el.btnStart.classList.toggle('hidden', active);
    if(el.btnStop) el.btnStop.classList.toggle('hidden', !active);
    if(el.activeBar) el.activeBar.classList.toggle('hidden', !active);
    if(active){
      // En recorrido activo dejamos el panel compacto, pero no ocultamos las acciones críticas.
      collapsePanel();
      if(el.summaryBlock) el.summaryBlock.open = true;
    } else {
      // Al terminar o preparar nuevo recorrido, abrir para que el conductor pueda descargar o llenar datos.
      expandPanel();
      openDriverBlocks();
    }
  }
  function prepareNewTrip(){
    if(state.activeTrip){ toast('Hay un recorrido activo. Finalícelo antes de iniciar uno nuevo.'); expandPanel(); return; }
    ['origin','destination','initialNote'].forEach(id=>{ if(el[id]) el[id].value=''; });
    if(el.autoReading) el.autoReading.textContent = 'Listo para registrar un nuevo recorrido. Complete origen/destino y toque Iniciar.';
    if(state.currentContext) renderContextLine(state.currentContext, { accuracy: state.currentPosition && state.currentPosition.accuracy });
    else {
      if(el.contextBox) el.contextBox.textContent = 'Referencia actual: sin punto GPS.';
      if(el.locationLine) el.locationLine.innerHTML = '<span class="location-kicker">Ubicación</span><b>Sin punto GPS</b><small>Active GPS para mostrar finca, lote o referencia cercana.</small>';
    }
    state.routeLayer && state.routeLayer.clearLayers();
    state.arrowLayer && state.arrowLayer.clearLayers();
    state.markerLayer && state.markerLayer.clearLayers();
    if(state.currentPosition) updateLivePosition({lat:state.currentPosition.lat,lng:state.currentPosition.lng,accuracy:state.currentPosition.accuracy||0,timestamp:nowIso(),headingRaw:state.currentPosition.heading||0});
    expandPanel();
    toast('Nuevo recorrido preparado. El historial anterior queda guardado.');
  }

  // -------------------- Exportación --------------------
  function currentOrLatestTrip(){
    const trip = state.activeTrip || latestTrip();
    if(!trip){ toast('No hay recorrido para exportar.'); return null; }
    trip.metrics = computeMetrics(trip);
    return trip;
  }
  function exportAllHistoryExcel(){
    if(!state.history.length){ toast('No hay recorridos finalizados para consolidar.'); return; }
    const recorridos = [['#','Folio','ID','Device ID','Hash local','Estado sync','Conductor','Placa','Equipo','Tipo','Origen','Destino','Inicio','Fin','Distancia km','Duración','Paradas','Tiempo detenido','% detenido','Vel. prom km/h','GPS','Puntos','Lugares principales','Lectura rápida']];
    const paradas = [['Folio','Recorrido ID','# parada','Conductor','Placa','Inicio','Fin','Duración','Lugar','Tipo','Finca','Lote','Lat','Lng','Alerta']];
    const lugares = [['Folio','Recorrido ID','Conductor','Placa','Lugar','Tipo','Finca','Lote','Primer paso','Último paso','Puntos GPS','Km aprox.']];
    const eventos = [['Folio','Recorrido ID','Fecha/hora','Tipo','Detalle']];
    state.history.forEach((t,idx)=>{
      const m = t.metrics || computeMetrics(t); const f = t.fields || {}; const folio = t.folio || '';
      const places = routePlaceSummary(t); const mainPlaces = places.filter(x=>x.tipo !== 'Sin referencia').slice(0,5).map(x=>x.lugar).join('; ');
      recorridos.push([idx+1,folio,t.id||'',t.deviceId||'',t.hashLocal||'',t.syncStatus||'local_pendiente',f.conductor||'',f.placa||'',f.equipo||'',f.tipoViaje||'',f.origen||'',f.destino||'',t.startedAt?localStamp(t.startedAt):'',t.endedAt?localStamp(t.endedAt):'',round(m.distanceM/1000,2),fmtDurationText(m.durationMs),m.stops,fmtDurationText(m.stopMs),round(m.stoppedPct*100,1),round(m.avgSpeedKmh,1),m.gpsQuality,m.points,mainPlaces,autoReading(t,m)]);
      (t.stops||[]).forEach((st,i)=>paradas.push([folio,t.id||'',i+1,f.conductor||'',f.placa||'',localStamp(st.start),localStamp(st.end),fmtDurationText(st.durationMs),st.referencia||contextText(st),st.tipoReferencia||'',st.finca||'',st.lote||'',st.lat,st.lng,st.durationMs>=600000?'Parada larga':'']));
      places.forEach(r=>lugares.push([folio,t.id||'',f.conductor||'',f.placa||'',r.lugar,r.tipo,r.finca,r.lote,localStamp(r.first),localStamp(r.last),r.points,round(r.distanceM/1000,3)]));
      (t.events||[]).forEach(e=>eventos.push([folio,t.id||'',localStamp(e.timestamp),e.type,e.detail]));
    });
    const wbData = { 'Resumen Recorridos':recorridos, 'Paradas':paradas, 'Lugares':lugares, 'Eventos':eventos };
    const filename = `CASUR_Transportes_Consolidado_${fileStamp()}.xlsx`;
    if(window.XLSX){
      const wb = makeWorkbook(wbData, 'CASUR Transportes GPS Consolidado');
      XLSX.writeFile(wb, filename);
      toast('Excel consolidado generado.');
    } else {
      exportExcelHtml({fields:{placa:'Consolidado'},startedAt:nowIso()}, wbData);
    }
  }
  function makeWorkbook(wbData, title){
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: title || 'CASUR Transportes GPS', Subject:'Resumen de recorrido', Author:'CASUR Transportes GPS', CreatedDate:new Date() };
    Object.entries(wbData).forEach(([name, rows])=>{
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = autoCols(rows);
      styleWorksheet(ws, name, rows);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
    });
    return wb;
  }
  function excelBlob(trip){
    if(!window.XLSX) return null;
    trip.metrics = computeMetrics(trip);
    const wb = makeWorkbook(workbookData(trip), 'CASUR Transportes GPS');
    const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    return { blob:new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename:exportFilename(trip,'xlsx') };
  }
  function exportExcel(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    trip.metrics = computeMetrics(trip);
    const wbData = workbookData(trip);
    const filename = exportFilename(trip, 'xlsx');
    if(window.XLSX){
      const wb = makeWorkbook(wbData, 'CASUR Transportes GPS');
      XLSX.writeFile(wb, filename);
      toast('Excel generado. Revise la carpeta de descargas del teléfono/equipo.');
    } else {
      exportExcelHtml(trip, wbData);
    }
  }
  function workbookData(trip){
    const m = trip.metrics || computeMetrics(trip);
    const fields = trip.fields || {};
    const lotRows = routeLotSummary(trip);
    const placeRows = routePlaceSummary(trip);
    const longStops = (trip.stops||[]).filter(s=>s.durationMs>=600000).length;
    const sinRef = placeRows.find(x=>x.tipo === 'Sin referencia');
    const mainPlaces = placeRows.filter(x=>x.tipo !== 'Sin referencia').slice(0,6).map(x=>x.lugar).join('; ');
    const startText = contextText(trip.startContext);
    const endText = contextText(trip.endContext);
    const resumen = [
      ['CASUR TRANSPORTES GPS'],
      ['RESUMEN OPERATIVO DEL RECORRIDO'],
      [],
      ['Dato','Valor','Lectura rápida'],
      ['Folio', trip.folio || 'Sin folio', 'Identificador robusto del recorrido'],
      ['Device ID', trip.deviceId || getDeviceId(), 'Identificador local del dispositivo para futura app administrador'],
      ['Estado sync', trip.syncStatus || 'local_pendiente', 'Estado preparado para sincronización futura'],
      ['Hash local', trip.hashLocal || 'Se genera al finalizar', 'Huella simple local para control de duplicados'],
      ['Conductor', fields.conductor || 'Sin dato', 'Responsable del recorrido'],
      ['Placa / Equipo', `${fields.placa || 'Sin placa'} / ${fields.equipo || 'Sin equipo'}`, 'Identificación del recurso'],
      ['Tipo de viaje', fields.tipoViaje || '', 'Clasificación operativa'],
      ['Origen declarado', fields.origen || '', 'Dato digitado por usuario'],
      ['Destino declarado', fields.destino || '', 'Dato digitado por usuario'],
      ['Inicio GPS', trip.startedAt ? localStamp(trip.startedAt) : 'Sin inicio GPS', startText || 'Sin referencia inicial'],
      ['Fin GPS', trip.endedAt ? localStamp(trip.endedAt) : 'En proceso', endText || 'Sin referencia final'],
      [],
      ['Indicador','Valor','Interpretación'],
      ['Distancia total', fmtKm(m.distanceM), 'Base para revisar km operativos y costo por viaje'],
      ['Duración total', fmtDurationText(m.durationMs), 'Tiempo total entre inicio y fin GPS'],
      ['Tiempo detenido', fmtDurationText(m.stopMs), `${round(m.stoppedPct*100,1)}% del tiempo total`],
      ['Tiempo en movimiento', fmtDurationText(m.movingMs), 'Tiempo estimado con avance efectivo'],
      ['Paradas detectadas', m.stops, `${longStops} paradas mayores o iguales a 10 min`],
      ['Velocidad promedio', fmtKmh(m.avgSpeedKmh), 'Promedio sobre tiempo total'],
      ['Velocidad en movimiento', fmtKmh(m.movingSpeedKmh), 'Promedio sin tiempo detenido'],
      ['Velocidad máxima', fmtKmh(m.maxSpeedKmh), 'Dato aproximado del GPS'],
      ['Calidad GPS', m.gpsQuality, `Precisión promedio ${round(m.avgAccuracy,1)} m`],
      ['Puntos GPS guardados', m.points, `${m.rejectedCount} puntos filtrados para evitar duplicados o baja calidad`],
      [],
      ['Lugares principales', mainPlaces || 'Sin lugares referenciados', sinRef ? 'Hay tramos sin referencia: usar “Marcar lugar” en campo.' : 'Referencias suficientes para revisión rápida'],
      ['Lectura ejecutiva', autoReading(trip,m), ''],
      ['Recomendación', operationalRecommendation(trip,m), ''],
      [],
      ['Observación inicial', fields.observacionInicial || '', ''],
      ['Observación final', fields.observacionFinal || '', ''],
      ['Generado', localStamp(), APP_VERSION]
    ];
    const stops = [['#','Inicio','Fin','Duración','Min detenido','Lugar / referencia','Tipo lugar','Finca','Lote','Lat','Lng','Alerta','Observación']]
      .concat((trip.stops||[]).map((s,i)=>[i+1,localStamp(s.start),localStamp(s.end),fmtDurationText(s.durationMs),round(s.durationMs/60000,1),s.referencia || contextText(s),s.tipoReferencia || (s.finca||s.lote?'Lote/Finca':'Sin referencia'),s.finca||'',s.lote||'',s.lat,s.lng,s.durationMs>=600000?'Parada larga':'',s.note||'']));
    if(stops.length===1) stops.push(['','','','','','Sin paradas detectadas','','','','','','','']);
    const lugares = [['#','Lugar / referencia','Tipo','Finca','Lote','Zona','Primer paso','Último paso','Puntos GPS','Km aprox.','Lectura']]
      .concat(placeRows.map((r,i)=>[i+1,r.lugar,r.tipo,r.finca,r.lote,r.zona,localStamp(r.first),localStamp(r.last),r.points,round(r.distanceM/1000,3),r.tipo==='Sin referencia'?'Nombrar carretera/lugar si es recurrente':'Referencia útil para revisión']));
    const gps = [['#','Fecha/hora','Lat','Lng','Precisión m','Velocidad km/h','Rumbo','Segmento m','Km acumulados','Lugar / referencia','Tipo referencia','Finca','Lote','Calidad GPS']]
      .concat((trip.points||[]).map((p,i)=>[i+1,localStamp(p.timestamp),p.lat,p.lng,p.accuracy,p.speedKmh,p.rumbo || degToCompass(p.heading),p.segmentM,round((p.distanceM||0)/1000,3),p.referencia || contextText(p),p.tipoReferencia || '',p.finca||'',p.lote||'',p.gpsQuality]));
    const eventos = [['Fecha/hora','Tipo','Detalle']].concat((trip.events||[]).map(e=>[localStamp(e.timestamp),e.type,e.detail]));
    if(eventos.length===1) eventos.push(['','','Sin eventos registrados.']);
    const referencias = [['Nombre','Tipo','Lat','Lng','Observación','Fuente','Creada']]
      .concat((state.references||[]).map(r=>[r.nombre||'',r.tipo||'',r.lat,r.lng,r.observacion||'',r.source||'',r.createdAt?localStamp(r.createdAt):'']));
    if(referencias.length===1) referencias.push(['Sin referencias manuales','','','','Use “Marcar lugar” en la app para nombrar carreteras, entradas, talleres, básculas o comunidades.','','']);
    return { 'Resumen':resumen, 'Paradas':stops, 'Lugares':lugares, 'Detalle GPS':gps, 'Eventos':eventos, 'Referencias':referencias };
  }
  function styleWorksheet(ws, name, rows){
    if(!ws || !ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const dark = '123C2C', mid = '1F6B46', pale = 'EAF5EE', gold = 'F2B705', line = 'DDE8E1', danger = 'FFEDEB';
    for(let R=range.s.r; R<=range.e.r; ++R){
      for(let C=range.s.c; C<=range.e.c; ++C){
        const addr = XLSX.utils.encode_cell({r:R,c:C});
        if(!ws[addr]) continue;
        ws[addr].s = ws[addr].s || {};
        ws[addr].s.font = { name:'Arial', sz:10, color:{rgb:'10251B'} };
        ws[addr].s.alignment = { vertical:'center', wrapText:true };
        ws[addr].s.border = { top:{style:'thin',color:{rgb:line}}, bottom:{style:'thin',color:{rgb:line}}, left:{style:'thin',color:{rgb:line}}, right:{style:'thin',color:{rgb:line}} };
      }
    }
    // títulos principales
    ['A1','A2'].forEach((addr,idx)=>{ if(ws[addr]) ws[addr].s = { font:{name:'Arial',sz:idx?14:16,bold:true,color:{rgb:idx?'FFFFFF':'F2B705'}}, fill:{fgColor:{rgb:dark}}, alignment:{horizontal:'center',vertical:'center'} }; });
    if(name==='Resumen'){
      ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:2}},{s:{r:1,c:0},e:{r:1,c:2}}];
      [3,12].forEach(r=>{ for(let c=0;c<=2;c++){ const addr=XLSX.utils.encode_cell({r,c}); if(ws[addr]) ws[addr].s={font:{name:'Arial',sz:10,bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:mid}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:{bottom:{style:'thin',color:{rgb:line}}}}; } });
      rows.forEach((row,i)=>{ if(String(row[0]||'').includes('Tiempo detenido') && parseFloat(String(row[2]||'').replace(',','.'))>35){ const addr='A'+(i+1); if(ws[addr]) ws[addr].s.fill={fgColor:{rgb:danger}}; } });
    } else {
      for(let C=range.s.c; C<=range.e.c; ++C){ const addr=XLSX.utils.encode_cell({r:0,c:C}); if(ws[addr]) ws[addr].s={font:{name:'Arial',sz:10,bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:mid}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:{bottom:{style:'thin',color:{rgb:line}}}}; }
    }
  }
  function operationalRecommendation(trip,m){
    const rec = [];
    if(m.stoppedPct>.35) rec.push('Priorizar revisión de paradas y tiempos muertos; validar si corresponden a carga, espera en báscula, patio, taller o desvío.');
    if(m.avgAccuracy>80) rec.push('La precisión GPS promedio es baja; repetir prueba en campo abierto o revisar configuración de batería/permisos.');
    if((trip.points||[]).length<10) rec.push('Pocos puntos GPS; el recorrido puede no tener trazabilidad suficiente.');
    if(!rec.length) rec.push('Recorrido útil para revisión operativa inicial. Comparar contra rutas estándar, costo por km y tiempos esperados por frente/finca.');
    return rec.join(' ');
  }
  function contextText(c){ if(!c) return ''; return contextForExport({finca:c.finca, lote:c.lote, zona:c.zona, lugar:c.referencia, tipo:c.tipoReferencia, distanciaM:c.distanciaReferenciaM, fuente:c.fuenteReferencia}); }
  function autoCols(rows){
    const widths = [];
    rows.forEach(r => r.forEach((v,i)=>{ widths[i] = Math.max(widths[i]||10, Math.min(42, String(v ?? '').length + 2)); }));
    return widths.map(w => ({ wch:w }));
  }
  function exportExcelHtml(trip, wbData){
    const sheets = Object.entries(wbData).map(([name, rows]) => `<h2>${escapeHtml(name)}</h2><table>${rows.map(row=>`<tr>${row.map(cell=>`<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>`).join('<br style="page-break-after:always">');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial}h1,h2{color:#123C2C}table{border-collapse:collapse;margin-bottom:20px}td{border:1px solid #d8e3dc;padding:6px 8px}tr:first-child td{background:#123C2C;color:#fff;font-weight:bold}</style></head><body><h1>CASUR Transportes GPS</h1>${sheets}</body></html>`;
    downloadBlob(html, exportFilename(trip,'xls'), 'application/vnd.ms-excel;charset=utf-8');
    toast('No se cargó el módulo XLSX. Se generó respaldo .xls compatible con Excel.');
  }
  function exportFilename(trip, ext){
    const f = trip.fields || {};
    return `CASUR_Recorrido_${safeName(f.placa || f.equipo || f.conductor)}_${fileStamp(trip.startedAt || trip.createdAt)}.${ext}`;
  }
  function exportReport(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    const m = trip.metrics || computeMetrics(trip);
    const rowsStops = (trip.stops||[]).map((s,i)=>`<tr><td>${i+1}</td><td>${localStamp(s.start)}</td><td>${fmtDurationText(s.durationMs)}</td><td>${escapeHtml(s.referencia || contextText(s))}</td><td>${escapeHtml(s.tipoReferencia||'')}</td><td>${s.lat}, ${s.lng}</td></tr>`).join('') || '<tr><td colspan="6">Sin paradas detectadas.</td></tr>';
    const lots = routePlaceSummary(trip).slice(0,30).map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.lugar)}</td><td>${escapeHtml(r.tipo)}</td><td>${escapeHtml(r.finca||'')}</td><td>${escapeHtml(r.lote||'')}</td><td>${r.points}</td><td>${round(r.distanceM/1000,2)}</td></tr>`).join('') || '<tr><td colspan="7">Sin lugares referenciados.</td></tr>';
    const pts = (trip.points||[]).filter((_,i)=>i===0 || i===(trip.points.length-1) || i % Math.max(1,Math.floor(trip.points.length/20))===0).map((p,i)=>`<tr><td>${i+1}</td><td>${localStamp(p.timestamp)}</td><td>${p.lat}</td><td>${p.lng}</td><td>${p.accuracy} m</td><td>${fmtKmh(p.speedKmh)}</td><td>${escapeHtml(p.referencia || contextText(p))}</td><td>${escapeHtml(p.tipoReferencia||'')}</td></tr>`).join('');
    const mapNote = routeMapSvg(trip);
    const logoTag = state.logoDataUrl ? `<img class="logo" src="${state.logoDataUrl}" alt="CASUR" />` : '';
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de Recorrido CASUR</title><style>${reportCss()}</style></head><body>
      <header><div class="head-left">${logoTag}<div><span>CASUR · Control Operativo</span><h1>Reporte de Recorrido · CASUR Transportes GPS</h1></div></div><div class="stamp">Folio ${escapeHtml(trip.folio||'s/f')}<br>Generado<br>${localStamp()}</div></header>
      <section class="hero"><div><h2>${escapeHtml(trip.fields?.conductor||'Sin conductor')}</h2><p>${escapeHtml(trip.fields?.placa||'Sin placa')} · ${escapeHtml(trip.fields?.equipo||'Sin equipo')} · ${escapeHtml(trip.fields?.tipoViaje||'')}</p><p>${escapeHtml(trip.fields?.origen||'Origen no declarado')} → ${escapeHtml(trip.fields?.destino||'Destino no declarado')}</p></div><div class="reading">${escapeHtml(autoReading(trip,m))}</div></section>
      <section class="kpis"><article><span>Distancia</span><b>${fmtKm(m.distanceM)}</b></article><article><span>Duración</span><b>${fmtDurationText(m.durationMs)}</b></article><article><span>Promedio</span><b>${fmtKmh(m.avgSpeedKmh)}</b></article><article><span>Paradas</span><b>${m.stops}</b></article><article><span>Detenido</span><b>${fmtDurationText(m.stopMs)}</b></article><article><span>GPS</span><b>${m.gpsQuality}</b></article></section>
      <section class="map-section"><h3>Trayectoria del recorrido</h3>${mapNote}<p class="muted">La vista representa la trayectoria GPS con inicio, fin y orientación aproximada. Para revisión completa en campo, abrir la PWA y cargar el recorrido desde historial.</p></section>
      <section><h3>Paradas detectadas</h3><table><thead><tr><th>#</th><th>Inicio</th><th>Duración</th><th>Lugar / referencia</th><th>Tipo</th><th>Ubicación</th></tr></thead><tbody>${rowsStops}</tbody></table></section>
      <section><h3>Lugares del recorrido</h3><table><thead><tr><th>#</th><th>Lugar / referencia</th><th>Tipo</th><th>Finca</th><th>Lote</th><th>Puntos</th><th>Km aprox.</th></tr></thead><tbody>${lots}</tbody></table></section>
      <section><h3>Puntos principales GPS</h3><table><thead><tr><th>#</th><th>Hora</th><th>Lat</th><th>Lng</th><th>Precisión</th><th>Vel.</th><th>Lugar / referencia</th><th>Tipo</th></tr></thead><tbody>${pts}</tbody></table></section>
      <section class="conclusion"><b>Lectura operativa:</b> ${escapeHtml(operationalRecommendation(trip,m))}</section>
      <footer>CASUR Transportes GPS · ${APP_VERSION} · Reporte imprimible desde navegador</footer>
      <script>window.onload=function(){ setTimeout(function(){ window.print(); }, 700); }<\/script>
    </body></html>`;
    const win = window.open('', '_blank');
    if(win){ win.document.open(); win.document.write(html); win.document.close(); }
    else { downloadBlob(html, exportFilename(trip,'html'), 'text/html;charset=utf-8'); toast('Bloqueador de ventanas activo. Se descargó el HTML.'); }
  }
  function routeMapSvg(trip){
    const pts = trip.points || [];
    if(pts.length < 2) return '<div class="route-box">Sin trayectoria suficiente.</div>';
    const minLat = Math.min(...pts.map(p=>p.lat)), maxLat = Math.max(...pts.map(p=>p.lat)), minLng = Math.min(...pts.map(p=>p.lng)), maxLng = Math.max(...pts.map(p=>p.lng));
    const w=900,h=430,pad=35; const dx = maxLng-minLng || .0001, dy = maxLat-minLat || .0001;
    const xy = p => [pad + ((p.lng-minLng)/dx)*(w-pad*2), h-pad - ((p.lat-minLat)/dy)*(h-pad*2)];
    const d = pts.map((p,i)=>{ const [x,y]=xy(p); return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
    const s=xy(pts[0]), e=xy(pts[pts.length-1]);
    const arrows = [];
    for(let i=1;i<pts.length;i+=Math.max(1,Math.floor(pts.length/8))){ const [x,y]=xy(pts[i]); const brg=pts[i].heading || bearing(pts[i-1],pts[i]) || 0; arrows.push(`<text x="${x}" y="${y}" transform="rotate(${brg} ${x} ${y})" font-size="20" text-anchor="middle" dominant-baseline="middle">➤</text>`); }
    const stops = (trip.stops||[]).map((st,i)=>{ const [x,y]=xy(st); return `<circle cx="${x}" cy="${y}" r="9" fill="#B42318"/><text x="${x}" y="${y+4}" font-size="9" fill="#fff" text-anchor="middle">${i+1}</text>`; }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="route-svg"><rect x="1" y="1" width="${w-2}" height="${h-2}" rx="18" fill="#eef6ef" stroke="#d8e3dc"/><path d="${d}" fill="none" stroke="#F2B705" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#123C2C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${arrows.join('')}<circle cx="${s[0]}" cy="${s[1]}" r="11" fill="#177245"/><text x="${s[0]}" y="${s[1]+4}" font-size="10" fill="#fff" text-anchor="middle">I</text><circle cx="${e[0]}" cy="${e[1]}" r="11" fill="#B42318"/><text x="${e[0]}" y="${e[1]+4}" font-size="10" fill="#fff" text-anchor="middle">F</text>${stops}<text x="${w-25}" y="30" font-size="15" fill="#B42318" text-anchor="middle">▲</text><text x="${w-25}" y="48" font-size="12" fill="#123C2C" text-anchor="middle">N</text></svg>`;
  }
  function reportCss(){ return `body{font-family:Arial, sans-serif;color:#17251E;margin:28px;background:#fff}header{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #123C2C;padding-bottom:14px;margin-bottom:18px}.head-left{display:flex;align-items:center;gap:14px}.head-left .logo{height:46px;width:auto}header span{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1F6B46;font-weight:bold}h1{font-size:24px;color:#123C2C;margin:4px 0 0}.stamp{text-align:right;color:#6A756E;font-weight:bold}.hero{display:grid;grid-template-columns:1fr 1.25fr;gap:16px;background:#EAF5EE;border:1px solid #DDE8E1;border-radius:16px;padding:16px;margin-bottom:16px}.hero h2{margin:0;color:#123C2C}.hero p{margin:6px 0}.reading{background:#fff;border-left:6px solid #F2B705;border-radius:12px;padding:12px;line-height:1.45}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:18px}.kpis article{background:#fff;border:1px solid #DDE8E1;border-radius:14px;padding:12px}.kpis span{display:block;color:#6A756E;font-size:12px;font-weight:bold}.kpis b{font-size:18px;color:#123C2C}.map-section,.conclusion,section{margin-bottom:18px}h3{color:#123C2C;margin:12px 0 8px}.route-svg{width:100%;height:auto;border-radius:16px;display:block}.muted{color:#6A756E;font-size:12px}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#123C2C;color:#fff;text-align:left}td,th{border:1px solid #DDE8E1;padding:7px 8px}tr:nth-child(even) td{background:#F7FAF8}.conclusion{border-radius:14px;background:#123C2C;color:#fff;padding:14px;line-height:1.45}footer{border-top:1px solid #DDE8E1;color:#6A756E;font-size:11px;padding-top:10px}@page{size:letter;margin:16mm}@media print{body{margin:0}.kpis{grid-template-columns:repeat(3,1fr)}header{break-after:avoid}section{break-inside:avoid}}`; }
  // -------------------- PDF de recorrido (con logo y encabezado) --------------------
  function projectPoints(pts, x, y, w, h, pad){
    const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat+maxLat)/2;
    const mx = lng => (lng-minLng) * Math.cos(midLat*Math.PI/180) * 111320;
    const my = lat => (lat-minLat) * 110540;
    const dxM = Math.max(mx(maxLng), 1), dyM = Math.max(my(maxLat), 1);
    const innerW = w - pad*2, innerH = h - pad*2;
    const scale = Math.min(innerW/dxM, innerH/dyM);
    const offX = x + pad + (innerW - dxM*scale)/2;
    const offY = y + pad + (innerH - dyM*scale)/2;
    return p => [ offX + mx(p.lng)*scale, offY + (dyM - my(p.lat))*scale ];
  }
  function drawArrowHead(doc, px, py, brg, size, color){
    const rad = (Number(brg)||0) * Math.PI/180;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const tipX = px + dx*size, tipY = py + dy*size;
    const bX = px - dx*size*0.5, bY = py - dy*size*0.5;
    const px1 = bX + (-dy)*size*0.6, py1 = bY + (dx)*size*0.6;
    const px2 = bX - (-dy)*size*0.6, py2 = bY - (dx)*size*0.6;
    doc.setFillColor(color[0],color[1],color[2]);
    doc.triangle(tipX,tipY, px1,py1, px2,py2, 'F');
  }
  function drawRouteOnPdf(doc, trip, x, y, w, h){
    const C = { dark:[18,60,44], mid:[31,107,70], gold:[242,183,5], line:[221,232,225], pale:[238,246,239], red:[180,35,24], amber:[183,121,31] };
    doc.setFillColor(C.pale[0],C.pale[1],C.pale[2]);
    doc.setDrawColor(C.line[0],C.line[1],C.line[2]);
    doc.roundedRect(x, y, w, h, 10, 10, 'FD');
    const pts = (trip.points||[]);
    if(pts.length < 2){
      doc.setTextColor(106,117,110); doc.setFont('helvetica','normal'); doc.setFontSize(11);
      doc.text('Sin trayectoria GPS suficiente para dibujar la ruta.', x + w/2, y + h/2, { align:'center' });
      return;
    }
    const proj = projectPoints(pts, x, y, w, h, 22);
    const xy = pts.map(proj);
    // línea base dorada gruesa + verde encima
    doc.setLineCap('round'); doc.setLineJoin('round');
    doc.setDrawColor(C.gold[0],C.gold[1],C.gold[2]); doc.setLineWidth(4.2);
    for(let i=1;i<xy.length;i++) doc.line(xy[i-1][0],xy[i-1][1],xy[i][0],xy[i][1]);
    doc.setDrawColor(C.dark[0],C.dark[1],C.dark[2]); doc.setLineWidth(1.4);
    for(let i=1;i<xy.length;i++) doc.line(xy[i-1][0],xy[i-1][1],xy[i][0],xy[i][1]);
    // flechas de dirección
    const step = Math.max(1, Math.floor(pts.length/7));
    for(let i=step;i<pts.length;i+=step){
      const brg = pts[i].heading || bearing(pts[i-1],pts[i]) || 0;
      drawArrowHead(doc, xy[i][0], xy[i][1], brg, 5, C.dark);
    }
    // paradas
    (trip.stops||[]).forEach((s,i)=>{
      const p = proj(s);
      doc.setFillColor(C.red[0],C.red[1],C.red[2]); doc.circle(p[0],p[1],5.5,'F');
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text(String(i+1), p[0], p[1]+2.4, { align:'center' });
    });
    // inicio y fin
    const s = xy[0], e = xy[xy.length-1];
    doc.setFillColor(C.mid[0],C.mid[1],C.mid[2]); doc.circle(s[0],s[1],7,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text('I', s[0], s[1]+2.8, { align:'center' });
    doc.setFillColor(C.red[0],C.red[1],C.red[2]); doc.circle(e[0],e[1],7,'F');
    doc.text('F', e[0], e[1]+2.8, { align:'center' });
    // rosa de los vientos
    doc.setFillColor(C.red[0],C.red[1],C.red[2]);
    drawArrowHead(doc, x+w-20, y+24, 0, 9, C.red);
    doc.setTextColor(C.dark[0],C.dark[1],C.dark[2]); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('N', x+w-20, y+40, { align:'center' });
    // leyenda
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(106,117,110);
    doc.text('I Inicio   F Fin   • Paradas', x+10, y+h-8);
  }
  async function buildPdf(trip){
    if(!(window.jspdf && window.jspdf.jsPDF)) return null;
    trip.metrics = computeMetrics(trip);
    const m = trip.metrics, f = trip.fields || {};
    const logo = await loadLogoDataUrl();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'letter' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M = 40;
    const C = { dark:[18,60,44], mid:[31,107,70], gold:[242,183,5], pale:[234,245,238], line:[221,232,225], muted:[106,117,110], ink:[23,37,30] };

    // --- Encabezado de marca ---
    doc.setFillColor(C.dark[0],C.dark[1],C.dark[2]);
    doc.rect(0,0,PW,96,'F');
    doc.setFillColor(C.gold[0],C.gold[1],C.gold[2]);
    doc.rect(0,96,PW,4,'F');
    if(logo){
      doc.setFillColor(255,255,255); doc.roundedRect(M-6, 22, 150, 52, 8, 8, 'F');
      try{ doc.addImage(logo, 'PNG', M, 28, 138, 40); }catch(e){ /* logo opcional */ }
    }
    doc.setTextColor(242,183,5); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('CASUR · CONTROL DE TRANSPORTE', PW-M, 38, { align:'right' });
    doc.setTextColor(255,255,255); doc.setFontSize(17);
    doc.text('Resumen de Recorrido GPS', PW-M, 58, { align:'right' });
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(215,234,220);
    doc.text(`Folio ${trip.folio || 'Sin folio'}  ·  Generado ${localStamp()}`, PW-M, 76, { align:'right' });

    let cy = 120;
    // --- Ficha del viaje ---
    doc.setFillColor(C.pale[0],C.pale[1],C.pale[2]); doc.setDrawColor(C.line[0],C.line[1],C.line[2]);
    doc.roundedRect(M, cy, PW-M*2, 64, 8, 8, 'FD');
    doc.setTextColor(C.dark[0],C.dark[1],C.dark[2]); doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text(`${f.conductor || 'Conductor no declarado'}`, M+14, cy+24);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(C.ink[0],C.ink[1],C.ink[2]);
    doc.text(`Placa: ${f.placa || 'Sin placa'}    Equipo: ${f.equipo || 'Sin equipo'}    Tipo: ${f.tipoViaje || 'Sin tipo'}`, M+14, cy+42);
    doc.setTextColor(C.mid[0],C.mid[1],C.mid[2]); doc.setFont('helvetica','bold');
    const origen = f.origen || 'Origen no declarado', destino = f.destino || 'Destino no declarado';
    const oy = cy+58;
    doc.text(origen, M+14, oy);
    const ax = M+14 + doc.getTextWidth(origen) + 10;
    doc.setDrawColor(C.mid[0],C.mid[1],C.mid[2]); doc.setLineWidth(1.3); doc.line(ax, oy-3, ax+14, oy-3);
    drawArrowHead(doc, ax+16, oy-3, 90, 4, C.mid);
    doc.text(destino, ax+24, oy);
    cy += 80;

    // --- KPIs ---
    const kpis = [ ['Distancia',fmtKm(m.distanceM)], ['Duración',fmtDurationText(m.durationMs)], ['Promedio',fmtKmh(m.avgSpeedKmh)], ['Paradas',String(m.stops)], ['Detenido',fmtDurationText(m.stopMs)], ['Calidad GPS',m.gpsQuality] ];
    const gap = 8, cols = 6, cardW = (PW-M*2 - gap*(cols-1))/cols, cardH = 50;
    kpis.forEach((k,i)=>{
      const x = M + i*(cardW+gap);
      doc.setFillColor(255,255,255); doc.setDrawColor(C.line[0],C.line[1],C.line[2]);
      doc.roundedRect(x, cy, cardW, cardH, 6, 6, 'FD');
      doc.setTextColor(C.muted[0],C.muted[1],C.muted[2]); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.text(k[0].toUpperCase(), x+8, cy+16);
      doc.setTextColor(C.dark[0],C.dark[1],C.dark[2]); doc.setFontSize(12);
      doc.text(String(k[1]), x+8, cy+36);
    });
    cy += cardH + 18;

    // --- Mapa de la ruta ---
    doc.setTextColor(C.dark[0],C.dark[1],C.dark[2]); doc.setFont('helvetica','bold'); doc.setFontSize(12);
    doc.text('Trayectoria del recorrido', M, cy);
    cy += 8;
    const mapH = 215;
    drawRouteOnPdf(doc, trip, M, cy, PW-M*2, mapH);
    cy += mapH + 16;

    // --- Lectura operativa ---
    const lectura = doc.splitTextToSize(autoReading(trip,m), PW-M*2-24);
    const lh = 13, boxH = lectura.length*lh + 26;
    doc.setFillColor(C.dark[0],C.dark[1],C.dark[2]); doc.roundedRect(M, cy, PW-M*2, boxH, 8, 8, 'F');
    doc.setFillColor(C.gold[0],C.gold[1],C.gold[2]); doc.rect(M, cy, 5, boxH, 'F');
    doc.setTextColor(242,183,5); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('LECTURA OPERATIVA', M+16, cy+18);
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
    doc.text(lectura, M+16, cy+34);
    cy += boxH + 18;

    // --- Tablas (paradas y lugares) ---
    const headStyles = { fillColor:C.mid, textColor:[255,255,255], fontStyle:'bold', fontSize:8 };
    const bodyStyles = { fontSize:8, textColor:C.ink };
    const altStyles = { fillColor:[247,250,248] };
    const hasAuto = typeof doc.autoTable === 'function';

    const stopRows = (trip.stops||[]).map((s,i)=>[i+1, localStamp(s.start), fmtDurationText(s.durationMs), (s.referencia||contextText(s)||'Sin referencia'), s.tipoReferencia||'', `${round(s.lat,5)}, ${round(s.lng,5)}`]);
    const placeRows = routePlaceSummary(trip).slice(0,18).map((r,i)=>[i+1, r.lugar, r.tipo, r.finca||'', r.lote||'', r.points, round(r.distanceM/1000,2)]);

    if(hasAuto){
      doc.autoTable({
        startY: cy, margin:{left:M,right:M},
        head:[['#','Inicio','Duración','Lugar / referencia','Tipo','Ubicación']],
        body: stopRows.length ? stopRows : [['—','—','—','Sin paradas detectadas','—','—']],
        headStyles, bodyStyles, alternateRowStyles:altStyles,
        styles:{ cellPadding:3, lineColor:C.line, lineWidth:.4 },
        didDrawPage: ()=>pdfChrome(doc, trip),
        columnStyles:{ 3:{cellWidth:170} }
      });
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 14, margin:{left:M,right:M},
        head:[['#','Lugar / referencia','Tipo','Finca','Lote','Puntos','Km']],
        body: placeRows.length ? placeRows : [['—','Sin lugares referenciados','—','—','—','—','—']],
        headStyles, bodyStyles, alternateRowStyles:altStyles,
        styles:{ cellPadding:3, lineColor:C.line, lineWidth:.4 },
        didDrawPage: ()=>pdfChrome(doc, trip),
        columnStyles:{ 1:{cellWidth:150} }
      });
    } else {
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(C.dark[0],C.dark[1],C.dark[2]);
      doc.text('Paradas detectadas', M, cy); cy+=14;
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(C.ink[0],C.ink[1],C.ink[2]);
      (stopRows.length?stopRows:[['—','—','—','Sin paradas detectadas','','']]).forEach(r=>{ doc.text(`${r[0]}. ${r[1]} · ${r[2]} · ${r[3]}`, M, cy); cy+=12; if(cy>PH-60){ doc.addPage(); cy=60; } });
    }
    pdfChrome(doc, trip);
    return { blob: doc.output('blob'), filename: exportFilename(trip,'pdf') };
  }
  function pdfChrome(doc, trip){
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const page = doc.internal.getCurrentPageInfo ? doc.internal.getCurrentPageInfo().pageNumber : (doc.internal.getNumberOfPages());
    doc.setDrawColor(221,232,225); doc.setLineWidth(.5); doc.line(40, PH-30, PW-40, PH-30);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(106,117,110);
    doc.text(`CASUR Transportes GPS · ${APP_VERSION} · Folio ${trip.folio||''}`, 40, PH-18);
    doc.text(`Página ${page}`, PW-40, PH-18, { align:'right' });
  }
  async function exportPdf(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    toast('Generando PDF del recorrido…', 2200);
    try{
      const pkg = await buildPdf(trip);
      if(pkg){ downloadBlob(pkg.blob, pkg.filename, 'application/pdf'); toast('PDF generado. Revise la carpeta de descargas.'); return pkg; }
    }catch(e){ console.warn('PDF jsPDF falló, usando respaldo imprimible', e); }
    exportReport(trip);
    return null;
  }

  // -------------------- Compartir (WhatsApp + archivos) --------------------
  function blobToFile(blob, filename, type){ try{ return new File([blob], filename, { type:type||blob.type }); }catch(e){ return null; } }
  async function sharePackage(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    toast('Preparando PDF y Excel para compartir…', 2600);
    const files = [];
    try{ const p = await buildPdf(trip); if(p && p.blob){ const fl = blobToFile(p.blob, p.filename, 'application/pdf'); if(fl) files.push(fl); } }catch(e){ console.warn('PDF para compartir falló', e); }
    try{ const x = excelBlob(trip); if(x && x.blob){ const fl = blobToFile(x.blob, x.filename, x.blob.type); if(fl) files.push(fl); } }catch(e){ console.warn('Excel para compartir falló', e); }
    const text = whatsappText(trip);
    if(files.length && navigator.canShare && navigator.canShare({ files })){
      try{
        await navigator.share({ files, title:`CASUR Recorrido ${trip.folio||''}`, text });
        toast('Selecciona WhatsApp en el menú para enviar el PDF y el Excel.', 5200);
        return;
      }catch(e){ if(e && e.name === 'AbortError'){ return; } console.warn('navigator.share con archivos falló', e); }
    }
    // Respaldo: descargar archivos y abrir WhatsApp con texto
    try{ const p = files.find(f=>f.type==='application/pdf'); if(p) downloadBlob(p, p.name, 'application/pdf'); }catch(e){}
    try{ const x = files.find(f=>f.name.endsWith('.xlsx')); if(x) downloadBlob(x, x.name, x.type); }catch(e){}
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    toast('Tu teléfono no permite adjuntar desde la web: descargué el PDF y el Excel y abrí WhatsApp. Adjúntalos desde el clip 📎.', 7000);
  }
  function whatsappText(trip){
    const m = trip.metrics || computeMetrics(trip), f = trip.fields || {};
    const lugares = routePlaceSummary(trip).filter(x=>x.tipo !== 'Sin referencia').slice(0,3).map(x=>x.lugar).join('; ');
    return `*CASUR Transportes GPS*
Folio: ${trip.folio||'s/f'}
Recorrido ${trip.status === 'active' ? 'en proceso' : 'finalizado'}
Conductor: ${f.conductor||'-'}
Placa: ${f.placa||'-'}  Equipo: ${f.equipo||'-'}
Ruta: ${f.origen||'-'} → ${f.destino||'-'}
Distancia: ${(m.distanceM/1000).toFixed(2)} km
Duración: ${fmtDurationText(m.durationMs)}
Paradas: ${m.stops} (detenido ${fmtDurationText(m.stopMs)})
Lugares: ${lugares || 'Sin referencia'}
Fecha: ${localStamp(trip.startedAt||trip.createdAt)}
GPS: ${m.gpsQuality}`;
  }


  function shareWhatsapp(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    const url = 'https://wa.me/?text=' + encodeURIComponent(whatsappText(trip));
    window.open(url, '_blank');
  }
  function makeSummaryCard(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=675;
    const ctx = canvas.getContext('2d'); const m = trip.metrics || computeMetrics(trip), f = trip.fields || {};
    const grd = ctx.createLinearGradient(0,0,1200,675); grd.addColorStop(0,'#0B2D22'); grd.addColorStop(1,'#1F6B46'); ctx.fillStyle=grd; ctx.fillRect(0,0,1200,675);
    ctx.fillStyle='rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(1040,80,280,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(80,620,220,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#F2B705'; ctx.font='bold 28px Arial'; ctx.fillText('CASUR · Transportes GPS',60,70);
    ctx.fillStyle='#fff'; ctx.font='bold 54px Arial'; ctx.fillText('Resumen de recorrido',60,138);
    ctx.font='28px Arial'; ctx.fillText(`${f.conductor||'Sin conductor'} · ${f.placa||'Sin placa'}`,60,188);
    ctx.fillStyle='rgba(255,255,255,.88)'; ctx.font='24px Arial'; ctx.fillText(`${f.origen||'Origen no declarado'} → ${f.destino||'Destino no declarado'}`,60,228);
    const cards = [ ['Distancia',fmtKm(m.distanceM)], ['Duración',fmtDurationText(m.durationMs)], ['Paradas',String(m.stops)], ['Detenido',fmtDurationText(m.stopMs)], ['Promedio',fmtKmh(m.avgSpeedKmh)], ['GPS',m.gpsQuality] ];
    cards.forEach((c,i)=>{ const x=60+(i%3)*360, y=285+Math.floor(i/3)*145; roundRect(ctx,x,y,320,105,22,'rgba(255,255,255,.95)'); ctx.fillStyle='#6A756E'; ctx.font='bold 22px Arial'; ctx.fillText(c[0],x+24,y+36); ctx.fillStyle='#123C2C'; ctx.font='bold 36px Arial'; ctx.fillText(c[1],x+24,y+78); });
    ctx.fillStyle='#FFE7A6'; ctx.font='22px Arial'; wrapText(ctx, autoReading(trip,m),60,600,1070,30);
    canvas.toBlob(blob => downloadBlob(blob, exportFilename(trip,'png'), 'image/png'));
  }
  function roundRect(ctx,x,y,w,h,r,fill){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); }
  function wrapText(ctx,text,x,y,maxWidth,lineHeight){ const words=String(text).split(' '); let line=''; for(const word of words){ const test=line+word+' '; if(ctx.measureText(test).width>maxWidth){ ctx.fillText(line,x,y); line=word+' '; y+=lineHeight; }else line=test; } ctx.fillText(line,x,y); }
  function downloadBlob(content, filename, type){
    const blob = content instanceof Blob ? content : new Blob([content], { type:type || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }


  // -------------------- Simulador de presentación --------------------
  function isDemoMode(){ return !!state.demoMode; }
  function demoSetStatus(msg){ if(el.demoStatus) el.demoStatus.textContent = msg || ''; }
  function demoScaleText(){ return 'Escala demo: 1 minuto de presentación ≈ 1 hora real del recorrido.'; }
  function setupDemoUi(){
    if(!isDemoMode()) return;
    document.body.classList.add('demo-mode');
    if(el.demoBar) el.demoBar.classList.remove('hidden');
    demoSetStatus('Simulador inmersivo listo. Ida y regreso por vías distintas hacia patio/báscula CASUR. '+demoScaleText());
    setBadge(el.gpsBadge, 'SIMULADOR · GPS ficticio', 'warn');
    toast('Modo simulador activo: escenario de ida y retorno sin GPS real, listo para vender la idea a logística y gerencia.', 7600);
    demoSeedFields(false);
  }
  function demoSeedFields(overwrite){
    const set = (node, value) => { if(node && (overwrite || !clean(node.value))) node.value = value; };
    set(el.driver, 'Conductor demo');
    set(el.plate, 'M-1024');
    set(el.equipment, 'CAM-24');
    if(el.tripType && (overwrite || !el.tripType.value)) el.tripType.value = 'Caña';
    set(el.origin, 'Finca San Lucas');
    set(el.destination, 'Patio / Báscula CASUR y retorno');
    set(el.initialNote, 'Simulación ejecutiva: ciclo de transporte cañero con ida al ingenio por ruta interna y retorno por vía alterna. 1 minuto de presentación equivale aproximadamente a 1 hora del recorrido real.');
  }
  function ensureDemoReferences(){
    const demoRefs = [
      {id:'DEMO-REF-SAN-LUCAS-CARGA', nombre:'Finca San Lucas · frente de carga', tipo:'finca/carga', lat:11.49396, lng:-85.83582, observacion:'Inicio del ciclo de transporte demo', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-ENTRADA-SAN-LUCAS', nombre:'Entrada San Lucas', tipo:'entrada de finca', lat:11.49440, lng:-85.83495, observacion:'Referencia demo para acceso a finca', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-CAMINO-INTERNO', nombre:'Camino interno hacia CASUR', tipo:'camino interno', lat:11.49635, lng:-85.83225, observacion:'Ruta de ida del camión cargado', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-CARRETERA-CASUR', nombre:'Carretera Nandaime-CASUR', tipo:'carretera', lat:11.49865, lng:-85.82920, observacion:'Tramo fuera de lotes para demostrar referencias operativas', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-BASCULA', nombre:'Báscula / Patio CASUR', tipo:'báscula', lat:11.50310, lng:-85.82360, observacion:'Destino operativo demo: pesaje/descarga', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-RETORNO-SUR', nombre:'Retorno por acceso sur', tipo:'ruta alterna', lat:11.50025, lng:-85.82475, observacion:'Retorno demo por vía distinta a la ida', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-CRUCE-OPERATIVO', nombre:'Cruce operativo / espera', tipo:'cruce', lat:11.49735, lng:-85.82720, observacion:'Punto de espera operativo en retorno', createdAt:nowIso(), source:'demo presentación', manual:true},
      {id:'DEMO-REF-REGRESO-SAN-LUCAS', nombre:'Retorno a San Lucas', tipo:'entrada de finca', lat:11.49335, lng:-85.83495, observacion:'Cierre del ciclo demo', createdAt:nowIso(), source:'demo presentación', manual:true}
    ];
    const ids = new Set((state.references || []).map(r => r.id));
    demoRefs.forEach(r => { if(!ids.has(r.id)) state.references.push(r); });
    drawReferences();
  }
  function demoRoutePoints(){
    // Escenario inmersivo: ciclo cañero de ida y retorno por vías distintas.
    // Los minutos son minutos reales simulados. En la reproducción guiada, 1 minuto real del viaje = 1 segundo de presentación.
    const start = Date.now() - 145*60000;
    const rows = [
      // min, lat, lng, velocidad, precisión, fase, lugar
      [0,   11.49396, -85.83582, 0,  11, 'Preparación en finca', 'Finca San Lucas · frente de carga'],
      [4,   11.49397, -85.83581, 0,  10, 'Preparación en finca', 'Finca San Lucas · frente de carga'],
      [9,   11.49398, -85.83582, 0,  10, 'Preparación en finca', 'Finca San Lucas · frente de carga'],
      [15,  11.49415, -85.83545, 8,  12, 'Ida cargado · salida de finca', 'Entrada San Lucas'],
      [20,  11.49440, -85.83495, 12, 11, 'Ida cargado · salida de finca', 'Entrada San Lucas'],
      [26,  11.49470, -85.83445, 16, 12, 'Ida cargado · camino interno', 'Camino interno hacia CASUR'],
      [32,  11.49512, -85.83386, 18, 13, 'Ida cargado · camino interno', 'Camino interno hacia CASUR'],
      [38,  11.49574, -85.83315, 21, 14, 'Ida cargado · camino interno', 'Camino interno hacia CASUR'],
      [44,  11.49640, -85.83225, 23, 15, 'Ida cargado · camino interno', 'Camino interno hacia CASUR'],
      [50,  11.49705, -85.83135, 25, 15, 'Ida cargado · camino interno', 'Camino interno hacia CASUR'],
      [56,  11.49775, -85.83040, 27, 16, 'Ida cargado · carretera', 'Carretera Nandaime-CASUR'],
      [62,  11.49855, -85.82925, 29, 17, 'Ida cargado · carretera', 'Carretera Nandaime-CASUR'],
      [68,  11.49935, -85.82810, 28, 18, 'Ida cargado · carretera', 'Carretera Nandaime-CASUR'],
      [74,  11.50020, -85.82690, 25, 17, 'Ida cargado · acceso ingenio', 'Acceso a patio CASUR'],
      [80,  11.50118, -85.82558, 22, 18, 'Ida cargado · acceso ingenio', 'Acceso a patio CASUR'],
      [86,  11.50230, -85.82428, 15, 18, 'Ingreso a patio', 'Patio CASUR'],
      [91,  11.50310, -85.82360, 5,  16, 'Pesaje / descarga', 'Báscula / Patio CASUR'],
      // parada de descarga y documentación
      [98,  11.50310, -85.82360, 0,  15, 'Pesaje / descarga', 'Báscula / Patio CASUR'],
      [106, 11.50309, -85.82359, 0,  15, 'Pesaje / descarga', 'Báscula / Patio CASUR'],
      [114, 11.50310, -85.82360, 0,  15, 'Pesaje / descarga', 'Báscula / Patio CASUR'],
      // retorno por ruta alterna, distinta a la ida
      [120, 11.50235, -85.82395, 12, 16, 'Retorno vacío · vía alterna', 'Salida patio CASUR'],
      [126, 11.50135, -85.82420, 20, 17, 'Retorno vacío · vía alterna', 'Retorno por acceso sur'],
      [132, 11.50025, -85.82475, 27, 18, 'Retorno vacío · vía alterna', 'Retorno por acceso sur'],
      [138, 11.49910, -85.82585, 31, 18, 'Retorno vacío · vía alterna', 'Ruta alterna sur'],
      [144, 11.49795, -85.82680, 30, 17, 'Retorno vacío · vía alterna', 'Cruce operativo / espera'],
      // parada corta en retorno
      [149, 11.49735, -85.82720, 0,  16, 'Espera operativa en retorno', 'Cruce operativo / espera'],
      [154, 11.49735, -85.82719, 0,  16, 'Espera operativa en retorno', 'Cruce operativo / espera'],
      [160, 11.49655, -85.82810, 24, 17, 'Retorno vacío · camino alterno', 'Camino alterno a San Lucas'],
      [166, 11.49565, -85.82930, 26, 17, 'Retorno vacío · camino alterno', 'Camino alterno a San Lucas'],
      [172, 11.49488, -85.83085, 25, 16, 'Retorno vacío · camino alterno', 'Camino alterno a San Lucas'],
      [178, 11.49425, -85.83250, 22, 15, 'Retorno vacío · acceso finca', 'Acceso alterno San Lucas'],
      [184, 11.49365, -85.83395, 16, 14, 'Retorno vacío · acceso finca', 'Acceso alterno San Lucas'],
      [190, 11.49335, -85.83495, 8,  13, 'Cierre de ciclo', 'Retorno a San Lucas'],
      [195, 11.49335, -85.83495, 0,  13, 'Cierre de ciclo', 'Retorno a San Lucas']
    ];
    return rows.map((r,i) => {
      const prev = i ? rows[i-1] : null;
      let heading = 0;
      if(prev){ heading = bearing({lat:prev[1],lng:prev[2]}, {lat:r[1],lng:r[2]}) || 0; }
      return {
        realMinute:r[0],
        timestamp:new Date(start + r[0]*60000).toISOString(),
        lat:r[1], lng:r[2], speedKmh:r[3], accuracy:r[4], headingRaw:heading,
        phase:r[5], place:r[6]
      };
    });
  }
  function demoAsGeoPosition(p){
    return { timestamp:new Date(p.timestamp).getTime(), coords:{ latitude:p.lat, longitude:p.lng, accuracy:p.accuracy, speed:(p.speedKmh||0)/3.6, heading:p.headingRaw } };
  }
  function demoAddPhaseEvent(p){
    if(!state.activeTrip || !p) return;
    if(state.demoLastPhase !== p.phase){
      state.demoLastPhase = p.phase;
      addEvent('DEMO_FASE', `${p.phase} · ${p.place || ''}`);
      state.activeTrip.checkpoints = state.activeTrip.checkpoints || [];
      state.activeTrip.checkpoints.push({
        timestamp:p.timestamp, lat:p.lat, lng:p.lng,
        referencia:p.place || p.phase, tipoReferencia:'fase demo',
        note:`Inicio de fase demo: ${p.phase}${p.place ? ' · '+p.place : ''}`
      });
    }
  }
  function startDemoTrip(mode){
    if(!isDemoMode()){ toast('Abra simulador.html o agregue ?demo=1 al enlace para usar el simulador.'); return; }
    if(state.activeTrip && !state.activeTrip.demo){
      toast('Hay un recorrido real activo. Finalícelo antes de correr el simulador.');
      expandPanel();
      return;
    }
    clearDemoTimer();
    stopWatch(false);
    demoSeedFields(true);
    ensureDemoReferences();
    setMode('driver');
    state.activeTrip = buildTrip();
    state.activeTrip.demo = true;
    state.activeTrip.demoMode = mode || 'guided';
    state.activeTrip.demoScale = '1 minuto demo = 1 hora real';
    state.activeTrip.status = 'active';
    state.activeTrip.fields.observacionInicial = 'DEMO INMERSIVO · Ida cargado hacia patio/báscula CASUR y retorno vacío por ruta alterna. Escala de presentación: 1 minuto de demo equivale aproximadamente a 1 hora del recorrido real.';
    state.routeFitDone = false;
    state.followMode = true;
    state.demoPoints = demoRoutePoints();
    state.demoIndex = 0;
    state.demoRunning = true;
    state.demoLastPhase = null;
    state.routeLayer && state.routeLayer.clearLayers();
    state.arrowLayer && state.arrowLayer.clearLayers();
    state.markerLayer && state.markerLayer.clearLayers();
    setActiveUi(true);
    expandPanel();
    setBadge(el.gpsBadge, 'SIMULADOR · grabando', 'warn');
    addEvent('DEMO_INICIADO', mode === 'instant' ? 'Recorrido demo generado de forma instantánea.' : 'Recorrido demo inmersivo iniciado. Escala: 1 minuto de demo equivale a 1 hora real.');
    saveActiveTrip('Demo iniciado');
    demoSetStatus(mode === 'instant' ? 'Generando ciclo completo de ida y retorno…' : 'Demo inmersiva en ejecución · ida por ruta interna y retorno por vía alterna · '+demoScaleText());
    if(mode === 'instant'){
      state.demoPoints.forEach(p => { demoAddPhaseEvent(p); handlePosition(demoAsGeoPosition(p)); if(state.activeTrip){ state.activeTrip.demoVirtualNow = p.timestamp; state.activeTrip.endedAt = p.timestamp; } });
      finishDemoTrip(true);
      return;
    }
    feedNextDemoPoint();
  }
  function feedNextDemoPoint(){
    if(!state.activeTrip || !state.demoRunning){ clearDemoTimer(); return; }
    const p = state.demoPoints[state.demoIndex++];
    if(!p){ finishDemoTrip(true); return; }
    demoAddPhaseEvent(p);
    handlePosition(demoAsGeoPosition(p));
    if(state.activeTrip){ state.activeTrip.demoVirtualNow = p.timestamp; state.activeTrip.endedAt = p.timestamp; }
    const pct = Math.min(100, Math.round((state.demoIndex / state.demoPoints.length) * 100));
    const elapsedMin = p.realMinute || 0;
    const elapsedHours = (elapsedMin / 60).toFixed(1);
    const last = state.activeTrip && state.activeTrip.points && state.activeTrip.points[state.activeTrip.points.length-1];
    const lugar = last ? (last.referencia || contextText(last) || p.place || 'Sin referencia') : (p.place || 'esperando punto');
    demoSetStatus(`${pct}% · ${p.phase} · ${lugar} · ${elapsedHours} h reales simuladas · ${demoScaleText()}`);
    const next = state.demoPoints[state.demoIndex];
    if(!next){ state.demoTimer = setTimeout(()=>finishDemoTrip(true), 900); return; }
    const deltaMin = Math.max(1, Number(next.realMinute || 0) - Number(p.realMinute || 0));
    // 1 minuto real del viaje = 1 segundo en la presentación. Cap mínimo para que no sea brusco.
    const waitMs = Math.max(800, deltaMin * 1000);
    state.demoTimer = setTimeout(feedNextDemoPoint, waitMs);
  }
  function clearDemoTimer(){ if(state.demoTimer){ clearTimeout(state.demoTimer); state.demoTimer = null; } state.demoRunning = false; }
  function finishDemoTrip(auto){
    clearDemoTimer();
    const trip = state.activeTrip;
    if(!trip){ demoSetStatus('No hay recorrido demo activo.'); return; }
    const last = trip.points && trip.points[trip.points.length-1];
    closeStopCandidate(trip, last ? last.timestamp : nowIso(), true);
    trip.fields = trip.fields || {};
    if(!trip.fields.observacionFinal) trip.fields.observacionFinal = 'Recorrido demo de presentación. No corresponde a GPS real. Muestra ida cargada hacia patio/báscula y retorno vacío por ruta alterna.';
    trip.endedAt = last ? last.timestamp : (trip.demoVirtualNow || nowIso());
    trip.status = 'finished';
    trip.syncStatus = 'local_pendiente';
    trip.synced = false;
    trip.deviceId = trip.deviceId || getDeviceId();
    if(last) trip.endContext = { finca:last.finca, lote:last.lote, zona:last.zona, referencia:last.referencia, tipoReferencia:last.tipoReferencia, lat:last.lat, lng:last.lng };
    addEvent('DEMO_FINALIZADO', auto ? 'El simulador finalizó automáticamente con ciclo ida-retorno.' : 'El usuario finalizó el demo manualmente.');
    trip.metrics = computeMetrics(trip);
    trip.hashLocal = simpleHash(JSON.stringify({ folio:trip.folio, id:trip.id, deviceId:trip.deviceId, startedAt:trip.startedAt, endedAt:trip.endedAt, points:(trip.points||[]).length, distanceM:trip.metrics.distanceM, demo:true }));
    state.history.unshift(stripRuntime(trip));
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    localStorage.removeItem(STORAGE_ACTIVE);
    state.activeTrip = null;
    setActiveUi(false);
    if(el.exportBlock) el.exportBlock.open = true;
    drawTrip(trip, { fit:true });
    updateMetrics(trip);
    renderHistory();
    setBadge(el.gpsBadge, 'SIMULADOR · recorrido generado', 'ok');
    demoSetStatus('Demo finalizada. Ya puede mostrar ruta ida-retorno, resumen, historial, Excel, PDF y WhatsApp con datos del ciclo simulado.');
    toast('Demo finalizada: ciclo ida-retorno guardado. Descargue Excel/PDF para mostrar evidencia operativa.', 7200);
  }
  function resetDemoData(){
    if(state.activeTrip && !state.activeTrip.demo){ toast('Hay un recorrido real activo. No se limpió.'); return; }
    clearDemoTimer();
    if(state.activeTrip && state.activeTrip.demo){ state.activeTrip = null; localStorage.removeItem(STORAGE_ACTIVE); }
    state.history = (state.history || []).filter(t => !t.demo);
    saveHistory(); renderHistory(); prepareNewTrip();
    setBadge(el.gpsBadge, 'SIMULADOR · GPS ficticio', 'warn');
    state.demoLastPhase = null;
    demoSetStatus('Datos demo limpiados. Listo para correr otra demostración inmersiva.');
    toast('Se limpiaron los recorridos demo.');
  }


  // -------------------- Modo visual --------------------
  function setMode(mode){
    mode = mode === 'supervisor' ? 'supervisor' : 'driver';
    state.mode = mode;
    localStorage.setItem(STORAGE_MODE, mode);
    document.body.classList.toggle('mode-supervisor', mode === 'supervisor');
    document.body.classList.toggle('mode-driver', mode !== 'supervisor');
    document.body.dataset.mode = mode;
    if(el.btnMode) el.btnMode.textContent = mode === 'supervisor' ? '🚛 Cambiar a Conductor' : '🛡️ Cambiar a Supervisor';
    if(el.roleTopChip) el.roleTopChip.textContent = mode === 'supervisor' ? '🛡️ Supervisor' : '🚛 Conductor';
    if(el.panelEyebrow) el.panelEyebrow.textContent = mode === 'supervisor' ? 'Modo Supervisor' : 'Modo Conductor';
    if(el.panelTitle) el.panelTitle.textContent = mode === 'supervisor' ? 'Revisión y control' : 'Registrar recorrido';
    if(el.roleBanner){
      el.roleBanner.classList.toggle('role-supervisor', mode === 'supervisor');
      el.roleBanner.classList.toggle('role-driver', mode !== 'supervisor');
    }
    if(el.roleSymbol) el.roleSymbol.textContent = mode === 'supervisor' ? '🛡️' : '🚛';
    if(el.roleTitle) el.roleTitle.textContent = mode === 'supervisor' ? 'Modo Supervisor' : 'Modo Conductor';
    if(el.roleSubtitle) el.roleSubtitle.textContent = mode === 'supervisor'
      ? 'Revisar historial, rutas, folios, descargas y opciones avanzadas.'
      : 'Registrar viaje: datos, GPS, iniciar, finalizar y compartir.';
    updateSupervisorDashboard();
    if(mode === 'supervisor'){
      expandPanel();
      openSupervisorBlocks();
    } else {
      if(el.historyBlock) el.historyBlock.open = false;
      if(el.advancedBlock) el.advancedBlock.open = false;
      openDriverBlocks();
      if(!state.activeTrip) expandPanel();
    }
    if(state.currentContext) renderContextLine(state.currentContext, { accuracy: state.currentPosition && state.currentPosition.accuracy, rumbo: state.currentPosition && degToCompass(state.currentPosition.heading) });
  }
  function toggleMode(){
    const next = state.mode === 'supervisor' ? 'driver' : 'supervisor';
    setMode(next);
    toast(next === 'supervisor' ? 'Modo Supervisor activado: revisión, historial y opciones avanzadas.' : 'Modo Conductor activado: datos, inicio, parada y exportación del recorrido.');
  }
  function loadMode(){
    setMode(localStorage.getItem(STORAGE_MODE) === 'supervisor' ? 'supervisor' : 'driver');
  }

  // -------------------- Eventos/UI --------------------
  function bindEvents(){
    on(el.btnDemoGuided, 'click', ()=>startDemoTrip('guided'));
    on(el.btnDemoInstant, 'click', ()=>startDemoTrip('instant'));
    on(el.btnDemoFinish, 'click', ()=>finishDemoTrip(false));
    on(el.btnDemoClear, 'click', resetDemoData);
    on(el.btnMode, 'click', toggleMode);
    on(el.btnDriverData, 'click', showDriverData);
    on(el.btnDriverSend, 'click', showDriverSend);
    on(el.btnStart, 'click', ()=>{ expandPanel(); startTrip(); });
    on(el.btnStop, 'click', stopTrip);
    on(el.btnStopBar, 'click', stopTrip);
    on(el.btnRestartGps, 'click', ()=>{ state.followMode = true; startWatch(true); if(state.activeTrip) requestWakeLock(); toast(state.activeTrip ? 'GPS reiniciado. El mapa vuelve a seguirte.' : 'GPS activado para ubicar posición.'); });
    on(el.btnSaveCheckpoint, 'click', addCheckpoint);
    on(el.btnMarkPlace, 'click', markOperationalPlace);
    on(el.btnLocate, 'click', activateLocation);
    on(el.btnFitRoute, 'click', fitRoute);
    on(el.btnToggleLots, 'click', toggleLots);
    on(el.btnToggleNorth, 'click', ()=>{ el.compassBox.classList.toggle('hidden'); toast(el.compassBox.classList.contains('hidden') ? 'Norte oculto.' : 'Norte visible.'); });
    on(el.btnExcel, 'click', ()=>exportExcel());
    on(el.btnPdf, 'click', ()=>exportPdf());
    on(el.btnShare, 'click', ()=>sharePackage());
    on(el.btnReport, 'click', ()=>exportReport());
    on(el.btnWhatsapp, 'click', ()=>shareWhatsapp());
    on(el.btnCard, 'click', ()=>makeSummaryCard());
    on(el.btnExportAll, 'click', exportAllHistoryExcel);
    on(el.btnNewTrip, 'click', prepareNewTrip);
    on(el.btnClearHistory, 'click', ()=>{
      if(confirm('¿Borrar historial local de recorridos finalizados? Esta acción no borra archivos Excel ya descargados.')){
        state.history=[]; saveHistory(); renderHistory(); toast('Historial local borrado.');
      }
    });
    on(el.historyList, 'click', (ev)=>{
      const b = ev.target.closest('button[data-act]'); if(!b) return;
      const trip = state.history[Number(b.dataset.idx)]; if(!trip) return;
      if(b.dataset.act==='view'){ drawTrip(trip,{fit:true}); updateMetrics(trip); collapsePanel(); toast('Ruta cargada en el mapa.'); }
      if(b.dataset.act==='excel') exportExcel(trip);
      if(b.dataset.act==='pdf') exportPdf(trip);
      if(b.dataset.act==='report') exportReport(trip);
      if(b.dataset.act==='wa') sharePackage(trip);
      if(b.dataset.act==='delete'){
        if(confirm('¿Borrar este recorrido del historial local?')){ state.history.splice(Number(b.dataset.idx),1); saveHistory(); renderHistory(); toast('Recorrido borrado del historial local.'); }
      }
    });
    on(el.btnCollapse, 'click', togglePanel);
    on(el.panelGrip, 'click', togglePanel);
    on(el.panel, 'click', (ev)=>ev.stopPropagation());
    document.querySelectorAll('.control-block').forEach(d => d.addEventListener('toggle', ()=>{ if(d.open) expandPanel(); }));
    ['cfgMinSec','cfgMinMeters','cfgStopMin','cfgStopSpeed','cfgBadAcc','cfgGapMin'].forEach(id => on($(id), 'change', saveCfg));
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('click', (ev)=>{
      if(!el.panel || el.panel.classList.contains('collapsed')) return;
      if(el.panel.contains(ev.target)) return;
      if(ev.target.closest && ev.target.closest('.map-actions,.leaflet-control,.toast,.active-bar')) return;
      collapsePanel();
    });
    window.addEventListener('beforeunload', ()=> saveActiveTrip('beforeunload'));
    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); state.deferredInstall=e; if(el.btnInstall) el.btnInstall.classList.remove('hidden'); });
    on(el.btnInstall, 'click', async()=>{ if(state.deferredInstall){ state.deferredInstall.prompt(); await state.deferredInstall.userChoice; state.deferredInstall=null; el.btnInstall.classList.add('hidden'); } });
  }
  function activateLocation(){
    if(!navigator.geolocation){ toast('GPS no disponible en este navegador.'); return; }
    state.followMode = true;
    if(el.btnLocate) el.btnLocate.textContent = state.activeTrip ? '📍 Mi posición' : '📍 Activando GPS';
    if(state.activeTrip){
      // Hay recorrido activo: el GPS ya graba. Solo recentrar el mapa en la posición actual.
      if(state.currentPosition && state.map){
        state.map.setView([state.currentPosition.lat, state.currentPosition.lng], state.map.getZoom(), { animate:true });
        if(el.btnLocate) el.btnLocate.textContent = '📍 Mi posición';
        toast('Mapa centrado en tu posición. El GPS sigue grabando el recorrido.');
      } else {
        toast('Esperando posición GPS para centrar el mapa…');
      }
    } else {
      // No hay recorrido: activar GPS para mostrar posición (sin grabar)
      startWatch(true);
      toast('GPS activado. El mapa mostrará tu posición. Toca Iniciar recorrido cuando estés listo.');
      navigator.geolocation.getCurrentPosition((pos)=>{
        const raw = { timestamp:pos.timestamp ? new Date(pos.timestamp).toISOString() : nowIso(), lat:Number(pos.coords.latitude), lng:Number(pos.coords.longitude), accuracy:Number(pos.coords.accuracy||9999), headingRaw:Number.isFinite(pos.coords.heading)?Number(pos.coords.heading):0 };
        updateLivePosition(raw);
        if(state.map) state.map.setView([raw.lat,raw.lng], 17, { animate:true });
        if(el.btnLocate) el.btnLocate.textContent = '📍 Mi posición';
      }, (err)=>{ if(el.btnLocate) el.btnLocate.textContent = '📍 Activar GPS'; handleGeoError(err); }, { enableHighAccuracy:true, timeout:12000, maximumAge:0 });
    }
  }
  function handleVisibility(){
    state.isHidden = document.hidden;
    if(document.hidden){
      state.lastVisibilityHiddenAt = Date.now(); saveActiveTrip('hidden');
    } else if(state.activeTrip){
      if(state.wakeLockWanted) requestWakeLock();
      const last = state.activeTrip.points[state.activeTrip.points.length-1];
      if(last){
        const gapMs = new Date() - new Date(last.timestamp);
        const cfg = state.activeTrip.cfg || getCfg();
        if(gapMs > cfg.gapMin*60000){
          addEvent('POSIBLE_PAUSA_SEGUNDO_PLANO', `Pasaron ${fmtDurationText(gapMs)} sin nuevo punto GPS. Posible pausa por navegador/sistema.`);
          toast('Se detectó un posible espacio sin GPS por segundo plano. El recorrido continúa; revise el Excel en Eventos.', 6500);
        }
      }
      saveActiveTrip('visible');
    }
  }
  function tick(){ updateMetrics(state.activeTrip || latestTrip()); }
  function registerServiceWorker(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('service-worker.js?v=5.8.0').then(reg => { reg.update && reg.update(); }).catch(console.warn);
    }
  }
  function escapeHtml(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

  async function init(){
    document.body.classList.add('trip-inactive');
    loadCfg(); loadMode(); loadHistory(); bindEvents();
    await initMap();
    loadActiveTrip();
    if(!state.activeTrip){
      // En el arranque, el conductor debe ver de inmediato las opciones para registrar datos y exportar.
      openDriverBlocks();
      expandPanel();
    }
    if(state.currentContext) renderContextLine(state.currentContext, { accuracy: state.currentPosition && state.currentPosition.accuracy });
    registerServiceWorker();
    loadLogoDataUrl();
    setupDemoUi();
    el.bootMsg.classList.add('hidden');
    state.timer = setInterval(tick, 1000);
    // Autosalvado interno habilitado, sin mostrar mensajes técnicos en pantalla de campo.
    const insecure = !window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if(insecure){
      setBadge(el.gpsBadge, 'Sin HTTPS · GPS no disponible', 'danger');
      el.bootMsg.classList.remove('hidden');
      el.bootMsg.innerHTML = 'Esta app necesita abrirse por HTTPS (enlace https://) para usar GPS y compartir. Abra el enlace publicado, no el archivo local.';
      toast('Atención: sin HTTPS el GPS y el compartir no funcionarán. Use el enlace https:// publicado.', 8000);
    } else {
      toast('CASUR Transportes GPS V5.7 lista. Use Modo Conductor para registrar o Modo Supervisor para revisar recorridos.');
    }
  }

  init().catch(err=>{
    console.error(err);
    el.bootMsg.classList.remove('hidden');
    el.bootMsg.textContent = 'Error de carga: '+err.message;
    toast('Error al iniciar la app. Revise conexión, Leaflet o caché.', 6000);
  });
})();
