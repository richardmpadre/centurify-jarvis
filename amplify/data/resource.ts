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
  
  // Individual meals eaten (daily meal entries)
  MealEntry: a.model({
    date: a.date().required(),
    mealType: a.string().required(), // breakfast, lunch, dinner, snack
    name: a.string().required(),
    calories: a.integer().required(),
    protein: a.float(),
    carbs: a.float(),
    fats: a.float(),
    completed: a.boolean(), // Has the user eaten this meal?
    mealId: a.string(), // Optional link to Meal library
    portion: a.float(), // Portion size multiplier (e.g., 1.0 = 1 serving)
  }).authorization(allow => [allow.owner()]),
  
  // Meal library - saved meal templates for reuse
  Meal: a.model({
    name: a.string().required(),
    calories: a.integer().required(),
    protein: a.float(),
    carbs: a.float(),
    fats: a.float(),
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
  }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

