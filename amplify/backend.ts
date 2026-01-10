import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { whoopAuth } from './functions/whoop-auth/resource';
import { chatAgent } from './functions/chat-agent/resource';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  whoopAuth,
  chatAgent,
});

// Add Function URL to the Whoop Lambda
const whoopLambda = backend.whoopAuth.resources.lambda as lambda.Function;

const whoopFnUrl = whoopLambda.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [lambda.HttpMethod.POST],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
});

// Add Function URL to the Chat Agent Lambda
const chatLambda = backend.chatAgent.resources.lambda as lambda.Function;

// Grant Bedrock permissions to chat Lambda
chatLambda.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'bedrock:InvokeModel',
    'bedrock:InvokeModelWithResponseStream'
  ],
  resources: ['arn:aws:bedrock:*::foundation-model/*']
}));

const chatFnUrl = chatLambda.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [lambda.HttpMethod.POST],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
});

// Output the Function URLs
backend.addOutput({
  custom: {
    whoopAuthApiUrl: whoopFnUrl.url,
    chatAgentApiUrl: chatFnUrl.url
  }
});

