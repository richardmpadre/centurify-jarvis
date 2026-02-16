import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService, WeeklyInsights } from '../services/chat.service';
import { HealthDataService } from '../services/health-data.service';
import { FoodEntryService, FoodEntry } from '../services/food-entry.service';
import { WeeklyInsightsService, WeeklyInsightRecord } from '../services/weekly-insights.service';
import { HealthEntry, PlannedWorkout } from '../models/health.models';
import {
  getWeekDateRange,
  getWeekDates,
  getPreviousWeek,
  getNextWeek,
  isCurrentWeek,
  WeekDateRange
} from '../utils/date-utils';

// Health stats for the week
export interface WeeklyHealthStats {
  totalMilesRan: number;
  totalReps: number;
  totalSets: number;
  exercisesByName: { name: string; sets: number; reps: number; maxWeight: string }[];
}

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './insights.component.html',
  styleUrl: './insights.component.css'
})
export class InsightsComponent implements OnInit {
  currentDate = new Date();
  weekInfo: WeekDateRange;
  
  entries: HealthEntry[] = [];
  previousWeekEntries: HealthEntry[] = [];
  foodEntriesByDate: { [date: string]: FoodEntry[] } = {};
  
  isLoading = false;
  isGenerating = false;
  insights: WeeklyInsights | null = null;
  error: string | null = null;
  
  // Week-over-week comparison
  weeklyComparison: {
    recovery: { current: number | null; previous: number | null; change: number | null };
    sleep: { current: number | null; previous: number | null; change: number | null };
    strain: { current: number | null; previous: number | null; change: number | null };
  } | null = null;
  
  // Health pillar stats
  healthStats: WeeklyHealthStats = {
    totalMilesRan: 0,
    totalReps: 0,
    totalSets: 0,
    exercisesByName: []
  };

  constructor(
    private chatService: ChatService,
    private healthDataService: HealthDataService,
    private foodEntryService: FoodEntryService,
    private weeklyInsightsService: WeeklyInsightsService
  ) {
    this.weekInfo = getWeekDateRange(this.currentDate);
  }

  async ngOnInit(): Promise<void> {
    await this.loadWeekData();
  }

  async loadWeekData(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    
    try {
      const dates = getWeekDates(this.currentDate);
      const previousWeekDate = getPreviousWeek(this.currentDate);
      const previousDates = getWeekDates(previousWeekDate);
      
      // Load health entries for all 7 days
      const allEntries = await this.healthDataService.getAllEntries();
      this.entries = allEntries.filter((e: HealthEntry) => dates.includes(e.date));
      this.previousWeekEntries = allEntries.filter((e: HealthEntry) => previousDates.includes(e.date));
      
      // Load food entries for all 7 days
      this.foodEntriesByDate = {};
      for (const date of dates) {
        const foods = await this.foodEntryService.getFoodEntriesForDate(date);
        this.foodEntriesByDate[date] = foods;
      }
      
      // Calculate health stats
      this.calculateHealthStats();
      
      // Calculate week-over-week comparison
      this.calculateWeeklyComparison();
      
      // Check if we have cached insights for this week
      this.loadCachedInsights();
      
    } catch (err: any) {
      console.error('Error loading week data:', err);
      this.error = err.message || 'Failed to load week data';
    } finally {
      this.isLoading = false;
    }
  }

  private loadCachedInsights(): void {
    // Load insights from dedicated WeeklyInsight table
    this.weeklyInsightsService.getWeeklyInsight(this.weekInfo.year, this.weekInfo.weekNumber)
      .then(record => {
        if (record?.insights) {
          try {
            const parsed = JSON.parse(record.insights);
            this.insights = {
              summary: parsed.summary || record.summary || '',
              weekly_score: parsed.weekly_score ?? record.weeklyScore ?? 50,
              trend: parsed.trend || record.trend || 'stable',
              averages: parsed.averages || { recovery: null, sleep: null, strain: null },
              highlights: parsed.highlights || [],
              lowlights: parsed.lowlights || [],
              patterns: parsed.patterns || [],
              recommendations: parsed.recommendations || [],
              best_day: parsed.best_day || null,
              focus_for_next_week: parsed.focus_for_next_week || '',
              raw_text: record.insights
            };
          } catch (err) {
            console.error('Error parsing cached insights:', err);
          }
        }
      })
      .catch(err => {
        console.error('Error loading cached insights:', err);
      });
  }

