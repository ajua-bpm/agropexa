/* ══════════════════════════════════════════════
   AGROPEXA MX — Lógica Principal v2.0
   agropexa.agroajua.com
══════════════════════════════════════════════ */
'use strict';

// ══ CONFIG ══
const LS_KEY = 'agropexa_mx_v2';
const LS_FB  = 'agropexa_fb_cfg';

let DB = {
  cotizaciones:[], ventas:[], gastos_diarios:[], gastos_generales:[],
  productos:[], usuarios:[],
  empresa:{razon:'AGROPEXA',rfc:'',ciudad:'México',tel:'',email:'',web:'agropexa.agroajua.com'}
};

let _fb=null, _fbDB=null, _fbReady=false, _fbDocRef=null;
let _cotProds=[], _vtaPagos=[], _prodFiltro='';
let CURRENT_USER=null;

// ══ HELPERS ══
const uid    = ()=> Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const now    = ()=> new Date().toISOString();
const today  = ()=> new Date().toISOString().split('T')[0];
const thisMonth = ()=> today().slice(0,7);
const fmx    = n => '$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc    = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const setTd  = (id,v)=>{ const e=document.getElementById(id); if(e&&!e.readOnly&&!e.value) e.value=v; };
const getVal = id => { const e=document.getElementById(id); return e?e.value:''; };

const TIPO_LBL = {privado:'🤝 Privado',mayoreo:'🏪 Mayoreo',exportacion:'🌎 Export'};
const EST_CC   = {pendiente:'cw',aceptada:'ck',rechazada:'cr'};
const PAG_CC   = {pagado:'ck',parcial:'cw',pendiente:'cr'};

// ══ PERSISTENCE ══
function loadLocal(){
  try{ const r=localStorage.getItem(LS_KEY); if(r) Object.assign(DB,JSON.parse(r)); }catch(e){}
}
function saveLocal(){ try{ localStorage.setItem(LS_KEY,JSON.stringify(DB)); }catch(e){} }
async function saveCloud(){
  if(!_fbReady||!_fbDocRef){ saveLocal(); return; }
  try{
    await window._fbSetDoc(_fbDocRef,{data:JSON.stringify(DB),ts:now()});
    setSyncDot('ok'); saveLocal();
  }catch(e){ setSyncDot('err'); saveLocal(); }
}
function save(){ saveCloud(); }

// ══ FIREBASE ══
function loadFbCfg(){ try{ return JSON.parse(localStorage.getItem(LS_FB)||'null'); }catch(e){return null;} }
function saveFbCfg(cfg){ localStorage.setItem(LS_FB,JSON.stringify(cfg)); }

async function initFirebase(cfg){
  if(!window._fbModulesReady){
    await new Promise(res=>window.addEventListener('fb-modules-ready',res,{once:true}));
  }
  try{
    _fb = window._fbInitializeApp(cfg,'agropexa-mx');
    _fbDB = window._fbInitFirestore(_fb,{
      localCache: window._fbPersistCache({tabManager:window._fbMultiTab()})
    });
    _fbDocRef = window._fbDoc(_fbDB,'agropexa_mx','main');
    _fbReady=true; setSyncDot('ok');
    const snap = await window._fbGetDoc(_fbDocRef);
    if(snap.exists()){
      try{ const c=JSON.parse(snap.data().data||'{}'); Object.assign(DB,c); saveLocal(); }catch(e){}
    }
    window._fbOnSnapshot(_fbDocRef,(snap)=>{
      if(!snap.exists())return;
      try{
        const c=JSON.parse(snap.data().data||'{}'); Object.assign(DB,c); saveLocal();
        const active=document.querySelector('.sec.active');
        if(active){ const s=active.id.replace('sec-','');
          if(['dashboard','cotizaciones','ventas','gastos_diarios','gastos_generales','productos'].includes(s))
            setTimeout(()=>navGo(s),200);
        }
        setSyncDot('ok');
      }catch(e){}
    }, ()=>setSyncDot('err'));
    return true;
  }catch(e){ _fbReady=false; setSyncDot('err'); return false; }
}

function setSyncDot(s){
  const d=document.getElementById('fb-sync-dot'); if(!d)return;
  d.className=s;
  d.title=s==='ok'?'Firebase ✅ conectado':s==='err'?'Firebase ❌ error':'Modo local 💾';
}

async function fbSaveConfig(){
  const cfg={
    apiKey:           getVal('cfg-fb-apikey').trim(),
    authDomain:       getVal('cfg-fb-authdomain').trim(),
    projectId:        getVal('cfg-fb-projectid').trim(),
    storageBucket:    getVal('cfg-fb-bucket').trim(),
    messagingSenderId:getVal('cfg-fb-senderid').trim(),
    appId:            getVal('cfg-fb-appid').trim(),
  };
  if(!cfg.apiKey||!cfg.projectId){ toast('⚠️ Completa API Key y Project ID',true); return; }
  saveFbCfg(cfg);
  const ok=await initFirebase(cfg);
  const el=document.getElementById('cfg-fb-status');
  if(ok){ el.style.color='var(--acc)'; el.textContent='✅ Firebase conectado. Los datos se sincronizan en la nube.'; toast('✅ Firebase conectado'); }
  else  { el.style.color='var(--danger)'; el.textContent='⚠️ Error al conectar. Verifica las credenciales en Firebase Console.'; toast('⚠️ Error Firebase',true); }
}

async function fbTestConn(){
  if(!_fbReady){ toast('⚠️ Firebase no inicializado',true); return; }
  try{ const s=await window._fbGetDoc(_fbDocRef); toast('✅ Firebase OK — '+(s.exists()?'datos encontrados':'vacío')); }
  catch(e){ toast('⚠️ '+e.message,true); }
}

// ══ AUTH ══
const SYS_USERS=[
  {id:'root',nombre:'Admin',email:'admin',pass:'admin',rol:'admin',estado:'activo'},
];

function doLogin(){
  const user=getVal('li-user').trim().toLowerCase();
  const pass=getVal('li-pass');
  const errEl=document.getElementById('login-err');
  if(!user||!pass){ showLoginErr('Ingresa usuario y contraseña'); return; }
  const all=[...SYS_USERS,...DB.usuarios];
  const u=all.find(u=>(u.email.toLowerCase()===user||u.email.toLowerCase()===user)&&u.pass===pass&&u.estado==='activo');
  if(!u){ showLoginErr('⚠️ Usuario o contraseña incorrectos'); return; }
  CURRENT_USER=u;
  document.getElementById('login-screen').style.display='none';
  document.getElementById('h-user-info').textContent=u.nombre+' · '+u.rol;
  const dbU=DB.usuarios.find(x=>x.id===u.id);
  if(dbU){ dbU.lastAccess=now(); save(); }
  initApp();
}
function showLoginErr(msg){
  const e=document.getElementById('login-err');
  e.style.display='block'; e.style.background='rgba(214,48,48,.1)';
  e.style.border='1px solid rgba(214,48,48,.3)'; e.style.color='#d63030';
  e.textContent=msg;
}
function doLogout(){
  CURRENT_USER=null;
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('h-user-info').textContent='';
}

