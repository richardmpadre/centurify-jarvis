import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { whoopAuth } from './functions/whoop-auth/resource';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const backend = defineBackend({
  auth,
  data,
  whoopAuth,
});

// Add Function URL to the Lambda for direct HTTPS access
const whoopLambda = backend.whoopAuth.resources.lambda as lambda.Function;

const fnUrl = whoopLambda.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [lambda.HttpMethod.POST],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
});

// Output the Function URL
backend.addOutput({
  custom: {
    whoopAuthApiUrl: fnUrl.url
  }
});

