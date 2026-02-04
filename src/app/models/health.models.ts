// Health Entry stored in database
export interface HealthEntry {
  id: string;
  date: string;
  bp?: string | null;
  temp?: number | null;
  strain?: number | null;
  rhr?: number | null;
  sleep?: number | null;
  recovery?: number | null;
  weight?: number | null;
  muscleMass?: number | null;
  plannedWorkout?: string | null;
  workoutCompleted?: boolean | null;
  trainingNotes?: string | null;
  morningChecklist?: string | null;
  // Aggregate nutrition totals (individual foods in FoodEntry table)
  totalCalories?: number | null;
  totalProtein?: number | null;
  totalCarbs?: number | null;
  totalFats?: number | null;
  nutritionTrackingFailed?: boolean | null; // Mark days where nutrition tracking was not done
  // User preferences
  actionOrder?: string | null; // JSON array of action IDs
  // AI-generated insights
  dailyInsights?: string | null;
  insightsGeneratedAt?: string | null;
}

// Legacy PlannedFood interface (kept for backward compatibility)
export interface PlannedFood {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

// Daily nutrition summary
export interface DailyNutrition {
  totalCalories: number;
  totalProtein: number;
  totalFats: number;
  totalCarbs: number;
}

// Exercise within a workout plan
export interface PlannedExercise {
  name: string;
  sets: number;
  reps: string;
  weight: string;
  notes: string;
}

// Cardio workout plan details
export interface CardioWorkoutPlan {
  runType: string; // 'zone2', 'tempo', 'intervals', 'long_run', 'recovery', 'fartlek'
  targetType: 'time' | 'distance' | 'pace';
  targetValue: number; // minutes or miles/km (not used for pace target)
  distanceUnit?: 'miles' | 'km'; // unit for distance-based targets
  targetPace?: string; // e.g., "9:00/mi" - required for pace target type
  targetSpeed?: number; // Speed in mph (for treadmill)
  notes?: string;
}

// Contrast therapy workout plan details
export interface ContrastTherapyPlan {
  hotTemp: number; // Temperature in Fahrenheit
  hotDuration: number; // Duration in minutes
  coldTemp: number; // Temperature in Fahrenheit
  coldDuration: number; // Duration in minutes
  rounds: number; // Number of hot/cold cycles
  notes?: string;
}

// Planned workout for a day
export interface PlannedWorkout {
  type: string;
  targetDuration: number;
  exercises: PlannedExercise[];
  // Cardio-specific fields
  cardio?: CardioWorkoutPlan;
  // Contrast therapy-specific fields
  contrastTherapy?: ContrastTherapyPlan;
}

// Morning checklist item definition
export interface MorningChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

// Daily checklist state
export interface DailyChecklist {
  biometricsLoaded: boolean;
  workoutPlanned: boolean;
  nutritionPlanned: boolean;
  lifeEventsOrganized: boolean;
  jarvisIterated: boolean;
}

// Whoop workout display data
export interface WhoopWorkout {
  sport: string;
  strain: number;
  duration: number;
  calories: number;
  avgHR: number;
  maxHR: number;
  startTime: string;
  distance?: number; // Distance in miles (for running activities)
}

// Training session types
export type TrainingType = 'strength' | 'cardio' | 'flexibility' | 'sports' | 'hiit' | 'sauna' | 'contrast_therapy' | 'other';
export type TrainingSource = 'whoop' | 'manual';

// Completed exercise in a training session
export interface CompletedExercise {
  name: string;
  sets?: number;
  reps?: string;
  weight?: number;
  notes?: string;
}

// Training session - completed workout history
export interface TrainingSession {
  id: string;
  date: string;
  startTime?: string | null;
  type: TrainingType;
  name?: string | null;
  duration?: number | null; // minutes
  calories?: number | null;
  strain?: number | null; // Whoop strain score
  avgHR?: number | null;
  maxHR?: number | null;
  distance?: number | null; // For cardio (miles)
  exercises?: CompletedExercise[];
  notes?: string | null;
  source: TrainingSource;
  whoopWorkoutId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

