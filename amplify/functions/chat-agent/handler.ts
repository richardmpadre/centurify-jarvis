import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

interface HealthData {
  date: string;
  recovery?: number;
  strain?: number;
  sleep?: number;
  rhr?: number;
  weight?: number;
  plannedWorkout?: any;
  workoutCompleted?: boolean;
}

interface NutritionData {
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFats?: number;
  mealsCompleted?: number;
  mealsPlanned?: number;
}

interface InsightsData extends HealthData {
  workouts?: any[];
  nutrition?: NutritionData;
  checklistStats?: {
    completed: number;
    total: number;
  };
}

interface ChatRequest {
  action: 'analyze_day' | 'analyze_week' | 'analyze_month' | 'chat' | 'generate_insights' | 'generate_workout_plan';
  message?: string;
  prompt?: string; // Alternative to message
  data?: HealthData | InsightsData | WorkoutPlanData; // Single day data
  healthData?: HealthData[]; // Multiple days data
  history?: { role: string; content: string }[];
  currentDate?: string;
}

interface WorkoutPlanData {
  currentDay: {
    date: string;
    recovery?: number | null;
    sleep?: number | null;
    rhr?: number | null;
    strain?: number | null;
    weight?: number | null;
    targetDuration?: number;
    workoutType?: string;
    nutritionPlan?: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    };
  };
  userProfile?: {
    trainingGoal?: string;
    experienceLevel?: string;
    preferredDuration?: number;
    availableEquipment?: string[];
    availableWeights?: number[];
  };
  workoutType?: string;
  sameTypeHistory?: Array<{
    date: string;
    type: string;
    duration?: number;
    strain?: number | null;
    recovery?: number | null;
    exercises?: Array<{
      name: string;
      sets: number;
      reps: string;
      weight: string;
    }>;
  }>;
}

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, body: '' };
  }

  try {
    const body: ChatRequest = JSON.parse(event.body || '{}');
    const { action, message, prompt: userPrompt, data, healthData, currentDate, history } = body;

    let prompt = '';
    
    switch (action) {
      case 'analyze_day':
        // Support both 'data' (single) and 'healthData[0]' formats
        const dayData = (data as HealthData) || healthData?.[0];
        prompt = buildDailyAnalysisPrompt(dayData, currentDate || dayData?.date);
        break;
      case 'analyze_week':
        prompt = buildWeeklyAnalysisPrompt(healthData || []);
        break;
      case 'analyze_month':
        prompt = buildMonthlyAnalysisPrompt(healthData || []);
        break;
      case 'chat':
        const chatMessage = userPrompt || message || '';
        prompt = buildChatPrompt(chatMessage, healthData || [], history);
        break;
      case 'generate_insights':
        const insightsData = data as InsightsData;
        prompt = buildDailyInsightsPrompt(insightsData);
        break;
      case 'generate_workout_plan':
        const workoutPlanData = data as WorkoutPlanData;
        prompt = buildWorkoutPlanPrompt(workoutPlanData);
        break;
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

    const response = await callLLM(prompt);
    
    // For generate_insights, parse the structured response
    if (action === 'generate_insights') {
      const parsed = parseInsightsResponse(response);
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...parsed,
          raw_text: response,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // For generate_workout_plan, parse the structured response
    if (action === 'generate_workout_plan') {
      const parsed = parseWorkoutPlanResponse(response);
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...parsed,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        response,
        action,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error: any) {
    console.error('Chat agent error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to process request',
        details: error.message 
      })
    };
  }
};

async function callLLM(prompt: string): Promise<string> {
  // Using Amazon Nova Micro - fast, cheap, no approval required
  const modelId = 'amazon.nova-micro-v1:0';
  
  const systemPrompt = `You are a helpful health and fitness coach assistant named Jarvis. 
You analyze health metrics from Whoop (recovery, strain, sleep, HRV, resting heart rate) and workout data.
Keep responses concise, actionable, and encouraging. Use bullet points for clarity.
Focus on patterns, improvements, and areas needing attention.`;

  const requestBody = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }]
      }
    ],
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.7,
      topP: 0.9
    }
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody)
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.output.message.content[0].text;
}

