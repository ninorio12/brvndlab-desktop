'use strict'

const { app, BrowserWindow, Notification, ipcMain, session, shell, nativeTheme } = require('electron')
const path = require('node:path')
const { construireMenu } = require('./menu')
const { installerMiseAJour } = require('./maj')
const { siteBase, estInterne, ouvrableDehors, cheminSur, ACCUEIL } = require('./liens')

/* L'application Mac d'AGCI Immobilier.

   Une fenêtre qui affiche le Data OS, et ce que le web ne sait pas faire
   seul sur un Mac : les bannières du système (même quand on est dans une
   autre application), la pastille sur l'icône du Dock, et une mise à jour
   qui se fait toute seule. Le produit vient du réseau : chaque déploiement
   est visible ici sans nouvelle version. */

const FOND_CLAIR = '#ffffff'
const FOND_SOMBRE = '#0f1113'

let fenetre = null
let miseAJour = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => reveiller())
  demarrer()
}

function demarrer () {
  app.whenReady().then(() => {
    nettoyerIdentiteNavigateur()
    miseAJour = installerMiseAJour({ prevenir: envoyerAuRendu })
    creerFenetre()
    construireMenu({
      fenetre: () => fenetre,
      ouvrirChemin,
      verifierMiseAJour: (origine) => miseAJour && miseAJour.verifier(origine),
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
      else reveiller()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

/* Electron ajoute « Electron/33.x » et le nom de l'application à la
   signature du navigateur ; on repart d'un Chrome ordinaire. Être dans
   l'application se dit à NOTRE site par le pont, pas au monde entier. */
function nettoyerIdentiteNavigateur () {
  const brut = session.defaultSession.getUserAgent()
  const propre = brut
    .replace(/ Electron\/[^\s]+/i, '')
    .replace(new RegExp(' ' + app.getName() + '\\/[^\\s]+', 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  session.defaultSession.setUserAgent(propre)
}

function creerFenetre () {
  const mac = process.platform === 'darwin'
  fenetre = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 620,
    title: 'AGCI',
    backgroundColor: nativeTheme.shouldUseDarkColors ? FOND_SOMBRE : FOND_CLAIR,
    show: false,
    autoHideMenuBar: !mac,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      /* La fenêtre ne s'endort pas en arrière-plan : c'est la connexion
         temps réel qui apporte les notifications, elle doit rester éveillée
         quand on travaille ailleurs. */
      backgroundThrottling: false,
      additionalArguments: [
        '--agci-version=' + app.getVersion(),
        '--agci-os=' + (mac ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'),
      ],
    },
  })

  fenetre.once('ready-to-show', () => fenetre.show())

  /* Sonde de vérification sans écran (AGCI_DIAG=1) : prouve que la fenêtre
     s'ouvre et que le produit se charge, au lieu de le supposer. */
  if (process.env.AGCI_DIAG === '1') {
    fenetre.webContents.on('did-finish-load', async () => {
      const etat = await fenetre.webContents.executeJavaScript(
        'JSON.stringify({ titre: document.title, adresse: location.href, bureau: document.documentElement.getAttribute("data-bureau"), pont: typeof window.agci })',
      )
      console.log('[diag] ' + etat)
      app.exit(0)
    })
  }

  // Toute fenêtre secondaire part dehors : l'application n'en a aucune.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (estInterne(url)) { fenetre.loadURL(url); return { action: 'deny' } }
    ouvrirDehors(url)
    return { action: 'deny' }
  })

  fenetre.webContents.on('will-navigate', (e, url) => {
    if (estInterne(url)) return
    e.preventDefault()
    ouvrirDehors(url)
  })

  /* Une fenêtre figée se voit et se répare. */
  fenetre.webContents.on('unresponsive', () => {
    if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.reload()
  })
  app.on('child-process-gone', (_e, details) => {
    if (details.type === 'GPU' && fenetre && !fenetre.isDestroyed()) fenetre.webContents.reload()
  })

  fenetre.webContents.on('did-fail-load', (_e, code, _desc, url, principal) => {
    if (!principal || code === -3) return
    if (url && url.startsWith('file:')) return
    afficherHorsLigne()
  })
  fenetre.webContents.on('render-process-gone', () => afficherHorsLigne())
  fenetre.on('closed', () => { fenetre = null })

  nativeTheme.themeSource = 'system'
  fenetre.loadURL(new URL(ACCUEIL, siteBase()).toString())
}

function afficherHorsLigne () {
  if (!fenetre) return
  fenetre.loadFile(path.join(__dirname, 'hors-ligne.html'))
  if (!fenetre.isVisible()) fenetre.show()
}

function reveiller () {
  if (!fenetre) { creerFenetre(); return }
  if (fenetre.isMinimized()) fenetre.restore()
  fenetre.show()
  fenetre.focus()
}

function ouvrirDehors (url) {
  if (!ouvrableDehors(url)) return
  shell.openExternal(url)
}

/** Emmène la fenêtre sur un chemin du produit (toujours sur notre domaine). */
function ouvrirChemin (chemin) {
  if (!fenetre) { creerFenetre() }
  const cible = new URL(cheminSur(chemin), siteBase()).toString()
  fenetre.loadURL(cible)
  reveiller()
}

function envoyerAuRendu (message) {
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('agci:bureau', message)
}

/* ─── PONT AVEC LA PAGE ─────────────────────────────────────────────────── */
ipcMain.on('agci:reessayer', () => {
  if (fenetre) fenetre.loadURL(new URL(ACCUEIL, siteBase()).toString())
})
ipcMain.on('agci:redemarrer-pour-maj', () => {
  if (miseAJour) miseAJour.redemarrer()
})
ipcMain.on('agci:ouvrir-dehors', (_e, url) => {
  if (typeof url === 'string') ouvrirDehors(url)
})

/* ─── LES BANNIÈRES DU SYSTÈME ──────────────────────────────────────────────
   La page dit ce qu'elle veut annoncer, le processus principal le demande à
   macOS. Pas de service worker, pas de permission web : rien ne peut échouer
   en silence entre les deux. macOS n'affiche ces bannières que pour une
   application signée : elle l'est (Developer ID, notarisée). Le clic ramène
   la fenêtre et ouvre le module concerné. Un refus repart vers la page, qui
   se rabat alors sur sa bannière interne. */
function poserBanniere (charge) {
  const titre = String((charge && charge.titre) || '').slice(0, 120)
  const corps = String((charge && charge.corps) || '').slice(0, 220)
  const lien = charge && typeof charge.lien === 'string' ? charge.lien : null
  if (!titre) return { pose: false, raison: 'titre vide' }
  if (!Notification.isSupported()) return { pose: false, raison: 'systeme sans bannieres' }
  try {
    const n = new Notification({
      title: titre,
      body: corps,
      silent: false,
      ...(charge && charge.etiquette ? { tag: String(charge.etiquette).slice(0, 80) } : {}),
    })
    n.on('click', () => {
      reveiller()
      if (app.dock && typeof app.dock.show === 'function') app.dock.show()
      if (lien) ouvrirChemin(lien)
    })
    n.on('failed', (_e, erreur) => envoyerAuRendu({ type: 'banniere-refusee', erreur: String(erreur || '') }))
    n.show()
    return { pose: true }
  } catch (e) {
    return { pose: false, raison: String((e && e.message) || e) }
  }
}

ipcMain.handle('agci:notifier', (_e, charge) => poserBanniere(charge))

/* La pastille du Dock : le nombre de notifications non lues. */
ipcMain.on('agci:pastille', (_e, n) => {
  const nombre = Number(n)
  if (!Number.isFinite(nombre) || nombre < 0) return
  if (process.platform !== 'darwin') return
  try { app.setBadgeCount(Math.round(nombre)) } catch { /* pastille indisponible */ }
})
