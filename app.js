/* CASUR Transportes GPS V3 Operativa
   PWA de campo para recorridos, lotes/fincas, paradas y exportación operativa.
   Sin backend. Rastreo manual, visible y controlado por el usuario. */
(function(){
  'use strict';

  const APP_VERSION = (window.CASUR_BOOT && window.CASUR_BOOT.version) || '3.0.0-operativa';
  const STORAGE_ACTIVE = 'casur_transportes_active_trip_v3';
  const STORAGE_HISTORY = 'casur_transportes_history_v3';
  const STORAGE_CFG = 'casur_transportes_cfg_v3';
  const STORAGE_REFS = 'casur_transportes_referencias_v3';
  const MAX_HISTORY = 150;
  const MAX_POINT_ASSIGN_FEATURES = 12000;

  const $ = (id) => document.getElementById(id);
  const el = {
    bootMsg: $('bootMsg'), map: $('map'), gpsBadge: $('gpsBadge'), refBadge: $('refBadge'), shapeBadge: $('shapeBadge'), saveBadge: $('saveBadge'),
    btnInstall: $('btnInstall'), btnLocate: $('btnLocate'), btnFitRoute: $('btnFitRoute'), btnToggleNorth: $('btnToggleNorth'), btnToggleLots: $('btnToggleLots'), compassBox: $('compassBox'),
    panel: $('controlPanel'), btnCollapse: $('btnCollapse'), panelGrip: $('panelGrip'),
    mDistance: $('mDistance'), mDuration: $('mDuration'), mSpeed: $('mSpeed'), mStops: $('mStops'),
    driver: $('driver'), plate: $('plate'), equipment: $('equipment'), tripType: $('tripType'), origin: $('origin'), destination: $('destination'), initialNote: $('initialNote'),
    cfgMinSec: $('cfgMinSec'), cfgMinMeters: $('cfgMinMeters'), cfgStopMin: $('cfgStopMin'), cfgStopSpeed: $('cfgStopSpeed'), cfgBadAcc: $('cfgBadAcc'), cfgGapMin: $('cfgGapMin'),
    btnStart: $('btnStart'), btnStop: $('btnStop'), btnRestartGps: $('btnRestartGps'), btnSaveCheckpoint: $('btnSaveCheckpoint'), btnMarkPlace: $('btnMarkPlace'),
    autoReading: $('autoReading'), contextBox: $('contextBox'),
    btnExcel: $('btnExcel'), btnReport: $('btnReport'), btnWhatsapp: $('btnWhatsapp'), btnCard: $('btnCard'),
    historyList: $('historyList'), btnClearHistory: $('btnClearHistory'),
    activeBar: $('activeBar'), activeBarText: $('activeBarText'), btnStopBar: $('btnStopBar'), toast: $('toast')
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
    routeFitDone:false
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
    node.textContent = text;
    node.className = `badge ${kind || 'neutral'}`;
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
      const cfg = Object.assign({}, defaultCfg, JSON.parse(localStorage.getItem(STORAGE_CFG)||'{}'));
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
      const res = await fetch('data/poligonos_casur.geojson?v=3.0.0', { cache:'no-store' });
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
      setBadge(el.shapeBadge, `${state.lotFeatures.length.toLocaleString('es-NI')} lotes/fincas`, 'ok');
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
      const res = await fetch('data/referencias_operativas.json?v=3.0.0', { cache:'no-store' });
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
    try{ return JSON.parse(localStorage.getItem(STORAGE_REFS)||'[]') || []; }
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
    return {
      id: `CASUR-${Date.now()}`,
      version: APP_VERSION,
      status:'active',
      createdAt: nowIso(), startedAt:null, endedAt:null,
      fields: {
        conductor: clean(el.driver.value), placa: clean(el.plate.value), equipo: clean(el.equipment.value), tipoViaje: el.tripType.value,
        origen: clean(el.origin.value), destino: clean(el.destination.value), observacionInicial: clean(el.initialNote.value), observacionFinal:''
      },
      cfg, points:[], rawCount:0, rejectedCount:0, distanceM:0, maxSpeedKmh:0,
      stops:[], stopCandidate:null, checkpoints:[], events:[], quality:{ good:0, regular:0, poor:0, avgAcc:0 },
      startContext:null, endContext:null, lastSavedAt:null, lastRaw:null
    };
  }
  function clean(s){ return String(s||'').trim(); }
  function startTrip(){
    if(state.activeTrip){ toast('Ya existe un recorrido activo. Finalícelo antes de iniciar otro.'); return; }
    state.activeTrip = buildTrip();
    state.routeFitDone = false;
    setActiveUi(true);
    saveActiveTrip('Inicio de recorrido');
    toast('Recorrido creado. Solicitando GPS…');
    startWatch(true);
  }
  function stopTrip(){
    const trip = state.activeTrip;
    if(!trip){ toast('No hay recorrido activo.'); return; }
    closeStopCandidate(trip, nowIso(), true);
    trip.endedAt = nowIso(); trip.status = 'finished';
    const last = trip.points[trip.points.length-1];
    if(last) trip.endContext = { finca:last.finca, lote:last.lote, zona:last.zona, referencia:last.referencia, tipoReferencia:last.tipoReferencia, lat:last.lat, lng:last.lng };
    trip.metrics = computeMetrics(trip);
    state.history.unshift(stripRuntime(trip));
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    localStorage.removeItem(STORAGE_ACTIVE);
    stopWatch();
    state.activeTrip = null;
    setActiveUi(false);
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

  function updateLivePosition(raw){
    state.currentPosition = { lat:raw.lat, lng:raw.lng, timestamp:raw.timestamp, accuracy:raw.accuracy, heading:raw.headingRaw };
    const ctx = resolveContext(state.currentPosition);
    state.currentContext = ctx;
    if(el.refBadge) setBadge(el.refBadge, ctx.tipo === 'Sin referencia' ? 'Sin referencia cercana' : ctx.lugar, ctx.tipo === 'Sin referencia' ? 'warn' : 'ok');
    if(el.contextBox) el.contextBox.textContent = `Referencia actual: ${contextForExport(ctx)} · Precisión ${fmtMeters(raw.accuracy)}.`;
    if(state.map){
      const html = `<div class="vehicle-marker"><span style="transform:rotate(${raw.headingRaw || 0}deg)">➤</span></div>`;
      if(state.lastKnownMarker){ state.lastKnownMarker.setLatLng([raw.lat, raw.lng]); state.lastKnownMarker.setPopupContent(`<b>Ubicación actual</b><br>${localStamp(raw.timestamp)}<br>${escapeHtml(contextForExport(ctx))}<br>Precisión: ${fmtMeters(raw.accuracy)}`); }
      else { state.lastKnownMarker = L.marker([raw.lat,raw.lng], { icon:L.divIcon({ html, className:'', iconSize:[28,28], iconAnchor:[14,14] }) }).addTo(state.markerLayer).bindPopup('Ubicación actual'); }
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
    const dur = durationMs(trip.startedAt || trip.createdAt, trip.endedAt || nowIso());
    const dist = trip.distanceM || (pts.length > 1 ? pts.reduce((a,p,i)=>a+(i?haversine(pts[i-1],p):0),0) : 0);
    const stopMs = (trip.stops || []).reduce((a,s)=>a+Number(s.durationMs||0),0) + (trip.stopCandidate ? durationMs(trip.stopCandidate.start, nowIso()) : 0);
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
      el.contextBox.textContent = `Referencia actual: ${contextForExport(ctx)} · Precisión ${fmtMeters(last.accuracy)} · Rumbo ${last.rumbo || degToCompass(last.heading)}.`;
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
      if(state.activeTrip){ localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(stripRuntimeLight(state.activeTrip))); setBadge(el.saveBadge, 'Autosave '+localStamp(), 'ok'); }
    }catch(e){ console.warn(e); setBadge(el.saveBadge, 'Error autosave', 'danger'); }
  }
  function stripRuntimeLight(trip){ return JSON.parse(JSON.stringify(trip)); }
  function loadActiveTrip(){
    try{
      const raw = localStorage.getItem(STORAGE_ACTIVE);
      if(!raw) return;
      const trip = JSON.parse(raw);
      if(trip && trip.status === 'active'){
        state.activeTrip = trip;
        setActiveUi(true);
        drawTrip(trip, { fit:true }); updateMetrics(trip);
        toast('Se recuperó un recorrido activo guardado. Toque “Reiniciar GPS” para continuar registrando.', 6500);
        setBadge(el.gpsBadge, 'Recorrido recuperado · GPS pausado', 'warn');
      }
    }catch(e){ console.warn(e); }
  }
  function loadHistory(){
    try{ state.history = JSON.parse(localStorage.getItem(STORAGE_HISTORY)||'[]') || []; }
    catch(e){ state.history = []; }
    renderHistory();
  }
  function saveHistory(){ localStorage.setItem(STORAGE_HISTORY, JSON.stringify(state.history.slice(0,MAX_HISTORY))); }
  function latestTrip(){ return state.history && state.history[0] || null; }
  function renderHistory(){
    if(!state.history.length){ el.historyList.textContent = 'Sin recorridos guardados.'; return; }
    el.historyList.innerHTML = state.history.slice(0,12).map((t,idx)=>{
      const m = t.metrics || computeMetrics(t);
      const name = `${escapeHtml(t.fields?.placa || 'Sin placa')} · ${escapeHtml(t.fields?.conductor || 'Sin conductor')}`;
      return `<div class="history-item"><b>${name}</b><br>${localStamp(t.startedAt || t.createdAt)} · ${fmtKm(m.distanceM)} · ${fmtDurationText(m.durationMs)} · ${m.stops} paradas
        <div class="history-actions"><button data-act="view" data-idx="${idx}">Ver ruta</button><button data-act="excel" data-idx="${idx}">Excel</button><button data-act="report" data-idx="${idx}">HTML</button><button data-act="wa" data-idx="${idx}">WhatsApp</button></div></div>`;
    }).join('');
  }
  function setActiveUi(active){
    el.btnStart.classList.toggle('hidden', active); el.btnStop.classList.toggle('hidden', !active); el.activeBar.classList.toggle('hidden', !active);
    if(active){ el.panel.classList.add('collapsed'); } else { el.panel.classList.remove('collapsed'); }
  }

  // -------------------- Exportación --------------------
  function currentOrLatestTrip(){
    const trip = state.activeTrip || latestTrip();
    if(!trip){ toast('No hay recorrido para exportar.'); return null; }
    trip.metrics = computeMetrics(trip);
    return trip;
  }
  function exportExcel(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    trip.metrics = computeMetrics(trip);
    const wbData = workbookData(trip);
    const filename = exportFilename(trip, 'xlsx');
    if(window.XLSX){
      const wb = XLSX.utils.book_new();
      wb.Props = { Title:'CASUR Transportes GPS', Subject:'Resumen de recorrido', Author:'CASUR Transportes GPS', CreatedDate:new Date() };
      Object.entries(wbData).forEach(([name, rows])=>{
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = autoCols(rows);
        styleWorksheet(ws, name, rows);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
      });
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
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de Recorrido CASUR</title><style>${reportCss()}</style></head><body>
      <header><div><span>CASUR · Control Operativo</span><h1>Reporte de Recorrido · CASUR Transportes GPS</h1></div><div class="stamp">Generado<br>${localStamp()}</div></header>
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
  function reportCss(){ return `body{font-family:Arial, sans-serif;color:#17251E;margin:28px;background:#fff}header{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #123C2C;padding-bottom:14px;margin-bottom:18px}header span{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1F6B46;font-weight:bold}h1{font-size:24px;color:#123C2C;margin:4px 0 0}.stamp{text-align:right;color:#6A756E;font-weight:bold}.hero{display:grid;grid-template-columns:1fr 1.25fr;gap:16px;background:#EAF5EE;border:1px solid #DDE8E1;border-radius:16px;padding:16px;margin-bottom:16px}.hero h2{margin:0;color:#123C2C}.hero p{margin:6px 0}.reading{background:#fff;border-left:6px solid #F2B705;border-radius:12px;padding:12px;line-height:1.45}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:18px}.kpis article{background:#fff;border:1px solid #DDE8E1;border-radius:14px;padding:12px}.kpis span{display:block;color:#6A756E;font-size:12px;font-weight:bold}.kpis b{font-size:18px;color:#123C2C}.map-section,.conclusion,section{margin-bottom:18px}h3{color:#123C2C;margin:12px 0 8px}.route-svg{width:100%;height:auto;border-radius:16px;display:block}.muted{color:#6A756E;font-size:12px}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#123C2C;color:#fff;text-align:left}td,th{border:1px solid #DDE8E1;padding:7px 8px}tr:nth-child(even) td{background:#F7FAF8}.conclusion{border-radius:14px;background:#123C2C;color:#fff;padding:14px;line-height:1.45}footer{border-top:1px solid #DDE8E1;color:#6A756E;font-size:11px;padding-top:10px}@page{size:letter;margin:16mm}@media print{body{margin:0}.kpis{grid-template-columns:repeat(3,1fr)}header{break-after:avoid}section{break-inside:avoid}}`; }
  function shareWhatsapp(trip){
    trip = trip || currentOrLatestTrip(); if(!trip) return;
    const m = trip.metrics || computeMetrics(trip), f = trip.fields || {};
    const lugares = routePlaceSummary(trip).filter(x=>x.tipo !== 'Sin referencia').slice(0,3).map(x=>x.lugar).join('; ');
    const txt = `CASUR Transportes GPS
Recorrido ${trip.status === 'active' ? 'en proceso' : 'finalizado'}
Conductor: ${f.conductor||''}
Placa: ${f.placa||''}
Equipo: ${f.equipo||''}
Origen: ${f.origen||''}
Destino: ${f.destino||''}
Distancia: ${(m.distanceM/1000).toFixed(2)} km
Duración: ${fmtDurationText(m.durationMs)}
Paradas: ${m.stops}
Tiempo detenido: ${fmtDurationText(m.stopMs)}
Lugares: ${lugares || 'Sin referencia'}
Fecha: ${localStamp(trip.startedAt||trip.createdAt)}
GPS: ${m.gpsQuality}`;
    const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
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

  // -------------------- Eventos/UI --------------------
  function bindEvents(){
    el.btnStart.addEventListener('click', startTrip); el.btnStop.addEventListener('click', stopTrip); el.btnStopBar.addEventListener('click', stopTrip);
    el.btnRestartGps.addEventListener('click', ()=>{ if(!state.activeTrip){ toast('No hay recorrido activo para reiniciar GPS.'); return; } startWatch(true); toast('GPS reiniciado.'); });
    el.btnSaveCheckpoint.addEventListener('click', addCheckpoint);
    el.btnMarkPlace.addEventListener('click', markOperationalPlace);
    el.btnLocate.addEventListener('click', activateLocation); el.btnFitRoute.addEventListener('click', fitRoute); el.btnToggleLots.addEventListener('click', toggleLots);
    el.btnToggleNorth.addEventListener('click', ()=>{ el.compassBox.classList.toggle('hidden'); });
    el.btnExcel.addEventListener('click', ()=>exportExcel()); el.btnReport.addEventListener('click', ()=>exportReport()); el.btnWhatsapp.addEventListener('click', ()=>shareWhatsapp()); el.btnCard.addEventListener('click', ()=>makeSummaryCard());
    el.btnClearHistory.addEventListener('click', ()=>{ if(confirm('¿Borrar historial local de recorridos finalizados? Esta acción no borra archivos Excel ya descargados.')){ state.history=[]; saveHistory(); renderHistory(); toast('Historial local borrado.'); } });
    el.historyList.addEventListener('click', (ev)=>{
      const b = ev.target.closest('button[data-act]'); if(!b) return;
      const trip = state.history[Number(b.dataset.idx)]; if(!trip) return;
      if(b.dataset.act==='view'){ drawTrip(trip,{fit:true}); updateMetrics(trip); toast('Ruta cargada en el mapa.'); }
      if(b.dataset.act==='excel') exportExcel(trip);
      if(b.dataset.act==='report') exportReport(trip);
      if(b.dataset.act==='wa') shareWhatsapp(trip);
    });
    el.btnCollapse.addEventListener('click', ()=> el.panel.classList.toggle('collapsed'));
    el.panelGrip.addEventListener('click', ()=> el.panel.classList.toggle('collapsed'));
    ['cfgMinSec','cfgMinMeters','cfgStopMin','cfgStopSpeed','cfgBadAcc','cfgGapMin'].forEach(id => $(id).addEventListener('change', saveCfg));
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', ()=> saveActiveTrip('beforeunload'));
    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); state.deferredInstall=e; el.btnInstall.classList.remove('hidden'); });
    el.btnInstall.addEventListener('click', async()=>{ if(state.deferredInstall){ state.deferredInstall.prompt(); await state.deferredInstall.userChoice; state.deferredInstall=null; el.btnInstall.classList.add('hidden'); } });
  }
  function activateLocation(){
    if(!navigator.geolocation){ toast('GPS no disponible.'); return; }
    startWatch(true);
    toast('Ubicación activada. La app mostrará su posición; no registra recorrido hasta tocar Iniciar.');
    navigator.geolocation.getCurrentPosition((pos)=>{
      const raw = { timestamp:pos.timestamp ? new Date(pos.timestamp).toISOString() : nowIso(), lat:Number(pos.coords.latitude), lng:Number(pos.coords.longitude), accuracy:Number(pos.coords.accuracy||9999), headingRaw:Number.isFinite(pos.coords.heading)?Number(pos.coords.heading):0 };
      updateLivePosition(raw);
      if(state.map) state.map.setView([raw.lat,raw.lng],17);
    }, handleGeoError, {enableHighAccuracy:true, timeout:12000, maximumAge:0});
  }
  function handleVisibility(){
    state.isHidden = document.hidden;
    if(document.hidden){
      state.lastVisibilityHiddenAt = Date.now(); saveActiveTrip('hidden');
    } else if(state.activeTrip){
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
      navigator.serviceWorker.register('service-worker.js?v=3.0.0').then(reg => { reg.update && reg.update(); }).catch(console.warn);
    }
  }
  function escapeHtml(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

  async function init(){
    loadCfg(); loadHistory(); bindEvents();
    await initMap();
    loadActiveTrip();
    registerServiceWorker();
    el.bootMsg.classList.add('hidden');
    state.timer = setInterval(tick, 1000);
    setBadge(el.saveBadge, 'Autosave listo', 'ok');
    toast('CASUR Transportes GPS V3 operativa lista.');
  }

  init().catch(err=>{
    console.error(err);
    el.bootMsg.classList.remove('hidden');
    el.bootMsg.textContent = 'Error de carga: '+err.message;
    toast('Error al iniciar la app. Revise conexión, Leaflet o caché.', 6000);
  });
})();
