import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

export interface WeeklyInsightRecord {
  id?: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  summary?: string;
  weeklyScore?: number;
  trend?: string;
  insights?: string; // JSON string
  generatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeeklyInsightsService {
  constructor() { }

  /**
   * Get weekly insight for a specific week
   */
  async getWeeklyInsight(year: number, weekNumber: number): Promise<WeeklyInsightRecord | null> {
    try {
      const { data: records } = await client.models.WeeklyInsight.list({
        filter: {
          year: { eq: year },
          weekNumber: { eq: weekNumber }
        }
      });
      
      if (records && records.length > 0) {
        const record = records[0];
        return {
          id: record.id,
          year: record.year,
          weekNumber: record.weekNumber,
          startDate: record.startDate,
          endDate: record.endDate,
          summary: record.summary ?? undefined,
          weeklyScore: record.weeklyScore ?? undefined,
          trend: record.trend ?? undefined,
          insights: record.insights ?? undefined,
          generatedAt: record.generatedAt ?? undefined
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching weekly insight:', error);
      return null;
    }
  }

  /**
   * Save or update weekly insight
   */
  async saveWeeklyInsight(insight: WeeklyInsightRecord): Promise<void> {
    try {
      // Check if insight already exists
      const existing = await this.getWeeklyInsight(insight.year, insight.weekNumber);
      
      if (existing?.id) {
        // Update existing
        await client.models.WeeklyInsight.update({
          id: existing.id,
          summary: insight.summary,
          weeklyScore: insight.weeklyScore,
          trend: insight.trend,
          insights: insight.insights,
          generatedAt: new Date().toISOString()
        });
      } else {
        // Create new
        await client.models.WeeklyInsight.create({
          year: insight.year,
          weekNumber: insight.weekNumber,
          startDate: insight.startDate,
          endDate: insight.endDate,
          summary: insight.summary,
          weeklyScore: insight.weeklyScore,
          trend: insight.trend,
          insights: insight.insights,
          generatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving weekly insight:', error);
      throw error;
    }
  }

  /**
   * Get all weekly insights (for history/trends)
   */
  async getAllWeeklyInsights(): Promise<WeeklyInsightRecord[]> {
    try {
      const { data: records } = await client.models.WeeklyInsight.list();
      
      return records.map(record => ({
        id: record.id,
        year: record.year,
        weekNumber: record.weekNumber,
        startDate: record.startDate,
        endDate: record.endDate,
        summary: record.summary ?? undefined,
        weeklyScore: record.weeklyScore ?? undefined,
        trend: record.trend ?? undefined,
        insights: record.insights ?? undefined,
        generatedAt: record.generatedAt ?? undefined
      })).sort((a, b) => {
        // Sort by year desc, then week desc (most recent first)
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      });
    } catch (error) {
      console.error('Error fetching all weekly insights:', error);
      return [];
    }
  }

  /**
   * Delete weekly insight
   */
  async deleteWeeklyInsight(id: string): Promise<void> {
    try {
      await client.models.WeeklyInsight.delete({ id });
    } catch (error) {
      console.error('Error deleting weekly insight:', error);
      throw error;
    }
  }
}
