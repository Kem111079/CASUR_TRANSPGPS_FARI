# Checklist de prueba · CASUR Transportes GPS V5

## 1. Carga de app

- [ ] Abre desde GitHub Pages/HTTPS.
- [ ] No se queda en “Cargando”.
- [ ] Muestra mapa.
- [ ] Carga capa de lotes/fincas sin mostrar conteo técnico en móvil.
- [ ] Muestra únicamente estado GPS como badge principal.

## 2. Modo Conductor

- [ ] Inicia en modo conductor.
- [ ] Historial y opciones avanzadas no saturan la pantalla.
- [ ] El panel colapsado muestra métricas clave.
- [ ] Tocar el mapa minimiza la bitácora.
- [ ] El zoom se ve traslúcido cuando el panel está abierto.

## 3. GPS

- [ ] Botón Activar GPS solicita permiso.
- [ ] Centra el mapa en la ubicación.
- [ ] No inicia registro hasta tocar Iniciar recorrido.
- [ ] Permite reiniciar GPS desde modo supervisor.

## 4. Recorrido

- [ ] Inicia recorrido con folio tipo `CASUR_PLACA_YYYYMMDD_HHMMSS`.
- [ ] Guarda puntos GPS.
- [ ] Calcula distancia, duración, velocidad y paradas.
- [ ] Permite finalizar aunque la señal GPS sea mala.
- [ ] Guarda recorrido finalizado en historial local.

## 5. Multirecorrido

- [ ] Un nuevo recorrido no borra el anterior.
- [ ] Historial muestra varios recorridos.
- [ ] Cada recorrido mantiene folio propio.
- [ ] Puede cargar ruta anterior en mapa.
- [ ] Puede borrar un recorrido individual.

## 6. Exportaciones

- [ ] Descarga Excel individual.
- [ ] Descarga PDF individual.
- [ ] Genera reporte imprimible.
- [ ] Comparte por WhatsApp o abre respaldo de texto.
- [ ] Exporta consolidado en modo supervisor.

## 7. Referencias operativas

- [ ] Permite marcar lugar fuera de shape.
- [ ] Guarda referencia local.
- [ ] Usa referencia en próximos puntos cercanos.
- [ ] Excel muestra lugares/referencias.

## 8. Segundo plano

- [ ] Cambiar a otra app no borra el recorrido.
- [ ] Al regresar, conserva métricas.
- [ ] Si hubo pausa larga, registra evento de posible segundo plano.

## 9. Novedades V5.1 (campo)

- [ ] Al iniciar recorrido, la **pantalla se mantiene encendida** sola (Wake Lock) mientras la app está abierta.
- [ ] Si el teléfono recarga la app en pleno viaje, **recupera el recorrido y reanuda el GPS automáticamente** (no hay que tocar "Reiniciar GPS").
- [ ] Durante el recorrido, el mapa **sigue al vehículo** y solo recentra cuando se sale de pantalla; al arrastrar el mapa, deja de seguir hasta tocar "Activar GPS".
- [ ] Si se abre sin HTTPS (archivo local o http), aparece un **aviso claro** de que el GPS y el compartir no funcionarán.

## Cómo correr la prueba de campo (recomendado)

1. Abrir el enlace **https://** publicado (no el archivo local).
2. Conceder permiso de **ubicación: Permitir siempre / mientras se usa**.
3. Desactivar el ahorro de batería para el navegador en ese teléfono.
4. Hacer un viaje corto real (5–10 min) con la pantalla encendida.
5. Finalizar, descargar **PDF** y **Excel**, y probar **Compartir por WhatsApp**.
6. Anotar: ¿se mantuvo la pantalla? ¿hubo huecos en la ruta? ¿el WhatsApp adjuntó los archivos o cayó al respaldo de texto?

## Limitación esperada

El GPS con la pantalla apagada o con la app totalmente en segundo plano no está garantizado en PWA. El Wake Lock reduce mucho el problema manteniendo la pantalla activa, pero para seguimiento continuo formal con teléfono bloqueado se requiere app híbrida/nativa.


## Actualización V5.4 · Referencia actual visible

- En Modo Conductor se muestra una línea simple de ubicación: `Ubicación: Cerca de finca/lote` o referencia operativa.
- En Modo Supervisor se muestra más detalle: tipo de referencia, distancia aproximada, fuente y precisión GPS.
- La referencia se mantiene visible aun cuando la bitácora está compacta, sin volver a mostrar badges técnicos de autosalvado o conteo de lotes.
- Se conserva la regla: lote/finca dentro del shape → cerca de lote/finca → referencia operativa → sin referencia.

## Checklist rápido · Simulador de presentación V5.5

- [ ] Publicar ZIP descomprimido en GitHub Pages.
- [ ] Abrir `simulador.html`.
- [ ] Confirmar que aparece la barra **Modo simulador para presentación**.
- [ ] Presionar **Demo guiada**.
- [ ] Ver que el mapa dibuja la trayectoria con flechas.
- [ ] Confirmar que aparecen referencias como San Lucas/lote o carretera.
- [ ] Confirmar que se detectan paradas.
- [ ] Presionar **Generar demo** para crear el recorrido completo rápido.
- [ ] Probar descarga de Excel.
- [ ] Probar PDF del recorrido.
- [ ] Cambiar a Modo Supervisor y revisar historial.
- [ ] Usar **Limpiar demo** si se quiere repetir la demostración.

## Checklist V5.8 · Modo Conductor

- [ ] En móvil, Modo Conductor muestra **Datos del viaje** aunque la bitácora esté compacta.
- [ ] El botón **Datos del viaje** abre el formulario de conductor, placa, equipo, origen y destino.
- [ ] El botón **Enviar / Exportar** abre PDF, Excel y WhatsApp.
- [ ] En Modo Supervisor se ocultan los botones rápidos del conductor.
- [ ] El simulador inmersivo mantiene la ruta ida-retorno y permite exportar reporte.
