import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthEntry, PlannedWorkout, PlannedExercise, WhoopWorkout } from '../../../models/health.models';
import { copyWorkoutToClipboard, getRunTypeLabel } from '../../../utils/workout-utils';
import { ExerciseEditorComponent } from '../exercise-editor/exercise-editor.component';

@Component({
  selector: 'app-training-panel',
  standalone: true,
  imports: [CommonModule, ExerciseEditorComponent],
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
  @Output() workoutUpdated = new EventEmitter<PlannedWorkout>();

  copySuccess = false;
  isEditingExercises = false;
  editableExercises: PlannedExercise[] = [];

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

  getRunTypeLabelForDisplay(value: string): string {
    return getRunTypeLabel(value);
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
    this.isEditingExercises = false;
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

  // Calculate actual pace from duration and distance
  getActualPace(): string | null {
    const planned = this.getPlannedWorkout();
    if (!planned) return null;
    
    const cardio = (planned as any).cardio;
    const actualDuration = (planned as any).actualDuration;
    
    // Need distance target and actual duration to calculate pace
    if (!cardio || !actualDuration || cardio.targetType !== 'distance') return null;
    
    const distance = cardio.targetValue;
    if (!distance || distance <= 0) return null;
    
    // Calculate pace in minutes per unit (mile or km)
    const paceMinutes = actualDuration / distance;
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.round((paceMinutes - minutes) * 60);
    
    const unit = cardio.distanceUnit === 'km' ? 'km' : 'mi';
    return `${minutes}:${seconds.toString().padStart(2, '0')}/${unit}`;
  }

  copyToClipboard(): void {
    const planned = this.getPlannedWorkout();
    if (!planned) return;

    copyWorkoutToClipboard(planned, () => {
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    });
  }

  // Exercise editing
  startEditingExercises(): void {
    const planned = this.getPlannedWorkout();
    if (!planned) return;
    
    this.editableExercises = planned.exercises?.map(e => ({ ...e })) || [];
    this.isEditingExercises = true;
  }

  onExercisesChanged(exercises: PlannedExercise[]): void {
    this.editableExercises = exercises;
  }

  saveExercises(): void {
    const planned = this.getPlannedWorkout();
    if (!planned) return;
    
    const updatedWorkout: PlannedWorkout = {
      ...planned,
      exercises: this.editableExercises
    };
    
    this.workoutUpdated.emit(updatedWorkout);
    this.isEditingExercises = false;
  }

  cancelEditingExercises(): void {
    this.isEditingExercises = false;
    this.editableExercises = [];
  }
}
