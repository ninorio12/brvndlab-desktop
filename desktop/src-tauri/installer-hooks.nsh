; Raccourci Brvndlab sur le bureau, garanti.
;
; Le modele NSIS de Tauri en pose deja un, mais seulement dans certains modes
; d'installation. On le recree ici sans condition : le nom du fichier est le
; meme, donc il n'y a jamais de doublon, juste la certitude qu'il existe.
!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\Brvndlab.lnk" "$INSTDIR\Brvndlab.exe" "" "$INSTDIR\Brvndlab.exe" 0
!macroend

; Et on le retire proprement a la desinstallation.
!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\Brvndlab.lnk"
!macroend
