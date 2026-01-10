import { defineFunction } from '@aws-amplify/backend';

export const chatAgent = defineFunction({
  name: 'chat-agent',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256
});

