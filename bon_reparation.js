'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=n=>`${Math.round(Number(n)||0).toLocaleString('fr-FR')} FCFA`;
const dateFr=v=>v?new Date(`${v}T12:00:00`).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}):'—';
const today=()=>new Date().toISOString().slice(0,10);

function values(){
  const labor=+$('labor').value||0, parts=+$('parts').value||0, advance=+$('advance').value||0;
  const total=labor+parts;
  return {labor,parts,advance,total,balance:Math.max(0,total-advance)};
}

function recalcRepair(){
  const v=values();
  $('totalRepair').value=money(v.total);
  if($('d-advance-preview')) $('d-advance-preview').textContent=money(v.advance);
}

function generateRepair(){
  const v=values();
  const fields={
    'd-number': $('repairNumber').value||'BR-001',
    'd-date':   'Dépôt : '+dateFr($('depositDate').value),
    'd-client': $('clientName').value||'—',
    'd-phone':  $('clientPhone').value||'—',
    'd-address':$('clientAddress').value||'—',
    'd-tech':   $('technician').value||'Boussé SAMASSA',
    'd-deposit':dateFr($('depositDate').value),
    'd-return': dateFr($('returnDate').value),
    'd-type':   $('deviceType').value,
    'd-model':  $('deviceModel').value||'—',
    'd-serial': $('serialNumber').value||'—',
    'd-condition':$('deviceCondition').value,
    'd-accessories':$('accessories').value||'Aucun',
    'd-problem':$('problem').value||'Non renseigné',
    'd-diagnosis':$('diagnosis').value||'À compléter',
    'd-work':   $('work').value||'À compléter',
    'd-labor':  money(v.labor),
    'd-parts':  money(v.parts),
    'd-advance':money(v.advance),
    'd-balance':money(v.balance),
    'd-total':  money(v.total),
    'd-status': $('status').value,
    'd-warranty':$('warranty').value,
  };
  Object.entries(fields).forEach(([id,val])=>{ const el=$(id); if(el) el.textContent=val; });
  const notes=$('notes').value.trim();
  if($('d-notes')) $('d-notes').innerHTML=notes?`<strong>Observations :</strong> ${esc(notes)}`:'';
  $('docInner').style.display='block';
  $('placeholder').style.display='none';
  $('docInner').scrollIntoView({behavior:'smooth',block:'start'});
}

function printRepair(){
  if($('docInner').style.display==='none') generateRepair();
  setTimeout(()=>window.print(),150);
}

/* ── ENREGISTRER + CAISSE ── */
function saveRepair(){
  const name=$('clientName').value.trim();
  if(!name){alert('Renseignez le nom du client.');$('clientName').focus();return;}

  const v=values();
  const number=$('repairNumber').value||`BR-${Date.now()}`;
  const list=JSON.parse(localStorage.getItem('samassa_bons_reparation')||'[]');
  if(list.some(x=>x.number===number)){alert('Ce bon de réparation existe déjà.');return;}

  const bon={
    number, status:$('status').value,
    date:$('depositDate').value, returnDate:$('returnDate').value,
    client:name, phone:$('clientPhone').value, address:$('clientAddress').value,
    technician:$('technician').value||'Boussé SAMASSA',
    device:{
      type:$('deviceType').value, model:$('deviceModel').value,
      serial:$('serialNumber').value, condition:$('deviceCondition').value,
      accessories:$('accessories').value
    },
    problem:$('problem').value, diagnosis:$('diagnosis').value, work:$('work').value,
    labor:v.labor, parts:v.parts, advance:v.advance,
    total:v.total, balance:v.balance,
    warranty:$('warranty').value, notes:$('notes').value,
    timestamp:new Date().toISOString()
  };
  list.push(bon);
  localStorage.setItem('samassa_bons_reparation', JSON.stringify(list));

  /* ─ Ajouter l'avance à la caisse ─ */
  if(v.advance > 0){
    const caisse=JSON.parse(localStorage.getItem('samassa_mouvements')||'[]');
    caisse.push({
      id:'BR-'+Date.now(), date:today(), type:'entree',
      desc:`Avance réparation ${number} — ${name} (${$('deviceType').value})`,
      amount:v.advance, pm:'Espèces', cat:'Réparation',
      auto:true, timestamp:new Date().toISOString()
    });
    localStorage.setItem('samassa_mouvements', JSON.stringify(caisse));

    /* Sauvegarder aussi la réparation dans samassa_docs pour la liste globale */
    try {
      const docs=JSON.parse(localStorage.getItem('_samassa_docs')||'[]');
      docs.unshift({type:'Bon Réparation',number,client:name,date:bon.date,
        total:v.total,advance:v.advance,timestamp:bon.timestamp});
      localStorage.setItem('_samassa_docs',JSON.stringify(docs.slice(0,500)));
    } catch(e){}
  }

  /* Notification */
  const msg=v.advance>0
    ? `✅ Bon ${number} enregistré · Avance ${money(v.advance)} ajoutée en caisse`
    : `✅ Bon ${number} enregistré`;
  if(window.ST?.toast) ST.toast(msg,'success');
  else alert(msg);

  /* Incrémenter le numéro */
  const next=list.length+1;
  $('repairNumber').value=`BR-${String(next).padStart(3,'0')}`;
}

