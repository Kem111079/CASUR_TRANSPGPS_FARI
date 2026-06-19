# Checklist de prueba · CASUR Transportes GPS V3 Operativa

## Carga inicial

- [ ] La app abre en HTTPS/GitHub Pages.
- [ ] No se queda pegada en “Cargando”.
- [ ] El mapa satelital carga.
- [ ] La capa de lotes/fincas carga sin mostrar ruido técnico al usuario.
- [ ] Al tocar un lote, aparece finca/hacienda y código de lote/suerte.

## GPS

- [ ] `Activar GPS` solicita permiso.
- [ ] El mapa centra la ubicación actual.
- [ ] Se muestra una referencia actual: finca/lote, cerca de lote o sin referencia.
- [ ] Si el GPS falla, aparece mensaje claro.

## Recorrido

- [ ] Permite iniciar recorrido.
- [ ] Dibuja trayectoria en el mapa.
- [ ] Muestra flechas de rumbo.
- [ ] Calcula distancia y duración.
- [ ] Detecta paradas básicas.
- [ ] Permite detener recorrido aunque la señal GPS sea regular.

## Referencias operativas

- [ ] `Marcar lugar` funciona con GPS activo.
- [ ] Permite nombrar carretera/entrada/taller/báscula/comunidad.
- [ ] La referencia queda guardada localmente.
- [ ] En un recorrido posterior, la referencia se reconoce si se pasa cerca.

## Exportaciones

- [ ] Excel resumen se descarga con nombre automático fechado.
- [ ] Excel contiene hojas: Resumen, Paradas, Lugares, Detalle GPS, Eventos y Referencias.
- [ ] El resumen abre fácil y no queda saturado de puntos GPS.
- [ ] Reporte HTML muestra trayectoria simplificada.
- [ ] WhatsApp genera texto corto de resumen.

## Robustez

- [ ] Si se recarga la página con recorrido activo, se recupera el recorrido.
- [ ] Si se cambia de app y vuelve, marca posible pausa si aplica.
- [ ] El historial local conserva recorridos finalizados.
- [ ] Se puede borrar historial local.
