$ErrorActionPreference = 'Stop'

# Avoid code-signing tooling on local unsigned builds.
$env:ELECTRON_BUILDER_SKIP_WIN_CODE_SIGN = "true"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

npx electron-builder --config electron-builder.json --win nsis
