# Baladiya Reporting Agent

ADK-powered conversational agent for the Qatar Baladiya civic-reporting app.
Built with Google's Agent Development Kit + Gemini 2.5 Flash (vision), wrapped
in a FastAPI server for the React frontend to call.

## Pilot scope

| Category       | Routed to                                 |
| -------------- | ----------------------------------------- |
| `pothole`      | Roads & Infrastructure Department         |
| `falling_tree` | Parks & Public Vegetation Department      |

Anything else → agent politely declines and does **not** create a ticket.

## Project layout

```
agent/
├── baladiya_agent/        # ADK agent + tools + prompts
│   ├── agent.py           # root_agent (LlmAgent with create_ticket tool)
│   ├── prompts.py         # bilingual system instruction
│   └── tools.py           # create_ticket → SQLite (local POC store)
├── server/
│   └── main.py            # FastAPI wrapper (REST endpoints for the frontend)
├── tickets.db             # auto-created on first ticket (SQLite, gitignored)
├── requirements.txt
├── Dockerfile             # for Cloud Run later
└── .env.example
```

## Quickstart — local POC (no GCP needed)

### 1. Install Python deps

```bash
cd agent
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### 2. Get a free Google AI Studio API key

Go to **https://aistudio.google.com/app/apikey** → "Create API key". Copy it.

Open `.env` (already created) and replace `paste-your-aistudio-key-here` with your key:

```
GOOGLE_API_KEY=AIza...
```

### 3. Run the server

```bash
uvicorn server.main:app --reload --port 8000
```

Open http://localhost:8000/api/health → `{"ok":true,"app":"baladiya"}`.
Tickets persist in `agent/tickets.db` (SQLite). Inspect them with any SQLite
browser, or:

```bash
python -c "from baladiya_agent.tools import list_tickets; import json; print(json.dumps(list_tickets(), indent=2))"
```

## REST API contract (for the React frontend)

### `POST /api/report/start` — multipart form

| Field      | Type   | Notes                            |
| ---------- | ------ | -------------------------------- |
| email      | string | Reporter email (used as user_id) |
| latitude   | float  | GPS lat from device              |
| longitude  | float  | GPS lng from device              |
| image      | file   | The captured photo               |

Response:
```json
{
  "session_id": "abc123...",
  "reply": "I detected a pothole. How deep does it look — small, medium, or severe?",
  "ticket": null
}
```

### `POST /api/report/{session_id}/message` — JSON

```json
{ "email": "user@example.com", "message": "Yes, submit it." }
```

When the user confirms, the agent calls `create_ticket` and the result
appears in `ticket`:

```json
{
  "session_id": "abc123...",
  "reply": "Your report has been filed. Ticket BLD-7F3A2C19 was routed to the Roads & Infrastructure Department.",
  "ticket": {
    "ticket_id": "BLD-7F3A2C19",
    "category": "pothole",
    "severity": "medium",
    "department": "Roads & Infrastructure Department",
    "status": "investigating",
    "location": { "latitude": 25.286, "longitude": 51.534 },
    "created_at": "2026-04-26T11:22:33+00:00"
  }
}
```

## Switching to Vertex AI later (for Cloud Run deploy)

When you're ready to leave local mode:

1. In `.env`, set `GOOGLE_GENAI_USE_VERTEXAI=TRUE` + `GOOGLE_CLOUD_PROJECT=...`
   + `GOOGLE_CLOUD_LOCATION=us-central1`. Comment out `GOOGLE_API_KEY`.
2. `gcloud auth application-default login`
3. `gcloud services enable aiplatform.googleapis.com`
4. To replace SQLite with Firestore, uncomment the `google-cloud-firestore`
   line in `requirements.txt` and swap `tools.py` back to the Firestore client
   (the previous version is in git history).
5. Deploy:
   ```bash
   gcloud run deploy baladiya-agent --source . --region me-central2 \
     --allow-unauthenticated \
     --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1
   ```

## Known limitations / next steps

- **Sessions** are in-memory — restart the server, they're gone (the SQLite
  ticket records survive). Swap `InMemorySessionService` for a DB-backed one
  when you go to production.
- **Image storage** isn't persisted; only the analysis + GPS land in SQLite.
  Add a GCS upload (or local `uploads/` folder) in `start_report` if you need
  audit copies.
- **Auth** is email-only (no verification). Wire Firebase Auth before launch.
- **Categories** live in `tools.py` (`CATEGORY_DEPARTMENTS`) and the prompt's
  SCOPE section — extend both together.
