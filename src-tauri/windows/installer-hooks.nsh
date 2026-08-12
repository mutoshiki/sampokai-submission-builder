!define SAMP_OLD_PRODUCTNAME "山歩会 提出書類作成"
!define SAMP_OLD_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SAMP_OLD_PRODUCTNAME}"

!macro NSIS_HOOK_POSTINSTALL
  ; v0.1.0-v0.1.5 used a different product name. Tauri derives both the
  ; installation directory and uninstall key from productName, so the updater
  ; installs the current app separately. Resolve the old location from Tauri's
  ; registry metadata; never assume a drive or directory.
  ReadRegStr $R8 HKCU "Software\${MANUFACTURER}\${SAMP_OLD_PRODUCTNAME}" ""
  ReadRegStr $R9 HKCU "${SAMP_OLD_UNINSTKEY}" "UninstallString"

  ; Use the old Tauri uninstaller in update mode. This removes only the old app
  ; payload and registry entry while preserving app data and shortcuts. A failed
  ; cleanup does not block the new installation; shortcut migration below still
  ; prevents normal launches from returning to the old executable.
  StrCmp $R8 "" sampokai_cleanup_done
  StrCmp $R8 "$INSTDIR" sampokai_cleanup_done
  StrCmp $R9 "" sampokai_cleanup_done
  IfFileExists "$R8\uninstall.exe" 0 sampokai_cleanup_done
  DetailPrint "Migrating legacy ${SAMP_OLD_PRODUCTNAME} installation from $R8"
  ExecWait '$R9 /UPDATE /P _?=$R8' $R7
  StrCmp $R7 0 0 sampokai_cleanup_done
  Delete "$R8\uninstall.exe"
  RMDir "$R8"
  DeleteRegKey HKCU "Software\${MANUFACTURER}\${SAMP_OLD_PRODUCTNAME}"
  sampokai_cleanup_done:

  ; Replace only shortcuts that point to the registered old executable (or that
  ; were already manually redirected to the current executable). Unrelated .lnk
  ; files with the same visible name are left untouched.
  IfFileExists "$DESKTOP\${SAMP_OLD_PRODUCTNAME}.lnk" 0 sampokai_desktop_done
  StrCmp $R8 "" sampokai_desktop_check_current
  !insertmacro IsShortcutTarget "$DESKTOP\${SAMP_OLD_PRODUCTNAME}.lnk" "$R8\${MAINBINARYNAME}.exe"
  Pop $R7
  StrCmp $R7 1 sampokai_desktop_migrate
  sampokai_desktop_check_current:
  !insertmacro IsShortcutTarget "$DESKTOP\${SAMP_OLD_PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $R7
  StrCmp $R7 1 sampokai_desktop_migrate sampokai_desktop_done
  sampokai_desktop_migrate:
  !insertmacro UnpinShortcut "$DESKTOP\${SAMP_OLD_PRODUCTNAME}.lnk"
  Delete "$DESKTOP\${SAMP_OLD_PRODUCTNAME}.lnk"
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  sampokai_desktop_done:

  IfFileExists "$SMPROGRAMS\${SAMP_OLD_PRODUCTNAME}.lnk" 0 sampokai_startmenu_done
  StrCmp $R8 "" sampokai_startmenu_check_current
  !insertmacro IsShortcutTarget "$SMPROGRAMS\${SAMP_OLD_PRODUCTNAME}.lnk" "$R8\${MAINBINARYNAME}.exe"
  Pop $R7
  StrCmp $R7 1 sampokai_startmenu_migrate
  sampokai_startmenu_check_current:
  !insertmacro IsShortcutTarget "$SMPROGRAMS\${SAMP_OLD_PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $R7
  StrCmp $R7 1 sampokai_startmenu_migrate sampokai_startmenu_done
  sampokai_startmenu_migrate:
  !insertmacro UnpinShortcut "$SMPROGRAMS\${SAMP_OLD_PRODUCTNAME}.lnk"
  Delete "$SMPROGRAMS\${SAMP_OLD_PRODUCTNAME}.lnk"
  CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  sampokai_startmenu_done:
!macroend
