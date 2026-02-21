# Collaborator API Contracts

Base URL: `http://127.0.0.1:8000/api`

## GET /collaborator/config
Response:
```json
{
  "base_url": "https://collaborator.server.com",
  "review_path_template": "/user/{reviewId}",
  "request_timeout_seconds": 30,
  "max_retries": 2,
  "batch_size": 10
}
```

## GET /collaborator/review-ids
Response:
```json
{
  "review_ids": ["CR-1001", "CR-1002"]
}
```

## POST /collaborator/parse-validate
Request:
```json
{
  "selected_fields": ["Role", "Project", "Overview"],
  "reviews": [
    {
      "review_id": "CR-1001",
      "html": "<html>...</html>"
    }
  ]
}
```

Response:
```json
{
  "available_fields": ["Defects", "Overview", "Project", "Role"],
  "results": [
    {
      "review_id": "CR-1001",
      "field_values": {
        "Role": "Author",
        "Project": "Core Banking",
        "Overview": "Validate transaction posting flow."
      },
      "missing_fields": [],
      "comment": "All required fields present",
      "status": "Complete"
    }
  ]
}
```

## POST /collaborator/export-csv
Request:
```json
{
  "selected_fields": ["Role", "Project", "Overview"],
  "results": [
    {
      "review_id": "CR-1001",
      "field_values": {
        "Role": "Author",
        "Project": "Core Banking",
        "Overview": "Validate transaction posting flow."
      },
      "missing_fields": [],
      "comment": "All required fields present",
      "status": "Complete"
    }
  ]
}
```

Response: CSV stream attachment.

## POST /collaborator/pdf-plan
Request:
```json
{
  "eligible_review_ids": ["CR-1001", "CR-1002"]
}
```

Response:
```json
{
  "output_dir": "C:/.../Downloads/20260217_102233",
  "jobs": [
    {
      "review_id": "CR-1001",
      "url": "https://collaborator.server.com/user/CR-1001",
      "output_file": "C:/.../Downloads/20260217_102233/CR-1001.pdf"
    }
  ]
}
```
