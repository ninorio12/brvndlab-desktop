'use strict'

const { app, BrowserWindow, ipcMain, session, shell, nativeTheme } = require('electron')
const path = require('node:path')
const { construireMenu } = require('./menu')
const { installerMiseAJour } = require('./maj')
const {
  siteBase,
  estInterne,
  ouvrableDehors,
  cheminDepuisProtocole,
  estPageDeConnexionTiers,
  estEcranDeConnexion,
} = require('./liens')

const PROTOCOLE = 'brvndlab'
const FOND = '#0C0C0B' // le noir unique de la charte : la fenêtre ne doit jamais flasher en blanc

let fenetre = null
let miseAJour = null
/** Horodatage du dernier départ vers le navigateur : sert à proposer d'actualiser au retour. */
let attenteRetourNavigateur = 0
/** Chemin reçu par lien brvndlab:// avant que la fenêtre existe (démarrage à froid). */
let cheminAuDemarrage = null

/* ─── UNE SEULE INSTANCE ────────────────────────────────────────────────────
   Sans ce verrou, un double-clic sur l'icône (ou un lien brvndlab:// sous
   Windows) lance un deuxième processus : deux fenêtres, deux sessions, et le
   lien de retour de connexion arrive dans celle qu'on ne regarde pas. */
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    // Sous Windows et Linux, le lien de protocole arrive dans les arguments de
    // la deuxième instance, pas par l'évènement open-url (réservé à macOS).
    const lien = argv.find((a) => a.startsWith(PROTOCOLE + '://'))
    if (lien) suivreLienProtocole(lien)
    reveiller()
  })
  demarrer()
}

function demarrer () {
  // Déclaration du schéma brvndlab:// auprès du système. En développement, il
  // faut lui passer le chemin du projet, sinon le système rappelle Electron sans
  // savoir quelle application ouvrir.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOLE, process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOLE)
  }

  app.on('open-url', (e, url) => {
    e.preventDefault()
    suivreLienProtocole(url)
    reveiller()
  })

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

  // Sur macOS on garde l'application vivante sans fenêtre (comportement natif) ;
  // ailleurs, fermer la fenêtre ferme l'application.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('browser-window-focus', () => {
    // On revient d'une connexion partie dans le navigateur : on ne recharge
    // SURTOUT pas tout seul (un formulaire à moitié rempli serait perdu), on
    // propose. Le délai de 3 secondes évite de proposer au simple aller-retour
    // de fenêtres qui suit immédiatement l'ouverture du navigateur.
    if (!attenteRetourNavigateur) return
    const ecoule = Date.now() - attenteRetourNavigateur
    if (ecoule < 3000 || ecoule > 20 * 60 * 1000) return
    attenteRetourNavigateur = 0
    envoyerAuRendu({ type: 'retour-navigateur' })
  })
}

/* ─── IDENTITÉ DU NAVIGATEUR ────────────────────────────────────────────────
   Electron ajoute « Electron/33.x » et le nom de l'application à la signature
   du navigateur. Certains services (Google en tête) s'en servent pour refuser
   la page, et ça nous désigne inutilement auprès de tous les sites. On repart
   d'un Chrome ordinaire. Le fait d'être dans l'application de bureau se dit à
   NOTRE site par le pont du préchargement, pas au monde entier par l'agent. */
