import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthEntry, PlannedWorkout, PlannedExercise, WhoopWorkout } from '../../../models/health.models';

@Component({
  selector: 'app-training-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './training-panel.component.html',
  styleUrl: './training-panel.component.css'
})
export class TrainingPanelComponent {
  @Input() isOpen = false;
  @Input() currentEntry: HealthEntry | null = null;
  @Input() whoopWorkouts: WhoopWorkout[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() editPlan = new EventEmitter<void>();
  @Output() markComplete = new EventEmitter<void>();
  @Output() openWhoopWorkout = new EventEmitter<WhoopWorkout>();
  @Output() mergeWorkout = new EventEmitter<WhoopWorkout>();

  // Run types for display
  private runTypes: { [key: string]: string } = {
    'zone2': 'Zone 2 (Easy/Aerobic)',
    'tempo': 'Tempo Run',
    'intervals': 'Intervals',
    'long_run': 'Long Run',
    'recovery': 'Recovery Run',
    'fartlek': 'Fartlek',
    'race_pace': 'Race Pace',
    'hill_repeats': 'Hill Repeats'
  };

  getPlannedWorkout(): PlannedWorkout | null {
    if (!this.currentEntry?.plannedWorkout) return null;
    try {
      return JSON.parse(this.currentEntry.plannedWorkout);
    } catch {
      return null;
    }
  }

  hasPlannedWorkoutToMerge(): boolean {
    return this.getPlannedWorkout() !== null && !this.currentEntry?.workoutCompleted;
  }

  getRunTypeLabel(value: string): string {
    return this.runTypes[value] || value;
  }

  getWorkoutIcon(type: string): string {
    switch (type) {
      case 'Running': return '🏃';
      case 'Cycling': return '🚴';
      case 'Swimming': return '🏊';
      case 'Cardio': return '❤️';
      case 'HIIT': return '⚡';
      case 'Yoga': return '🧘';
      default: return '🏋️';
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onEditPlan(): void {
    this.editPlan.emit();
    this.close.emit();
  }

  onMarkComplete(): void {
    this.markComplete.emit();
    this.close.emit();
  }

  onOpenWhoopWorkout(workout: WhoopWorkout): void {
    this.openWhoopWorkout.emit(workout);
  }

  onMergeWorkout(workout: WhoopWorkout, event: Event): void {
    event.stopPropagation();
    this.mergeWorkout.emit(workout);
  }
}
