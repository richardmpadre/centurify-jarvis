import { APIGatewayProxyHandler } from 'aws-lambda';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
const CLIENT_ID = 'db961e9c-bf37-41bf-b90c-6d6ea8090eec';
const CLIENT_SECRET = '105f0a59dbbfaf7f5e8dfa58cc93c40ad8fd982a123c71c30a4b16f70d0896ce';

export const handler: APIGatewayProxyHandler = async (event) => {
  // CORS is handled by Lambda Function URL config - only set Content-Type
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    // Route: API Proxy
    if (action === 'api') {
      const { endpoint, accessToken } = body;
      
      if (!endpoint || !accessToken) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing endpoint or accessToken' })
        };
      }

      const fullUrl = `${WHOOP_API_BASE}${endpoint}`;
      console.log('Calling Whoop API:', fullUrl);

      const apiResponse = await fetch(fullUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const responseText = await apiResponse.text();
      console.log('Whoop API response status:', apiResponse.status);
      console.log('Whoop API response:', responseText);

      // Try to parse as JSON, or return error details
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          statusCode: apiResponse.status,
          headers,
          body: JSON.stringify({ 
            error: 'Whoop API error', 
            status: apiResponse.status,
            response: responseText,
            url: fullUrl
          })
        };
      }

      return {
        statusCode: apiResponse.status,
        headers,
        body: JSON.stringify(data)
      };
    }

    // Route: Refresh Token
    if (action === 'refresh') {
      const { refresh_token } = body;
      
      if (!refresh_token) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing refresh_token' })
        };
      }

      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      });

      const refreshResponse = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: refreshParams.toString()
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        return {
          statusCode: refreshResponse.status,
          headers,
          body: JSON.stringify({ error: 'Token refresh failed', details: refreshData })
        };
      }

      return { statusCode: 200, headers, body: JSON.stringify(refreshData) };
    }

    // Route: Token Exchange (default - initial authorization)
    const { code, redirect_uri } = body;

    if (!code || !redirect_uri) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code or redirect_uri' })
      };
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Token exchange failed', details: data })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error: any) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