/* ── CLÔTURER UNE RÉPARATION (solde à encaisser) ── */
window.clotureRepair = function(number){
  const list=JSON.parse(localStorage.getItem('samassa_bons_reparation')||'[]');
  const bon=list.find(x=>x.number===number);
  if(!bon||bon.balance<=0){alert('Aucun solde à encaisser.');return;}

  if(!confirm(`Encaisser le solde de ${money(bon.balance)} pour ${bon.client} ?`)) return;
  bon.status='Terminé';
  bon.cloture=new Date().toISOString();
  localStorage.setItem('samassa_bons_reparation',JSON.stringify(list));

  const caisse=JSON.parse(localStorage.getItem('samassa_mouvements')||'[]');
  caisse.push({
    id:'BRC-'+Date.now(), date:today(), type:'entree',
    desc:`Solde réparation ${number} — ${bon.client} (${bon.device?.type||''})`,
    amount:bon.balance, pm:'Espèces', cat:'Réparation clôturée',
    auto:true, timestamp:new Date().toISOString()
  });
  localStorage.setItem('samassa_mouvements', JSON.stringify(caisse));

  if(window.ST?.toast) ST.toast(`✅ Solde ${money(bon.balance)} encaissé — Réparation clôturée`,'success');
};

function shareRepairWhatsApp(){
  if($('docInner').style.display==='none') generateRepair();
  const v=values();
  const msg=`*SAMASSA TECHNOLOGIE*\n_Tout pour l'informatique — Kayes_\n\n🔧 *Bon de Réparation N° ${$('repairNumber').value}*\n\n👤 Client : *${$('clientName').value}*\n📱 Tél : ${$('clientPhone').value||'—'}\n💻 Appareil : ${$('deviceType').value} ${$('deviceModel').value||''}\n\n🔍 Panne : ${$('problem').value||'À diagnostiquer'}\n👨‍🔧 Technicien : ${$('technician').value||'Boussé SAMASSA'}\n📅 Retour prévu : ${dateFr($('returnDate').value)}\n\n💰 *Estimation : ${money(v.total)}*\n${v.advance>0?`✅ Avance reçue : ${money(v.advance)}\n💳 Solde à payer : ${money(v.balance)}\n`:''}\n📞 77 29 19 31 / 62 97 06 30`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
}

document.addEventListener('DOMContentLoaded',()=>{
  const now=new Date();
  $('depositDate').value=now.toISOString().slice(0,10);
  const ret=new Date(now); ret.setDate(ret.getDate()+3);
  $('returnDate').value=ret.toISOString().slice(0,10);
  recalcRepair();
  /* Auto-incrémenter le N° bon */
  const list=JSON.parse(localStorage.getItem('samassa_bons_reparation')||'[]');
  $('repairNumber').value=`BR-${String(list.length+1).padStart(3,'0')}`;
});
