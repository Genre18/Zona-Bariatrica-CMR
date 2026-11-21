# CRM Zona Bariátrica — guía para Claude Code

Herramienta interna de Zona Bariátrica (venta de suplementos 100% por delivery; las ventas llegan por WhatsApp). La usan Roberto (dueño) y Genesis, más un portal de solo lectura para el socio (doctor) que provee Bari&Nutrition y es socio en Bariatric Fusion/Life/Nutrifath.

> **Este repo es PÚBLICO.** Nunca escribir aquí (ni en commits) contraseñas, correos, PINs, datos de clientes, montos reales ni respaldos. Los datos viven en Supabase, no en el repo.

## Qué es y dónde vive
- **Todo es un solo archivo: `index.html`** (HTML + CSS + JS, ~10.500 líneas, sin build, sin dependencias locales). Aparte, `pruebas/` tiene las pruebas automáticas (se corren con Node; la página no las usa).
- **En vivo:** https://genre18.github.io/Zona-Bariatrica-CMR/ (GitHub Pages, rama `main`, raíz).
- **Datos:** Supabase, tabla `crm_estado`, fila `id=1`: TODO el objeto `db` como un único blob JSONB. `cargar()` lo trae, `guardar()` lo escribe en localStorage (`zbdb_v1`) y lo empuja a la nube con debounce (`guardarEnNube()`). La sincronización en vivo (`suscribirCambiosNube()`) reemplaza el `db` completo: "el último que guarda, gana".
- **Cambios sin subir (2026-11-20):** `guardar()` marca `zbdb_pendiente_nube` antes de enviar; se limpia solo cuando la nube confirma. `zbdb_base_nube` = última versión que este dispositivo sabe que está en la nube. Mientras haya pendiente, ni `cargar()`, ni Realtime, ni volver a la pestaña reemplazan `db`: `sincronizarPendiente()` combina con `fusionarTresVias(base, local, nube)` (si solo un lado cambió un registro gana ese; si los dos, gana este dispositivo; nuevos de ambos lados se conservan) y sube. Reintento solo 5 s → 60 s y al volver la conexión (`online`). `cargar()` sigue sin escribir en la nube; la subida ocurre en `entrarApp()`. Prueba: `pruebas/sincronizacion.test.js`.
- **Seguridad real:** login de Supabase Auth (correo + contraseña) + Row Level Security en `crm_estado` (solo usuarios autenticados leen/escriben). La clave de Supabase que está en `index.html` es la pública (anon) y es normal que esté ahí. **No tocar RLS, políticas ni el flujo de auth.**
- El PIN de 4 dígitos (2ª pantalla) solo identifica QUIÉN usa el CRM; no es la seguridad real.

## Flujo de trabajo (obligatorio)
1. **Antes de empezar cualquier cambio:** `git pull origin main` (Genesis y Roberto pueden estar trabajando ambos).
2. Editar `index.html`.
3. **Verificar SIEMPRE antes de publicar: `node pruebas/correr.js`.** Revisa la sintaxis de `index.html` y corre las pruebas de plata (ventas, proveedores/socio, ganancia y gastos) contra el código real, con datos inventados y sin conectarse a Supabase. **Si dice "NO publicar", no hacer push**: arreglar el código, o — solo si la regla de negocio cambió A PROPÓSITO y Roberto/Genesis lo confirmaron — actualizar la prueba y decirlo en el commit.
   - Si el cambio toca plata (precios, descuentos, recargos, saldos de proveedor/socio, pagos, ganancia, gastos, stock), **agregar o ajustar una prueba** en `pruebas/*.test.js` en el mismo commit. Patrón: `const {crearEntorno,pruebas}=require('./entorno'); const {A,ctx,campos}=crearEntorno();` → `A.cualquierFuncion(...)`, `A.db={...}` para poner datos, `campos['id-del-input']='valor'` para simular formularios.
   - Las pruebas nunca usan respaldos ni datos reales (este repo es público).
4. Publicar: `git add index.html pruebas && git commit -m "..." && git push origin main`. **No usar `git add -A` / `git add .`**: hay carpetas locales (respaldos, backups, capturas) que nunca deben subirse.
5. Pages tarda ~1-2 min en redesplegar. Para confirmar: `curl -s https://genre18.github.io/Zona-Bariatrica-CMR/ | grep "<algo del cambio>"` antes de concluir que algo no funcionó (puede ser caché).
6. Si el cambio es grande o riesgoso, primero hacer una copia local `index.backup-antes-<tema>-<fecha>.html` (ignorada por git).

