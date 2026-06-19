# CASUR Transportes GPS V5 · UX Multirecorrido

PWA operativa para registrar recorridos de transporte en campo/ingenio con GPS, Leaflet, shape de lotes/fincas CASUR, referencias operativas manuales, paradas, historial local, folio robusto, PDF, Excel ejecutivo y WhatsApp.

## Novedades V5

- **Modo Conductor / Modo Supervisor**: la app inicia en modo conductor para reducir carga visual. El modo supervisor muestra historial, opciones avanzadas, capas y controles técnicos.
- **Pantalla móvil más limpia**: se ocultan definitivamente conteos técnicos de lotes/fincas, autosalvado visible y mensajes que no aportan al transportista.
- **Bitácora más compacta**: al estar colapsada solo muestra métricas clave; al tocar el mapa o fuera del panel, se minimiza.
- **Zoom traslúcido con bitácora abierta**: el control `+ / -` baja su opacidad para no competir con el formulario.
- **Multirecorrido reforzado**: cada recorrido finalizado queda en historial local sin borrar los anteriores.
- **Folio robusto por recorrido**: formato tipo `CASUR_PLACA_YYYYMMDD_HHMMSS`; si no hay placa, usa equipo, conductor o `MOVIL`.
- **Preparación para app administrador**: cada recorrido incluye `deviceId`, `syncStatus`, `hashLocal`, versión de app y estructura lista para sincronización futura.
- **Exportación consolidada**: Excel consolidado con recorridos, paradas, lugares y eventos.

## Flujo recomendado en campo

1. Abrir la app desde URL HTTPS o instalada como PWA.
2. Tocar **Activar GPS** para ubicarse.
3. Completar conductor, placa/equipo, origen y destino.
4. Tocar **Iniciar recorrido**.
5. Usar el teléfono normalmente, sabiendo que el navegador puede pausar GPS en segundo plano.
6. Al terminar, regresar a la app y tocar **Finalizar recorrido**.
7. Descargar Excel/PDF o compartir resumen.
8. En modo supervisor, revisar historial o exportar consolidado.

## Estructura

```text
index.html
app.js
styles.css
manifest.json
service-worker.js
offline.html
assets/
icons/
data/
  poligonos_casur.geojson
  maestro_fincas.json
  referencias_operativas.json
  metadata.json
docs/
  ARQUITECTURA_HIBRIDA_FUTURA.md
  API_ADMIN_FUTURA.md
```

## Publicación en GitHub Pages

1. Subir todo el contenido de esta carpeta a un repositorio.
2. Activar GitHub Pages.
3. Abrir la URL HTTPS desde celular.
4. Instalar como app desde el navegador.
5. Probar GPS en campo abierto.
6. Si se actualiza la app, borrar caché del navegador o esperar actualización del service worker.

## Nota sobre segundo plano

Como PWA de navegador, el GPS en segundo plano no se puede garantizar en Android/iPhone. La app guarda el recorrido activo localmente y registra posibles pausas, pero para seguimiento continuo formal se recomienda migrar a app híbrida con Capacitor y permiso de ubicación en segundo plano.

## Privacidad operativa

No hay rastreo oculto. El usuario debe activar GPS e iniciar manualmente el recorrido. El registro termina al tocar **Finalizar recorrido**. Los datos quedan localmente hasta exportarse o sincronizarse en una fase futura.


## Actualización V5.4 · Referencia actual visible

- En Modo Conductor se muestra una línea simple de ubicación: `Ubicación: Cerca de finca/lote` o referencia operativa.
- En Modo Supervisor se muestra más detalle: tipo de referencia, distancia aproximada, fuente y precisión GPS.
- La referencia se mantiene visible aun cuando la bitácora está compacta, sin volver a mostrar badges técnicos de autosalvado o conteo de lotes.
- Se conserva la regla: lote/finca dentro del shape → cerca de lote/finca → referencia operativa → sin referencia.

## V5.5 · Simulador de presentación

Esta versión incluye un modo demo para presentar el proyecto sin depender del GPS real del teléfono.

### Cómo abrir el simulador

Después de publicar en GitHub Pages, abra:

`simulador.html`

o directamente:

`index.html?demo=1`

### Qué permite mostrar

- Activación simulada de GPS.
- Recorrido demo sobre el mapa.
- Trayectoria con flechas de rumbo.
- Referencia actual por finca/lote y carretera.
- Paradas detectadas.
- Historial local del recorrido demo.
- Exportación Excel.
- PDF del recorrido.
- Compartir por WhatsApp cuando el teléfono lo permite.

### Botones del simulador

- **Demo guiada:** anima el recorrido punto por punto para explicar el flujo en vivo.
- **Generar demo:** crea el recorrido completo de inmediato para mostrar reportes.
- **Finalizar demo:** cierra el recorrido demo en curso.
- **Limpiar demo:** borra recorridos demo del historial local.

> Nota: el simulador no representa GPS real. Es únicamente para demostración ejecutiva y capacitación.

## V5.8 · Modo Conductor con captura y envío visibles

Esta versión corrige el flujo observado en campo/presentación: en **Modo Conductor** ahora siempre quedan visibles dos acciones rápidas aun con la bitácora compacta:

- **Datos del viaje**: abre el formulario para ingresar conductor, placa/equipo, tipo de viaje, origen y destino.
- **Enviar / Exportar**: abre el resumen y las opciones para PDF, Excel, WhatsApp, impresión e imagen resumen.

La lógica de roles queda así:

- **Conductor**: captura datos, activa GPS, inicia/finaliza, marca lugares y envía/exporta el recorrido.
- **Supervisor**: revisa historial, rutas guardadas, exportación consolidada y opciones avanzadas.

El simulador inmersivo se mantiene para presentación gerencial.
