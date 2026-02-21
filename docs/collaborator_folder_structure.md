# Collaborator Folder Structure

backend/
  collaborator_config.json
  api/
    routes.py
  services/
    collaborator_service.py
    parser_service.py
    validation_service.py
    pdf_service.py
    config_service.py
  tests/
    fixtures/
      collaborator_mock.html
    test_collaborator_parser.py
    test_collaborator_validation.py

electron/
  main.js
  preload.js

frontend/src/app/
  app.component.ts
  app.component.html
  services/
    api.service.ts
  models/
    api.models.ts

docs/
  collaborator_architecture.md
  collaborator_data_flow.md
  collaborator_api_contracts.md
  collaborator_sequence_diagram.txt
  collaborator_error_handling.md
