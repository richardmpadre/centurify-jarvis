import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkoutService, Workout, Exercise } from '../services/workout.service';

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './training.component.html',
  styleUrl: './training.component.css'
})
export class TrainingComponent implements OnInit {
  workouts: Workout[] = [];
  workoutForm: FormGroup;
  showForm = false;
  editingWorkoutId: string | null = null;
  searchQuery = '';
  categoryFilter = 'all';
  difficultyFilter = 'all';
  isLoading = false;
  isSaving = false;

  categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'strength', label: '💪 Strength' },
    { value: 'cardio', label: '🏃 Cardio' },
    { value: 'flexibility', label: '🧘 Flexibility' },
    { value: 'sports', label: '⚽ Sports' },
    { value: 'hiit', label: '🔥 HIIT' },
    { value: 'other', label: '📝 Other' }
  ];

  difficulties = [
    { value: 'all', label: 'All Levels' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  constructor(
    private fb: FormBuilder,
    private workoutService: WorkoutService
  ) {
    this.workoutForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      duration: [0, [Validators.min(0)]],
      category: ['strength'],
      difficulty: ['beginner'],
      estimatedCalories: [0, [Validators.min(0)]],
      exercises: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadWorkouts();
  }

  get exercises(): FormArray {
    return this.workoutForm.get('exercises') as FormArray;
  }

  createExerciseFormGroup(exercise?: Exercise): FormGroup {
    return this.fb.group({
      name: [exercise?.name || '', Validators.required],
      sets: [exercise?.sets || null],
      reps: [exercise?.reps || ''],
      weight: [exercise?.weight || null],
      notes: [exercise?.notes || '']
    });
  }

  addExercise(): void {
    this.exercises.push(this.createExerciseFormGroup());
  }

  removeExercise(index: number): void {
    this.exercises.removeAt(index);
  }

  async loadWorkouts(): Promise<void> {
    this.isLoading = true;
    try {
      this.workouts = await this.workoutService.getAllWorkouts();
      // Sort by most recently updated
      this.workouts.sort((a, b) => {
        const dateA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const dateB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return dateA - dateB;
      });
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openAddForm(): void {
    this.editingWorkoutId = null;
    this.workoutForm.reset({
      name: '',
      description: '',
      duration: 0,
      category: 'strength',
      difficulty: 'beginner',
      estimatedCalories: 0
    });
    // Clear exercises array
    while (this.exercises.length) {
      this.exercises.removeAt(0);
    }
    // Add one empty exercise
    this.addExercise();
    this.showForm = true;
  }

  openEditForm(workout: Workout): void {
    this.editingWorkoutId = workout.id;
    this.workoutForm.patchValue({
      name: workout.name,
      description: workout.description || '',
      duration: workout.duration || 0,
      category: workout.category || 'strength',
      difficulty: workout.difficulty || 'beginner',
      estimatedCalories: workout.estimatedCalories || 0
    });
    
    // Clear and populate exercises
    while (this.exercises.length) {
      this.exercises.removeAt(0);
    }
    if (workout.exercises && workout.exercises.length > 0) {
      workout.exercises.forEach(ex => {
        this.exercises.push(this.createExerciseFormGroup(ex));
      });
    } else {
      this.addExercise();
    }
    
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingWorkoutId = null;
  }

  async submitForm(): Promise<void> {
    if (!this.workoutForm.valid || this.isSaving) {
      return;
    }

    this.isSaving = true;
    const formValue = this.workoutForm.value;

    try {
      const workoutData = {
        name: formValue.name,
        description: formValue.description || null,
        duration: formValue.duration || null,
        category: formValue.category || null,
        difficulty: formValue.difficulty || null,
        estimatedCalories: formValue.estimatedCalories || null,
        exercises: formValue.exercises || []
      };

      if (this.editingWorkoutId) {
        // Update existing
        const updated = await this.workoutService.updateWorkout(this.editingWorkoutId, workoutData);
        
        if (updated) {
          const index = this.workouts.findIndex(w => w.id === this.editingWorkoutId);
          if (index !== -1) {
            this.workouts[index] = updated;
          }
        }
      } else {
        // Create new
        const created = await this.workoutService.createWorkout(workoutData);
        
        if (created) {
          this.workouts.unshift(created);
        }
      }
      
      this.closeForm();
    } catch (error) {
      console.error('Error saving workout:', error);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteWorkout(workout: Workout): Promise<void> {
    if (!confirm(`Delete "${workout.name}"?`)) return;
    
    const success = await this.workoutService.deleteWorkout(workout.id);
    if (success) {
      this.workouts = this.workouts.filter(w => w.id !== workout.id);
    }
  }

  async duplicateWorkout(workout: Workout): Promise<void> {
    const created = await this.workoutService.createWorkout({
      name: `${workout.name} (copy)`,
      description: workout.description,
      duration: workout.duration,
      category: workout.category,
      difficulty: workout.difficulty,
      estimatedCalories: workout.estimatedCalories,
      exercises: workout.exercises
    });
    
    if (created) {
      this.workouts.unshift(created);
    }
  }

  get filteredWorkouts(): Workout[] {
    let result = this.workouts;

    // Filter by search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(w => 
        w.name.toLowerCase().includes(query) ||
        (w.description && w.description.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (this.categoryFilter !== 'all') {
      result = result.filter(w => w.category === this.categoryFilter);
    }

    // Filter by difficulty
    if (this.difficultyFilter !== 'all') {
      result = result.filter(w => w.difficulty === this.difficultyFilter);
    }

    return result;
  }

  getAverageDuration(): number {
    const workoutsWithDuration = this.workouts.filter(w => w.duration && w.duration > 0);
    if (workoutsWithDuration.length === 0) return 0;
    const total = workoutsWithDuration.reduce((sum, w) => sum + (w.duration || 0), 0);
    return Math.round(total / workoutsWithDuration.length);
  }

  getTotalCalories(): number {
    return this.workouts.reduce((sum, w) => sum + (w.estimatedCalories || 0), 0);
  }

  getWorkoutsByCategory(category: string): number {
    return this.workouts.filter(w => w.category === category).length;
  }

  onSearchChange(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  getCategoryIcon(category: string | null): string {
    switch (category) {
      case 'strength': return '💪';
      case 'cardio': return '🏃';
      case 'flexibility': return '🧘';
      case 'sports': return '⚽';
      case 'hiit': return '🔥';
      default: return '📝';
    }
  }

  getDifficultyColor(difficulty: string | null): string {
    switch (difficulty) {
      case 'beginner': return '#00d4aa';
      case 'intermediate': return '#f59e0b';
      case 'advanced': return '#ef4444';
      default: return '#888';
    }
  }
}
