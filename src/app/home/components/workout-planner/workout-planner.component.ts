import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HealthDataService } from '../../../services/health-data.service';
import { ChatService } from '../../../services/chat.service';
import { WorkoutService, Workout } from '../../../services/workout.service';
import { HealthEntry, PlannedExercise, PlannedWorkout, CardioWorkoutPlan } from '../../../models/health.models';
import { ExerciseEditorComponent } from '../exercise-editor/exercise-editor.component';

// Workout types that use cardio-style planning
const CARDIO_WORKOUT_TYPES = ['Running', 'Cycling', 'Swimming'];

@Component({
  selector: 'app-workout-planner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ExerciseEditorComponent],
  templateUrl: './workout-planner.component.html',
  styleUrl: './workout-planner.component.css'
})
export class WorkoutPlannerComponent implements OnChanges, OnInit {
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
  
  // Training templates
  savedWorkouts: Workout[] = [];
  showTemplateList = false;
  isLoadingTemplates = false;

  // Run types for cardio workouts
  runTypes = [
    { value: 'zone2', label: 'Zone 2 (Easy/Aerobic)' },
    { value: 'tempo', label: 'Tempo Run' },
    { value: 'intervals', label: 'Intervals' },
    { value: 'long_run', label: 'Long Run' },
    { value: 'recovery', label: 'Recovery Run' },
    { value: 'fartlek', label: 'Fartlek' },
    { value: 'race_pace', label: 'Race Pace' },
    { value: 'hill_repeats', label: 'Hill Repeats' }
  ];

  // Form default values
  private readonly DEFAULT_VALUES = {
    type: 'Strength Training',
    targetDuration: 40,
    exerciseSets: 3,
    exerciseReps: '8-10',
    runType: 'zone2',
    targetType: 'time',
    targetValue: 30,
    distanceUnit: 'miles'
  };

  constructor(
    private fb: FormBuilder,
    private healthDataService: HealthDataService,
    private chatService: ChatService,
    private workoutService: WorkoutService
  ) {
    this.workoutForm = this.fb.group({
      type: [this.DEFAULT_VALUES.type],
      targetDuration: [this.DEFAULT_VALUES.targetDuration],
      // Strength training fields
      exerciseName: [''],
      exerciseSets: [this.DEFAULT_VALUES.exerciseSets],
      exerciseReps: [this.DEFAULT_VALUES.exerciseReps],
      exerciseWeight: [''],
      exerciseNotes: [''],
      // Cardio fields
      runType: [this.DEFAULT_VALUES.runType],
      targetType: [this.DEFAULT_VALUES.targetType],
      targetValue: [this.DEFAULT_VALUES.targetValue],
      distanceUnit: [this.DEFAULT_VALUES.distanceUnit],
      targetPace: [''],
      targetSpeed: [''], // Speed in mph (for treadmill)
      cardioNotes: ['']
    });
  }

  // ===== Speed/Pace Conversion =====
  
