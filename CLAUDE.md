# CLAUDE.md — Jarvis Health & Wellness Dashboard

## Project Overview

Jarvis is a personal health and wellness dashboard built with **Angular 17** and **AWS Amplify Gen 2**. It integrates with **Whoop** for biometric data (recovery, strain, sleep, HRV) and uses **Amazon Bedrock** (Nova Micro model) for AI-powered insights, workout planning, and weekly analysis. The app tracks nutrition, training sessions, goals (hierarchical goal trees), and daily wellness scores.

## Tech Stack

- **Frontend**: Angular 17 (standalone components, no NgModules)
- **Backend**: AWS Amplify Gen 2 (auth, data/GraphQL, Lambda functions)
- **Database**: DynamoDB via Amplify Data (AppSync GraphQL)
- **AI**: Amazon Bedrock (Nova Micro) via Lambda function
- **Auth**: AWS Cognito (email-based login via Amplify Auth)
- **External API**: Whoop API v2 (OAuth2 with refresh tokens)
- **Language**: TypeScript 5.2 (strict mode enabled)
- **Testing**: Jasmine + Karma (no spec files currently exist)
- **Package Manager**: npm

## Quick Reference Commands

```bash
npm start          # ng serve — dev server at localhost:4200
npm run build      # ng build — production build to dist/jarvis
npm test           # ng test — run Karma/Jasmine tests
npm run watch      # ng build --watch (development config)
npx ampx sandbox   # Deploy Amplify backend locally (generates amplify_outputs.json)
```

## Project Structure

```
centurify-jarvis/
├── amplify/                        # AWS Amplify Gen 2 backend
│   ├── backend.ts                  # Backend definition (auth, data, functions, IAM)
│   ├── auth/resource.ts            # Cognito auth config (email login)
│   ├── data/resource.ts            # DynamoDB schema (all models defined here)
│   └── functions/
│       ├── chat-agent/             # AI Lambda (Bedrock Nova Micro)
│       │   ├── resource.ts         # Lambda definition
│       │   └── handler.ts          # AI logic: insights, workout plans, chat, weekly analysis
│       └── whoop-auth/             # Whoop OAuth Lambda
│           ├── resource.ts         # Lambda definition
│           └── handler.ts          # Token exchange, refresh, API proxy
├── src/
│   ├── main.ts                     # Bootstrap + Amplify.configure()
│   ├── index.html
│   ├── styles.css                  # Global styles (minimal reset + Amplify theme)
│   └── app/
│       ├── app.component.ts        # Root component with Amplify Authenticator
│       ├── app.routes.ts           # Route definitions (all eager-loaded)
│       ├── models/
│       │   ├── goal.models.ts      # Goal types, interfaces, display configs
│       │   └── health.models.ts    # Health, workout, training, nutrition interfaces
│       ├── services/
│       │   ├── health-data.service.ts    # CRUD for HealthEntry (daily biometrics)
│       │   ├── food-entry.service.ts     # CRUD for FoodEntry (daily food tracking)
│       │   ├── food.service.ts           # CRUD for Food library
│       │   ├── workout.service.ts        # CRUD for Workout library
│       │   ├── goal.service.ts           # CRUD for Goal tree + recurring goals
│       │   ├── recurring-goal.service.ts # RecurringGoalCompletion tracking
│       │   ├── training-session.service.ts # TrainingSession history
│       │   ├── weekly-insights.service.ts  # WeeklyInsight storage
│       │   ├── whoop.service.ts          # Whoop OAuth + API calls via Lambda proxy
│       │   └── chat.service.ts           # AI service (daily/weekly insights, workout plans, chat)
│       ├── utils/
│       │   ├── date-utils.ts
│       │   └── workout-utils.ts
│       ├── home/                   # Main dashboard (default route)
│       │   ├── home.component.ts   # Central orchestrator component
│       │   └── components/
│       │       ├── dashboard/      # Health metrics cards (Whoop data)
│       │       ├── action-list/    # Daily action items
│       │       ├── nutrition-panel/    # Food tracking + meal planning
│       │       ├── training-panel/     # Workout display + exercise editing
│       │       ├── workout-planner/    # AI workout plan generation
│       │       ├── chat-panel/         # AI chat interface
│       │       ├── insights-panel/     # AI daily insights display
│       │       ├── food-detail-panel/  # Food entry editing
│       │       ├── exercise-editor/    # Exercise editing in workouts
│       │       ├── goal-detail-panel/  # Goal info display
│       │       ├── goal-priority-panel/ # Goal prioritization
│       │       └── weight-trend-modal/ # Weight history visualization
│       ├── goals/                  # Hierarchical goal tree page
│       │   └── components/
│       │       ├── goal-modal/     # Create/edit goals
│       │       └── goal-tree-node/ # Recursive tree renderer
│       ├── nutrition/              # Nutrition library page
│       ├── training/               # Workout library page
│       ├── training-history/       # Past training sessions
│       ├── insights/               # Weekly insights page
│       ├── integrations/           # Whoop connection management
│       ├── whoop-callback/         # OAuth callback handler
│       └── privacy-policy/         # Static privacy policy page
├── package.json
├── angular.json
├── tsconfig.json                   # Strict TS, ES2022 target
└── tsconfig.app.json
```

