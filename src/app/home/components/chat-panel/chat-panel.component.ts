import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../../services/chat.service';
import { HealthEntry, PlannedWorkout, WhoopWorkout } from '../../../models/health.models';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.css'
})
export class ChatPanelComponent {
  @Input() currentEntry: HealthEntry | null = null;
  @Input() selectedDate = '';
  @Input() whoopWorkouts: WhoopWorkout[] = [];
  @Input() dailyActions: { status: string; title: string }[] = [];
  
  @Output() chatToggled = new EventEmitter<boolean>();
  
  isOpen = false;
  messages: ChatMessage[] = [];
  inputText = '';
  isLoading = false;

  constructor(private chatService: ChatService) {}

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.messages = this.chatService.getHistory();
    }
    this.chatToggled.emit(this.isOpen);
  }

  async sendMessage(): Promise<void> {
    if (!this.inputText.trim() || this.isLoading) return;
    
    const message = this.inputText.trim();
    this.inputText = '';
    this.isLoading = true;
    
    try {
      await this.chatService.chat(message);
      this.messages = this.chatService.getHistory();
    } catch (error: any) {
      console.error('Chat error:', error);
      this.messages.push({
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        timestamp: new Date()
      });
    } finally {
      this.isLoading = false;
    }
  }

  async analyzeToday(): Promise<void> {
    this.isLoading = true;
    
    try {
      const completedActions = this.dailyActions
        .filter(a => a.status === 'completed')
        .map(a => a.title);
      
      const plannedWorkout = this.getPlannedWorkout();
        
      const analysis = await this.chatService.analyzeDay({
        date: this.selectedDate,
        recovery: this.currentEntry?.recovery || undefined,
        sleep: this.currentEntry?.sleep || undefined,
        strain: this.currentEntry?.strain || undefined,
        rhr: this.currentEntry?.rhr || undefined,
        workouts: this.whoopWorkouts,
        plannedWorkout: plannedWorkout || undefined,
        checklistCompleted: completedActions
      });
      
      this.messages.push({
        role: 'assistant',
        content: analysis.summary || JSON.stringify(analysis),
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      this.messages.push({
        role: 'assistant',
        content: `Error analyzing day: ${error.message}`,
        timestamp: new Date()
      });
    } finally {
      this.isLoading = false;
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

  clearChat(): void {
    this.chatService.clearHistory();
    this.messages = [];
  }
}
