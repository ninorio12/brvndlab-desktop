'use strict'

const { app, Menu, shell } = require('electron')

/* Le menu de l'application, en français, avec les gestes que tout le monde
   connaît. Les outils de développement sont rangés sans raccourci. */
function construireMenu ({ fenetre, ouvrirChemin, verifierMiseAJour }) {
  const mac = process.platform === 'darwin'

  const menuApplication = {
    label: 'AGCI',
    submenu: [
      { role: 'about', label: 'À propos d’AGCI' },
      { label: 'Rechercher une mise à jour', click: () => { verifierMiseAJour('menu') } },
      { type: 'separator' },
      { role: 'services', label: 'Services' },
      { type: 'separator' },
      { role: 'hide', label: 'Masquer AGCI' },
      { role: 'hideOthers', label: 'Masquer les autres' },
      { role: 'unhide', label: 'Tout afficher' },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter AGCI' },
    ],
  }

  const menuFichier = {
    label: 'Fichier',
    submenu: [
      { label: 'Vue d’ensemble', accelerator: 'CmdOrCtrl+Shift+H', click: () => ouvrirChemin('/modules/vue-ensemble') },
      { label: 'Tâches', accelerator: 'CmdOrCtrl+1', click: () => ouvrirChemin('/modules/taches') },
      { label: 'Pipeline', accelerator: 'CmdOrCtrl+2', click: () => ouvrirChemin('/modules/pipeline') },
      { label: 'Contacts', accelerator: 'CmdOrCtrl+3', click: () => ouvrirChemin('/modules/contacts') },
      { label: 'Calendrier', accelerator: 'CmdOrCtrl+4', click: () => ouvrirChemin('/modules/calendrier') },
      { type: 'separator' },
      mac ? { role: 'close', label: 'Fermer la fenêtre' } : { role: 'quit', label: 'Quitter' },
    ],
  }

  const menuEdition = {
    label: 'Édition',
    submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' },
      { role: 'pasteAndMatchStyle', label: 'Coller sans mise en forme' },
      { role: 'delete', label: 'Supprimer' },
      { role: 'selectAll', label: 'Tout sélectionner' },
    ],
  }

  const menuAffichage = {
    label: 'Affichage',
    submenu: [
      { role: 'reload', label: 'Recharger' },
      { role: 'forceReload', label: 'Recharger sans le cache' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Taille normale' },
      { role: 'zoomIn', label: 'Agrandir' },
      { role: 'zoomOut', label: 'Réduire' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' },
      { type: 'separator' },
      { label: 'Outils de développement', click: () => { if (fenetre()) fenetre().webContents.toggleDevTools() } },
    ],
  }

  const menuFenetre = {
    label: 'Fenêtre',
    submenu: mac
      ? [
          { role: 'minimize', label: 'Réduire' },
          { role: 'zoom', label: 'Zoom' },
          { type: 'separator' },
          { role: 'front', label: 'Tout ramener au premier plan' },
        ]
      : [
          { role: 'minimize', label: 'Réduire' },
          { role: 'close', label: 'Fermer' },
        ],
  }

  const menuAide = {
    label: 'Aide',
    submenu: [
      { label: 'Ouvrir dans le navigateur', click: () => shell.openExternal('https://dataos-agci.vercel.app/modules/vue-ensemble') },
      { type: 'separator' },
      { label: `Version ${app.getVersion()}`, enabled: false },
    ],
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [menuApplication] : []),
    menuFichier,
    menuEdition,
    menuAffichage,
    menuFenetre,
    menuAide,
  ]))
}

module.exports = { construireMenu }
