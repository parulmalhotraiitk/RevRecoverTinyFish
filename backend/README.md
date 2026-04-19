# RevRecover Agent Backend

The orchestration layer responsible for managing the TinyFish Web Agent lifecycle.

## Setup
1. Install dependencies: `npm install`
2. Configure `.env`: Use `.env.example` as a template.
3. Start the server: `node index.js`

## API Endpoints
- `POST /appeal`: Triggers a new TinyFish agent run for a specific claim.
