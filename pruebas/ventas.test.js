// Ventas: totales del pedido (recargo de tarjeta 4% solo sobre productos), "pendiente de pago"
// (contra entrega), provincia solo al contado y tarjeta que no cuenta hasta acreditarse.
const {crearEntorno,pruebas}=require('./entorno');
const {A,ctx,campos}=crearEntorno();
const t=pruebas('Ventas');

// 1) Recargo de tarjeta: 4% sobre (subtotal − descuento), NO sobre delivery ni embalaje
const items=[{cantidad:2,precioUnit:100}];
let r=A.calcularTotalesPedido(items,20,10,15,'Tarjeta de crédito');
t.ok('subtotal = 200',r.subtotal===200,r.subtotal);
t.ok('base productos = 200 − 20 = 180',r.baseProductos===180,r.baseProductos);
t.ok('recargo = 4% de 180 = 7.20',r.recargoTarjeta===7.2,r.recargoTarjeta);
t.ok('total = 180 + 10 + 15 + 7.20 = 212.20',r.total===212.2,r.total);
r=A.calcularTotalesPedido(items,20,10,15,'Yape');
t.ok('sin tarjeta no hay recargo',r.recargoTarjeta===0&&r.total===205,r);
r=A.calcularTotalesPedido(items,999,0,0,'Yape');
t.ok('descuento mayor al subtotal nunca deja total negativo',r.total===0,r.total);
t.ok('validación rechaza descuento mayor al subtotal',typeof A.validarImportesPedido(items,999,0,0)==='string');
t.ok('validación rechaza delivery negativo',typeof A.validarImportesPedido(items,0,0,-5)==='string');

// 2) Tarjeta: desde la vigencia, no cuenta hasta marcarla acreditada
const vig=A.VIGENCIA_ACREDITACION_TARJETA;
t.ok('tarjeta posterior a la vigencia sin acreditar → NO cuenta',A.ventaAcreditada({metodoPago:'Tarjeta de crédito',fecha:'2026-10-01'})===false);
t.ok('tarjeta acreditada → cuenta',A.ventaAcreditada({metodoPago:'Tarjeta de crédito',fecha:'2026-10-01',acreditadoTarjeta:true})===true);
t.ok('tarjeta anterior a la vigencia → cuenta (histórico intacto)',A.ventaAcreditada({metodoPago:'Tarjeta de crédito',fecha:'2026-01-01'})===true,vig);
t.ok('Yape → cuenta siempre',A.ventaAcreditada({metodoPago:'Yape',fecha:'2026-10-01'})===true);

// 3) guardarPedido: nace pagado o pendiente de pago, y en ambos casos descuenta stock
function baseDb(){
  return {
    config:{marcas:['Marca A'],modalidadMarca:{'Marca A':'consignacion'},responsableDespachoMarca:{'Marca A':'zona_bariatrica'},repartoMarca:{}},
    usuarios:[{id:'u1',nombre:'Prueba',pin:'0000'}],
    clientes:[{id:'c1',nombre:'Cliente',apellido:'Prueba',dni:'00000000',telefono:'900000000',creado:'2026-09-01',activo:true,marcas:[]}],
    stock:[{id:'s1',marca:'Marca A',producto:'Producto A',cantidad:10,costoPromedio:140,precioVenta:200,proveedor:'Proveedor A',activo:true}],
    pedidos:[], leads:[], tareas:[], gastosPauta:[], gastos:[], gastosFijos:[], pagosProveedor:[], liquidacionesSocio:[], movimientosStock:[]
  };
}
function formulario(yapago,envio){
  Object.assign(campos,{'pd-cliente':'c1','pd-embalaje':'0','pd-descuento':'0','pd-delivery':'0','pd-metodopago':'Yape',
    'pd-yapago':yapago,'pd-fecha':'2026-11-01','pd-envio':envio,'pd-numeroorden':'','pd-codigoenvio':'','pd-referencia':'','pd-notas':''});
}
const item=()=>[{stockId:'s1',marca:'Marca A',producto:'Producto A',cantidad:1,precioUnit:200,precioUnitario:200,
  modalidadComercial:'consignacion',proveedorVenta:'Proveedor A',costoProveedorVenta:140,responsableDespacho:'zona_bariatrica'}];
function registrar(yapago,envio){
  A.db=baseDb(); A.sesion={id:'u1',nombre:'Prueba'}; ctx.__alertas.length=0; ctx.__confirmar=true;
  formulario(yapago,envio); A.pedidoItemsTmp=item();
  let error=null; try{A.guardarPedido({preventDefault(){}});}catch(e){error=e.message;}
  return {error,pedidos:A.db.pedidos,stock:A.db.stock[0].cantidad,alertas:ctx.__alertas.slice()};
}
const envioLima='indrive'; // valor del select pd-envio para "Lima (InDrive)"

let s=registrar('1',envioLima);
t.ok('pagado: guardarPedido no revienta',!s.error,s.error);
t.ok('pagado: se creó 1 pedido',s.pedidos.length===1,s.alertas);
t.ok('pagado: estadoPago = pagado',s.pedidos[0]&&s.pedidos[0].estadoPago==='pagado');
t.ok('pagado: total = 200',s.pedidos[0]&&s.pedidos[0].total===200,s.pedidos[0]&&s.pedidos[0].total);
t.ok('pagado: stock baja de 10 a 9',s.stock===9,s.stock);

s=registrar('0',envioLima);
t.ok('contra entrega Lima: se creó 1 pedido',s.pedidos.length===1,s.alertas);
t.ok('contra entrega Lima: estadoPago = pendiente pago',s.pedidos[0]&&s.pedidos[0].estadoPago==='pendiente pago');
t.ok('contra entrega Lima: sin "confirmado por"',s.pedidos[0]&&s.pedidos[0].pagoConfirmadoPor==='');
t.ok('contra entrega Lima: stock igual baja a 9',s.stock===9,s.stock);

s=registrar('0','shalom');
t.ok('provincia (Shalom) contra entrega: NO se registra (solo al contado desde 23-10-2026)',s.pedidos.length===0);
t.ok('provincia contra entrega: avisa y no toca stock',s.alertas.length>0&&s.stock===10,s);

// 4) Reportes: lo pendiente de pago y lo anulado no cuentan como ingreso
A.db=baseDb();
A.db.pedidos=[
  {id:'a',fecha:'2026-11-01',estadoPago:'pagado',metodoPago:'Yape',total:200,items:[]},
  {id:'b',fecha:'2026-11-02',estadoPago:'pendiente pago',metodoPago:'Yape',total:300,items:[]},
  {id:'c',fecha:'2026-11-03',estadoPago:'cancelado',metodoPago:'Yape',total:400,items:[]},
  {id:'d',fecha:'2026-11-04',estadoPago:'pagado',metodoPago:'Tarjeta de crédito',total:500,items:[]},
  {id:'e',fecha:'2026-10-31',estadoPago:'pagado',metodoPago:'Yape',total:600,items:[]}
];
const fact=A.pedidosFacturablesEntre('2026-11-01','2026-11-30').map(p=>p.id);
t.ok('facturables de noviembre = solo la pagada con Yape',JSON.stringify(fact)==='["a"]',fact);

t.fin();
