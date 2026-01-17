import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Goal, GoalType, GOAL_TYPE_CONFIG, GOAL_STATUS_CONFIG } from '../../../models/goal.models';

@Component({
  selector: 'app-goal-tree-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-tree-node.component.html',
  styleUrl: './goal-tree-node.component.css'
})
export class GoalTreeNodeComponent {
  @Input() goal!: Goal;
  @Input() level = 0;
  @Input() isExpanded = true;
  @Input() expandedGoals = new Set<string>();
  
  @Output() toggleExpand = new EventEmitter<string>();
  @Output() addChild = new EventEmitter<Goal>();
  @Output() editGoal = new EventEmitter<Goal>();
  @Output() deleteGoal = new EventEmitter<Goal>();
  @Output() progressUpdate = new EventEmitter<{ goal: Goal; progress: number }>();
  @Output() toggleMilestone = new EventEmitter<{ goalId: string; milestoneId: string }>();

  getTypeConfig() {
    return GOAL_TYPE_CONFIG[this.goal.goalType];
  }

  getStatusConfig() {
    return GOAL_STATUS_CONFIG[this.goal.status];
  }

  hasChildren(): boolean {
    return (this.goal.children?.length ?? 0) > 0;
  }

  canAddChild(): boolean {
    const config = GOAL_TYPE_CONFIG[this.goal.goalType];
    return config.allowedChildren.length > 0;
  }

  onToggleExpand(): void {
    this.toggleExpand.emit(this.goal.id);
  }

  onAddChild(): void {
    this.addChild.emit(this.goal);
  }

  onEdit(): void {
    this.editGoal.emit(this.goal);
  }

  onDelete(): void {
    this.deleteGoal.emit(this.goal);
  }

  onProgressChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const progress = parseInt(input.value, 10);
    this.progressUpdate.emit({ goal: this.goal, progress });
  }

  onMilestoneToggle(milestoneId: string): void {
    this.toggleMilestone.emit({ goalId: this.goal.id, milestoneId });
  }

  isChildExpanded(childId: string): boolean {
    return this.expandedGoals.has(childId);
  }

  getProgressColor(): string {
    if (this.goal.progress >= 100) return '#22c55e';
    if (this.goal.progress >= 70) return '#84cc16';
    if (this.goal.progress >= 40) return '#eab308';
    if (this.goal.progress >= 20) return '#f97316';
    return '#ef4444';
  }

  getIndentStyle(): { [key: string]: string } {
    return {
      'margin-left': `${this.level * 24}px`
    };
  }

  getTypeColor(): string {
    return this.getTypeConfig().color;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getSortedChildren(): Goal[] {
    if (!this.goal.children || this.goal.children.length === 0) {
      return [];
    }

    return [...this.goal.children].sort((a, b) => {
      // First, separate completed from non-completed
      const aCompleted = a.status === 'completed';
      const bCompleted = b.status === 'completed';
      
      if (aCompleted && !bCompleted) return 1; // a goes after b
      if (!aCompleted && bCompleted) return -1; // a goes before b
      
      // Both completed or both not completed - sort by target date
      const aDate = a.targetDate ? new Date(a.targetDate).getTime() : null;
      const bDate = b.targetDate ? new Date(b.targetDate).getTime() : null;
      
      // Goals with dates come before goals without dates
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      
      // Both have dates - sort ascending (earliest first)
      if (aDate && bDate) {
        return aDate - bDate;
      }
      
      // Both have no dates - maintain original order (by sortOrder)
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  // Pass through events from child nodes
  onChildToggleExpand(id: string): void {
    this.toggleExpand.emit(id);
  }

  onChildAddChild(goal: Goal): void {
    this.addChild.emit(goal);
  }

  onChildEditGoal(goal: Goal): void {
    this.editGoal.emit(goal);
  }

  onChildDeleteGoal(goal: Goal): void {
    this.deleteGoal.emit(goal);
  }

  onChildProgressUpdate(event: { goal: Goal; progress: number }): void {
    this.progressUpdate.emit(event);
  }

  onChildToggleMilestone(event: { goalId: string; milestoneId: string }): void {
    this.toggleMilestone.emit(event);
  }
}
