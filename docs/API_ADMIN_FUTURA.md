# API Administrador futura · CASUR Transportes GPS

Esta versión V5 no sincroniza con servidor, pero deja la estructura preparada para una app administrador.

## Objeto recorrido sugerido

```json
{
  "folio": "CASUR_M000123_20260618_213245",
  "id": "CASUR-1780000000000",
  "deviceId": "DEV_20260618_213245_AB12CD",
  "version": "5.0.0-ux-multirecorrido",
  "syncStatus": "local_pendiente",
  "hashLocal": "A1B2C3D4",
  "fields": {
    "conductor": "",
    "placa": "",
    "equipo": "",
    "tipoViaje": "Caña",
    "origen": "",
    "destino": ""
  },
  "startedAt": "2026-06-18T21:32:45.000Z",
  "endedAt": "2026-06-18T22:10:12.000Z",
  "metrics": {},
  "points": [],
  "stops": [],
  "events": [],
  "checkpoints": []
}
```

## Estados de sincronización

- `activo_local`: recorrido activo en el dispositivo.
- `local_pendiente`: finalizado y pendiente de enviar.
- `sincronizado`: enviado a base central.
- `error_sync`: error de envío.

## Flujo futuro recomendado

1. El conductor finaliza recorrido.
2. La app guarda localmente.
3. Si hay internet, envía JSON al backend.
4. El backend responde con confirmación.
5. La app cambia `syncStatus` a `sincronizado`.
6. La app administrador permite consultar, filtrar, descargar Excel y ver ruta en mapa.

## Backends posibles

- Supabase.
- Firebase.
- Google Sheets + Apps Script.
- API propia CASUR.
- Servidor interno.

## Privacidad

La sincronización debe ser visible. No debe existir rastreo oculto ni envío de recorridos no iniciados por el usuario.
