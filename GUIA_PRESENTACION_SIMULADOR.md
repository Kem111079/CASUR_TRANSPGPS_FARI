# Guía rápida para presentar CASUR Transportes GPS

## Objetivo de la demo

Mostrar que la app puede registrar un recorrido operativo de transporte, ubicarlo sobre fincas/lotes/referencias, detectar paradas y generar respaldos en Excel/PDF.

## Enlace para presentar

Abrir:

`simulador.html`

Si no redirecciona, abrir:

`index.html?demo=1`

## Secuencia sugerida para 5 minutos

1. Explicar que el botón **Demo guiada** simula puntos GPS sin usar ubicación real.
2. Presionar **Demo guiada** y mostrar:
   - mapa;
   - ruta en amarillo/verde;
   - flechas de rumbo;
   - ubicación actual por finca/lote o carretera.
3. Mostrar que la bitácora indica distancia, duración, velocidad y paradas.
4. Presionar **Generar demo** si se necesita llegar rápido al resultado final.
5. Cambiar a **Modo Supervisor** para enseñar historial y acciones.
6. Descargar **Excel recorrido** y **PDF del recorrido**.
7. Cerrar con el mensaje: “La PWA sirve para probar el flujo y generar evidencia; para seguimiento continuo en segundo plano se recomienda la futura app híbrida”.

## Mensaje ejecutivo recomendado

CASUR Transportes GPS busca convertir cada viaje en una bitácora operativa: quién condujo, qué equipo usó, de dónde salió, hacia dónde fue, cuánto recorrió, cuánto tiempo estuvo detenido, por qué zonas pasó y qué respaldo queda para control de costos.

## Limitación importante

La PWA no garantiza GPS en segundo plano. El simulador es solo para presentación. Para operación completa con el teléfono libremente, la siguiente etapa debe ser app híbrida/nativa con permisos claros, visibles y sin rastreo oculto.
