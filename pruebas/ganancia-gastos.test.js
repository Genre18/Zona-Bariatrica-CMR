// Ganancia ZB y Ganancia neta: neta = Ganancia ZB − pauta − gastos sueltos − gastos fijos del período.
// Incluye la pestaña Gastos (2026-11-09): fijos con/sin día de pago, altas y bajas, y que la
// publicidad no se cuente dos veces.
const {crearEntorno,pruebas}=require('./entorno');
const {A,ctx,campos}=crearEntorno();
const t=pruebas('Ganancia y gastos');

// 1) Ganancia ZB por producto
t.ok('consignación: 200 − 140 = 60',A.gananciaZBItem({cantidad:1,precioUnit:200,costoProveedorVenta:140,modalidadComercial:'consignacion'})===60);
t.ok('reparto 60% socio: utilidad 120 → ZB 48',A.gananciaZBItem({cantidad:1,precioUnit:120,costoProveedorVenta:0,modalidadComercial:'reparto_ingresos',porcentajeReparto:60})===48);
t.ok('sin costo conocido → null (no se inventa)',A.gananciaZBItem({cantidad:1,precioUnit:200,modalidadComercial:'consignacion'})===null);
t.ok('venta bajo costo no da ganancia negativa',A.gananciaZBItem({cantidad:1,precioUnit:100,costoProveedorVenta:140,modalidadComercial:'consignacion'})===0);

// 2) Gastos fijos por período
function baseDb(){
  return {
    config:{marcas:['Marca A'],modalidadMarca:{'Marca A':'consignacion'},responsableDespachoMarca:{'Marca A':'zona_bariatrica'},repartoMarca:{}},
    usuarios:[{id:'u1',nombre:'Prueba',pin:'0000'}], clientes:[{id:'c1',nombre:'Cliente',apellido:'Prueba',creado:'2026-09-01',activo:true,marcas:[]}],
    stock:[{id:'s1',marca:'Marca A',producto:'Producto A',cantidad:10,costoPromedio:140,precioVenta:200,proveedor:'Proveedor A',activo:true}],
    pedidos:[], leads:[], tareas:[], gastosPauta:[], gastos:[], gastosFijos:[], pagosProveedor:[], liquidacionesSocio:[], movimientosStock:[]
  };
}
A.db=baseDb(); A.sesion={id:'u1',nombre:'Prueba'};
A.db.gastosFijos=[
  {id:'f1',concepto:'Internet',categoria:'Servicios',monto:90,dia:15,desde:'2026-10',hasta:null,pagos:{}},
  {id:'f2',concepto:'Sueldo',categoria:'Personal',monto:300,dia:null,desde:'2026-11',hasta:null,pagos:{}},
  {id:'f3',concepto:'Local viejo',categoria:'Alquiler',monto:500,dia:1,desde:'2026-01',hasta:'2026-10',pagos:{}},
  {id:'f4',concepto:'Borrado',categoria:'Otros',monto:1000,dia:5,desde:'2026-01',hasta:null,pagos:{},eliminado:true}
];
t.ok('noviembre completo = 90 + 300 (el dado de baja y el eliminado no cuentan)',A.gastosFijosPeriodo('2026-11-01','2026-11-30')===390,A.gastosFijosPeriodo('2026-11-01','2026-11-30'));
t.ok('1–14 nov: Internet (día 15) aún no cae; sueldo prorrateado 14/30 = 140',A.gastosFijosPeriodo('2026-11-01','2026-11-14')===140,A.gastosFijosPeriodo('2026-11-01','2026-11-14'));
t.ok('15–15 nov: Internet entero + 1/30 del sueldo = 100',A.gastosFijosPeriodo('2026-11-15','2026-11-15')===100,A.gastosFijosPeriodo('2026-11-15','2026-11-15'));
t.ok('octubre: Internet + local (vigente hasta oct) = 590',A.gastosFijosPeriodo('2026-10-01','2026-10-31')===590,A.gastosFijosPeriodo('2026-10-01','2026-10-31'));
t.ok('oct + nov = 980',A.gastosFijosPeriodo('2026-10-01','2026-11-30')===980,A.gastosFijosPeriodo('2026-10-01','2026-11-30'));
t.ok('período al revés → 0',A.gastosFijosPeriodo('2026-11-30','2026-11-01')===0);
A.db.gastosFijos=[{id:'f5',concepto:'Algo',categoria:'Otros',monto:50,dia:31,desde:'2026-02',hasta:null,pagos:{}}];
t.ok('día 31 en febrero cae el 28 (no se pierde)',A.gastosFijosPeriodo('2026-02-28','2026-02-28')===50,A.gastosFijosPeriodo('2026-02-28','2026-02-28'));

