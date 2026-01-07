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
  dailyScore?: number | null;
  plannedWorkout?: string | null;
  workoutCompleted?: boolean | null;
  trainingNotes?: string | null;
  morningChecklist?: string | null;
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

