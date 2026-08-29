'use strict'

const { app, Menu, shell } = require('electron')

/**
 * LE MENU DE L'APPLICATION, EN FRANÇAIS.
 *
 * Electron pose par défaut un menu en anglais avec des entrées de développeur
 * en évidence. Ici : les gestes que tout le monde connaît (copier, coller,
 * rechercher, zoomer, plein écran), nommés comme dans le reste de Brvndlab, et
 * les outils de développement rangés dans « Affichage » sans raccourci qui
 * s'ouvre par accident.
 */
function construireMenu ({ fenetre, ouvrirChemin, verifierMiseAJour }) {
  const mac = process.platform === 'darwin'

  const menuApplication = {
    label: 'Brvndlab',
    submenu: [
      { role: 'about', label: 'À propos de Brvndlab' },
      {
        label: 'Rechercher une mise à jour',
        click: () => { verifierMiseAJour('menu') },
      },
      { type: 'separator' },
      { role: 'services', label: 'Services' },
      { type: 'separator' },
      { role: 'hide', label: 'Masquer Brvndlab' },
      { role: 'hideOthers', label: 'Masquer les autres' },
      { role: 'unhide', label: 'Tout afficher' },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter Brvndlab' },
    ],
  }

  const menuFichier = {
    label: 'Fichier',
    submenu: [
      {
        label: 'Accueil',
        accelerator: 'CmdOrCtrl+Shift+H',
        click: () => ouvrirChemin('/home'),
      },
      {
        // Le bouton « Créer un contenu » de l'en-tête mène ici : le menu vise la
        // même route réelle, jamais une route inventée pour faire joli.
        label: 'Créer un contenu',
        accelerator: 'CmdOrCtrl+N',
        click: () => ouvrirChemin('/brainstorming'),
      },
      { type: 'separator' },
      mac
        ? { role: 'close', label: 'Fermer la fenêtre' }
        : {
            label: 'Rechercher une mise à jour',
            click: () => { verifierMiseAJour('menu') },
          },
      mac ? { type: 'separator' } : { role: 'quit', label: 'Quitter' },
    ].filter(Boolean),
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
      {
        label: 'Outils de développement',
        // Volontairement SANS raccourci : sur un clavier français, les combinaisons
        // habituelles tombent sous les doigts et ouvraient l'inspecteur en pleine
        // session. On garde l'entrée de menu, c'est suffisant pour nous.
        click: () => { if (fenetre()) fenetre().webContents.toggleDevTools() },
      },
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
      {
        label: 'Ouvrir Brvndlab dans le navigateur',
        click: () => shell.openExternal('https://app.brvndlab.com'),
      },
      {
        label: 'Nous écrire',
        click: () => shell.openExternal('mailto:hey@brvndlab.com'),
      },
      { type: 'separator' },
      { label: `Version ${app.getVersion()}`, enabled: false },
    ],
  }

  const modele = [
    ...(mac ? [menuApplication] : []),
    menuFichier,
    menuEdition,
    menuAffichage,
    menuFenetre,
    menuAide,
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(modele))
}

module.exports = { construireMenu }