function buildDailyAnalysisPrompt(data: HealthData | undefined, date?: string): string {
  if (!data) {
    return `No health data available for ${date || 'today'}. Suggest what metrics to track.`;
  }

  return `Analyze my health data for ${data.date}:

**Metrics:**
- Recovery: ${data.recovery ?? 'Not recorded'}%
- Strain: ${data.strain ?? 'Not recorded'}
- Sleep Performance: ${data.sleep ?? 'Not recorded'}%
- Resting Heart Rate: ${data.rhr ?? 'Not recorded'} bpm
- Weight: ${data.weight ?? 'Not recorded'} lbs

**Workout:**
- Planned: ${data.plannedWorkout ? 'Yes' : 'No'}
- Completed: ${data.workoutCompleted ? 'Yes' : 'No'}
${data.plannedWorkout ? `- Details: ${JSON.stringify(data.plannedWorkout)}` : ''}

Provide:
1. Quick assessment (1-2 sentences)
2. Key highlights (what went well)
3. Areas to focus on
4. Recommendation for tomorrow`;
}

function buildWeeklyAnalysisPrompt(data: HealthData[]): string {
  if (data.length === 0) {
    return 'No health data available for this week. Suggest how to start tracking.';
  }

  const summary = data.map(d => 
    `${d.date}: Recovery ${d.recovery ?? '-'}%, Strain ${d.strain ?? '-'}, Sleep ${d.sleep ?? '-'}%, Workout: ${d.workoutCompleted ? '✓' : '✗'}`
  ).join('\n');

  const avgRecovery = average(data.map(d => d.recovery));
  const avgStrain = average(data.map(d => d.strain));
  const avgSleep = average(data.map(d => d.sleep));
  const workoutsCompleted = data.filter(d => d.workoutCompleted).length;

  return `Analyze my weekly health data:

**Daily Breakdown:**
${summary}

**Week Averages:**
- Avg Recovery: ${avgRecovery?.toFixed(1) ?? 'N/A'}%
- Avg Strain: ${avgStrain?.toFixed(1) ?? 'N/A'}
- Avg Sleep: ${avgSleep?.toFixed(1) ?? 'N/A'}%
- Workouts Completed: ${workoutsCompleted}/${data.length}

Provide:
1. Week summary (2-3 sentences)
2. Trends observed (improving/declining)
3. Best day and why
4. Main achievement
5. Focus area for next week`;
}

function buildMonthlyAnalysisPrompt(data: HealthData[]): string {
  if (data.length === 0) {
    return 'No health data available for this month.';
  }

  const avgRecovery = average(data.map(d => d.recovery));
  const avgStrain = average(data.map(d => d.strain));
  const avgSleep = average(data.map(d => d.sleep));
  const workoutsCompleted = data.filter(d => d.workoutCompleted).length;
  
  // Group by week
  const weeks = groupByWeek(data);

  return `Analyze my monthly health data (${data.length} days):

**Monthly Averages:**
- Avg Recovery: ${avgRecovery?.toFixed(1) ?? 'N/A'}%
- Avg Strain: ${avgStrain?.toFixed(1) ?? 'N/A'}
- Avg Sleep: ${avgSleep?.toFixed(1) ?? 'N/A'}%
- Total Workouts: ${workoutsCompleted}

**Weekly Breakdown:**
${Object.entries(weeks).map(([week, entries]) => {
  const weekAvgRecovery = average(entries.map(d => d.recovery));
  return `Week ${week}: ${entries.length} days, Avg Recovery ${weekAvgRecovery?.toFixed(0) ?? '-'}%`;
}).join('\n')}

Provide:
1. Month summary
2. Key achievements (list top 3)
3. Progress vs previous trends
4. Areas of improvement
5. Goals suggestion for next month`;
}

function buildChatPrompt(
  message: string, 
  context: HealthData[], 
  history?: { role: string; content: string }[]
): string {
  const recentData = context.slice(0, 7); // Last 7 days for context
  
  let contextStr = '';
  if (recentData.length > 0) {
    contextStr = `\n\nRecent health data for context:\n${recentData.map(d => 
      `${d.date}: Recovery ${d.recovery ?? '-'}%, Strain ${d.strain ?? '-'}, Sleep ${d.sleep ?? '-'}%`
    ).join('\n')}`;
  }

  let historyStr = '';
  if (history && history.length > 0) {
    historyStr = '\n\nConversation history:\n' + history.map(h => 
      `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`
    ).join('\n');
  }

  return `${historyStr}${contextStr}

User question: ${message}

Respond helpfully based on their health data context and conversation history.`;
}

