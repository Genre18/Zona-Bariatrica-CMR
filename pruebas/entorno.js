// Carga el <script> REAL de ../index.html dentro de Node (módulo vm) con imitaciones mínimas de
// navegador y Supabase, para poder probar la lógica del CRM sin abrir el navegador ni tocar la nube.
// Nunca conecta a Supabase ni lee respaldos reales: todas las pruebas usan datos inventados.
const fs=require('fs'), path=require('path'), vm=require('vm');

function scriptPrincipal(){
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  // el <script> sin atributos más largo es la app (los otros son librerías cargadas por src)
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).sort((a,b)=>b.length-a.length)[0];
}

function crearEntorno(){
  const campos={}; // valores de los <input> por id (las pruebas los llenan como si fueran el formulario)
  function el(id){
    return {
      _id:id, classList:{add(){},remove(){},toggle(){},contains(){return false;}}, style:{}, dataset:{},
      get value(){return campos[id]!==undefined?campos[id]:'';}, set value(v){campos[id]=v;},
      get checked(){return campos[id]===true;}, set checked(v){campos[id]=!!v;},
      textContent:'', innerHTML:'', options:[], selectedIndex:0,
      addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){},
      querySelector(){return el(id+'>q');}, querySelectorAll(){return [];},
      setAttribute(){}, removeAttribute(){}, getAttribute(){return null;},
      focus(){}, click(){}, remove(){}, insertAdjacentHTML(){}, closest(){return null;}, scrollIntoView(){},
      getBoundingClientRect(){return {top:0,left:0,width:0,height:0};}
    };
  }
  const cache={};
  const document={
    getElementById(id){return cache[id]||(cache[id]=el(id));},
    querySelector(){return el('q');}, querySelectorAll(){return [];}, createElement(){return el('nuevo');},
    addEventListener(){}, removeEventListener(){}, body:el('body'), documentElement:el('html'), visibilityState:'visible'
  };
  const almacen=()=>{const m={};return{getItem(k){return k in m?m[k]:null;},setItem(k,v){m[k]=String(v);},removeItem(k){delete m[k];}};};
  const canal={on(){return canal;},subscribe(){return canal;}};
  const supabaseFalso={
    auth:{getSession:async()=>({data:{session:null}}),signInWithPassword:async()=>({error:null}),signOut:async()=>({error:null}),
      onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},
    from(){return {update(){return {eq:async()=>({error:null})};},select(){return {eq(){return {single:async()=>({data:null,error:null})};}};},
      upsert:async()=>({error:null}),insert:async()=>({error:null})};},
    channel(){return canal;}, removeChannel(){}
  };
  const ventana={supabase:{createClient:()=>supabaseFalso},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
    location:{reload(){},href:'',search:'',hash:''},open:()=>({document:{write(){},close(){}},focus(){},print(){}})};
  const ctx={
    console:{log(){},warn(){},error(){},info(){}}, // la app escribe mucho en consola: se silencia
    document, window:ventana, localStorage:almacen(), sessionStorage:almacen(), location:ventana.location,
    navigator:{language:'es',clipboard:{writeText:async()=>{}}},
    alert:m=>{ctx.__alertas.push(String(m));}, confirm:()=>ctx.__confirmar, prompt:()=>null,
    setTimeout:fn=>{try{fn();}catch(e){}return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    requestAnimationFrame:fn=>{fn&&fn();return 0;}, fetch:async()=>({ok:true,json:async()=>({}),text:async()=>''}),
    URLSearchParams, Intl, __alertas:[], __confirmar:true
  };
  ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(scriptPrincipal(),ctx,{filename:'index.html <script>'});

  // A: acceso a CUALQUIER función o variable del script (incluidas las `let`, como db o sesion).
  //    Leer: A.estadoCuentaProveedor(...)   Escribir: A.db = {...}
  const A=new Proxy({},{
    get:(_,k)=>vm.runInContext(String(k),ctx),
    set:(_,k,v)=>{ctx.__valor=v;vm.runInContext(`${String(k)}=__valor`,ctx);return true;}
  });
  return {A,ctx,campos};
}

// Mini sistema de asserts compartido. Cada archivo de prueba llama ok(...) y al final fin().
function pruebas(titulo){
  let pasan=0; const fallas=[];
  console.log(`\n▶ ${titulo}`);
  return {
    ok(nombre,cond,detalle){
      if(cond){pasan++;}
      else{fallas.push(nombre);console.log(`  ✗ FALLA: ${nombre}${detalle!==undefined?'  → obtuve '+JSON.stringify(detalle):''}`);}
    },
    fin(){
      console.log(`  ${pasan} pasan, ${fallas.length} fallan`);
      process.exit(fallas.length?1:0);
    }
  };
}

module.exports={crearEntorno,pruebas,scriptPrincipal};
