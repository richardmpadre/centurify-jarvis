import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HealthEntry, PlannedWorkout, WhoopWorkout, PlannedExercise } from '../../../models/health.models';
import { MealEntry } from '../../../services/meal-entry.service';
import { Goal, GOAL_TYPE_CONFIG, GOAL_STATUS_CONFIG } from '../../../models/goal.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  @Input() currentEntry: HealthEntry | null = null;
  @Input() yesterdayEntry: HealthEntry | null = null;
  @Input() whoopWorkouts: WhoopWorkout[] = [];
  @Input() mealEntries: MealEntry[] = [];
  @Input() activeGoals: Goal[] = [];
  @Input() isLoading = false;
  @Input() selectedDate = '';
  
  @Output() editEntry = new EventEmitter<void>();
  @Output() planWorkout = new EventEmitter<void>();
  @Output() toggleWorkoutComplete = new EventEmitter<void>();
  @Output() openWhoopWorkout = new EventEmitter<WhoopWorkout>();
  @Output() mergeWorkout = new EventEmitter<WhoopWorkout>();
  @Output() openInsights = new EventEmitter<void>();

  showActivities = false;

  getPlannedWorkout(): PlannedWorkout | null {
    if (!this.currentEntry?.plannedWorkout) return null;
    try {
      return JSON.parse(this.currentEntry.plannedWorkout);
    } catch {
      return null;
    }
  }

  hasPlannedWorkoutToMerge(): boolean {
    return this.getPlannedWorkout() !== null;
  }

  onPlanWorkout(): void {
    this.planWorkout.emit();
  }

  onToggleComplete(): void {
    this.toggleWorkoutComplete.emit();
  }

  onEditEntry(): void {
    this.editEntry.emit();
  }

  onOpenInsights(): void {
    this.openInsights.emit();
  }

  onOpenWhoopWorkout(workout: WhoopWorkout): void {
    this.openWhoopWorkout.emit(workout);
  }

  onMergeWorkout(workout: WhoopWorkout, event: Event): void {
    event.stopPropagation();
    this.mergeWorkout.emit(workout);
  }

  // Get workout exercises from trainingNotes
  getWhoopWorkoutExercises(workout: WhoopWorkout): PlannedExercise[] {
    if (!this.currentEntry?.trainingNotes) return [];
    try {
      const exercises = JSON.parse(this.currentEntry.trainingNotes);
      const key = workout.startTime || `workout-${workout.sport}`;
      return exercises[key] || [];
    } catch {
      return [];
    }
  }

  // Nutrition - calculate from meal entries directly for accuracy
  getCompletedNutrition(): { calories: number; protein: number; fats: number; carbs: number } {
    // Only count meals that are marked as completed
    const completedMeals = this.mealEntries.filter(m => m.completed);
    const totals = completedMeals.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0) * (meal.portion || 1),
      protein: totals.protein + (meal.protein || 0) * (meal.portion || 1),
      carbs: totals.carbs + (meal.carbs || 0) * (meal.portion || 1),
      fats: totals.fats + (meal.fats || 0) * (meal.portion || 1)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
    
    // Round all values to whole numbers
    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fats: Math.round(totals.fats)
    };
  }

  getPlannedNutrition(): { calories: number; protein: number; fats: number; carbs: number } {
    // All planned meals (completed or not)
    const totals = this.mealEntries.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0) * (meal.portion || 1),
      protein: totals.protein + (meal.protein || 0) * (meal.portion || 1),
      carbs: totals.carbs + (meal.carbs || 0) * (meal.portion || 1),
      fats: totals.fats + (meal.fats || 0) * (meal.portion || 1)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
    
    // Round all values to whole numbers
    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fats: Math.round(totals.fats)
    };
  }

  hasNutritionData(): boolean {
    return this.mealEntries.length > 0 || (this.currentEntry?.totalCalories ?? 0) > 0;
  }

  getNutritionProgress(type: 'calories' | 'protein' | 'carbs' | 'fats'): number {
    const completed = this.getCompletedNutrition()[type];
    const planned = this.getPlannedNutrition()[type];
    if (planned === 0) return 0;
    return Math.round((completed / planned) * 100);
  }

  // Get wellness score from daily insights
  getWellnessScore(): number | null {
    if (!this.currentEntry?.dailyInsights) return null;
    try {
      const insights = JSON.parse(this.currentEntry.dailyInsights);
      return insights.wellness_score ?? null;
    } catch {
      return null;
    }
  }

  getWellnessScoreColor(): string {
    const score = this.getWellnessScore();
    if (score === null) return '#888';
    if (score >= 80) return '#22c55e'; // Green
    if (score >= 60) return '#eab308'; // Yellow
    if (score >= 40) return '#f97316'; // Orange
    return '#ef4444'; // Red
  }

  onViewActivities(): void {
    this.showActivities = true;
  }

  closeActivities(): void {
    this.showActivities = false;
  }

  formatTime(isoString: string | undefined): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '0 min';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes} min`;
  }

  // Daily comparison methods
  getComparison(metric: 'recovery' | 'sleep' | 'strain' | 'rhr' | 'weight' | 'calories' | 'protein' | 'carbs' | 'fats'): { 
    value: number; 
    isPositive: boolean; 
    isGood: boolean;
  } | null {
    if (!this.currentEntry || !this.yesterdayEntry) return null;

    let currentValue: number | null = null;
    let yesterdayValue: number | null = null;

    // Get values based on metric
    switch (metric) {
      case 'recovery':
      case 'sleep':
      case 'strain':
      case 'rhr':
      case 'weight':
        currentValue = this.currentEntry[metric] ?? null;
        yesterdayValue = this.yesterdayEntry[metric] ?? null;
        break;
      case 'calories':
      case 'protein':
      case 'carbs':
      case 'fats':
        const currentNutrition = this.getCompletedNutrition();
        const yesterdayNutritionField = `total${metric.charAt(0).toUpperCase() + metric.slice(1)}` as 'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFats';
        currentValue = currentNutrition[metric];
        yesterdayValue = this.yesterdayEntry[yesterdayNutritionField] ?? null;
        break;
    }

    if (currentValue === null || yesterdayValue === null) return null;

    const diff = currentValue - yesterdayValue;
    if (diff === 0) return null;

    const isPositive = diff > 0;
    
    // Determine if positive change is "good" based on metric
    let isGood = false;
    switch (metric) {
      case 'recovery':
      case 'sleep':
      case 'weight': // Assuming weight gain is good (could be adjusted based on goals)
      case 'calories':
      case 'protein':
      case 'carbs':
      case 'fats':
        isGood = isPositive; // Higher is better
        break;
      case 'strain':
        isGood = isPositive; // Higher strain means more activity (context-dependent)
        break;
      case 'rhr':
        isGood = !isPositive; // Lower resting heart rate is better
        break;
    }

    return {
      value: Math.abs(diff),
      isPositive,
      isGood
    };
  }

  getComparisonClass(metric: 'recovery' | 'sleep' | 'strain' | 'rhr' | 'weight' | 'calories' | 'protein' | 'carbs' | 'fats'): string {
    const comparison = this.getComparison(metric);
    if (!comparison) return '';
    return comparison.isGood ? 'positive' : 'negative';
  }

  formatComparison(metric: 'recovery' | 'sleep' | 'strain' | 'rhr' | 'weight' | 'calories' | 'protein' | 'carbs' | 'fats'): string {
    const comparison = this.getComparison(metric);
    if (!comparison) return '';
    
    const sign = comparison.isPositive ? '+' : '-';
    let value = comparison.value.toFixed(metric === 'strain' ? 1 : 0);
    
    // Add appropriate suffix
    switch (metric) {
      case 'recovery':
      case 'sleep':
        return `${sign}${value}%`;
      case 'weight':
        return `${sign}${value}lbs`;
      case 'rhr':
        return `${sign}${value}bpm`;
      case 'calories':
        return `${sign}${value}cal`;
      case 'protein':
      case 'carbs':
      case 'fats':
        return `${sign}${value}g`;
      default:
        return `${sign}${value}`;
    }
  }

  // Goals helpers
  getGoalTypeConfig(goal: Goal) {
    return GOAL_TYPE_CONFIG[goal.goalType];
  }

  getGoalStatusConfig(goal: Goal) {
    return GOAL_STATUS_CONFIG[goal.status];
  }

  getGoalProgressColor(progress: number): string {
    if (progress >= 100) return '#22c55e';
    if (progress >= 70) return '#84cc16';
    if (progress >= 40) return '#eab308';
    if (progress >= 20) return '#f97316';
    return '#ef4444';
  }

}

