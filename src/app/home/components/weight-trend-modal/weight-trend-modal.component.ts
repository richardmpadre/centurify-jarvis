import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthEntry } from '../../../models/health.models';

export type TimeRange = '7' | '30' | '90';

interface WeightDataPoint {
  date: string;
  weight: number;
  displayDate: string;
}

interface WeightStats {
  current: number | null;
  change: number | null;
  changePercent: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  dataPoints: number;
}

@Component({
  selector: 'app-weight-trend-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weight-trend-modal.component.html',
  styleUrl: './weight-trend-modal.component.css'
})
export class WeightTrendModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() allEntries: HealthEntry[] = [];
  
  @Output() close = new EventEmitter<void>();
  
  selectedRange: TimeRange = '30';
  weightData: WeightDataPoint[] = [];
  stats: WeightStats = {
    current: null,
    change: null,
    changePercent: null,
    average: null,
    min: null,
    max: null,
    dataPoints: 0
  };
  
  // SVG chart dimensions
  readonly chartWidth = 320;
  readonly chartHeight = 180;
  readonly chartPadding = { top: 20, right: 20, bottom: 30, left: 45 };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.processWeightData();
    }
    if (changes['allEntries'] && this.isOpen) {
      this.processWeightData();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  selectRange(range: TimeRange): void {
    this.selectedRange = range;
    this.processWeightData();
  }

  private processWeightData(): void {
    const days = parseInt(this.selectedRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Filter entries with weight data within the date range
    const filteredEntries = this.allEntries
      .filter(entry => {
        if (!entry.weight) return false;
        const entryDate = new Date(entry.date);
        return entryDate >= cutoffDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Convert to data points
    this.weightData = filteredEntries.map(entry => ({
      date: entry.date,
      weight: entry.weight!,
      displayDate: this.formatDisplayDate(entry.date)
    }));
    
    // Calculate stats
    this.calculateStats();
  }

  private formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private calculateStats(): void {
    if (this.weightData.length === 0) {
      this.stats = {
        current: null,
        change: null,
        changePercent: null,
        average: null,
        min: null,
        max: null,
        dataPoints: 0
      };
      return;
    }

    const weights = this.weightData.map(d => d.weight);
    const current = weights[weights.length - 1];
    const first = weights[0];
    const change = current - first;
    const changePercent = (change / first) * 100;
    const average = weights.reduce((a, b) => a + b, 0) / weights.length;
    
    this.stats = {
      current,
      change,
      changePercent,
      average,
      min: Math.min(...weights),
      max: Math.max(...weights),
      dataPoints: weights.length
    };
  }

  // SVG Chart Methods
  get innerWidth(): number {
    return this.chartWidth - this.chartPadding.left - this.chartPadding.right;
  }

  get innerHeight(): number {
    return this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
  }

  get yMin(): number {
    if (this.weightData.length === 0) return 0;
    const min = Math.min(...this.weightData.map(d => d.weight));
    return Math.floor(min - 2); // Add padding below
  }

  get yMax(): number {
    if (this.weightData.length === 0) return 100;
    const max = Math.max(...this.weightData.map(d => d.weight));
    return Math.ceil(max + 2); // Add padding above
  }

  getXPosition(index: number): number {
    if (this.weightData.length <= 1) return this.chartPadding.left + this.innerWidth / 2;
    const step = this.innerWidth / (this.weightData.length - 1);
    return this.chartPadding.left + index * step;
  }

  getYPosition(weight: number): number {
    const range = this.yMax - this.yMin;
    if (range === 0) return this.chartPadding.top + this.innerHeight / 2;
    const normalized = (weight - this.yMin) / range;
    return this.chartPadding.top + this.innerHeight * (1 - normalized);
  }

  get linePath(): string {
    if (this.weightData.length === 0) return '';
    
    const points = this.weightData.map((d, i) => {
      const x = this.getXPosition(i);
      const y = this.getYPosition(d.weight);
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }

  get areaPath(): string {
    if (this.weightData.length === 0) return '';
    
    const points = this.weightData.map((d, i) => {
      const x = this.getXPosition(i);
      const y = this.getYPosition(d.weight);
      return `${x},${y}`;
    });
    
    const firstX = this.getXPosition(0);
    const lastX = this.getXPosition(this.weightData.length - 1);
    const bottomY = this.chartPadding.top + this.innerHeight;
    
    return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
  }

  get yAxisLabels(): { value: number; y: number }[] {
    const range = this.yMax - this.yMin;
    const step = Math.ceil(range / 4);
    const labels: { value: number; y: number }[] = [];
    
    for (let i = 0; i <= 4; i++) {
      const value = this.yMin + step * i;
      if (value <= this.yMax) {
        labels.push({
          value,
          y: this.getYPosition(value)
        });
      }
    }
    
    return labels;
  }

  get xAxisLabels(): { label: string; x: number }[] {
    if (this.weightData.length === 0) return [];
    
    // Show first, middle, and last labels
    const labels: { label: string; x: number }[] = [];
    
    if (this.weightData.length >= 1) {
      labels.push({
        label: this.weightData[0].displayDate,
        x: this.getXPosition(0)
      });
    }
    
    if (this.weightData.length >= 3) {
      const midIndex = Math.floor(this.weightData.length / 2);
      labels.push({
        label: this.weightData[midIndex].displayDate,
        x: this.getXPosition(midIndex)
      });
    }
    
    if (this.weightData.length >= 2) {
      labels.push({
        label: this.weightData[this.weightData.length - 1].displayDate,
        x: this.getXPosition(this.weightData.length - 1)
      });
    }
    
    return labels;
  }

  getChangeClass(): string {
    if (this.stats.change === null) return '';
    // Lower weight = good (green), higher weight = neutral/warning
    return this.stats.change <= 0 ? 'positive' : 'negative';
  }

  formatChange(): string {
    if (this.stats.change === null) return '--';
    const sign = this.stats.change >= 0 ? '+' : '';
    return `${sign}${this.stats.change.toFixed(1)} lbs`;
  }

  formatChangePercent(): string {
    if (this.stats.changePercent === null) return '';
    const sign = this.stats.changePercent >= 0 ? '+' : '';
    return `(${sign}${this.stats.changePercent.toFixed(1)}%)`;
  }
}
