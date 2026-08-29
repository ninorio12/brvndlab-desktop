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
   rectangle noir dans le coin. Le thème vit dans data-bvh-theme sur <html>,
   posé par le SaaS lui-même : on l'observe et on le relaie, rien de plus. */
function relayerTheme () {
  const racine = document.documentElement
  if (!racine) return
  const envoyer = () => ipcRenderer.send('brvndlab:theme', racine.getAttribute('data-bvh-theme') || 'dark')
  envoyer()
  new MutationObserver(envoyer).observe(racine, { attributes: true, attributeFilter: ['data-bvh-theme'] })
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
