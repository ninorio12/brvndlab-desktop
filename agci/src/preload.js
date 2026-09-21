'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/**
 * LE PONT ENTRE LA FENÊTRE ET LA PAGE : `window.agci`.
 *
 * Surface minuscule et volontaire : la page vient du réseau, elle ne doit
 * jamais pouvoir toucher au disque ni lancer un programme. Le Data OS le lit
 * dans lib/push.ts (pontBureau) pour poser ses bannières et sa pastille.
 */

function lireArgument (nom) {
  const prefixe = '--' + nom + '='
  const trouve = (process.argv || []).find((a) => a.startsWith(prefixe))
  return trouve ? trouve.slice(prefixe.length) : null
}

const VERSION = lireArgument('agci-version') || '0.0.0'
const OS = lireArgument('agci-os') || 'inconnu'

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

const abonnes = new Set()
ipcRenderer.on('agci:bureau', (_e, message) => {
  for (const f of abonnes) {
    try { f(message) } catch { /* un abonné cassé n'empêche pas les autres */ }
  }
})

contextBridge.exposeInMainWorld('agci', {
  bureau: true,
  os: OS,
  version: VERSION,

  /** Recharge le produit depuis le réseau (bouton de l'écran hors ligne). */
  reessayer: () => ipcRenderer.send('agci:reessayer'),

  /** Redémarre maintenant pour appliquer une mise à jour déjà téléchargée. */
  redemarrerPourMiseAJour: () => ipcRenderer.send('agci:redemarrer-pour-maj'),

  /** Ouvre une adresse dans le navigateur du système (le principal refiltre). */
  ouvrirDehors: (url) => ipcRenderer.send('agci:ouvrir-dehors', String(url || '')),

  /**
   * Demande au système une bannière. Rend { pose: true } si macOS l'a
   * acceptée, sinon { pose: false, raison }.
   *   notifier({ titre, corps, lien, etiquette })
   */
  notifier: (charge) => ipcRenderer.invoke('agci:notifier', {
    titre: String((charge && charge.titre) || ''),
    corps: String((charge && charge.corps) || ''),
    lien: charge && charge.lien ? String(charge.lien) : null,
    etiquette: charge && charge.etiquette ? String(charge.etiquette) : null,
  }),

  /** Le nombre affiché sur l'icône du Dock. 0 efface la pastille. */
  pastille: (n) => ipcRenderer.send('agci:pastille', Number(n) || 0),

  /** S'abonne aux évènements du bureau (« maj-prete », « banniere-refusee »). */
  ecouter: (f) => {
    if (typeof f !== 'function') return () => {}
    abonnes.add(f)
    return () => abonnes.delete(f)
  },
})
