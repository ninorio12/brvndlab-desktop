'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/**
 * LE PONT ENTRE LA FENÊTRE ET LA PAGE.
 *
 * Il fait deux choses, et rien d'autre :
 *
 *  1. il pose sur la page les marqueurs `data-bureau` et `data-bureau-os`, qui
 *     permettent au CSS du SaaS de réserver la place des pastilles de macOS et
 *     de déclarer la zone de glissement dans le haut de l'écran ;
 *  2. il expose `window.brvndlab`, une poignée de quatre gestes. Surface
 *     minuscule et volontaire : la page vient du réseau, elle ne doit jamais
 *     pouvoir toucher au disque ni lancer un programme.
 */

function lireArgument (nom) {
  const prefixe = '--' + nom + '='
  const trouve = (process.argv || []).find((a) => a.startsWith(prefixe))
  return trouve ? trouve.slice(prefixe.length) : null
}

const VERSION = lireArgument('brvndlab-version') || '0.0.0'
const OS = lireArgument('brvndlab-os') || 'inconnu'

/* Les marqueurs, posés le plus tôt possible : si on attendait l'hydratation de
   React, l'en-tête sauterait d'un cran au premier affichage sur macOS. */
function poserMarqueurs () {
  const racine = document.documentElement
  if (!racine) return false
  racine.setAttribute('data-bureau', '1')
  racine.setAttribute('data-bureau-os', OS)
  return true
}
if (!poserMarqueurs()) {
  document.addEventListener('DOMContentLoaded', poserMarqueurs, { once: true })
}

/* LE THÈME REMONTE VERS LA FENÊTRE.
   Sous Windows, les boutons système sont dessinés par Windows par-dessus la
   page : sans cette remontée, un compte en thème clair se retrouve avec un
   rectangle noir dans le coin.

   ATTENTION, IL Y A DEUX THÈMES. L'application suit data-bvh-theme, mais les
   écrans de connexion ont le leur, data-brv-theme, réglé par le petit soleil
   de la page. En n'écoutant que le premier, la fenêtre gardait ses boutons
   sombres devant un écran de connexion clair (vu le 29/08). On lit donc
   l'attribut qui gouverne VRAIMENT la page affichée. */
function relayerTheme () {
  const racine = document.documentElement
  if (!racine) return
  const lire = () => {
    const auth = racine.classList.contains('auth-page')
    const valeur = racine.getAttribute(auth ? 'data-brv-theme' : 'data-bvh-theme')
    return valeur === 'light' ? 'light' : 'dark'
  }

  /* LA COULEUR EXACTE, PAS UNE COULEUR APPROCHANTE.
     Windows dessine ses boutons sur un aplat qu'il faut lui donner. Une teinte
     choisie a la main a toujours fini par jurer : gris bleute contre un
     en-tete blanc, beige contre une page blanche. On lit donc le fond reel de
     l'en-tete quand il existe, celui de la page sinon. */
  const enHex = (couleur) => {
    const m = String(couleur).match(/\d+/g)
    if (!m || m.length < 3) return null
    return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  }
  /* ON MESURE, ON NE DEVINE PLUS.
     La hauteur etait ecrite en dur (62px, celle de l'en-tete). Des que la page
     n'est pas a 100 % de zoom, ou que l'en-tete change de taille, la bande des
     boutons ne tombe plus sur la meme ligne que l'en-tete : on voit une marche
     dans le coin. On renvoie donc la hauteur REELLE, mesuree dans la page. */
  const mesure = () => {
    try {
      const entete = document.querySelector('.bvh-head')
      const cible = entete || document.body
      if (!cible) return { fond: null, hauteur: null }
      const fond = enHex(getComputedStyle(cible).backgroundColor)
      const h = entete ? Math.round(entete.getBoundingClientRect().height) : null
      return { fond, hauteur: h && h > 24 && h < 120 ? h : null }
    } catch { return { fond: null, hauteur: null } }
  }

  /* ON RENVOIE DES QUE LA COULEUR CHANGE, ET C'ETAIT LA PANNE.
     Le premier envoi part avant que la page n'ait construit son en-tete : a cet
     instant `.bvh-head` n'existe pas encore et on lisait le fond du document,
     qui vaut #EEF0F4, un gris bleute herite de l'ancienne charte. Cette valeur
     restait ensuite affichee pour toujours, puisque plus rien ne la corrigeait.
     On surveille donc aussi la construction de la page, et on ne parle que
     lorsque la couleur a reellement change. */
  let dernier = null
  const envoyer = () => {
    const m = mesure()
    const etat = { theme: lire(), fond: m.fond, hauteur: m.hauteur }
    const signature = etat.theme + '|' + etat.fond + '|' + etat.hauteur
    if (signature === dernier) return
    dernier = signature
    ipcRenderer.send('brvndlab:theme', etat)
  }

  /* LE FONDU DU CHANGEMENT DE THEME DURE UNE DEMI-SECONDE.
     Lire la couleur a l'instant ou l'attribut change donne une teinte de
     milieu de fondu, et comme on ne parle que lorsque la couleur change, on
     restait fige sur cette teinte batarde. On rechantillonne donc pendant tout
     le fondu, jusqu'a ce que la couleur se stabilise. */
  const suivreLeFondu = () => {
    envoyer()
    for (const attente of [80, 200, 380, 560, 760, 1000]) setTimeout(envoyer, attente)
  }

  envoyer()
  new MutationObserver(suivreLeFondu).observe(racine, {
    attributes: true,
    attributeFilter: ['data-bvh-theme', 'data-brv-theme', 'class'],
  })
  // L'en-tete arrive avec le rendu, et change a chaque navigation interne.
  let minuteur = null
  const surveiller = () => {
    if (minuteur) clearTimeout(minuteur)
    minuteur = setTimeout(envoyer, 120)
  }
  const brancher = () => {
    if (!document.body) return false
    new MutationObserver(surveiller).observe(document.body, { childList: true, subtree: true })
    envoyer()
    return true
  }
  if (!brancher()) document.addEventListener('DOMContentLoaded', brancher, { once: true })
  // Filet des premieres secondes : certaines pages montent leur en-tete apres
  // un aller-retour reseau, hors de toute mutation observable a temps.
  let restants = 20
  const battement = setInterval(() => {
    envoyer()
    if (--restants <= 0) clearInterval(battement)
  }, 500)
}
if (document.documentElement) relayerTheme()
else document.addEventListener('DOMContentLoaded', relayerTheme, { once: true })