## Data Models (DynamoDB via Amplify)

All models are defined in `amplify/data/resource.ts` with owner-based authorization:

| Model | Purpose |
|-------|---------|
| `HealthEntry` | Daily biometrics (BP, weight, muscle mass, Whoop data, nutrition totals, workout plans, AI insights) |
| `FoodEntry` | Individual food items eaten per day (with meal type, portions) |
| `Food` | Reusable food library templates |
| `Workout` | Reusable workout library templates |
| `Goal` | Hierarchical goal tree (life_purpose → life_goal → yearly → quarterly → monthly → ad_hoc) |
| `RecurringGoalCompletion` | Daily completion tracking for recurring goals |
| `TrainingSession` | Completed workout history (from Whoop or manual entry) |
| `WeeklyInsight` | AI-generated weekly analysis reports |

## Architecture Patterns

### Standalone Components
All components use Angular 17 standalone pattern — no NgModules. Components import their dependencies directly via the `imports` array in `@Component`.

### Service Layer
Services use `generateClient<Schema>()` from `aws-amplify/data` for typed DynamoDB access. All services are `providedIn: 'root'` singletons.

### AI Integration
The `chat-agent` Lambda handles multiple actions via a single endpoint:
- `analyze_day` / `analyze_week` / `analyze_month` — health analysis
- `generate_insights` — structured daily wellness score with breakdown
- `generate_workout_plan` — AI workout planning based on recovery + history
- `generate_weekly_insights` — weekly summary with trends
- `chat` — general conversational AI

The Lambda URLs are read from `amplify_outputs.json` (generated by `npx ampx sandbox`).

### Whoop Integration
OAuth2 flow: Frontend redirects to Whoop → callback route captures code → Lambda exchanges for tokens. Tokens stored in `localStorage` with automatic refresh. API calls proxied through Lambda to avoid CORS.

### JSON-in-String Fields
Several DynamoDB string fields store serialized JSON: `plannedWorkout`, `morningChecklist`, `exercises`, `milestones`, `metadata`, `actionOrder`, `insights`. Services parse/stringify these automatically.

## Key Conventions

### Component Structure
Each component follows the pattern:
```
component-name/
├── component-name.component.ts    # Logic + @Component decorator
├── component-name.component.html  # Template
└── component-name.component.css   # Scoped styles
```

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature` enforced
- ES2022 target with `experimentalDecorators`
- Interfaces and types defined in `src/app/models/`

### Routing
All routes are eagerly loaded (no lazy loading). Routes defined in `src/app/app.routes.ts`. The default route (`/`) maps to `HomeComponent`.

### Styling
- Component-scoped CSS (no shared stylesheet beyond `styles.css`)
- Dark theme with gradient backgrounds (common pattern across components)
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`

### Authentication
The root `AppComponent` wraps content in `<amplify-authenticator>` for protected routes. Public routes (e.g., `/privacy`) bypass the authenticator.

## Development Notes

- **No test files currently exist** — spec files are not present in the codebase
- **No ESLint/Prettier config** — no linting tools are configured
- **No CI/CD pipeline** — no `.github/workflows` or similar
- **No Docker** — no containerization configured
- The `amplify_outputs.json` file is gitignored and must be generated via `npx ampx sandbox`
- The component prefix is `app` (configured in `angular.json`)
- Production build has budget limits: 500kb warning / 1mb error for initial bundle, 2kb/4kb for component styles

## Important File Locations

- **Backend schema**: `amplify/data/resource.ts` — all DynamoDB models
- **AI prompts**: `amplify/functions/chat-agent/handler.ts` — all Bedrock prompts and response parsing
- **Whoop integration**: `amplify/functions/whoop-auth/handler.ts` + `src/app/services/whoop.service.ts`
- **Type definitions**: `src/app/models/goal.models.ts` and `src/app/models/health.models.ts`
- **Main dashboard logic**: `src/app/home/home.component.ts` — the central orchestrator
- **Routes**: `src/app/app.routes.ts`
