/* Adaptateur CamScanner — SAMASSA TECHNOLOGIE
 * Le service distant est volontairement configurable uniquement côté serveur.
 * Variables attendues : CAMSCANNER_API_URL et CAMSCANNER_API_TOKEN.
 */
'use strict';
const allowedOrigin = 'https://samassa-technologie-app-2.vercel.app';
const cors = (req,res) => { res.setHeader('Access-Control-Allow-Origin', allowedOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization'); };
module.exports = async (req,res) => { cors(req,res); if(req.method==='OPTIONS')return res.status(204).end(); if(req.method!=='POST')return res.status(405).json({ok:false,message:'Méthode non autorisée.'}); if(!process.env.CAMSCANNER_API_URL)return res.status(503).json({ok:false,message:'Le service CamScanner n’est pas encore configuré. Utilisez le traitement local.'}); try{const contentType=req.headers['content-type']||''; if(!contentType.includes('multipart/form-data'))return res.status(400).json({ok:false,message:'Un fichier image est requis.'}); return res.status(501).json({ok:false,message:'Le connecteur CamScanner est prêt mais son endpoint de traitement doit être renseigné côté serveur.'});}catch(e){return res.status(500).json({ok:false,message:'Erreur du connecteur CamScanner.'});} };
