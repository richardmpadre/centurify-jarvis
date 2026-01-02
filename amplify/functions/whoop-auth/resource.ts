import { defineFunction } from '@aws-amplify/backend';

export const whoopAuth = defineFunction({
  name: 'whoop-auth',
  entry: './handler.ts'
});

