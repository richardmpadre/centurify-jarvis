import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class HealthDataService {
  private client = generateClient<Schema>();

  async saveEntry(entry: {
    date: string;
    bp?: string;
    temp?: number;
    strain?: number;
    rhr?: number;
    sleep?: number;
    recovery?: number;
    weight?: number;
    dailyScore?: number;
  }) {
    const { data, errors } = await this.client.models.HealthEntry.create({
      date: entry.date,
      bp: entry.bp,
      temp: entry.temp,
      strain: entry.strain,
      rhr: entry.rhr,
      sleep: entry.sleep,
      recovery: entry.recovery,
      weight: entry.weight,
      dailyScore: entry.dailyScore,
    });

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }

    return data;
  }

  async getAllEntries() {
    const { data, errors } = await this.client.models.HealthEntry.list();

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }

    return data;
  }

  async getEntryByDate(date: string) {
    const { data } = await this.client.models.HealthEntry.list({
      filter: { date: { eq: date } }
    });

    return data?.[0];
  }

  async deleteEntry(id: string) {
    const { errors } = await this.client.models.HealthEntry.delete({ id });

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }
  }
}

