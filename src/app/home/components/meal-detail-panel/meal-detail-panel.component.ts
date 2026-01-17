import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealService, Meal } from '../../../services/meal.service';
import { MealEntryService, MealEntry } from '../../../services/meal-entry.service';

@Component({
  selector: 'app-meal-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meal-detail-panel.component.html',
  styleUrl: './meal-detail-panel.component.css'
})
export class MealDetailPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  @Input() selectedDate = '';
  @Input() mealEntries: MealEntry[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() mealEntriesChanged = new EventEmitter<MealEntry[]>();
  @Output() mealTypeCompleted = new EventEmitter<string>();
  
  savedMeals: Meal[] = [];
  filteredMeals: Meal[] = [];
  searchQuery = '';
  isLoadingMeals = false;

  constructor(
    private mealService: MealService,
    private mealEntryService: MealEntryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.searchQuery = '';
      this.loadSavedMeals();
    }
  }

  async loadSavedMeals(): Promise<void> {
    this.isLoadingMeals = true;
    try {
      this.savedMeals = await this.mealService.getAllMeals();
      this.filteredMeals = [...this.savedMeals];
    } catch (error) {
      console.error('Error loading saved meals:', error);
      this.savedMeals = [];
      this.filteredMeals = [];
    } finally {
      this.isLoadingMeals = false;
    }
  }

  filterMeals(): void {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredMeals = [...this.savedMeals];
    } else {
      this.filteredMeals = this.savedMeals.filter(meal =>
        meal.name.toLowerCase().includes(query)
      );
    }
  }

  getMealsForType(): MealEntry[] {
    return this.mealEntries.filter(m => m.mealType === this.mealType);
  }

  getTotals(): { calories: number; protein: number; fats: number; carbs: number } {
    const meals = this.getMealsForType();
    return meals.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0) * (meal.portion || 1),
      protein: totals.protein + (meal.protein || 0) * (meal.portion || 1),
      fats: totals.fats + (meal.fats || 0) * (meal.portion || 1),
      carbs: totals.carbs + (meal.carbs || 0) * (meal.portion || 1)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  }

  isMealTypeCompleted(): boolean {
    const meals = this.getMealsForType();
    return meals.length > 0 && meals.every(m => m.completed);
  }

  async addMealToType(mealId: string): Promise<void> {
    console.log('Meal detail panel: addMealToType called with:', { mealId, mealType: this.mealType, date: this.selectedDate });
    
    if (!mealId) {
      console.log('No meal ID provided');
      return;
    }
    
    const savedMeal = this.savedMeals.find(m => m.id === mealId);
    if (!savedMeal) {
      console.error('Saved meal not found:', mealId);
      return;
    }
    
    console.log('Creating meal entry for:', savedMeal.name);
    
    try {
      const created = await this.mealEntryService.createMealEntry({
        date: this.selectedDate,
        mealType: this.mealType,
        name: savedMeal.name,
        calories: savedMeal.calories,
        protein: savedMeal.protein,
        carbs: savedMeal.carbs,
        fats: savedMeal.fats,
        completed: false,
        mealId: savedMeal.id,
        portion: 1
      });
      
      console.log('Meal entry created:', created);
      
      if (created) {
        const newEntries = [...this.mealEntries, created];
        console.log('Emitting meal entries changed with', newEntries.length, 'entries');
        this.mealEntriesChanged.emit(newEntries);
      } else {
        console.error('Failed to create meal entry - no data returned');
      }
    } catch (error) {
      console.error('Error in addMealToType:', error);
    }
  }

  async removeMeal(mealId: string): Promise<void> {
    const success = await this.mealEntryService.deleteMealEntry(mealId);
    if (success) {
      const newEntries = this.mealEntries.filter(m => m.id !== mealId);
      this.mealEntriesChanged.emit(newEntries);
    }
  }

  async updatePortion(mealEntry: MealEntry, newPortion: number): Promise<void> {
    if (newPortion <= 0) return;
    
    const updated = await this.mealEntryService.updateMealEntry(mealEntry.id, {
      portion: newPortion
    });
    
    if (updated) {
      const newEntries = this.mealEntries.map(m => 
        m.id === updated.id ? updated : m
      );
      this.mealEntriesChanged.emit(newEntries);
    }
  }

  getCalculatedValue(baseValue: number | null, portion: number): number {
    return Math.round((baseValue || 0) * portion * 100) / 100;
  }

  roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  onMarkComplete(): void {
    this.mealTypeCompleted.emit(this.mealType);
    this.close.emit();
  }

  getMealTypeIcon(): string {
    switch (this.mealType) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  }

  getMealTypeLabel(): string {
    return this.mealType.charAt(0).toUpperCase() + this.mealType.slice(1);
  }

  onClose(): void {
    this.close.emit();
  }
}
