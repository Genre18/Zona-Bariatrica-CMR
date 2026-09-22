# CRM Zona Bariátrica — guía para Claude Code

Herramienta interna de Zona Bariátrica (venta de suplementos 100% por delivery; las ventas llegan por WhatsApp). La usan Roberto (dueño) y Genesis, más un portal de solo lectura para el socio (doctor) que provee Bari&Nutrition y es socio en Bariatric Fusion/Life/Nutrifath.

> **Este repo es PÚBLICO.** Nunca escribir aquí (ni en commits) contraseñas, correos, PINs, datos de clientes, montos reales ni respaldos. Los datos viven en Supabase, no en el repo.

## Qué es y dónde vive
- **Todo es un solo archivo: `index.html`** (HTML + CSS + JS, ~7.600 líneas, sin build, sin dependencias locales).
- **En vivo:** https://genre18.github.io/Zona-Bariatrica-CMR/ (GitHub Pages, rama `main`, raíz).
- **Datos:** Supabase, tabla `crm_estado`, fila `id=1`: TODO el objeto `db` como un único blob JSONB. `cargar()` lo trae, `guardar()` lo escribe en localStorage (`zbdb_v1`) y lo empuja a la nube con debounce (`guardarEnNube()`). La sincronización en vivo (`suscribirCambiosNube()`) reemplaza el `db` completo: "el último que guarda, gana".
- **Seguridad real:** login de Supabase Auth (correo + contraseña) + Row Level Security en `crm_estado` (solo usuarios autenticados leen/escriben). La clave de Supabase que está en `index.html` es la pública (anon) y es normal que esté ahí. **No tocar RLS, políticas ni el flujo de auth.**
- El PIN de 4 dígitos (2ª pantalla) solo identifica QUIÉN usa el CRM; no es la seguridad real.

## Flujo de trabajo (obligatorio)
1. **Antes de empezar cualquier cambio:** `git pull origin main` (Genesis y Roberto pueden estar trabajando ambos).
2. Editar `index.html`.
3. Verificar: extraer el `<script>` y correr `node --check` sobre él. Para probar lógica, extraer solo las funciones puras y probarlas con Node. Correr el script completo fuera del navegador falla porque `cargar()` intenta conectarse a Supabase.
4. Publicar: `git add index.html && git commit -m "..." && git push origin main`. **No usar `git add -A` / `git add .`**: hay carpetas locales (respaldos, backups, capturas) que nunca deben subirse.
5. Pages tarda ~1-2 min en redesplegar. Para confirmar: `curl -s https://genre18.github.io/Zona-Bariatrica-CMR/ | grep "<algo del cambio>"` antes de concluir que algo no funcionó (puede ser caché).
6. Si el cambio es grande o riesgoso, primero hacer una copia local `index.backup-antes-<tema>-<fecha>.html` (ignorada por git).

Para deshacer un cambio ya publicado: `git revert <commit>` + push (no reescribir historial con `reset --hard`/`push --force`).

## Reglas del negocio que NO se deben romper
- **Nunca migrar, recalcular ni "arreglar" datos históricos automáticamente** desde el código. Las reglas nuevas se aplican desde una fecha de vigencia (`VIGENCIA_PROMO_BN`, `VIGENCIA_PROMO_FUSION`, `VIGENCIA_ACREDITACION_TARJETA`) y las ventas anteriores quedan como estaban.
- Una venta se registra cuando llega el comprobante → nace "pagado" y descuenta stock. Excepción: provincia contra entrega → "pendiente pago" (descuenta stock igual, no cuenta en Reportes hasta marcarla pagada).
- Pago con tarjeta: no cuenta (ni para Ganancia ZB ni para pagar al proveedor/socio) hasta marcarla "acreditada" a mano (`ventaAcreditada()`).
- Recargo tarjeta 4% se calcula solo sobre productos (subtotal − descuento), no sobre delivery/embalaje.
- Proveedores/socio: **una sola fuente de verdad `estadoCuentaProveedor()`**. Saldo = obligación total − Σ pagos (las `asignaciones[]` son solo detalle, no cambian el saldo). Lo que se le paga al socio en marcas de reparto = **costo + participación** (`totalDoctorItem`).
- La pauta publicitaria (`gastosPauta[]`) nunca se borra: se anula con motivo (`anularGastoPauta`).
- No inventar valores de configuración faltantes (p. ej. marca sin `responsableDespachoMarca` queda bloqueada a propósito hasta configurarla a mano).
- La Vista Socio (`pintarVistaSocio`) es de solo lectura para el doctor: no mostrarle contabilidad interna sin resolver.

## Flags con estado intencional
- `MODO_PRUEBAS=false`: dejar así en producción.
- `PERMITIR_EDITAR_ENTRADAS_CON_MOVIMIENTOS_POSTERIORES=true`: **temporal**, para que Roberto corrija stock viejo. Volverlo a `false` solo cuando Roberto confirme que terminó.

## Convenciones de UI / código
- Pestañas reales (`<nav class="tabs">`): Leads, Clientes, Stock, Proveedores, Tareas, Reportes, Config. **No existe pestaña "Pedidos"** (hay una tabla oculta/muerta; no agregar cosas ahí). Antes de decir "lo agregué en X", verificar que X sea visible desde esa navegación.
- Acciones frecuentes van en la lista; acciones pesadas o poco frecuentes (editar venta, marcar entregado/acreditado) van en **Historial → Ver detalle**.
- Reutilizar lo que ya existe (`.chip`, `.stat`, `.reportes-kpis`, `var(--border)`, `abrirModal`, `ordenarTablaPor`) en vez de crear estilos o sistemas paralelos.
- Botones dentro de `<form>` llevan `type="button"` (Enter no debe enviar pedidos a medio llenar; ver `evitarEnviarConEnter`).
- Código y textos en español, mismo estilo del archivo.

## Cómo trabajar con Roberto/Genesis
- Explicar en español simple, sin jerga.
- Si un pedido de UI es ambiguo, dar opinión/feedback en prosa antes de implementar (no solo un menú de opciones).
- Para analizar datos reales: pedir que descarguen un respaldo (Config → Respaldo de datos) y den la ruta; leerlo con Node. Nunca subir ese archivo al repo.
