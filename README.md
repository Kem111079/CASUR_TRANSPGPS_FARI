# CASUR Transportes GPS · V1

PWA satélite basada conceptualmente en CASUR Maps V22.6, enfocada en registrar recorridos operativos de transporte en campo/ingenio.

## Objetivo

Permitir que un transportista o supervisor pueda:

1. ingresar datos básicos del recorrido;
2. iniciar manualmente el GPS;
3. registrar puntos durante la ruta;
4. finalizar el recorrido;
5. obtener resumen automático;
6. exportar CSV de puntos y resumen;
7. generar reporte HTML imprimible;
8. compartir resumen por WhatsApp;
9. generar tarjeta PNG ejecutiva.

## Estructura

```text
CASUR_TRANSPORTES_GPS_V1/
├─ index.html
├─ app.js
├─ styles.css
├─ manifest.json
├─ service-worker.js
├─ offline.html
├─ assets/
│  └─ logo_casur.png
├─ icons/
├─ data/
│  └─ .gitkeep
├─ README.md
├─ README_USO_CAMPO.md
└─ CHECKLIST_PRUEBA.md
```

## Instalación en GitHub Pages

1. Crear un repositorio, por ejemplo: `casur-transportes-gps`.
2. Subir todo el contenido de esta carpeta a la raíz del repositorio.
3. Activar GitHub Pages:
   - Settings → Pages.
   - Source: `Deploy from a branch`.
   - Branch: `main` / root.
4. Abrir la URL HTTPS generada por GitHub Pages.
5. En Android/iPhone, abrir desde navegador y elegir “Agregar a pantalla de inicio” o “Instalar app”.

## Requisitos

- Debe abrirse desde HTTPS o localhost para que el navegador permita GPS.
- Leaflet se carga desde CDN con fallback. Si el teléfono no tiene conexión, el mapa puede no cargar, pero el registro local puede mantenerse si la app ya estaba abierta.
- En iPhone/Android, el sistema puede pausar ubicación si el navegador queda totalmente en segundo plano. Esta es una restricción del sistema operativo, no de la app.

## Privacidad y uso responsable

La app no hace rastreo oculto.

- El usuario debe pulsar manualmente **Iniciar recorrido**.
- La pantalla muestra claramente si el GPS está activo.
- El usuario puede pulsar **Finalizar recorrido**.
- Los registros se guardan localmente en el navegador.
- El usuario puede borrar los datos locales desde el panel.
- No hay backend ni envío automático de datos.

## Lógica GPS V1

- Guarda puntos por tiempo y movimiento.
- Regla por defecto: cada 4 segundos y/o cuando se mueve más de 12 metros.
- Evita puntos duplicados si el equipo está detenido.
- Calcula distancia con fórmula Haversine.
- Evita sumar distancia cuando la precisión es mala o el salto implica una velocidad poco razonable.
- Detecta paradas simples por baja velocidad o puntos cercanos durante varios minutos.

## Exportaciones

### CSV puntos GPS

Columnas:

- route_id
- timestamp
- lat
- lng
- precision_m
- velocidad_kmh
- rumbo
- segmento_m
- distancia_acumulada_km
- calidad_gps
- razon
- distancia_ignorada

### CSV resumen

Columnas:

- route_id
- conductor
- placa
- equipo
- tipo_viaje
- origen
- destino
- inicio
- fin
- duración
- distancia
- velocidad promedio
- velocidad máxima
- paradas
- tiempo detenido
- puntos
- calidad GPS
- observaciones

## Reporte HTML

El botón **Reporte HTML** descarga un archivo `.html` y abre una vista imprimible. Desde Chrome, Edge o Safari puede guardarse como PDF con `Imprimir → Guardar como PDF`.

## Versionado

- `CASUR_TRANSPORTES_GPS_V1` corresponde al primer prototipo funcional.
- Para evitar caché viejo en PWA, cada nueva versión debe cambiar:
  - query string de `app.js` y `styles.css` en `index.html`;
  - `CACHE_NAME` en `service-worker.js`;
  - versión visible en README.

## Próximas fases recomendadas

- V2: mejorar paradas con agrupación espacial más precisa.
- V3: reporte HTML con mapa más completo o captura de recorrido.
- V4: tarjeta visual con más diseño y firma institucional.
- V5: historial consolidado por conductor/placa.
- V6: migrar historial a IndexedDB para alto volumen de recorridos.
