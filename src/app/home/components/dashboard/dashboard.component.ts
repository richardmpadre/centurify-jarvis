import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthEntry, PlannedWorkout, WhoopWorkout, PlannedExercise } from '../../../models/health.models';

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
}