/** Les messages du processus principal, redistribués aux abonnés de la page. */
const abonnes = new Set()
ipcRenderer.on('brvndlab:bureau', (_e, message) => {
  for (const f of abonnes) {
    try { f(message) } catch { /* un abonné cassé n'empêche pas les autres */ }
  }
})

contextBridge.exposeInMainWorld('brvndlab', {
  bureau: true,
  os: OS,
  version: VERSION,

  /** Recharge l'application depuis le réseau (bouton de l'écran hors ligne). */
  reessayer: () => ipcRenderer.send('brvndlab:reessayer'),

  /** Redémarre maintenant pour appliquer une mise à jour déjà téléchargée. */
  redemarrerPourMiseAJour: () => ipcRenderer.send('brvndlab:redemarrer-pour-maj'),

  /** Ouvre une adresse dans le navigateur du système (le principal refiltre). */
  ouvrirDehors: (url) => ipcRenderer.send('brvndlab:ouvrir-dehors', String(url || '')),

  /**
   * Demande au système une bannière, celle qui apparaît même quand on est dans
   * une autre application. Rend { pose: true } si le système l'a acceptée,
   * sinon { pose: false, raison } : la page peut alors se rabattre sur sa
   * propre bannière au lieu de croire que la personne a été prévenue.
   *   notifier({ titre, corps, lien, etiquette })
   */
  notifier: (charge) => ipcRenderer.invoke('brvndlab:notifier', {
    titre: String((charge && charge.titre) || ''),
    corps: String((charge && charge.corps) || ''),
    lien: charge && charge.lien ? String(charge.lien) : null,
    etiquette: charge && charge.etiquette ? String(charge.etiquette) : null,
  }),

  /** Le nombre affiché sur l'icône du Dock (macOS). 0 efface la pastille. */
  pastille: (n) => ipcRenderer.send('brvndlab:pastille', Number(n) || 0),

  /**
   * S'abonne aux évènements du bureau. Rend la fonction de désabonnement, pour
   * que React puisse nettoyer proprement.
   * Types émis : « maj-prete », « parti-au-navigateur », « retour-navigateur ».
   */
  ecouter: (f) => {
    if (typeof f !== 'function') return () => {}
    abonnes.add(f)
    return () => abonnes.delete(f)
  },
})
