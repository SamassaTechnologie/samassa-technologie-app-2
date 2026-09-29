/**
 * SAMASSA TECHNOLOGIE - Cloud Integration
 * 
 * Ce script permet à votre suite HTML de sauvegarder automatiquement
 * les documents générés (factures, reçus, devis, interventions) 
 * dans le cloud SAMASSA TECHNOLOGIE.
 * 
 * Usage:
 * 1. Incluez ce script dans votre HTML : <script src="cloud-integration.js"></script>
 * 2. Après avoir généré un document, appelez : saveDocumentToCloud(documentData)
 */

// Configuration
const CLOUD_CONFIG = {
  apiUrl: "https://samassacloud-kffmkg4t.manus.space/api/trpc/apiSave.saveDocument",
  apiKey: "samassa-api-key-secure-2026",
  timeout: 10000, // 10 secondes
};

/**
 * Fonction principale pour sauvegarder un document dans le cloud
 * 
 * @param {Object} documentData - Les données du document à sauvegarder
 * @param {string} documentData.documentNumber - Numéro du document (ex: "FACT-001")
 * @param {string} documentData.documentType - Type: "facture", "recu", "devis", "intervention"
 * @param {string} documentData.clientName - Nom du client
 * @param {string} [documentData.clientPhone] - Téléphone du client
 * @param {string} [documentData.clientAddress] - Adresse du client
 * @param {number} documentData.totalAmount - Montant total
 * @param {number} [documentData.taxAmount] - Montant de la TVA
 * @param {string} [documentData.paymentStatus] - Statut: "payé", "impayé", "acompte"
 * @param {string} [documentData.paymentMethod] - Méthode de paiement
 * @param {string} [documentData.description] - Description
 * @param {Array} [documentData.items] - Articles du document
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
async function saveDocumentToCloud(documentData) {
  try {
    // Validation des données requises
    if (!documentData.documentNumber) {
      throw new Error("Le numéro du document est requis");
    }
    if (!documentData.documentType) {
      throw new Error("Le type de document est requis");
    }
    if (!documentData.clientName) {
      throw new Error("Le nom du client est requis");
    }
    if (documentData.totalAmount === undefined) {
      throw new Error("Le montant total est requis");
    }

    // Afficher un indicateur de chargement
    showCloudSaveIndicator("Sauvegarde en cours...", "loading");

    // Préparer les données pour l'API
    const payload = {
      apiKey: CLOUD_CONFIG.apiKey,
      document: {
        documentNumber: String(documentData.documentNumber),
        documentType: documentData.documentType,
        clientName: String(documentData.clientName),
        clientPhone: documentData.clientPhone ? String(documentData.clientPhone) : undefined,
        clientAddress: documentData.clientAddress ? String(documentData.clientAddress) : undefined,
        totalAmount: Number(documentData.totalAmount),
        taxAmount: documentData.taxAmount ? Number(documentData.taxAmount) : 0,
        paymentStatus: documentData.paymentStatus || "impayé",
        paymentMethod: documentData.paymentMethod ? String(documentData.paymentMethod) : undefined,
        description: documentData.description ? String(documentData.description) : undefined,
        items: documentData.items || undefined,
      },
    };

    // Envoyer la requête au cloud
    const response = await fetch(CLOUD_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        json: payload,
      }),
      signal: AbortSignal.timeout(CLOUD_CONFIG.timeout),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();

    // Vérifier si la réponse contient une erreur tRPC
    if (result.error) {
      throw new Error(result.error.message || "Erreur lors de la sauvegarde");
    }

    // Succès
    showCloudSaveIndicator(
      `✓ Document sauvegardé: ${documentData.documentNumber}`,
      "success"
    );

    console.log("Document sauvegardé avec succès:", result);
    return result;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du document:", error);
    showCloudSaveIndicator(
      `✗ Erreur: ${error.message}`,
      "error"
    );
    throw error;
  }
}

/**
 * Affiche un indicateur visuel de la sauvegarde
 * 
 * @param {string} message - Message à afficher
 * @param {string} type - Type: "loading", "success", "error"
 */
function showCloudSaveIndicator(message, type = "info") {
  // Créer ou mettre à jour l'indicateur
  let indicator = document.getElementById("cloud-save-indicator");
  
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "cloud-save-indicator";
    document.body.appendChild(indicator);
  }

  // Appliquer les styles
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `;

  // Appliquer les couleurs selon le type
  switch (type) {
    case "loading":
      indicator.style.backgroundColor = "#3b82f6";
      indicator.style.color = "#ffffff";
      break;
    case "success":
      indicator.style.backgroundColor = "#10b981";
      indicator.style.color = "#ffffff";
      break;
    case "error":
      indicator.style.backgroundColor = "#ef4444";
      indicator.style.color = "#ffffff";
      break;
    default:
      indicator.style.backgroundColor = "#6b7280";
      indicator.style.color = "#ffffff";
  }

  indicator.textContent = message;

  // Masquer automatiquement après 5 secondes (sauf si loading)
  if (type !== "loading") {
    setTimeout(() => {
      indicator.style.opacity = "0";
      indicator.style.transition = "opacity 0.3s ease-out";
      setTimeout(() => {
        indicator.remove();
      }, 300);
    }, 5000);
  }
}

/**
 * Ajouter une animation CSS pour l'indicateur
 */
if (!document.getElementById("cloud-save-styles")) {
  const style = document.createElement("style");
  style.id = "cloud-save-styles";
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Fonction utilitaire pour sauvegarder automatiquement après génération
 * 
 * Appelez cette fonction après avoir généré un document HTML
 * 
 * @param {string} documentType - Type de document
 * @param {Object} formData - Données du formulaire
 */
function autoSaveDocument(documentType, formData) {
  // Extraire les données du formulaire
  const documentData = {
    documentNumber: formData.documentNumber || `${documentType.toUpperCase()}-${Date.now()}`,
    documentType: documentType,
    clientName: formData.clientName || formData.nomClient || "",
    clientPhone: formData.clientPhone || formData.telephone || "",
    clientAddress: formData.clientAddress || formData.adresse || "",
    totalAmount: parseFloat(formData.totalAmount || formData.montantTotal || 0),
    taxAmount: parseFloat(formData.taxAmount || formData.montantTVA || 0),
    paymentStatus: formData.paymentStatus || "impayé",
    paymentMethod: formData.paymentMethod || "",
    description: formData.description || "",
    items: formData.items || [],
  };

  // Sauvegarder dans le cloud
  return saveDocumentToCloud(documentData);
}

// Exporter les fonctions pour utilisation globale
window.CloudIntegration = {
  saveDocumentToCloud,
  autoSaveDocument,
  config: CLOUD_CONFIG,
};

console.log("✓ SAMASSA TECHNOLOGIE Cloud Integration chargé avec succès");
console.log("Utilisez: CloudIntegration.saveDocumentToCloud(documentData)");
