// Cuentas con proveedor (consignación) y socio (reparto): saldo, pago por venta, fecha del pago,
// que no se duplique y que una venta "pendiente de pago" del cliente quede como "en espera".
const {crearEntorno,pruebas}=require('./entorno');
const {A,ctx,campos}=crearEntorno();
const t=pruebas('Proveedores y socio');
const HOY=A.hoyStr();
const esISO=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s);

const itemCon=(extra={})=>Object.assign({stockId:'s1',marca:'Marca A',producto:'Producto A',cantidad:1,precioUnit:200,
  modalidadComercial:'consignacion',proveedorVenta:'Proveedor A',costoProveedorVenta:140,responsableDespacho:'zona_bariatrica'},extra);
function baseDb(){
  return {
    config:{marcas:['Marca A','Marca R'],modalidadMarca:{'Marca A':'consignacion','Marca R':'reparto_ingresos'},
      responsableDespachoMarca:{'Marca A':'zona_bariatrica','Marca R':'zona_bariatrica'},
      repartoMarca:{'Marca R':{socio:'Socio X',porcentajeSocio:60}}},
    usuarios:[{id:'u1',nombre:'Prueba',pin:'0000'}],
    clientes:[{id:'c1',nombre:'Cliente',apellido:'Prueba',dni:'00000000',telefono:'900000000',creado:'2026-09-01',activo:true,marcas:[]}],
    stock:[
      {id:'s1',marca:'Marca A',producto:'Producto A',cantidad:10,costoPromedio:140,precioVenta:200,proveedor:'Proveedor A',activo:true},
      {id:'s2',marca:'Marca R',producto:'Producto R',cantidad:10,costoPromedio:0,precioVenta:120,proveedor:'Socio X',activo:true}
    ],
    pedidos:[
      {id:'pCON',clienteId:'c1',fecha:'2026-09-05',estadoPago:'pagado',estadoEnvio:'entregado',total:200,items:[itemCon()]},
      {id:'pCON2',clienteId:'c1',fecha:'2026-09-07',estadoPago:'pagado',estadoEnvio:'entregado',total:200,items:[itemCon()]},
      {id:'pREP',clienteId:'c1',fecha:'2026-09-06',estadoPago:'pagado',estadoEnvio:'entregado',total:120,
        items:[{stockId:'s2',marca:'Marca R',producto:'Producto R',cantidad:1,precioUnit:120,modalidadComercial:'reparto_ingresos',
          socioReparto:'Socio X',costoProveedorVenta:0,porcentajeReparto:60,responsableDespacho:'zona_bariatrica'}]}
    ],
    leads:[], tareas:[], gastosPauta:[], gastos:[], gastosFijos:[], pagosProveedor:[], liquidacionesSocio:[],
    movimientosStock:[]
  };
}
const reiniciar=()=>{A.db=baseDb();A.sesion={id:'u1',nombre:'Prueba'};ctx.__alertas.length=0;ctx.__confirmar=true;};
const oblig=(pid,libro)=>A.obligacionesDeVentaProveedor(pid).find(o=>o.libro===libro);
const cuentaA=()=>A.estadoCuentaProveedor('Proveedor A','consignacion','Marca A');

// 1) Saldo = obligación total − pagos
reiniciar();
let ec=cuentaA();
t.ok('saldo inicial = 2 ventas × costo 140 = 280',ec.saldo===280,ec.saldo);
t.ok('obligacionTotal = 280',ec.obligacionTotal===280,ec.obligacionTotal);

