import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { HealthDataService } from '../../../services/health-data.service';
import { ChatService } from '../../../services/chat.service';
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
  isGeneratingAI = false;
  aiError: string | null = null;
  aiRecommendation: string | null = null;

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private chatService: ChatService
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
    this.aiRecommendation = null;
    
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
    this.aiRecommendation = null;
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

  async generateAIRecommendation(): Promise<void> {
    this.isGeneratingAI = true;
    this.aiError = null;
    this.aiRecommendation = null;

    try {
      // Build training data
      const trainingData = this.buildTrainingData();
      
      // Call AI agent
      const aiPlan = await this.chatService.generateWorkoutPlan(trainingData);
      
      // Store AI recommendation
      this.aiRecommendation = aiPlan.recommendation;
      
      // Populate form with AI recommendations
      this.workoutForm.patchValue({
        type: aiPlan.workoutType,
        targetDuration: aiPlan.targetDuration
      });
      
      // Populate exercises
      this.exercises = aiPlan.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.suggestedWeight,
        notes: ex.progression || ex.notes || ''
      }));
      
    } catch (error) {
      console.error('Error generating AI workout plan:', error);
      this.aiError = error instanceof Error ? error.message : 'Failed to generate AI workout plan';
    } finally {
      this.isGeneratingAI = false;
    }
  }

  private buildTrainingData(): any {
    // Current day metrics
    const currentDay = {
      date: this.selectedDate,
      recovery: this.currentEntry?.recovery || null,
      sleep: this.currentEntry?.sleep || null,
      rhr: this.currentEntry?.rhr || null,
      strain: this.currentEntry?.strain || null,
      weight: this.currentEntry?.weight || null,
      nutritionPlan: this.currentEntry?.totalCalories ? {
        calories: this.currentEntry.totalCalories,
        protein: this.currentEntry.totalProtein || 0,
        carbs: this.currentEntry.totalCarbs || 0,
        fats: this.currentEntry.totalFats || 0
      } : undefined
    };

    // Recent training history (last 14 days)
    const recentHistory = this.allEntries
      .filter(entry => entry.date < this.selectedDate)
      .slice(0, 14)
      .map(entry => {
        const historyItem: any = {
          date: entry.date,
          type: 'Rest Day',
          strain: entry.strain || null,
          completed: true
        };

        if (entry.plannedWorkout) {
          try {
            const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
            historyItem.type = planned.type;
            historyItem.duration = planned.targetDuration;
            historyItem.exercises = planned.exercises.map(ex => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight
            }));
          } catch { /* skip */ }
        }

        return historyItem;
      });

    // User profile (basic defaults for now)
    const userProfile = {
      trainingGoal: 'strength_building',
      experienceLevel: 'intermediate',
      preferredDuration: 60,
      availableEquipment: ['barbell', 'dumbbells', 'rack', 'bench', 'cables', 'machines']
    };

    // Current plan if exists
    let currentPlan = null;
    if (this.currentEntry?.plannedWorkout) {
      try {
        currentPlan = JSON.parse(this.currentEntry.plannedWorkout);
      } catch { /* skip */ }
    }

    return {
      currentDay,
      userProfile,
      recentHistory,
      currentPlan
    };
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
