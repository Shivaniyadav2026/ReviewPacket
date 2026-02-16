import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormGroup } from '@angular/forms';
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

import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
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
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'review_packets.csv';
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.showError(err?.error?.detail || 'Failed to export CSV.')
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }

  private showInfo(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3000 });
  }
}
