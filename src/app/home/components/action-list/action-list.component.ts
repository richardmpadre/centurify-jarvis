import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'pending' | 'in_progress' | 'completed';
  type: 'biometrics' | 'workout' | 'nutrition' | 'life_events' | 'jarvis' | 'custom';
  priority?: number;
  dependsOn?: string[]; // IDs of actions that must complete first
  createsEntry?: string; // Type of entry this creates when completed
  externalLink?: string;
}

@Component({
  selector: 'app-action-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.css'
})
export class ActionListComponent {
  @Input() actions: ActionItem[] = [];
  @Input() isLoading = false;
  @Input() collapsed = false;
  @Input() editMode = false;
  
  @Output() actionClick = new EventEmitter<ActionItem>();
  @Output() actionUncomplete = new EventEmitter<ActionItem>(); // For toggling completed actions back
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() reorder = new EventEmitter<string[]>(); // Emits new order of IDs
  @Output() toggleEditMode = new EventEmitter<void>();

  get completedCount(): number {
    return this.actions.filter(a => a.status === 'completed').length;
  }

  get totalCount(): number {
    return this.actions.length;
  }

  get progressPercent(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  get isAllComplete(): boolean {
    return this.completedCount === this.totalCount && this.totalCount > 0;
  }

  get visibleActions(): ActionItem[] {
    if (this.editMode) {
      // Show all actions in edit mode
      return this.actions;
    }
    // Filter out actions whose dependencies aren't met
    return this.actions.filter(action => {
      if (!action.dependsOn || action.dependsOn.length === 0) return true;
      return action.dependsOn.every(depId => 
        this.actions.find(a => a.id === depId)?.status === 'completed'
      );
    });
  }

  onActionClick(action: ActionItem): void {
    if (this.editMode) return;
    
    if (action.status === 'completed') {
      // Allow uncompleting
      this.actionUncomplete.emit(action);
    } else {
      this.actionClick.emit(action);
    }
  }

  onHeaderClick(): void {
    if (!this.editMode) {
      this.toggleCollapse.emit();
    }
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    this.toggleEditMode.emit();
  }

  moveUp(index: number, event: Event): void {
    event.stopPropagation();
    if (index === 0) return;
    
    const newOrder = this.actions.map(a => a.id);
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    this.reorder.emit(newOrder);
  }

  moveDown(index: number, event: Event): void {
    event.stopPropagation();
    if (index >= this.actions.length - 1) return;
    
    const newOrder = this.actions.map(a => a.id);
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    this.reorder.emit(newOrder);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✓';
      case 'in_progress': return '⏳';
      default: return '';
    }
  }
}
