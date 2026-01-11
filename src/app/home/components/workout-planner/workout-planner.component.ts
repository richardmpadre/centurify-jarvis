import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { HealthDataService } from '../../../services/health-data.service';
import { HealthEntry, PlannedExercise, PlannedWorkout } from '../../../models/health.models';

@Component({
  selector: 'app-workout-planner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workout-planner.component.html',
  styleUrl: './workout-planner.component.css'
})
export class WorkoutPlannerComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() currentEntry: HealthEntry | null = null;
  @Input() selectedDate = '';
  @Input() allEntries: HealthEntry[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() workoutSaved = new EventEmitter<void>();
  
  workoutForm: FormGroup;
  exercises: PlannedExercise[] = [];

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService
  ) {
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.loadExistingPlan();
    }
  }

  private loadExistingPlan(): void {
    this.exercises = [];
    
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

  addExercise(): void {
    const form = this.workoutForm.value;
    if (!form.exerciseName?.trim()) return;
    
    this.exercises.push({
      name: form.exerciseName.trim(),
      sets: form.exerciseSets || 3,
      reps: form.exerciseReps || '8-10',
      weight: form.exerciseWeight || '',
      notes: form.exerciseNotes || ''
    });
    
    this.workoutForm.patchValue({ 
      exerciseName: '', 
      exerciseWeight: '', 
      exerciseNotes: '' 
    });
  }

  removeExercise(index: number): void {
    this.exercises.splice(index, 1);
  }

  copyLastWorkout(): void {
    for (const entry of this.allEntries) {
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
    return this.allEntries.some(entry => {
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

  async saveWorkoutPlan(): Promise<void> {
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
      
      this.workoutSaved.emit();
      this.close.emit();
    } catch (error) {
      console.error('Error saving workout plan:', error);
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
