# User Configuration Backend

A Node.js + TypeScript backend with MongoDB for user profile storage.

## Project structure

- `src/`
  - `index.ts` — server bootstrap
  - `app.ts` — Express application setup and middleware registration
- `db/`
  - `mongoose.ts` — MongoDB connection helper
  - `redis.ts` — Redis connection helper
  - `migrationRunner.ts` — migration executor
  - `seed.ts` — data seeder
  - `indexes.ts` — MongoDB index initialization
- `user/`
  - `user.controller.ts`
  - `user.service.ts`
  - `user.routes.ts`
  - `user.repository.ts`
  - `user.schema.ts`
  - `user.interface.ts`
  - `user.constants.ts`
  - `user.utils.ts`
  - `user.docs.ts`
  - `tests/`
    - `user.unit.test.ts`
    - `user.integration.test.ts`

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app in development mode:
   ```bash
   npm run dev
   ```

## Database commands

- Run migrations: `npm run migrate`
- Seed sample data: `npm run seed`

## API endpoints

- `POST /api/users` — create a user
- `GET /api/users` — list users
- `GET /api/users/:id` — retrieve a user
- `PUT /api/users/:id` — update a user

## Validation rules

- `firstName` and `lastName` are required
- `email` has been removed from the user model
- `dateOfBirth` is required and must be a valid date
- `gender` is required and must be `male`, `female`, or `other`
