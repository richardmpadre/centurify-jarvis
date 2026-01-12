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
  copySuccess = false;

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private chatService: ChatService
  ) {
    this.workoutForm = this.fb.group({
      type: ['Strength Training'],
      targetDuration: [40],
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
    // Always start with a fresh form (default 40 minutes)
    // Users can use "Copy Last Workout" if they want to load previous plan
    this.exercises = [];
    this.aiRecommendation = null;
    this.workoutForm.patchValue({
      type: 'Strength Training',
      targetDuration: 40
    });
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
      
      console.log('=== AI Workout Plan Request ===');
      console.log('Training data being sent to AI:', JSON.stringify(trainingData, null, 2));
      
      // Call AI agent
      const aiPlan = await this.chatService.generateWorkoutPlan(trainingData);
      
      console.log('=== AI Workout Plan Response ===');
      console.log('AI Plan received:', JSON.stringify(aiPlan, null, 2));
      
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
      
      console.log('Exercises populated from AI:', this.exercises);
      
    } catch (error) {
      console.error('Error generating AI workout plan:', error);
      this.aiError = error instanceof Error ? error.message : 'Failed to generate AI workout plan';
    } finally {
      this.isGeneratingAI = false;
    }
  }

  private buildTrainingData(): any {
    const selectedType = this.workoutForm.value.type || 'Strength Training';
    
    // Current day metrics
    const currentDay = {
      date: this.selectedDate,
      recovery: this.currentEntry?.recovery || null,
      sleep: this.currentEntry?.sleep || null,
      rhr: this.currentEntry?.rhr || null,
      strain: this.currentEntry?.strain || null,
      weight: this.currentEntry?.weight || null,
      targetDuration: this.workoutForm.value.targetDuration || 40,
      workoutType: selectedType,
      nutritionPlan: this.currentEntry?.totalCalories ? {
        calories: this.currentEntry.totalCalories,
        protein: this.currentEntry.totalProtein || 0,
        carbs: this.currentEntry.totalCarbs || 0,
        fats: this.currentEntry.totalFats || 0
      } : undefined
    };

    // Get last 3 workouts of the SAME type for progression tracking
    const sameTypeWorkouts = this.allEntries
      .filter(entry => entry.date < this.selectedDate && entry.plannedWorkout)
      .map(entry => {
        try {
          const planned = JSON.parse(entry.plannedWorkout!) as PlannedWorkout;
          return {
            date: entry.date,
            type: planned.type,
            duration: planned.targetDuration,
            strain: entry.strain || null,
            recovery: entry.recovery || null,
            exercises: planned.exercises.map(ex => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight
            }))
          };
        } catch {
          return null;
        }
      })
      .filter(item => item !== null && item.type === selectedType)
      .slice(0, 3); // Last 3 workouts of same type

    console.log(`Found ${sameTypeWorkouts.length} previous ${selectedType} workouts`);

    // User profile with specific equipment
    const userProfile = {
      trainingGoal: 'strength_building',
      experienceLevel: 'intermediate',
      preferredDuration: 40,
      availableEquipment: ['dumbbells', 'bench'],
      availableWeights: [10, 20, 25, 30, 35] // lbs
    };

    return {
      currentDay,
      userProfile,
      sameTypeHistory: sameTypeWorkouts, // Renamed for clarity
      workoutType: selectedType
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

  copyToClipboard(): void {
    const workoutType = this.workoutForm.value.type || 'Workout';
    const duration = this.workoutForm.value.targetDuration || 60;
    
    let text = `${workoutType} - ${duration} min\n`;
    text += `Date: ${this.selectedDate}\n\n`;
    
    if (this.aiRecommendation) {
      text += `AI Recommendation: ${this.aiRecommendation}\n\n`;
    }
    
    text += `Exercises:\n`;
    this.exercises.forEach((ex, i) => {
      text += `${i + 1}. ${ex.name}\n`;
      text += `   ${ex.sets} × ${ex.reps}`;
      if (ex.weight) {
        text += ` @ ${ex.weight}`;
      }
      text += `\n`;
      if (ex.notes) {
        text += `   Note: ${ex.notes}\n`;
      }
    });
    
    navigator.clipboard.writeText(text).then(() => {
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }
}