  async generateInsights(): Promise<void> {
    this.isGenerating = true;
    this.error = null;
    
    try {
      const dates = getWeekDates(this.currentDate);
      
      // Build day data for each day of the week
      const days = dates.map(date => {
        const entry = this.entries.find(e => e.date === date);
        const foods = this.foodEntriesByDate[date] || [];
        const completedFoods = foods.filter(f => f.completed);
        
        // Check if workout was planned (supports both strength and cardio)
        let workoutPlanned = false;
        let workoutCompleted = false;
        if (entry?.plannedWorkout) {
          try {
            const planned = JSON.parse(entry.plannedWorkout) as PlannedWorkout;
            // Workout is planned if it has exercises OR cardio details
            workoutPlanned = (planned.exercises?.length > 0) || (planned.cardio !== undefined);
          } catch {}
        }
        workoutCompleted = entry?.workoutCompleted ?? false;
        
        return {
          date,
          recovery: entry?.recovery ?? null,
          sleep: entry?.sleep ?? null,
          strain: entry?.strain ?? null,
          rhr: entry?.rhr ?? null,
          workoutCompleted,
          workoutPlanned,
          foodsCompleted: completedFoods.length,
          foodsPlanned: foods.length
        };
      });
      
      const result = await this.chatService.generateWeeklyInsights({
        weekNumber: this.weekInfo.weekNumber,
        year: this.weekInfo.year,
        startDate: this.weekInfo.startDate,
        endDate: this.weekInfo.endDate,
        days,
        healthStats: this.healthStats
      });
      
      this.insights = result;
      
      // Save insights to database
      await this.saveInsights(result);
      
    } catch (err: any) {
      console.error('Error generating weekly insights:', err);
      this.error = err.message || 'Failed to generate weekly insights';
    } finally {
      this.isGenerating = false;
    }
  }

  private async saveInsights(insights: WeeklyInsights): Promise<void> {
    try {
      const insightRecord: WeeklyInsightRecord = {
        year: this.weekInfo.year,
        weekNumber: this.weekInfo.weekNumber,
        startDate: this.weekInfo.startDate,
        endDate: this.weekInfo.endDate,
        summary: insights.summary,
        weeklyScore: insights.weekly_score,
        trend: insights.trend,
        insights: insights.raw_text || JSON.stringify(insights)
      };
      
      await this.weeklyInsightsService.saveWeeklyInsight(insightRecord);
      console.log('Weekly insights saved successfully');
    } catch (err) {
      console.error('Error saving weekly insights:', err);
    }
  }

  prevWeek(): void {
    this.currentDate = getPreviousWeek(this.currentDate);
    this.weekInfo = getWeekDateRange(this.currentDate);
    this.insights = null;
    this.loadWeekData();
  }

  nextWeek(): void {
    this.currentDate = getNextWeek(this.currentDate);
    this.weekInfo = getWeekDateRange(this.currentDate);
    this.insights = null;
    this.loadWeekData();
  }

  goToCurrentWeek(): void {
    this.currentDate = new Date();
    this.weekInfo = getWeekDateRange(this.currentDate);
    this.insights = null;
    this.loadWeekData();
  }

  isCurrentWeekSelected(): boolean {
    return isCurrentWeek(this.currentDate);
  }

