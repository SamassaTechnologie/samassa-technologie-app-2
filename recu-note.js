/* Note pour le client : suggestions rapides + compteur */
(function(){
  var n=document.getElementById('rdvNote'); if(!n) return;
  var S=['Apportez votre ancienne carte','Présentez ce reçu au retrait','Venez avec une pièce d\u2019identité','Reçu à conserver jusqu\u2019au retrait'];
  var c=document.getElementById('rdvNoteChips'), k=document.getElementById('rdvNoteCount');
  function maj(){ k.textContent=n.value.length+'/140'; }
  S.forEach(function(t){var b=document.createElement('button');b.type='button';b.textContent=t;
    b.style.cssText='background:#EEF4FA;border:1px solid #C8D8EA;border-radius:99px;padding:4px 10px;font-size:11px;font-weight:700;color:#0A1628;cursor:pointer;font-family:inherit';
    b.addEventListener('click',function(){n.value=n.value&&n.value.indexOf(t)<0?(n.value+' - '+t).slice(0,140):t;maj();n.dispatchEvent(new Event('input',{bubbles:true}));});c.appendChild(b);});
  n.addEventListener('input',maj); maj();
})();
