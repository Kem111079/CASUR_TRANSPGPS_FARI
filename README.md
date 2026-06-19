# CASUR Transportes GPS · V3 Operativa

PWA para registrar recorridos de transporte en campo/ingenio, con trayectoria GPS, fincas/lotes CASUR, referencias operativas para lugares fuera del shape, paradas, historial local y exportación a Excel ejecutivo.

## Objetivo

La app no es un rastreador oculto. El usuario activa GPS, inicia manualmente un recorrido y lo detiene manualmente. El propósito es generar evidencia operativa para revisar distancia, tiempo, paradas, lugares recorridos y posibles tiempos muertos del recurso transporte.

## Mejoras V3

- Shape enriquecido con finca/hacienda desde `Maestro_2627.xlsx` usando `CodSuerte` / código de lote.
- Se agregan campos `Finca`, `Nombre_Hacienda`, `Finca_Fuente`, `Finca_CodMatch` y `EtiquetaMapa` al GeoJSON.
- Botón principal `Activar GPS` antes de iniciar el recorrido.
- Pantalla móvil más compacta: métricas, iniciar/detener y bloques contraíbles.
- Se ocultan de la pantalla principal el conteo de lotes, autosave, norte y lote; quedan en opciones avanzadas.
- Botón `Marcar lugar` para nombrar zonas fuera del shape: carretera, entrada, báscula, taller, patio, comunidad o cruce.
- Jerarquía de referencia: lote/finca dentro del polígono → lote/finca cercana → referencia operativa → sin referencia.
- Excel más corto y útil: Resumen, Paradas, Lugares, Detalle GPS, Eventos y Referencias.
- Reporte HTML con trayectoria simplificada y lugares del recorrido.
- Preparada para migrar después a app híbrida/nativa con seguimiento real en segundo plano.

## Estructura

```text
CASUR_TRANSPORTES_GPS_V3_OPERATIVA/
├─ index.html
├─ app.js
├─ styles.css
├─ manifest.json
├─ service-worker.js
├─ offline.html
├─ data/
│  ├─ poligonos_casur.geojson
│  ├─ maestro_fincas.json
│  ├─ referencias_operativas.json
│  └─ metadata.json
├─ icons/
├─ assets/
└─ docs/
```

## Publicación en GitHub Pages

1. Subir todo el contenido de la carpeta a un repositorio.
2. Activar GitHub Pages desde `Settings > Pages`.
3. Usar `main` y carpeta raíz.
4. Abrir la URL HTTPS generada por GitHub Pages.
5. En celular, usar “Agregar a pantalla de inicio” o “Instalar app”.

## Nota sobre segundo plano

Como PWA, el navegador puede pausar GPS si el usuario cambia de app, bloquea pantalla o tiene ahorro de batería. La app guarda el recorrido activo y marca eventos de posible pausa, pero el seguimiento continuo en segundo plano requiere migración posterior a app híbrida/nativa.
