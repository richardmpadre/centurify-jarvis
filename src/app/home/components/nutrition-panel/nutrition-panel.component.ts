import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealService, Meal } from '../../../services/meal.service';
import { MealEntryService, MealEntry } from '../../../services/meal-entry.service';

@Component({
  selector: 'app-nutrition-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nutrition-panel.component.html',
  styleUrl: './nutrition-panel.component.css'
})
export class NutritionPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() selectedDate = '';
  @Input() mealEntries: MealEntry[] = [];
  @Input() allEntries: any[] = []; // All entries for finding yesterday's meals
  
  @Output() close = new EventEmitter<void>();
  @Output() mealEntriesChanged = new EventEmitter<MealEntry[]>();
  @Output() planSaved = new EventEmitter<void>();
  
  savedMeals: Meal[] = [];
  selectedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  isLoadingMeals = false;
  isCopyingYesterday = false;

  constructor(
    private mealService: MealService,
    private mealEntryService: MealEntryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.loadSavedMeals();
    }
  }

  async loadSavedMeals(): Promise<void> {
    this.isLoadingMeals = true;
    try {
      this.savedMeals = await this.mealService.getAllMeals();
    } catch (error) {
      console.error('Error loading saved meals:', error);
      this.savedMeals = [];
    } finally {
      this.isLoadingMeals = false;
    }
  }

  selectMealType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    this.selectedMealType = type;
  }

  async onMealDropdownChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const mealId = select.value;
    
    console.log('Meal dropdown changed:', { mealId, selectedMealType: this.selectedMealType, date: this.selectedDate });
    
    if (!mealId) {
      console.log('No meal ID selected');
      return;
    }
    
    const savedMeal = this.savedMeals.find(m => m.id === mealId);
    if (!savedMeal) {
      console.error('Saved meal not found:', mealId);
      return;
    }
    
    console.log('Creating meal entry:', {
      meal: savedMeal.name,
      type: this.selectedMealType,
      date: this.selectedDate
    });
    
    try {
      const created = await this.mealEntryService.createMealEntry({
        date: this.selectedDate,
        mealType: this.selectedMealType,
        name: savedMeal.name,
        calories: savedMeal.calories,
        protein: savedMeal.protein,
        carbs: savedMeal.carbs,
        fats: savedMeal.fats,
        completed: false,
        mealId: savedMeal.id
      });
      
      console.log('Meal entry created:', created);
      
      if (created) {
        const newEntries = [...this.mealEntries, created];
        console.log('Emitting new entries:', newEntries.length);
        this.mealEntriesChanged.emit(newEntries);
      } else {
        console.error('Failed to create meal entry - no data returned');
      }
    } catch (error) {
      console.error('Error in onMealDropdownChange:', error);
    }
    
    select.value = '';
  }

  async removeMeal(mealId: string): Promise<void> {
    const success = await this.mealEntryService.deleteMealEntry(mealId);
    if (success) {
      const newEntries = this.mealEntries.filter(m => m.id !== mealId);
      this.mealEntriesChanged.emit(newEntries);
    }
  }

  getNutritionTotals(): { calories: number; protein: number; fats: number; carbs: number } {
    return this.mealEntries.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0),
      protein: totals.protein + (meal.protein || 0),
      fats: totals.fats + (meal.fats || 0),
      carbs: totals.carbs + (meal.carbs || 0)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  }

  getMealTypeIcon(type: string): string {
    switch (type) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  }

  getMealTypeLabel(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  onSavePlan(): void {
    this.planSaved.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  async copyYesterdaysMeals(): Promise<void> {
    this.isCopyingYesterday = true;
    try {
      // Get yesterday's date
      const yesterday = this.getYesterdayDate();
      
      // Get yesterday's meal entries
      const yesterdayMeals = await this.mealEntryService.getMealEntriesForDate(yesterday);
      
      if (yesterdayMeals.length === 0) {
        alert('No meals found for yesterday');
        return;
      }
      
      // Create new meal entries for today based on yesterday's
      const newEntries: MealEntry[] = [];
      for (const meal of yesterdayMeals) {
        const created = await this.mealEntryService.createMealEntry({
          date: this.selectedDate,
          mealType: meal.mealType,
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          completed: false,
          mealId: meal.mealId || null
        });
        
        if (created) {
          newEntries.push(created);
        }
      }
      
      // Emit the combined list
      const allEntries = [...this.mealEntries, ...newEntries];
      this.mealEntriesChanged.emit(allEntries);
      
    } catch (error) {
      console.error('Error copying yesterday\'s meals:', error);
      alert('Failed to copy yesterday\'s meals');
    } finally {
      this.isCopyingYesterday = false;
    }
  }

  hasYesterdaysMeals(): boolean {
    // Check if we have allEntries to look at
    if (!this.allEntries || this.allEntries.length === 0) {
      return false;
    }
    
    const yesterday = this.getYesterdayDate();
    // Check if there are any entries for yesterday
    return this.allEntries.some((entry: any) => entry.date === yesterday);
  }

  private getYesterdayDate(): string {
    const today = new Date(this.selectedDate);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}
