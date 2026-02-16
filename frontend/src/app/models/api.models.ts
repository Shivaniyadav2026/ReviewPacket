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