  /**
   * Convert speed (mph) to pace (min:sec/mi)
   * Formula: pace = 60 / speed
   */
  onSpeedChange(): void {
    const speed = parseFloat(this.workoutForm.value.targetSpeed);
    if (!speed || speed <= 0) return;
    
    const paceMinutes = 60 / speed;
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.round((paceMinutes - minutes) * 60);
    const pace = `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
    
    this.workoutForm.patchValue({ targetPace: pace }, { emitEvent: false });
  }
  
  /**
   * Convert pace (min:sec/mi) to speed (mph)
   * Formula: speed = 60 / pace_in_minutes
   */
  onPaceChange(): void {
    const pace = this.workoutForm.value.targetPace;
    if (!pace) return;
    
    // Parse pace like "9:00/mi" or "9:30"
    const match = pace.match(/(\d+):(\d+)/);
    if (!match) return;
    
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const paceInMinutes = minutes + (seconds / 60);
    
    if (paceInMinutes <= 0) return;
    
    const speed = 60 / paceInMinutes;
    this.workoutForm.patchValue({ targetSpeed: speed.toFixed(1) }, { emitEvent: false });
  }

  ngOnInit(): void {
    this.loadSavedWorkouts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue) {
      this.resetForm();
    }
  }

  // ===== Workout Type Checks =====
  
  isCardioWorkout(): boolean {
    return CARDIO_WORKOUT_TYPES.includes(this.workoutForm.value.type);
  }

  isRestDay(): boolean {
    return this.workoutForm.value.type === 'Rest Day';
  }

  // ===== Template Management =====

  async loadSavedWorkouts(): Promise<void> {
    this.isLoadingTemplates = true;
    try {
      this.savedWorkouts = await this.workoutService.getAllWorkouts();
      // Sort by most recently updated
      this.savedWorkouts.sort((a, b) => {
        const dateA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const dateB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return dateA - dateB;
      });
    } catch (error) {
      console.error('Failed to load saved workouts:', error);
    } finally {
      this.isLoadingTemplates = false;
    }
  }

  toggleTemplateList(): void {
    this.showTemplateList = !this.showTemplateList;
  }

  loadTemplate(workout: Workout): void {
    this.aiRecommendation = null;
    
    // Set workout type and duration
    this.workoutForm.patchValue({
      type: this.mapCategoryToType(workout.category),
      targetDuration: workout.duration || 40
    });
    
    // Load exercises
    this.exercises = workout.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets || 3,
      reps: ex.reps || '8-10',
      weight: ex.weight ? ex.weight.toString() : '',
      notes: ex.notes || ''
    }));
    
    this.showTemplateList = false;
  }

  private mapCategoryToType(category: string | null): string {
    const categoryMap: Record<string, string> = {
      strength: 'Strength Training',
      cardio: 'Running',
      hiit: 'Strength Training',
      flexibility: 'Yoga',
      sports: 'Other'
    };
    return categoryMap[category || ''] || 'Strength Training';
  }

  // ===== Form Management =====

  private resetForm(): void {
    this.exercises = [];
    this.aiRecommendation = null;
    this.workoutForm.patchValue({
      type: this.DEFAULT_VALUES.type,
      targetDuration: this.DEFAULT_VALUES.targetDuration
    });
  }

  // ===== Exercise Management =====

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

  onExercisesChanged(exercises: PlannedExercise[]): void {
    this.exercises = exercises;
  }

  // ===== Copy Last Workout =====

  copyLastWorkout(): void {
    this.aiRecommendation = null;
    const lastWorkout = this.getLastWorkout();
    
    if (!lastWorkout) return;
    
    const planned = lastWorkout.workout;
    const isCurrentCardio = CARDIO_WORKOUT_TYPES.includes(this.workoutForm.value.type);
    
    // For cardio, copy cardio data
    if (isCurrentCardio && planned.cardio) {
      this.workoutForm.patchValue({ 
        type: planned.type,
        targetDuration: planned.targetDuration,
        runType: planned.cardio.runType,
        targetType: planned.cardio.targetType,
        targetValue: planned.cardio.targetValue,
        distanceUnit: planned.cardio.distanceUnit || 'miles',
        targetPace: planned.cardio.targetPace || '',
        targetSpeed: planned.cardio.targetSpeed || '',
        cardioNotes: planned.cardio.notes || ''
      });
      return;
    }
    
    // For strength, copy exercises
    if (!isCurrentCardio && planned.exercises?.length > 0) {
      this.exercises = planned.exercises.map(e => ({ ...e }));
      this.workoutForm.patchValue({ 
        type: planned.type,
        targetDuration: planned.targetDuration 
      });
    }
  }

  private getLastWorkout(): { workout: PlannedWorkout; date: string } | null {
    const currentType = this.workoutForm.value.type;
    const isCurrentCardio = CARDIO_WORKOUT_TYPES.includes(currentType);
    
    for (const entry of this.allEntries) {
      if (entry.date === this.selectedDate) continue;
      
      if (entry.plannedWorkout) {
        try {
          const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
          
          // For cardio, look for cardio workouts
          if (isCurrentCardio && planned.cardio) {
            return { workout: planned, date: entry.date };
          }
          
          // For strength, look for workouts with exercises
          if (!isCurrentCardio && planned.exercises?.length > 0) {
            return { workout: planned, date: entry.date };
          }
        } catch { /* skip */ }
      }
    }
    return null;
  }

  hasLastWorkout(): boolean {
    return this.getLastWorkout() !== null;
  }

  getLastWorkoutDetails(): string {
    const lastWorkout = this.getLastWorkout();
    if (!lastWorkout) return '';
    
    const { workout: planned, date } = lastWorkout;
    const isCurrentCardio = CARDIO_WORKOUT_TYPES.includes(this.workoutForm.value.type);
    
    // Format date
    const workoutDate = new Date(date);
    const formattedDate = workoutDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    // For cardio
    if (isCurrentCardio && planned.cardio) {
      const parts: string[] = [];
      
      // Date first
      parts.push(formattedDate);
      
      // Run type
      parts.push(this.getRunTypeLabel(planned.cardio.runType));
      
      // Target based on type
      if (planned.cardio.targetType === 'pace') {
        // Pace-based target
        if (planned.cardio.targetPace) {
          parts.push(`@ ${planned.cardio.targetPace}`);
        }
        if (planned.targetDuration && planned.targetDuration > 0) {
          parts.push(`${planned.targetDuration} min`);
        }
      } else if (planned.cardio.targetType === 'time') {
        parts.push(`${planned.cardio.targetValue} min`);
        if (planned.cardio.targetPace) {
          parts.push(`@ ${planned.cardio.targetPace}`);
        }
      } else {
        // Distance-based
        const unit = planned.cardio.distanceUnit === 'km' ? 'km' : 'mi';
        parts.push(`${planned.cardio.targetValue} ${unit}`);
        
        // Show estimated time for distance-based
        if (planned.targetDuration && planned.targetDuration > 0) {
          parts.push(`~${planned.targetDuration} min`);
        }
        
        // Pace if available
        if (planned.cardio.targetPace) {
          parts.push(`@ ${planned.cardio.targetPace}`);
        }
      }
      
      return parts.join(' • ');
    }
    
    // For strength
    if (!isCurrentCardio && planned.exercises?.length > 0) {
      return `${formattedDate} • ${planned.exercises.length} exercise${planned.exercises.length !== 1 ? 's' : ''} • ${planned.targetDuration} min`;
    }
    
    return '';
  }

  // ===== AI Workout Generation =====

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
    const selectedType = this.workoutForm.value.type || this.DEFAULT_VALUES.type;
    
    return {
      currentDay: this.buildCurrentDayData(selectedType),
      userProfile: this.buildUserProfile(),
      sameTypeHistory: this.getSameTypeWorkoutHistory(selectedType),
      workoutType: selectedType
    };
  }

  private buildCurrentDayData(workoutType: string): any {
    return {
      date: this.selectedDate,
      recovery: this.currentEntry?.recovery || null,
      sleep: this.currentEntry?.sleep || null,
      rhr: this.currentEntry?.rhr || null,
      strain: this.currentEntry?.strain || null,
      weight: this.currentEntry?.weight || null,
      targetDuration: this.workoutForm.value.targetDuration || this.DEFAULT_VALUES.targetDuration,
      workoutType,
      nutritionPlan: this.currentEntry?.totalCalories ? {
        calories: this.currentEntry.totalCalories,
        protein: this.currentEntry.totalProtein || 0,
        carbs: this.currentEntry.totalCarbs || 0,
        fats: this.currentEntry.totalFats || 0
      } : undefined
    };
  }

  private buildUserProfile(): any {
    return {
      trainingGoal: 'strength_building',
      experienceLevel: 'intermediate',
      preferredDuration: this.DEFAULT_VALUES.targetDuration,
      availableEquipment: ['dumbbells', 'bench'],
      availableWeights: [10, 20, 25, 30, 35] // lbs
    };
  }

  private getSameTypeWorkoutHistory(selectedType: string): any[] {
    return this.allEntries
      .filter(entry => entry.date < this.selectedDate && entry.plannedWorkout)
      .map(entry => this.parseWorkoutHistory(entry))
      .filter(item => item !== null && item.type === selectedType)
      .slice(0, 3); // Last 3 workouts of same type
  }

  private parseWorkoutHistory(entry: HealthEntry): any {
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
  }

  // ===== Save Workout =====

  async saveWorkoutPlan(): Promise<void> {
    const plannedWorkout = this.buildPlannedWorkout();
    
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

  private buildPlannedWorkout(): PlannedWorkout {
    if (this.isRestDay()) {
      return this.buildRestDayWorkout();
    }
    
    if (this.isCardioWorkout()) {
      return this.buildCardioWorkout();
    }
    
    return this.buildStrengthWorkout();
  }

  private buildRestDayWorkout(): PlannedWorkout {
    return {
      type: 'Rest Day',
      targetDuration: 0,
      exercises: []
    };
  }

  private buildCardioWorkout(): PlannedWorkout {
    const form = this.workoutForm.value;
    
    const cardio: CardioWorkoutPlan = {
      runType: form.runType,
      targetType: form.targetType,
      targetValue: form.targetValue || 0,
      distanceUnit: form.distanceUnit || 'miles',
      targetPace: form.targetPace || undefined,
      targetSpeed: form.targetSpeed ? parseFloat(form.targetSpeed) : undefined,
      notes: form.cardioNotes || undefined
    };
    
    // Calculate target duration based on target type
    let targetDuration = form.targetDuration;
    if (form.targetType === 'time') {
      targetDuration = form.targetValue;
    } else if (form.targetType === 'pace') {
      // For pace targets, use the duration from the form
      targetDuration = form.targetDuration;
    } else {
      // For distance targets, estimate duration if possible
      const estimated = this.getEstimatedDuration();
      targetDuration = estimated || form.targetDuration;
    }
    
    return {
      type: form.type,
      targetDuration,
      exercises: [],
      cardio
    };
  }

  private buildStrengthWorkout(): PlannedWorkout {
    const form = this.workoutForm.value;
    return {
      type: form.type,
      targetDuration: form.targetDuration,
      exercises: this.exercises
    };
  }

  // ===== Utility Methods =====

  onClose(): void {
    this.close.emit();
  }

  copyToClipboard(): void {
    const form = this.workoutForm.value;
    const workoutType = form.type || 'Workout';
    
    let text = `${workoutType}\n`;
    text += `Date: ${this.selectedDate}\n\n`;
    
    if (this.aiRecommendation) {
      text += `AI Recommendation: ${this.aiRecommendation}\n\n`;
    }
    
    if (this.isCardioWorkout()) {
      // Cardio workout
      const runTypeLabel = this.runTypes.find(rt => rt.value === form.runType)?.label || form.runType;
      text += `Type: ${runTypeLabel}\n`;
      
      // Speed/pace info
      if (form.targetSpeed) {
        text += `Speed: ${form.targetSpeed} mph\n`;
      }
      if (form.targetPace) {
        text += `Pace: ${form.targetPace}\n`;
      }
      
      if (form.targetType === 'pace') {
        text += `Duration: ${form.targetDuration} minutes\n`;
      } else if (form.targetType === 'distance') {
        const unit = form.distanceUnit || 'miles';
        text += `Target: ${form.targetValue} ${unit}\n`;
        const estimated = this.getEstimatedDuration();
        if (estimated) {
          text += `Estimated Duration: ~${estimated} minutes\n`;
        }
      } else {
        text += `Target: ${form.targetValue} minutes\n`;
      }
      
      if (form.cardioNotes) {
        text += `Notes: ${form.cardioNotes}\n`;
      }
    } else {
      // Strength workout
      const duration = form.targetDuration || 60;
      text += `Duration: ${duration} min\n\n`;
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
    }
    
    navigator.clipboard.writeText(text).then(() => {
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  getRunTypeLabel(value: string): string {
    return this.runTypes.find(rt => rt.value === value)?.label || value;
  }

  getDistanceLabel(): string {
    const unit = this.workoutForm.value.distanceUnit || 'miles';
    return unit === 'km' ? 'Kilometers' : 'Miles';
  }

  getDistanceUnit(): string {
    const unit = this.workoutForm.value.distanceUnit || 'miles';
    return unit === 'km' ? 'km' : 'mi';
  }

  getEstimatedDuration(): number | null {
    const form = this.workoutForm.value;
    if (form.targetType !== 'distance' || !form.targetValue || !form.targetPace) {
      return null;
    }

    const paceMatch = form.targetPace.match(/(\d+):(\d+)/);
    if (!paceMatch) return null;

    const paceInMinutes = parseInt(paceMatch[1]) + (parseInt(paceMatch[2]) / 60);
    const distance = parseFloat(form.targetValue);
    const unit = form.distanceUnit || 'miles';
    const distanceInMiles = unit === 'km' ? distance * 0.621371 : distance;
    
    return Math.round(distanceInMiles * paceInMinutes);
  }
}
