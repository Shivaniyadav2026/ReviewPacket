import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
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
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
    MatProgressSpinnerModule,
    MatProgressBarModule
  ],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private readonly collapsedCellWordLimit = 10;
  revisionVersion = 5;
  dumpFileName = '';
  keysFileName = '';
  headers: string[] = [];
  defaultFilters: string[] = [];
  selectedFilters: string[] = [];
  filterSearchText = '';
  isFilterDropdownOpen = false;
  previewRows: Record<string, string>[] = [];
  displayedColumns: string[] = [];
  isLoading = false;
  isDumpLoading = false;
  dumpLoadProgress = 0;
  expandedPreviewCellId: string | null = null;
  expandedCollaboratorCellId: string | null = null;
  private dumpLoaderStartedAt = 0;
  private dumpLoaderRunId = 0;

  collaboratorConfig: CollaboratorConfigResponse | null = null;
  reviewIds: string[] = [];
  reviewIdsText = '';
  availableCollaboratorFields: string[] = [];
  collaboratorSelectedFields: string[] = [];
  collaboratorResults: ValidationResultItem[] = [];
  fetchProgress = 0;
  collaboratorUsername = '';
  collaboratorTicket = '';
  private readonly collaboratorDefaultFields = [
    'Review Title',
    'Role',
    'Created',
    'Group',
    'Template',
    'Deadline',
    'Completed on',
    'Restricted Access',
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
    'Work Product Type',
    'Checklist'
    
  ];

  form!: FormGroup;
  @ViewChild('filterSearchInput') filterSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('filterDropdownContainer') filterDropdownContainer?: ElementRef<HTMLElement>;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      keysText: ['']
    });
    this.logFlow('app', 'UI revision initialized.', { revision: this.revisionVersion });
    this.loadDefaults();
    this.loadCollaboratorConfig();
    this.loadStoredCollaboratorAuth();
  }

  loadDefaults(): void {
    this.logFlow('app', 'Loading default filters.');
    this.api.getDefaultFilters().subscribe({
      next: (filters) => {
        this.defaultFilters = filters;
        this.selectedFilters = this.filterableHeaders.length
          ? this.resolveDefaultFilters()
          : [...filters];
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
    this.startDumpLoader();
    this.logFlow('dump', 'Uploading dump file.', { file: file.name, size: file.size });

    this.api.uploadDump(file)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.finishDumpLoader();
      }))
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total || file.size || 1;
            this.dumpLoadProgress = Math.min(Math.round((event.loaded / total) * 90), 90);
            return;
          }

          if (event.type === HttpEventType.Response && event.body) {
            const response = event.body;
            this.resetForNewDump();
            this.headers = this.consolidateHeaderList(response.columns);
            this.selectedFilters = this.resolveDefaultFilters();
            this.logFlow('dump', 'Dump upload complete.', { rows: response.rows, columns: response.columns.length });
            this.showInfo(`Loaded ${response.rows} rows.`);
          }
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

    if (this.previewRows.length === 0) {
      this.logFlow('preview:error', 'CSV export rejected: no preview rows.');
      this.showError('Generate preview before exporting.');
      return;
    }

    const headers = ['Issue Key', 'Summary', ...this.selectedFilters, 'Comment'];
    const lines = [
      headers.map((header) => this.escapeCsvValue(header)).join(','),
      ...this.previewRows.map((row) =>
        headers.map((header) => this.escapeCsvValue(row[header] || '')).join(',')
      )
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    this.logFlow('preview', 'Exporting preview CSV.', { rows: this.previewRows.length });
    this.downloadBlob(blob, 'review_packets.csv');
  }

  exportCompletedReviewInfoCsv(): void {
    if (this.previewRows.length === 0) {
      this.logFlow('preview:error', 'Review-info CSV export rejected: no preview rows.');
      this.showError('Generate preview before exporting review IDs.');
      return;
    }

    const completedRows = this.previewRows.filter((row) => this.isPreviewRowComplete(row));
    if (completedRows.length === 0) {
      this.logFlow('preview:error', 'Review-info CSV export rejected: no completed rows.');
      this.showError('No preview rows with "Review completed" comment.');
      return;
    }

    const headers = ['Issue Key', 'Review Info', 'Extracted Review IDs'];
    const lines = [
      headers.map((header) => this.escapeCsvValue(header)).join(','),
      ...completedRows.map((row) =>
        [
          row['Issue Key'] || '',
          row['Review Info'] || '',
          this.extractReviewIdsFromReviewInfo(row['Review Info'] || '')
        ]
          .map((value) => this.escapeCsvValue(value))
          .join(',')
      )
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    this.logFlow('preview', 'Exporting completed review-info CSV.', { rows: completedRows.length });
    this.downloadBlob(blob, 'completed_review_info.csv');
  }

  loadReviewIdsFromPreview(): void {
    if (this.previewRows.length === 0) {
      this.logFlow('collaborator:error', 'Load review IDs rejected: preview not generated.');
      this.showError('Generate preview first.');
      return;
    }

    const reviewIds: string[] = [];
    for (const row of this.previewRows) {
      if (!this.isPreviewRowComplete(row)) {
        continue;
      }

      const extracted = this.extractReviewIdsFromReviewInfo(row['Review Info'] || '');
      for (const reviewId of extracted.split(',').map((value) => value.trim()).filter((value) => value)) {
        if (!reviewIds.includes(reviewId)) {
          reviewIds.push(reviewId);
        }
      }
    }

    this.reviewIds = reviewIds;
    this.reviewIdsText = this.reviewIds.join(', ');
    this.logFlow('collaborator', 'Review IDs loaded from preview.', { count: this.reviewIds.length });

    if (this.reviewIds.length === 0) {
      this.showError('No review IDs found in preview rows marked Review completed.');
      return;
    }

    this.showInfo(`Loaded ${this.reviewIds.length} review IDs from completed preview rows.`);
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
        reviewPayload.push({
          review_id: reviewId,
          // Keep request shape compatible with older packaged backends that still expect a dict.
          data: { body: response.data || {} }
        });
        this.fetchProgress = Math.round(((i + 1) * 100) / total);
        this.logFlow('collaborator:fetch', 'Fetched collaborator JSON payload.', {
          reviewId,
          progress: this.fetchProgress,
          keys: Object.keys(response?.data || {}).length
        });
      }

      let parseResponse = await firstValueFrom(
        this.api.parseValidateCollaboratorReviews(this.collaboratorSelectedFields, reviewPayload)
      );

      for (const reviewEntry of reviewPayload) {
        const matchingResult = parseResponse?.results?.find((row) => row.review_id === reviewEntry.review_id);
        if (!matchingResult || matchingResult.missing_fields.length === 0) {
          continue;
        }

        const summaryData = await this.fetchReviewSummaryFallback(reviewEntry.review_id);
        if (!summaryData) {
          continue;
        }

        const refreshedReview = {
          review_id: reviewEntry.review_id,
          data: { body: summaryData }
        };

        const refreshedResponse = await firstValueFrom(
          this.api.parseValidateCollaboratorReviews(this.collaboratorSelectedFields, [refreshedReview])
        );

        const refreshedRow = refreshedResponse?.results?.[0];
        if (refreshedRow) {
          const existingIndex = parseResponse.results.findIndex((row) => row.review_id === refreshedRow.review_id);
          if (existingIndex >= 0) {
            parseResponse.results[existingIndex] = refreshedRow;
          } else {
            parseResponse.results.push(refreshedRow);
          }
        }
      }

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

  get hasCompleteReviews(): boolean {
    return this.collaboratorResults?.some((x) => x.status === 'Complete') || false;
  }

  private async fetchReviewSummaryFallback(reviewId: string): Promise<any | null> {
    const api = this.getElectronCollaboratorApi();
    if (!api?.fetchReviewSummary || !this.collaboratorConfig) {
      return null;
    }

    try {
      const result = await api.fetchReviewSummary(this.collaboratorConfig.base_url, reviewId, {
        username: this.collaboratorUsername,
        ticket: this.collaboratorTicket,
        jsonApiPath: this.collaboratorConfig.json_api_path,
        clientBuild: 14000,
        clientGuid: 'test-client',
        active: true,
        updateToken: null
      });

      if (result?.error) {
        this.logFlow('collaborator:fallback:error', 'Review summary fallback failed.', {
          reviewId,
          error: result.error
        });
        return null;
      }

      return result?.data || null;
    } catch (error: any) {
      this.logFlow('collaborator:fallback:error', 'Unexpected review summary fallback error.', {
        reviewId,
        error: error?.message || error
      });
      return null;
    }
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

  private async loadStoredCollaboratorAuth(): Promise<void> {
    const api = this.getElectronCollaboratorApi();
    if (!api?.getAuth) {
      return;
    }

    try {
      const auth = await api.getAuth();
      this.collaboratorUsername = auth?.username || '';
      this.collaboratorTicket = auth?.ticket || '';
      this.logFlow('collaborator', 'Loaded stored collaborator auth.', {
        username: this.collaboratorUsername ? 'present' : 'empty',
        ticket: this.collaboratorTicket ? 'present' : 'empty'
      });
    } catch (error: any) {
      this.logFlow('collaborator:error', 'Failed to load stored collaborator auth.', error?.message || error);
    }
  }

  fieldColumnName(field: string): string {
    return `field__${field}`;
  }

  get filteredHeaders(): string[] {
    const search = this.filterSearchText.trim().toLowerCase();
    if (!search) {
      return this.filterableHeaders;
    }
    return this.filterableHeaders.filter((header) => header.toLowerCase().includes(search));
  }

  private escapeCsvValue(value: string): string {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
  }

  private truncateWords(value: string, limit: number): string {
    const words = String(value || '').trim().split(/\s+/).filter((word) => word);
    if (words.length <= limit) {
      return value;
    }
    return `${words.slice(0, limit).join(' ')}...`;
  }

  private extractReviewIdsFromReviewInfo(reviewInfo: string): string {
    const text = String(reviewInfo || '').trim();
    if (!text) {
      return '';
    }

    const reviewIds: string[] = [];
    const addId = (value: string): void => {
      if (value && !reviewIds.includes(value)) {
        reviewIds.push(value);
      }
    };

    const patterns = [
      /\breview\s*:?\s*id\s*[=:]\s*(\d{5})\b/gi,
      /\breviewid\s*[=:]\s*(\d{5})\b/gi,
      /\breview\s*packet\s*[:=]\s*(\d{5})\b/gi,
      /\breview\s*#\s*(\d{5})\b/gi,
      /#\s*(\d{5})\b/g
    ];

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        addId(match[1]);
      }
    }

    if (reviewIds.length > 0) {
      return reviewIds.join(', ');
    }

    if (/^\s*\d{5}(\s*[,;]\s*\d{5})*\s*$/.test(text)) {
      for (const match of text.matchAll(/\b(\d{5})\b/g)) {
        addId(match[1]);
      }
    }

    return reviewIds.join(', ');
  }

  get areAllHeadersSelected(): boolean {
    return this.filterableHeaders.length > 0 && this.selectedFilters.length === this.filterableHeaders.length;
  }

  get filterableHeaders(): string[] {
    return this.headers.filter((header) => !this.isReservedPreviewColumn(header));
  }

  get selectedFiltersLabel(): string {
    const count = this.selectedFilters.length;
    if (count === 0) {
      return 'No filters selected';
    }
    if (count === 1) {
      return '1 filter selected';
    }
    return `${count} filters selected`;
  }

  get completedPreviewCount(): number {
    return this.previewRows.filter((row) => this.isPreviewRowComplete(row)).length;
  }

  toggleSelectAllFilters(): void {
    this.selectedFilters = this.areAllHeadersSelected ? [] : [...this.filterableHeaders];
    this.logFlow('preview', 'Toggled select-all filters.', { selectedCount: this.selectedFilters.length });
  }

  openFilterDropdown(): void {
    if (this.isFilterDropdownOpen) {
      return;
    }
    this.isFilterDropdownOpen = true;
  }

  onFilterSearchInput(event: Event): void {
    this.openFilterDropdown();
    this.filterSearchText = (event.target as HTMLInputElement).value;
  }

  toggleFilterSelection(header: string): void {
    if (this.selectedFilters.includes(header)) {
      this.selectedFilters = this.selectedFilters.filter((item) => item !== header);
      return;
    }
    this.selectedFilters = [...this.selectedFilters, header];
  }

  isFilterSelected(header: string): boolean {
    return this.selectedFilters.includes(header);
  }

  closeFilterDropdown(): void {
    this.isFilterDropdownOpen = false;
    this.filterSearchText = '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isFilterDropdownOpen) {
      return;
    }
    const target = event.target as Node | null;
    const container = this.filterDropdownContainer?.nativeElement;
    if (container && target && !container.contains(target)) {
      this.closeFilterDropdown();
    }
  }

  get collaboratorDisplayedColumns(): string[] {
    const selectedFieldColumns = this.collaboratorSelectedFields.map((field) => this.fieldColumnName(field));
    return ['review_id', ...selectedFieldColumns, 'status', 'missing_fields', 'comment'];
  }

  collaboratorCellId(rowIndex: number, column: string): string {
    return `${rowIndex}::${column}`;
  }

  isCollaboratorCellExpanded(rowIndex: number, column: string): boolean {
    return this.expandedCollaboratorCellId === this.collaboratorCellId(rowIndex, column);
  }

  toggleCollaboratorCell(rowIndex: number, column: string): void {
    const cellId = this.collaboratorCellId(rowIndex, column);
    this.expandedCollaboratorCellId = this.expandedCollaboratorCellId === cellId ? null : cellId;
  }

  collaboratorCellDisplayValue(value: string, rowIndex: number, column: string): string {
    if (this.isCollaboratorCellExpanded(rowIndex, column)) {
      return value || '';
    }
    return this.truncateWords(value || '', this.collapsedCellWordLimit);
  }

  previewCellId(rowIndex: number, column: string): string {
    return `${rowIndex}::${column}`;
  }

  isPreviewCellExpanded(rowIndex: number, column: string): boolean {
    return this.expandedPreviewCellId === this.previewCellId(rowIndex, column);
  }

  togglePreviewCell(rowIndex: number, column: string): void {
    const cellId = this.previewCellId(rowIndex, column);
    this.expandedPreviewCellId = this.expandedPreviewCellId === cellId ? null : cellId;
  }

  previewCellDisplayValue(row: Record<string, string>, rowIndex: number, column: string): string {
    const value = row[column] || '';
    if (this.isPreviewCellExpanded(rowIndex, column)) {
      return value;
    }
    return this.truncateWords(value, this.collapsedCellWordLimit);
  }

  isPreviewRowComplete(row: Record<string, string>): boolean {
    const comment = (row['Comment'] || '').trim().toLowerCase();
    return comment === 'review completed' || comment === 'review complete';
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

  private resetForNewDump(): void {
    this.headers = [];
    this.filterSearchText = '';
    this.selectedFilters = [];
    this.previewRows = [];
    this.displayedColumns = [];
    this.expandedPreviewCellId = null;
    this.expandedCollaboratorCellId = null;
    this.keysFileName = '';
    this.form.patchValue({ keysText: '' });
    this.reviewIds = [];
    this.reviewIdsText = '';
    this.availableCollaboratorFields = [];
    this.collaboratorSelectedFields = [];
    this.collaboratorResults = [];
    this.fetchProgress = 0;
    this.logFlow('dump', 'Cleared previous dump state and fetched data.');
  }

  private startDumpLoader(): void {
    this.dumpLoaderRunId += 1;
    this.dumpLoaderStartedAt = Date.now();
    this.isDumpLoading = true;
    this.dumpLoadProgress = 0;
    this.logFlow('dump', 'Dump loader started.', { minVisibleMs: 2000 });
  }

  private finishDumpLoader(): void {
    const runId = this.dumpLoaderRunId;
    const elapsed = Date.now() - this.dumpLoaderStartedAt;
    const remaining = Math.max(0, 2000 - elapsed);

    window.setTimeout(() => {
      if (runId !== this.dumpLoaderRunId) {
        return;
      }
      this.dumpLoadProgress = 100;
      this.isDumpLoading = false;
      this.logFlow('dump', 'Dump loader stopped.', { elapsedMs: Date.now() - this.dumpLoaderStartedAt });
    }, remaining);
  }

  private isReservedPreviewColumn(header: string): boolean {
    const normalized = header.trim().toLowerCase();
    return normalized === 'issue key' || normalized === 'summary';
  }

  private consolidateHeaderList(headers: string[]): string[] {
    const seen = new Set<string>();
    const consolidated: string[] = [];

    for (const header of headers) {
      const normalized = this.normalizeHeaderLabel(header);
      if (seen.has(normalized.toLowerCase())) {
        continue;
      }
      seen.add(normalized.toLowerCase());
      consolidated.push(normalized);
    }

    return consolidated;
  }

  private normalizeHeaderLabel(header: string): string {
    return header.trim().replace(/\.\d+$/, '');
  }

  private resolveDefaultFilters(): string[] {
    const selected: string[] = [];
    for (const defaultFilter of this.defaultFilters) {
      const matchedHeader = this.filterableHeaders.find(
        (header) => this.normalizeFilterMatchKey(header) === this.normalizeFilterMatchKey(defaultFilter)
      );
      if (matchedHeader && !selected.includes(matchedHeader)) {
        selected.push(matchedHeader);
      }
    }
    return selected;
  }

  private normalizeFilterMatchKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^custom field\s*\(/, '')
      .replace(/\)$/, '')
      .replace(/^components\//, 'component/')
      .replace(/\s+/g, ' ');
  }
}
