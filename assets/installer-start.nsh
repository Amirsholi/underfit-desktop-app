; The stock launcher delegates even unelevated installs to Explorer. That can
; finish without starting the application. Per-user installs can launch the
; executable directly, retaining the current user's permissions.
!macroundef StartApp
!macro StartApp
  Var /GLOBAL underfitStartArgs
  ${if} ${isUpdated}
    StrCpy $underfitStartArgs "--updated"
  ${else}
    StrCpy $underfitStartArgs ""
  ${endif}
  ${if} ${UAC_IsAdmin}
    ; Never start the gym application with elevated installer privileges.
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$underfitStartArgs"
  ${else}
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" $underfitStartArgs'
  ${endif}
!macroend
