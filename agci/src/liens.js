'use strict'

/**
 * QUI A LE DROIT DE S'AFFICHER DANS LA FENÊTRE, ET QUI DOIT PARTIR DEHORS.
 *
 * Seul le Data OS vit dans la fenêtre. Tout le reste (un site de bien, un
 * portail, une fiche Pipedrive) part dans le navigateur du système, où
 * l'adresse est visible et où les mots de passe enregistrés fonctionnent.
 */

const SITE_PAR_DEFAUT = 'https://dataos-agci.vercel.app'
const ACCUEIL = '/modules/vue-ensemble'

/** L'adresse du produit, surchargeable pour tester sur un environnement local. */
function siteBase () {
  return process.env.AGCI_URL || SITE_PAR_DEFAUT
}

function hotesInternes () {
  const hotes = new Set()
  try { hotes.add(new URL(siteBase()).host) } catch { /* adresse invalide : on garde le défaut */ }
  hotes.add('dataos-agci.vercel.app')
  return hotes
}

function analyser (url) {
  try { return new URL(url) } catch { return null }
}

/** Vrai si l'adresse est une page du Data OS (affichable dans la fenêtre). */
function estInterne (url) {
  const u = analyser(url)
  if (!u) return false
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  return hotesInternes().has(u.host)
}

/** On n'ouvre dehors que du web et du courrier, jamais un schéma exotique. */
function ouvrableDehors (url) {
  const u = analyser(url)
  if (!u) return false
  return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:'
}

/** Un chemin interne sûr : commence par une seule barre, reste sur nos hôtes. */
function cheminSur (chemin) {
  if (typeof chemin !== 'string' || !chemin.startsWith('/') || chemin.startsWith('//')) return ACCUEIL
  const interne = analyser(new URL(chemin, siteBase()).toString())
  if (!interne || !hotesInternes().has(interne.host)) return ACCUEIL
  return interne.pathname + interne.search + interne.hash
}

module.exports = { siteBase, estInterne, ouvrableDehors, cheminSur, ACCUEIL }