  getScoreColor(): string {
    if (!this.insights) return '#888';
    const score = this.insights.weekly_score;
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  getTrendIcon(): string {
    if (!this.insights) return '→';
    switch (this.insights.trend) {
      case 'improving': return '↗';
      case 'declining': return '↘';
      default: return '→';
    }
  }

  getTrendClass(): string {
    if (!this.insights) return 'stable';
    return this.insights.trend;
  }

  getDaysWithData(): number {
    // Get unique dates from entries within the current week
    const dates = getWeekDates(this.currentDate);
    const uniqueDatesWithData = new Set(
      this.entries
        .filter(e => dates.includes(e.date) && (e.recovery != null || e.sleep != null))
        .map(e => e.date)
    );
    return uniqueDatesWithData.size;
  }

  getWorkoutsCompleted(): number {
    // Get unique dates with completed workouts within the current week
    const dates = getWeekDates(this.currentDate);
    const uniqueDatesWithWorkouts = new Set(
      this.entries
        .filter(e => dates.includes(e.date) && e.workoutCompleted)
        .map(e => e.date)
    );
    return uniqueDatesWithWorkouts.size;
  }

  getWorkoutsPlanned(): number {
    // Get unique dates with planned workouts within the current week
    const dates = getWeekDates(this.currentDate);
    const uniqueDatesWithPlanned = new Set(
      this.entries
        .filter(e => {
          if (!dates.includes(e.date) || !e.plannedWorkout) return false;
          try {
            const planned = JSON.parse(e.plannedWorkout) as PlannedWorkout;
            // Workout is planned if it has exercises OR cardio details
            return (planned.exercises?.length > 0) || (planned.cardio !== undefined);
          } catch {
            return false;
          }
        })
        .map(e => e.date)
    );
    return uniqueDatesWithPlanned.size;
  }

  /**
   * Calculate health stats for the week (miles ran, lifting volume)
   */
  private calculateHealthStats(): void {
    const dates = getWeekDates(this.currentDate);
    let totalMiles = 0;
    let totalReps = 0;
    let totalSets = 0;
    const exerciseMap = new Map<string, { sets: number; reps: number; maxWeight: string }>();
    
    this.entries
      .filter(e => dates.includes(e.date) && e.plannedWorkout && e.workoutCompleted)
      .forEach(entry => {
        try {
          const workout = JSON.parse(entry.plannedWorkout!) as any;
          
          // Track running distance - prefer actual, fall back to target for completed cardio workouts
          if (workout.actualDistance) {
            totalMiles += workout.actualDistance;
          } else if (workout.cardio && workout.cardio.targetType === 'distance' && workout.cardio.targetValue) {
            // If no actual distance but it's a completed distance-based cardio workout, use target
            // Convert km to miles if needed
            let distance = workout.cardio.targetValue;
            if (workout.cardio.distanceUnit === 'km') {
              distance = distance * 0.621371; // Convert km to miles
            }
            totalMiles += distance;
          }
          
          // Track lifting exercises
          if (workout.exercises && Array.isArray(workout.exercises)) {
            workout.exercises.forEach((ex: any) => {
              const name = ex.name?.toLowerCase() || 'unknown';
              const sets = ex.sets || 0;
              const repsStr = ex.reps || '0';
              const weight = ex.weight || '';
              
              // Parse reps (could be "8-10" or "8")
              const repsNum = parseInt(repsStr.toString().split('-')[0]) || 0;
              const totalExReps = sets * repsNum;
              
              totalSets += sets;
              totalReps += totalExReps;
              
              // Aggregate by exercise name
              if (exerciseMap.has(name)) {
                const existing = exerciseMap.get(name)!;
                existing.sets += sets;
                existing.reps += totalExReps;
                // Keep max weight (simple string comparison, works for most cases)
                if (this.parseWeight(weight) > this.parseWeight(existing.maxWeight)) {
                  existing.maxWeight = weight;
                }
              } else {
                exerciseMap.set(name, { sets, reps: totalExReps, maxWeight: weight });
              }
            });
          }
        } catch {
          // Skip invalid workout data
        }
      });
    
    this.healthStats = {
      totalMilesRan: Math.round(totalMiles * 10) / 10, // Round to 1 decimal
      totalReps,
      totalSets,
      exercisesByName: Array.from(exerciseMap.entries())
        .map(([name, stats]) => ({
          name: this.titleCase(name),
          ...stats
        }))
        .sort((a, b) => b.sets - a.sets) // Sort by most sets
    };
  }

  /**
   * Parse weight string to number for comparison
   */
  private parseWeight(weight: string): number {
    if (!weight) return 0;
    const match = weight.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Convert string to title case
   */
  private titleCase(str: string): string {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Calculate week-over-week comparison for recovery, sleep, and strain
   */
  private calculateWeeklyComparison(): void {
    const currentAvg = this.calculateAverages(this.entries);
    const previousAvg = this.calculateAverages(this.previousWeekEntries);

    this.weeklyComparison = {
      recovery: this.calculateMetricComparison(currentAvg.recovery, previousAvg.recovery),
      sleep: this.calculateMetricComparison(currentAvg.sleep, previousAvg.sleep),
      strain: this.calculateMetricComparison(currentAvg.strain, previousAvg.strain, 1)
    };
  }

  /**
   * Calculate averages for a set of entries
   */
  private calculateAverages(entries: HealthEntry[]): { recovery: number | null; sleep: number | null; strain: number | null } {
    const recoveryValues = entries.map(e => e.recovery).filter((v): v is number => v != null);
    const sleepValues = entries.map(e => e.sleep).filter((v): v is number => v != null);
    const strainValues = entries.map(e => e.strain).filter((v): v is number => v != null);

    return {
      recovery: recoveryValues.length > 0 ? Math.round(recoveryValues.reduce((a, b) => a + b, 0) / recoveryValues.length) : null,
      sleep: sleepValues.length > 0 ? Math.round(sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) : null,
      strain: strainValues.length > 0 ? Math.round((strainValues.reduce((a, b) => a + b, 0) / strainValues.length) * 10) / 10 : null
    };
  }

  /**
   * Calculate comparison between current and previous values
   */
  private calculateMetricComparison(
    current: number | null, 
    previous: number | null,
    decimals: number = 0
  ): { current: number | null; previous: number | null; change: number | null } {
    let change: number | null = null;
    
    if (current != null && previous != null && previous !== 0) {
      const diff = current - previous;
      change = decimals > 0 ? Math.round(diff * 10) / 10 : Math.round(diff);
    }

    return { current, previous, change };
  }

  /**
   * Get comparison class for styling (positive/negative)
   */
  getComparisonClass(metric: 'recovery' | 'sleep' | 'strain'): string {
    if (!this.weeklyComparison) return '';
    const change = this.weeklyComparison[metric].change;
    if (change === null || change === 0) return '';
    
    // For recovery and sleep, higher is better
    // For strain, higher means more activity (context-dependent, but generally positive)
    return change > 0 ? 'positive' : 'negative';
  }

  /**
   * Format comparison value for display
   */
  formatComparisonValue(metric: 'recovery' | 'sleep' | 'strain'): string {
    if (!this.weeklyComparison) return '';
    const change = this.weeklyComparison[metric].change;
    if (change === null || change === 0) return '';
    
    const sign = change > 0 ? '+' : '';
    const suffix = metric === 'strain' ? '' : '%';
    return `${sign}${change}${suffix} vs last week`;
  }
}
