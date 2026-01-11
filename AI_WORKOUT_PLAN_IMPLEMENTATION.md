# AI-Powered Workout Plan Feature

## Overview
This feature allows users to generate AI-powered workout plans based on their current recovery status, training history, and goals. The AI agent analyzes recent workouts and progressively suggests the next training session while maintaining exercise consistency for tracking progress.

## Implementation Summary

### 1. Frontend Changes

#### Chat Service (`src/app/services/chat.service.ts`)
- Added `generateWorkoutPlan()` method to call the backend AI agent
- Accepts structured training data including:
  - Current day metrics (recovery, sleep, HRV, strain)
  - User profile (goals, experience, equipment)
  - Recent training history (last 7-14 days)
  - Current workout plan (if exists)

#### Workout Planner Component (`src/app/home/components/workout-planner/`)
- Added "AI Recommendation" button next to "Copy Last Workout"
- Added `generateAIRecommendation()` method to:
  - Build training data from health entries
  - Call the AI agent via chat service
  - Populate the workout form with AI suggestions
- Added `buildTrainingData()` helper to structure data for the AI agent
- Added loading state (`isGeneratingAI`) and error handling
- Updated UI with gradient purple button styling

### 2. Backend Changes

#### Lambda Handler (`amplify/functions/chat-agent/handler.ts`)
- Added `generate_workout_plan` action type
- Created `WorkoutPlanData` interface for typed data structure
- Implemented `buildWorkoutPlanPrompt()` to create AI prompt with:
  - Current recovery metrics
  - Recent training history with exercises
  - Progressive overload principles
  - Exercise consistency requirements
- Implemented `parseWorkoutPlanResponse()` to extract structured JSON from AI response

### 3. AI Agent Instructions

The AI agent follows these principles:
1. **Exercise Consistency**: Always uses the same exercises from recent history
2. **Progressive Overload**: Suggests incremental weight/reps/sets increases
3. **Recovery-Based**: Adjusts intensity based on recovery scores
4. **Training Split Balance**: Avoids training same muscles consecutively
5. **Performance Tracking**: References previous performance for each exercise

### 4. Data Flow

```
User clicks "AI Recommendation"
    ↓
Frontend builds training data
    ↓
Calls ChatService.generateWorkoutPlan()
    ↓
POST to Lambda with action: 'generate_workout_plan'
    ↓
Lambda builds prompt with training context
    ↓
Calls Amazon Nova Micro LLM
    ↓
Parses JSON response
    ↓
Returns structured workout plan
    ↓
Frontend populates workout form with exercises
```

### 5. Sample AI Response Format

```json
{
  "recommendation": "Good recovery today. Time to push on upper body push exercises with 5lb increases.",
  "workoutType": "Upper Body - Push",
  "targetDuration": 60,
  "estimatedIntensity": "hard",
  "exercises": [
    {
      "name": "Bench Press",
      "sets": 4,
      "reps": "8",
      "suggestedWeight": "230 lbs",
      "progression": "+5 lbs from last session",
      "previousPerformance": "4x8 @ 225 lbs",
      "notes": "Focus on controlled descent, explosive concentric"
    }
  ],
  "warmup": "5 min cardio, dynamic stretches, empty bar sets",
  "cooldown": "Chest and shoulder stretches, 5 min walk",
  "nutritionTip": "Consume 30-40g protein within 2 hours post-workout"
}
```

## Key Features

1. **Smart Progression**: AI analyzes previous workout performance to suggest appropriate weight/rep increases
2. **Recovery-Aware**: Adjusts workout intensity based on sleep and recovery scores
3. **Exercise Consistency**: Maintains same exercises for proper progress tracking
4. **Context-Aware**: Considers training history, goals, and available equipment
5. **Structured Output**: Returns consistent JSON format for easy parsing

## Usage

1. Open "Plan Workout" modal
2. Click "🤖 AI Recommendation" button
3. Wait for AI to analyze your data (2-5 seconds)
4. Review the generated workout plan
5. Adjust exercises if needed
6. Save the workout plan

## Future Enhancements

- User profile settings for goals and equipment
- Multi-week program generation
- Exercise substitution suggestions
- Video links for exercise demonstrations
- Integration with Whoop strain predictions
- Deload week detection and recommendations
