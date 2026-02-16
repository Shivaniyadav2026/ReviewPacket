# API Contracts

Base URL: `http://127.0.0.1:8000/api`

## GET /default-filters
Returns: `string[]`

## GET /headers
Returns: `string[]`

## POST /dump
Content-Type: `multipart/form-data`
Body: `file` (xlsx/xls/csv)
Response:
```
{
  "rows": 120,
  "columns": ["Issue Key", "Summary", ...]
}
```

## POST /keys/file
Content-Type: `multipart/form-data`
Body: `file`
Response:
```
{
  "count": 42
}
```

## POST /keys/text
Body:
```
{
  "keys": "RP-1, RP-2"
}
```
Response:
```
{
  "count": 2
}
```

## POST /preview
Body:
```
{
  "filters": ["Summary", "Priority"]
}
```
Response:
```
{
  "rows": [
    {
      "Issue Key": "RP-101",
      "Summary": "Login fails",
      "Priority": "High",
      "Comment": "Review completed"
    }
  ]
}
```

## POST /export
Body:
```
{
  "filters": ["Summary", "Priority"]
}
```
Response: CSV file stream
