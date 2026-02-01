import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrainingSessionService } from '../services/training-session.service';
import { WhoopService } from '../services/whoop.service';
import { TrainingSession, TrainingType, CompletedExercise } from '../models/health.models';

@Component({
  selector: 'app-training-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-history.component.html',
  styleUrl: './training-history.component.css'
})
export class TrainingHistoryComponent implements OnInit {
  sessions: TrainingSession[] = [];
  isLoading = false;
  isSyncing = false;
  
  // Filters
  typeFilter: TrainingType | 'all' = 'all';
  sourceFilter: 'all' | 'whoop' | 'manual' = 'all';
  
  // Detail modal
  selectedSession: TrainingSession | null = null;
  showDetailModal = false;
  
  // Add/Edit modal
  showAddModal = false;
  editingSession: TrainingSession | null = null;
  sessionForm: Partial<TrainingSession> = this.getEmptyForm();
  isSaving = false;

  trainingTypes: { value: TrainingType | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All Types', icon: '📋' },
    { value: 'strength', label: 'Strength', icon: '💪' },
    { value: 'cardio', label: 'Cardio', icon: '🏃' },
    { value: 'flexibility', label: 'Flexibility', icon: '🧘' },
    { value: 'sports', label: 'Sports', icon: '⚽' },
    { value: 'hiit', label: 'HIIT', icon: '🔥' },
    { value: 'sauna', label: 'Sauna', icon: '🧖' },
    { value: 'contrast_therapy', label: 'Contrast Therapy', icon: '🧊' },
    { value: 'other', label: 'Other', icon: '📝' },
  ];

  constructor(
    private trainingSessionService: TrainingSessionService,
    private whoopService: WhoopService
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    this.isLoading = true;
    try {
      this.sessions = await this.trainingSessionService.getAllSessions();
      // Sort by date (newest first)
      this.sessions.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by startTime
        if (a.startTime && b.startTime) {
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        }
        return 0;
      });
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      this.isLoading = false;
    }
  }

  get filteredSessions(): TrainingSession[] {
    let result = this.sessions;

    if (this.typeFilter !== 'all') {
      result = result.filter(s => s.type === this.typeFilter);
    }

    if (this.sourceFilter !== 'all') {
      result = result.filter(s => s.source === this.sourceFilter);
    }

    return result;
  }

  // Stats
  get totalSessions(): number {
    return this.filteredSessions.length;
  }

  get totalDuration(): number {
    return this.filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  }

  get totalCalories(): number {
    return this.filteredSessions.reduce((sum, s) => sum + (s.calories || 0), 0);
  }

  get averageStrain(): number {
    const sessionsWithStrain = this.filteredSessions.filter(s => s.strain != null);
    if (sessionsWithStrain.length === 0) return 0;
    const total = sessionsWithStrain.reduce((sum, s) => sum + (s.strain || 0), 0);
    return Math.round(total / sessionsWithStrain.length * 10) / 10;
  }

  // Whoop sync
  get isWhoopConnected(): boolean {
    return this.whoopService.isConnected();
  }

  async syncWhoop(): Promise<void> {
    if (!this.isWhoopConnected || this.isSyncing) return;
    
    this.isSyncing = true;
    try {
      // Sync last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const result = await this.trainingSessionService.syncWhoopWorkouts(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      console.log(`Synced ${result.synced} workouts, skipped ${result.skipped} duplicates`);
      await this.loadSessions();
    } catch (error) {
      console.error('Failed to sync Whoop:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Detail modal
  openDetail(session: TrainingSession): void {
    this.selectedSession = session;
    this.showDetailModal = true;
  }

  closeDetail(): void {
    this.showDetailModal = false;
    this.selectedSession = null;
  }

  // Add/Edit modal
  getEmptyForm(): Partial<TrainingSession> {
    return {
      date: new Date().toISOString().split('T')[0],
      type: 'strength',
      name: '',
      duration: undefined,
      calories: undefined,
      notes: '',
      source: 'manual',
      exercises: [],
    };
  }

  openAddModal(): void {
    this.editingSession = null;
    this.sessionForm = this.getEmptyForm();
    this.showAddModal = true;
  }

  openEditModal(session: TrainingSession): void {
    this.editingSession = session;
    this.sessionForm = {
      date: session.date,
      type: session.type,
      name: session.name || '',
      duration: session.duration || undefined,
      calories: session.calories || undefined,
      strain: session.strain || undefined,
      avgHR: session.avgHR || undefined,
      maxHR: session.maxHR || undefined,
      distance: session.distance || undefined,
      notes: session.notes || '',
      source: session.source,
      exercises: session.exercises ? [...session.exercises] : [],
    };
    this.showAddModal = true;
    this.closeDetail();
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.editingSession = null;
    this.sessionForm = this.getEmptyForm();
  }

  addExercise(): void {
    if (!this.sessionForm.exercises) {
      this.sessionForm.exercises = [];
    }
    this.sessionForm.exercises.push({ name: '', sets: undefined, reps: '', weight: undefined, notes: '' });
  }

  removeExercise(index: number): void {
    if (this.sessionForm.exercises) {
      this.sessionForm.exercises.splice(index, 1);
    }
  }

  async saveSession(): Promise<void> {
    if (this.isSaving || !this.sessionForm.date || !this.sessionForm.type) return;

    this.isSaving = true;
    try {
      const sessionData: Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'> = {
        date: this.sessionForm.date,
        type: this.sessionForm.type as TrainingType,
        name: this.sessionForm.name || null,
        duration: this.sessionForm.duration || null,
        calories: this.sessionForm.calories || null,
        strain: this.sessionForm.strain || null,
        avgHR: this.sessionForm.avgHR || null,
        maxHR: this.sessionForm.maxHR || null,
        distance: this.sessionForm.distance || null,
        notes: this.sessionForm.notes || null,
        source: 'manual',
        exercises: this.sessionForm.exercises?.filter(e => e.name.trim()) || undefined,
        whoopWorkoutId: null,
      };

      if (this.editingSession) {
        await this.trainingSessionService.updateSession(this.editingSession.id, sessionData);
      } else {
        await this.trainingSessionService.createSession(sessionData);
      }

      await this.loadSessions();
      this.closeAddModal();
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteSession(session: TrainingSession): Promise<void> {
    if (!confirm(`Delete this ${session.name || session.type} session?`)) return;
    
    try {
      await this.trainingSessionService.deleteSession(session.id);
      await this.loadSessions();
      this.closeDetail();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  // Helpers
  getTypeInfo(type: TrainingType): { label: string; icon: string; color: string } {
    return this.trainingSessionService.getTypeInfo(type);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  formatTime(timeStr: string): string {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // Group sessions by date for display
  get groupedSessions(): { date: string; sessions: TrainingSession[] }[] {
    const groups = new Map<string, TrainingSession[]>();
    
    for (const session of this.filteredSessions) {
      if (!groups.has(session.date)) {
        groups.set(session.date, []);
      }
      groups.get(session.date)!.push(session);
    }

    return Array.from(groups.entries())
      .map(([date, sessions]) => ({ date, sessions }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
