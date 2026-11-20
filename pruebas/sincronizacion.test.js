// Cambios sin subir (2026-11-20): si falla la subida a la nube, lo cargado en este dispositivo no se
// pierde al recargar ni cuando llega un cambio de otro dispositivo; se combina y se sube.
const {crearEntorno,pruebas}=require('./entorno');
const {A,ctx}=crearEntorno();
const t=pruebas('Sincronización');
// El entorno corre todo setTimeout al instante; acá solo el envío (400 ms). Los reintentos
// (5 s o más) se disparan a mano en la prueba, si no quedarían reintentando sin fin.
let reintentosProgramados=0;
ctx.setTimeout=(fn,ms)=>{if(ms===400){try{fn();}catch(e){}}else reintentosProgramados++;return 0;};
const ids=l=>l.map(x=>x.id).join(',');

// --- combinar tres versiones ---
const base={stock:[{id:'s1',cantidad:3},{id:'s2',cantidad:5}],movimientosStock:[{id:'m1'}],leads:[{id:'l1',estado:'seguimiento'}],config:{gastoPauta:200,correccionesAplicadas:['a']}};
// acá: entrada de 4 unidades a s1 (nuevo movimiento m2) y se borra l1
const local={stock:[{id:'s1',cantidad:7},{id:'s2',cantidad:5}],movimientosStock:[{id:'m1'},{id:'m2'}],leads:[],config:{gastoPauta:200,correccionesAplicadas:['a','b']}};
// nube: otro dispositivo vendió 1 de s2 (movimiento m3) y agregó un lead l2
const remoto={stock:[{id:'s1',cantidad:3},{id:'s2',cantidad:4}],movimientosStock:[{id:'m1'},{id:'m3'}],leads:[{id:'l1',estado:'seguimiento'},{id:'l2'}],config:{gastoPauta:200,correccionesAplicadas:['a','c']}};
const f=A.fusionarTresVias(base,local,remoto);
t.ok('se conserva la entrada hecha acá',f.stock.find(s=>s.id==='s1').cantidad===7&&f.movimientosStock.some(m=>m.id==='m2'));
t.ok('se conserva la venta hecha en el otro dispositivo',f.stock.find(s=>s.id==='s2').cantidad===4&&f.movimientosStock.some(m=>m.id==='m3'));
t.ok('lead nuevo de la nube se conserva y el borrado acá se respeta',ids(f.leads)==='l2');
t.ok('listas sueltas cambiadas en los dos lados se juntan',f.config.correccionesAplicadas.join(',')==='a,c,b');
const g=A.fusionarTresVias(base,{...base,stock:[{id:'s1',cantidad:9},{id:'s2',cantidad:5}]},{...base,stock:[{id:'s1',cantidad:1},{id:'s2',cantidad:5}]});
t.ok('mismo registro cambiado en los dos lados: gana este dispositivo',g.stock.find(s=>s.id==='s1').cantidad===9);
const h=A.fusionarTresVias(null,{leads:[{id:'x'}]},{leads:[{id:'y'}]});
t.ok('sin base no se da nada por borrado',ids(h.leads)==='y,x');

// --- pendiente: se marca al guardar y se limpia solo cuando la nube confirma ---
let fallar=true, subido=null, nube={leads:[{id:'l1'}],config:{}};
A.sb.from=()=>({
  update(v){return {eq:async()=>{if(fallar)throw new Error('ERR_CONNECTION_CLOSED');subido=v.data;nube=v.data;return {error:null};}};},
  select(){return {eq(){return {single:async()=>({data:{data:JSON.parse(JSON.stringify(nube))},error:null})};}};}
});
(async()=>{
  const espera=()=>new Promise(r=>setImmediate(r));
  A.sesion={id:'u1',nombre:'Genesis',color:'#000'};
  A.db=JSON.parse(JSON.stringify(nube));
  A.guardarBaseNube(nube);
  A.db.leads.push({id:'nuevo'});
  A.guardar();
  await espera();await espera();
  t.ok('falla la subida: queda pendiente',A.hayPendienteNube()===true);
  t.ok('y programa un reintento solo',reintentosProgramados>0);

  // al recargar, lo de acá NO se descarta aunque la nube haya cambiado mientras tanto
  nube={leads:[{id:'l1'},{id:'deRoberto'}],config:{}};
  await A.cargar();
  t.ok('recargar con pendiente combina en vez de descartar',ids(A.db.leads)==='l1,deRoberto,nuevo');
  t.ok('sigue pendiente hasta que se suba',A.hayPendienteNube()===true);

  // vuelve la conexión
  fallar=false;
  await A.sincronizarPendiente();
  await espera();await espera();
  t.ok('al volver la conexión se sube lo combinado',subido&&ids(subido.leads)==='l1,deRoberto,nuevo');
  t.ok('y ya no queda pendiente',A.hayPendienteNube()===false);

  // sin pendiente, recargar sigue trayendo la nube tal cual
  nube={leads:[{id:'soloNube'}],config:{}};
  await A.cargar();
  t.ok('sin pendiente, cargar usa la nube',ids(A.db.leads)==='soloNube');
  t.fin();
})();