function nettoyerIdentiteNavigateur () {
  const brut = session.defaultSession.getUserAgent()
  const propre = brut
    .replace(/ Electron\/[^\s]+/i, '')
    .replace(new RegExp(' ' + app.getName() + '\\/[^\\s]+', 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  session.defaultSession.setUserAgent(propre)
}


/* PARTIR SE CONNECTER DANS LE NAVIGATEUR, ET REVENIR.
   Google interdit sa page de connexion dans une fenêtre d'application (règle
   « embedded user-agent » de ses politiques OAuth) : sans barre d'adresse,
   personne ne peut vérifier où il tape son mot de passe. On ouvre donc le
   navigateur du système sur notre page de rebond, qui rendra la main à
   l'application par brvndlab://connexion?ticket=… une fois la connexion
   faite. Deux chemins mènent ici : une navigation dans la fenêtre, et une
   fenêtre secondaire ouverte par Clerk. Les deux doivent se comporter
   pareil, sinon l'un des deux laisse la session dans le navigateur. */
function partirSeConnecterDehors () {
  /* AUCUNE BOITE DE DIALOGUE (30/08). On en affichait une, « On finit la
     connexion dans ton navigateur », qu'il fallait fermer à la main en
     revenant. Deux écrans à lire pour un passage d'une seconde, et une
     fenêtre système par-dessus l'application : exactement la friction qu'on
     voulait supprimer. La page de connexion dit déjà ce qu'il faut, à sa
     place et dans la charte. Le navigateur s'ouvre, c'est tout. */
  attenteRetourNavigateur = Date.now()
  shell.openExternal(siteBase() + '/desktop/connexion')
}

function creerFenetre () {
  const mac = process.platform === 'darwin'
  const windows = process.platform === 'win32'

  fenetre = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 620,
    backgroundColor: FOND,
    show: false,
    autoHideMenuBar: !mac,
    /* BARRE DE TITRE MASQUÉE, À LA MANIÈRE DE LINEAR.
       macOS : les trois pastilles restent, posées sur notre page (hiddenInset).
       Windows : les boutons système sont dessinés par le système par-dessus la
       page (titleBarOverlay), sans quoi une fenêtre sans cadre n'a plus aucun
       moyen de se fermer.
       Linux : on garde le cadre standard, les environnements de bureau y sont
       trop divers pour parier sur un dessin maison. */
    titleBarStyle: mac ? 'hiddenInset' : windows ? 'hidden' : 'default',
    trafficLightPosition: mac ? { x: 18, y: 18 } : undefined,
    titleBarOverlay: windows ? habillageBarreWindows('dark') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // Le préchargement est bac-à-sable : il n'a pas accès à `app`. On lui
      // passe donc la version et le système par la ligne de commande, seule
      // voie disponible avant le chargement de la page.
      additionalArguments: [
        '--brvndlab-version=' + app.getVersion(),
        '--brvndlab-os=' + (mac ? 'mac' : windows ? 'windows' : 'linux'),
      ],
      // Pas de partition nommée : la session par défaut d'une application
      // empaquetée est déjà écrite sur disque. C'est ce qui garde la connexion
      // Clerk d'une ouverture à l'autre, sans rien coder de plus.
    },
  })

  // On n'affiche la fenêtre qu'une fois la page prête : sinon on voit un
  // rectangle vide pendant le premier chargement réseau.
  fenetre.once('ready-to-show', () => fenetre.show())

  /* SONDE DE VÉRIFICATION. Sur une machine sans écran (nos serveurs), c'est le
     seul moyen de prouver que la fenêtre s'ouvre vraiment et que le SaaS se
     charge dedans, au lieu de le supposer. Inactive sans BRVNDLAB_DIAG=1. */
  if (process.env.BRVNDLAB_DIAG === '1') {
    fenetre.webContents.on('did-finish-load', async () => {
      const titre = await fenetre.webContents.executeJavaScript(
        'JSON.stringify({ titre: document.title, adresse: location.href, bureau: document.documentElement.getAttribute("data-bureau"), os: document.documentElement.getAttribute("data-bureau-os"), pont: typeof window.brvndlab })',
      )
      console.log('[diag] ' + titre)
      console.log('[diag] agent = ' + (await fenetre.webContents.executeJavaScript('navigator.userAgent')))
      app.exit(0)
    })
  }

  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    /* MÊME TRAITEMENT QUE LA NAVIGATION DIRECTE (30/08). Clerk ouvre parfois
       le fournisseur dans une fenêtre secondaire plutôt qu'en changeant de
       page. Envoyer cette adresse telle quelle dans le navigateur ouvrait
       bien Google, mais la session se créait DANS le navigateur et la fenêtre
       de l'application restait déconnectée : le cul-de-sac qu'on vient de
       supprimer sur l'autre chemin. On passe donc par la même page de rebond,
       qui rend la main à l'application une fois la connexion faite. */
    if (estPageDeConnexionTiers(url) && estEcranDeConnexion(fenetre.webContents.getURL())) {
      partirSeConnecterDehors()
      return { action: 'deny' }
    }
    // Toute autre fenêtre secondaire part dehors : les seules de l'application
    // sont les branchements de comptes (Nango, YouTube, Instagram), justement
    // ceux qu'une fenêtre d'application n'a pas le droit d'afficher.
    ouvrirDehors(url)
    return { action: 'deny' }
  })

  fenetre.webContents.on('will-navigate', (e, url) => {
    if (estInterne(url)) return
    e.preventDefault()

    /* SE CONNECTER PAR GOOGLE OU APPLE : ÇA MARCHE MAINTENANT (30/08).
       Google refuse sa page de connexion dans une fenêtre sans barre
       d'adresse, et il a raison. On ne l'affiche donc toujours pas ici : on
       envoie la personne dans le navigateur du système, sur une page de
       rebond qui, une fois la connexion faite, rend la main à l'application
       par brvndlab://connexion?ticket=… Le jeton ne vaut qu'une minute et
       n'est délivré qu'à celui qui vient de se connecter, pour lui-même.
       Avant, on affichait une excuse et on restait sur place. */
    if (estPageDeConnexionTiers(url) && estEcranDeConnexion(fenetre.webContents.getURL())) {
      partirSeConnecterDehors()
      return
    }

    ouvrirDehors(url)
  })

  fenetre.webContents.on('did-fail-load', (_e, code, _desc, url, principal) => {
    // -3 = navigation annulée (une redirection en chasse une autre) : normal.
    if (!principal || code === -3) return
    if (url && url.startsWith('file:')) return
    afficherHorsLigne()
  })

  // Une page qui plante ne doit pas laisser une fenêtre blanche muette.
  fenetre.webContents.on('render-process-gone', () => afficherHorsLigne())

  fenetre.on('closed', () => { fenetre = null })

  nativeTheme.themeSource = 'system'
  const depart = cheminAuDemarrage
  cheminAuDemarrage = null
  fenetre.loadURL(depart ? new URL(depart, siteBase()).toString() : siteBase())
}

