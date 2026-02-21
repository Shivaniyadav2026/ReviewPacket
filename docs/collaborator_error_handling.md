# Collaborator Error Handling and Retry Plan

## Error Handling Strategy
- Invalid setup:
  - Missing dump or `Review Info` column returns HTTP 400.
  - Empty selected fields returns HTTP 400.
- Session errors:
  - Electron IPC returns actionable messages if login URL/review URL missing.
  - UI warns when feature is run outside Electron.
- Parsing variability:
  - ParserService extracts from multiple patterns (title/table/dl/section headers).
  - Missing fields do not crash parser; validation marks them as missing.
- PDF failures:
  - Each job runs independently.
  - Response includes both `downloaded` and `failed` arrays.

## Retry Logic
- Config-level values live in `backend/collaborator_config.json`:
  - `maxRetries`
  - `requestTimeoutSeconds`
  - `batchSize`
- Recommended runtime behavior in UI/Electron:
  - Retry HTML fetch per review ID up to `maxRetries` for transient load failures.
  - Process review IDs in batches to avoid browser overload.
  - Continue partial progress instead of failing entire run.

## Observability
- Backend logs parse/validation errors through standard app logger.
- Electron logs backend spawn + renderer load failures in main process output.
- UI shows operation status and progress percentage for fetch runs.

### Log Files on Test Machines
- Backend global log: `%LOCALAPPDATA%\\ReviewPackets\\logs\\reviewpackets.log`
- Backend collaborator log: `%LOCALAPPDATA%\\ReviewPackets\\logs\\collaborator-backend.log`
- Electron collaborator log: `%APPDATA%\\ReviewPackets\\logs\\collaborator-electron.log`
