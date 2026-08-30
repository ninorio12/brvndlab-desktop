'use strict'

/**
 * QUI A LE DROIT DE S'AFFICHER DANS LA FENÊTRE, ET QUI DOIT PARTIR DEHORS.
 *
 * Une fenêtre d'application n'est pas un navigateur : elle n'a pas de barre
 * d'adresse, donc personne ne peut vérifier sur quel site il tape son mot de
 * passe. Google refuse pour cette raison d'afficher sa page de connexion dans
 * une fenêtre d'application (erreur « disallowed_useragent »), et il a raison.
 *
 * D'où la règle, unique et sans exception : seul notre propre domaine vit dans
 * la fenêtre. Tout le reste part dans le navigateur du système, où l'adresse
 * est visible et où les mots de passe enregistrés fonctionnent.
 */

const SITE_PAR_DEFAUT = 'https://app.brvndlab.com'

/** L'adresse de l'application, surchargeable pour tester sur un environnement local. */
function siteBase () {
  return process.env.BRVNDLAB_URL || SITE_PAR_DEFAUT
}

/** Les hôtes qui font partie de la maison : la fenêtre les affiche. */
function hotesInternes () {
  const hotes = new Set()
  try { hotes.add(new URL(siteBase()).host) } catch { /* adresse invalide : on garde le défaut */ }
  hotes.add('app.brvndlab.com')
  /* clerk.brvndlab.com EST à nous : c'est le serveur d'authentification de
     Brvndlab, sur notre propre domaine. Sans cette ligne, toute redirection de
     connexion (y compris la sortie de session) partait dans le navigateur et
     laissait la fenêtre plantée sur place. */
  hotes.add('clerk.brvndlab.com')
  return hotes
}

/**
 * Les pages de connexion des grands fournisseurs. On ne les affiche jamais dans
 * la fenêtre (ils refusent), mais on les distingue du reste du web parce que la
 * réponse n'est pas la même : un lien ordinaire s'ouvre simplement dehors, une
 * connexion demande qu'on explique ce qui se passe.
 */
const HOTES_CONNEXION = [
  'accounts.google.com',
  'appleid.apple.com',
  'www.facebook.com',
  'facebook.com',
  'api.instagram.com',
  'www.instagram.com',
]

function estPageDeConnexionTiers (url) {
  const u = analyser(url)
  if (!u) return false
  return HOTES_CONNEXION.includes(u.host)
}

/** Vrai si la page affichée est l'écran de connexion ou d'inscription de Brvndlab. */
function estEcranDeConnexion (url) {
  const u = analyser(url)
  if (!u) return false
  return u.pathname.startsWith('/sign-in') || u.pathname.startsWith('/sign-up')
}

function analyser (url) {
  try { return new URL(url) } catch { return null }
}

/** Vrai si l'adresse est une page de Brvndlab (donc affichable dans la fenêtre). */
function estInterne (url) {
  const u = analyser(url)
  if (!u) return false
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  return hotesInternes().has(u.host)
}

/**
 * Vrai si on peut confier l'adresse au navigateur du système.
 * Filtre volontairement strict : un lien « file: » ou un schéma exotique
 * envoyé à shell.openExternal, c'est une exécution de programme offerte à
 * n'importe quelle page. On n'ouvre que du web et du courrier.
 */
function ouvrableDehors (url) {
  const u = analyser(url)
  if (!u) return false
  return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:'
}

/**
 * Transforme un lien brvndlab:// en chemin interne sûr.
 *
 * Formes acceptées : brvndlab://ouvrir?chemin=/integrations
 *                    brvndlab://integrations
 * Tout le reste retombe sur /home. Le contrôle « commence par une seule barre »
 * empêche qu'un lien reçu du système (n'importe quelle application peut en
 * envoyer un) fasse sortir la fenêtre de notre domaine avec « //ailleurs.com ».
 */
function cheminDepuisProtocole (lien) {
  const u = analyser(lien)
  if (!u || u.protocol !== 'brvndlab:') return null

  /* LE RETOUR DE CONNEXION (30/08). Le navigateur, une fois la connexion
     Google ou Apple faite, rend la main par brvndlab://connexion?ticket=…
     Le jeton doit arriver ENTIER jusqu'à l'écran de connexion : le chemin
     générique plus bas recolle bien la requête, mais seulement après être
     passé par « /connexion », une page qui n'existe pas. On traite ce cas
     ici, et on ne laisse passer qu'un jeton d'allure raisonnable. */
  if (u.hostname === 'connexion') {
    const ticket = u.searchParams.get('ticket')
    if (!ticket || !/^[A-Za-z0-9._-]{16,512}$/.test(ticket)) return '/sign-in'
    return '/sign-in?ticket=' + encodeURIComponent(ticket)
  }

  let chemin = u.searchParams.get('chemin')
  if (!chemin && u.hostname) chemin = '/' + u.hostname + (u.pathname || '')
  if (!chemin) return '/home'
  if (!chemin.startsWith('/') || chemin.startsWith('//')) return '/home'
  // On recolle la requête et l'ancre éventuelles, sans jamais changer d'hôte.
  const interne = analyser(new URL(chemin, siteBase()).toString())
  if (!interne || !hotesInternes().has(interne.host)) return '/home'
  return interne.pathname + interne.search + interne.hash
}

module.exports = {
  siteBase,
  estInterne,
  ouvrableDehors,
  cheminDepuisProtocole,
  estPageDeConnexionTiers,
  estEcranDeConnexion,
}
