# Intégration iLoveAPI — SAMASSA TECHNOLOGIE

## Architecture

L’intégration utilise un proxy serveur Vercel. Le navigateur ne reçoit jamais la clé iLoveAPI. Il envoie uniquement le jeton Firebase de l’utilisateur connecté aux routes `/api/iloveapi`.

Le backend exécute le flux iLoveAPI en quatre étapes : création de tâche, upload des fichiers, traitement, puis téléchargement du résultat. Le module partagé est `api/iloveapi-service.js` et la route publique contrôlée est `api/iloveapi.js`.

Les outils disponibles comprennent les traitements PDF (`compress`, `merge`, `split`, `pdfjpg`, `imagepdf`, `officepdf`, `pdfocr`, `rotate`, `watermark`, `protect`, `unlock`, `repair`) et les traitements image (`compressimage`, `convertimage`, `resizeimage`, `rotateimage`, `upscaleimage`, `removebackgroundimage`).

## Variables d’environnement Vercel

Configurer ces variables dans le projet Vercel, pour les environnements Preview et Production :

```text
ILOVEAPI_PUBLIC_KEY=identifiant_public_du_projet_iloveapi
FIREBASE_WEB_API_KEY=clé_web_firebase
FIREBASE_DATABASE_URL=https://samassa-kayes-79fbb-default-rtdb.europe-west1.firebasedatabase.app
FIREBASE_STORE_ID=kayes-principal
```

`ILOVEAPI_PUBLIC_KEY` est utilisé côté serveur pour obtenir un jeton court auprès de l’endpoint `/auth`. Ne jamais placer la clé secrète iLoveAPI dans un fichier frontend, un dépôt Git ou une variable `NEXT_PUBLIC_*`. Si une clé secrète est utilisée ultérieurement pour la signature JWT côté serveur, elle doit rester dans une variable Vercel privée.

## Routes

### Créer une tâche

```http
POST /api/iloveapi?action=start
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"tool":"compress","region":"eu"}
```

La réponse contient `server`, `task` et le nombre de crédits restants communiqué par iLoveAPI.

### Envoyer un fichier

```http
POST /api/iloveapi?action=upload
Authorization: Bearer <firebase-id-token>
Content-Type: multipart/form-data
```

Le formulaire doit contenir `task`, `server` et `file`. Les champs facultatifs `chunk` et `chunks` sont acceptés pour les uploads découpés. La limite applicative est de 25 Mo par fichier et 10 fichiers par traitement.

### Lancer le traitement

```http
POST /api/iloveapi?action=process
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "task":"<task>",
  "server":"api11.ilovepdf.com",
  "tool":"compress",
  "files":[
    {"server_filename":"<nom_retourne_par_upload>","filename":"document.pdf"}
  ]
}
```

Les options communes prises en charge par la route sont `ignore_password`, `ignore_errors`, `try_pdf_repair`, `output_filename`, `packaged_filename`, `ranges` et `pages`. Les paramètres de fichier `rotate`, `password` et `meta` sont également filtrés côté serveur.

### Télécharger le résultat

```http
GET /api/iloveapi?action=download&server=api11.ilovepdf.com&task=<task>
Authorization: Bearer <firebase-id-token>
```

La réponse est binaire et conserve le type MIME et le nom de fichier fournis par iLoveAPI. Le résultat n’est pas mis en cache.

## Sécurité et erreurs

Chaque route exige une session Firebase valide. Le backend vérifie ensuite le rôle stocké dans `user_roles`. Les rôles actuels autorisés sont administrateur, caissier, technicien et responsable stock.

Les serveurs iLoveAPI sont contrôlés par une allowlist de domaines `*.ilovepdf.com`, les outils et les régions sont vérifiés, et les valeurs de tâche et de fichiers sont limitées avant transmission. Les fichiers temporaires sont transmis directement à iLoveAPI et ne sont pas enregistrés dans Firebase ou sur le disque de l’application.

Les erreurs sont retournées sous cette forme :

```json
{
  "success": false,
  "error": {
    "code": "ILOVE_PROCESS_ERROR",
    "message": "Description exploitable",
    "upstream_status": 400
  }
}
```

Les erreurs 401 indiquent une session Firebase absente ou expirée. Une erreur 403 indique un rôle absent, invalide ou désactivé. Une erreur 413 indique une limite de fichier ou de requête dépassée. Une erreur 429 est relayée lorsqu’iLoveAPI demande de ralentir les requêtes. Une erreur 503 indique généralement une variable d’environnement manquante.

## Interface

La page `/iloveapi.html` est ajoutée au tableau de bord dans la section des outils et est accessible aux quatre rôles opérationnels. Elle lance automatiquement le flux start → upload → process → download et propose un retour direct au tableau de bord.

## Références officielles

- [Référence REST iLoveAPI](https://www.iloveapi.com/docs/api-reference)
- [Guide de traitement PDF](https://www.iloveapi.com/docs/pdf-guides/common)
- [Guide de traitement des images](https://www.iloveapi.com/docs/image-guides/common)
- [Gestion des erreurs](https://www.iloveapi.com/docs/pdf-guides/error-handling)
- [Bibliothèque Node.js officielle](https://github.com/ilovepdf/ilovepdf-nodejs)
