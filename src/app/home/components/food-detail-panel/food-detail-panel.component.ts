import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FoodService, Food } from '../../../services/food.service';
import { FoodEntryService, FoodEntry } from '../../../services/food-entry.service';

@Component({
  selector: 'app-food-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './food-detail-panel.component.html',
  styleUrl: './food-detail-panel.component.css'
})
export class FoodDetailPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  @Input() selectedDate = '';
  @Input() foodEntries: FoodEntry[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() foodEntriesChanged = new EventEmitter<FoodEntry[]>();
  @Output() mealTypeCompleted = new EventEmitter<string>();
  
  savedFoods: Food[] = [];
  filteredFoods: Food[] = [];
  searchQuery = '';
  isLoadingFoods = false;

  constructor(
    private foodService: FoodService,
    private foodEntryService: FoodEntryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.searchQuery = '';
      this.loadSavedFoods();
    }
  }

  async loadSavedFoods(): Promise<void> {
    this.isLoadingFoods = true;
    try {
      this.savedFoods = await this.foodService.getAllFoods();
      this.filteredFoods = [...this.savedFoods];
    } catch (error) {
      console.error('Error loading saved foods:', error);
      this.savedFoods = [];
      this.filteredFoods = [];
    } finally {
      this.isLoadingFoods = false;
    }
  }

  filterFoods(): void {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredFoods = [...this.savedFoods];
    } else {
      this.filteredFoods = this.savedFoods.filter(food =>
        food.name.toLowerCase().includes(query)
      );
    }
  }

  getFoodsForType(): FoodEntry[] {
    return this.foodEntries.filter(f => f.mealType === this.mealType);
  }

  getTotals(): { calories: number; protein: number; fats: number; carbs: number } {
    const foods = this.getFoodsForType();
    return foods.reduce((totals, food) => ({
      calories: totals.calories + (food.calories || 0) * (food.portion || 1),
      protein: totals.protein + (food.protein || 0) * (food.portion || 1),
      fats: totals.fats + (food.fats || 0) * (food.portion || 1),
      carbs: totals.carbs + (food.carbs || 0) * (food.portion || 1)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  }

  isMealTypeCompleted(): boolean {
    const foods = this.getFoodsForType();
    return foods.length > 0 && foods.every(f => f.completed);
  }

  async addFoodToType(foodId: string): Promise<void> {
    console.log('Food detail panel: addFoodToType called with:', { foodId, mealType: this.mealType, date: this.selectedDate });
    
    if (!foodId) {
      console.log('No food ID provided');
      return;
    }
    
    const savedFood = this.savedFoods.find(f => f.id === foodId);
    if (!savedFood) {
      console.error('Saved food not found:', foodId);
      return;
    }
    
    console.log('Creating food entry for:', savedFood.name);
    
    try {
      const created = await this.foodEntryService.createFoodEntry({
        date: this.selectedDate,
        mealType: this.mealType,
        name: savedFood.name,
        calories: savedFood.calories,
        protein: savedFood.protein,
        carbs: savedFood.carbs,
        fats: savedFood.fats,
        completed: false,
        foodId: savedFood.id,
        portion: 1
      });
      
      console.log('Food entry created:', created);
      
      if (created) {
        const newEntries = [...this.foodEntries, created];
        console.log('Emitting food entries changed with', newEntries.length, 'entries');
        this.foodEntriesChanged.emit(newEntries);
      } else {
        console.error('Failed to create food entry - no data returned');
      }
    } catch (error) {
      console.error('Error in addFoodToType:', error);
    }
  }

  async removeFood(foodId: string): Promise<void> {
    const success = await this.foodEntryService.deleteFoodEntry(foodId);
    if (success) {
      const newEntries = this.foodEntries.filter(f => f.id !== foodId);
      this.foodEntriesChanged.emit(newEntries);
    }
  }

  async updatePortion(foodEntry: FoodEntry, newPortion: number): Promise<void> {
    if (newPortion <= 0) return;
    
    const updated = await this.foodEntryService.updateFoodEntry(foodEntry.id, {
      portion: newPortion
    });
    
    if (updated) {
      const newEntries = this.foodEntries.map(f => 
        f.id === updated.id ? updated : f
      );
      this.foodEntriesChanged.emit(newEntries);
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