// 3) Gastos sueltos: los anulados no cuentan
A.db=baseDb();
A.db.gastos=[{id:'g1',fecha:'2026-11-03',monto:40,categoria:'Otros'},{id:'g2',fecha:'2026-11-04',monto:60,categoria:'Otros',anulado:true},{id:'g3',fecha:'2026-12-01',monto:70,categoria:'Otros'}];
t.ok('sueltos de noviembre = 40 (anulado y de diciembre fuera)',A.totalGastosSueltos('2026-11-01','2026-11-30')===40,A.totalGastosSueltos('2026-11-01','2026-11-30'));

// 4) Alta desde la pestaña Gastos: Publicidad va SOLO a la pauta (no se duplica en gastos sueltos)
A.db=baseDb(); A.sesion={id:'u1',nombre:'Prueba'};
Object.assign(campos,{'gs-concepto':'Facebook','gs-monto':'120','gs-cat':A.CAT_PUBLICIDAD,'gs-nota':'','gs-fijo':false,'gs-fecha':'2026-11-05'});
try{A.guardarGastoNuevo({preventDefault(){}});}catch(e){t.ok('guardarGastoNuevo sin error',false,e.message);}
t.ok('publicidad entra a gastosPauta',A.db.gastosPauta.length===1&&A.db.gastosPauta[0].monto===120,A.db.gastosPauta);
t.ok('publicidad NO entra a gastos sueltos (no doble conteo)',A.db.gastos.length===0,A.db.gastos);
Object.assign(campos,{'gs-concepto':'Cinta','gs-monto':'15','gs-cat':'Otros','gs-fecha':'2026-11-06'});
try{A.guardarGastoNuevo({preventDefault(){}});}catch(e){t.ok('guardarGastoNuevo (suelto) sin error',false,e.message);}
t.ok('gasto común entra a gastos sueltos',A.db.gastos.length===1&&A.db.gastos[0].monto===15,A.db.gastos);
ctx.__alertas.length=0;
Object.assign(campos,{'gs-concepto':'Sin categoría','gs-monto':'10','gs-cat':''});
A.guardarGastoNuevo({preventDefault(){}});
t.ok('sin categoría elegida → no se guarda',A.db.gastos.length===1&&ctx.__alertas.length===1);

// 5) Ganancia neta en Reportes = Ganancia ZB − pauta − sueltos − fijos
A.db=baseDb(); A.sesion={id:'u1',nombre:'Prueba'};
const it=()=>({stockId:'s1',marca:'Marca A',producto:'Producto A',cantidad:1,precioUnit:200,modalidadComercial:'consignacion',proveedorVenta:'Proveedor A',costoProveedorVenta:140,responsableDespacho:'zona_bariatrica'});
A.db.pedidos=[
  {id:'p1',clienteId:'c1',fecha:'2026-11-02',estadoPago:'pagado',metodoPago:'Yape',subtotal:200,descuento:0,embalaje:0,delivery:0,recargoTarjeta:0,total:200,items:[it()]},
  {id:'p2',clienteId:'c1',fecha:'2026-11-03',estadoPago:'pagado',metodoPago:'Yape',subtotal:200,descuento:0,embalaje:0,delivery:0,recargoTarjeta:0,total:200,items:[it()]},
  {id:'p3',clienteId:'c1',fecha:'2026-11-04',estadoPago:'pendiente pago',metodoPago:'Yape',subtotal:200,descuento:0,embalaje:0,delivery:0,recargoTarjeta:0,total:200,items:[it()]}
];
A.db.gastosPauta=[{id:'gp1',fecha:'2026-11-05',monto:30},{id:'gp2',fecha:'2026-11-06',monto:999,anulado:true}];
A.db.gastos=[{id:'g1',fecha:'2026-11-07',monto:10,categoria:'Otros'}];
A.db.gastosFijos=[{id:'f1',concepto:'Internet',categoria:'Servicios',monto:50,dia:10,desde:'2026-11',hasta:null,pagos:{}}];
let m=null; try{m=A.metricasReportes('2026-11-01','2026-11-30',A.primeraCompraPorCliente());}catch(e){t.ok('metricasReportes sin error',false,e.message);}
if(m){
  t.ok('ingresos = 400 (la pendiente de pago no cuenta)',m.ingresos===400,m.ingresos);
  t.ok('Ganancia ZB = 2 × 60 = 120',m.gananciaZB===120,m.gananciaZB);
  t.ok('pauta = 30 (la anulada no cuenta)',m.pauta===30,m.pauta);
  t.ok('gastos sueltos = 10',m.otrosGastos===10,m.otrosGastos);
  t.ok('fijos = 50',m.fijos===50,m.fijos);
  t.ok('Ganancia neta = 120 − 30 − 10 − 50 = 30',m.gananciaNeta===30,m.gananciaNeta);
}

t.fin();
