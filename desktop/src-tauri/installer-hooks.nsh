; Raccourci Brvndlab sur le bureau, garanti.
;
; Le modele NSIS de Tauri en pose deja un, mais seulement dans certains modes
; d'installation. On le recree ici sans condition : meme nom de fichier, donc
; jamais de doublon, juste la certitude qu'il existe.
;
; ATTENTION au nom du binaire : il vient du paquet Rust, pas du nom du produit.
; On passe donc par les variables du modele plutot que d'ecrire un nom en dur,
; sinon le raccourci pointe vers un fichier qui n'existe pas (vu en 0.1.3, ou
; l'executable installe s'appelait brvndlab-desktop.exe).
!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
!macroend

; Et on le retire proprement a la desinstallation.
!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
!macroend
