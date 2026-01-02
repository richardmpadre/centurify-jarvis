import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HealthDataService } from '../services/health-data.service';
import { WhoopService } from '../services/whoop.service';

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
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
  
  // Whoop integration
  whoopConnected = false;
  whoopLoading = false;
  whoopMessage = '';

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private whoopService: WhoopService
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
    this.whoopConnected = this.whoopService.isConnected();
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
    this.whoopMessage = '';
  }

  async fetchFromWhoop() {
    if (!this.whoopConnected) return;
    
    this.whoopLoading = true;
    this.whoopMessage = '';
    
    try {
      const selectedDate = this.healthForm.get('date')?.value;
      if (!selectedDate) {
        this.whoopMessage = 'Please select a date first';
        this.whoopLoading = false;
        return;
      }
      
      // Fetch data for the selected date (use a range of that day)
      const recoveryData = await this.whoopService.getRecovery(selectedDate, selectedDate);
      const sleepData = await this.whoopService.getSleep(selectedDate, selectedDate);
      const cycleData = await this.whoopService.getCycles(selectedDate, selectedDate);
      
      // Log raw responses for debugging
      console.log('Recovery data:', JSON.stringify(recoveryData, null, 2));
      console.log('Sleep data:', JSON.stringify(sleepData, null, 2));
      console.log('Cycle data:', JSON.stringify(cycleData, null, 2));
      
      // Get first record from each (already filtered by date in API)
      const recoveryRecord = recoveryData?.records?.[0];
      const sleepRecord = sleepData?.records?.[0];
      const cycleRecord = cycleData?.records?.[0];

      let fieldsUpdated = 0;

      // Update Recovery
      if (recoveryRecord?.score?.recovery_score != null) {
        this.healthForm.patchValue({ recovery: recoveryRecord.score.recovery_score });
        fieldsUpdated++;
      }

      // Update RHR
      if (recoveryRecord?.score?.resting_heart_rate != null) {
        this.healthForm.patchValue({ rhr: recoveryRecord.score.resting_heart_rate });
        fieldsUpdated++;
      }

      // Update Sleep (convert milliseconds to hours)
      if (sleepRecord?.score?.stage_summary?.total_in_bed_time_milli != null) {
        const sleepHours = sleepRecord.score.stage_summary.total_in_bed_time_milli / (1000 * 60 * 60);
        this.healthForm.patchValue({ sleep: Math.round(sleepHours * 10) / 10 });
        fieldsUpdated++;
      }

      // Update Strain
      if (cycleRecord?.score?.strain != null) {
        this.healthForm.patchValue({ strain: Math.round(cycleRecord.score.strain * 10) / 10 });
        fieldsUpdated++;
      }

      if (fieldsUpdated > 0) {
        this.whoopMessage = `Imported ${fieldsUpdated} field(s) from Whoop`;
      } else {
        this.whoopMessage = `No Whoop data found for ${selectedDate}`;
      }
    } catch (error: any) {
      console.error('Whoop fetch error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      this.whoopMessage = `Error: ${error.message || 'Failed to fetch Whoop data'}`;
    } finally {
      this.whoopLoading = false;
    }
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

