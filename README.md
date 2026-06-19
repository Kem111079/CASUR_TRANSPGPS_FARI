# CASUR Transportes GPS · V6 App Operativa sin simulador

Versión operativa para registrar recorridos reales con GPS desde navegador HTTPS/GitHub Pages.

## Cambios de esta versión

- Se eliminó la portada del simulador.
- `index.html` abre directamente la app operativa.
- Se quitaron `simulador.html` y la guía de presentación del simulador.
- Se desactivó el modo demo dentro de la app.
- Se conserva la UI móvil tipo bottom sheet.
- Se conserva el reporte optimizado con mapa operativo y resumen por tramos.
- Se conserva exportación Excel, PDF/HTML, WhatsApp e historial local.
- Se mantienen Modo Conductor y Modo Supervisor.

## Uso

1. Publicar el contenido del ZIP en GitHub Pages.
2. Abrir el enlace HTTPS.
3. En Modo Conductor, llenar datos del viaje.
4. Activar GPS.
5. Iniciar recorrido.
6. Finalizar recorrido.
7. Descargar o compartir Excel/PDF.

## Limitación PWA

En navegador, el GPS en segundo plano no está garantizado por iOS/Android. Para seguimiento continuo real se recomienda migrar después a app híbrida/Capacitor con permisos y notificación persistente.
