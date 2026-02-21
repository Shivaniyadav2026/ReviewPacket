export interface DumpUploadResponse {
  rows: number;
  columns: string[];
}

export interface KeysUploadResponse {
  count: number;
}

export interface PreviewRequest {
  filters: string[];
}

export interface PreviewResponse {
  rows: Record<string, string>[];
}

export interface CollaboratorConfigResponse {
  base_url: string;
  review_path_template: string;
  request_timeout_seconds: number;
  max_retries: number;
  batch_size: number;
}

export interface ReviewIdsResponse {
  review_ids: string[];
}

export interface ReviewHtmlItem {
  review_id: string;
  html: string;
}

export interface ValidationResultItem {
  review_id: string;
  field_values: Record<string, string>;
  missing_fields: string[];
  comment: string;
  status: string;
}

export interface ParseValidateResponse {
  available_fields: string[];
  results: ValidationResultItem[];
}

export interface PdfPlanItem {
  review_id: string;
  url: string;
  output_file: string;
}

export interface PdfPlanResponse {
  output_dir: string;
  jobs: PdfPlanItem[];
}
