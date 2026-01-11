import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MealService, Meal } from '../services/meal.service';

@Component({
  selector: 'app-nutrition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './nutrition.component.html',
  styleUrl: './nutrition.component.css'
})
export class NutritionComponent implements OnInit {
  meals: Meal[] = [];
  mealForm: FormGroup;
  showForm = false;
  editingMealId: string | null = null;
  searchQuery = '';
  isLoading = false;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private mealService: MealService
  ) {
    this.mealForm = this.fb.group({
      name: ['', Validators.required],
      calories: [0, [Validators.required, Validators.min(0)]],
      protein: [0, [Validators.min(0)]],
      fats: [0, [Validators.min(0)]],
      carbs: [0, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadMeals();
  }

  async loadMeals(): Promise<void> {
    this.isLoading = true;
    try {
      this.meals = await this.mealService.getAllMeals();
      // Sort by most recently updated
      this.meals.sort((a, b) => {
        const dateA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const dateB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return dateA - dateB;
      });
    } catch (error) {
      console.error('Failed to load meals:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openAddForm(): void {
    this.editingMealId = null;
    this.mealForm.reset({
      name: '',
      calories: 0,
      protein: 0,
      fats: 0,
      carbs: 0
    });
    this.showForm = true;
  }

  openEditForm(meal: Meal): void {
    this.editingMealId = meal.id;
    this.mealForm.patchValue({
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein || 0,
      fats: meal.fats || 0,
      carbs: meal.carbs || 0
    });
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingMealId = null;
  }

  async submitForm(): Promise<void> {
    console.log('submitForm called');
    console.log('Form valid:', this.mealForm.valid);
    console.log('Form value:', this.mealForm.value);
    console.log('Is saving:', this.isSaving);
    
    if (!this.mealForm.valid || this.isSaving) {
      console.log('Form validation failed or already saving');
      return;
    }

    this.isSaving = true;
    const formValue = this.mealForm.value;
    console.log('Starting save with values:', formValue);

    try {
      if (this.editingMealId) {
        console.log('Updating existing meal:', this.editingMealId);
        // Update existing
        const updated = await this.mealService.updateMeal(this.editingMealId, {
          name: formValue.name,
          calories: formValue.calories || 0,
          protein: formValue.protein || 0,
          fats: formValue.fats || 0,
          carbs: formValue.carbs || 0
        });
        
        console.log('Update result:', updated);
        
        if (updated) {
          const index = this.meals.findIndex(m => m.id === this.editingMealId);
          if (index !== -1) {
            this.meals[index] = updated;
          }
        }
      } else {
        console.log('Creating new meal');
        // Create new
        const created = await this.mealService.createMeal({
          name: formValue.name,
          calories: formValue.calories || 0,
          protein: formValue.protein || 0,
          fats: formValue.fats || 0,
          carbs: formValue.carbs || 0
        });
        
        console.log('Create result:', created);
        
        if (created) {
          this.meals.unshift(created);
          console.log('Meal added to list. Total meals:', this.meals.length);
        }
      }
      
      console.log('Closing form');
      this.closeForm();
    } catch (error) {
      console.error('Error saving meal:', error);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteMeal(meal: Meal): Promise<void> {
    if (!confirm(`Delete "${meal.name}"?`)) return;
    
    const success = await this.mealService.deleteMeal(meal.id);
    if (success) {
      this.meals = this.meals.filter(m => m.id !== meal.id);
    }
  }

  async duplicateMeal(meal: Meal): Promise<void> {
    const created = await this.mealService.createMeal({
      name: `${meal.name} (copy)`,
      calories: meal.calories,
      protein: meal.protein,
      fats: meal.fats,
      carbs: meal.carbs
    });
    
    if (created) {
      this.meals.unshift(created);
    }
  }

  get filteredMeals(): Meal[] {
    let result = this.meals;

    // Filter by search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(query));
    }

    return result;
  }

  getAverageCalories(): number {
    if (this.meals.length === 0) return 0;
    const total = this.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    return Math.round(total / this.meals.length);
  }

  getTotalProtein(): number {
    return this.meals.reduce((sum, m) => sum + (m.protein || 0), 0);
  }

  getTotalCarbs(): number {
    return this.meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
  }

  getTotalFats(): number {
    return this.meals.reduce((sum, m) => sum + (m.fats || 0), 0);
  }

  onSearchChange(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }
}
