import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormGroup, FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './services/api.service';
import {
  CollaboratorConfigResponse,
  ValidationResultItem,
  ReviewHtmlItem,
  PdfPlanItem
} from './models/api.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatTableModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './app.component.html'
})
export class AppComponent {
  dumpFileName = '';
  keysFileName = '';
  headers: string[] = [];
  defaultFilters: string[] = [];
  selectedFilters: string[] = [];
  previewRows: Record<string, string>[] = [];
  displayedColumns: string[] = [];
  isLoading = false;

  collaboratorConfig: CollaboratorConfigResponse | null = null;
  reviewIds: string[] = [];
  reviewIdsText = '';
  availableCollaboratorFields: string[] = [];
  collaboratorSelectedFields: string[] = [];
  collaboratorResults: ValidationResultItem[] = [];
  collaboratorColumns: string[] = ['review_id', 'status', 'missing_fields', 'comment'];
  fetchProgress = 0;

  form!: FormGroup;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      keysText: ['']
    });
    this.loadDefaults();
    this.loadCollaboratorConfig();
  }

  loadDefaults(): void {
    this.api.getDefaultFilters().subscribe({
      next: (filters) => {
        this.defaultFilters = filters;
        this.selectedFilters = [...filters];
      },
      error: () => this.showError('Failed to load default filters.')
    });
  }

  loadCollaboratorConfig(): void {
    this.api.getCollaboratorConfig().subscribe({
      next: (config) => {
        this.collaboratorConfig = config;
      },
      error: () => this.showError('Failed to load Collaborator config.')
    });
  }

  onDumpSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    this.dumpFileName = file.name;
    this.isLoading = true;

    this.api.uploadDump(file)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.headers = response.columns;
          this.showInfo(`Loaded ${response.rows} rows.`);
        },
        error: (err) => this.showError(err?.error?.detail || 'Failed to load dump file.')
      });
  }

  onKeysSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    this.keysFileName = file.name;
    this.isLoading = true;

    this.api.uploadKeys(file)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => this.showInfo(`Loaded ${response.count} issue keys.`),
        error: (err) => this.showError(err?.error?.detail || 'Failed to load issue keys.')
      });
  }

  submitKeysText(): void {
    const keys = this.form.value.keysText || '';
    if (!keys.trim()) {
      this.showError('Please paste issue keys separated by commas.');
      return;
    }
    this.isLoading = true;
    this.api.setKeysText(keys)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => this.showInfo(`Loaded ${response.count} issue keys.`),
        error: (err) => this.showError(err?.error?.detail || 'Failed to set issue keys.')
      });
  }

  generatePreview(): void {
    if (this.selectedFilters.length === 0) {
      this.showError('Select at least one filter.');
      return;
    }
    this.isLoading = true;
    this.api.preview({ filters: this.selectedFilters })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.previewRows = response.rows;
          this.displayedColumns = ['Issue Key', 'Summary', ...this.selectedFilters, 'Comment'];
        },
        error: (err) => this.showError(err?.error?.detail || 'Failed to build preview.')
      });
  }

  exportCsv(): void {
    if (this.selectedFilters.length === 0) {
      this.showError('Select filters before exporting.');
      return;
    }

    this.api.exportCsv({ filters: this.selectedFilters }).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, 'review_packets.csv');
      },
      error: (err) => this.showError(err?.error?.detail || 'Failed to export CSV.')
    });
  }

  loadReviewIdsFromDump(): void {
    this.api.getCollaboratorReviewIds().subscribe({
      next: (response) => {
        this.reviewIds = response.review_ids;
        this.reviewIdsText = this.reviewIds.join(', ');
        this.showInfo(`Loaded ${this.reviewIds.length} review IDs from Review Info.`);
      },
      error: (err) => this.showError(err?.error?.detail || 'Failed to extract review IDs.')
    });
  }

  applyReviewIdsFromText(): void {
    const raw = this.reviewIdsText.split(/[,;\n\t ]+/g).map((item) => item.trim()).filter((item) => item);
    this.reviewIds = Array.from(new Set(raw));
    this.showInfo(`Prepared ${this.reviewIds.length} review IDs.`);
  }

  async openCollaboratorLogin(): Promise<void> {
    const ready = await this.ensureCollaboratorConfig();
    if (!ready || !this.collaboratorConfig) {
      return;
    }

    const api = this.getElectronCollaboratorApi();
    if (!api) {
      this.showError('Collaborator login is available only in Electron app.');
      return;
    }

    const loginUrl = this.collaboratorConfig.base_url;
    await api.openLogin(loginUrl);
    this.showInfo('Collaborator login window opened. Complete SSO + MFA there.');
  }

  async fetchAndValidateCollaborator(): Promise<void> {
    const ready = await this.ensureCollaboratorConfig();
    if (!ready || !this.collaboratorConfig) {
      return;
    }

    if (this.reviewIds.length === 0) {
      this.showError('No review IDs available. Load from dump or paste manually.');
      return;
    }

    const api = this.getElectronCollaboratorApi();
    if (!api) {
      this.showError('Collaborator fetch is available only in Electron app.');
      return;
    }

    this.isLoading = true;
    this.fetchProgress = 0;

    try {
      const htmlPayload: ReviewHtmlItem[] = [];
      const total = this.reviewIds.length;

      for (let i = 0; i < total; i++) {
        const reviewId = this.reviewIds[i];
        const url = this.buildReviewUrl(reviewId);
        const response = await api.fetchHtml(url);
        htmlPayload.push({ review_id: reviewId, html: response.html });
        this.fetchProgress = Math.round(((i + 1) * 100) / total);
      }

      const parseResponse = await firstValueFrom(
        this.api.parseValidateCollaboratorReviews(this.collaboratorSelectedFields, htmlPayload)
      );

      this.availableCollaboratorFields = parseResponse?.available_fields || [];
      if (this.collaboratorSelectedFields.length === 0) {
        this.collaboratorSelectedFields = [...this.availableCollaboratorFields];
      }
      this.collaboratorResults = parseResponse?.results || [];
      this.showInfo(`Validated ${this.collaboratorResults.length} reviews.`);
    } catch (error: any) {
      this.showError(error?.message || 'Collaborator fetch/validation failed.');
    } finally {
      this.isLoading = false;
    }
  }

  exportCollaboratorCsv(): void {
    if (this.collaboratorResults.length === 0) {
      this.showError('No Collaborator results to export.');
      return;
    }

    this.api.exportCollaboratorCsv(this.collaboratorSelectedFields, this.collaboratorResults).subscribe({
      next: (blob) => this.downloadBlob(blob, 'collaborator_validation.csv'),
      error: (err) => this.showError(err?.error?.detail || 'Failed to export Collaborator CSV.')
    });
  }

  async downloadCollaboratorPdfs(): Promise<void> {
    const api = this.getElectronCollaboratorApi();
    if (!api) {
      this.showError('PDF download is available only in Electron app.');
      return;
    }

    const eligibleIds = this.collaboratorResults
      .filter((row) => row.status === 'Complete')
      .map((row) => row.review_id);

    if (eligibleIds.length === 0) {
      this.showError('No complete reviews available for PDF download.');
      return;
    }

    const plan = await firstValueFrom(this.api.getPdfPlan(eligibleIds));
    const jobs: PdfPlanItem[] = plan?.jobs || [];
    const result = await api.downloadPdfs(jobs);
    this.showInfo(`PDF complete: ${result.downloaded.length} success, ${result.failed.length} failed.`);
  }

  private buildReviewUrl(reviewId: string): string {
    const config = this.collaboratorConfig;
    const base = (config?.base_url || '').replace(/\/$/, '');
    const path = (config?.review_path_template || '/user/{reviewId}').replace('{reviewId}', reviewId);
    return `${base}${path}`;
  }

  private async ensureCollaboratorConfig(): Promise<boolean> {
    if (this.collaboratorConfig) {
      return true;
    }

    try {
      this.collaboratorConfig = await firstValueFrom(this.api.getCollaboratorConfig());
      return true;
    } catch (error: any) {
      const detail = error?.error?.detail || error?.message || 'Failed to load Collaborator config.';
      this.showError(detail);
      return false;
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private getElectronCollaboratorApi(): any {
    return (window as any).reviewpackets?.collaborator;
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }

  private showInfo(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3000 });
  }
}
