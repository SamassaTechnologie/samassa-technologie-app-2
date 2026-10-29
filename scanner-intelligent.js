/* SAMASSA TECHNOLOGIE — Scanner intelligent */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fileInput = $('scan-file'), preview = $('scan-preview'), empty = $('preview-empty'), status = $('status');
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let image = null, currentFile = null;
  const setStatus = (message, type='info') => { status.textContent = message; status.className = `status show ${type}`; };
  const setEnabled = enabled => ['enhance-btn','pdf-btn','ocr-btn'].forEach(id => $(id).disabled = !enabled);
  const readImage = file => new Promise((resolve,reject) => { const url=URL.createObjectURL(file); const img=new Image(); img.onload=()=>{URL.revokeObjectURL(url);resolve(img)}; img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image illisible'))}; img.src=url; });
  const loadFile = async file => { if(!file)return; if(!/^image\/(jpeg|png|jpg)$/.test(file.type) || file.size>20*1024*1024){setStatus('Choisissez une image JPG ou PNG de 20 Mo maximum.','error');return;} try{currentFile=file;image=await readImage(file);preview.src=URL.createObjectURL(file);preview.hidden=false;empty.hidden=true;setEnabled(true);setStatus(`Document chargé : ${file.name}`,'success');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','import d’image','success',{size:file.size});}catch(e){setStatus(e.message,'error');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','import d’image','error');} };
  const renderProcessed = () => { if(!image)return null; const max=2400, ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)); canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);ctx.filter='none';ctx.drawImage(image,0,0,canvas.width,canvas.height); const mode=$('enhance-mode').value; if(mode!=='original'){const data=ctx.getImageData(0,0,canvas.width,canvas.height), p=data.data; for(let i=0;i<p.length;i+=4){let r=p[i],g=p[i+1],b=p[i+2]; if(mode==='gray'){const y=.299*r+.587*g+.114*b;p[i]=p[i+1]=p[i+2]=y;} else if(mode==='bw'){const y=(.299*r+.587*g+.114*b)>170?255:0;p[i]=p[i+1]=p[i+2]=y;} else if(mode==='contrast'){const f=1.35;p[i]=Math.max(0,Math.min(255,(r-128)*f+128));p[i+1]=Math.max(0,Math.min(255,(g-128)*f+128));p[i+2]=Math.max(0,Math.min(255,(b-128)*f+128));}}ctx.putImageData(data,0,0);} return canvas; };
  const canvasBlob = (quality=.88) => new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  const enhance = async () => { if(!image)return; renderProcessed(); const blob=await canvasBlob(.9); preview.src=URL.createObjectURL(blob);setStatus('Image améliorée et prête à être exportée.','success');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','amélioration d’image','success',{mode:$('enhance-mode').value}); };
  const createPdf = async () => {
    if(!image)return;
    try {
      renderProcessed();
      const blob=await canvasBlob(Number($('pdf-quality').value));
      const bytes=new Uint8Array(await blob.arrayBuffer());
      const w=canvas.width,h=canvas.height;
      const stream=`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ`;
      const objects=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
      let parts=[], offsets=[0], total=0;
      const enc=new TextEncoder();
      const pushText=text=>{const b=enc.encode(text);parts.push(b);total+=b.length;};
      const add=(n,text)=>{offsets[n]=total;pushText(`${n} 0 obj\n${text}\nendobj\n`);};
      pushText('%PDF-1.4\n'); add(1,objects[0]);add(2,objects[1]);add(3,objects[2]);add(4,objects[3]);
      offsets[5]=total;pushText(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);parts.push(bytes);total+=bytes.length;pushText('\nendstream\nendobj\n');
      const xref=total;let tail=`xref\n0 6\n0000000000 65535 f \n`;for(let i=1;i<=5;i++)tail+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';tail+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;pushText(tail);
      const out=new Uint8Array(total);let at=0;for(const part of parts){out.set(part,at);at+=part.length;}
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out],{type:'application/pdf'}));a.download=(currentFile?.name||'document').replace(/\.[^.]+$/,'')+'.pdf';a.click();setStatus('PDF créé et téléchargé.','success');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','création PDF','success',{mode:$('enhance-mode').value});
    } catch(e) { setStatus('Impossible de créer le PDF : '+e.message,'error');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','création PDF','error'); }
  };
  const ocr = async () => { if(!image)return; try{setStatus('Chargement du moteur OCR…','info'); if(!window.Tesseract){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Moteur OCR indisponible'));document.head.appendChild(s);});} renderProcessed();const worker=await Tesseract.createWorker('fra+eng',1,{logger:m=>{if(m.status==='recognizing text')setStatus(`OCR en cours : ${Math.round((m.progress||0)*100)} %`,'info')}});const result=await worker.recognize(canvas);await worker.terminate();$('ocr-output').value=result.data.text.trim()||'Aucun texte détecté.';setStatus('OCR terminé. Vérifiez le texte avant utilisation.','success');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','OCR local','success');}catch(e){setStatus('OCR indisponible : '+e.message,'error');if(window.SAMASSA_ANALYTICS)SAMASSA_ANALYTICS.track('scanner','OCR local','error');} };
  fileInput.addEventListener('change',e=>loadFile(e.target.files[0]));$('camera-btn').onclick=()=>fileInput.click();$('clear-btn').onclick=()=>{fileInput.value='';image=null;currentFile=null;preview.hidden=true;empty.hidden=false;$('ocr-output').value='';setEnabled(false);status.className='status';};$('enhance-btn').onclick=enhance;$('pdf-btn').onclick=createPdf;$('ocr-btn').onclick=ocr;$('copy-btn').onclick=async()=>{try{await navigator.clipboard.writeText($('ocr-output').value);setStatus('Texte copié dans le presse-papiers.','success');}catch{setStatus('Copie impossible sur cet appareil.','error')}};$('writer-btn').onclick=()=>{localStorage.setItem('samassa_scanner_ocr',$('ocr-output').value);window.location.href='redacteur-ia-mali/index.html?from=scanner';};
})();
