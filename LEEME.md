# Zona Bariátrica — Panel interno

Herramienta de escritorio para ordenar el día a día del negocio: leads de WhatsApp/redes, clientes, pedidos, stock multimarca, pagos a proveedores y tareas entre Roberto y Genesis.

No necesita internet, servidor ni instalación. Todo corre en el navegador y los datos se guardan en **este equipo/navegador** (localStorage). Por eso es clave respaldar seguido (ver abajo).

## Cómo abrirla

Doble clic en `index.html`. Se abre en el navegador (Chrome, Edge, etc.) como una app normal.

## Acceso

Al entrar, cada quien toca su nombre y escribe su PIN de 4 dígitos:

- **Roberto** — PIN `1234`
- **Genesis** — PIN `4321`

Cámbienlos apenas empiecen a usarla de verdad: Configuración → Usuarios y PIN.

## Primeros pasos recomendados

1. **Configuración → Marcas**: confirmar que estén Bari&Nutrition, LVL Drink y (cuando arranque) Bariatric Fusion.
2. **Configuración → Importar datos existentes**: pegar ahí los 204 leads de la pauta y los clientes del CRM viejo de Drive, copiando y pegando directo desde Excel/Sheets (una fila por cliente/lead). Funciona mejor si se pega tal cual sale de Excel (columnas separadas por tabulación).
3. **Stock**: la herramienta ya trae cargado el catálogo real de productos (nombres y precios de venta tomados de zonabariatrica.com), pero con **cantidad en 0 y costo en 0** — hay que completar esos dos datos con lo que diga la hoja de cálculo actual y las facturas de los proveedores. Los packs/combos del sitio no están precargados como productos aparte: cada pack se arma en el pedido agregando sus productos individuales.
4. **Configuración → Envío y pauta**: ajustar el monto de embalaje por defecto (S/10) y el gasto total en pauta si cambia, para que el reporte de ROI salga bien.

## Flujo del día a día

1. Llega un mensaje por WhatsApp → se registra en **Leads**, en una grilla tipo Excel (Fecha, Hora, Acción, Estatus, Nombre, Apellido, Edad, DNI/CE, Celular, Email, Distrito) — cada celda se edita directo con clic, como en una hoja de cálculo. Al tocar la fila (fuera de una celda) se abre la ficha del lead con Diagnóstico, Fuente de captación, el historial completo de seguimiento y el botón para convertir en cliente.
2. Se conversa, se envía catálogo, y recién cuando el cliente manda el comprobante de pago → botón **"Convertir en cliente"** dentro de la ficha del lead: se completan los datos que falten (dirección, si es provincia) Y se genera el pedido (productos, envío Shalom/InDrive, embalaje, método de pago). Al guardar se genera un **ticket de venta** imprimible y el stock se descuenta al toque — como ya llegó el comprobante, el pedido nace pagado, no hay que cambiar ningún estado a mano.
3. Cuando un cliente **ya existente** vuelve a comprar (recompra — los suplementos se toman mensual o cada dos meses) → en **Clientes**, botón **"🧾 Generar pedido"** en su fila, mismo flujo de elegir productos y método de envío/pago (sin repetir sus datos personales).
4. Si es un cliente **nuevo** que llegó sin pasar por Leads → en **Clientes**, botón de arriba **"🧾 Nuevo pedido"**: pide los datos personales y el pedido en la misma ventana, igual que la conversión de un lead.
5. **Pedidos** es solo el registro histórico de todas las ventas (quién compró, qué, cuándo, cuánto) — de solo lectura, se filtra por marca y por rango de fechas, sin botones para crear, cambiar estado ni eliminar.
6. Cuando un proveedor entrega mercadería → **Stock → Registrar entrega/compra**: sube el stock y queda anotada la fecha.
   - Si es una compra normal (se paga de una vez), se marca "Ya la pagué completa".
   - Si es **consignación** (ej. el doctor deja productos y se le paga según se van vendiendo, sin pagar todo de una vez): se deja sin marcar, y en **Proveedores → Cuenta corriente por consignación** se ve cuánto se le debe (calculado solo sobre lo que ya se vendió), con botón para **Registrar pago** cada vez que se le abona algo. Para que esto funcione, cada producto en Stock debe tener asignado su proveedor/doctor (botón **Editar** en la fila del producto).
7. Las tareas sueltas del día a día se anotan en **Tareas**, asignadas a Roberto o a Genesis.
8. **Reportes** muestra si la pauta está dando resultado (leads vs. ventas), ventas por marca y el balance del periodo.

## Respaldo (muy importante)

Como los datos viven solo en este navegador, hay que respaldar seguido:

- **Configuración → Respaldo de datos → Descargar respaldo**: baja un archivo `.json` con todo. Guardarlo en Drive o donde sea seguro.
- Si algún día se borra el navegador, se cambia de equipo, o algo falla: **Restaurar respaldo** con ese mismo archivo.
- "Restaurar de fábrica" borra todo y no se puede deshacer — usarlo solo si de verdad quieren empezar de cero.

## Limitación a tener en cuenta

Roberto y Genesis deben usar el **mismo equipo/navegador** para ver los mismos datos (así se decidió para esta primera versión, igual que las otras herramientas internas del negocio). Si en algún momento necesitan verlo desde dispositivos distintos al mismo tiempo, hay que sumar un backend compartido — no es un simple ajuste de configuración, es un cambio de arquitectura.
