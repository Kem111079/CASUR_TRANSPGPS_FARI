# Checklist de prueba · CASUR Transportes GPS V1

## 1. Carga PWA

- [ ] Abre correctamente desde GitHub Pages HTTPS.
- [ ] No se queda pegada en “Cargando”.
- [ ] Carga `index.html`, `app.js`, `styles.css`, `manifest.json` y `service-worker.js`.
- [ ] Permite instalar como app en Android/iPhone.
- [ ] Al actualizar versión, no queda caché viejo.

## 2. GPS

- [ ] Solicita permiso de ubicación al iniciar recorrido.
- [ ] Muestra claramente “GPS activo”.
- [ ] Muestra advertencia si precisión es baja.
- [ ] Permite centrar la posición en el mapa.
- [ ] Permite finalizar aunque el GPS tenga mala señal.
- [ ] Permite reactivar GPS si se recupera un recorrido activo.

## 3. Recorrido

- [ ] Inicia recorrido con fecha/hora inicial.
- [ ] Registra punto inicial.
- [ ] Acumula distancia en km.
- [ ] Actualiza duración en tiempo real.
- [ ] Registra puntos con lat/lng/precisión/velocidad/rumbo.
- [ ] Evita duplicados cuando el equipo está detenido.
- [ ] No suma saltos GPS evidentemente malos.
- [ ] Finaliza recorrido con fecha/hora final.

## 4. Paradas

- [ ] Detecta paradas por baja velocidad o puntos cercanos.
- [ ] Calcula cantidad de paradas.
- [ ] Calcula tiempo detenido.
- [ ] Muestra paradas en reporte.

## 5. Persistencia local

- [ ] Guarda recorrido activo en `localStorage`.
- [ ] Si se cierra navegador, recupera el recorrido activo.
- [ ] No reactiva GPS automáticamente sin acción del usuario.
- [ ] Guarda historial local después de finalizar.
- [ ] Permite borrar registros locales.

## 6. Exportaciones

- [ ] Exporta CSV de puntos con extensión `.csv`.
- [ ] Exporta CSV resumen con extensión `.csv`.
- [ ] Genera reporte HTML con extensión `.html`.
- [ ] El reporte HTML puede imprimirse como PDF.
- [ ] Genera texto para WhatsApp.
- [ ] Genera tarjeta PNG.

## 7. UX móvil

- [ ] Botones son suficientemente grandes para campo.
- [ ] Panel lateral abre y cierra correctamente.
- [ ] Panel se cierra tocando fuera.
- [ ] La barra inferior aparece durante recorrido activo.
- [ ] El diseño es legible bajo sol.

## 8. Seguridad operativa

- [ ] La app indica que no hace rastreo oculto.
- [ ] El recorrido solo inicia manualmente.
- [ ] El recorrido finaliza manualmente.
- [ ] No existe envío automático a backend.
