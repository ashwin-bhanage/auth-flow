# AuthFlow

A vanilla JavaScript authentication app built against the [FreeAPI](https://freeapi.app) auth module.

## Features

- Register, login, logout
- Session persistence via `sessionStorage` (Bearer token)
- Current user profile display
- Raw API response viewer
- Loading states, toast notifications, skeleton screens

## Stack

Plain HTML, CSS, JavaScript — no frameworks, no build step.

## Run Locally

```bash
# Any static file server works — example using VS Code Live Server
# or:
npx serve .
```

Open `http://localhost:3000`.

## API Endpoints Used

| Method | Endpoint |
|--------|----------|
| POST | `/api/v1/users/register` |
| POST | `/api/v1/users/login` |
| POST | `/api/v1/users/logout` |
| GET  | `/api/v1/users/current-user` |

Base URL: `https://api.freeapi.app`

## Auth Flow

1. Login → API returns `accessToken` in response body
2. Token stored in `sessionStorage` (cleared on tab close)
3. Every request sends `Authorization: Bearer <token>`
4. On page load, `/current-user` is hit to restore session — redirects to login if token is missing or expired

> `credentials: 'include'` is intentionally not used. FreeAPI returns `Access-Control-Allow-Origin: *` which is incompatible with credentialed requests by browser spec.

## Project Structure

```
├── index.html   # markup + view structure
├── style.css    # all styles
├── app.js       # state, API layer, auth handlers, render logic
└── README.md
```