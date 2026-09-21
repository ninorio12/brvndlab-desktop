'use strict'

const { app } = require('electron')

/**
 * LA MISE À JOUR, SANS JAMAIS COUPER QUELQU'UN EN PLEIN TRAVAIL.
 *
 * Trois règles, dans cet ordre :
 *   1. le téléchargement se fait en fond, sans rien demander ni rien afficher ;
 *   2. l'installation attend la fermeture de l'application (autoInstallOnAppQuit) ;
 *   3. quand la version est prête, on le dit une fois, discrètement, et on
 *      laisse le choix de redémarrer tout de suite. On ne redémarre jamais
 *      soi-même : quelqu'un est peut-être en train d'écrire.
 *
 * Tant que l'application n'est pas empaquetée (npm start), ou tant qu'aucune
 * publication n'est configurée, tout ceci est volontairement inerte : on ne
 * cherche pas une mise à jour qui n'existe pas et on n'affiche aucune erreur.
 */

const QUATRE_HEURES = 4 * 60 * 60 * 1000

function installerMiseAJour ({ prevenir }) {
  let autoUpdater = null
  let prete = false

  try {
    ({ autoUpdater } = require('electron-updater'))
  } catch {
    // La dépendance manque (dossier desktop pas encore installé) : on continue
    // sans mise à jour plutôt que d'empêcher l'application de démarrer.
    return { verifier: () => {}, estPrete: () => false, redemarrer: () => {} }
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('update-downloaded', (info) => {
    prete = true
    prevenir({ type: 'maj-prete', version: info && info.version ? info.version : null })
  })
  autoUpdater.on('error', () => {
    // Silence volontaire : un serveur de publication injoignable ne doit pas
    // produire de fenêtre d'erreur chez un utilisateur qui n'a rien demandé.
  })

  function verifier (origine) {
    // En développement, electron-updater refuse de fonctionner et lève. On ne
    // tente donc rien, sauf demande explicite depuis le menu (utile pour tester
    // la chaîne sur une version empaquetée).
    if (!app.isPackaged && origine !== 'menu') return
    try {
      const p = autoUpdater.checkForUpdates()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch {
      /* pas de configuration de publication : rien à faire */
    }
  }

  // Premier contrôle 20 secondes après le démarrage (l'ouverture de l'app ne
  // doit pas se battre avec un téléchargement), puis toutes les quatre heures.
  setTimeout(() => verifier('demarrage'), 20 * 1000)
  setInterval(() => verifier('periodique'), QUATRE_HEURES)

  return {
    verifier,
    estPrete: () => prete,
    redemarrer: () => {
      if (!prete) return
      // isSilent = true, isForceRunAfter = true : l'installateur Windows ne
      // pose aucune question et l'application revient d'elle-même.
      try { autoUpdater.quitAndInstall(true, true) } catch { /* rien de mieux à faire */ }
    },
  }
}

module.exports = { installerMiseAJour }
