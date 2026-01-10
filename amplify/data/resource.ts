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
    dailyScore: a.float(),
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
    // Action order preference
    actionOrder: a.string(), // JSON array of action IDs
  }).authorization(allow => [allow.owner()]),
  
  // Individual meals eaten (daily meal entries)
  MealEntry: a.model({
    date: a.date().required(),
    mealType: a.string().required(), // breakfast, lunch, dinner, snack
    name: a.string().required(),
    calories: a.integer().required(),
    protein: a.integer(),
    carbs: a.integer(),
    fats: a.integer(),
    completed: a.boolean(), // Has the user eaten this meal?
    mealId: a.string(), // Optional link to Meal library
  }).authorization(allow => [allow.owner()]),
  
  // Meal library - saved meal templates for reuse
  Meal: a.model({
    name: a.string().required(),
    calories: a.integer().required(),
    protein: a.integer(),
    carbs: a.integer(),
    fats: a.integer(),
  }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

