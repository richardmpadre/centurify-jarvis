import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
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
    // Planned workout - JSON string with structure: { type, exercises: [{name, sets, reps, weight, notes}], targetDuration }
    plannedWorkout: a.string(),
    // Track if planned workout was completed
    workoutCompleted: a.boolean(),
  }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

