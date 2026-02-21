import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  DumpUploadResponse,
  KeysUploadResponse,
  PreviewRequest,
  PreviewResponse,
  CollaboratorConfigResponse,
  ReviewIdsResponse,
  ReviewHtmlItem,
  ParseValidateResponse,
  ValidationResultItem,
  PdfPlanResponse
} from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  getDefaultFilters(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/default-filters`);
  }

  getHeaders(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/headers`);
  }

  uploadDump(file: File): Observable<DumpUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DumpUploadResponse>(`${this.baseUrl}/dump`, formData);
  }

  uploadKeys(file: File): Observable<KeysUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<KeysUploadResponse>(`${this.baseUrl}/keys/file`, formData);
  }

  setKeysText(keys: string): Observable<KeysUploadResponse> {
    return this.http.post<KeysUploadResponse>(`${this.baseUrl}/keys/text`, { keys });
  }

  preview(request: PreviewRequest): Observable<PreviewResponse> {
    return this.http.post<PreviewResponse>(`${this.baseUrl}/preview`, request);
  }

  exportCsv(request: PreviewRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/export`, request, { responseType: 'blob' });
  }

  getCollaboratorConfig(): Observable<CollaboratorConfigResponse> {
    return this.http.get<CollaboratorConfigResponse>(`${this.baseUrl}/collaborator/config`);
  }

  getCollaboratorReviewIds(): Observable<ReviewIdsResponse> {
    return this.http.get<ReviewIdsResponse>(`${this.baseUrl}/collaborator/review-ids`);
  }

  parseValidateCollaboratorReviews(selectedFields: string[], reviews: ReviewHtmlItem[]): Observable<ParseValidateResponse> {
    return this.http.post<ParseValidateResponse>(`${this.baseUrl}/collaborator/parse-validate`, {
      selected_fields: selectedFields,
      reviews
    });
  }

  exportCollaboratorCsv(selectedFields: string[], results: ValidationResultItem[]): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/collaborator/export-csv`, {
      selected_fields: selectedFields,
      results
    }, { responseType: 'blob' });
  }

  getPdfPlan(eligibleReviewIds: string[]): Observable<PdfPlanResponse> {
    return this.http.post<PdfPlanResponse>(`${this.baseUrl}/collaborator/pdf-plan`, {
      eligible_review_ids: eligibleReviewIds
    });
  }
}
