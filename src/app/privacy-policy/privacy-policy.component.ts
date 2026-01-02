import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="privacy-container">
      <h1>Privacy Policy</h1>
      <p class="last-updated">Last updated: January 1, 2026</p>

      <section>
        <h2>Overview</h2>
        <p>Jarvis Health Tracker ("we", "our", or "the app") is a personal health tracking application. This privacy policy explains how we handle your data.</p>
      </section>

      <section>
        <h2>Data We Collect</h2>
        <p>When you use Jarvis, we collect:</p>
        <ul>
          <li><strong>Account Information:</strong> Email address for authentication</li>
          <li><strong>Health Data:</strong> Biometric data you manually enter (blood pressure, weight, sleep, etc.)</li>
          <li><strong>Whoop Integration:</strong> If connected, we access your Whoop data including recovery scores, heart rate, HRV, sleep, and workout data</li>
        </ul>
      </section>

      <section>
        <h2>How We Use Your Data</h2>
        <p>Your data is used solely to:</p>
        <ul>
          <li>Display your health metrics within the app</li>
          <li>Store your health history for your personal reference</li>
        </ul>
        <p>We do not sell, share, or use your data for advertising purposes.</p>
      </section>

      <section>
        <h2>Data Storage</h2>
        <p>Your data is stored securely using AWS cloud services:</p>
        <ul>
          <li>Authentication is handled by Amazon Cognito</li>
          <li>Health data is stored in Amazon DynamoDB</li>
          <li>All data is encrypted in transit and at rest</li>
        </ul>
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>If you choose to connect your Whoop account, we access your Whoop data through their official API. We only request the permissions necessary to display your health metrics. You can disconnect Whoop at any time.</p>
      </section>

      <section>
        <h2>Data Deletion</h2>
        <p>You can request deletion of your data at any time by contacting us. Upon deletion, all your stored health data will be permanently removed from our systems.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For questions about this privacy policy or your data, please contact the app administrator.</p>
      </section>
    </div>
  `,
  styles: [`
    .privacy-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1976d2;
      margin-bottom: 0.5rem;
    }
    .last-updated {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    section {
      margin-bottom: 2rem;
    }
    h2 {
      color: #333;
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }
    p, li {
      color: #555;
      line-height: 1.7;
    }
    ul {
      padding-left: 1.5rem;
      margin-top: 0.5rem;
    }
    li {
      margin-bottom: 0.5rem;
    }
  `]
})
export class PrivacyPolicyComponent {}

