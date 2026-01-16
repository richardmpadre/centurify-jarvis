import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Goal, GOAL_STATUS_CONFIG } from '../../../models/goal.models';
import { GoalService } from '../../../services/goal.service';

export interface DailyGoalSelection {
  yearlyGoalId: string;
  selectedGoalId: string;
  selectedGoalTitle: string;
}

@Component({
  selector: 'app-goal-priority-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-priority-panel.component.html',
  styleUrl: './goal-priority-panel.component.css'
})
export class GoalPriorityPanelComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() yearlyGoal: Goal | null = null;
  @Input() selectedGoalId: string | null = null;
  
  @Output() close = new EventEmitter<void>();
  @Output() selectGoal = new EventEmitter<DailyGoalSelection>();

  adHocGoals: Goal[] = [];
  isLoading = false;

  constructor(private goalService: GoalService) {}

  ngOnInit(): void {
    if (this.yearlyGoal) {
      this.loadAdHocGoals();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['yearlyGoal'] && this.yearlyGoal) {
      this.loadAdHocGoals();
    }
  }

  async loadAdHocGoals(): Promise<void> {
    if (!this.yearlyGoal) return;
    
    this.isLoading = true;
    try {
      this.adHocGoals = await this.goalService.getAdHocChildGoals(this.yearlyGoal.id);
    } catch (error) {
      console.error('Error loading ad-hoc goals:', error);
      this.adHocGoals = [];
    } finally {
      this.isLoading = false;
    }
  }

  getStatusConfig(status: string) {
    return GOAL_STATUS_CONFIG[status as keyof typeof GOAL_STATUS_CONFIG] || GOAL_STATUS_CONFIG.not_started;
  }

  isSelected(goal: Goal): boolean {
    return this.selectedGoalId === goal.id;
  }

  onSelectGoal(goal: Goal): void {
    if (!this.yearlyGoal) return;
    
    this.selectGoal.emit({
      yearlyGoalId: this.yearlyGoal.id,
      selectedGoalId: goal.id,
      selectedGoalTitle: goal.title
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
