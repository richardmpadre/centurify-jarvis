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
  plannedWorkout?: string | null;
  workoutCompleted?: boolean | null;
}

interface PlannedExercise {
  name: string;
  sets: number;
  reps: string;
  weight: string;
  notes: string;
}

interface PlannedWorkout {
  type: string;
  targetDuration: number;
  exercises: PlannedExercise[];
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
  editingId: string | null = null;
  
  // Dashboard
  selectedDate: string = this.getLocalDateString(new Date());
  currentEntry: any = null;
  isLoadingDashboard = false;
  
  // Helper to get local date string (YYYY-MM-DD) without timezone issues
  private getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Whoop integration
  whoopConnected = false;
  whoopExpired = false;
  whoopExpiryMinutes: number | null = null;
  whoopHasRefreshToken = false;
  whoopLoading = false;
  whoopMessage = '';
  whoopWorkouts: any[] = [];
  
  // Workout planning
  showWorkoutPlanner = false;
  plannedWorkout: PlannedWorkout | null = null;
  workoutForm: FormGroup;
  exercises: PlannedExercise[] = [];
  
  // Whoop workout editing
  editingWhoopWorkout: any = null;
  whoopWorkoutExercises: { [key: string]: PlannedExercise[] } = {};

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private whoopService: WhoopService
  ) {
    this.healthForm = this.fb.group({
      date: [this.selectedDate, Validators.required],
      bp: [''],
      temp: [''],
      strain: [''],
      rhr: [''],
      sleep: [''],
      recovery: [''],
      weight: [''],
      dailyScore: [''],
      workoutCount: [''],
      workoutCalories: [''],
      workoutMinutes: [''],
      trainingNotes: ['']
    });
    
    this.workoutForm = this.fb.group({
      type: ['Strength Training'],
      targetDuration: [60],
      exerciseName: [''],
      exerciseSets: [3],
      exerciseReps: ['8-10'],
      exerciseWeight: [''],
      exerciseNotes: ['']
    });
  }

  async ngOnInit() {
    this.checkWhoopStatus();
    await this.loadEntries();
    await this.loadDashboard();
  }
  
  checkWhoopStatus() {
    this.whoopConnected = this.whoopService.isConnected();
    this.whoopExpired = this.whoopService.hasExpiredToken();
    this.whoopExpiryMinutes = this.whoopService.getTokenExpiryMinutes();
    this.whoopHasRefreshToken = this.whoopService.hasRefreshToken();
  }
  
  reconnectWhoop() {
    this.whoopService.initiateAuth();
  }

  // Workout Planning Methods
  openWorkoutPlanner() {
    this.showWorkoutPlanner = true;
    this.exercises = [];
    
    // Load existing planned workout if any
    if (this.currentEntry?.plannedWorkout) {
      try {
        const planned = JSON.parse(this.currentEntry.plannedWorkout) as PlannedWorkout;
        this.workoutForm.patchValue({
          type: planned.type,
          targetDuration: planned.targetDuration
        });
        this.exercises = planned.exercises || [];
      } catch (e) {
        console.error('Error parsing planned workout:', e);
      }
    }
  }
  
  closeWorkoutPlanner() {
    this.showWorkoutPlanner = false;
  }
  
  addExercise() {
    const form = this.workoutForm.value;
    if (!form.exerciseName?.trim()) return;
    
    this.exercises.push({
      name: form.exerciseName.trim(),
      sets: form.exerciseSets || 3,
      reps: form.exerciseReps || '8-10',
      weight: form.exerciseWeight || '',
      notes: form.exerciseNotes || ''
    });
    
    // Clear exercise fields
    this.workoutForm.patchValue({
      exerciseName: '',
      exerciseWeight: '',
      exerciseNotes: ''
    });
  }
  
  removeExercise(index: number) {
    this.exercises.splice(index, 1);
  }
  
  async saveWorkoutPlan() {
    const form = this.workoutForm.value;
    
    const plannedWorkout: PlannedWorkout = {
      type: form.type,
      targetDuration: form.targetDuration,
      exercises: this.exercises
    };
    
    const plannedWorkoutJson = JSON.stringify(plannedWorkout);
    
    try {
      if (this.currentEntry?.id) {
        // Update existing entry
        await this.healthDataService.updateEntry({
          id: this.currentEntry.id,
          date: this.selectedDate,
          plannedWorkout: plannedWorkoutJson
        });
      } else {
        // Create new entry with just the workout plan
        await this.healthDataService.saveEntry({
          date: this.selectedDate,
          plannedWorkout: plannedWorkoutJson
        });
      }
      
      await this.loadEntries();
      await this.loadDashboard();
      this.showWorkoutPlanner = false;
    } catch (error) {
      console.error('Error saving workout plan:', error);
    }
  }
  
  async toggleWorkoutCompleted() {
    if (!this.currentEntry?.id) return;
    
    try {
      await this.healthDataService.updateEntry({
        id: this.currentEntry.id,
        date: this.selectedDate,
        workoutCompleted: !this.currentEntry.workoutCompleted
      });
      
      await this.loadEntries();
      await this.loadDashboard();
    } catch (error) {
      console.error('Error updating workout status:', error);
    }
  }
  
  getPlannedWorkout(): PlannedWorkout | null {
    if (!this.currentEntry?.plannedWorkout) return null;
    try {
      return JSON.parse(this.currentEntry.plannedWorkout);
    } catch {
      return null;
    }
  }
  
  // Whoop Workout Editing Methods
  openWhoopWorkoutEditor(workout: any) {
    this.editingWhoopWorkout = workout;
    // Load existing exercises for this workout if any
    const workoutKey = this.getWorkoutKey(workout);
    this.exercises = this.whoopWorkoutExercises[workoutKey] ? 
      [...this.whoopWorkoutExercises[workoutKey]] : [];
    
    this.workoutForm.patchValue({
      type: workout.sport,
      targetDuration: workout.duration
    });
  }
  
  closeWhoopWorkoutEditor() {
    this.editingWhoopWorkout = null;
    this.exercises = [];
  }
  
  getWorkoutKey(workout: any): string {
    // Use start time as unique key for the workout
    return workout.startTime || workout.id || `workout-${workout.sport}`;
  }
  
  async saveWhoopWorkoutExercises() {
    if (!this.editingWhoopWorkout) return;
    
    const workoutKey = this.getWorkoutKey(this.editingWhoopWorkout);
    this.whoopWorkoutExercises[workoutKey] = [...this.exercises];
    
    // Store in the health entry's trainingNotes as JSON with workout details
    const workoutDetails = {
      ...this.whoopWorkoutExercises
    };
    
    try {
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({
          id: this.currentEntry.id,
          date: this.selectedDate,
          trainingNotes: JSON.stringify(workoutDetails)
        });
      } else {
        await this.healthDataService.saveEntry({
          date: this.selectedDate,
          trainingNotes: JSON.stringify(workoutDetails)
        });
      }
      
      await this.loadEntries();
      await this.loadDashboard();
      this.closeWhoopWorkoutEditor();
    } catch (error) {
      console.error('Error saving workout exercises:', error);
    }
  }
  
  getWhoopWorkoutExercises(workout: any): PlannedExercise[] {
    const workoutKey = this.getWorkoutKey(workout);
    return this.whoopWorkoutExercises[workoutKey] || [];
  }
  
  loadWhoopWorkoutExercises() {
    // Load exercises from trainingNotes if it's JSON
    if (this.currentEntry?.trainingNotes) {
      try {
        const parsed = JSON.parse(this.currentEntry.trainingNotes);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          this.whoopWorkoutExercises = parsed;
        }
      } catch {
        // Not JSON, it's plain text notes - leave whoopWorkoutExercises empty
        this.whoopWorkoutExercises = {};
      }
    } else {
      this.whoopWorkoutExercises = {};
    }
  }

  // Dashboard Methods
  async loadDashboard() {
    this.isLoadingDashboard = true;
    this.whoopWorkouts = [];
    
    try {
      // Find entry for selected date
      this.currentEntry = this.entries.find(e => e.date === this.selectedDate) || null;
      
      // Load saved workout exercises
      this.loadWhoopWorkoutExercises();
      
      // If Whoop connected, fetch today's workouts
      if (this.whoopConnected) {
        await this.loadWhoopDashboard();
      }
    } finally {
      this.isLoadingDashboard = false;
    }
  }

  async loadWhoopDashboard() {
    try {
      const workoutData = await this.whoopService.getWorkouts(this.selectedDate, this.selectedDate);
      const workouts = workoutData?.records || [];
      
      this.whoopWorkouts = workouts.map((w: any) => {
        const calories = w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : 0;
        let minutes = 0;
        if (w.start && w.end) {
          minutes = Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / (1000 * 60));
        }
        
        const sportName = (w.sport_name || 'Unknown')
          .replace(/_msk$/, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        
        return {
          sport: sportName,
          strain: w.score?.strain ? Math.round(w.score.strain * 10) / 10 : 0,
          duration: minutes,
          calories: calories,
          avgHR: w.score?.average_heart_rate || 0,
          maxHR: w.score?.max_heart_rate || 0,
          startTime: w.start ? new Date(w.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        };
      });
    } catch (error) {
      console.error('Error loading Whoop dashboard:', error);
    }
  }

  prevDay() {
    const date = new Date(this.selectedDate + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    this.selectedDate = this.getLocalDateString(date);
    this.loadDashboard();
  }

  nextDay() {
    const date = new Date(this.selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + 1);
    this.selectedDate = this.getLocalDateString(date);
    this.loadDashboard();
  }

  goToToday() {
    this.selectedDate = this.getLocalDateString(new Date());
    this.loadDashboard();
  }

  isToday(): boolean {
    return this.selectedDate === this.getLocalDateString(new Date());
  }

  getFormattedDate(): string {
    const date = new Date(this.selectedDate + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (this.selectedDate === this.getLocalDateString(today)) {
      return 'Today';
    } else if (this.selectedDate === this.getLocalDateString(yesterday)) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
    } else {
      this.editingId = null;
    }
  }

  resetForm() {
    this.healthForm.reset({
      date: this.selectedDate,
      bp: '',
      temp: '',
      strain: '',
      rhr: '',
      sleep: '',
      recovery: '',
      weight: '',
      dailyScore: '',
      workoutCount: '',
      workoutCalories: '',
      workoutMinutes: '',
      trainingNotes: ''
    });
    this.saveMessage = '';
    this.whoopMessage = '';
    this.editingId = null;
    this.whoopWorkouts = [];
  }

  editEntry(entry: any) {
    this.editingId = entry.id;
    this.showForm = true;
    this.whoopWorkouts = [];
    
    this.healthForm.patchValue({
      date: entry.date,
      bp: entry.bp || '',
      temp: entry.temp || '',
      strain: entry.strain || '',
      rhr: entry.rhr || '',
      sleep: entry.sleep || '',
      recovery: entry.recovery || '',
      weight: entry.weight || '',
      dailyScore: entry.dailyScore || '',
      workoutCount: entry.workoutCount || '',
      workoutCalories: entry.workoutCalories || '',
      workoutMinutes: entry.workoutMinutes || '',
      trainingNotes: entry.trainingNotes || ''
    });
  }

  addEntryForDate() {
    this.editingId = null;
    this.showForm = true;
    this.healthForm.patchValue({ date: this.selectedDate });
  }

  async importFromWhoop() {
    this.addEntryForDate();
    setTimeout(() => this.fetchFromWhoop(), 100);
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
      
      // Calculate previous day for strain (strain accumulates throughout day, so previous day is complete)
      const prevDate = new Date(selectedDate + 'T12:00:00');
      prevDate.setDate(prevDate.getDate() - 1);
      const previousDay = this.getLocalDateString(prevDate);

      // Fetch data for the selected date
      const recoveryData = await this.whoopService.getRecovery(selectedDate, selectedDate);
      const sleepData = await this.whoopService.getSleep(selectedDate, selectedDate);
      // Fetch strain from previous day (completed day), workouts from selected date
      const cycleData = await this.whoopService.getCycles(previousDay, previousDay);
      const workoutData = await this.whoopService.getWorkouts(selectedDate, selectedDate);
      
      // Log raw responses for debugging
      console.log('Recovery data:', JSON.stringify(recoveryData, null, 2));
      console.log('Sleep data:', JSON.stringify(sleepData, null, 2));
      console.log('Cycle data (previous day):', JSON.stringify(cycleData, null, 2));
      console.log('Workout data:', JSON.stringify(workoutData, null, 2));
      
      // Get first record from each (already filtered by date in API)
      const recoveryRecord = recoveryData?.records?.[0];
      const sleepRecord = sleepData?.records?.[0];
      const cycleRecord = cycleData?.records?.[0];
      const workouts = workoutData?.records || [];

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

      // Update Sleep (performance percentage)
      if (sleepRecord?.score?.sleep_performance_percentage != null) {
        this.healthForm.patchValue({ sleep: sleepRecord.score.sleep_performance_percentage });
        fieldsUpdated++;
      }

      // Update Strain
      if (cycleRecord?.score?.strain != null) {
        this.healthForm.patchValue({ strain: Math.round(cycleRecord.score.strain * 10) / 10 });
        fieldsUpdated++;
      }

      // Update Workouts
      this.whoopWorkouts = [];
      if (workouts.length > 0) {
        const workoutCount = workouts.length;
        let totalCalories = 0;
        let totalMinutes = 0;
        
        workouts.forEach((w: any) => {
          const calories = w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : 0;
          let minutes = 0;
          if (w.start && w.end) {
            minutes = Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / (1000 * 60));
          }
          
          totalCalories += calories;
          totalMinutes += minutes;
          
          // Format sport name (remove _msk suffix and capitalize)
          const sportName = (w.sport_name || 'Unknown')
            .replace(/_msk$/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          
          this.whoopWorkouts.push({
            sport: sportName,
            strain: w.score?.strain ? Math.round(w.score.strain * 10) / 10 : 0,
            duration: minutes,
            calories: calories,
            avgHR: w.score?.average_heart_rate || 0,
            maxHR: w.score?.max_heart_rate || 0,
            startTime: w.start ? new Date(w.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
          });
        });
        
        this.healthForm.patchValue({ 
          workoutCount: workoutCount,
          workoutCalories: Math.round(totalCalories),
          workoutMinutes: Math.round(totalMinutes)
        });
        fieldsUpdated += 3;
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

      const entry: any = {
        date: formValue.date,
        bp: formValue.bp || undefined,
        temp: formValue.temp ? parseFloat(formValue.temp) : undefined,
        strain: formValue.strain ? parseFloat(formValue.strain) : undefined,
        rhr: formValue.rhr ? parseFloat(formValue.rhr) : undefined,
        sleep: formValue.sleep ? parseFloat(formValue.sleep) : undefined,
        recovery: formValue.recovery ? parseFloat(formValue.recovery) : undefined,
        weight: formValue.weight ? parseFloat(formValue.weight) : undefined,
        dailyScore: formValue.dailyScore ? parseFloat(formValue.dailyScore) : undefined,
        workoutCount: formValue.workoutCount ? parseInt(formValue.workoutCount) : undefined,
        workoutCalories: formValue.workoutCalories ? parseFloat(formValue.workoutCalories) : undefined,
        workoutMinutes: formValue.workoutMinutes ? parseFloat(formValue.workoutMinutes) : undefined,
        trainingNotes: formValue.trainingNotes || undefined
      };

      try {
        if (this.editingId) {
          // Update existing entry
          entry.id = this.editingId;
          await this.healthDataService.updateEntry(entry);
          this.saveMessage = 'Entry updated!';
        } else {
          // Create new entry
          await this.healthDataService.saveEntry(entry);
          this.saveMessage = 'Entry saved!';
        }
        await this.loadEntries();
        await this.loadDashboard();
        setTimeout(() => {
          this.showForm = false;
          this.saveMessage = '';
          this.editingId = null;
        }, 1000);
      } catch (error) {
        this.saveMessage = this.editingId ? 'Error updating entry.' : 'Error saving entry.';
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
        await this.loadDashboard();
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  }
}

