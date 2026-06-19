# Arquitectura futura híbrida · CASUR Transportes GPS

Esta V3 es una PWA robusta de campo, pero está diseñada como puente para migrar después a app híbrida/nativa.

## Por qué migrar

Una PWA no puede garantizar seguimiento GPS continuo en segundo plano en todos los teléfonos. Android y iPhone pueden pausar la pestaña por batería, memoria o privacidad.

## Qué conservar

- Interfaz móvil.
- Lógica de recorrido.
- Cálculo Haversine.
- Detección de paradas.
- Referencias operativas.
- Shape de lotes/fincas.
- Exportación Excel/HTML.
- Historial local.

## Qué agregar en app híbrida

- Capacitor o tecnología equivalente.
- Permiso explícito de ubicación en segundo plano.
- Notificación persistente: “CASUR Transportes GPS registrando recorrido”.
- Guardado local con SQLite/IndexedDB reforzado.
- Reintentos de GPS.
- Sincronización futura con servidor si CASUR lo aprueba.
- Políticas claras de consentimiento: iniciar/detener manualmente, sin rastreo oculto.

## Principio operativo

La app debe ser una herramienta de control de recorridos y optimización de transporte, no vigilancia oculta. El usuario siempre debe ver cuándo el GPS está activo.