function average(nums: (number | undefined | null)[]): number | null {
  const valid = nums.filter((n): n is number => n != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function groupByWeek(data: HealthData[]): { [week: string]: HealthData[] } {
  const weeks: { [week: string]: HealthData[] } = {};
  data.forEach(d => {
    const date = new Date(d.date);
    const weekNum = Math.ceil(date.getDate() / 7);
    const key = `${weekNum}`;
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(d);
  });
  return weeks;
}

function buildDailyInsightsPrompt(data: InsightsData | undefined): string {
  if (!data) {
    return `Generate generic end-of-day wellness tips for someone who hasn't tracked their health data yet.`;
  }

  const workoutDetails = data.workouts && data.workouts.length > 0 
    ? data.workouts.map(w => `  - ${w.sport || w.type}: ${w.duration || '-'} min, ${w.calories || '-'} cal, Strain: ${w.strain || '-'}`).join('\n')
    : '  - No workouts recorded';

  const nutritionDetails = data.nutrition 
    ? `  - Calories: ${data.nutrition.totalCalories ?? 0} (${data.nutrition.mealsCompleted ?? 0}/${data.nutrition.mealsPlanned ?? 0} meals completed)
  - Protein: ${data.nutrition.totalProtein ?? 0}g
  - Carbs: ${data.nutrition.totalCarbs ?? 0}g
  - Fats: ${data.nutrition.totalFats ?? 0}g`
    : '  - Nutrition not tracked';

  const checklistInfo = data.checklistStats
    ? `  - Tasks completed: ${data.checklistStats.completed}/${data.checklistStats.total}`
    : '  - Checklist not available';

  return `You are Jarvis, a personal health and wellness AI coach. Generate comprehensive daily insights for ${data.date}.

**Biometrics (from Whoop):**
- Recovery Score: ${data.recovery ?? 'Not recorded'}%
- Sleep Performance: ${data.sleep ?? 'Not recorded'}%
- Strain: ${data.strain ?? 'Not recorded'}
- Resting Heart Rate: ${data.rhr ?? 'Not recorded'} bpm

**Workouts:**
${workoutDetails}
- Planned workout completed: ${data.workoutCompleted ? 'Yes ✓' : 'No ✗'}

**Nutrition:**
${nutritionDetails}

**Daily Progress:**
${checklistInfo}

Generate a comprehensive end-of-day analysis in the following EXACT JSON format (respond ONLY with valid JSON, no markdown):
{
  "summary": "2-3 sentence overall summary of the day",
  "achievements": ["achievement 1", "achievement 2", "achievement 3"],
  "areas_for_improvement": ["area 1", "area 2"],
  "recommendations": ["recommendation 1 for tomorrow", "recommendation 2 for tomorrow"],
  "wellness_score": 65,
  "score_breakdown": {
    "base": 50,
    "recovery": { "value": "${data.recovery ?? 'N/A'}", "points": 5, "reason": "Recovery 40-59% → +5 points" },
    "sleep": { "value": "${data.sleep ?? 'N/A'}", "points": 10, "reason": "Sleep 60-79% → +10 points" },
    "workout": { "value": "Not completed", "points": 0, "reason": "No workout recorded" },
    "nutrition": { "value": "0/0 meals", "points": 0, "reason": "No nutrition plan" },
    "tasks": { "value": "0/0 tasks", "points": 0, "reason": "No tasks tracked" },
    "total": 65
  }
}

**CRITICAL: CALCULATE WELLNESS SCORE WITH BREAKDOWN**

Start with base of 50, then calculate each category:

**Recovery (max +25, min -10):**
- 80%+ → +25 | 60-79% → +15 | 40-59% → +5 | <40% → -10 | No data → +0

**Sleep (max +20, min -10):**
- 80%+ → +20 | 60-79% → +10 | 40-59% → +0 | <40% → -10 | No data → +0

**Workout (max +15, min -5):**
- Completed planned → +15 | Unplanned workout → +10 | Planned but skipped → -5 | Rest day → +0

**Nutrition (max +15, min -5):**
- 100% meals → +15 | 75%+ → +10 | 50-74% → +5 | <50% → -5 | No plan → +0

**Tasks (max +10, min 0):**
- 100% → +10 | 75%+ → +5 | <75% → +0

**IMPORTANT:** 
- Use ACTUAL values from the data above (Recovery: ${data.recovery ?? 'N/A'}%, Sleep: ${data.sleep ?? 'N/A'}%)
- Show the exact calculation in score_breakdown
- Cap final score between 0-100
- achievements should highlight what went well (3-5 items)
- areas_for_improvement should be constructive (2-3 items)
- recommendations should be actionable for tomorrow`;
}

interface ScoreCategory {
  value: string;
  points: number;
  reason: string;
}

interface ScoreBreakdown {
  base: number;
  recovery: ScoreCategory;
  sleep: ScoreCategory;
  workout: ScoreCategory;
  nutrition: ScoreCategory;
  tasks: ScoreCategory;
  total: number;
}

function parseInsightsResponse(response: string): {
  summary: string;
  achievements: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  wellness_score: number;
  score_breakdown?: ScoreBreakdown;
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Day analysis complete.',
        achievements: parsed.achievements || [],
        areas_for_improvement: parsed.areas_for_improvement || [],
        recommendations: parsed.recommendations || [],
        wellness_score: parsed.wellness_score ?? 50,
        score_breakdown: parsed.score_breakdown || undefined
      };
    }
  } catch (e) {
    console.error('Failed to parse insights JSON:', e);
  }

  // Fallback: return the raw text as summary
  return {
    summary: response.substring(0, 500),
    achievements: [],
    areas_for_improvement: [],
    recommendations: [],
    wellness_score: 50
  };
}

