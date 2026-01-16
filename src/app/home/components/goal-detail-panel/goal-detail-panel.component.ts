import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Goal, GOAL_STATUS_CONFIG } from '../../../models/goal.models';
import { GoalService } from '../../../services/goal.service';

@Component({
  selector: 'app-goal-detail-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-detail-panel.component.html',
  styleUrl: './goal-detail-panel.component.css'
})
export class GoalDetailPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() goalId: string | null = null;
  @Input() parentGoalTitle: string = '';
  
  @Output() close = new EventEmitter<void>();
  @Output() goalCompleted = new EventEmitter<Goal>();

  goal: Goal | null = null;
  isLoading = false;
  isCompleting = false;

  constructor(private goalService: GoalService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['goalId'] && this.goalId && this.isOpen) {
      this.loadGoal();
    }
    if (changes['isOpen'] && this.isOpen && this.goalId) {
      this.loadGoal();
    }
  }

  async loadGoal(): Promise<void> {
    if (!this.goalId) return;
    
    this.isLoading = true;
    try {
      this.goal = await this.goalService.getGoal(this.goalId);
    } catch (error) {
      console.error('Error loading goal:', error);
      this.goal = null;
    } finally {
      this.isLoading = false;
    }
  }

  getStatusConfig(status: string) {
    return GOAL_STATUS_CONFIG[status as keyof typeof GOAL_STATUS_CONFIG] || GOAL_STATUS_CONFIG.not_started;
  }

  isCompleted(): boolean {
    return this.goal?.status === 'completed';
  }

  async onMarkComplete(): Promise<void> {
    if (!this.goal) return;
    
    this.isCompleting = true;
    try {
      // Update the goal to completed status with 100% progress
      const updatedGoal = await this.goalService.updateProgress(this.goal.id, 100);
      if (updatedGoal) {
        this.goal = updatedGoal;
        this.goalCompleted.emit(updatedGoal);
      }
    } catch (error) {
      console.error('Error completing goal:', error);
    } finally {
      this.isCompleting = false;
    }
  }

  async onMarkIncomplete(): Promise<void> {
    if (!this.goal) return;
    
    this.isCompleting = true;
    try {
      // Reset progress to previous value or a default
      const previousProgress = this.goal.progress === 100 ? 50 : this.goal.progress;
      const updatedGoal = await this.goalService.updateGoal(this.goal.id, {
        status: 'in_progress',
        progress: previousProgress,
        completedDate: undefined
      });
      if (updatedGoal) {
        this.goal = updatedGoal;
      }
    } catch (error) {
      console.error('Error marking goal incomplete:', error);
    } finally {
      this.isCompleting = false;
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
