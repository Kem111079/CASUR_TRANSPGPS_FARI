# Arquitectura futura · CASUR Transportes GPS

## Objetivo

La V4 funciona como PWA GitHub Pages sin backend. Está diseñada como puente para una futura app híbrida/nativa con seguimiento en segundo plano y sincronización hacia una app administrador.

## Limitación de la PWA

La PWA puede registrar GPS mientras el navegador lo permite. En segundo plano, Android/iPhone pueden pausar la ubicación por ahorro de batería o política del navegador. Por eso, el recorrido se autosalva localmente y registra eventos de posible pausa.

## Futuro Modo Transporte Pro

Recomendado para operación formal:

- Capacitor o wrapper híbrido.
- Permiso explícito de ubicación en segundo plano.
- Notificación persistente: `CASUR Transportes GPS registrando recorrido`.
- Sin rastreo oculto: inicio y fin manuales.
- Base local SQLite/IndexedDB.
- Sincronización cuando haya internet.

## Futuro CASUR Transportes Admin

La app administrador no debe intentar extraer datos directamente del celular. El flujo correcto es:

1. El transportista finaliza recorrido.
2. El recorrido queda localmente como `local_pendiente`.
3. Al tener internet, se envía a base central.
4. El panel administrador ve recorridos por fecha, conductor, placa, finca, ruta y estado.
5. El administrador descarga Excel individual o consolidado.

## Estados de sincronización previstos

- `local_pendiente`: guardado en el teléfono, no enviado.
- `sincronizando`: envío en proceso.
- `sincronizado`: recibido por la base central.
- `error_sincronizacion`: quedó pendiente de reenviar.

## Campos mínimos para sincronizar

- ID recorrido.
- Conductor, placa, equipo.
- Tipo de viaje.
- Origen/destino.
- Inicio/fin.
- Puntos GPS.
- Paradas.
- Lugares/fincas/lotes.
- Referencias manuales usadas.
- Métricas operativas.
- Eventos.
- Estado GPS.

## Actualización V5

La V5 separa visualmente **Modo Conductor** y **Modo Supervisor**, y agrega campos de preparación para sincronización futura: `deviceId`, `syncStatus`, `hashLocal` y folio robusto. Esta estructura facilita migrar luego a Capacitor sin rehacer el modelo de datos.
