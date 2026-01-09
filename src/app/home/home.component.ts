import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HealthDataService } from '../services/health-data.service';
import { WhoopService } from '../services/whoop.service';
import { 
  HealthEntry, 
  PlannedExercise, 
  PlannedWorkout, 
  MorningChecklistItem, 
  DailyChecklist,
  WhoopWorkout 
} from '../models/health.models';
import { 
  getLocalDateString, 
  getFormattedDisplayDate, 
  getPreviousDay, 
  getNextDay, 
  isToday 
} from '../utils/date-utils';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  // Form state
  healthForm: FormGroup;
  workoutForm: FormGroup;
  saveMessage = '';
  whoopMessage = '';
  isLoading = false;
  isLoadingEntries = true;
  isLoadingDashboard = false;
  whoopLoading = false;
  showForm = false;
  showWorkoutPlanner = false;
  editingId: string | null = null;
  editingWhoopWorkout: WhoopWorkout | null = null;
  
  // Data
  entries: HealthEntry[] = [];
  currentEntry: HealthEntry | null = null;
  selectedDate = getLocalDateString(new Date());
  exercises: PlannedExercise[] = [];
  whoopWorkouts: WhoopWorkout[] = [];
  whoopWorkoutExercises: { [key: string]: PlannedExercise[] } = {};
  
  // Whoop status
  whoopConnected = false;
  whoopExpired = false;
  whoopExpiryMinutes: number | null = null;
  whoopHasRefreshToken = false;
  
  // Merge workflow
  showMergePrompt = false;
  whoopToMerge: WhoopWorkout | null = null;
  
  // Morning checklist
  morningChecklistItems: MorningChecklistItem[] = [
    { id: 'biometrics', title: 'Load Biometrics', description: 'Import health data from Whoop', icon: '📊' },
    { id: 'workout', title: 'Plan Workout', description: 'Schedule training for the day', icon: '🏋️' },
    { id: 'nutrition', title: 'Plan Nutrition', description: 'Log meals in MyFitnessPal', icon: '🥗' },
    { id: 'lifeEvents', title: 'Organize Life Events', description: 'Review and plan life tasks', icon: '📋' },
    { id: 'jarvis', title: 'Iterate Jarvis', description: 'Work on Jarvis improvements', icon: '🤖' }
  ];
  
  dailyChecklist: DailyChecklist = {
    biometricsLoaded: false,
    workoutPlanned: false,
    nutritionPlanned: false,
    lifeEventsOrganized: false,
    jarvisIterated: false
  };

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
      dailyScore: ['']
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

  // ==================== WHOOP STATUS ====================
  
  checkWhoopStatus() {
    this.whoopConnected = this.whoopService.isConnected();
    this.whoopExpired = this.whoopService.hasExpiredToken();
    this.whoopExpiryMinutes = this.whoopService.getTokenExpiryMinutes();
    this.whoopHasRefreshToken = this.whoopService.hasRefreshToken();
  }
  
  reconnectWhoop() {
    this.whoopService.initiateAuth();
  }

  // ==================== DATE NAVIGATION ====================
  
  prevDay() {
    this.selectedDate = getPreviousDay(this.selectedDate);
    this.loadDashboard();
  }

  nextDay() {
    this.selectedDate = getNextDay(this.selectedDate);
    this.loadDashboard();
  }

  goToToday() {
    this.selectedDate = getLocalDateString(new Date());
    this.loadDashboard();
  }

  isToday(): boolean {
    return isToday(this.selectedDate);
  }

  getFormattedDate(): string {
    return getFormattedDisplayDate(this.selectedDate);
  }

  // ==================== MORNING CHECKLIST ====================
  
  loadDailyChecklist() {
    if (this.currentEntry?.morningChecklist) {
      try {
        this.dailyChecklist = JSON.parse(this.currentEntry.morningChecklist);
      } catch {
        this.resetChecklist();
      }
    } else {
      this.dailyChecklist = {
        biometricsLoaded: this.currentEntry?.recovery != null || this.currentEntry?.strain != null,
        workoutPlanned: this.getPlannedWorkout() !== null,
        nutritionPlanned: false,
        lifeEventsOrganized: false,
        jarvisIterated: false
      };
    }
  }
  
  private resetChecklist() {
    this.dailyChecklist = { biometricsLoaded: false, workoutPlanned: false, nutritionPlanned: false, lifeEventsOrganized: false, jarvisIterated: false };
  }
  
  async handleChecklistItem(itemId: string) {
    switch (itemId) {
      case 'biometrics': await this.loadBiometrics(); break;
      case 'workout': this.openWorkoutPlanner(); break;
      case 'nutrition': this.openNutritionPlanner(); break;
      case 'lifeEvents': this.openLifeEvents(); break;
      case 'jarvis': this.openJarvisTrello(); break;
    }
  }
  
  async loadBiometrics() {
    if (!this.whoopConnected) {
      this.addEntryForDate();
    } else {
      await this.importFromWhoop();
    }
    await this.updateChecklistItem('biometricsLoaded', true);
  }
  
  openNutritionPlanner() {
    window.open('https://www.myfitnesspal.com/food/diary', '_blank');
    this.updateChecklistItem('nutritionPlanned', true);
  }
  
  openLifeEvents() {
    window.open('https://docs.google.com/document/d/1H0-yjnxuFXoHDBXiF5moIkYSLhXucWRB1FJWSsFi6vU/edit?tab=t.0', '_blank');
    this.updateChecklistItem('lifeEventsOrganized', true);
  }
  
  openJarvisTrello() {
    window.open('https://trello.com/b/piRDYqCn/jarvis', '_blank');
    this.updateChecklistItem('jarvisIterated', true);
  }
  
  async updateChecklistItem(key: keyof DailyChecklist, value: boolean) {
    this.dailyChecklist[key] = value;
    const checklistJson = JSON.stringify(this.dailyChecklist);
    
    try {
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({
          id: this.currentEntry.id,
          date: this.selectedDate,
          morningChecklist: checklistJson
        });
      } else {
        await this.healthDataService.saveEntry({
          date: this.selectedDate,
          morningChecklist: checklistJson
        });
      }
      await this.loadEntries();
      this.currentEntry = this.entries.find(e => e.date === this.selectedDate) || null;
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  }
  
  isChecklistItemComplete(itemId: string): boolean {
    switch (itemId) {
      case 'biometrics': return this.dailyChecklist.biometricsLoaded;
      case 'workout': return this.dailyChecklist.workoutPlanned || this.getPlannedWorkout() !== null;
      case 'nutrition': return this.dailyChecklist.nutritionPlanned;
      case 'lifeEvents': return this.dailyChecklist.lifeEventsOrganized;
      case 'jarvis': return this.dailyChecklist.jarvisIterated;
      default: return false;
    }
  }
  
  getChecklistProgress(): number {
    let completed = 0;
    this.morningChecklistItems.forEach(item => {
      if (this.isChecklistItemComplete(item.id)) completed++;
    });
    return Math.round((completed / this.morningChecklistItems.length) * 100);
  }

  // ==================== WORKOUT PLANNING ====================
  
  openWorkoutPlanner() {
    this.showWorkoutPlanner = true;
    this.exercises = [];
    
    if (this.currentEntry?.plannedWorkout) {
      try {
        const planned = JSON.parse(this.currentEntry.plannedWorkout) as PlannedWorkout;
        this.workoutForm.patchValue({ type: planned.type, targetDuration: planned.targetDuration });
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
    
    this.workoutForm.patchValue({ exerciseName: '', exerciseWeight: '', exerciseNotes: '' });
  }
  
  removeExercise(index: number) {
    this.exercises.splice(index, 1);
  }
  
  copyLastWorkout() {
    // Find most recent entry with exercises (planned or from Whoop)
    for (const entry of this.entries) {
      if (entry.date === this.selectedDate) continue;
      
      // Check planned workout first
      if (entry.plannedWorkout) {
        try {
          const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
          if (planned.exercises?.length > 0) {
            this.exercises = planned.exercises.map(e => ({ ...e }));
            this.workoutForm.patchValue({ 
              type: planned.type,
              targetDuration: planned.targetDuration 
            });
            return;
          }
        } catch { /* skip */ }
      }
      
      // Check Whoop workout exercises (trainingNotes)
      if (entry.trainingNotes) {
        try {
          const workoutExercises = JSON.parse(entry.trainingNotes);
          if (typeof workoutExercises === 'object') {
            const keys = Object.keys(workoutExercises);
            for (const key of keys) {
              if (workoutExercises[key]?.length > 0) {
                this.exercises = workoutExercises[key].map((e: PlannedExercise) => ({ ...e }));
                return;
              }
            }
          }
        } catch { /* skip */ }
      }
    }
  }
  
  hasLastWorkout(): boolean {
    return this.entries.some(entry => {
      if (entry.date === this.selectedDate) return false;
      
      // Check planned workout
      if (entry.plannedWorkout) {
        try {
          const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
          if (planned.exercises?.length > 0) return true;
        } catch { /* skip */ }
      }
      
      // Check Whoop workout exercises
      if (entry.trainingNotes) {
        try {
          const workoutExercises = JSON.parse(entry.trainingNotes);
          if (typeof workoutExercises === 'object') {
            return Object.values(workoutExercises).some((ex: any) => ex?.length > 0);
          }
        } catch { /* skip */ }
      }
      
      return false;
    });
  }
  
  // Migration: rename workout types in database
  async migrateWorkoutType(oldType: string, newType: string) {
    let updated = 0;
    for (const entry of this.entries) {
      if (!entry.plannedWorkout) continue;
      
      try {
        const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
        if (planned.type === oldType) {
          planned.type = newType;
          await this.healthDataService.updateEntry({
            id: entry.id,
            date: entry.date,
            plannedWorkout: JSON.stringify(planned)
          });
          updated++;
        }
      } catch { /* skip */ }
    }
    
    if (updated > 0) {
      await this.loadEntries();
      await this.loadDashboard();
      console.log(`Migrated ${updated} entries from "${oldType}" to "${newType}"`);
    }
    return updated;
  }
  
  async saveWorkoutPlan() {
    const form = this.workoutForm.value;
    const plannedWorkout: PlannedWorkout = {
      type: form.type,
      targetDuration: form.targetDuration,
      exercises: this.exercises
    };
    
    this.dailyChecklist.workoutPlanned = true;
    
    try {
      const payload = {
        date: this.selectedDate,
        plannedWorkout: JSON.stringify(plannedWorkout),
        morningChecklist: JSON.stringify(this.dailyChecklist)
      };
      
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({ id: this.currentEntry.id, ...payload });
      } else {
        await this.healthDataService.saveEntry(payload);
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

  // ==================== WHOOP WORKOUT EDITING ====================
  
  openWhoopWorkoutEditor(workout: WhoopWorkout) {
    this.editingWhoopWorkout = workout;
    const workoutKey = this.getWorkoutKey(workout);
    this.exercises = this.whoopWorkoutExercises[workoutKey] ? [...this.whoopWorkoutExercises[workoutKey]] : [];
    this.workoutForm.patchValue({ type: workout.sport, targetDuration: workout.duration });
  }
  
  closeWhoopWorkoutEditor() {
    this.editingWhoopWorkout = null;
    this.exercises = [];
  }
  
  getWorkoutKey(workout: WhoopWorkout): string {
    return workout.startTime || `workout-${workout.sport}`;
  }
  
  async saveWhoopWorkoutExercises() {
    if (!this.editingWhoopWorkout) return;
    
    const workoutKey = this.getWorkoutKey(this.editingWhoopWorkout);
    this.whoopWorkoutExercises[workoutKey] = [...this.exercises];
    
    try {
      const payload = {
        date: this.selectedDate,
        trainingNotes: JSON.stringify(this.whoopWorkoutExercises)
      };
      
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({ id: this.currentEntry.id, ...payload });
      } else {
        await this.healthDataService.saveEntry(payload);
      }
      
      await this.loadEntries();
      await this.loadDashboard();
      this.closeWhoopWorkoutEditor();
    } catch (error) {
      console.error('Error saving workout exercises:', error);
    }
  }
  
  getWhoopWorkoutExercises(workout: WhoopWorkout): PlannedExercise[] {
    return this.whoopWorkoutExercises[this.getWorkoutKey(workout)] || [];
  }
  
  copyExercisesToClipboard(exerciseList?: PlannedExercise[]) {
    const toCopy = exerciseList || this.exercises;
    if (toCopy.length === 0) return;
    
    const formatted = toCopy.map(ex => {
      let text = `${ex.name} ${ex.reps}×${ex.sets}`;
      if (ex.weight) {
        text += ` @ ${ex.weight}`;
      }
      return text;
    }).join(', ');
    
    navigator.clipboard.writeText(formatted).then(() => {
      console.log('Copied to clipboard:', formatted);
    });
  }
  
  copyPlannedWorkoutToClipboard() {
    const planned = this.getPlannedWorkout();
    if (planned?.exercises) {
      this.copyExercisesToClipboard(planned.exercises);
    }
  }
  
  copyWhoopWorkoutToClipboard(workout: WhoopWorkout, event: Event) {
    event.stopPropagation(); // Prevent opening the editor
    const exercises = this.getWhoopWorkoutExercises(workout);
    if (exercises.length > 0) {
      this.copyExercisesToClipboard(exercises);
    }
  }
  
  // Merge Whoop activity with Planned Workout
  promptMergeWithPlanned(workout: WhoopWorkout, event: Event) {
    event.stopPropagation();
    this.whoopToMerge = workout;
    this.showMergePrompt = true;
  }
  
  closeMergePrompt() {
    this.showMergePrompt = false;
    this.whoopToMerge = null;
  }
  
  async mergeWhoopWithPlanned() {
    if (!this.whoopToMerge || !this.currentEntry?.id) return;
    
    const planned = this.getPlannedWorkout();
    if (!planned) return;
    
    // Get exercises from Whoop activity (if any were added)
    const whoopExercises = this.getWhoopWorkoutExercises(this.whoopToMerge);
    
    // Merge exercises: keep planned exercises, add any from Whoop that aren't duplicates
    const mergedExercises = [...(planned.exercises || [])];
    whoopExercises.forEach(ex => {
      if (!mergedExercises.some(e => e.name.toLowerCase() === ex.name.toLowerCase())) {
        mergedExercises.push(ex);
      }
    });
    
    // Update planned workout with Whoop stats and merged exercises
    const updatedWorkout: PlannedWorkout = {
      type: planned.type,
      targetDuration: planned.targetDuration,
      exercises: mergedExercises,
    };
    
    // Add Whoop actual stats to the workout
    const workoutWithStats = {
      ...updatedWorkout,
      actualStrain: this.whoopToMerge.strain,
      actualDuration: this.whoopToMerge.duration,
      actualCalories: this.whoopToMerge.calories,
      actualAvgHR: this.whoopToMerge.avgHR,
      actualMaxHR: this.whoopToMerge.maxHR,
      whoopStartTime: this.whoopToMerge.startTime
    };
    
    try {
      // Clear the separate Whoop exercise storage for this workout
      const whoopKey = this.getWorkoutKey(this.whoopToMerge);
      delete this.whoopWorkoutExercises[whoopKey];
      
      await this.healthDataService.updateEntry({
        id: this.currentEntry.id,
        date: this.selectedDate,
        plannedWorkout: JSON.stringify(workoutWithStats),
        trainingNotes: Object.keys(this.whoopWorkoutExercises).length > 0 
          ? JSON.stringify(this.whoopWorkoutExercises) 
          : undefined,
        workoutCompleted: true
      });
      
      await this.loadEntries();
      await this.loadDashboard();
      this.closeMergePrompt();
    } catch (error) {
      console.error('Error merging workout:', error);
    }
  }
  
  hasPlannedWorkoutToMerge(): boolean {
    return this.getPlannedWorkout() !== null;
  }
  
  private loadWhoopWorkoutExercises() {
    if (this.currentEntry?.trainingNotes) {
      try {
        const parsed = JSON.parse(this.currentEntry.trainingNotes);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          this.whoopWorkoutExercises = parsed;
          return;
        }
      } catch { /* Not JSON */ }
    }
    this.whoopWorkoutExercises = {};
  }

  // ==================== DASHBOARD ====================
  
  async loadDashboard() {
    this.isLoadingDashboard = true;
    this.whoopWorkouts = [];
    
    try {
      this.currentEntry = this.entries.find(e => e.date === this.selectedDate) || null;
      this.loadWhoopWorkoutExercises();
      this.loadDailyChecklist();
      
      if (this.whoopConnected) {
        await this.loadWhoopDashboard();
      }
    } finally {
      this.isLoadingDashboard = false;
    }
  }

  private async loadWhoopDashboard() {
    try {
      const workoutData = await this.whoopService.getWorkouts(this.selectedDate, this.selectedDate);
      const allWorkouts = (workoutData?.records || []).map((w: any) => this.mapWhoopWorkout(w));
      
      // Filter out workouts that have been merged with planned workout
      const planned = this.getPlannedWorkout();
      const mergedStartTime = (planned as any)?.whoopStartTime;
      
      this.whoopWorkouts = mergedStartTime 
        ? allWorkouts.filter((w: WhoopWorkout) => w.startTime !== mergedStartTime)
        : allWorkouts;
    } catch (error) {
      console.error('Error loading Whoop dashboard:', error);
    }
  }
  
  private mapWhoopWorkout(w: any): WhoopWorkout {
    const calories = w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : 0;
    const minutes = w.start && w.end 
      ? Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / (1000 * 60)) 
      : 0;
    
    const sportName = (w.sport_name || 'Unknown')
      .replace(/_msk$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    
    return {
      sport: sportName,
      strain: w.score?.strain ? Math.round(w.score.strain * 10) / 10 : 0,
      duration: minutes,
      calories,
      avgHR: w.score?.average_heart_rate || 0,
      maxHR: w.score?.max_heart_rate || 0,
      startTime: w.start ? new Date(w.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    };
  }

  // ==================== ENTRIES CRUD ====================
  
  async loadEntries() {
    this.isLoadingEntries = true;
    try {
      const data = await this.healthDataService.getAllEntries();
      this.entries = (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      bp: '', temp: '', strain: '', rhr: '',
      sleep: '', recovery: '', weight: '', dailyScore: ''
    });
    this.saveMessage = '';
    this.whoopMessage = '';
    this.editingId = null;
  }

  editEntry(entry: HealthEntry) {
    this.editingId = entry.id;
    this.showForm = true;
    
    this.healthForm.patchValue({
      date: entry.date,
      bp: entry.bp || '',
      temp: entry.temp || '',
      strain: entry.strain || '',
      rhr: entry.rhr || '',
      sleep: entry.sleep || '',
      recovery: entry.recovery || '',
      weight: entry.weight || '',
      dailyScore: entry.dailyScore || ''
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
        return;
      }
      
      const previousDay = getPreviousDay(selectedDate);

      const [recoveryData, sleepData, cycleData] = await Promise.all([
        this.whoopService.getRecovery(selectedDate, selectedDate),
        this.whoopService.getSleep(selectedDate, selectedDate),
        this.whoopService.getCycles(previousDay, previousDay)
      ]);
      
      const recoveryRecord = recoveryData?.records?.[0];
      const sleepRecord = sleepData?.records?.[0];
      const cycleRecord = cycleData?.records?.[0];

      let fieldsUpdated = 0;

      if (recoveryRecord?.score?.recovery_score != null) {
        this.healthForm.patchValue({ recovery: recoveryRecord.score.recovery_score });
        fieldsUpdated++;
      }
      if (recoveryRecord?.score?.resting_heart_rate != null) {
        this.healthForm.patchValue({ rhr: recoveryRecord.score.resting_heart_rate });
        fieldsUpdated++;
      }
      if (sleepRecord?.score?.sleep_performance_percentage != null) {
        this.healthForm.patchValue({ sleep: sleepRecord.score.sleep_performance_percentage });
        fieldsUpdated++;
      }
      if (cycleRecord?.score?.strain != null) {
        this.healthForm.patchValue({ strain: Math.round(cycleRecord.score.strain * 10) / 10 });
        fieldsUpdated++;
      }

      this.whoopMessage = fieldsUpdated > 0 
        ? `Imported ${fieldsUpdated} field(s) from Whoop`
        : `No Whoop data found for ${selectedDate}`;
    } catch (error: any) {
      console.error('Whoop fetch error:', error);
      this.whoopMessage = `Error: ${error.message || 'Failed to fetch Whoop data'}`;
    } finally {
      this.whoopLoading = false;
    }
  }

  async onSubmit() {
    if (!this.healthForm.valid) return;
    
    this.isLoading = true;
    const f = this.healthForm.value;

    const entry: any = {
      date: f.date,
      bp: f.bp || undefined,
      temp: f.temp ? parseFloat(f.temp) : undefined,
      strain: f.strain ? parseFloat(f.strain) : undefined,
      rhr: f.rhr ? parseFloat(f.rhr) : undefined,
      sleep: f.sleep ? parseFloat(f.sleep) : undefined,
      recovery: f.recovery ? parseFloat(f.recovery) : undefined,
      weight: f.weight ? parseFloat(f.weight) : undefined,
      dailyScore: f.dailyScore ? parseFloat(f.dailyScore) : undefined
    };

    try {
      if (this.editingId) {
        entry.id = this.editingId;
        await this.healthDataService.updateEntry(entry);
        this.saveMessage = 'Entry updated!';
      } else {
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
  
  // Find duplicate entries for the same date
  getDuplicateDates(): string[] {
    const dateCounts: { [date: string]: number } = {};
    this.entries.forEach(e => {
      dateCounts[e.date] = (dateCounts[e.date] || 0) + 1;
    });
    return Object.keys(dateCounts).filter(date => dateCounts[date] > 1);
  }
  
  hasDuplicates(): boolean {
    return this.getDuplicateDates().length > 0;
  }
  
  async cleanupDuplicates() {
    const duplicateDates = this.getDuplicateDates();
    if (duplicateDates.length === 0) return;
    
    if (!confirm(`Found duplicates for: ${duplicateDates.join(', ')}. Keep the most complete entry and delete others?`)) {
      return;
    }
    
    for (const date of duplicateDates) {
      const entriesForDate = this.entries.filter(e => e.date === date);
      
      // Sort by "completeness" - entry with most data wins
      entriesForDate.sort((a, b) => {
        const scoreA = this.getEntryCompleteness(a);
        const scoreB = this.getEntryCompleteness(b);
        return scoreB - scoreA;
      });
      
      // Keep first (most complete), delete rest
      for (let i = 1; i < entriesForDate.length; i++) {
        try {
          await this.healthDataService.deleteEntry(entriesForDate[i].id);
          console.log(`Deleted duplicate entry ${entriesForDate[i].id} for ${date}`);
        } catch (error) {
          console.error('Error deleting duplicate:', error);
        }
      }
    }
    
    await this.loadEntries();
    await this.loadDashboard();
  }
  
  private getEntryCompleteness(entry: HealthEntry): number {
    let score = 0;
    if (entry.bp) score++;
    if (entry.temp) score++;
    if (entry.strain) score++;
    if (entry.rhr) score++;
    if (entry.sleep) score++;
    if (entry.recovery) score++;
    if (entry.weight) score++;
    if (entry.dailyScore) score++;
    if (entry.plannedWorkout) score += 5; // Planned workout is worth more
    if (entry.workoutCompleted) score++;
    if (entry.trainingNotes) score += 2;
    return score;
  }
}
