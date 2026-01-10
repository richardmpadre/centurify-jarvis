import { Injectable } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface DayAnalysis {
  summary: string;
  highlights: string[];
  suggestions: string[];
  score?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private chatApiUrl: string | null = null;
  private urlLoaded = false;
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    this.loadApiUrl();
  }

  private async loadApiUrl(): Promise<void> {
    if (this.urlLoaded) return;
    try {
      const outputs: any = await import('../../../amplify_outputs.json');
      const customOutputs = outputs.default?.custom || outputs.custom;
      this.chatApiUrl = customOutputs?.chatAgentApiUrl || null;
      this.urlLoaded = true;
      console.log('Chat API URL loaded:', this.chatApiUrl ? 'Yes' : 'No');
    } catch (e) {
      console.log('amplify_outputs.json not found - run npx ampx sandbox first');
    }
  }

  private async ensureApiUrl(): Promise<string> {
    if (!this.chatApiUrl) {
      await this.loadApiUrl();
    }
    if (!this.chatApiUrl) {
      throw new Error('Chat API URL not configured. Run "npx ampx sandbox" to deploy.');
    }
    return this.chatApiUrl;
  }

  // Analyze daily progress
  async analyzeDay(data: {
    date: string;
    recovery?: number;
    sleep?: number;
    strain?: number;
    rhr?: number;
    workouts?: any[];
    plannedWorkout?: any;
    checklistCompleted?: string[];
  }): Promise<DayAnalysis> {
    const apiUrl = await this.ensureApiUrl();
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_day',
        data
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze day');
    }

    return response.json();
  }

  // General chat with Claude
  async chat(message: string): Promise<string> {
    const apiUrl = await this.ensureApiUrl();
    
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        prompt: message,
        history: this.conversationHistory.slice(-10) // Keep last 10 messages for context
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chat request failed');
    }

    const data = await response.json();
    const assistantMessage = data.message || data.response || '';

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date()
    });

    return assistantMessage;
  }

  // Get conversation history
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearHistory(): void {
    this.conversationHistory = [];
  }

  // Check if service is configured
  async isConfigured(): Promise<boolean> {
    try {
      await this.ensureApiUrl();
      return true;
    } catch {
      return false;
    }
  }
}
