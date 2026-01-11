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
  plannedWorkout?: string | null;
  workoutCompleted?: boolean | null;
  trainingNotes?: string | null;
  morningChecklist?: string | null;
  // Aggregate nutrition totals (individual meals in MealEntry table)
  totalCalories?: number | null;
  totalProtein?: number | null;
  totalCarbs?: number | null;
  totalFats?: number | null;
  // User preferences
  actionOrder?: string | null; // JSON array of action IDs
  // AI-generated insights
  dailyInsights?: string | null;
  insightsGeneratedAt?: string | null;
}

// Legacy PlannedMeal interface (kept for backward compatibility)
export interface PlannedMeal {
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

// Planned workout for a day
export interface PlannedWorkout {
  type: string;
  targetDuration: number;
  exercises: PlannedExercise[];
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
}