// ══ NAV ══
function navGo(sec){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  const el=document.getElementById('sec-'+sec);
  if(el) el.classList.add('active');
  document.querySelectorAll('.ni').forEach(n=>{
    if((n.getAttribute('onclick')||'').includes("'"+sec+"'")) n.classList.add('active');
  });
  closeNav();
  if(sec==='dashboard')       renderDashboard();
  if(sec==='cotizaciones')    cotRender();
  if(sec==='ventas')          vtaRender();
  if(sec==='gastos_diarios')  gdRender();
  if(sec==='gastos_generales')ggRender();
  if(sec==='productos')       prodRender();
  if(sec==='usuarios')        usrRender();
  if(sec==='configuracion')   cfgLoad();
}
function toggleNav(){ document.getElementById('nav').classList.toggle('open'); document.getElementById('nav-overlay').classList.toggle('open'); }
function closeNav(){ document.getElementById('nav').classList.remove('open'); document.getElementById('nav-overlay').classList.remove('open'); }

// ══ TOAST ══
let _tt;
function toast(msg,err=false){
  const t=document.getElementById('toast');
  t.textContent=msg; t.style.background=err?'var(--danger)':'var(--green-deep)';
  t.classList.add('show'); clearTimeout(_tt);
  _tt=setTimeout(()=>t.classList.remove('show'),3000);
}