/* SOUS WINDOWS, LES BOUTONS SYSTÈME SONT DESSINÉS PAR WINDOWS.
   Il faut donc leur donner nous-mêmes la couleur du fond, sinon on obtient un
   rectangle noir dans le coin d'une application en thème clair. Le thème étant
   choisi par compte (et pas par le système), c'est la page qui nous le dit :
   le préchargement surveille l'attribut data-bvh-theme et le renvoie ici. */
/** Hauteur de la bande des boutons : celle de l'en-tete, moins deux pixels. */
function hauteurBande (info) {
  const mesuree = typeof info === 'object' && info && Number.isFinite(info.hauteur) ? info.hauteur : null
  if (!mesuree) return 60
  return Math.max(28, Math.min(120, Math.floor(mesuree) - 2))
}

function habillageBarreWindows (info) {
  // Ancienne forme (une simple chaîne) tolérée : une fenêtre déjà ouverte peut
  // encore tourner avec l'ancien préchargement pendant une mise à jour.
  const theme = typeof info === 'string' ? info : info?.theme
  const fond = typeof info === 'string' ? null : info?.fond
  const sombre = theme !== 'light'
  return {
    /* La couleur vient de la PAGE, pas d'une valeur choisie ici : c'est le fond
       réel de l'en-tête, blanc en clair, charbon en sombre. Les teintes écrites
       à la main juraient toujours avec quelque chose (rectangle gris bleuté
       contre un en-tête blanc, vu le 29/08). Le repli garde des couleurs
       correctes si la page ne répond pas. */
    color: fond || (sombre ? '#141312' : '#FFFFFF'),
    symbolColor: sombre ? '#9A9A94' : '#55524C',
    /* La hauteur MESUREE dans la page, pas une valeur ecrite ici : l'en-tete
       ne fait 62 pixels qu'a 100 % de zoom, et la moindre difference dessine
       une marche dans le coin (vu le 29/08).
       DEUX PIXELS DE MOINS, volontairement : mieux vaut que la bande s'arrete
       juste avant le bas de l'en-tete que de mordre d'un cheveu sur la zone de
       travail. Comme elle a exactement la couleur de l'en-tete, ces deux
       pixels ne se voient pas ; un debordement, lui, se verrait. */
    height: hauteurBande(info),
  }
}

function afficherHorsLigne () {
  if (!fenetre) return
  fenetre.loadFile(path.join(__dirname, 'hors-ligne.html'))
  if (!fenetre.isVisible()) fenetre.show()
}

function reveiller () {
  if (!fenetre) return
  if (fenetre.isMinimized()) fenetre.restore()
  fenetre.focus()
}

/** Ouvre une adresse dans le navigateur du système, et note qu'on attend un retour. */
function ouvrirDehors (url) {
  if (!ouvrableDehors(url)) return
  attenteRetourNavigateur = Date.now()
  shell.openExternal(url)
  envoyerAuRendu({ type: 'parti-au-navigateur' })
}

/** Emmène la fenêtre sur un chemin de l'application (toujours sur notre domaine). */
function ouvrirChemin (chemin) {
  if (!fenetre) return
  const cible = new URL(chemin, siteBase()).toString()
  if (!estInterne(cible)) return
  fenetre.loadURL(cible)
  reveiller()
}

/** Réponse à un lien brvndlab:// : c'est le chemin de retour d'une connexion. */
function suivreLienProtocole (lien) {
  const chemin = cheminDepuisProtocole(lien)
  if (!chemin) return
  attenteRetourNavigateur = 0
  if (!fenetre) {
    /* Application fermée quand le lien arrive : on retenait la seule
       ouverture, pas la destination, et le jeton de connexion se perdait en
       route (fenêtre sur l'accueil, personne connecté). On garde le chemin
       et on le charge dès que la fenêtre est prête. */
    cheminAuDemarrage = chemin
    creerFenetre()
    return
  }
  ouvrirChemin(chemin)
}

function envoyerAuRendu (message) {
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('brvndlab:bureau', message)
}

/* ─── PONT AVEC LA PAGE ─────────────────────────────────────────────────────
   Surface volontairement minuscule : trois gestes, aucun accès au disque. */
ipcMain.on('brvndlab:reessayer', () => {
  if (fenetre) fenetre.loadURL(siteBase())
})
ipcMain.on('brvndlab:redemarrer-pour-maj', () => {
  if (miseAJour) miseAJour.redemarrer()
})
ipcMain.on('brvndlab:ouvrir-dehors', (_e, url) => {
  if (typeof url === 'string') ouvrirDehors(url)
})
ipcMain.on('brvndlab:theme', (_e, theme) => {
  if (process.platform !== 'win32' || !fenetre || fenetre.isDestroyed()) return
  try { fenetre.setTitleBarOverlay(habillageBarreWindows(theme)) } catch { /* fenêtre sans surcouche */ }
})