function buildWorkoutPlanPrompt(data: WorkoutPlanData | undefined): string {
  if (!data) {
    return 'Generate a basic strength training workout plan.';
  }

  const { currentDay, userProfile, sameTypeHistory, workoutType } = data;
  
  // Safety checks for undefined data
  if (!currentDay) {
    return 'Generate a basic strength training workout plan.';
  }
  
  const targetDuration = currentDay.targetDuration || 40;
  const workoutTypeName = workoutType || currentDay.workoutType || 'Strength Training';
  const history = sameTypeHistory || [];

  // Format the last 3 same-type workouts with detailed exercise info
  let historyStr = 'No previous workouts of this type found.';
  
  if (history.length > 0) {
    historyStr = history.map((workout: any, index: number) => {
      const label = index === 0 ? 'MOST RECENT' : index === 1 ? '2ND MOST RECENT' : '3RD MOST RECENT';
      const exercisesStr = workout.exercises?.map((e: any) => 
        `    - ${e.name}: ${e.sets} sets × ${e.reps} reps @ ${e.weight}`
      ).join('\n') || '    No exercises recorded';
      
      return `[${label}] ${workout.date} (Recovery: ${workout.recovery ?? 'N/A'}%, Strain: ${workout.strain ?? 'N/A'})
${exercisesStr}`;
    }).join('\n\n');
  }

  // Get exercises from the most recent workout for reference
  const mostRecentExercises = history[0]?.exercises || [];
  const exerciseCount = mostRecentExercises.length || 6; // Default to 6 if no history

  return `You are an expert strength and conditioning coach AI. Generate a personalized ${workoutTypeName} workout plan for TODAY: ${currentDay.date}.

**TODAY'S HEALTH STATUS:**
- Recovery Score: ${currentDay.recovery ?? 'Not recorded'}%
- Sleep Performance: ${currentDay.sleep ?? 'Not recorded'}%
- Resting Heart Rate: ${currentDay.rhr ?? 'Not recorded'} bpm
- Yesterday's Strain: ${currentDay.strain ?? 'Not recorded'}

**WORKOUT PARAMETERS:**
- Workout Type: ${workoutTypeName}
- Target Duration: ${targetDuration} minutes
- Training Goal: ${userProfile?.trainingGoal || 'strength_building'}
- Experience Level: ${userProfile?.experienceLevel || 'intermediate'}
- Equipment: ${userProfile?.availableEquipment?.join(', ') || 'dumbbells'}
- **AVAILABLE DUMBBELL WEIGHTS: ${userProfile?.availableWeights?.join(', ') || '10, 20, 25, 30, 35'} lbs ONLY**

**LAST 3 ${workoutTypeName.toUpperCase()} WORKOUTS (for progression tracking):**
${historyStr}

**CRITICAL INSTRUCTIONS:**
1. **USE EXACT SAME EXERCISES**: Copy the exercise names EXACTLY from the MOST RECENT workout above (${exerciseCount} exercises). DO NOT change, substitute, or add exercises.
2. **WEIGHTS MUST BE FROM AVAILABLE SET**: You can ONLY recommend weights from: ${userProfile?.availableWeights?.join(', ') || '10, 20, 25, 30, 35'} lbs. Round to nearest available weight.
3. **ADJUST INTENSITY BASED ON RECOVERY**:
   - Recovery <60%: Go DOWN to next available weight (e.g., 25 lbs → 20 lbs)
   - Recovery 60-79%: Keep SAME weight
   - Recovery 80%+: Go UP to next available weight (e.g., 20 lbs → 25 lbs)
4. **MATCH TARGET DURATION (${targetDuration} min)**:
   - For 40 min: Use 3 sets per exercise
   - For 60 min: Use 4 sets per exercise
5. **TRACK PROGRESSION**: Look at the trend across all 3 workouts

**IMPORTANT - WEIGHT SELECTION:**
- ONLY use these weights: ${userProfile?.availableWeights?.join(', ') || '10, 20, 25, 30, 35'} lbs
- If previous was 20 lbs and recovery is low (<60%) → use 10 lbs
- If previous was 20 lbs and recovery is good (80%+) → use 25 lbs
- Current recovery is ${currentDay.recovery ?? 'unknown'}% - select appropriate weight from available set

Generate the workout plan in the following EXACT JSON format (respond ONLY with valid JSON, no markdown):

{
  "recommendation": "2-3 sentences explaining your weight/rep adjustments based on today's ${currentDay.recovery ?? 'unknown'}% recovery and the progression trend from the last 3 workouts",
  "workoutType": "${workoutTypeName}",
  "targetDuration": ${targetDuration},
  "estimatedIntensity": "easy|moderate|hard",
  "exercises": [
    {
      "name": "EXACT exercise name from most recent workout",
      "sets": 3,
      "reps": "8",
      "suggestedWeight": "20 lbs",
      "progression": "Kept at 20 lbs due to moderate recovery",
      "previousPerformance": "3x8 @ 20 lbs",
      "notes": "Form cues"
    }
  ],
  "warmup": "5 min warmup routine",
  "cooldown": "5 min cooldown routine",
  "nutritionTip": "Brief nutrition tip"
}

**ABSOLUTE RULES - MUST FOLLOW:**
1. suggestedWeight MUST be EXACTLY one of: "10 lbs", "20 lbs", "25 lbs", "30 lbs", or "35 lbs"
2. NO OTHER WEIGHTS ARE ALLOWED - no 15, 17.5, 22.5, 27.5, or any other values
3. Include EXACTLY ${exerciseCount} exercises (same as most recent workout)
4. Exercise names must MATCH EXACTLY from history
5. Sets should be ${targetDuration <= 45 ? 3 : 4} per exercise

**WEIGHT SELECTION GUIDE:**
- Previous 10 lbs + low recovery → 10 lbs (can't go lower)
- Previous 10 lbs + good recovery → 20 lbs
- Previous 20 lbs + low recovery → 10 lbs
- Previous 20 lbs + good recovery → 25 lbs
- Previous 25 lbs + low recovery → 20 lbs
- Previous 25 lbs + good recovery → 30 lbs
- Previous 30 lbs + low recovery → 25 lbs
- Previous 30 lbs + good recovery → 35 lbs
- Previous 35 lbs + low recovery → 30 lbs
- Previous 35 lbs + good recovery → 35 lbs (max weight)`;
}

