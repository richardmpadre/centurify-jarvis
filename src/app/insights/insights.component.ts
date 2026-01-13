import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService, WeeklyInsights } from '../services/chat.service';
import { HealthDataService } from '../services/health-data.service';
import { MealEntryService, MealEntry } from '../services/meal-entry.service';
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
  mealEntriesByDate: { [date: string]: MealEntry[] } = {};
  
  isLoading = false;
  isGenerating = false;
  insights: WeeklyInsights | null = null;
  error: string | null = null;

  constructor(
    private chatService: ChatService,
    private healthDataService: HealthDataService,
    private mealEntryService: MealEntryService,
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
      
      // Load health entries for all 7 days
      const allEntries = await this.healthDataService.getAllEntries();
      this.entries = allEntries.filter((e: HealthEntry) => dates.includes(e.date));
      
      // Load meal entries for all 7 days
      this.mealEntriesByDate = {};
      for (const date of dates) {
        const meals = await this.mealEntryService.getMealEntriesForDate(date);
        this.mealEntriesByDate[date] = meals;
      }
      
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
        const meals = this.mealEntriesByDate[date] || [];
        const completedMeals = meals.filter(m => m.completed);
        
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
          mealsCompleted: completedMeals.length,
          mealsPlanned: meals.length
        };
      });
      
      const result = await this.chatService.generateWeeklyInsights({
        weekNumber: this.weekInfo.weekNumber,
        year: this.weekInfo.year,
        startDate: this.weekInfo.startDate,
        endDate: this.weekInfo.endDate,
        days
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
}
