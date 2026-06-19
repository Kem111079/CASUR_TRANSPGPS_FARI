(function(){
  'use strict';

  const VERSION = 'CASUR_TRANSPORTES_GPS_V1_20260618';
  const ACTIVE_KEY = 'casur_transportes_gps_active_v1';
  const HISTORY_KEY = 'casur_transportes_gps_history_v1';
  const DRAFT_KEY = 'casur_transportes_gps_form_draft_v1';

  const DEFAULT_CENTER = [11.437, -85.830];
  const DEFAULT_ZOOM = 13;

  const $ = (id) => document.getElementById(id);
  const els = {};
  const ids = [
    'loader','appShell','gpsPill','btnMenu','sidePanel','panelBackdrop','map','mapFallback',
    'driverName','vehiclePlate','equipmentCode','tripType','origin','destination','initialNote',
    'minSeconds','minMeters','stopMinutes','accuracyWarn','btnStart','btnFinish','btnResumeGps','btnCenter',
    'btnCsvPoints','btnCsvSummary','btnReport','btnWhatsapp','btnCard','btnClearLocal','btnInstall',
    'routeStateTitle','routeStateText','kpiDistance','kpiPoints','kpiDuration','kpiStart','kpiSpeed','kpiMaxSpeed','kpiStops','kpiStopped',
    'bottomSummary','summaryTitle','executiveReading','summaryDetails','btnToggleSummary','sumDriver','sumVehicle','sumRoute','sumTimes','sumQuality',
    'activeBar','activeDistance','activeDuration','btnFinishBottom','historyList','cardCanvas'
  ];
  ids.forEach(id => els[id] = $(id));

  const state = {
    map: null,
    layers: { route: null, current: null, start: null, end: null, stops: [] },
    route: null,
    watchId: null,
    timerId: null,
    lastRaw: null,
    deferredPrompt: null,
    leafletReady: false
  };

  function safeJsonParse(value, fallback){
    try{ return value ? JSON.parse(value) : fallback; }catch(_){ return fallback; }
  }
  function nowIso(){ return new Date().toISOString(); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function fmtDate(iso){
    if(!iso) return '—';
    try{
      const d = new Date(iso);
      return d.toLocaleString('es-NI', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
    }catch(_){ return iso; }
  }
  function fmtTime(ms){
    ms = Math.max(0, Number(ms)||0);
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }
  function fmtHumanDuration(ms){
    ms = Math.max(0, Number(ms)||0);
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    if(h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }
  function fmtKm(km){ return `${(Number(km)||0).toFixed(2)} km`; }
  function fmtKmh(v){ return `${(Number(v)||0).toFixed(1)} km/h`; }
  function cleanText(v){ return String(v || '').replace(/[\n\r]+/g,' ').replace(/\s+/g,' ').trim(); }
  function escapeHtml(str){
    return String(str ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function slug(v){
    return cleanText(v || 'recorrido').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60) || 'recorrido';
  }

  function haversineM(a,b){
    if(!a || !b) return 0;
    const R = 6371008.8;
    const toRad = d => d * Math.PI / 180;
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  function getConfig(){
    return {
      minIntervalMs: Math.max(3000, Number(els.minSeconds?.value || 4) * 1000),
      minDistanceM: Math.max(5, Number(els.minMeters?.value || 12)),
      stopMinMs: Math.max(60000, Number(els.stopMinutes?.value || 2) * 60000),
      poorAccuracyM: Math.max(15, Number(els.accuracyWarn?.value || 50)),
      maxAccuracyForDistanceM: Math.max(60, Number(els.accuracyWarn?.value || 50) * 1.8),
      stopSpeedKmh: 3,
      stopRadiusM: 18,
      maxReasonableSpeedKmh: 95
    };
  }

  function readMetaFromForm(){
    return {
      conductor: cleanText(els.driverName.value),
      placa: cleanText(els.vehiclePlate.value),
      equipo: cleanText(els.equipmentCode.value),
      tipoViaje: cleanText(els.tripType.value || 'Caña'),
      origen: cleanText(els.origin.value),
      destino: cleanText(els.destination.value),
      observacionInicial: cleanText(els.initialNote.value)
    };
  }
  function writeMetaToForm(meta){
    if(!meta) return;
    els.driverName.value = meta.conductor || '';
    els.vehiclePlate.value = meta.placa || '';
    els.equipmentCode.value = meta.equipo || '';
    els.tripType.value = meta.tipoViaje || 'Caña';
    els.origin.value = meta.origen || '';
    els.destination.value = meta.destino || '';
    els.initialNote.value = meta.observacionInicial || '';
  }
  function saveFormDraft(){
    try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(readMetaFromForm())); }catch(_){ }
  }
  function loadFormDraft(){
    writeMetaToForm(safeJsonParse(localStorage.getItem(DRAFT_KEY), null));
  }

  function createRoute(){
    const meta = readMetaFromForm();
    return {
      schema: 1,
      version: VERSION,
      id: `RT-${Date.now()}`,
      active: true,
      startTime: nowIso(),
      endTime: null,
      meta,
      points: [],
      stops: [],
      stopCandidate: null,
      finalNote: '',
      stats: {
        distanceKm: 0,
        durationMs: 0,
        avgSpeedKmh: 0,
        maxSpeedKmh: 0,
        stoppedMs: 0,
        quality: 'Sin datos',
        acceptedPoints: 0,
        poorAccuracyPoints: 0,
        ignoredPoints: 0
      }
    };
  }

  function saveActiveRoute(){
    if(!state.route || !state.route.active) return;
    try{ localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.route)); }catch(err){ console.warn('No se pudo guardar recorrido activo', err); }
  }
  function clearActiveRoute(){
    try{ localStorage.removeItem(ACTIVE_KEY); }catch(_){ }
  }
  function getHistory(){ return safeJsonParse(localStorage.getItem(HISTORY_KEY), []); }
  function saveHistory(list){
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0,50))); }catch(err){ console.warn('No se pudo guardar historial', err); }
  }
  function pushHistory(route){
    const list = getHistory();
    const clean = JSON.parse(JSON.stringify(route));
    clean.active = false;
    delete clean.stopCandidate;
    list.unshift(clean);
    saveHistory(list);
    renderHistory();
  }

  function initMap(){
    if(window.__LEAFLET_FAILED__ || typeof L === 'undefined'){
      els.mapFallback.classList.remove('hidden');
      return;
    }
    state.leafletReady = true;
    state.map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);
    const sat = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains:['mt0','mt1','mt2','mt3'],
      attribution: 'Satélite'
    });
    L.control.layers({'Mapa': base, 'Satélite': sat}, {}, {position:'bottomleft'}).addTo(state.map);
    state.layers.route = L.polyline([], {color:'#07543f', weight:6, opacity:.92, lineJoin:'round', lineCap:'round'}).addTo(state.map);
  }

  function markerIcon(cls, html){
    if(!state.leafletReady) return null;
    return L.divIcon({className:'', html:`<div class="${cls}">${html}</div>`, iconSize:[34,34], iconAnchor:[17,17]});
  }
  function updateMap(){
    if(!state.leafletReady || !state.map || !state.route) return;
    const pts = state.route.points || [];
    const latlngs = pts.map(p => [p.lat,p.lng]);
    state.layers.route.setLatLngs(latlngs);
    if(pts.length){
      const first = pts[0], last = pts[pts.length-1];
      if(!state.layers.start){
        state.layers.start = L.marker([first.lat, first.lng], {icon: markerIcon('start-marker','I')}).addTo(state.map).bindPopup('Inicio del recorrido');
      }else state.layers.start.setLatLng([first.lat, first.lng]);
      if(!state.layers.current){
        state.layers.current = L.marker([last.lat, last.lng], {icon: markerIcon('transport-marker','🚚')}).addTo(state.map).bindPopup('Posición actual / final');
      }else state.layers.current.setLatLng([last.lat, last.lng]);
      if(state.route.endTime){
        if(!state.layers.end){
          state.layers.end = L.marker([last.lat, last.lng], {icon: markerIcon('end-marker','F')}).addTo(state.map).bindPopup('Fin del recorrido');
        }else state.layers.end.setLatLng([last.lat, last.lng]);
      }
      drawStopMarkers();
    }
  }
  function drawStopMarkers(){
    if(!state.leafletReady || !state.map || !state.route) return;
    state.layers.stops.forEach(m => state.map.removeLayer(m));
    state.layers.stops = [];
    state.route.stops.forEach((s, i) => {
      const m = L.marker([s.lat, s.lng], {icon: markerIcon('stop-marker', String(i+1))})
        .addTo(state.map)
        .bindPopup(`<b>Parada ${i+1}</b><br>${fmtHumanDuration(s.durationMs)}<br>${fmtDate(s.startTime)} - ${fmtDate(s.endTime)}`);
      state.layers.stops.push(m);
    });
  }
  function fitRoute(){
    if(!state.leafletReady || !state.map || !state.route || !state.route.points.length) return;
    const latlngs = state.route.points.map(p => [p.lat,p.lng]);
    const bounds = L.latLngBounds(latlngs);
    state.map.fitBounds(bounds.pad(.18), {animate:true, maxZoom:17});
  }
  function centerLast(){
    if(!state.leafletReady || !state.map) return;
    const routePtsForCenter = state.route?.points || [];
    const p = routePtsForCenter.length ? routePtsForCenter[routePtsForCenter.length - 1] : state.lastRaw;
    if(p) state.map.setView([p.lat,p.lng], Math.max(state.map.getZoom(), 16), {animate:true});
  }

  function startGpsWatch(){
    if(!navigator.geolocation){
      showMessage('GPS no disponible', 'Este navegador no expone geolocalización. Use Chrome/Edge/Safari desde HTTPS o localhost.');
      setGpsPill('bad', 'GPS no disponible');
      return false;
    }
    if(state.watchId !== null) return true;
    setGpsPill('warn', 'Solicitando GPS');
    try{
      state.watchId = navigator.geolocation.watchPosition(onGpsPosition, onGpsError, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      });
      return true;
    }catch(err){
      showMessage('No se pudo iniciar GPS', err.message || 'Revise permisos de ubicación.');
      return false;
    }
  }
  function stopGpsWatch(){
    if(state.watchId !== null && navigator.geolocation){
      navigator.geolocation.clearWatch(state.watchId);
    }
    state.watchId = null;
  }
  function onGpsError(err){
    const msg = err && err.message ? err.message : 'No se pudo leer ubicación.';
    console.warn('GPS error', err);
    setGpsPill('bad', 'GPS con error');
    els.routeStateText.textContent = `GPS: ${msg}. Puede finalizar el recorrido aunque la señal sea mala.`;
  }
  function onGpsPosition(pos){
    const c = pos.coords;
    const p = {
      timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
      lat: Number(c.latitude),
      lng: Number(c.longitude),
      accuracy: Number.isFinite(c.accuracy) ? Number(c.accuracy) : null,
      speedKmh: Number.isFinite(c.speed) && c.speed >= 0 ? c.speed * 3.6 : null,
      heading: Number.isFinite(c.heading) ? c.heading : null,
      cumulativeKm: state.route?.stats?.distanceKm || 0,
      segmentM: 0,
      gpsQuality: 'Sin clasificar'
    };
    state.lastRaw = p;
    if(p.accuracy !== null && p.accuracy <= getConfig().poorAccuracyM) setGpsPill('active', `GPS activo · ±${Math.round(p.accuracy)} m`);
    else setGpsPill('warn', p.accuracy !== null ? `GPS baja precisión · ±${Math.round(p.accuracy)} m` : 'GPS activo');
    if(state.route && state.route.active){ acceptGpsPoint(p); }
    updateLiveGpsOnly(p);
  }

  function acceptGpsPoint(raw){
    const route = state.route;
    const cfg = getConfig();
    const pts = route.points;
    const last = pts[pts.length-1];
    let keep = false;
    let reason = '';
    let distM = 0;
    let dtMs = 0;
    if(!last){ keep = true; reason = 'inicio'; }
    else{
      distM = haversineM(last, raw);
      dtMs = new Date(raw.timestamp) - new Date(last.timestamp);
      const movedEnough = distM >= cfg.minDistanceM;
      const timeEnough = dtMs >= cfg.minIntervalMs;
      const forceHeartbeat = dtMs >= 15000;
      const duplicate = distM < 3 && dtMs < 15000;
      keep = !duplicate && ((timeEnough && movedEnough) || forceHeartbeat);
      reason = movedEnough ? 'movimiento' : (forceHeartbeat ? 'latido' : 'omitido');
    }
    if(!keep){
      route.stats.ignoredPoints += 1;
      updateUI();
      return;
    }
    const point = {...raw};
    point.reason = reason;
    point.gpsQuality = classifyPointQuality(point);
    if(point.accuracy !== null && point.accuracy > cfg.poorAccuracyM) route.stats.poorAccuracyPoints += 1;

    if(last){
      const seconds = Math.max(1, (new Date(point.timestamp) - new Date(last.timestamp))/1000);
      const segmentSpeedKmh = (distM/1000)/(seconds/3600);
      const bothOk = (last.accuracy == null || last.accuracy <= cfg.maxAccuracyForDistanceM) && (point.accuracy == null || point.accuracy <= cfg.maxAccuracyForDistanceM);
      const reasonable = segmentSpeedKmh <= cfg.maxReasonableSpeedKmh || (point.speedKmh !== null && point.speedKmh <= cfg.maxReasonableSpeedKmh);
      if(bothOk && reasonable){
        point.segmentM = distM;
        point.segmentSpeedKmh = segmentSpeedKmh;
        route.stats.distanceKm += distM / 1000;
      }else{
        point.segmentM = 0;
        point.segmentSpeedKmh = segmentSpeedKmh;
        point.distanceIgnored = true;
      }
      route.stats.maxSpeedKmh = Math.max(route.stats.maxSpeedKmh || 0, point.speedKmh || 0, point.segmentSpeedKmh || 0);
    }
    point.cumulativeKm = route.stats.distanceKm;
    pts.push(point);
    route.stats.acceptedPoints = pts.length;
    updateStopDetection(point);
    updateStats();
    saveActiveRoute();
    updateMap();
    updateUI();
  }

  function classifyPointQuality(p){
    if(p.accuracy == null) return 'Sin precisión reportada';
    if(p.accuracy <= 20) return 'Excelente';
    if(p.accuracy <= 50) return 'Buena';
    if(p.accuracy <= 90) return 'Regular';
    return 'Baja';
  }
  function classifyRouteQuality(route){
    const pts = route.points || [];
    if(!pts.length) return 'Sin puntos GPS';
    const withAcc = pts.filter(p => p.accuracy != null);
    if(!withAcc.length) return 'Sin precisión reportada';
    const good = withAcc.filter(p => p.accuracy <= getConfig().poorAccuracyM).length;
    const ratio = good / withAcc.length;
    if(ratio >= .85) return 'Buena';
    if(ratio >= .60) return 'Regular';
    return 'Baja';
  }

  function updateStopDetection(point){
    const route = state.route;
    const cfg = getConfig();
    const prev = route.points.length > 1 ? route.points[route.points.length-2] : null;
    const speedStopped = point.speedKmh !== null && point.speedKmh <= cfg.stopSpeedKmh;
    const nearPrev = prev ? haversineM(prev, point) <= cfg.stopRadiusM : false;
    const stoppedNow = speedStopped || nearPrev;

    if(stoppedNow){
      if(!route.stopCandidate){
        route.stopCandidate = {
          startTime: point.timestamp,
          lastTime: point.timestamp,
          lat: point.lat,
          lng: point.lng,
          points: 1,
          activated: false
        };
      }else{
        const c = route.stopCandidate;
        c.lastTime = point.timestamp;
        c.points += 1;
        c.lat = ((c.lat * (c.points-1)) + point.lat) / c.points;
        c.lng = ((c.lng * (c.points-1)) + point.lng) / c.points;
        const dur = new Date(c.lastTime) - new Date(c.startTime);
        if(dur >= cfg.stopMinMs) c.activated = true;
      }
    }else{
      closeStopCandidate(point.timestamp);
    }
  }
  function closeStopCandidate(endTime){
    const route = state.route;
    if(!route || !route.stopCandidate) return;
    const c = route.stopCandidate;
    const durationMs = new Date(endTime) - new Date(c.startTime);
    if(c.activated || durationMs >= getConfig().stopMinMs){
      route.stops.push({
        startTime: c.startTime,
        endTime,
        durationMs,
        lat: c.lat,
        lng: c.lng,
        points: c.points
      });
    }
    route.stopCandidate = null;
  }

  function updateStats(){
    const r = state.route;
    if(!r) return;
    const end = r.endTime ? new Date(r.endTime) : new Date();
    const start = new Date(r.startTime);
    r.stats.durationMs = Math.max(0, end - start);
    r.stats.stoppedMs = (r.stops || []).reduce((s,x)=>s+(x.durationMs||0),0);
    if(r.stopCandidate?.activated){
      r.stats.stoppedMs += Math.max(0, new Date() - new Date(r.stopCandidate.startTime));
    }
    r.stats.avgSpeedKmh = r.stats.durationMs > 0 ? r.stats.distanceKm / (r.stats.durationMs / 3600000) : 0;
    r.stats.quality = classifyRouteQuality(r);
    r.stats.acceptedPoints = r.points.length;
  }

  function setGpsPill(mode, text){
    els.gpsPill.className = `gps-pill ${mode || 'idle'}`;
    els.gpsPill.innerHTML = `<span></span> ${escapeHtml(text || 'GPS inactivo')}`;
  }
  function updateLiveGpsOnly(p){
    if(!state.route || !state.route.active){
      els.kpiSpeed.textContent = fmtKmh(p.speedKmh || 0);
      els.kpiMaxSpeed.textContent = p.accuracy != null ? `Precisión ±${Math.round(p.accuracy)} m` : 'Precisión —';
    }
  }
  function updateUI(){
    const r = state.route;
    const active = !!(r && r.active);
    if(r) updateStats();
    els.btnStart.disabled = active;
    els.btnFinish.disabled = !active && !(r && !r.endTime && r.points?.length);
    els.btnResumeGps.disabled = !active || state.watchId !== null;
    els.btnCsvPoints.disabled = !r || !r.points?.length;
    els.btnCsvSummary.disabled = !r;
    els.btnReport.disabled = !r;
    els.btnWhatsapp.disabled = !r;
    els.btnCard.disabled = !r;
    els.btnFinishBottom.disabled = !active;

    if(active){
      els.routeStateTitle.textContent = 'Recorrido activo';
      els.routeStateText.textContent = state.watchId !== null ? 'GPS registrando puntos operativos. Finalice al terminar la ruta.' : 'Recorrido recuperado. Pulse Reactivar GPS para continuar registrando.';
      els.activeBar.classList.remove('hidden');
      els.bottomSummary.classList.add('active-mode');
    }else if(r && r.endTime){
      els.routeStateTitle.textContent = 'Recorrido finalizado';
      els.routeStateText.textContent = 'Resumen, exportaciones, reporte y WhatsApp disponibles.';
      els.activeBar.classList.add('hidden');
      els.bottomSummary.classList.remove('active-mode');
      setGpsPill(state.watchId ? 'active' : 'idle', state.watchId ? 'GPS activo' : 'GPS inactivo');
    }else{
      els.routeStateTitle.textContent = 'Listo para iniciar';
      els.routeStateText.textContent = 'Complete los datos básicos y pulse Iniciar recorrido.';
      els.activeBar.classList.add('hidden');
      els.bottomSummary.classList.remove('active-mode');
    }

    const dist = r?.stats?.distanceKm || 0;
    const dur = r?.stats?.durationMs || 0;
    const pts = r?.points?.length || 0;
    const stops = r?.stops?.length || 0;
    const stoppedMs = r?.stats?.stoppedMs || 0;
    els.kpiDistance.textContent = fmtKm(dist);
    els.kpiPoints.textContent = `${pts} punto${pts===1?'':'s'}`;
    els.kpiDuration.textContent = fmtTime(dur);
    els.kpiStart.textContent = r?.startTime ? `Inicio ${fmtDate(r.startTime)}` : 'Sin inicio';
    els.kpiSpeed.textContent = fmtKmh(r?.stats?.avgSpeedKmh || 0);
    els.kpiMaxSpeed.textContent = `Máx. ${fmtKmh(r?.stats?.maxSpeedKmh || 0)}`;
    els.kpiStops.textContent = String(stops);
    els.kpiStopped.textContent = `${fmtHumanDuration(stoppedMs)} detenido`;
    els.activeDistance.textContent = fmtKm(dist);
    els.activeDuration.textContent = fmtTime(dur);

    renderSummary();
  }
  function renderSummary(){
    const r = state.route;
    if(!r){
      els.summaryTitle.textContent = 'Sin recorrido finalizado';
      els.executiveReading.textContent = 'Cuando finalice el recorrido se generará una lectura ejecutiva con distancia, duración, paradas y calidad GPS.';
      els.sumDriver.textContent = '—'; els.sumVehicle.textContent = '—'; els.sumRoute.textContent = '—'; els.sumTimes.textContent = '—'; els.sumQuality.textContent = '—';
      return;
    }
    const meta = r.meta || {};
    const reading = buildExecutiveReading(r);
    els.summaryTitle.textContent = r.endTime ? 'Resumen de recorrido' : 'Recorrido en proceso';
    els.executiveReading.textContent = reading;
    els.sumDriver.textContent = meta.conductor || 'No indicado';
    els.sumVehicle.textContent = `${meta.placa || 'Sin placa'}${meta.equipo ? ' / ' + meta.equipo : ''}`;
    els.sumRoute.textContent = `${meta.origen || 'Origen no indicado'} → ${meta.destino || 'Destino no indicado'}`;
    els.sumTimes.textContent = `${fmtDate(r.startTime)} / ${r.endTime ? fmtDate(r.endTime) : 'En proceso'}`;
    els.sumQuality.textContent = r.stats.quality || 'Sin datos';
  }
  function buildExecutiveReading(r){
    updateStats();
    const dist = (r.stats.distanceKm || 0).toFixed(2);
    const dur = fmtHumanDuration(r.stats.durationMs || 0);
    const stops = r.stops?.length || 0;
    const avg = (r.stats.avgSpeedKmh || 0).toFixed(1);
    const max = (r.stats.maxSpeedKmh || 0).toFixed(1);
    const q = (r.stats.quality || 'sin clasificar').toLowerCase();
    const status = r.endTime ? 'finalizado' : 'en proceso';
    return `Recorrido ${status} con una distancia aproximada de ${dist} km, duración de ${dur}, ${stops} parada${stops===1?'':'s'} detectada${stops===1?'':'s'}, velocidad promedio de ${avg} km/h y velocidad máxima aproximada de ${max} km/h. La calidad GPS fue ${q} en la mayor parte del trayecto registrado.`;
  }

  function startRoute(){
    const meta = readMetaFromForm();
    if(!meta.conductor && !meta.placa && !meta.equipo){
      const ok = confirm('No se indicó conductor, placa ni equipo. ¿Desea iniciar de todos modos?');
      if(!ok) return;
    }
    state.route = createRoute();
    saveFormDraft();
    startGpsWatch();
    startTimer();
    saveActiveRoute();
    updateUI();
    closePanel();
  }
  function finishRoute(){
    if(!state.route) return;
    const note = prompt('Observación final del recorrido (opcional):', state.route.finalNote || '') || '';
    closeStopCandidate(nowIso());
    state.route.active = false;
    state.route.endTime = nowIso();
    state.route.finalNote = cleanText(note);
    updateStats();
    stopGpsWatch();
    stopTimer();
    clearActiveRoute();
    pushHistory(state.route);
    updateMap();
    fitRoute();
    updateUI();
    showMessage('Recorrido finalizado', buildExecutiveReading(state.route));
  }
  function startTimer(){
    stopTimer();
    state.timerId = setInterval(() => {
      if(state.route){ updateStats(); saveActiveRoute(); updateUI(); }
    }, 1000);
  }
  function stopTimer(){ if(state.timerId){ clearInterval(state.timerId); state.timerId = null; } }

  function recoverActiveRoute(){
    const active = safeJsonParse(localStorage.getItem(ACTIVE_KEY), null);
    if(active && active.active){
      state.route = active;
      writeMetaToForm(active.meta || {});
      startTimer();
      updateMap();
      updateUI();
      showMessage('Recorrido recuperado', 'Había un recorrido activo guardado localmente. Pulse “Reactivar GPS” para continuar registrando puntos o finalice si la ruta ya terminó.');
      return true;
    }
    return false;
  }

  function csvEscape(v){
    const s = String(v ?? '');
    if(/[",\n;]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function downloadText(filename, content, type){
    const blob = new Blob([content], {type: type || 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportPointsCsv(){
    const r = state.route;
    if(!r || !r.points.length){ showMessage('Sin puntos GPS', 'No hay puntos registrados para exportar.'); return; }
    const headers = ['route_id','timestamp','lat','lng','precision_m','velocidad_kmh','rumbo','segmento_m','distancia_acumulada_km','calidad_gps','razon','distancia_ignorada'];
    const rows = r.points.map(p => [r.id,p.timestamp,p.lat,p.lng,p.accuracy,p.speedKmh,p.heading,p.segmentM,p.cumulativeKm,p.gpsQuality,p.reason,p.distanceIgnored?'SI':'NO']);
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(';')).join('\n');
    downloadText(`CASUR_GPS_PUNTOS_${slug(r.meta?.placa || r.id)}.csv`, csv, 'text/csv;charset=utf-8');
  }
  function exportSummaryCsv(){
    const r = state.route;
    if(!r){ showMessage('Sin recorrido', 'No hay recorrido para exportar.'); return; }
    updateStats();
    const m = r.meta || {};
    const headers = ['route_id','conductor','placa','equipo','tipo_viaje','origen','destino','inicio','fin','duracion_seg','distancia_km','velocidad_prom_kmh','velocidad_max_kmh','paradas','tiempo_detenido_min','puntos','calidad_gps','obs_inicial','obs_final'];
    const row = [r.id,m.conductor,m.placa,m.equipo,m.tipoViaje,m.origen,m.destino,r.startTime,r.endTime,Math.round((r.stats.durationMs||0)/1000),(r.stats.distanceKm||0).toFixed(3),(r.stats.avgSpeedKmh||0).toFixed(2),(r.stats.maxSpeedKmh||0).toFixed(2),r.stops.length,((r.stats.stoppedMs||0)/60000).toFixed(1),r.points.length,r.stats.quality,m.observacionInicial,r.finalNote];
    const csv = [headers, row].map(x => x.map(csvEscape).join(';')).join('\n');
    downloadText(`CASUR_GPS_RESUMEN_${slug(m.placa || r.id)}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function routeSvg(route, width=760, height=260){
    const pts = route.points || [];
    if(pts.length < 2) return `<div class="no-map">Recorrido con menos de 2 puntos GPS.</div>`;
    const minLat = Math.min(...pts.map(p=>p.lat));
    const maxLat = Math.max(...pts.map(p=>p.lat));
    const minLng = Math.min(...pts.map(p=>p.lng));
    const maxLng = Math.max(...pts.map(p=>p.lng));
    const pad = 24;
    const latRange = Math.max(0.00001, maxLat-minLat);
    const lngRange = Math.max(0.00001, maxLng-minLng);
    const coords = pts.map(p => {
      const x = pad + ((p.lng-minLng)/lngRange) * (width - pad*2);
      const y = pad + ((maxLat-p.lat)/latRange) * (height - pad*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const stops = route.stops.map((s,i)=>{
      const x = pad + ((s.lng-minLng)/lngRange) * (width - pad*2);
      const y = pad + ((maxLat-s.lat)/latRange) * (height - pad*2);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#d6a829" stroke="#fff" stroke-width="2"/><text x="${(x+10).toFixed(1)}" y="${(y+4).toFixed(1)}" font-size="11" font-weight="700">P${i+1}</text>`;
    }).join('');
    const coordParts = coords.split(' ');
    const firstPair = coordParts[0].split(',');
    const lastPair = coordParts[coordParts.length - 1].split(',');
    return `<svg viewBox="0 0 ${width} ${height}" class="route-svg" role="img" aria-label="Esquema del recorrido"><rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="#f4f8f3"/><polyline points="${coords}" fill="none" stroke="#07543f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>${stops}<circle cx="${firstPair[0]}" cy="${firstPair[1]}" r="8" fill="#16a34a" stroke="#fff" stroke-width="3"/><circle cx="${lastPair[0]}" cy="${lastPair[1]}" r="8" fill="#dc2626" stroke="#fff" stroke-width="3"/></svg>`;
  }
  function buildReportHtml(route){
    updateStats();
    const r = route;
    const m = r.meta || {};
    const pts = r.points || [];
    const step = Math.max(1, Math.ceil(pts.length / 28));
    const principal = pts.filter((_,i)=> i===0 || i===pts.length-1 || i % step === 0).slice(0,32);
    const stopsRows = r.stops.length ? r.stops.map((s,i)=>`<tr><td>${i+1}</td><td>${fmtDate(s.startTime)}</td><td>${fmtDate(s.endTime)}</td><td>${fmtHumanDuration(s.durationMs)}</td><td>${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}</td></tr>`).join('') : '<tr><td colspan="5">Sin paradas detectadas bajo la regla configurada.</td></tr>';
    const pointRows = principal.map((p,i)=>`<tr><td>${i+1}</td><td>${fmtDate(p.timestamp)}</td><td>${p.lat.toFixed(6)}</td><td>${p.lng.toFixed(6)}</td><td>${p.accuracy==null?'—':Math.round(p.accuracy)}</td><td>${p.speedKmh==null?'—':p.speedKmh.toFixed(1)}</td><td>${(p.cumulativeKm||0).toFixed(2)}</td></tr>`).join('');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reporte de Recorrido · CASUR Transportes GPS</title><style>
      :root{--g:#003b2f;--g2:#07543f;--gold:#d6a829;--ink:#17231f;--muted:#5f6f69;--line:#dce7df;--bg:#f4f7f3}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif}.page{width:min(980px,94vw);margin:28px auto;background:white;border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.15)}header{padding:28px 32px;background:linear-gradient(135deg,var(--g),#001f19);color:white;display:flex;align-items:center;gap:18px}header img{width:105px;max-height:70px;object-fit:contain;background:white;border-radius:18px;padding:8px}header span{letter-spacing:.12em;text-transform:uppercase;font-size:.72rem;color:#d7e8dc;font-weight:800}header h1{margin:4px 0 0;font-size:1.8rem}.content{padding:26px 32px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 20px}.card{border:1px solid var(--line);border-radius:18px;padding:14px;background:#fbfdfb}.card span{display:block;color:var(--muted);font-size:.78rem;font-weight:800}.card b{display:block;color:var(--g);font-size:1.25rem;margin-top:3px}.exec{border-left:7px solid var(--gold);padding:15px 18px;background:#fffaf0;border-radius:16px;margin:18px 0;color:#2e3d37;line-height:1.45}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box{border:1px solid var(--line);border-radius:18px;padding:16px;margin:14px 0}.box h2{font-size:1.05rem;color:var(--g);margin:0 0 10px}.kv{display:grid;grid-template-columns:150px 1fr;gap:8px;border-bottom:1px dashed var(--line);padding:7px 0}.kv span{color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:.86rem}th{background:#eaf4eb;color:var(--g);text-align:left}th,td{padding:9px;border-bottom:1px solid var(--line)}.route-svg{width:100%;height:auto;border:1px solid var(--line);border-radius:18px}.footer{padding:16px 32px;border-top:1px solid var(--line);display:flex;justify-content:space-between;color:var(--muted);font-size:.8rem}.print{position:fixed;right:18px;bottom:18px;border:none;border-radius:999px;background:var(--g);color:white;padding:13px 18px;font-weight:900;box-shadow:0 18px 40px rgba(0,0,0,.22)}@media(max-width:760px){.cards,.grid{grid-template-columns:1fr 1fr}.content{padding:20px}.kv{grid-template-columns:115px 1fr}header{padding:20px;align-items:flex-start}header img{width:82px}.print{display:none}}@media print{body{background:white}.page{width:100%;margin:0;box-shadow:none;border-radius:0}.print{display:none}.box,.card{break-inside:avoid}}
    </style></head><body><button class="print" onclick="window.print()">Imprimir / PDF</button><div class="page"><header><img src="./assets/logo_casur.png" alt="CASUR"><div><span>Reporte de Recorrido</span><h1>CASUR Transportes GPS</h1><p>Generado: ${fmtDate(nowIso())}</p></div></header><div class="content"><div class="cards"><div class="card"><span>Distancia</span><b>${fmtKm(r.stats.distanceKm)}</b></div><div class="card"><span>Duración</span><b>${fmtHumanDuration(r.stats.durationMs)}</b></div><div class="card"><span>Vel. promedio</span><b>${fmtKmh(r.stats.avgSpeedKmh)}</b></div><div class="card"><span>Paradas</span><b>${r.stops.length}</b></div></div><div class="exec"><b>Lectura ejecutiva:</b> ${escapeHtml(buildExecutiveReading(r))}</div><div class="grid"><div class="box"><h2>Datos operativos</h2><div class="kv"><span>Conductor</span><b>${escapeHtml(m.conductor || 'No indicado')}</b></div><div class="kv"><span>Placa</span><b>${escapeHtml(m.placa || 'No indicada')}</b></div><div class="kv"><span>Equipo</span><b>${escapeHtml(m.equipo || 'No indicado')}</b></div><div class="kv"><span>Tipo de viaje</span><b>${escapeHtml(m.tipoViaje || 'No indicado')}</b></div><div class="kv"><span>Origen</span><b>${escapeHtml(m.origen || 'No indicado')}</b></div><div class="kv"><span>Destino</span><b>${escapeHtml(m.destino || 'No indicado')}</b></div></div><div class="box"><h2>Resumen GPS</h2><div class="kv"><span>Inicio</span><b>${fmtDate(r.startTime)}</b></div><div class="kv"><span>Fin</span><b>${r.endTime ? fmtDate(r.endTime) : 'En proceso'}</b></div><div class="kv"><span>Puntos</span><b>${r.points.length}</b></div><div class="kv"><span>Vel. máxima</span><b>${fmtKmh(r.stats.maxSpeedKmh)}</b></div><div class="kv"><span>Tiempo detenido</span><b>${fmtHumanDuration(r.stats.stoppedMs)}</b></div><div class="kv"><span>Calidad GPS</span><b>${escapeHtml(r.stats.quality)}</b></div></div></div><div class="box"><h2>Esquema del recorrido</h2>${routeSvg(r)}</div><div class="box"><h2>Paradas detectadas</h2><table><thead><tr><th>#</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Ubicación aprox.</th></tr></thead><tbody>${stopsRows}</tbody></table></div><div class="box"><h2>Puntos principales</h2><table><thead><tr><th>#</th><th>Hora</th><th>Lat</th><th>Lng</th><th>Prec. m</th><th>Vel. km/h</th><th>Km acum.</th></tr></thead><tbody>${pointRows}</tbody></table></div><div class="box"><h2>Observaciones</h2><p><b>Inicial:</b> ${escapeHtml(m.observacionInicial || 'Sin observación inicial.')}</p><p><b>Final:</b> ${escapeHtml(r.finalNote || 'Sin observación final.')}</p><p><small>Nota técnica: Las distancias son aproximadas y dependen de la precisión GPS del teléfono. El navegador puede pausar ubicación en segundo plano según el sistema operativo.</small></p></div></div><div class="footer"><span>CASUR · Uso operativo interno</span><span>${escapeHtml(r.id)}</span></div></div></body></html>`;
  }
  function generateReport(){
    const r = state.route;
    if(!r){ showMessage('Sin recorrido', 'No hay recorrido para reportar.'); return; }
    const html = buildReportHtml(r);
    const name = `CASUR_REPORTE_RECORRIDO_${slug(r.meta?.placa || r.id)}.html`;
    downloadText(name, html, 'text/html;charset=utf-8');
    const w = window.open('', '_blank');
    if(w){ w.document.open(); w.document.write(html); w.document.close(); }
  }
  function whatsappText(route){
    const r = route;
    updateStats();
    const m = r.meta || {};
    return `CASUR Transportes GPS\nRecorrido ${r.endTime ? 'finalizado' : 'en proceso'}\nConductor: ${m.conductor || '—'}\nPlaca: ${m.placa || '—'}\nEquipo: ${m.equipo || '—'}\nOrigen: ${m.origen || '—'}\nDestino: ${m.destino || '—'}\nDistancia: ${fmtKm(r.stats.distanceKm)}\nDuración: ${fmtHumanDuration(r.stats.durationMs)}\nParadas: ${r.stops.length}\nFecha: ${fmtDate(r.startTime)}\nCalidad GPS: ${r.stats.quality || '—'}`;
  }
  async function shareWhatsapp(){
    const r = state.route;
    if(!r){ showMessage('Sin recorrido', 'No hay resumen para compartir.'); return; }
    const text = whatsappText(r);
    try{ await navigator.clipboard.writeText(text); }catch(_){ }
    if(navigator.share){
      try{ await navigator.share({title:'CASUR Transportes GPS', text}); return; }catch(_){ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function drawCard(){
    const r = state.route;
    if(!r){ showMessage('Sin recorrido', 'No hay recorrido para generar tarjeta.'); return; }
    updateStats();
    const c = els.cardCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const m = r.meta || {};
    ctx.clearRect(0,0,W,H);
    const grad = ctx.createLinearGradient(0,0,W,H);
    grad.addColorStop(0,'#003b2f'); grad.addColorStop(1,'#07543f');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for(let i=0;i<9;i++){ ctx.beginPath(); ctx.arc(120+i*130, 120+(i%3)*170, 90, 0, Math.PI*2); ctx.fill(); }
    ctx.fillStyle = '#ffffff'; ctx.font = '900 54px Segoe UI, Arial'; ctx.fillText('CASUR Transportes GPS', 70, 92);
    ctx.fillStyle = '#d6a829'; ctx.font = '800 26px Segoe UI, Arial'; ctx.fillText('Tarjeta ejecutiva de recorrido', 72, 130);
    ctx.fillStyle = 'rgba(255,255,255,.94)'; roundRect(ctx,70,170,1060,560,34,true,false);
    ctx.fillStyle = '#003b2f'; ctx.font = '900 42px Segoe UI, Arial'; ctx.fillText(`${m.origen || 'Origen'} → ${m.destino || 'Destino'}`, 105, 235);
    ctx.fillStyle = '#53665f'; ctx.font = '700 25px Segoe UI, Arial'; ctx.fillText(`Conductor: ${m.conductor || '—'} · Placa: ${m.placa || '—'} · Equipo: ${m.equipo || '—'}`, 105, 275);
    const cards = [
      ['Distancia', fmtKm(r.stats.distanceKm)], ['Duración', fmtHumanDuration(r.stats.durationMs)], ['Vel. prom.', fmtKmh(r.stats.avgSpeedKmh)], ['Paradas', String(r.stops.length)]
    ];
    cards.forEach((x,i)=>{
      const x0 = 105 + i*250;
      ctx.fillStyle = '#eef6ef'; roundRect(ctx,x0,320,220,130,22,true,false);
      ctx.fillStyle = '#60716b'; ctx.font = '800 25px Segoe UI, Arial'; ctx.fillText(x[0], x0+22, 360);
      ctx.fillStyle = '#003b2f'; ctx.font = '900 38px Segoe UI, Arial'; ctx.fillText(x[1], x0+22, 410);
    });
    drawMiniRoute(ctx, r, 115, 500, 970, 140);
    ctx.fillStyle = '#263d36'; ctx.font = '700 24px Segoe UI, Arial'; wrapText(ctx, buildExecutiveReading(r), 105, 690, 990, 32, 3);
    ctx.fillStyle = '#f4f8f3'; ctx.font = '800 23px Segoe UI, Arial'; ctx.fillText(`Inicio: ${fmtDate(r.startTime)}   Fin: ${r.endTime ? fmtDate(r.endTime) : 'En proceso'}   Calidad GPS: ${r.stats.quality}`, 70, 800);
    ctx.fillStyle = '#d6a829'; ctx.font = '900 24px Segoe UI, Arial'; ctx.fillText('Uso operativo interno · generado localmente en el navegador', 70, 845);
    c.toBlob(blob => {
      if(!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CASUR_TARJETA_RECORRIDO_${slug(m.placa || r.id)}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }, 'image/png', .92);
  }
  function roundRect(ctx,x,y,w,h,r,fill,stroke){
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); if(stroke)ctx.stroke();
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
    const words = String(text).split(' '); let line = ''; let lines = 0;
    for(let n=0; n<words.length; n++){
      const test = line + words[n] + ' ';
      if(ctx.measureText(test).width > maxWidth && n > 0){ ctx.fillText(line, x, y); line = words[n] + ' '; y += lineHeight; lines++; if(maxLines && lines >= maxLines) return; }
      else line = test;
    }
    ctx.fillText(line, x, y);
  }
  function drawMiniRoute(ctx, route, x, y, w, h){
    const pts = route.points || [];
    ctx.fillStyle = '#f7faf7'; roundRect(ctx,x,y,w,h,24,true,false);
    if(pts.length < 2){ ctx.fillStyle = '#60716b'; ctx.font = '700 24px Segoe UI, Arial'; ctx.fillText('Sin línea de recorrido suficiente', x+30, y+80); return; }
    const minLat = Math.min(...pts.map(p=>p.lat)); const maxLat = Math.max(...pts.map(p=>p.lat));
    const minLng = Math.min(...pts.map(p=>p.lng)); const maxLng = Math.max(...pts.map(p=>p.lng));
    const latRange = Math.max(.00001, maxLat-minLat); const lngRange = Math.max(.00001, maxLng-minLng);
    const px = p => x+25 + ((p.lng-minLng)/lngRange)*(w-50);
    const py = p => y+20 + ((maxLat-p.lat)/latRange)*(h-40);
    ctx.strokeStyle = '#07543f'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p,i)=>{ if(i===0) ctx.moveTo(px(p),py(p)); else ctx.lineTo(px(p),py(p)); }); ctx.stroke();
    const first = pts[0], last = pts[pts.length-1];
    ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(px(first),py(first),10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(px(last),py(last),10,0,Math.PI*2); ctx.fill();
  }

  function showMessage(title, body){
    console.log(title, body);
    alert(`${title}\n\n${body}`);
  }

  function renderHistory(){
    const list = getHistory();
    if(!list.length){ els.historyList.textContent = 'Sin recorridos guardados.'; return; }
    els.historyList.innerHTML = list.slice(0,8).map((r,i)=>{
      const m = r.meta || {};
      return `<div class="history-item" data-i="${i}"><b>${escapeHtml(m.placa || m.equipo || m.conductor || r.id)}</b><small>${escapeHtml(m.origen || 'Origen')} → ${escapeHtml(m.destino || 'Destino')} · ${fmtKm(r.stats?.distanceKm || 0)} · ${fmtDate(r.startTime)}</small></div>`;
    }).join('');
    els.historyList.querySelectorAll('.history-item').forEach(item => item.addEventListener('click', () => {
      const r = getHistory()[Number(item.dataset.i)];
      if(r){ state.route = r; stopTimer(); stopGpsWatch(); clearActiveRoute(); updateMap(); fitRoute(); updateUI(); closePanel(); }
    }));
  }

  function togglePanel(){ els.sidePanel.classList.toggle('open'); els.panelBackdrop.classList.toggle('open'); }
  function closePanel(){ els.sidePanel.classList.remove('open'); els.panelBackdrop.classList.remove('open'); }

  function clearLocalData(){
    const ok = confirm('Esto borrará el recorrido activo y el historial local guardado en este navegador. ¿Continuar?');
    if(!ok) return;
    stopGpsWatch(); stopTimer(); state.route = null;
    clearActiveRoute(); saveHistory([]);
    try{ localStorage.removeItem(DRAFT_KEY); }catch(_){ }
    renderHistory(); updateUI();
    showMessage('Registros borrados', 'Se limpiaron los datos locales de CASUR Transportes GPS en este navegador.');
  }

  function bindEvents(){
    els.btnMenu.addEventListener('click', togglePanel);
    els.panelBackdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closePanel(); });
    [els.driverName,els.vehiclePlate,els.equipmentCode,els.tripType,els.origin,els.destination,els.initialNote].forEach(el => el.addEventListener('input', saveFormDraft));
    els.btnStart.addEventListener('click', startRoute);
    els.btnFinish.addEventListener('click', finishRoute);
    els.btnFinishBottom.addEventListener('click', finishRoute);
    els.btnResumeGps.addEventListener('click', () => { startGpsWatch(); updateUI(); });
    els.btnCenter.addEventListener('click', centerLast);
    els.btnCsvPoints.addEventListener('click', exportPointsCsv);
    els.btnCsvSummary.addEventListener('click', exportSummaryCsv);
    els.btnReport.addEventListener('click', generateReport);
    els.btnWhatsapp.addEventListener('click', shareWhatsapp);
    els.btnCard.addEventListener('click', drawCard);
    els.btnClearLocal.addEventListener('click', clearLocalData);
    els.btnToggleSummary.addEventListener('click', () => {
      els.summaryDetails.classList.toggle('hidden');
      els.btnToggleSummary.textContent = els.summaryDetails.classList.contains('hidden') ? 'Ver detalle' : 'Ocultar';
    });
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); state.deferredPrompt = e; els.btnInstall.classList.remove('hidden');
    });
    els.btnInstall.addEventListener('click', async () => {
      if(!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice.catch(()=>{});
      state.deferredPrompt = null;
      els.btnInstall.classList.add('hidden');
    });
  }

  function registerServiceWorker(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./service-worker.js?v=transportes_gps_v1').catch(err => console.warn('SW no registrado', err));
    }
  }

  function boot(){
    window.__CASUR_TRANSPORTES_READY__ = true;
    initMap();
    bindEvents();
    loadFormDraft();
    renderHistory();
    recoverActiveRoute();
    updateUI();
    registerServiceWorker();
    setTimeout(() => {
      els.loader?.classList.add('hidden');
      els.appShell?.classList.remove('hidden');
      if(state.map) setTimeout(()=>state.map.invalidateSize(), 250);
    }, 350);
  }

  boot();
})();
