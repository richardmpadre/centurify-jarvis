import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HealthDataService } from '../services/health-data.service';
import { WhoopService } from '../services/whoop.service';
import { ChatService, ChatMessage } from '../services/chat.service';
import { ActionListComponent, ActionItem } from './components/action-list/action-list.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { 
  HealthEntry, 
  PlannedExercise, 
  PlannedWorkout, 
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
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    RouterLink,
    ActionListComponent,
    DashboardComponent
  ],
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
  
  // Action List
  actionsCollapsed = false;
  actionsEditMode = false;
  dailyActions: ActionItem[] = [];
  
  private readonly ACTION_ORDER_KEY = 'jarvis_action_order';
  private defaultActionOrder = ['biometrics', 'workout', 'nutrition', 'complete_workout', 'lifeEvents', 'jarvis'];
  
  // Merge workflow
  showMergePrompt = false;
  whoopToMerge: WhoopWorkout | null = null;
  
  // Nutrition panel
  showNutritionPanel = false;
  mfpConnected = false;
  mfpLoading = false;
  
  // Chat
  showChat = false;
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatLoading = false;

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private whoopService: WhoopService,
    private chatService: ChatService
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
    this.buildDailyActions();
  }

  // ==================== ACTION LIST ====================
  
  buildDailyActions() {
    const hasRecovery = this.currentEntry?.recovery != null;
    const hasWorkoutPlan = this.getPlannedWorkout() !== null;
    const workoutCompleted = this.currentEntry?.workoutCompleted === true;
    
    // Define all actions
    const allActions: { [id: string]: ActionItem } = {
      'biometrics': {
        id: 'biometrics',
        title: 'Load Biometrics',
        description: this.whoopConnected ? 'Import health data from Whoop' : 'Add health entry manually',
        icon: '📊',
        status: hasRecovery ? 'completed' : 'pending',
        type: 'biometrics',
        createsEntry: 'health'
      },
      'workout': {
        id: 'workout',
        title: 'Plan Workout',
        description: 'Schedule training for the day',
        icon: '🏋️',
        status: hasWorkoutPlan ? 'completed' : 'pending',
        type: 'workout',
        dependsOn: ['biometrics'],
        createsEntry: 'workout'
      },
      'nutrition': {
        id: 'nutrition',
        title: 'Plan Nutrition',
        description: 'Log meals in MyFitnessPal',
        icon: '🥗',
        status: 'pending',
        type: 'nutrition',
        externalLink: 'https://www.myfitnesspal.com/food/diary'
      },
      'complete_workout': {
        id: 'complete_workout',
        title: 'Complete Workout',
        description: 'Mark your workout as done',
        icon: '✅',
        status: workoutCompleted ? 'completed' : 'pending',
        type: 'custom',
        dependsOn: ['workout']
      },
      'lifeEvents': {
        id: 'lifeEvents',
        title: 'Organize Life Events',
        description: 'Review and plan life tasks',
        icon: '📋',
        status: 'pending',
        type: 'life_events',
        externalLink: 'https://docs.google.com/document/d/1H0-yjnxuFXoHDBXiF5moIkYSLhXucWRB1FJWSsFi6vU/edit'
      },
      'jarvis': {
        id: 'jarvis',
        title: 'Iterate Jarvis',
        description: 'Work on Jarvis improvements',
        icon: '🤖',
        status: 'pending',
        type: 'jarvis',
        externalLink: 'https://trello.com/b/piRDYqCn/jarvis'
      }
    };
    
    // Get saved order or use default
    const savedOrder = this.getActionOrder();
    
    // Build actions in saved order
    this.dailyActions = savedOrder
      .filter(id => allActions[id]) // Only include valid IDs
      .map(id => allActions[id]);
    
    // Load saved action states from entry
    this.loadActionStates();
  }
  
  getActionOrder(): string[] {
    try {
      const saved = localStorage.getItem(this.ACTION_ORDER_KEY);
      if (saved) {
        const order = JSON.parse(saved);
        // Validate it has all required actions
        if (Array.isArray(order) && order.length === this.defaultActionOrder.length) {
          return order;
        }
      }
    } catch { /* ignore */ }
    return [...this.defaultActionOrder];
  }
  
  saveActionOrder(order: string[]): void {
    localStorage.setItem(this.ACTION_ORDER_KEY, JSON.stringify(order));
  }
  
  onActionsReorder(newOrder: string[]): void {
    this.saveActionOrder(newOrder);
    this.buildDailyActions();
  }
  
  onActionsToggleEditMode(): void {
    this.actionsEditMode = !this.actionsEditMode;
  }
  
  loadActionStates() {
    if (!this.currentEntry?.morningChecklist) return;
    
    try {
      const saved = JSON.parse(this.currentEntry.morningChecklist);
      this.dailyActions.forEach(action => {
        // Saved state takes priority - can be true (completed) or false (explicitly uncompleted)
        if (saved[action.id] === true) {
          action.status = 'completed';
        } else if (saved[action.id] === false) {
          // User explicitly marked as incomplete - override auto-detection
          action.status = 'pending';
        }
      });
    } catch { /* ignore */ }
  }
  
  async onActionClick(action: ActionItem) {
    switch (action.type) {
      case 'biometrics':
        if (this.whoopConnected) {
          await this.importFromWhoop();
        } else {
          this.addEntryForDate();
        }
        break;
        
      case 'workout':
        this.openWorkoutPlanner();
        break;
        
      case 'custom':
        if (action.id === 'complete_workout') {
          await this.toggleWorkoutCompleted();
        }
        break;
        
      case 'nutrition':
        this.openNutritionPanel();
        break;
        
      case 'life_events':
      case 'jarvis':
        if (action.externalLink) {
          window.open(action.externalLink, '_blank');
          await this.markActionComplete(action.id);
        }
        break;
    }
  }
  
  async markActionComplete(actionId: string) {
    const action = this.dailyActions.find(a => a.id === actionId);
    if (!action) return;
    
    action.status = 'completed';
    await this.saveActionStates();
    this.buildDailyActions(); // Refresh to show dependent actions
  }
  
  async onActionUncomplete(action: ActionItem) {
    // Reset the action to pending
    action.status = 'pending';
    await this.saveActionStates();
    this.buildDailyActions();
  }
  
  async saveActionStates() {
    // Load existing states first to preserve any we're not tracking
    let states: { [key: string]: boolean | null } = {};
    if (this.currentEntry?.morningChecklist) {
      try {
        states = JSON.parse(this.currentEntry.morningChecklist);
      } catch { /* ignore */ }
    }
    
    // Update with current action states
    this.dailyActions.forEach(action => {
      if (action.status === 'completed') {
        states[action.id] = true;
      } else {
        // Explicitly save as false if it was previously completed (user uncompleted it)
        // or if we have no prior state for it
        states[action.id] = false;
      }
    });
    
    const payload = {
      date: this.selectedDate,
      morningChecklist: JSON.stringify(states)
    };
    
    try {
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({ id: this.currentEntry.id, ...payload });
      } else {
        await this.healthDataService.saveEntry(payload);
      }
      await this.loadEntries();
      this.currentEntry = this.entries.find(e => e.date === this.selectedDate) || null;
    } catch (error) {
      console.error('Error saving action states:', error);
    }
  }
  
  onActionsToggleCollapse() {
    this.actionsCollapsed = !this.actionsCollapsed;
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
    for (const entry of this.entries) {
      if (entry.date === this.selectedDate) continue;
      
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
    }
  }
  
  hasLastWorkout(): boolean {
    return this.entries.some(entry => {
      if (entry.date === this.selectedDate) return false;
      if (entry.plannedWorkout) {
        try {
          const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
          if (planned.exercises?.length > 0) return true;
        } catch { /* skip */ }
      }
      return false;
    });
  }
  
  async saveWorkoutPlan() {
    const form = this.workoutForm.value;
    const plannedWorkout: PlannedWorkout = {
      type: form.type,
      targetDuration: form.targetDuration,
      exercises: this.exercises
    };
    
    try {
      const payload = {
        date: this.selectedDate,
        plannedWorkout: JSON.stringify(plannedWorkout)
      };
      
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({ id: this.currentEntry.id, ...payload });
      } else {
        await this.healthDataService.saveEntry(payload);
      }
      
      await this.loadEntries();
      await this.loadDashboard();
      this.buildDailyActions();
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
      this.buildDailyActions();
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
  
  // Merge Whoop activity with Planned Workout
  promptMergeWithPlanned(workout: WhoopWorkout) {
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
    
    const workoutWithStats = {
      ...planned,
      actualStrain: this.whoopToMerge.strain,
      actualDuration: this.whoopToMerge.duration,
      actualCalories: this.whoopToMerge.calories,
      actualAvgHR: this.whoopToMerge.avgHR,
      actualMaxHR: this.whoopToMerge.maxHR,
      whoopStartTime: this.whoopToMerge.startTime
    };
    
    try {
      await this.healthDataService.updateEntry({
        id: this.currentEntry.id,
        date: this.selectedDate,
        plannedWorkout: JSON.stringify(workoutWithStats),
        workoutCompleted: true
      });
      
      await this.loadEntries();
      await this.loadDashboard();
      this.buildDailyActions();
      this.closeMergePrompt();
    } catch (error) {
      console.error('Error merging workout:', error);
    }
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
      this.buildDailyActions();
      
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

  editEntry(entry?: HealthEntry) {
    const e = entry || this.currentEntry;
    if (!e) return;
    
    this.editingId = e.id;
    this.showForm = true;
    
    this.healthForm.patchValue({
      date: e.date,
      bp: e.bp || '',
      temp: e.temp || '',
      strain: e.strain || '',
      rhr: e.rhr || '',
      sleep: e.sleep || '',
      recovery: e.recovery || '',
      weight: e.weight || '',
      dailyScore: e.dailyScore || ''
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

  // ==================== CHAT ====================
  
  toggleChat() {
    this.showChat = !this.showChat;
    if (this.showChat && this.chatMessages.length === 0) {
      this.chatMessages = this.chatService.getHistory();
    }
  }
  
  async sendChatMessage() {
    if (!this.chatInput.trim() || this.chatLoading) return;
    
    const message = this.chatInput.trim();
    this.chatInput = '';
    this.chatLoading = true;
    
    try {
      await this.chatService.chat(message);
      this.chatMessages = this.chatService.getHistory();
    } catch (error: any) {
      console.error('Chat error:', error);
      this.chatMessages.push({
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        timestamp: new Date()
      });
    } finally {
      this.chatLoading = false;
    }
  }
  
  async analyzeToday() {
    this.chatLoading = true;
    
    try {
      const completedActions = this.dailyActions
        .filter(a => a.status === 'completed')
        .map(a => a.title);
        
      const analysis = await this.chatService.analyzeDay({
        date: this.selectedDate,
        recovery: this.currentEntry?.recovery || undefined,
        sleep: this.currentEntry?.sleep || undefined,
        strain: this.currentEntry?.strain || undefined,
        rhr: this.currentEntry?.rhr || undefined,
        workouts: this.whoopWorkouts,
        plannedWorkout: this.getPlannedWorkout() || undefined,
        checklistCompleted: completedActions
      });
      
      this.chatMessages.push({
        role: 'assistant',
        content: analysis.summary || JSON.stringify(analysis),
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      this.chatMessages.push({
        role: 'assistant',
        content: `Error analyzing day: ${error.message}`,
        timestamp: new Date()
      });
    } finally {
      this.chatLoading = false;
    }
  }
  
  clearChat() {
    this.chatService.clearHistory();
    this.chatMessages = [];
  }

  // ==================== NUTRITION ====================
  
  openNutritionPanel(): void {
    this.showNutritionPanel = true;
  }
  
  closeNutritionPanel(): void {
    this.showNutritionPanel = false;
  }
  
  async openMyFitnessPal(): Promise<void> {
    window.open('https://www.myfitnesspal.com/food/diary', '_blank');
    await this.markActionComplete('nutrition');
    this.closeNutritionPanel();
  }
  
  async importFromMyFitnessPal(): Promise<void> {
    // TODO: Implement MyFitnessPal OAuth integration
    // This would require:
    // 1. Setting up MFP API credentials
    // 2. Creating a Lambda function for MFP OAuth (similar to Whoop)
    // 3. Fetching meal data from MFP API
    // 4. Creating nutrition entries in the app
    
    this.mfpLoading = true;
    
    try {
      // Placeholder - show not implemented message
      alert('MyFitnessPal integration coming soon! For now, please log meals manually in MyFitnessPal.');
      
      // When implemented, this would:
      // 1. Check if connected to MFP
      // 2. Fetch today's meals
      // 3. Create entries for breakfast, lunch, dinner, snacks
      // 4. Mark the nutrition action as complete
      
    } catch (error) {
      console.error('MFP import error:', error);
    } finally {
      this.mfpLoading = false;
    }
  }
}
