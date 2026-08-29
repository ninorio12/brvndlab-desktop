// Coquille de bureau Brvndlab.
// La fenetre charge directement app.brvndlab.com : aucune barre d'adresse,
// aucun onglet, aucune extension. Chaque deploiement Vercel met a jour l'app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Brvndlab n'a pas pu demarrer");
}