// 2) Marcar pagada una venta: usa la fecha DE LA VENTA, no la de hoy, y deja huella
let o=oblig('pCON','pagosProveedor');
t.ok('obligación de pCON existe y no está pagada',!!o&&o.pagado===false);
t.ok('monto a marcar = 140',o&&o.montoAlMarcar===140,o&&o.montoAlMarcar);
campos['mo-fecha']='2026-09-05';
A.confirmarMarcarObligacion({preventDefault(){}},'pCON',o.stockId,'pagosProveedor');
let pg=A.db.pagosProveedor[0];
t.ok('se registró exactamente 1 pago',A.db.pagosProveedor.length===1,A.db.pagosProveedor.length);
t.ok('pago con fecha de la venta (2026-09-05), no hoy',pg&&pg.fecha==='2026-09-05'&&pg.fecha!==HOY,pg&&pg.fecha);
t.ok('pago por 140',pg&&pg.monto===140,pg&&pg.monto);
t.ok('pago asignado a pCON',pg&&JSON.stringify(pg.asignaciones)===JSON.stringify([{pedidoId:'pCON',stockId:o.stockId,monto:140}]),pg&&pg.asignaciones);
t.ok('huella: createdAt ISO + confirmadoPor',pg&&esISO(pg.createdAt)&&pg.confirmadoPor==='Prueba');
t.ok('saldo baja a 140',cuentaA().saldo===140,cuentaA().saldo);

// 3) Marcar dos veces NO duplica el pago
A.confirmarMarcarObligacion({preventDefault(){}},'pCON',o.stockId,'pagosProveedor');
A.marcarObligacionPagada('pCON',o.stockId,'pagosProveedor');
t.ok('doble marcado no agrega otro pago',A.db.pagosProveedor.length===1,A.db.pagosProveedor.length);
t.ok('saldo sigue en 140',cuentaA().saldo===140,cuentaA().saldo);

// 4) Campo de fecha vacío → cae a la fecha de la venta, nunca a hoy
reiniciar(); o=oblig('pCON','pagosProveedor'); campos['mo-fecha']='';
A.confirmarMarcarObligacion({preventDefault(){}},'pCON',o.stockId,'pagosProveedor');
t.ok('fecha vacía → usa fecha de la venta',A.db.pagosProveedor[0].fecha==='2026-09-05',A.db.pagosProveedor[0].fecha);

// 5) Un pago SIN asignación igual baja el saldo, y el pendiente por venta suma lo mismo que el saldo
reiniciar();
A.db.pagosProveedor.push({id:'pp1',fecha:'2026-09-10',monto:100,proveedor:'Proveedor A',modalidad:'consignacion',marca:'Marca A',entregaId:null,nota:''});
ec=cuentaA();
t.ok('pago suelto de 100 → saldo 180',ec.saldo===180,ec.saldo);
const sumaPend=A.round2((ec.ventas||[]).reduce((s,v)=>s+(v.pendiente||0),0));
t.ok('Σ pendiente por venta = saldo (sin descuadre)',sumaPend===ec.saldo,{sumaPend,saldo:ec.saldo});

// 6) Venta del cliente aún sin cobrar: cuenta en el saldo pero como "en espera de cobro"
reiniciar();
A.db.pedidos[1].estadoPago='pendiente pago';
ec=cuentaA();
t.ok('saldo incluye la venta sin cobrar (280)',ec.saldo===280,ec.saldo);
t.ok('enEsperaCobro = 140',ec.enEsperaCobro===140,ec.enEsperaCobro);
t.ok('exigible = 140',ec.exigible===140,ec.exigible);

// 7) Venta anulada no genera obligación
reiniciar();
A.db.pedidos[1].estadoPago='cancelado';
t.ok('venta anulada no suma al saldo (140)',cuentaA().saldo===140,cuentaA().saldo);

// 8) Socio (reparto): el pago va a liquidacionesSocio y baja SU saldo
reiniciar(); o=oblig('pREP','liquidacionesSocio');
t.ok('obligación de reparto existe',!!o);
if(o){
  const antes=A.estadoCuentaProveedor('Socio X','reparto_ingresos','Marca R').saldo;
  campos['mo-fecha']='2026-09-06';
  A.confirmarMarcarObligacion({preventDefault(){}},'pREP',o.stockId,'liquidacionesSocio');
  const despues=A.estadoCuentaProveedor('Socio X','reparto_ingresos','Marca R').saldo;
  t.ok('pago en liquidacionesSocio, no en pagosProveedor',A.db.liquidacionesSocio.length===1&&A.db.pagosProveedor.length===0);
  t.ok('saldo del socio bajó lo marcado',A.round2(antes-despues)===A.round2(o.montoAlMarcar),{antes,despues});
  t.ok('saldo del proveedor A no se tocó',cuentaA().saldo===280,cuentaA().saldo);
}

t.fin();
