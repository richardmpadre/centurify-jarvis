import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlannedExercise } from '../../../models/health.models';

@Component({
  selector: 'app-exercise-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exercise-editor.component.html',
  styleUrl: './exercise-editor.component.css'
})
export class ExerciseEditorComponent {
  @Input() exercises: PlannedExercise[] = [];
  @Input() showAddForm = true;
  @Input() compactMode = false;
  
  @Output() exercisesChange = new EventEmitter<PlannedExercise[]>();

  // Form fields for adding new exercise
  exerciseName = '';
  exerciseSets = 3;
  exerciseReps = '8-10';
  exerciseWeight = '';
  exerciseNotes = '';

  // Editing state
  editingIndex: number | null = null;
  editExercise: PlannedExercise | null = null;

  addExercise(): void {
    if (!this.exerciseName?.trim()) return;
    
    const newExercise: PlannedExercise = {
      name: this.exerciseName.trim(),
      sets: this.exerciseSets || 3,
      reps: this.exerciseReps || '8-10',
      weight: this.exerciseWeight || '',
      notes: this.exerciseNotes || ''
    };
    
    this.exercises = [...this.exercises, newExercise];
    this.emitChanges();
    
    // Reset form
    this.exerciseName = '';
    this.exerciseWeight = '';
    this.exerciseNotes = '';
  }

  removeExercise(index: number): void {
    this.exercises = this.exercises.filter((_, i) => i !== index);
    this.emitChanges();
  }

  startEdit(index: number): void {
    this.editingIndex = index;
    this.editExercise = { ...this.exercises[index] };
  }

  saveEdit(): void {
    if (this.editingIndex === null || !this.editExercise) return;
    
    this.exercises = this.exercises.map((ex, i) => 
      i === this.editingIndex ? { ...this.editExercise! } : ex
    );
    this.emitChanges();
    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingIndex = null;
    this.editExercise = null;
  }

  private emitChanges(): void {
    this.exercisesChange.emit([...this.exercises]);
  }
}