Para deshacer un cambio ya publicado: `git revert <commit>` + push (no reescribir historial con `reset --hard`/`push --force`).

## Reglas del negocio que NO se deben romper
- **Nunca migrar, recalcular ni "arreglar" datos históricos automáticamente** desde el código. Las reglas nuevas se aplican desde una fecha de vigencia (`VIGENCIA_PROMO_BN`, `VIGENCIA_PROMO_FUSION`) y las ventas anteriores quedan como estaban. Excepción: una corrección única pedida explícitamente por Genesis/Roberto (ver "Correcciones únicas"), simulada antes con un respaldo.
- Una venta se registra cuando llega el comprobante → nace "pagado" y descuenta stock. Excepción: contra entrega → "pendiente pago" (descuenta stock igual, no cuenta en Reportes hasta marcarla pagada). Provincia (Shalom) también puede quedar "pendiente pago" (desde el 15-11-2026 se quitó el bloqueo de solo al contado). Al confirmar la entrega, "Sí, ya pagó" viene marcado (se toca "Todavía no" solo en la excepción).
- Pago con tarjeta (Izipay): desde el 18-11-2026 cuenta desde el día 1 (`ventaAcreditada()` siempre devuelve true; se dejó porque Reportes/Proveedores la consultan); ya no existe el paso manual de acreditar.
- Se cobra al entregar: no hay lista de deudores. Una venta "pendiente pago" con más de `DIAS_AVISO_COBRO` días queda en el tablero con su etiqueta roja "Pendiente de pago · N días" hasta marcarla pagada. La pestaña Envíos NO muestra número por esto: solo el número ROJO de pedidos web por registrar (rojo a pedido de Genesis, el azul se pierde con la barra; 21-11-2026).
- Recargo tarjeta 4% se calcula solo sobre productos (subtotal − descuento), no sobre delivery/embalaje.
- Proveedores/socio: **una sola fuente de verdad `estadoCuentaProveedor()`**. Saldo = obligación total − Σ pagos (las `asignaciones[]` son solo detalle, no cambian el saldo). Lo que se le paga al socio en marcas de reparto = **costo + participación** (`totalDoctorItem`).
- La pauta publicitaria (`gastosPauta[]`) nunca se borra: se anula con motivo (`anularGastoPauta`).
- No inventar valores de configuración faltantes (p. ej. marca sin `responsableDespachoMarca` queda bloqueada a propósito hasta configurarla a mano).
- La Vista Socio (`pintarVistaSocio`) es de solo lectura para el doctor: no mostrarle contabilidad interna sin resolver.

## Flags con estado intencional
- `MODO_PRUEBAS=false`: dejar así en producción.
- `PERMITIR_EDITAR_ENTRADAS_CON_MOVIMIENTOS_POSTERIORES=true`: **temporal**, para que Roberto corrija stock viejo. Volverlo a `false` solo cuando Roberto confirme que terminó.

## Convenciones de UI / código
- Pestañas reales (`<nav class="tabs">`): Leads, Clientes, Envíos, Stock, Proveedores, Tareas, Gastos, Reportes, Config. **No existe pestaña "Pedidos"** (hay una tabla oculta/muerta; no agregar cosas ahí). Antes de decir "lo agregué en X", verificar que X sea visible desde esa navegación.
- Acciones frecuentes van en la lista; acciones pesadas o poco frecuentes (editar venta) van en **Historial → Ver detalle**.
- **Número de venta fijo:** cada pedido guarda `numeroVenta` al crearse (`siguienteNumeroVenta()`); `correlativoVenta()` lo muestra. Nunca recalcular por fecha.
- **El CRM asume lo normal y solo pide la excepción** (regla de Genesis): se cobra al entregar ("Sí, ya pagó" viene marcado), la tarjeta (Izipay) cuenta desde el día 1, no hay lista de deudores (solo la etiqueta roja en la tarjeta si una venta lleva más de 2 días pendiente). No agregar pasos manuales de confirmación.