// Helper function to round weight to nearest available dumbbell
function roundToAvailableWeight(weightStr: string): string {
  const availableWeights = [10, 20, 25, 30, 35];
  
  // Extract number from string like "22.5 lbs" or "25"
  const match = weightStr.match(/(\d+\.?\d*)/);
  if (!match) return '20 lbs'; // Default
  
  const weight = parseFloat(match[1]);
  
  // Find nearest available weight
  let nearest = availableWeights[0];
  let minDiff = Math.abs(weight - nearest);
  
  for (const w of availableWeights) {
    const diff = Math.abs(weight - w);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = w;
    }
  }
  
  return `${nearest} lbs`;
}

function parseWorkoutPlanResponse(response: string): {
  recommendation: string;
  workoutType: string;
  targetDuration: number;
  estimatedIntensity: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    suggestedWeight: string;
    progression?: string;
    previousPerformance?: string;
    notes?: string;
  }>;
  warmup?: string;
  cooldown?: string;
  nutritionTip?: string;
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and fix exercise weights to available dumbbells
      const exercises = (parsed.exercises || []).map((ex: any) => ({
        ...ex,
        suggestedWeight: roundToAvailableWeight(ex.suggestedWeight || '20 lbs')
      }));
      
      return {
        recommendation: parsed.recommendation || 'AI-generated workout plan',
        workoutType: parsed.workoutType || 'Strength Training',
        targetDuration: parsed.targetDuration || 40,
        estimatedIntensity: parsed.estimatedIntensity || 'moderate',
        exercises,
        warmup: parsed.warmup,
        cooldown: parsed.cooldown,
        nutritionTip: parsed.nutritionTip
      };
    }
  } catch (e) {
    console.error('Failed to parse workout plan JSON:', e);
  }

  // Fallback: return a basic workout structure
  return {
    recommendation: 'Failed to parse AI response. Please try again.',
    workoutType: 'Strength Training',
    targetDuration: 40,
    estimatedIntensity: 'moderate',
    exercises: []
  };
}
