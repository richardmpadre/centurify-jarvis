import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService, DailyInsights } from '../../../services/chat.service';
import { HealthDataService } from '../../../services/health-data.service';
import { HealthEntry, PlannedWorkout, WhoopWorkout } from '../../../models/health.models';
import { MealEntry } from '../../../services/meal-entry.service';

export interface InsightsData {
  summary: string;
  achievements: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  wellness_score: number;
}

@Component({
  selector: 'app-insights-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './insights-panel.component.html',
  styleUrl: './insights-panel.component.css'
})
export class InsightsPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() currentEntry: HealthEntry | null = null;
  @Input() selectedDate = '';
  @Input() mealEntries: MealEntry[] = [];
  @Input() whoopWorkouts: WhoopWorkout[] = [];
  @Input() dailyActions: { status: string; title: string }[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() insightsSaved = new EventEmitter<void>();
  
  isGenerating = false;
  insights: InsightsData | null = null;

  constructor(
    private chatService: ChatService,
    private healthDataService: HealthDataService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.loadExistingInsights();
    }
  }

  private loadExistingInsights(): void {
    if (this.currentEntry?.dailyInsights) {
      try {
        this.insights = JSON.parse(this.currentEntry.dailyInsights);
      } catch {
        this.insights = null;
      }
    } else {
      this.insights = null;
    }
  }

  async generateInsights(): Promise<void> {
    this.isGenerating = true;
    
    try {
      const completedMeals = this.mealEntries.filter(m => m.completed);
      const nutritionTotals = completedMeals.reduce((acc, m) => ({
        totalCalories: acc.totalCalories + (m.calories || 0),
        totalProtein: acc.totalProtein + (m.protein || 0),
        totalCarbs: acc.totalCarbs + (m.carbs || 0),
        totalFats: acc.totalFats + (m.fats || 0)
      }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0 });
      
      const completedActions = this.dailyActions.filter(a => a.status === 'completed').length;
      const totalActions = this.dailyActions.length;
      
      const plannedWorkout = this.getPlannedWorkout();
      
      const data = {
        date: this.selectedDate,
        recovery: this.currentEntry?.recovery,
        sleep: this.currentEntry?.sleep,
        strain: this.currentEntry?.strain,
        rhr: this.currentEntry?.rhr,
        workouts: this.whoopWorkouts,
        plannedWorkout,
        workoutCompleted: this.currentEntry?.workoutCompleted ?? false,
        nutrition: {
          ...nutritionTotals,
          mealsCompleted: completedMeals.length,
          mealsPlanned: this.mealEntries.length
        },
        checklistStats: {
          completed: completedActions,
          total: totalActions
        }
      };
      
      const result = await this.chatService.generateDailyInsights(data);
      this.insights = {
        summary: result.summary,
        achievements: result.achievements,
        areas_for_improvement: result.areas_for_improvement,
        recommendations: result.recommendations,
        wellness_score: result.wellness_score
      };
      
      // Save to database
      await this.saveInsights(result.raw_text);
      this.insightsSaved.emit();
      
    } catch (error: any) {
      console.error('Error generating insights:', error);
      const errorMessage = error?.message || 'Unknown error';
      this.insights = {
        summary: `Failed to generate insights: ${errorMessage}`,
        achievements: [],
        areas_for_improvement: [],
        recommendations: [],
        wellness_score: 0
      };
    } finally {
      this.isGenerating = false;
    }
  }

  private getPlannedWorkout(): PlannedWorkout | null {
    if (!this.currentEntry?.plannedWorkout) return null;
    try {
      return JSON.parse(this.currentEntry.plannedWorkout);
    } catch {
      return null;
    }
  }

  private async saveInsights(insightsJson: string): Promise<void> {
    const now = new Date().toISOString();
    
    if (this.currentEntry?.id) {
      await this.healthDataService.updateEntry({
        id: this.currentEntry.id,
        date: this.selectedDate,
        dailyInsights: insightsJson,
        insightsGeneratedAt: now
      });
    } else {
      await this.healthDataService.saveEntry({
        date: this.selectedDate,
        dailyInsights: insightsJson,
        insightsGeneratedAt: now
      });
    }
  }

  getWellnessScoreColor(): string {
    if (!this.insights) return '#888';
    const score = this.insights.wellness_score;
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  onClose(): void {
    this.close.emit();
  }
}
