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
  action: 'analyze_day' | 'analyze_week' | 'analyze_month' | 'chat' | 'generate_insights';
  message?: string;
  prompt?: string; // Alternative to message
  data?: HealthData | InsightsData; // Single day data
  healthData?: HealthData[]; // Multiple days data
  history?: { role: string; content: string }[];
  currentDate?: string;
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
        const dayData = data || healthData?.[0];
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
  "wellness_score": 75
}

Rules for the response:
- wellness_score should be 0-100 based on overall day performance
- achievements should highlight what went well (3-5 items)
- areas_for_improvement should be constructive (2-3 items)
- recommendations should be actionable for tomorrow (2-3 items)
- Be encouraging but honest
- Keep each item concise (under 100 characters)`;
}

function parseInsightsResponse(response: string): {
  summary: string;
  achievements: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  wellness_score: number;
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
        wellness_score: parsed.wellness_score ?? 50
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
