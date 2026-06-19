# Guía rápida de uso en campo · CASUR Transportes GPS V5

## Para el conductor

1. Abra la app.
2. Toque **Activar GPS**.
3. Revise que aparezca **GPS activo**.
4. Escriba conductor, placa/equipo, origen y destino.
5. Toque **Iniciar recorrido**.
6. Al finalizar el viaje, toque **Finalizar recorrido**.
7. Descargue Excel/PDF o comparta el resumen si se lo solicitan.

## Botones principales

- **Activar GPS**: ubica el teléfono, pero no inicia la bitácora.
- **Iniciar recorrido**: empieza el registro formal del viaje.
- **Finalizar recorrido**: cierra el viaje y lo guarda en historial local.
- **Marcar lugar**: permite nombrar carretera, entrada, báscula, taller, patio, comunidad o cruce cuando no hay lote/finca cerca.
- **Ver ruta**: ajusta el mapa para ver la trayectoria.

## Modo Conductor

Es el modo predeterminado. Muestra solo lo necesario para operar en campo.

## Modo Supervisor

Muestra historial, opciones avanzadas, capas y exportación consolidada. Úselo para revisión, no necesariamente para el transportista.

## Recomendaciones prácticas

- Abra siempre el **enlace https://** publicado (no el archivo suelto), o el GPS y el compartir no funcionarán.
- Active el GPS en campo abierto antes de iniciar.
- Al **Iniciar recorrido**, la pantalla se queda encendida sola; no la bloquee para que el GPS no se corte.
- Evite ahorro extremo de batería durante recorridos largos.
- No cierre el navegador si el viaje sigue activo. Si la app se recarga, recupera el viaje y reanuda el GPS sola.
- Si está en carretera o un lugar sin lote cercano, use **Marcar lugar** para que el recorrido quede mejor explicado.

## Respaldo

La app guarda automáticamente el recorrido activo en el navegador. Al finalizar, queda en historial local. Para respaldo externo, descargue Excel/PDF o comparta el recorrido por WhatsApp (adjunta PDF + Excel en teléfonos compatibles).


## Actualización V5.4 · Referencia actual visible

- En Modo Conductor se muestra una línea simple de ubicación: `Ubicación: Cerca de finca/lote` o referencia operativa.
- En Modo Supervisor se muestra más detalle: tipo de referencia, distancia aproximada, fuente y precisión GPS.
- La referencia se mantiene visible aun cuando la bitácora está compacta, sin volver a mostrar badges técnicos de autosalvado o conteo de lotes.
- Se conserva la regla: lote/finca dentro del shape → cerca de lote/finca → referencia operativa → sin referencia.

## Uso para presentación sin GPS real

Para una reunión o demostración, usar el enlace:

`simulador.html`

Flujo recomendado:

1. Abrir `simulador.html`.
2. Presionar **Demo guiada** si desea mostrar cómo se va registrando el recorrido.
3. Presionar **Generar demo** si necesita crear el viaje completo de inmediato.
4. Mostrar en pantalla:
   - mapa con trayectoria;
   - ubicación actual tipo finca/lote o carretera;
   - distancia, duración, velocidad y paradas;
   - historial del recorrido;
   - Excel y PDF.
5. Descargar el Excel o PDF para enseñar el respaldo operativo.

El simulador no rastrea ni usa la ubicación real. Para uso en campo, abrir la app normal sin `?demo=1`.

## V5.6 · Diferencia práctica entre modos

### Para conductor

Use **Modo Conductor**. Solo necesita llenar datos, activar GPS, iniciar, finalizar y descargar/compartir el recorrido.

### Para supervisor

Use **Modo Supervisor**. Ahí se revisan recorridos guardados, folios, rutas anteriores, Excel/PDF, consolidado y opciones avanzadas. Este modo no es para capturar viajes diarios, sino para controlar y auditar.
