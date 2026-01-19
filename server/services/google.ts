import crypto from 'crypto';

interface GoogleServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

function base64UrlEncode(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }

  const serviceAccountKey: GoogleServiceAccountKey = JSON.parse(keyJson);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat: now,
  }));

  const signatureInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccountKey.private_key);
  const signatureBase64 = base64UrlEncode(signature);

  const jwt = `${header}.${payload}.${signatureBase64}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await response.json() as { access_token?: string; error?: string; error_description?: string };
  
  if (!tokenData.access_token) {
    console.error('Failed to get Google access token:', tokenData);
    throw new Error(`Failed to get Google access token: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
  }

  return tokenData.access_token;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
}

export async function createCalendarEvent(calendarId: string, event: CalendarEvent): Promise<{ id: string }> {
  const accessToken = await getGoogleAccessToken('https://www.googleapis.com/auth/calendar');

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  const eventData = await response.json() as any;
  
  if (!response.ok) {
    console.error('Calendar API error details:', JSON.stringify(eventData, null, 2));
    throw new Error(eventData.error?.message || 'Failed to create calendar event');
  }

  return { id: eventData.id || '' };
}

export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const accessToken = await getGoogleAccessToken('https://www.googleapis.com/auth/calendar');

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Calendar delete error:', errorData);
    throw new Error('Failed to delete calendar event');
  }
}

export async function appendToSheet(sheetId: string, values: (string | number)[]): Promise<void> {
  const accessToken = await getGoogleAccessToken('https://www.googleapis.com/auth/spreadsheets');

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Sheets API error:', errorData);
    throw new Error('Failed to append to sheet');
  }
}
