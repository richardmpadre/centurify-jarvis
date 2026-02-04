import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  // Daily health data with aggregate nutrition
  HealthEntry: a.model({
    date: a.date().required(),
    bp: a.string(),
    temp: a.float(),
    strain: a.float(),
    rhr: a.float(),
    sleep: a.float(),
    recovery: a.float(),
    weight: a.float(),
    muscleMass: a.float(),
    workoutCount: a.integer(),
    workoutCalories: a.float(),
    workoutMinutes: a.float(),
    trainingNotes: a.string(),
    // Planned workout - JSON string
    plannedWorkout: a.string(),
    workoutCompleted: a.boolean(),
    // Morning checklist status - JSON string
    morningChecklist: a.string(),
    // Aggregate nutrition totals for the day
    totalCalories: a.integer(),
    totalProtein: a.integer(),
    totalCarbs: a.integer(),
    totalFats: a.integer(),
    nutritionTrackingFailed: a.boolean(), // Mark days where nutrition tracking was not done
    // Action order preference
    actionOrder: a.string(), // JSON array of action IDs
    // AI-generated daily insights
    dailyInsights: a.string(), // AI analysis of the day
    insightsGeneratedAt: a.datetime(), // When insights were generated
  }).authorization(allow => [allow.owner()]),
  
  // Individual foods eaten (daily food entries)
  FoodEntry: a.model({
    date: a.date().required(),
    mealType: a.string().required(), // breakfast, lunch, dinner, snack
    name: a.string().required(),
    calories: a.integer().required(),
    protein: a.float(),
    carbs: a.float(),
    fats: a.float(),
    completed: a.boolean(), // Has the user eaten this food?
    foodId: a.string(), // Optional link to Food library
    portion: a.float(), // Portion size multiplier (e.g., 1.0 = 1 serving)
  }).authorization(allow => [allow.owner()]),
  
  // Food library - saved food templates for reuse
  Food: a.model({
    name: a.string().required(),
    calories: a.integer().required(),
    protein: a.float(),
    carbs: a.float(),
    fats: a.float(),
    defaultPortion: a.float(), // Default portion size (e.g., 1, 0.5, 2)
    defaultPortionUnit: a.string(), // Unit for portion (e.g., "serving", "oz", "cup", "piece")
  }).authorization(allow => [allow.owner()]),
  
  // Workout library - saved workout templates for reuse
  Workout: a.model({
    name: a.string().required(),
    description: a.string(),
    duration: a.integer(), // minutes
    exercises: a.string(), // JSON array of exercise objects
    category: a.string(), // strength, cardio, flexibility, sports, etc.
    difficulty: a.string(), // beginner, intermediate, advanced
    estimatedCalories: a.integer(),
  }).authorization(allow => [allow.owner()]),
  
  // Weekly insights - AI-generated weekly analysis
  WeeklyInsight: a.model({
    year: a.integer().required(),
    weekNumber: a.integer().required(),
    startDate: a.date().required(),
    endDate: a.date().required(),
    summary: a.string(),
    weeklyScore: a.integer(),
    trend: a.string(), // improving, stable, declining
    insights: a.string(), // Full JSON of all insights data
    generatedAt: a.datetime(),
  }).authorization(allow => [allow.owner()]),
  
  // Goals - hierarchical goal tree structure
  Goal: a.model({
    title: a.string().required(),
    description: a.string(),
    goalType: a.string().required(), // 'life_purpose', 'life_goal', 'yearly', 'quarterly', 'monthly', 'ad_hoc'
    parentGoalId: a.string(), // null for Life Purpose, points to parent for others
    status: a.string(), // 'not_started', 'in_progress', 'completed', 'paused', 'abandoned'
    progress: a.integer(), // 0-100
    startDate: a.date(),
    targetDate: a.date(),
    completedDate: a.date(),
    sortOrder: a.integer(), // for custom sorting among siblings
    milestones: a.string(), // JSON array of milestone objects
    notes: a.string(),
    requiresDailyAction: a.boolean(), // For yearly goals - generates daily action prompt
    // Recurring goal fields
    isRecurring: a.boolean(), // Whether this is a recurring goal
    recurrenceType: a.string(), // 'daily' (more types can be added later)
    goalCategory: a.string(), // 'nutrition', 'training', 'general' - determines which panel to use
    metadata: a.string(), // JSON for category-specific data (e.g., { targetCalories: 1450, targetProtein: 120 })
  }).authorization(allow => [allow.owner()]),
  
  // Track daily completion of recurring goals
  RecurringGoalCompletion: a.model({
    goalId: a.string().required(), // Reference to the recurring goal
    date: a.date().required(), // The date this completion is for
    completed: a.boolean().required(), // Whether the goal was completed on this day
    notes: a.string(), // Optional notes about completion
  }).authorization(allow => [allow.owner()]),
  
  // Training session history - completed workouts
  TrainingSession: a.model({
    date: a.date().required(),
    startTime: a.datetime(),
    type: a.string().required(), // 'strength', 'cardio', 'flexibility', 'sports', 'hiit', 'other'
    name: a.string(),
    duration: a.integer(), // minutes
    calories: a.integer(),
    strain: a.float(), // Whoop strain score
    avgHR: a.integer(),
    maxHR: a.integer(),
    distance: a.float(), // For cardio (miles)
    exercises: a.string(), // JSON array of completed exercises
    notes: a.string(),
    source: a.string(), // 'whoop' or 'manual'
    whoopWorkoutId: a.string(), // Link to Whoop if synced
  }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