// ══ DASHBOARD ══
function renderDashboard(){
  const mes=thisMonth();
  document.getElementById('dash-fecha-lbl').textContent=
    new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const vtasMes=DB.ventas.filter(v=>(v.fecha||'').startsWith(mes));
  const totalVentas=vtasMes.reduce((a,v)=>a+(+v.total||0),0);
  const totalCobrado=vtasMes.reduce((a,v)=>a+(v.pagos||[]).reduce((s,p)=>s+(+p.monto||0),0),0);
  const gdMes=DB.gastos_diarios.filter(g=>(g.fecha||'').startsWith(mes)).reduce((a,g)=>a+(+g.monto||0),0);
  const ggMes=DB.gastos_generales.filter(g=>(g.fecha||'').startsWith(mes)).reduce((a,g)=>a+(+g.monto||0),0);
  const totalGastos=gdMes+ggMes;
  const utilidad=totalVentas-totalGastos;
  document.getElementById('ds-ventas').textContent=fmx(totalVentas);
  document.getElementById('ds-cobrar').textContent=fmx(totalVentas-totalCobrado);
  document.getElementById('ds-gastos').textContent=fmx(totalGastos);
  const uEl=document.getElementById('ds-utilidad');
  uEl.textContent=fmx(utilidad); uEl.style.color=utilidad>=0?'var(--acc)':'var(--danger)';
  document.getElementById('ds-priv').textContent=fmx(vtasMes.filter(v=>v.tipo==='privado').reduce((a,v)=>a+(+v.total||0),0));
  document.getElementById('ds-may').textContent=fmx(vtasMes.filter(v=>v.tipo==='mayoreo').reduce((a,v)=>a+(+v.total||0),0));
  document.getElementById('ds-exp').textContent=fmx(vtasMes.filter(v=>v.tipo==='exportacion').reduce((a,v)=>a+(+v.total||0),0));
  const rItem=(label,val,chip,chipClass)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--br);">
      <div><div style="font-weight:700;font-size:.82rem;">${esc(label)}</div></div>
      <div style="text-align:right;">
        <div style="font-weight:700;color:var(--acc);font-size:.85rem;">${fmx(val)}</div>
        <span class="chip ${chipClass}" style="font-size:.58rem;">${chip}</span>
      </div></div>`;
  const lastCots=[...DB.cotizaciones].sort((a,b)=>(b.ts||'').localeCompare(a.ts||'')).slice(0,5);
  document.getElementById('dash-cots').innerHTML=lastCots.length?
    lastCots.map(c=>rItem(c.cliente||'—',c.precio_venta,c.estado||'pendiente',EST_CC[c.estado||'pendiente'])).join(''):
    '<div class="empty" style="padding:18px;">Sin cotizaciones</div>';
  const lastVtas=[...DB.ventas].sort((a,b)=>(b.ts||'').localeCompare(a.ts||'')).slice(0,5);
  document.getElementById('dash-ventas').innerHTML=lastVtas.length?
    lastVtas.map(v=>rItem(v.cliente||'—',v.total,v.estado_pago||'pendiente',PAG_CC[v.estado_pago||'pendiente'])).join(''):
    '<div class="empty" style="padding:18px;">Sin ventas</div>';
}

// ══ COTIZACIONES ══
const G_KEYS=['flete','maquila','empaque','pallets','fleje','fitosan','aduana','comision','otros'];

function cotAddProd(){ _cotProds.push({nombre:'',cantidad:0,unidad:'kg',costo:0,precio:0}); cotRenderProds(); }
function cotRemoveProd(i){ _cotProds.splice(i,1); cotRenderProds(); cotCalc(); }
function cotRenderProds(){
  const el=document.getElementById('cot-prods-wrap');
  if(!_cotProds.length){
    el.innerHTML='<p style="color:var(--muted);font-size:.8rem;padding:8px 0 14px;font-family:var(--fn);">Sin productos — haz clic en "+ Añadir Producto"</p>';
    return;
  }
  el.innerHTML='<div style="overflow-x:auto;margin-bottom:10px;"><table style="min-width:580px;">' +
    '<thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Costo/u</th><th>Precio/u</th><th>Subtotal</th><th></th></tr></thead><tbody>' +
    _cotProds.map((p,i)=>`<tr>
      <td><input value="${esc(p.nombre)}" placeholder="Nombre producto" oninput="_cotProds[${i}].nombre=this.value"
        style="border:1.5px solid var(--br);border-radius:5px;padding:5px 8px;font-size:.79rem;width:100%;background:var(--s2);font-family:var(--fm);"></td>
      <td><input type="number" value="${p.cantidad}" min="0" step="0.01" oninput="_cotProds[${i}].cantidad=+this.value;cotCalc()"
        style="border:1.5px solid var(--br);border-radius:5px;padding:5px;font-size:.79rem;width:78px;background:var(--s2);font-family:var(--fm);"></td>
      <td><select oninput="_cotProds[${i}].unidad=this.value"
        style="border:1.5px solid var(--br);border-radius:5px;padding:5px;font-size:.79rem;background:var(--s2);">
        ${['kg','ton','caja','bulto','pallet','pieza'].map(u=>`<option ${p.unidad===u?'selected':''}>${u}</option>`).join('')}
      </select></td>
      <td><input type="number" value="${p.costo}" min="0" step="0.01" oninput="_cotProds[${i}].costo=+this.value;cotCalc()"
        style="border:1.5px solid var(--br);border-radius:5px;padding:5px;font-size:.79rem;width:86px;background:var(--s2);font-family:var(--fm);"></td>
      <td><input type="number" value="${p.precio}" min="0" step="0.01" oninput="_cotProds[${i}].precio=+this.value;cotCalc()"
        style="border:1.5px solid var(--br);border-radius:5px;padding:5px;font-size:.79rem;width:86px;background:var(--s2);font-family:var(--fm);"></td>
      <td style="font-weight:700;color:var(--acc);">${fmx((p.precio||0)*(p.cantidad||0))}</td>
      <td><button onclick="cotRemoveProd(${i})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:1rem;padding:2px 6px;">✕</button></td>
    </tr>`).join('') + '</tbody></table></div>';
}
function cotCalc(){
  const cp=_cotProds.reduce((a,p)=>a+(+p.costo||0)*(+p.cantidad||0),0);
  const vp=_cotProds.reduce((a,p)=>a+(+p.precio||0)*(+p.cantidad||0),0);
  const g=G_KEYS.reduce((a,k)=>a+(+document.getElementById('cg-'+k)?.value||0),0);
  const tc=cp+g, util=vp-tc, m=vp>0?((util/vp)*100):0;
  document.getElementById('cr-costo').textContent=fmx(tc);
  document.getElementById('cr-venta').textContent=fmx(vp);
  document.getElementById('cr-util').textContent=fmx(util);
  const mEl=document.getElementById('cr-margen');
  mEl.textContent=m.toFixed(1)+'%';
  mEl.style.color=m<10?'var(--danger)':m<20?'var(--warn)':'var(--acc)';
}
function cotSave(){
  const cliente=getVal('cot-cliente').trim();
  if(!cliente){ toast('⚠️ Ingresa el nombre del cliente',true); return; }
  const gastos={}; G_KEYS.forEach(k=>gastos[k]=+document.getElementById('cg-'+k)?.value||0);
  const cp=_cotProds.reduce((a,p)=>a+(+p.costo||0)*(+p.cantidad||0),0);
  const vp=_cotProds.reduce((a,p)=>a+(+p.precio||0)*(+p.cantidad||0),0);
  const tg=Object.values(gastos).reduce((a,b)=>a+b,0);
  const tc=cp+tg, m=vp>0?((vp-tc)/vp*100):0;
  const editId=getVal('cot-edit-id');
  const rec={
    fecha:getVal('cot-fecha'),cliente,ref:getVal('cot-ref').trim(),
    tipo:getVal('cot-tipo'),entrega:getVal('cot-entrega'),
    lugar:getVal('cot-lugar').trim(),contacto:getVal('cot-contacto').trim(),
    cond_pago:getVal('cot-cond-pago'),obs:getVal('cot-obs').trim(),
    productos:JSON.parse(JSON.stringify(_cotProds)),
    gastos,totalCosto:tc,precio_venta:vp,margen:m,
    estado:editId?(DB.cotizaciones.find(c=>c.id===editId)?.estado||'pendiente'):'pendiente'
  };
  if(editId){
    const idx=DB.cotizaciones.findIndex(c=>c.id===editId);
    if(idx>=0){ Object.assign(DB.cotizaciones[idx],rec); toast('✓ Cotización actualizada'); }
    cotCancelEdit();
  }else{
    DB.cotizaciones.unshift({id:uid(),ts:now(),...rec});
    toast('✓ Cotización guardada'); cotReset();
  }
  save(); cotRender();
}
function cotCancelEdit(){
  cotReset();
  document.getElementById('cot-form-title').textContent='➕ Nueva Cotización';
  document.getElementById('cot-cancel-btn').style.display='none';
  cotRender();
}
function cotReset(){
  document.getElementById('cot-edit-id').value='';
  ['cot-cliente','cot-ref','cot-lugar','cot-contacto','cot-obs'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  G_KEYS.forEach(k=>{const e=document.getElementById('cg-'+k);if(e)e.value=0;});
  _cotProds=[]; cotRenderProds(); cotCalc();
  setTd('cot-fecha',today()); setTd('cot-entrega',today());
}
function cotSetEstado(id,estado){
  const c=DB.cotizaciones.find(c=>c.id===id); if(!c)return;
  c.estado=estado; c.fechaEstado=today();
  if(estado==='aceptada'){
    DB.ventas.unshift({id:uid(),ts:now(),fecha:c.fecha,cliente:c.cliente,folio:'',
      tipo:c.tipo,total:c.precio_venta||0,forma:'contado',dias:0,venc:'',
      pagos:[],estado_pago:'pendiente',notas:'Generada de COT: '+(c.ref||c.id)});
    toast('✅ Aceptada — venta creada automáticamente');
  }else toast('Estado: '+estado);
  save(); cotRender();
}
function cotEdit(id){
  const c=DB.cotizaciones.find(c=>c.id===id); if(!c)return;
  ['cot-edit-id','cot-fecha','cot-cliente','cot-ref','cot-tipo','cot-entrega','cot-lugar','cot-contacto','cot-cond-pago','cot-obs']
    .forEach(fid=>{const e=document.getElementById(fid);if(e)e.value=c[fid.replace('cot-','').replace('-','_')]||'';});
  document.getElementById('cot-edit-id').value=c.id;
  document.getElementById('cot-tipo').value=c.tipo||'privado';
  document.getElementById('cot-cond-pago').value=c.cond_pago||'contado';
  G_KEYS.forEach(k=>{const e=document.getElementById('cg-'+k);if(e)e.value=c.gastos?.[k]||0;});
  _cotProds=JSON.parse(JSON.stringify(c.productos||[]));
  cotRenderProds(); cotCalc();
  document.getElementById('cot-form-title').textContent='✏️ Editando: '+c.cliente;
  document.getElementById('cot-cancel-btn').style.display='';
  document.getElementById('cot-form-card').scrollIntoView({behavior:'smooth'});
}
function cotRender(){
  const tb=document.getElementById('cot-tbody');
  let list=DB.cotizaciones.slice();
  const mes=getVal('cot-filtro-mes'),tipo=getVal('cot-filtro-tipo'),est=getVal('cot-filtro-est');
  if(mes)list=list.filter(c=>(c.fecha||'').startsWith(mes));
  if(tipo)list=list.filter(c=>c.tipo===tipo);
  if(est)list=list.filter(c=>c.estado===est);
  list.sort((a,b)=>(b.fecha||b.ts||'').localeCompare(a.fecha||a.ts||''));
  if(!list.length){tb.innerHTML='<tr><td colspan="9"><div class="empty">Sin cotizaciones</div></td></tr>';return;}
  const EH={pendiente:'<span class="chip cw">⏳ Pendiente</span>',aceptada:'<span class="chip ck">✅ Aceptada</span>',rechazada:'<span class="chip cr">❌ Rechazada</span>'};
  tb.innerHTML=list.map(c=>`<tr>
    <td>${c.fecha||'—'}</td>
    <td style="font-weight:700;">${esc(c.cliente)}</td>
    <td><span class="chip ${c.tipo==='exportacion'?'cp':c.tipo==='mayoreo'?'co':'cb'}">${TIPO_LBL[c.tipo]||c.tipo}</span></td>
    <td style="font-size:.71rem;color:var(--muted2);">${esc(c.ref||'—')}</td>
    <td>${c.entrega||'—'}</td>
    <td style="font-weight:700;color:var(--acc);">${fmx(c.precio_venta)}</td>
    <td style="font-weight:700;color:${(c.margen||0)<10?'var(--danger)':(c.margen||0)<20?'var(--warn)':'var(--acc)'};">${(c.margen||0).toFixed(1)}%</td>
    <td>${EH[c.estado||'pendiente']}</td>
    <td style="white-space:nowrap;display:flex;gap:3px;">
      ${c.estado==='pendiente'?`<button class="btn bo bsm" onclick="cotSetEstado('${c.id}','aceptada')" style="font-size:.6rem;color:var(--acc);">✅</button>
      <button class="btn bo bsm" onclick="cotSetEstado('${c.id}','rechazada')" style="font-size:.6rem;color:var(--danger);">❌</button>`:''}
      <button class="btn bo bsm" onclick="cotEdit('${c.id}')" style="font-size:.6rem;">✏</button>
      <button class="btn bo bsm" onclick="delRec('cotizaciones','${c.id}')" style="font-size:.6rem;color:var(--danger);">✕</button>
    </td></tr>`).join('');
}
function cotExportCSV(){
  if(!DB.cotizaciones.length){toast('Sin datos',true);return;}
  let csv='\uFEFF'+'Fecha,Cliente,Tipo,Folio,Entrega,Costo,Precio Venta,Utilidad,Margen%,Estado\n';
  DB.cotizaciones.forEach(c=>{
    csv+=[c.fecha,c.cliente,c.tipo,c.ref||'',c.entrega||'',(c.totalCosto||0).toFixed(2),
      (c.precio_venta||0).toFixed(2),((c.precio_venta||0)-(c.totalCosto||0)).toFixed(2),
      (c.margen||0).toFixed(1),c.estado||'pendiente']
      .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')+'\n';
  });
  dlCSV(csv,'Cotizaciones_Agropexa_'+today()+'.csv');
}

// ══ VENTAS ══
function vtaShowPagos(){
  const f=getVal('vta-forma');
  const cred=f==='credito'||f==='parcialidades';
  document.getElementById('vta-dias-fg').style.display=cred?'':'none';
  document.getElementById('vta-venc-row').style.display=cred?'':'none';
  document.getElementById('vta-pagos-sec').style.display=f==='parcialidades'?'':'none';
  if(cred) vtaCalcVenc();
}
function vtaCalcVenc(){
  const dias=+getVal('vta-dias')||30, fecha=getVal('vta-fecha');
  if(fecha){ const d=new Date(fecha+'T12:00:00'); d.setDate(d.getDate()+dias);
    document.getElementById('vta-venc').value=d.toISOString().split('T')[0]; }
}
function vtaCalc(){
  const total=+getVal('vta-total')||0;
  const pag=_vtaPagos.reduce((a,p)=>a+(+p.monto||0),0);
  const saldo=total-pag;
  document.getElementById('vta-pagado').textContent=fmx(pag);
  document.getElementById('vta-saldo').textContent=fmx(saldo);
  document.getElementById('vta-pct').textContent=total>0?((pag/total*100).toFixed(0)+'%'):'0%';
}
function vtaAddPago(){
  const monto=prompt('Monto del pago (MXN):','');
  if(!monto||isNaN(+monto)||+monto<=0)return;
  const fecha=prompt('Fecha del pago (YYYY-MM-DD):',today());
  const metodo=prompt('Método (efectivo/transferencia/cheque):','transferencia');
  _vtaPagos.push({id:uid(),monto:+monto,fecha:fecha||today(),metodo:metodo||'transferencia'});
  vtaRenderPagos(); vtaCalc();
}
function vtaRenderPagos(){
  const el=document.getElementById('vta-pagos-lista');
  if(!_vtaPagos.length){el.innerHTML='<div style="color:var(--muted);font-size:.8rem;padding:4px;">Sin pagos aún</div>';return;}
  el.innerHTML=_vtaPagos.map((p,i)=>`<div class="pago-row">
    <span>${p.fecha} · <strong>${p.metodo}</strong></span>
    <span style="font-weight:700;color:var(--acc);">${fmx(p.monto)}</span>
    <button onclick="_vtaPagos.splice(${i},1);vtaRenderPagos();vtaCalc();" style="background:none;border:none;cursor:pointer;color:var(--danger);">✕</button>
  </div>`).join('');
}
function vtaEstado(total,pagos){
  const p=pagos.reduce((a,x)=>a+(+x.monto||0),0);
  return p>=total?'pagado':p>0?'parcial':'pendiente';
}
function vtaSave(){
  const cliente=getVal('vta-cliente').trim();
  if(!cliente){toast('⚠️ Ingresa el cliente',true);return;}
  const total=+getVal('vta-total')||0;
  if(total<=0){toast('⚠️ Ingresa el monto',true);return;}
  const forma=getVal('vta-forma');
  let pagos=JSON.parse(JSON.stringify(_vtaPagos));
  if(forma==='contado'||forma==='transferencia'){
    pagos=[{id:uid(),monto:total,fecha:getVal('vta-fecha')||today(),metodo:forma}];
  }
  const editId=getVal('vta-edit-id');
  const rec={fecha:getVal('vta-fecha'),cliente,folio:getVal('vta-folio').trim(),
    tipo:getVal('vta-tipo'),total,forma,dias:+getVal('vta-dias')||0,
    venc:getVal('vta-venc')||'',cot_ref:getVal('vta-cot-ref')||'',
    pagos,estado_pago:vtaEstado(total,pagos),notas:getVal('vta-notas').trim()};
  if(editId){
    const idx=DB.ventas.findIndex(v=>v.id===editId);
    if(idx>=0){Object.assign(DB.ventas[idx],rec);toast('✓ Venta actualizada');}
    vtaCancelEdit();
  }else{
    DB.ventas.unshift({id:uid(),ts:now(),...rec});
    toast('✓ Venta registrada'); vtaReset();
  }
  save(); vtaRender();
}
function vtaCancelEdit(){vtaReset();document.getElementById('vta-form-title').textContent='➕ Registrar Venta';document.getElementById('vta-cancel-btn').style.display='none';vtaRender();}
function vtaReset(){
  document.getElementById('vta-edit-id').value='';
  ['vta-cliente','vta-folio','vta-total','vta-notas','vta-cot-ref'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('vta-dias').value=30;
  _vtaPagos=[]; vtaRenderPagos(); vtaCalc(); vtaShowPagos();
  setTd('vta-fecha',today());
}
function vtaEdit(id){
  const v=DB.ventas.find(v=>v.id===id);if(!v)return;
  document.getElementById('vta-edit-id').value=v.id;
  document.getElementById('vta-fecha').value=v.fecha||'';
  document.getElementById('vta-cliente').value=v.cliente||'';
  document.getElementById('vta-folio').value=v.folio||'';
  document.getElementById('vta-tipo').value=v.tipo||'privado';
  document.getElementById('vta-total').value=v.total||'';
  document.getElementById('vta-forma').value=v.forma||'contado';
  document.getElementById('vta-dias').value=v.dias||30;
  document.getElementById('vta-notas').value=v.notas||'';
  _vtaPagos=JSON.parse(JSON.stringify(v.pagos||[]));
  vtaRenderPagos();vtaCalc();vtaShowPagos();
  document.getElementById('vta-form-title').textContent='✏️ Editando: '+v.cliente;
  document.getElementById('vta-cancel-btn').style.display='';
  document.getElementById('vta-form-card').scrollIntoView({behavior:'smooth'});
}
function vtaAddPagoInline(id){
  const v=DB.ventas.find(v=>v.id===id);if(!v)return;
  const monto=prompt('Monto del pago (MXN):','');
  if(!monto||isNaN(+monto)||+monto<=0)return;
  const fecha=prompt('Fecha:',today());
  const metodo=prompt('Método:','transferencia');
  if(!v.pagos)v.pagos=[];
  v.pagos.push({id:uid(),monto:+monto,fecha:fecha||today(),metodo:metodo||'transferencia'});
  v.estado_pago=vtaEstado(+v.total||0,v.pagos);
  save();vtaRender();toast('✓ Pago registrado');
}
function vtaRender(){
  const tb=document.getElementById('vta-tbody');
  let list=DB.ventas.slice();
  const mes=getVal('vta-filtro-mes'),tipo=getVal('vta-filtro-tipo'),est=getVal('vta-filtro-est');
  if(mes)list=list.filter(v=>(v.fecha||'').startsWith(mes));
  if(tipo)list=list.filter(v=>v.tipo===tipo);
  if(est)list=list.filter(v=>v.estado_pago===est);
  list.sort((a,b)=>(b.fecha||b.ts||'').localeCompare(a.fecha||a.ts||''));
  const sumT=list.reduce((a,v)=>a+(+v.total||0),0);
  const sumC=list.reduce((a,v)=>a+(v.pagos||[]).reduce((s,p)=>s+(+p.monto||0),0),0);
  document.getElementById('vta-total-filtro').textContent=fmx(sumT);
  document.getElementById('vta-cobrado-filtro').textContent=fmx(sumC);
  document.getElementById('vta-saldo-filtro').textContent=fmx(sumT-sumC);
  if(!list.length){tb.innerHTML='<tr><td colspan="10"><div class="empty">Sin ventas registradas</div></td></tr>';return;}
  const PH={pagado:'<span class="chip ck">✅ Pagado</span>',parcial:'<span class="chip cw">💳 Parcial</span>',pendiente:'<span class="chip cr">⏳ Pendiente</span>'};
  const now2=new Date();
  tb.innerHTML=list.map(v=>{
    const pag=(v.pagos||[]).reduce((a,p)=>a+(+p.monto||0),0);
    const saldo=(+v.total||0)-pag;
    const vencido=v.venc&&new Date(v.venc+'T23:59:59')<now2&&v.estado_pago!=='pagado';
    return`<tr${vencido?' style="background:rgba(214,48,48,.04);"':''}>
      <td>${v.fecha||'—'}</td>
      <td style="font-weight:700;">${esc(v.cliente)}</td>
      <td style="font-size:.71rem;color:var(--muted2);">${esc(v.folio||'—')}</td>
      <td><span class="chip ${v.tipo==='exportacion'?'cp':v.tipo==='mayoreo'?'co':'cb'}">${TIPO_LBL[v.tipo]||v.tipo}</span></td>
      <td style="font-weight:700;">${fmx(v.total)}</td>
      <td style="color:var(--acc);">${fmx(pag)}</td>
      <td style="color:${saldo>0?'var(--danger)':'var(--acc)'};">${fmx(saldo)}</td>
      <td style="font-size:.72rem;color:${vencido?'var(--danger)':'var(--muted2)'};">${v.venc||'—'}${vencido?' ⚠️':''}</td>
      <td>${PH[v.estado_pago||'pendiente']}</td>
      <td style="white-space:nowrap;display:flex;gap:3px;">
        ${v.estado_pago!=='pagado'?`<button class="btn bo bsm" onclick="vtaAddPagoInline('${v.id}')" style="font-size:.6rem;color:var(--acc);">+ Pago</button>`:''}
        <button class="btn bo bsm" onclick="vtaEdit('${v.id}')" style="font-size:.6rem;">✏</button>
        <button class="btn bo bsm" onclick="delRec('ventas','${v.id}')" style="font-size:.6rem;color:var(--danger);">✕</button>
      </td></tr>`;
  }).join('');
}
function vtaExportCSV(){
  if(!DB.ventas.length){toast('Sin datos',true);return;}
  let csv='\uFEFF'+'Fecha,Cliente,Folio,Tipo,Total MXN,Cobrado,Saldo,Vencimiento,Estado\n';
  DB.ventas.forEach(v=>{
    const p=(v.pagos||[]).reduce((a,x)=>a+(+x.monto||0),0);
    csv+=[v.fecha,v.cliente,v.folio||'',v.tipo,(+v.total||0).toFixed(2),p.toFixed(2),
      ((+v.total||0)-p).toFixed(2),v.venc||'',v.estado_pago||'pendiente']
      .map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')+'\n';
  });
  dlCSV(csv,'Ventas_Agropexa_'+today()+'.csv');
}

// ══ GASTOS DIARIOS ══
const GD_E={compras_producto:'🛒',combustible:'⛽',flete:'🚛',mano_obra:'👷',empaque:'📦',comida:'🍽',comunicacion:'📱',servicios:'🔧',otro:'📋'};
function gdSave(){
  const monto=+getVal('gd-monto');
  if(!monto){toast('⚠️ Ingresa el monto',true);return;}
  DB.gastos_diarios.unshift({id:uid(),ts:now(),fecha:getVal('gd-fecha'),cat:getVal('gd-cat'),
    desc:getVal('gd-desc').trim(),prov:getVal('gd-prov').trim(),monto});
  ['gd-monto','gd-desc','gd-prov'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  save();gdRender();toast('✓ Gasto registrado');
}
function gdRender(){
  const tb=document.getElementById('gd-tbody');
  let list=DB.gastos_diarios.slice();
  const mes=getVal('gd-filtro-mes'),cat=getVal('gd-filtro-cat');
  if(mes)list=list.filter(g=>(g.fecha||'').startsWith(mes));
  if(cat)list=list.filter(g=>g.cat===cat);
  list.sort((a,b)=>(b.fecha||b.ts||'').localeCompare(a.fecha||a.ts||''));
  const total=list.reduce((a,g)=>a+(+g.monto||0),0);
  document.getElementById('gd-total').textContent=fmx(total);
  document.getElementById('gd-count').textContent=list.length;
  const byCat={};list.forEach(g=>{byCat[g.cat]=(byCat[g.cat]||0)+(+g.monto||0);});
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('gd-mayor').textContent=top?(GD_E[top[0]]||'📋')+' '+top[0]:'—';
  document.getElementById('gd-mayor-val').textContent=top?fmx(top[1]):'';
  if(!list.length){tb.innerHTML='<tr><td colspan="6"><div class="empty">Sin gastos</div></td></tr>';return;}
  tb.innerHTML=list.map(g=>`<tr>
    <td>${g.fecha||'—'}</td>
    <td><span class="chip co">${GD_E[g.cat]||'📋'} ${g.cat}</span></td>
    <td>${esc(g.desc||'—')}</td>
    <td style="font-size:.72rem;color:var(--muted2);">${esc(g.prov||'—')}</td>
    <td style="font-weight:700;color:var(--danger);">${fmx(g.monto)}</td>
    <td><button class="btn bo bsm" onclick="delRec('gastos_diarios','${g.id}')" style="font-size:.6rem;color:var(--danger);">✕</button></td>
  </tr>`).join('');
}
function gdExportCSV(){
  if(!DB.gastos_diarios.length){toast('Sin datos',true);return;}
  let csv='\uFEFF'+'Fecha,Categoría,Descripción,Proveedor,Monto MXN\n';
  DB.gastos_diarios.forEach(g=>csv+=[g.fecha,g.cat,g.desc||'',g.prov||'',(+g.monto).toFixed(2)].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')+'\n');
  dlCSV(csv,'GastosDiarios_Agropexa_'+today()+'.csv');
}

// ══ GASTOS GENERALES ══
const GG_E={renta:'🏠',nomina:'👥',imss:'🏥',impuestos:'📊',servicios:'💡',internet:'📡',contabilidad:'📒',publicidad:'📢',seguros:'🛡',mantenimiento:'🔧',legal:'⚖️',otro:'📋'};
function ggSave(){
  const monto=+getVal('gg-monto');
  if(!monto){toast('⚠️ Ingresa el monto',true);return;}
  DB.gastos_generales.unshift({id:uid(),ts:now(),fecha:getVal('gg-fecha'),cat:getVal('gg-cat'),
    desc:getVal('gg-desc').trim(),prov:getVal('gg-prov').trim(),periodo:getVal('gg-periodo'),monto});
  ['gg-monto','gg-desc','gg-prov'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  save();ggRender();toast('✓ Gasto general registrado');
}
function ggRender(){
  const tb=document.getElementById('gg-tbody');
  let list=DB.gastos_generales.slice();
  const mes=getVal('gg-filtro-mes');
  if(mes)list=list.filter(g=>(g.fecha||'').startsWith(mes));
  list.sort((a,b)=>(b.fecha||b.ts||'').localeCompare(a.fecha||a.ts||''));
  const total=list.reduce((a,g)=>a+(+g.monto||0),0);
  const nomina=list.filter(g=>g.cat==='nomina').reduce((a,g)=>a+(+g.monto||0),0);
  const fijos=list.filter(g=>['renta','servicios','internet'].includes(g.cat)).reduce((a,g)=>a+(+g.monto||0),0);
  document.getElementById('gg-total').textContent=fmx(total);
  document.getElementById('gg-nomina').textContent=fmx(nomina);
  document.getElementById('gg-fijos').textContent=fmx(fijos);
  document.getElementById('gg-count').textContent=list.length;
  if(!list.length){tb.innerHTML='<tr><td colspan="7"><div class="empty">Sin gastos generales</div></td></tr>';return;}
  tb.innerHTML=list.map(g=>`<tr>
    <td>${g.fecha||'—'}</td>
    <td><span class="chip cp">${GG_E[g.cat]||'📋'} ${g.cat}</span></td>
    <td>${esc(g.desc||'—')}</td>
    <td style="font-size:.72rem;color:var(--muted2);">${esc(g.prov||'—')}</td>
    <td><span class="chip cb">${g.periodo||'único'}</span></td>
    <td style="font-weight:700;color:var(--danger);">${fmx(g.monto)}</td>
    <td><button class="btn bo bsm" onclick="delRec('gastos_generales','${g.id}')" style="font-size:.6rem;color:var(--danger);">✕</button></td>
  </tr>`).join('');
}
function ggExportCSV(){
  if(!DB.gastos_generales.length){toast('Sin datos',true);return;}
  let csv='\uFEFF'+'Fecha,Categoría,Descripción,Proveedor,Período,Monto MXN\n';
  DB.gastos_generales.forEach(g=>csv+=[g.fecha,g.cat,g.desc||'',g.prov||'',g.periodo||'único',(+g.monto).toFixed(2)].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')+'\n');
  dlCSV(csv,'GastosGenerales_Agropexa_'+today()+'.csv');
}

// ══ PRODUCTOS ══
const DEFAULT_PRODS=[
  {id:'p01',nombre:'Tomate Saladette',emoji:'🍅',cat:'verduras',unidad:'kg',costo:8,precio:15,precio_exp:16,origen:'Sinaloa',notas:'Calibre M-G, primera'},
  {id:'p02',nombre:'Tomate Bola',emoji:'🍅',cat:'verduras',unidad:'kg',costo:9,precio:16,precio_exp:17,origen:'Jalisco'},
  {id:'p03',nombre:'Tomate Cherry',emoji:'🍅',cat:'verduras',unidad:'kg',costo:22,precio:40,precio_exp:42,notas:'Calibre 10-12mm'},
  {id:'p04',nombre:'Chile Jalapeño',emoji:'🌶',cat:'chiles',unidad:'kg',costo:12,precio:24,precio_exp:25,origen:'Chihuahua'},
  {id:'p05',nombre:'Chile Habanero',emoji:'🌶',cat:'chiles',unidad:'kg',costo:35,precio:68,precio_exp:70,notas:'Naranja y rojo'},
  {id:'p06',nombre:'Chile Serrano',emoji:'🌶',cat:'chiles',unidad:'kg',costo:10,precio:20,precio_exp:21},
  {id:'p07',nombre:'Chile Poblano',emoji:'🫑',cat:'chiles',unidad:'kg',costo:14,precio:28,precio_exp:30},
  {id:'p08',nombre:'Aguacate Hass',emoji:'🥑',cat:'frutas',unidad:'kg',costo:28,precio:52,precio_exp:55,origen:'Michoacán',notas:'Clase 1'},
  {id:'p09',nombre:'Limón Persa',emoji:'🍋',cat:'frutas',unidad:'kg',costo:9,precio:18,precio_exp:19,origen:'Veracruz'},
  {id:'p10',nombre:'Mango Ataulfo',emoji:'🥭',cat:'frutas',unidad:'kg',costo:14,precio:28,precio_exp:30,origen:'Chiapas',notas:'Temporada abr-ago'},
  {id:'p11',nombre:'Plátano Tabasco',emoji:'🍌',cat:'frutas',unidad:'kg',costo:6,precio:13,precio_exp:14},
  {id:'p12',nombre:'Papaya Maradol',emoji:'🍈',cat:'frutas',unidad:'kg',costo:8,precio:16,precio_exp:17,origen:'Veracruz'},
  {id:'p13',nombre:'Pepino',emoji:'🥒',cat:'verduras',unidad:'kg',costo:6,precio:12,precio_exp:13},
  {id:'p14',nombre:'Calabacita',emoji:'🥬',cat:'verduras',unidad:'kg',costo:7,precio:14,precio_exp:15},
  {id:'p15',nombre:'Cebolla Blanca',emoji:'🧅',cat:'verduras',unidad:'kg',costo:8,precio:16,precio_exp:17,origen:'Chihuahua'},
  {id:'p16',nombre:'Ajo Nacional',emoji:'🧄',cat:'verduras',unidad:'kg',costo:45,precio:88,precio_exp:90,origen:'Sonora'},
  {id:'p17',nombre:'Brócoli',emoji:'🥦',cat:'verduras',unidad:'kg',costo:14,precio:26,precio_exp:27,origen:'Guanajuato'},
  {id:'p18',nombre:'Zanahoria',emoji:'🥕',cat:'verduras',unidad:'kg',costo:7,precio:14,precio_exp:15},
  {id:'p19',nombre:'Papa Blanca',emoji:'🥔',cat:'tuberculos',unidad:'kg',costo:9,precio:17,precio_exp:18,origen:'Puebla'},
  {id:'p20',nombre:'Camote Morado',emoji:'🍠',cat:'tuberculos',unidad:'kg',costo:12,precio:24,precio_exp:26},
  {id:'p21',nombre:'Frijol Negro',emoji:'🫘',cat:'granos',unidad:'kg',costo:22,precio:38,precio_exp:40,notas:'Tipo Veracruz, primera'},
  {id:'p22',nombre:'Frijol Pinto',emoji:'🫘',cat:'granos',unidad:'kg',costo:20,precio:35,precio_exp:37},
  {id:'p23',nombre:'Maíz Blanco',emoji:'🌽',cat:'granos',unidad:'kg',costo:5,precio:10,precio_exp:11},
  {id:'p24',nombre:'Chía Orgánica',emoji:'🌾',cat:'granos',unidad:'kg',costo:55,precio:100,precio_exp:105,notas:'Certificada orgánica'},
  {id:'p25',nombre:'Nopal en Tiras',emoji:'🌵',cat:'especial',unidad:'kg',costo:10,precio:22,precio_exp:24,notas:'Limpio, sin espinas'},
];

function initDefaultProds(){
  if(!DB.productos||!DB.productos.length){
    DB.productos=DEFAULT_PRODS.map(p=>({...p,ts:now(),margen:p.precio>0?((p.precio-p.costo)/p.precio*100):0}));
    save();
  }
}
function pmCalcMargen(){
  const c=+getVal('pm-costo')||0, p=+getVal('pm-precio')||0;
  const m=p>0?((p-c)/p*100):0;
  const e=document.getElementById('pm-margen');
  e.value=m.toFixed(1)+'%';
  e.style.color=m<10?'var(--danger)':m<20?'var(--warn)':'var(--acc)';
}
function showProdModal(id){
  document.getElementById('prod-modal').classList.add('open');
  if(id){
    const p=DB.productos.find(x=>x.id===id);if(!p)return;
    document.getElementById('pm-id').value=p.id;
    document.getElementById('pm-nombre').value=p.nombre||'';
    document.getElementById('pm-emoji').value=p.emoji||'🌿';
    document.getElementById('pm-cat').value=p.cat||'verduras';
    document.getElementById('pm-unidad').value=p.unidad||'kg';
    document.getElementById('pm-costo').value=p.costo||'';
    document.getElementById('pm-precio').value=p.precio||'';
    document.getElementById('pm-precio-exp').value=p.precio_exp||'';
    document.getElementById('pm-origen').value=p.origen||'';
    document.getElementById('pm-notas').value=p.notas||'';
    document.getElementById('prod-modal-title').textContent='✏️ Editar: '+p.nombre;
    pmCalcMargen();
  }else{
    document.getElementById('pm-id').value='';
    ['pm-nombre','pm-costo','pm-precio','pm-precio-exp','pm-origen','pm-notas'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    document.getElementById('pm-emoji').value='🌿';
    document.getElementById('pm-margen').value='';
    document.getElementById('prod-modal-title').textContent='🌽 Nuevo Producto';
  }
}
function closeProdModal(){document.getElementById('prod-modal').classList.remove('open');}
function prodSave(){
  const nombre=getVal('pm-nombre').trim();
  if(!nombre){toast('⚠️ Ingresa el nombre',true);return;}
  const editId=getVal('pm-id');
  const costo=+getVal('pm-costo')||0, precio=+getVal('pm-precio')||0;
  const margen=precio>0?((precio-costo)/precio*100):0;
  const rec={nombre,emoji:getVal('pm-emoji')||'🌿',cat:getVal('pm-cat'),unidad:getVal('pm-unidad'),
    costo,precio,precio_exp:+getVal('pm-precio-exp')||0,
    origen:getVal('pm-origen').trim(),notas:getVal('pm-notas').trim(),margen,updated:now()};
  if(editId){
    const idx=DB.productos.findIndex(p=>p.id===editId);
    if(idx>=0){Object.assign(DB.productos[idx],rec);toast('✓ Producto actualizado');}
  }else{
    DB.productos.unshift({id:uid(),ts:now(),...rec});
    toast('✓ Producto agregado');
  }
  save();closeProdModal();prodRender();
}
function prodFiltrar(cat,btn){
  _prodFiltro=cat;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  prodRender();
}
function prodRender(){
  const el=document.getElementById('prod-grid');
  let list=(DB.productos||[]).slice();
  if(_prodFiltro)list=list.filter(p=>p.cat===_prodFiltro);
  list.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  if(!list.length){el.innerHTML='<div class="empty" style="grid-column:1/-1;">Sin productos en esta categoría</div>';return;}
  el.innerHTML=list.map(p=>{
    const m=p.margen||0;
    const mc=m<10?'var(--danger)':m<20?'var(--warn)':'var(--acc)';
    const mb=m<10?'rgba(214,48,48,.1)':m<20?'rgba(232,160,0,.1)':'rgba(0,122,82,.1)';
    return`<div class="prod-card">
      <div class="prod-cat-lbl">${p.cat||'—'}${p.origen?' · '+p.origen:''}</div>
      <div class="prod-emoji">${p.emoji||'🌿'}</div>
      <div class="prod-name">${esc(p.nombre)}</div>
      <div class="prod-precio">${fmx(p.precio)}<span class="prod-unit">/ ${p.unidad||'kg'}</span></div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:3px;">
        Costo: ${fmx(p.costo)}
        <span class="margen-pill" style="color:${mc};background:${mb};">${m.toFixed(1)}%</span>
      </div>
      ${p.precio_exp?`<div style="font-size:.7rem;color:var(--purple);margin-top:4px;font-weight:600;">🌎 Export: ${fmx(p.precio_exp)}</div>`:''}
      ${p.notas?`<div style="font-size:.67rem;color:var(--muted);margin-top:5px;line-height:1.3;">${esc(p.notas)}</div>`:''}
      <div class="prod-actions">
        <button class="btn bo bsm" onclick="showProdModal('${p.id}')" style="flex:1;font-size:.68rem;">✏ Editar</button>
        <button class="btn bo bsm" onclick="delRec('productos','${p.id}')" style="font-size:.68rem;color:var(--danger);">✕</button>
      </div></div>`;
  }).join('');
}
function prodExportCSV(){
  if(!DB.productos.length){toast('Sin datos',true);return;}
  let csv='\uFEFF'+'Nombre,Categoría,Unidad,Costo MXN,Precio Venta MXN,Precio Export MXN,Margen%,Origen,Notas\n';
  DB.productos.forEach(p=>csv+=[p.nombre,p.cat,p.unidad||'kg',(+p.costo).toFixed(2),(+p.precio).toFixed(2),
    (p.precio_exp||0).toFixed(2),(+p.margen||0).toFixed(1),p.origen||'',p.notas||'']
    .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')+'\n');
  dlCSV(csv,'Productos_Agropexa_'+today()+'.csv');
}

// ══ USUARIOS ══
const ROL_LBL={admin:'🔐 Admin',ventas:'💼 Ventas',operativo:'📦 Operativo',contabilidad:'📊 Contabilidad'};
function usrSave(){
  const nombre=getVal('usr-nombre').trim();
  const email=getVal('usr-email').trim().toLowerCase();
  const pass=getVal('usr-pass');
  if(!nombre||!email||!pass){toast('⚠️ Completa todos los campos',true);return;}
  if(pass.length<4){toast('⚠️ Contraseña mínimo 4 caracteres',true);return;}
  if([...SYS_USERS,...DB.usuarios].find(u=>u.email.toLowerCase()===email)){toast('⚠️ Usuario ya existe',true);return;}
  DB.usuarios.push({id:uid(),ts:now(),nombre,email,pass,rol:getVal('usr-rol'),estado:getVal('usr-estado'),lastAccess:null});
  ['usr-nombre','usr-email','usr-pass'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  save();usrRender();toast('✓ Usuario creado');
}
function usrToggle(id){
  const u=DB.usuarios.find(u=>u.id===id);if(!u)return;
  u.estado=u.estado==='activo'?'inactivo':'activo';
  save();usrRender();toast('Usuario '+(u.estado==='activo'?'activado':'desactivado'));
}
function usrRender(){
  const tb=document.getElementById('usr-tbody');
  const all=[...SYS_USERS.map(u=>({...u,_sys:true})),...DB.usuarios];
  tb.innerHTML=all.map(u=>`<tr>
    <td style="font-weight:700;">${esc(u.nombre)}</td>
    <td style="font-size:.78rem;">${esc(u.email)}</td>
    <td><span class="chip cb">${ROL_LBL[u.rol]||u.rol}</span></td>
    <td><span class="chip ${u.estado==='activo'?'ck':'cr'}">${u.estado==='activo'?'✅ Activo':'❌ Inactivo'}</span></td>
    <td style="font-size:.72rem;color:var(--muted2);">${u.lastAccess?new Date(u.lastAccess).toLocaleDateString('es-MX'):'—'}</td>
    <td>${u._sys?'<span style="font-size:.7rem;color:var(--muted2);">Sistema</span>':
      `<button class="btn bo bsm" onclick="usrToggle('${u.id}')" style="font-size:.62rem;">${u.estado==='activo'?'Desactivar':'Activar'}</button>
       <button class="btn bo bsm" onclick="delRec('usuarios','${u.id}')" style="font-size:.62rem;color:var(--danger);">✕</button>`}
    </td></tr>`).join('');
}

// ══ CONFIG ══
function cfgLoad(){
  const e=DB.empresa||{};
  ['razon','rfc','ciudad','tel','email','web'].forEach(k=>{
    const el=document.getElementById('cfg-'+k);if(el)el.value=e[k]||'';
  });
  const fb=loadFbCfg()||{};
  const map={apikey:'apiKey',authdomain:'authDomain',projectid:'projectId',bucket:'storageBucket',senderid:'messagingSenderId',appid:'appId'};
  Object.entries(map).forEach(([k,fk])=>{const el=document.getElementById('cfg-fb-'+k);if(el)el.value=fb[fk]||'';});
}
function cfgSaveEmpresa(){
  DB.empresa={razon:getVal('cfg-razon'),rfc:getVal('cfg-rfc'),ciudad:getVal('cfg-ciudad'),
    tel:getVal('cfg-tel'),email:getVal('cfg-email'),web:getVal('cfg-web')};
  save();toast('✓ Datos de empresa guardados');
}

// ══ UTILS ══
function delRec(table,id){
  if(!confirm('¿Eliminar este registro?'))return;
  DB[table]=DB[table].filter(r=>r.id!==id); save();
  if(table==='cotizaciones')cotRender();
  else if(table==='ventas')vtaRender();
  else if(table==='gastos_diarios')gdRender();
  else if(table==='gastos_generales')ggRender();
  else if(table==='productos')prodRender();
  else if(table==='usuarios')usrRender();
  toast('Registro eliminado');
}
function dlCSV(content,filename){
  const a=Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'})),download:filename});
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast('✅ CSV descargado');
}
function exportAll(){
  const a=Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(new Blob([JSON.stringify(DB,null,2)],{type:'application/json'})),
    download:'Agropexa_Backup_'+today()+'.json'});
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast('✅ Backup exportado');
}
function doImport(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{try{Object.assign(DB,JSON.parse(ev.target.result));save();initApp();toast('✅ Datos importados');}
    catch(err){toast('⚠️ Error al importar',true);}};
  r.readAsText(file);
}
function clearDB(){
  if(!confirm('⚠️ ¿Borrar todos los datos? Esta acción no puede deshacerse.'))return;
  DB.cotizaciones=[];DB.ventas=[];DB.gastos_diarios=[];DB.gastos_generales=[];DB.productos=[];DB.usuarios=[];
  saveLocal();initDefaultProds();toast('Base de datos limpiada');
}

// ══ CLOCK ══
function updateClock(){
  const mx=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Mexico_City'}));
  document.getElementById('hclock').textContent=mx.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})+' 🇲🇽';
}
setInterval(updateClock,1000);updateClock();

// ══ INIT ══
function initApp(){
  document.querySelectorAll('input[type=date]').forEach(i=>{if(!i.value&&!i.readOnly)i.value=today();});
  const m=thisMonth();
  ['cot-filtro-mes','vta-filtro-mes','gd-filtro-mes','gg-filtro-mes'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.value)e.value=m;});
  initDefaultProds();
  renderDashboard();
}

// ══ BOOT ══
window.addEventListener('DOMContentLoaded',async()=>{
  loadLocal();
  const fbCfg=loadFbCfg();
  if(fbCfg&&fbCfg.apiKey&&fbCfg.projectId){
    setSyncDot('local');
    const fbSt=document.getElementById('login-fb-status');
    if(fbSt){fbSt.style.display='block';fbSt.style.background='rgba(232,160,0,.08)';fbSt.style.border='1px solid rgba(232,160,0,.3)';fbSt.style.color='var(--warn)';fbSt.textContent='⏳ Conectando a Firebase...';}
    const ok=await initFirebase(fbCfg);
    if(fbSt){
      if(ok){fbSt.style.background='rgba(0,122,82,.08)';fbSt.style.border='1px solid rgba(0,122,82,.25)';fbSt.style.color='var(--acc)';fbSt.textContent='✅ Firebase conectado';}
      else{fbSt.style.background='rgba(214,48,48,.08)';fbSt.style.border='1px solid rgba(214,48,48,.25)';fbSt.style.color='var(--danger)';fbSt.textContent='⚠️ Sin Firebase — modo local (configura en ⚙️)';}
    }
  }else setSyncDot('local');
  document.getElementById('li-user')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('li-pass')?.focus();});
  document.getElementById('li-pass')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
});
