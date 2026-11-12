// Corre TODAS las pruebas del CRM. Uso (desde la raíz del repo):   node pruebas/correr.js
// 1) revisa que el JavaScript de index.html no tenga errores de sintaxis;
// 2) corre cada pruebas/*.test.js por separado.
// Si algo falla, termina con código 1 → NO publicar (no hacer push) hasta arreglarlo.
const fs=require('fs'), path=require('path'), os=require('os'), {spawnSync}=require('child_process');
const {scriptPrincipal}=require('./entorno');

let malos=0;
const tmp=path.join(os.tmpdir(),'zb-crm-script-check.js');
fs.writeFileSync(tmp,scriptPrincipal());
const sintaxis=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});
if(sintaxis.status!==0){malos++;console.log('✗ Error de sintaxis en el <script> de index.html:\n'+sintaxis.stderr);}
else console.log('✓ Sintaxis de index.html OK');

const archivos=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort();
for(const f of archivos){
  const r=spawnSync(process.execPath,[path.join(__dirname,f)],{encoding:'utf8'});
  process.stdout.write(r.stdout||'');
  if(r.status!==0){malos++;if(r.stderr)console.log(r.stderr);}
}
console.log(malos?`\n✗ ${malos} archivo(s) con fallas. NO publicar.`:`\n✓ Todo OK (${archivos.length} archivos de prueba).`);
process.exit(malos?1:0);
