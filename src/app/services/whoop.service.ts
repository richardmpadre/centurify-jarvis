import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WhoopService {
  private clientId = 'db961e9c-bf37-41bf-b90c-6d6ea8090eec';
  private redirectUri = 'http://localhost:4200/whoop/callback';
  private authUrl = 'https://api.prod.whoop.com/oauth/oauth2/auth';
  private apiBaseUrl = 'https://api.prod.whoop.com/developer/v2';
  
  // Lambda function URL - will be set from amplify_outputs.json
  private lambdaTokenUrl: string | null = null;
  private lambdaUrlLoaded = false;

  private readonly TOKEN_KEY = 'whoop_token';
  private readonly TOKEN_EXPIRY_KEY = 'whoop_token_expiry';
  private readonly REFRESH_TOKEN_KEY = 'whoop_refresh_token';
  
  // Refresh 5 minutes before expiry
  private readonly EXPIRY_BUFFER_MS = 5 * 60 * 1000;
  
  // Track if we're currently refreshing to avoid duplicate calls
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadLambdaUrl();
    // Proactively refresh token on startup if needed
    await this.ensureValidToken();
  }

  private async loadLambdaUrl() {
    if (this.lambdaUrlLoaded) return;
    try {
      const outputs: any = await import('../../../amplify_outputs.json');
      const customOutputs = outputs.default?.custom || outputs.custom;
      this.lambdaTokenUrl = customOutputs?.whoopAuthApiUrl || null;
      this.lambdaUrlLoaded = true;
      console.log('Whoop Lambda URL loaded:', this.lambdaTokenUrl ? 'Yes' : 'No');
    } catch (e) {
      console.log('amplify_outputs.json not found - run npx ampx sandbox first');
    }
  }

  // Initiate OAuth flow - redirects user to Whoop
  initiateAuth(): void {
    const scope = 'read:profile read:recovery read:sleep read:workout read:cycles read:body_measurement';
    const state = this.generateState();
    
    sessionStorage.setItem('whoop_oauth_state', state);
    
    const authParams = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scope,
      state: state
    });

    window.location.href = `${this.authUrl}?${authParams.toString()}`;
  }

  // Handle OAuth callback
  async handleCallback(code: string, state: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const savedState = sessionStorage.getItem('whoop_oauth_state');
    
    if (state !== savedState) {
      return { success: false, error: 'State mismatch - possible CSRF attack' };
    }

    sessionStorage.removeItem('whoop_oauth_state');

    try {
      const tokenResponse = await this.exchangeCodeForToken(code);
      
      if (tokenResponse.access_token) {
        this.saveToken(tokenResponse);
        return { success: true, data: tokenResponse };
      } else {
        return { success: false, error: 'No access token received' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Token exchange failed' };
    }
  }

  // Exchange authorization code for access token via Lambda
  private async exchangeCodeForToken(code: string): Promise<any> {
    // Wait for Lambda URL to load
    if (!this.lambdaTokenUrl) {
      await this.loadLambdaUrl();
    }

    if (!this.lambdaTokenUrl) {
      throw new Error('Lambda URL not configured. Run "npx ampx sandbox" to deploy the backend.');
    }

    console.log('Exchanging code for token via Lambda...');
    console.log('Lambda URL:', this.lambdaTokenUrl);
    console.log('Redirect URI:', this.redirectUri);

    try {
      const response = await fetch(this.lambdaTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: this.redirectUri
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange error:', errorData);
        throw new Error(`Token exchange failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Token received successfully');
      return data;
    } catch (error: any) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  // Save token to localStorage
  private saveToken(tokenData: any): void {
    console.log('Saving Whoop token, expires_in:', tokenData.expires_in);
    localStorage.setItem(this.TOKEN_KEY, tokenData.access_token);
    
    const expiryTime = Date.now() + (tokenData.expires_in * 1000);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    // Whoop returns a new refresh token with each refresh - always save it
    if (tokenData.refresh_token) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, tokenData.refresh_token);
      console.log('Refresh token saved');
    }
  }

  // Check if token is expired or about to expire
  private isTokenExpiredOrExpiring(): boolean {
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    
    // Consider expired if within buffer time of expiry
    return Date.now() > (parseInt(expiry) - this.EXPIRY_BUFFER_MS);
  }

  // Get stored access token (checks expiry)
  getAccessToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;
    
    // Return null if expired or about to expire
    if (this.isTokenExpiredOrExpiring()) {
      console.log('Whoop access token expired or expiring soon');
      return null;
    }
    
    return token;
  }

  // Ensure we have a valid token, refreshing if needed
  async ensureValidToken(): Promise<boolean> {
    const token = this.getAccessToken();
    if (token) return true;
    
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }
    
    try {
      await this.refreshAccessToken(refreshToken);
      return true;
    } catch (error) {
      console.error('Failed to refresh Whoop token:', error);
      return false;
    }
  }

  // Get valid access token, refreshing if needed
  private async getValidAccessToken(): Promise<string | null> {
    // First check if we have a valid token
    let token = this.getAccessToken();
    if (token) return token;
    
    // Try to refresh using refresh token
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      console.log('No Whoop refresh token - need to reconnect');
      return null;
    }
    
    try {
      console.log('Whoop access token expired, refreshing...');
      await this.refreshAccessToken(refreshToken);
      token = this.getAccessToken();
      return token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearToken();
      return null;
    }
  }

  // Refresh access token using refresh token
  private async refreshAccessToken(refreshToken: string): Promise<void> {
    // Avoid duplicate refresh calls
    if (this.refreshPromise) {
      console.log('Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }
    
    this.refreshPromise = this.doRefreshToken(refreshToken);
    
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
  
  private async doRefreshToken(refreshToken: string): Promise<void> {
    if (!this.lambdaTokenUrl) {
      await this.loadLambdaUrl();
    }

    if (!this.lambdaTokenUrl) {
      throw new Error('Lambda URL not configured');
    }

    console.log('Calling Lambda to refresh Whoop token...');
    
    const response = await fetch(this.lambdaTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh',
        refresh_token: refreshToken
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Whoop token refresh failed:', responseData);
      // If refresh token is invalid, clear everything
      if (response.status === 400 || response.status === 401) {
        console.log('Refresh token invalid, clearing tokens');
        this.clearToken();
      }
      throw new Error(`Token refresh failed: ${JSON.stringify(responseData)}`);
    }

    this.saveToken(responseData);
    console.log('Whoop token refreshed successfully');
  }

  // Check if connected (has valid token or refresh token)
  isConnected(): boolean {
    const hasToken = this.getAccessToken() !== null;
    const hasRefreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY) !== null;
    const connected = hasToken || hasRefreshToken;
    console.log(`Whoop connected check: token=${hasToken}, refreshToken=${hasRefreshToken}, connected=${connected}`);
    return connected;
  }

  // Clear token (disconnect)
  clearToken(): void {
    console.log('Clearing all Whoop tokens');
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  // Get user profile
  async getProfile(): Promise<any> {
    return this.apiRequest('/user/profile/basic');
  }

  // Get recovery data for a date range
  async getRecovery(startDate: string, endDate: string): Promise<any> {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;
    return this.apiRequest(`/recovery?start=${start}&end=${end}&limit=25`);
  }

  // Get sleep data for a date range
  async getSleep(startDate: string, endDate: string): Promise<any> {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;
    return this.apiRequest(`/activity/sleep?start=${start}&end=${end}&limit=25`);
  }

  // Get workout data for a date range
  async getWorkouts(startDate: string, endDate: string): Promise<any> {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;
    return this.apiRequest(`/activity/workout?start=${start}&end=${end}&limit=25`);
  }

  // Get cycle (strain) data for a date range
  async getCycles(startDate: string, endDate: string): Promise<any> {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;
    return this.apiRequest(`/cycle?start=${start}&end=${end}&limit=25`);
  }

  // Generic API request via Lambda proxy
  private async apiRequest(endpoint: string): Promise<any> {
    // Get valid token (auto-refreshes if expired)
    const token = await this.getValidAccessToken();
    
    if (!token) {
      throw new Error('Not authenticated with Whoop. Please reconnect.');
    }

    if (!this.lambdaTokenUrl) {
      await this.loadLambdaUrl();
    }

    if (!this.lambdaTokenUrl) {
      throw new Error('Lambda URL not configured');
    }

    // Use Lambda proxy to avoid CORS
    const response = await fetch(this.lambdaTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'api',
        endpoint: endpoint,
        accessToken: token
      })
    });

    const data = await response.json();
    console.log('Lambda response:', response.status, JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('API error details:', data);
      if (response.status === 401) {
        // Try refresh one more time
        const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
        if (refreshToken) {
          try {
            console.log('Got 401, attempting token refresh...');
            await this.refreshAccessToken(refreshToken);
            return this.apiRequest(endpoint); // Retry with new token
          } catch {
            this.clearToken();
          }
        }
        throw new Error('Authentication expired. Please reconnect.');
      }
      throw new Error(`API request failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data;
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}


