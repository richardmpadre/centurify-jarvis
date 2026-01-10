import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthEntry, PlannedWorkout, WhoopWorkout, PlannedExercise } from '../../../models/health.models';
import { MealEntry } from '../../../services/meal-entry.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  @Input() currentEntry: HealthEntry | null = null;
  @Input() whoopWorkouts: WhoopWorkout[] = [];
  @Input() mealEntries: MealEntry[] = [];
  @Input() isLoading = false;
  @Input() selectedDate = '';
  
  @Output() editEntry = new EventEmitter<void>();
  @Output() planWorkout = new EventEmitter<void>();
  @Output() toggleWorkoutComplete = new EventEmitter<void>();
  @Output() openWhoopWorkout = new EventEmitter<WhoopWorkout>();
  @Output() mergeWorkout = new EventEmitter<WhoopWorkout>();

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
    return completedMeals.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0),
      protein: totals.protein + (meal.protein || 0),
      carbs: totals.carbs + (meal.carbs || 0),
      fats: totals.fats + (meal.fats || 0)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  }

  getPlannedNutrition(): { calories: number; protein: number; fats: number; carbs: number } {
    // All planned meals (completed or not)
    return this.mealEntries.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0),
      protein: totals.protein + (meal.protein || 0),
      carbs: totals.carbs + (meal.carbs || 0),
      fats: totals.fats + (meal.fats || 0)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
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

}
