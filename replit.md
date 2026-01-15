# MedBook - Medical Appointment Booking System

## Overview
MedBook is a medical appointment booking system designed for doctors in Armenia. It features:
- Doctor appointment management dashboard
- Telegram bot integration for patient bookings
- Multi-language support (Armenian/Russian)
- Google Calendar/Sheets synchronization (planned)

## Architecture

### Backend
- **Express.js** server with session-based authentication
- **PostgreSQL** database with Drizzle ORM
- **bcryptjs** for password hashing

### Frontend
- **React** with TypeScript
- **Vite** for development/bundling
- **TanStack Query** for data fetching
- **shadcn/ui** components with Tailwind CSS
- **wouter** for routing (partially migrated from react-router-dom)

## Project Structure
```
├── server/           # Express backend
│   ├── index.ts      # Entry point
│   ├── routes.ts     # API routes
│   ├── storage.ts    # Database storage layer
│   ├── db.ts         # Database connection
│   └── vite.ts       # Vite dev server integration
├── shared/
│   └── schema.ts     # Drizzle schema (shared types)
├── src/              # React frontend
│   ├── components/   # UI components
│   ├── hooks/        # Custom hooks
│   ├── pages/        # Page components
│   ├── lib/          # Utilities
│   └── contexts/     # React contexts
└── supabase/         # Legacy Supabase functions (to be ported)
```

## Database Schema
- **users**: Authentication accounts
- **doctor**: Doctor profiles linked to users
- **services**: Services offered by doctors
- **patients**: Patient records (via Telegram)
- **appointments**: Booking records
- **blocked_days**: Days unavailable for booking
- **telegram_sessions**: Telegram bot session state

## API Endpoints
- `POST /api/auth/register` - Register new user + doctor
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/doctor` - Get doctor profile
- `PATCH /api/doctor/:id` - Update doctor profile
- `GET/POST /api/services` - Services CRUD
- `GET/POST/PATCH/DELETE /api/appointments` - Appointments CRUD
- `GET/POST/DELETE /api/blocked-days` - Blocked days management

## Development Commands
```bash
npm run dev          # Start development server
npm run db:push      # Push schema to database
npm run build        # Build for production
```

## Migration Status
- [x] Database schema created
- [x] Express server with authentication
- [x] Core API routes
- [x] Frontend auth hooks migrated
- [ ] Calendar components fully migrated
- [ ] Settings/Patients views migrated
- [ ] Telegram webhook ported
- [ ] Google Calendar sync ported

## User Preferences
- Interface languages: Armenian (ARM), Russian (RU)
- Medical professional theme with teal/blue colors
