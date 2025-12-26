# MedBook - Medical Appointment Booking System

A Telegram-based medical appointment booking system with admin panel.

## Features

- Patient booking via Telegram bot
- Admin panel for managing appointments, patients, and settings
- Google Calendar and Google Sheets integration
- Automated reminders (24h and 2h before appointments)
- AI-powered service classification (optional)

## AI Assistant Configuration

The system includes an optional AI assistant that helps classify free-text patient reasons into the appropriate medical service. This is useful when patients choose "Other" and describe their problem in their own words.

### What the AI does

- **Classification only**: The AI analyzes patient descriptions and suggests the most appropriate service from your configured list
- **Duration suggestion**: Suggests appointment duration (30, 60, or 90 minutes)
- **Fallback behavior**: If AI is disabled, not configured, or confidence is low, patients are asked to select a service manually

### What the AI does NOT do

- Does NOT choose time slots
- Does NOT bypass scheduling logic or overlap checks
- Does NOT write directly to Google Calendar or Sheets
- All scheduling uses existing Postgres triggers and RLS

### How to enable

1. Go to **Settings → AI Assistant** in the admin panel
2. Toggle **"Enable AI assistant"** ON
3. Configure:
   - **LLM API Base URL**: e.g., `https://api.deepseek.com/v1` for DeepSeek
   - **LLM API Key**: Your API key (stored securely, not visible after saving)
   - **LLM Model name**: e.g., `deepseek-chat`

### Supported LLM providers

Any OpenAI-compatible API works:
- **DeepSeek**: `https://api.deepseek.com/v1` with model `deepseek-chat`
- **OpenAI**: `https://api.openai.com/v1` with model `gpt-4o-mini`
- **Local LLMs**: Any OpenAI-compatible endpoint

## Telegram Webhook Setup

Set your webhook URL:
```
https://ibaidrkbbpoixnbzpppi.supabase.co/functions/v1/telegram-webhook
```

## Technologies

- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- Supabase (Database, Edge Functions, Auth)

## Development

```sh
npm install
npm run dev
```
