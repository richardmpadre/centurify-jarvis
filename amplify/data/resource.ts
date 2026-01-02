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
  }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