### Colores: cada color dice UNA sola cosa (2026-11-18)
- **Estado:** verde = listo/al día · ámbar/naranja = falta algo · rojo = urgente/vencido/anulado · violeta = plata pendiente del cliente · azul = acción/botón.
- **Identidad** (nunca naranja, ámbar, rojo ni verde): etapas de Envíos (`chip-etapa-recibido/empaquetado/despachado`), Lima (`chip-lima`, rosa) / Provincia (`chip-provincia`, cian), marcas (`colorMarca()` / `COLORES_MARCA`).
- En tablas largas, color solo para lo que pide acción (ej. Clientes: "Activo" en texto gris sin chip; marcas en texto). Puntos de marca solo en Stock y en Ventas por marca.
- Estilo pedido por Genesis: sofisticado, moderno, elegante, con alegría pero sin ruido. **Mostrar capturas antes de publicar cambios visuales** (copia local con datos de un respaldo + Chrome headless).

### Tarjetas de Envíos
- Una acción del paso en `.btn-paso` (azul suave, relleno solo al pasar el mouse), 1–2 accesos frecuentes, `↩` (solo ícono) para volver y el resto en "⋯" (`details.env-mas`). Anular / devolver solo dentro de "⋯" (el rojo nunca visible en la tarjeta). WhatsApp se llama "WhatsApp" en todas las etapas y "WhatsApp ✓" cuando se mandó (`avisoRecibidoEn` / `avisoEnvioEn`).

### Términos (una palabra por concepto)
- En pantalla: "Pendiente de pago", "Pagado", "Anulado", "Activo" (recompra), "Tarjeta (Izipay)" (`nombreMetodoPago()`; el valor guardado sigue siendo "Tarjeta de crédito"), estados de envío Recibido/Empaquetado/Despachado/Entregado (`NOMBRE_ESTADO_ENVIO`). Nunca mostrar nombres internos ("pendiente preparación", "pendiente pago").
- Al guardar: nombres/apellidos/lugares con `nombrePropio()`; sabor/presentación de Stock con `primeraMayuscula()`. Nunca a productos, direcciones, emails, códigos ni notas.

### Correcciones únicas (quitar cuando ya corrieron)
- En `entrarApp()` corren una sola vez (marca en `db.config.correccionesAplicadas`): `aplicarCorreccionCobros20261118`, `aplicarCorreccionEntrega20261118`, `aplicarCorreccionNombres20261118`, `aplicarCorreccionStockTexto20261118`, `aplicarCorreccionPrecioBL20261118`. Cuando un respaldo muestre las 5 marcas, borrar esas funciones y sus llamadas.

### Respaldo automático
- `supabase/04_respaldo_diario.sql` (local, no se sube): tabla `crm_respaldos` + pg_cron diario 03:00 Lima, 30 días. Hay que correrlo una vez en el SQL Editor de Supabase. Para recuperar: `select data from crm_respaldos order by creado_en desc limit 1`.
- "Productos vendidos" (Reportes) agrupa por `stockId`: corregir el nombre de un producto (tildes, etc.) no parte su historial.
- Reutilizar lo que ya existe (`.chip`, `.stat`, `.reportes-kpis`, `var(--border)`, `abrirModal`, `ordenarTablaPor`) en vez de crear estilos o sistemas paralelos.
- **Tamaños de letra: solo esta escala** — 11 (notas/encabezados de tabla), 12 (tablas densas, chips), 13 (texto de tabla/secundario), 14 (botones, texto normal de UI), 15, 16 (inputs en celular), 18 (subtítulos), 22, 24, 28 (números grandes). Nada menor a 11px. Pesos: 400, 500, 600, 700. No inventar tamaños intermedios (12.5, 13.5...).
- Botones: `.btn` (principal azul) y `.btn-secundario` (blanco con borde); agregar `.btn-chico` para la versión compacta. Ya tienen forma propia: no ponerles padding/border-radius en línea.
- En celular (≤640px) Clientes y Leads se muestran como tarjetas con CSS por posición de columna (bloque "CELULAR" en el <style>): si se agrega/quita/reordena una columna en pintarClientes()/pintarLeads(), ajustar ese bloque.
- Botones dentro de `<form>` llevan `type="button"` (Enter no debe enviar pedidos a medio llenar; ver `evitarEnviarConEnter`).
- Código y textos en español, mismo estilo del archivo.

## Cómo trabajar con Roberto/Genesis
- Explicar en español simple, sin jerga.
- Si un pedido de UI es ambiguo, dar opinión/feedback en prosa antes de implementar (no solo un menú de opciones).
- Para analizar datos reales: pedir que descarguen un respaldo (Config → Respaldo de datos) y den la ruta; leerlo con Node. Nunca subir ese archivo al repo.
