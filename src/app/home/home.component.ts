import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HealthDataService } from '../services/health-data.service';
import { WhoopService } from '../services/whoop.service';
import { MealService } from '../services/meal.service';
import { MealEntryService, MealEntry } from '../services/meal-entry.service';
import { GoalService } from '../services/goal.service';
import { ActionListComponent, ActionItem } from './components/action-list/action-list.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { InsightsPanelComponent } from './components/insights-panel/insights-panel.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { WorkoutPlannerComponent } from './components/workout-planner/workout-planner.component';
import { TrainingPanelComponent } from './components/training-panel/training-panel.component';
import { NutritionPanelComponent } from './components/nutrition-panel/nutrition-panel.component';
import { MealDetailPanelComponent } from './components/meal-detail-panel/meal-detail-panel.component';
import { GoalPriorityPanelComponent, DailyGoalSelection } from './components/goal-priority-panel/goal-priority-panel.component';
import { GoalDetailPanelComponent } from './components/goal-detail-panel/goal-detail-panel.component';
import { 
  HealthEntry, 
  PlannedExercise, 
  PlannedWorkout, 
  PlannedMeal,
  WhoopWorkout 
} from '../models/health.models';
import { Goal } from '../models/goal.models';
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
    DashboardComponent,
    InsightsPanelComponent,
    ChatPanelComponent,
    WorkoutPlannerComponent,
    TrainingPanelComponent,
    NutritionPanelComponent,
    MealDetailPanelComponent,
    GoalPriorityPanelComponent,
    GoalDetailPanelComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  // Form state
  healthForm: FormGroup;
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
  
  // Whoop workout editor
  exercises: PlannedExercise[] = [];
  exerciseName = '';
  exerciseSets = 3;
  exerciseReps = '8-10';
  exerciseWeight = '';
  
  // Data
  entries: HealthEntry[] = [];
  currentEntry: HealthEntry | null = null;
  yesterdayEntry: HealthEntry | null = null;
  selectedDate = getLocalDateString(new Date());
  showDatePicker = false;
  whoopWorkouts: WhoopWorkout[] = [];
  whoopWorkoutExercises: { [key: string]: PlannedExercise[] } = {};
  
  // Whoop status
  whoopConnected = false;
  whoopExpired = false;
  whoopExpiryMinutes: number | null = null;
  whoopHasRefreshToken = false;
  whoopSyncing = false;
  whoopSyncMessage = '';
  
  // Action List
  actionsCollapsed = false;
  actionsEditMode = false;
  dailyActions: ActionItem[] = [];
  
  private readonly ACTION_ORDER_KEY = 'jarvis_action_order';
  private defaultActionOrder = ['biometrics', 'workout', 'nutrition', 'lifeEvents', 'complete_workout', 'daily_insights'];
  
  // Merge workflow
  showMergePrompt = false;
  whoopToMerge: WhoopWorkout | null = null;
  
  // Nutrition panel
  showNutritionPanel = false;
  mealEntries: MealEntry[] = [];
  
  // Goals
  activeGoals: Goal[] = [];

  // Meal detail panel
  showMealDetailPanel = false;
  mealDetailType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  
  // Training completion panel
  showTrainingPanel = false;
  
  // Daily Insights panel
  showInsightsPanel = false;

  // Goal Priority panel
  showGoalPriorityPanel = false;
  goalsRequiringDailyAction: Goal[] = [];
  currentPriorityGoal: Goal | null = null;
  selectedDailyGoals: { [yearlyGoalId: string]: { goalId: string; goalTitle: string } } = {};

  // Goal Detail panel
  showGoalDetailPanel = false;
  currentGoalDetailId: string | null = null;
  currentGoalParentTitle: string = '';

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private whoopService: WhoopService,
    private mealService: MealService,
    private mealEntryService: MealEntryService,
    private goalService: GoalService
  ) {
    this.healthForm = this.fb.group({
      date: [this.selectedDate, Validators.required],
      bp: [''],
      temp: [''],
      strain: [''],
      rhr: [''],
      sleep: [''],
      recovery: [''],
      weight: ['']
    });
  }

  async ngOnInit() {
    this.checkWhoopStatus();
    await this.loadEntries();
    await this.loadDashboard();
    await this.loadActiveGoals();
    await this.loadGoalsRequiringDailyAction();
    this.buildDailyActions();
  }

  async loadActiveGoals(): Promise<void> {
    try {
      this.activeGoals = await this.goalService.getActiveGoals();
    } catch (error) {
      console.error('Error loading active goals:', error);
      this.activeGoals = [];
    }
  }

  async loadGoalsRequiringDailyAction(): Promise<void> {
    try {
      this.goalsRequiringDailyAction = await this.goalService.getGoalsRequiringDailyAction();
      this.loadSelectedDailyGoals();
    } catch (error) {
      console.error('Error loading goals requiring daily action:', error);
      this.goalsRequiringDailyAction = [];
    }
  }

  private loadSelectedDailyGoals(): void {
    if (!this.currentEntry?.morningChecklist) {
      this.selectedDailyGoals = {};
      return;
    }
    
    try {
      const saved = JSON.parse(this.currentEntry.morningChecklist);
      this.selectedDailyGoals = saved.selectedDailyGoals || {};
    } catch {
      this.selectedDailyGoals = {};
    }
  }

  // ==================== ACTION LIST ====================
  
  buildDailyActions() {
    const hasRecovery = this.currentEntry?.recovery != null;
    const hasWorkoutPlan = this.getPlannedWorkout() !== null;
    const workoutCompleted = this.currentEntry?.workoutCompleted === true;
    const hasMeals = this.mealEntries.length > 0;
    const nutritionTrackingFailed = this.currentEntry?.nutritionTrackingFailed === true;
    const nutritionCompleted = hasMeals || nutritionTrackingFailed;
    
    // Define all actions
    const allActions: { [id: string]: ActionItem } = {
      'biometrics': {
        id: 'biometrics',
        title: 'Load Biometrics',
        description: this.whoopConnected ? 'Import health data from Whoop' : 'Add health entry manually',
        icon: '📊',
        status: hasRecovery ? 'completed' : 'pending',
        type: 'biometrics',
        createsEntry: 'health',
        reopenOnComplete: true // Status derived from data - reopen form when clicked
      },
      'workout': {
        id: 'workout',
        title: 'Plan Workout',
        description: hasWorkoutPlan ? this.getWorkoutDescription() : 'Schedule training for the day',
        icon: hasWorkoutPlan ? this.getWorkoutIcon() : '🏋️',
        status: hasWorkoutPlan ? 'completed' : 'pending',
        type: 'workout',
        dependsOn: ['biometrics'],
        createsEntry: 'workout',
        reopenOnComplete: true // Status derived from data - reopen planner when clicked
      },
      'nutrition': {
        id: 'nutrition',
        title: 'Plan Nutrition',
        description: nutritionTrackingFailed ? '❌ Tracking failed' : (hasMeals ? 'Meals planned for the day' : 'Plan your meals'),
        icon: '🥗',
        status: nutritionCompleted ? 'completed' : 'pending',
        type: 'nutrition',
        reopenOnComplete: true // Status derived from data - reopen panel when clicked
      },
      'complete_workout': {
        id: 'complete_workout',
        title: 'Complete Workout',
        description: 'Mark your workout as done',
        icon: '✅',
        status: workoutCompleted ? 'completed' : 'pending',
        type: 'custom',
        dependsOn: ['workout'],
        reopenOnComplete: true // Opens training panel when clicked
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
      'daily_insights': {
        id: 'daily_insights',
        title: 'Wrap Up Day',
        description: this.currentEntry?.dailyInsights ? 'View today\'s insights' : 'Generate AI insights for today',
        icon: '✨',
        status: this.currentEntry?.dailyInsights ? 'completed' : 'pending',
        type: 'insights',
        reopenOnComplete: true // Status derived from data - reopen panel when clicked
      }
    };
    
    // Add meal actions to the actions map if nutrition is planned
    if (hasMeals) {
      const mealActions = this.buildMealActions();
      mealActions.forEach(action => {
        allActions[action.id] = action;
      });
    }
    
    // Add goal priority actions for yearly goals requiring daily action
    this.goalsRequiringDailyAction.forEach(yearlyGoal => {
      const actionId = `goal_priority_${yearlyGoal.id}`;
      const selectedGoal = this.selectedDailyGoals[yearlyGoal.id];
      const isCompleted = !!selectedGoal;
      
      // Add the selection action
      allActions[actionId] = {
        id: actionId,
        title: `Focus: ${yearlyGoal.title}`,
        description: isCompleted 
          ? `Today: ${selectedGoal.goalTitle}` 
          : 'Select today\'s priority goal',
        icon: '🎯',
        status: isCompleted ? 'completed' : 'pending',
        type: 'goal_priority',
        yearlyGoalId: yearlyGoal.id,
        reopenOnComplete: true
      };
      
      // If a goal is selected, add it as a workable action
      if (selectedGoal) {
        const goalActionId = `goal_work_${selectedGoal.goalId}`;
        
        // Check if the selected goal is completed by looking at morningChecklist
        let isGoalCompleted = false;
        if (this.currentEntry?.morningChecklist) {
          try {
            const saved = JSON.parse(this.currentEntry.morningChecklist);
            isGoalCompleted = saved[goalActionId] === true;
          } catch { /* ignore */ }
        }
        
        allActions[goalActionId] = {
          id: goalActionId,
          title: selectedGoal.goalTitle,
          description: `Work on: ${yearlyGoal.title}`,
          icon: '📌',
          status: isGoalCompleted ? 'completed' : 'pending',
          type: 'custom',
          dependsOn: [actionId],
          reopenOnComplete: false // Allow toggling completion
        };
      }
    });
    
    // Get saved order
    const savedOrder = this.getActionOrder();
    
    // Build actions list:
    // 1. Start with saved order
    // 2. Filter out IDs that don't exist (e.g., removed meal types)
    // 3. Add any new actions that aren't in saved order (e.g., new meal types)
    // 4. Ensure meal actions are always in correct order (breakfast, lunch, dinner, snack)
    // 5. Ensure 'daily_insights' is always at the end
    const existingIds = new Set(savedOrder.filter(id => allActions[id]));
    const newIds = Object.keys(allActions).filter(id => !existingIds.has(id) && id !== 'daily_insights');
    
    // Separate meal actions from other new actions and sort them properly
    const mealOrder = ['meal_breakfast', 'meal_lunch', 'meal_dinner', 'meal_snack'];
    const newMealIds = newIds.filter(id => id.startsWith('meal_')).sort((a, b) => {
      return mealOrder.indexOf(a) - mealOrder.indexOf(b);
    });
    const newNonMealIds = newIds.filter(id => !id.startsWith('meal_'));
    
    // Build order without daily_insights first
    let finalOrder = savedOrder.filter(id => allActions[id] && id !== 'daily_insights');
    
    // Add new meal actions in correct order
    finalOrder = [...finalOrder, ...newMealIds];
    
    // Add other new actions
    finalOrder = [...finalOrder, ...newNonMealIds];
    
    // Always add daily_insights at the end
    if (allActions['daily_insights']) {
      finalOrder.push('daily_insights');
    }
    
    this.dailyActions = finalOrder.map(id => allActions[id]);
    
    // Load saved action states from entry
    this.loadActionStates();
  }
  
  buildMealActions(): ActionItem[] {
    const mealsByType: { [key: string]: MealEntry[] } = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };
    
    // Group meals by type
    this.mealEntries.forEach(meal => {
      if (mealsByType[meal.mealType]) {
        mealsByType[meal.mealType].push(meal);
      }
    });
    
    const actions: ActionItem[] = [];
    const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
    const mealIcons: { [key: string]: string } = {
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙',
      snack: '🍎'
    };
    const mealLabels: { [key: string]: string } = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack'
    };
    
    mealOrder.forEach(type => {
      const typeMeals = mealsByType[type];
      if (typeMeals.length > 0) {
        const mealNames = typeMeals.map(m => m.name).join(', ');
        const totalCals = typeMeals.reduce((sum, m) => sum + (m.calories || 0) * (m.portion || 1), 0);
        const allCompleted = typeMeals.every(m => m.completed);
        
        actions.push({
          id: `meal_${type}`,
          title: mealLabels[type],
          description: `${mealNames} (${totalCals} cal)`,
          icon: mealIcons[type],
          status: allCompleted ? 'completed' : 'pending',
          type: 'meal',
          mealType: type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
          reopenOnComplete: true // Opens meal detail panel when clicked
        });
      }
    });
    
    return actions;
  }
  
  async toggleMealTypeCompleted(mealType: string): Promise<void> {
    const typeMeals = this.mealEntries.filter(m => m.mealType === mealType);
    const allCompleted = typeMeals.every(m => m.completed);
    const newStatus = !allCompleted;
    
    console.log(`Toggle ${mealType}: ${typeMeals.length} meals, allCompleted=${allCompleted}, setting to ${newStatus}`);
    
    // Toggle all meals of this type
    for (const meal of typeMeals) {
      console.log(`  Updating meal ${meal.name} (${meal.id}) to completed: ${newStatus}`);
      await this.mealEntryService.toggleMealCompleted(meal.id, newStatus);
    }
    
    // Reload meal entries
    await this.loadMealEntries();
    
    // Verify the update
    const updatedTypeMeals = this.mealEntries.filter(m => m.mealType === mealType);
    console.log(`After reload - ${mealType} meals:`, updatedTypeMeals.map(m => ({ name: m.name, completed: m.completed })));
    
    // Update HealthEntry with nutrition totals (only counts completed meals)
    await this.updateNutritionTotals();
    
    this.buildDailyActions();
  }
  
  getActionOrder(): string[] {
    try {
      const saved = localStorage.getItem(this.ACTION_ORDER_KEY);
      if (saved) {
        const order = JSON.parse(saved);
        // Return saved order if it exists (can include meal actions now)
        if (Array.isArray(order) && order.length > 0) {
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
    // Save the full order including meal actions
    this.saveActionOrder(newOrder);
    this.buildDailyActions();
  }
  
  onActionsToggleEditMode(): void {
    this.actionsEditMode = !this.actionsEditMode;
  }
  
  loadActionStates() {
    if (!this.currentEntry?.morningChecklist) return;
    
    // Actions that derive status from database fields - don't override with morningChecklist
    const autoStatusActions = ['biometrics', 'workout', 'nutrition', 'complete_workout', 'daily_insights'];
    
    try {
      const saved = JSON.parse(this.currentEntry.morningChecklist);
      this.dailyActions.forEach(action => {
        // Skip meal actions - their status comes from MealEntry.completed
        if (action.type === 'meal') return;
        
        // Skip goal_priority actions - their status is derived from whether a goal is selected
        if (action.type === 'goal_priority') return;
        
        // Skip actions that derive status from database fields
        if (autoStatusActions.includes(action.id)) return;
        
        // Saved state takes priority for manual actions (lifeEvents, jarvis, etc.)
        if (saved[action.id] === true) {
          action.status = 'completed';
        } else if (saved[action.id] === false) {
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
          this.openTrainingPanel();
        } else if (action.id.startsWith('goal_work_')) {
          // Goal work actions - open goal detail panel
          const goalId = action.id.replace('goal_work_', '');
          this.openGoalDetailPanel(goalId, action.description.replace('Work on: ', ''));
        }
        break;
        
      case 'nutrition':
        this.openNutritionPanel();
        break;
        
      case 'meal':
        // Open meal detail panel
        if (action.mealType) {
          this.openMealDetailPanel(action.mealType);
        }
        break;
        
      case 'life_events':
      case 'jarvis':
        if (action.externalLink) {
          window.open(action.externalLink, '_blank');
          await this.markActionComplete(action.id);
        }
        break;
        
      case 'insights':
        this.openInsightsPanel();
        break;
        
      case 'goal_priority':
        if (action.yearlyGoalId) {
          this.openGoalPriorityPanel(action.yearlyGoalId);
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
    // If action has reopenOnComplete, trigger the same action as clicking
    // This opens the appropriate panel/form instead of trying to toggle status
    if (action.reopenOnComplete) {
      this.onActionClick(action);
      return;
    }
    
    // For other actions (without reopenOnComplete), reset to pending
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
    
    // Actions that derive status from database fields - don't save to morningChecklist
    const autoStatusActions = ['biometrics', 'workout', 'nutrition', 'complete_workout', 'daily_insights'];
    
    // Update with current action states for manual actions only
    this.dailyActions.forEach(action => {
      // Skip meal actions - their completion is stored in MealEntry.completed
      if (action.type === 'meal') return;
      
      // Skip goal_priority actions - their status is derived from whether a goal is selected
      if (action.type === 'goal_priority') return;
      
      // Skip actions that derive status from database fields
      if (autoStatusActions.includes(action.id)) return;
      
      if (action.status === 'completed') {
        states[action.id] = true;
      } else {
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

  toggleDatePicker(): void {
    this.showDatePicker = !this.showDatePicker;
    if (this.showDatePicker) {
      // Auto-focus the date input when opened
      setTimeout(() => {
        const input = document.querySelector('.date-picker-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.showPicker?.(); // Show native date picker if supported
        }
      }, 0);
    }
  }

  onDateChange(): void {
    this.showDatePicker = false;
    this.loadDashboard();
  }

  getWellnessScore(entry: HealthEntry): number | null {
    if (!entry?.dailyInsights) return null;
    try {
      const insights = JSON.parse(entry.dailyInsights);
      return insights.wellness_score ?? null;
    } catch {
      return null;
    }
  }

  // ==================== WORKOUT PLANNING ====================
  
  openWorkoutPlanner(): void {
    this.showWorkoutPlanner = true;
  }
  
  closeWorkoutPlanner(): void {
    this.showWorkoutPlanner = false;
  }
  
  async onWorkoutSaved(): Promise<void> {
    await this.loadEntries();
    await this.loadDashboard();
    this.buildDailyActions();
  }
  
  async toggleWorkoutCompleted(): Promise<void> {
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
  
  // Training Panel
  openTrainingPanel(): void {
    this.showTrainingPanel = true;
  }
  
  closeTrainingPanel(): void {
    this.showTrainingPanel = false;
  }
  
  async markWorkoutCompleteAndClose(): Promise<void> {
    await this.toggleWorkoutCompleted();
    this.closeTrainingPanel();
  }
  
  // ==================== DAILY INSIGHTS PANEL ====================
  
  openInsightsPanel(): void {
    this.showInsightsPanel = true;
  }
  
  closeInsightsPanel(): void {
    this.showInsightsPanel = false;
  }
  
  async onInsightsSaved(): Promise<void> {
    // Reload data after insights are saved by the panel
    await this.loadEntries();
    await this.loadDashboard();
    this.buildDailyActions();
  }
  
  // ==================== GOAL PRIORITY PANEL ====================
  
  openGoalPriorityPanel(yearlyGoalId: string): void {
    const yearlyGoal = this.goalsRequiringDailyAction.find(g => g.id === yearlyGoalId);
    if (yearlyGoal) {
      this.currentPriorityGoal = yearlyGoal;
      this.showGoalPriorityPanel = true;
    }
  }
  
  closeGoalPriorityPanel(): void {
    this.showGoalPriorityPanel = false;
    this.currentPriorityGoal = null;
  }
  
  async onGoalSelected(selection: DailyGoalSelection): Promise<void> {
    // Save the selected goal
    this.selectedDailyGoals[selection.yearlyGoalId] = {
      goalId: selection.selectedGoalId,
      goalTitle: selection.selectedGoalTitle
    };
    
    // Save to morningChecklist
    await this.saveSelectedDailyGoals();
    
    this.buildDailyActions();
    this.closeGoalPriorityPanel();
  }

  async onGoalCompletedFromPriority(completedGoalId: string): Promise<void> {
    // Mark the corresponding daily action as complete
    const actionId = `goal_work_${completedGoalId}`;
    await this.markActionComplete(actionId);
    
    // Reload goals and refresh actions
    await this.loadGoalsRequiringDailyAction();
    this.buildDailyActions();
  }
  
  private async saveSelectedDailyGoals(): Promise<void> {
    // Load existing states first
    let states: { [key: string]: any } = {};
    if (this.currentEntry?.morningChecklist) {
      try {
        states = JSON.parse(this.currentEntry.morningChecklist);
      } catch { /* ignore */ }
    }
    
    // Update with selected daily goals
    states['selectedDailyGoals'] = this.selectedDailyGoals;
    
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
      console.error('Error saving selected daily goals:', error);
    }
  }
  
  getSelectedGoalId(yearlyGoalId: string): string | null {
    return this.selectedDailyGoals[yearlyGoalId]?.goalId || null;
  }
  
  // ==================== GOAL DETAIL PANEL ====================
  
  openGoalDetailPanel(goalId: string, parentTitle: string): void {
    this.currentGoalDetailId = goalId;
    this.currentGoalParentTitle = parentTitle;
    this.showGoalDetailPanel = true;
  }
  
  closeGoalDetailPanel(): void {
    this.showGoalDetailPanel = false;
    this.currentGoalDetailId = null;
    this.currentGoalParentTitle = '';
  }
  
  async onGoalCompleted(goal: Goal): Promise<void> {
    // Mark the corresponding action as complete
    const actionId = `goal_work_${goal.id}`;
    await this.markActionComplete(actionId);
    
    // Reload goals data
    await this.loadActiveGoals();
    
    this.buildDailyActions();
    this.closeGoalDetailPanel();
  }
  
  getPlannedWorkout(): PlannedWorkout | null {
    if (!this.currentEntry?.plannedWorkout) return null;
    try {
      return JSON.parse(this.currentEntry.plannedWorkout);
    } catch {
      return null;
    }
  }

  getWorkoutDescription(): string {
    const planned = this.getPlannedWorkout();
    if (!planned) return 'Schedule training for the day';
    
    // Cardio workouts
    if (planned.cardio) {
      if (planned.cardio.targetType === 'time') {
        return `${planned.type}: ${planned.cardio.targetValue} min`;
      } else {
        const unit = planned.cardio.distanceUnit || 'miles';
        const unitLabel = unit === 'km' ? 'km' : 'mi';
        return `${planned.type}: ${planned.cardio.targetValue} ${unitLabel}`;
      }
    }
    
    // Strength workouts
    const exerciseCount = planned.exercises?.length || 0;
    return `${planned.type}: ${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`;
  }

  getWorkoutIcon(): string {
    const planned = this.getPlannedWorkout();
    if (!planned) return '🏋️';
    
    switch (planned.type) {
      case 'Running': return '🏃';
      case 'Cycling': return '🚴';
      case 'Swimming': return '🏊';
      case 'Cardio': return '❤️';
      case 'HIIT': return '⚡';
      case 'Yoga': return '🧘';
      default: return '🏋️';
    }
  }

  // ==================== WHOOP WORKOUT EDITING ====================
  
  openWhoopWorkoutEditor(workout: WhoopWorkout) {
    this.editingWhoopWorkout = workout;
    const workoutKey = this.getWorkoutKey(workout);
    this.exercises = this.whoopWorkoutExercises[workoutKey] ? [...this.whoopWorkoutExercises[workoutKey]] : [];
  }
  
  closeWhoopWorkoutEditor() {
    this.editingWhoopWorkout = null;
    this.exercises = [];
    this.exerciseName = '';
    this.exerciseWeight = '';
  }
  
  addExerciseToWhoop() {
    if (!this.exerciseName?.trim()) return;
    
    this.exercises.push({
      name: this.exerciseName.trim(),
      sets: this.exerciseSets || 3,
      reps: this.exerciseReps || '8-10',
      weight: this.exerciseWeight || '',
      notes: ''
    });
    
    this.exerciseName = '';
    this.exerciseWeight = '';
  }
  
  removeExerciseFromWhoop(index: number) {
    this.exercises.splice(index, 1);
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
      
      // Load yesterday's entry for comparison
      const yesterdayDate = getPreviousDay(this.selectedDate);
      this.yesterdayEntry = this.entries.find(e => e.date === yesterdayDate) || null;
      
      this.loadWhoopWorkoutExercises();
      this.loadSelectedDailyGoals();
      
      // Load meal entries from database
      await this.loadMealEntries();
      
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
      sleep: '', recovery: '', weight: ''
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
      weight: e.weight || ''
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
      
      const [recoveryData, sleepData, cycleDataToday, cycleDataYesterday] = await Promise.all([
        this.whoopService.getRecovery(selectedDate, selectedDate),
        this.whoopService.getSleep(selectedDate, selectedDate),
        this.whoopService.getCycles(selectedDate, selectedDate),
        this.whoopService.getCycles(previousDay, previousDay)
      ]);
      
      const recoveryRecord = recoveryData?.records?.[0];
      const sleepRecord = sleepData?.records?.[0];
      const cycleRecordToday = cycleDataToday?.records?.[0];
      const cycleRecordYesterday = cycleDataYesterday?.records?.[0];

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
      if (cycleRecordToday?.score?.strain != null) {
        this.healthForm.patchValue({ strain: Math.round(cycleRecordToday.score.strain * 10) / 10 });
        fieldsUpdated++;
      }
      
      // Also update yesterday's strain if we have data
      if (cycleRecordYesterday?.score?.strain != null) {
        const yesterdayStrain = Math.round(cycleRecordYesterday.score.strain * 10) / 10;
        const yesterdayEntry = this.entries.find(e => e.date === previousDay);
        if (yesterdayEntry?.id) {
          await this.healthDataService.updateEntry({
            id: yesterdayEntry.id,
            date: previousDay,
            strain: yesterdayStrain
          });
        }
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

  // Quick sync for today's date from the dashboard
  async quickSyncWhoop() {
    if (!this.whoopConnected) return;
    
    this.whoopSyncing = true;
    this.whoopSyncMessage = '';
    
    try {
      const today = getLocalDateString(new Date());
      const yesterday = getPreviousDay(today);
      
      const [recoveryData, sleepData, cycleDataToday, cycleDataYesterday] = await Promise.all([
        this.whoopService.getRecovery(today, today),
        this.whoopService.getSleep(today, today),
        this.whoopService.getCycles(today, today),
        this.whoopService.getCycles(yesterday, yesterday)
      ]);
      
      const recoveryRecord = recoveryData?.records?.[0];
      const sleepRecord = sleepData?.records?.[0];
      const cycleRecordToday = cycleDataToday?.records?.[0];
      const cycleRecordYesterday = cycleDataYesterday?.records?.[0];

      let fieldsUpdated = 0;
      const updates: any = { date: today };
      
      // Find or create today's entry
      let todayEntry = this.entries.find(e => e.date === today);
      
      if (recoveryRecord?.score?.recovery_score != null) {
        updates.recovery = recoveryRecord.score.recovery_score;
        fieldsUpdated++;
      }
      if (recoveryRecord?.score?.resting_heart_rate != null) {
        updates.rhr = recoveryRecord.score.resting_heart_rate;
        fieldsUpdated++;
      }
      if (sleepRecord?.score?.sleep_performance_percentage != null) {
        updates.sleep = sleepRecord.score.sleep_performance_percentage;
        fieldsUpdated++;
      }
      if (cycleRecordToday?.score?.strain != null) {
        updates.strain = Math.round(cycleRecordToday.score.strain * 10) / 10;
        fieldsUpdated++;
      }
      
      // Update or create today's entry
      if (fieldsUpdated > 0) {
        if (todayEntry?.id) {
          updates.id = todayEntry.id;
          await this.healthDataService.updateEntry(updates);
        } else {
          await this.healthDataService.saveEntry(updates);
        }
      }
      
      // Also update yesterday's strain if available
      if (cycleRecordYesterday?.score?.strain != null) {
        const yesterdayStrain = Math.round(cycleRecordYesterday.score.strain * 10) / 10;
        const yesterdayEntry = this.entries.find(e => e.date === yesterday);
        if (yesterdayEntry?.id) {
          await this.healthDataService.updateEntry({
            id: yesterdayEntry.id,
            date: yesterday,
            strain: yesterdayStrain
          });
        }
      }

      // Reload data to reflect changes
      await this.loadEntries();
      await this.loadDashboard();

      this.whoopSyncMessage = fieldsUpdated > 0 
        ? `✓ Synced ${fieldsUpdated} field(s)`
        : 'No new data';
      
      // Clear message after 3 seconds
      setTimeout(() => {
        this.whoopSyncMessage = '';
      }, 3000);
    } catch (error: any) {
      console.error('Quick sync error:', error);
      this.whoopSyncMessage = `Error: ${error.message || 'Sync failed'}`;
      setTimeout(() => {
        this.whoopSyncMessage = '';
      }, 5000);
    } finally {
      this.whoopSyncing = false;
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
      weight: f.weight ? parseFloat(f.weight) : undefined
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

  // ==================== NUTRITION ====================
  
  openNutritionPanel(): void {
    this.showNutritionPanel = true;
  }
  
  closeNutritionPanel(): void {
    this.showNutritionPanel = false;
  }
  
  openMealDetailPanel(mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    this.mealDetailType = mealType;
    this.showMealDetailPanel = true;
  }
  
  closeMealDetailPanel(): void {
    this.showMealDetailPanel = false;
  }
  
  async onMealEntriesChanged(entries: MealEntry[]): Promise<void> {
    console.log('Parent: onMealEntriesChanged called with', entries.length, 'entries');
    this.mealEntries = entries;
    
    // Reload meal entries from database to ensure consistency
    await this.loadMealEntries();
    
    await this.updateNutritionTotals();
    this.buildDailyActions();
  }
  
  async onMealTypeCompleted(mealType: string): Promise<void> {
    await this.toggleMealTypeCompleted(mealType);
  }
  
  async onNutritionPlanSaved(): Promise<void> {
    await this.updateNutritionTotals();
    await this.markActionComplete('nutrition');
    this.buildDailyActions();
    this.closeNutritionPanel();
  }

  async onNutritionTrackingFailed(): Promise<void> {
    try {
      const payload = {
        date: this.selectedDate,
        nutritionTrackingFailed: true,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0
      };
      
      if (this.currentEntry?.id) {
        await this.healthDataService.updateEntry({ id: this.currentEntry.id, ...payload });
      } else {
        await this.healthDataService.saveEntry(payload);
      }
      
      await this.loadEntries();
      this.currentEntry = this.entries.find(e => e.date === this.selectedDate) || null;
      
      // Mark nutrition as "completed" but as a failure
      await this.markActionComplete('nutrition');
      this.buildDailyActions();
      this.closeNutritionPanel();
    } catch (error) {
      console.error('Error marking tracking failed:', error);
    }
  }
  
  async loadMealEntries(): Promise<void> {
    try {
      this.mealEntries = await this.mealEntryService.getMealEntriesForDate(this.selectedDate);
    } catch (error) {
      console.error('Error loading meal entries:', error);
      this.mealEntries = [];
    }
  }
  
  private async updateNutritionTotals(): Promise<void> {
    const completedMeals = this.mealEntries.filter(m => m.completed);
    const totals = this.mealEntryService.calculateDailyTotals(completedMeals);
    
    const payload = {
      date: this.selectedDate,
      totalCalories: totals.totalCalories,
      totalProtein: totals.totalProtein,
      totalCarbs: totals.totalCarbs,
      totalFats: totals.totalFats
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
      console.error('Error updating nutrition totals:', error);
    }
  }
}
