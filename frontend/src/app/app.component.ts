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
  fetchProgress = 0;
  collaboratorUsername = '';
  collaboratorTicket = '';
  collaboratorCookie = '';
  private readonly collaboratorDefaultFields = [
    'Review Status',
    'Review Title',
    'Role',
    'Created',
    'Group',
    'Template',
    'Deadline',
    'Completed on',
    'Restricted Uploads/Deletions',
    'Overview',
    'Work Product Version',
    'Meeting Details',
    'Production Site',
    'SW Criticality Level',
    'Oversight Review Type',
    'Review Effort (hh:mm)',
    'Project',
    'Aero - Project Name',
    'Aero - Software load under work/test',
    'Supporting Materials/Comments',
    'Functional Area',
    'Participants',
    'Defects'
  ];

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
    this.logFlow('app', 'Loading default filters.');
    this.api.getDefaultFilters().subscribe({
      next: (filters) => {
        this.defaultFilters = filters;
        this.selectedFilters = [...filters];
        this.logFlow('app', 'Default filters loaded.', { count: filters.length });
      },
      error: () => {
        this.logFlow('app:error', 'Failed to load default filters.');
        this.showError('Failed to load default filters.');
      }
    });
  }

  loadCollaboratorConfig(): void {
    this.logFlow('collaborator', 'Loading collaborator config.');
    this.api.getCollaboratorConfig().subscribe({
      next: (config) => {
        this.collaboratorConfig = config;
        this.logFlow('collaborator', 'Collaborator config loaded.', config);
      },
      error: (err) => {
        this.logFlow('collaborator:error', 'Failed to load Collaborator config.', err?.error || err?.message);
        this.showError('Failed to load Collaborator config.');
      }
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
    this.logFlow('dump', 'Uploading dump file.', { file: file.name, size: file.size });

    this.api.uploadDump(file)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.headers = response.columns;
          this.logFlow('dump', 'Dump upload complete.', { rows: response.rows, columns: response.columns.length });
          this.showInfo(`Loaded ${response.rows} rows.`);
        },
        error: (err) => {
          this.logFlow('dump:error', 'Dump upload failed.', err?.error || err?.message);
          this.showError(err?.error?.detail || 'Failed to load dump file.');
        }
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
    this.logFlow('keys', 'Uploading keys file.', { file: file.name, size: file.size });

    this.api.uploadKeys(file)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.logFlow('keys', 'Keys upload complete.', { count: response.count });
          this.showInfo(`Loaded ${response.count} issue keys.`);
        },
        error: (err) => {
          this.logFlow('keys:error', 'Keys upload failed.', err?.error || err?.message);
          this.showError(err?.error?.detail || 'Failed to load issue keys.');
        }
      });
  }

  submitKeysText(): void {
    const keys = this.form.value.keysText || '';
    if (!keys.trim()) {
      this.logFlow('keys:error', 'Keys text submission rejected: empty input.');
      this.showError('Please paste issue keys separated by commas.');
      return;
    }
    this.isLoading = true;
    this.logFlow('keys', 'Applying keys from text.');
    this.api.setKeysText(keys)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.logFlow('keys', 'Keys text applied.', { count: response.count });
          this.showInfo(`Loaded ${response.count} issue keys.`);
        },
        error: (err) => {
          this.logFlow('keys:error', 'Failed to apply keys text.', err?.error || err?.message);
          this.showError(err?.error?.detail || 'Failed to set issue keys.');
        }
      });
  }

  generatePreview(): void {
    if (this.selectedFilters.length === 0) {
      this.logFlow('preview:error', 'Preview rejected: no selected filters.');
      this.showError('Select at least one filter.');
      return;
    }
    this.isLoading = true;
    this.logFlow('preview', 'Generating preview.', { filters: this.selectedFilters });
    this.api.preview({ filters: this.selectedFilters })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.previewRows = response.rows;
          this.displayedColumns = ['Issue Key', 'Summary', ...this.selectedFilters, 'Comment'];
          this.logFlow('preview', 'Preview generated.', { rows: response.rows.length });
        },
        error: (err) => {
          this.logFlow('preview:error', 'Preview generation failed.', err?.error || err?.message);
          this.showError(err?.error?.detail || 'Failed to build preview.');
        }
      });
  }

  exportCsv(): void {
    if (this.selectedFilters.length === 0) {
      this.logFlow('preview:error', 'CSV export rejected: no selected filters.');
      this.showError('Select filters before exporting.');
      return;
    }

    this.api.exportCsv({ filters: this.selectedFilters }).subscribe({
      next: (blob) => {
        this.logFlow('preview', 'Exporting preview CSV.', { size: blob.size });
        this.downloadBlob(blob, 'review_packets.csv');
      },
      error: (err) => {
        this.logFlow('preview:error', 'Preview CSV export failed.', err?.error || err?.message);
        this.showError(err?.error?.detail || 'Failed to export CSV.');
      }
    });
  }

  loadReviewIdsFromDump(): void {
    this.logFlow('collaborator', 'Loading review IDs from dump.');
    this.api.getCollaboratorReviewIds().subscribe({
      next: (response) => {
        this.reviewIds = response.review_ids;
        this.reviewIdsText = this.reviewIds.join(', ');
        this.logFlow('collaborator', 'Review IDs loaded from dump.', { count: this.reviewIds.length });
        this.showInfo(`Loaded ${this.reviewIds.length} review IDs from Review Info.`);
      },
      error: (err) => {
        this.logFlow('collaborator:error', 'Failed to load review IDs from dump.', err?.error || err?.message);
        this.showError(err?.error?.detail || 'Failed to extract review IDs.');
      }
    });
  }

  applyReviewIdsFromText(): void {
    const raw = this.reviewIdsText.split(/[,;\n\t ]+/g).map((item) => item.trim()).filter((item) => item);
    this.reviewIds = Array.from(new Set(raw));
    this.logFlow('collaborator', 'Review IDs updated from text.', { count: this.reviewIds.length });
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
    this.logFlow('collaborator', 'Opening collaborator login window.', { loginUrl });
    await api.openLogin(loginUrl);
    this.showInfo('Collaborator login window opened. Complete SSO + MFA there.');
  }

  async fetchAndValidateCollaborator(): Promise<void> {
    const ready = await this.ensureCollaboratorConfig();
    if (!ready || !this.collaboratorConfig) {
      return;
    }

    if (this.reviewIds.length === 0) {
      this.logFlow('collaborator:error', 'Fetch rejected: no review IDs.');
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
    this.logFlow('collaborator', 'Starting collaborator fetch + validate.', {
      reviewCount: this.reviewIds.length,
      selectedFields: this.collaboratorSelectedFields
    });

    try {
      const reviewPayload: ReviewHtmlItem[] = [];
      const total = this.reviewIds.length;
      this.ensureSelectedFieldsForValidation();

      for (let i = 0; i < total; i++) {
        const reviewId = this.reviewIds[i];
        const response = await api.fetchReviewData(this.collaboratorConfig.base_url, reviewId, {
          username: this.collaboratorUsername,
          ticket: this.collaboratorTicket,
          cookie: this.collaboratorCookie,
          jsonApiPath: this.collaboratorConfig.json_api_path
        });
        if (response?.error) {
          this.logFlow('collaborator:error', 'Collaborator JSON API fetch failed.', { reviewId, error: response.error });
          throw new Error(response.error.message || `Failed to fetch data for review ${reviewId}`);
        }
        this.logFlow('collaborator:fetch:raw', 'Collaborator JSON payload received.', {
          reviewId,
          preview: this.safeStringify(response?.data, 2000)
        });
        reviewPayload.push({ review_id: reviewId, data: response.data || {} });
        this.fetchProgress = Math.round(((i + 1) * 100) / total);
        this.logFlow('collaborator:fetch', 'Fetched collaborator JSON payload.', {
          reviewId,
          progress: this.fetchProgress,
          keys: Object.keys(response?.data || {}).length
        });
      }

      const parseResponse = await firstValueFrom(
        this.api.parseValidateCollaboratorReviews(this.collaboratorSelectedFields, reviewPayload)
      );

      this.availableCollaboratorFields = parseResponse?.available_fields || [];
      if (this.collaboratorSelectedFields.length === 0) {
        this.collaboratorSelectedFields = [...this.availableCollaboratorFields];
      }
      this.collaboratorResults = parseResponse?.results || [];
      this.collaboratorResults.forEach((row) => {
        this.logFlow('collaborator:data', 'Parsed collaborator field values.', {
          reviewId: row.review_id,
          fieldValues: row.field_values,
          status: row.status,
          missingFields: row.missing_fields
        });
      });
      this.logFlow('collaborator', 'Parse + validate completed.', {
        availableFields: this.availableCollaboratorFields.length,
        results: this.collaboratorResults.length,
        complete: this.collaboratorResults.filter((x) => x.status === 'Complete').length
      });
      this.showInfo(`Validated ${this.collaboratorResults.length} reviews.`);
    } catch (error: any) {
      this.logFlow('collaborator:error', 'Fetch + validate failed.', error?.error || error?.message || error);
      this.showError(error?.message || 'Collaborator fetch/validation failed.');
    } finally {
      this.isLoading = false;
    }
  }

  exportCollaboratorCsv(): void {
    if (this.collaboratorResults.length === 0) {
      this.logFlow('collaborator:error', 'Collaborator CSV export rejected: no results.');
      this.showError('No Collaborator results to export.');
      return;
    }

    this.api.exportCollaboratorCsv(this.collaboratorSelectedFields, this.collaboratorResults).subscribe({
      next: (blob) => {
        this.logFlow('collaborator', 'Exporting collaborator CSV.', { size: blob.size });
        this.downloadBlob(blob, 'collaborator_validation.csv');
      },
      error: (err) => {
        this.logFlow('collaborator:error', 'Collaborator CSV export failed.', err?.error || err?.message);
        this.showError(err?.error?.detail || 'Failed to export Collaborator CSV.');
      }
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
      this.logFlow('collaborator:error', 'PDF download rejected: no complete reviews.');
      this.showError('No complete reviews available for PDF download.');
      return;
    }

    const plan = await firstValueFrom(this.api.getPdfPlan(eligibleIds));
    const jobs: PdfPlanItem[] = plan?.jobs || [];
    this.logFlow('collaborator', 'PDF plan created.', { eligibleIds: eligibleIds.length, jobs: jobs.length, outputDir: plan?.output_dir });
    const result = await api.downloadPdfs(jobs);
    this.logFlow('collaborator', 'PDF download finished.', result);
    this.showInfo(`PDF complete: ${result.downloaded.length} success, ${result.failed.length} failed.`);
  }

  private async ensureCollaboratorConfig(): Promise<boolean> {
    if (this.collaboratorConfig) {
      return true;
    }

    try {
      this.collaboratorConfig = await firstValueFrom(this.api.getCollaboratorConfig());
      this.logFlow('collaborator', 'Collaborator config loaded on demand.', this.collaboratorConfig);
      return true;
    } catch (error: any) {
      const detail = error?.error?.detail || error?.message || 'Failed to load Collaborator config.';
      this.logFlow('collaborator:error', 'Failed to load collaborator config.', detail);
      this.showError(detail);
      return false;
    }
  }

  private ensureSelectedFieldsForValidation(): void {
    if (this.collaboratorSelectedFields.length > 0) {
      return;
    }
    this.collaboratorSelectedFields = [...this.collaboratorDefaultFields];
    this.logFlow('collaborator', 'Selected fields were empty. Applied default fields.', this.collaboratorSelectedFields);
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

  fieldColumnName(field: string): string {
    return `field__${field}`;
  }

  get collaboratorDisplayedColumns(): string[] {
    const selectedFieldColumns = this.collaboratorSelectedFields.map((field) => this.fieldColumnName(field));
    return ['review_id', ...selectedFieldColumns, 'status', 'missing_fields', 'comment'];
  }

  private showError(message: string): void {
    this.logFlow('ui:error', message);
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }

  private showInfo(message: string): void {
    this.logFlow('ui', message);
    this.snackBar.open(message, 'OK', { duration: 3000 });
  }

  private logFlow(scope: string, message: string, metadata?: any): void {
    const api = (window as any).reviewpackets;
    if (api?.log) {
      api.log(scope, message, metadata).catch(() => {});
    }
    // Keep browser-dev logs too for local troubleshooting.
    if (metadata !== undefined) {
      console.log(`[${scope}] ${message}`, metadata);
    } else {
      console.log(`[${scope}] ${message}`);
    }
  }

  private safeStringify(value: any, maxLength: number): string {
    try {
      const text = JSON.stringify(value);
      if (text.length <= maxLength) {
        return text;
      }
      return `${text.slice(0, maxLength)}...`;
    } catch {
      return String(value ?? '');
    }
  }
}
