import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HealthDataService } from '../services/health-data.service';

interface HealthEntry {
  id: string;
  date: string;
  bp?: string | null;
  temp?: number | null;
  strain?: number | null;
  rhr?: number | null;
  sleep?: number | null;
  recovery?: number | null;
  weight?: number | null;
  dailyScore?: number | null;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  healthForm: FormGroup;
  saveMessage = '';
  isLoading = false;
  isLoadingEntries = true;
  showForm = false;
  entries: HealthEntry[] = [];

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService
  ) {
    this.healthForm = this.fb.group({
      date: [new Date().toISOString().split('T')[0], Validators.required],
      bp: [''],
      temp: [''],
      strain: [''],
      rhr: [''],
      sleep: [''],
      recovery: [''],
      weight: [''],
      dailyScore: ['']
    });
  }

  async ngOnInit() {
    await this.loadEntries();
  }

  async loadEntries() {
    this.isLoadingEntries = true;
    try {
      const data = await this.healthDataService.getAllEntries();
      this.entries = (data || []).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error loading entries:', error);
      this.entries = [];
    } finally {
      this.isLoadingEntries = false;
    }
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.resetForm();
    }
  }

  resetForm() {
    this.healthForm.reset({
      date: new Date().toISOString().split('T')[0],
      bp: '',
      temp: '',
      strain: '',
      rhr: '',
      sleep: '',
      recovery: '',
      weight: '',
      dailyScore: ''
    });
    this.saveMessage = '';
  }

  async onSubmit() {
    if (this.healthForm.valid) {
      this.isLoading = true;
      const formValue = this.healthForm.value;

      const entry = {
        date: formValue.date,
        bp: formValue.bp || undefined,
        temp: formValue.temp ? parseFloat(formValue.temp) : undefined,
        strain: formValue.strain ? parseFloat(formValue.strain) : undefined,
        rhr: formValue.rhr ? parseFloat(formValue.rhr) : undefined,
        sleep: formValue.sleep ? parseFloat(formValue.sleep) : undefined,
        recovery: formValue.recovery ? parseFloat(formValue.recovery) : undefined,
        weight: formValue.weight ? parseFloat(formValue.weight) : undefined,
        dailyScore: formValue.dailyScore ? parseFloat(formValue.dailyScore) : undefined
      };

      try {
        await this.healthDataService.saveEntry(entry);
        this.saveMessage = 'Entry saved!';
        await this.loadEntries();
        setTimeout(() => {
          this.showForm = false;
          this.saveMessage = '';
        }, 1500);
      } catch (error) {
        this.saveMessage = 'Error saving entry.';
        console.error('Save error:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  async deleteEntry(id: string) {
    if (confirm('Delete this entry?')) {
      try {
        await this.healthDataService.deleteEntry(id);
        await this.loadEntries();
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  }
}

