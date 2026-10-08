/**
 * SAMASSA TECHNOLOGIE — intégration cloud sécurisée.
 * Les secrets sont conservés côté serveur dans les variables Vercel.
 */
const CLOUD_CONFIG = { apiUrl: '/api/save-document', timeout: 10000 };

async function saveDocumentToCloud(documentData) {
  try {
    if (!documentData?.documentNumber || !documentData?.documentType || !documentData?.clientName || documentData.totalAmount === undefined) {
      throw new Error('Données du document incomplètes');
    }
    showCloudSaveIndicator('Sauvegarde en cours...', 'loading');
    const response = await fetch(CLOUD_CONFIG.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: {
        documentNumber: String(documentData.documentNumber), documentType: String(documentData.documentType),
        clientName: String(documentData.clientName), clientPhone: documentData.clientPhone ? String(documentData.clientPhone) : undefined,
        clientAddress: documentData.clientAddress ? String(documentData.clientAddress) : undefined,
        totalAmount: Number(documentData.totalAmount), taxAmount: Number(documentData.taxAmount || 0),
        paymentStatus: documentData.paymentStatus || 'impayé', paymentMethod: documentData.paymentMethod ? String(documentData.paymentMethod) : undefined,
        description: documentData.description ? String(documentData.description) : undefined, items: Array.isArray(documentData.items) ? documentData.items : undefined
      } }), signal: AbortSignal.timeout(CLOUD_CONFIG.timeout)
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.message || result.error || `Erreur HTTP: ${response.status}`);
    showCloudSaveIndicator(`✓ Document sauvegardé: ${documentData.documentNumber}`, 'success');
    return result;
  } catch (error) {
    console.error('Erreur cloud:', error);
    showCloudSaveIndicator(`✗ Erreur: ${error.message}`, 'error');
    throw error;
  }
}

function showCloudSaveIndicator(message, type = 'info') {
  let indicator = document.getElementById('cloud-save-indicator');
  if (!indicator) { indicator = document.createElement('div'); indicator.id = 'cloud-save-indicator'; document.body.appendChild(indicator); }
  indicator.textContent = message;
  indicator.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:6px;font:500 14px Arial,sans-serif;z-index:10000;box-shadow:0 2px 8px rgba(0,0,0,.15);background:' + ({loading:'#3b82f6',success:'#10b981',error:'#ef4444',info:'#6b7280'}[type] || '#6b7280') + ';color:#fff';
  if (type !== 'loading') setTimeout(() => indicator?.remove(), 5000);
}

function autoSaveDocument(documentType, formData) {
  return saveDocumentToCloud({
    documentNumber: formData.documentNumber || `${documentType.toUpperCase()}-${Date.now()}`,
    documentType, clientName: formData.clientName || formData.nomClient || '', clientPhone: formData.clientPhone || formData.telephone || '',
    clientAddress: formData.clientAddress || formData.adresse || '', totalAmount: parseFloat(formData.totalAmount || formData.montantTotal || 0),
    taxAmount: parseFloat(formData.taxAmount || formData.montantTVA || 0), paymentStatus: formData.paymentStatus || 'impayé',
    paymentMethod: formData.paymentMethod || '', description: formData.description || '', items: formData.items || []
  });
}
window.CloudIntegration = { saveDocumentToCloud, autoSaveDocument, config: CLOUD_CONFIG };
