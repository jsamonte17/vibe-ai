# Vibe AI

The root `docker-compose.yaml` orchestrates the React + Vite + Refine web app,
NestJS GraphQL API, PostgreSQL, and Qdrant. The API connects to the Ollama
server configured by `OLLAMA_BASE_URL` (the Compose default is the existing
host at ``). Qdrant stores document vectors and metadata in
`./.qdrant-storage`; PostgreSQL stores application records in
`./.data/postgres`. These data directories persist on the host and are excluded
from version control.

## Start the services

From the project root:

```bash
docker compose up --build -d
```

The web app is at `http://localhost:5173`, the GraphQL API at
`http://localhost:3000/graphql`, and Qdrant at `http://localhost:6333`.
Application ports bind to loopback. Ollama runs separately at
`http://172.16.100.201:11434` by default.

The web app follows the IMS React + Vite + Refine pattern and provides a
SmartHR-backed login, an Apollo-powered chat workspace, and a knowledge page
for tagged company facts. The API uses schema-first Apollo GraphQL and Sequelize
with PostgreSQL. Chat conversations and messages are persisted in PostgreSQL
per employee, while assistant replies stream from Ollama over Apollo's
`graphql-ws` subscription. The API development source is bind-mounted for watch
mode and applies pending Sequelize migrations at container startup.

For each message, a configurable Brain model first selects from a small,
server-registered set of actions. The API validates and runs those actions,
then passes their results to the configurable representative model, which
streams the employee-facing answer. The models can be configured independently.
The Brain planner and action handlers are isolated in `api/src/brain/`;
`api/src/chat/` handles conversations, message persistence, and subscriptions.

The actions are a catalog-first database search, lookup of the signed-in
employee's SmartHR profile, and saving user-submitted knowledge. The database
search model selects from tables listed in `BrainDatabaseReferences` before
searching. In this initial version, only `KnowledgeEntries` is an answer
source; the tags and junction tables support that search. The API builds the
SQL itself with fixed tables, columns, and parameterized search terms, in a
read-only transaction with a 3-second timeout and a 20-row result cap.
Knowledge writes are restricted to explicitly requested company-profile
information or resolved issues; they save the user's submitted text rather
than model-generated facts. Attendance and payroll lookups are not connected
yet, and Qdrant/vector retrieval is not connected to chat.

## Configure authentication

The API validates credentials through the VESProfile authentication endpoint,
then retrieves the employee profile from SmartHR. The QA endpoints are set in
the API service environment in `docker-compose.yaml`:

```yaml
VESPROFILE_URL:
SMARTHR_URL:
```

Set these credentials in the project-root `.env` file:

```dotenv
SMARTHR_TOKEN=your-qa-token
SMARTHR_SECURITY_TIMESTAMP=
JWT_SECRET=your-private-signing-secret
JWT_EXPIRES_IN_SECONDS=86400
OLLAMA_BASE_URL=http://172.16.100.201:11434
OLLAMA_CHAT_MODEL=qwen3:4b
OLLAMA_BRAIN_MODEL=qwen3:4b
OLLAMA_REPRESENTATIVE_MODEL=qwen3:4b
OLLAMA_DATABASE_MODEL=qwen3:4b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_REQUEST_TIMEOUT_MS=300000
ADMIN_USERNAMES=jsamonte,ufaustino
```

`OLLAMA_REQUEST_TIMEOUT_MS` controls the API timeout for each Ollama request
(default five minutes), including action planning, database-search planning,
and response generation. Set the Ollama URL and model names in the project-root
`.env` to override the Compose defaults.

Set `SMARTHR_TOKEN` and, if required by the SmartHR environment,
`SMARTHR_SECURITY_TIMESTAMP` to the access values supplied by your
administrator. `JWT_SECRET` must be a strong, private signing secret. The root
`.env` file is ignored by Git and must not be committed. Compose passes these
values to the API container. The API returns an access token after successful
authentication and requires it as a bearer token for knowledge queries and
mutations.

To run either app directly on the host instead of Docker:

```bash
cd api
pnpm install
pnpm start:dev
```

```bash
cd web
pnpm install
pnpm dev
```

For local API development, set `DB_HOST=localhost` and the matching database
credentials. The migration commands are `pnpm db:migrate` and
`pnpm db:migrate:undo` from `api/`.

The initial `ADMIN_USERNAMES` list is applied when the platform settings
migration runs. Administrators can then manage additional admin accounts and
edit the Brain and representative instructions from **Settings**. These
settings and knowledge-base management APIs are restricted to administrators.

The API exposes `health`, `knowledgeEntries`, `knowledgeTags`, `login`, and
`createKnowledgeEntry`, plus employee-scoped chat queries, mutations, and the
`chatUpdate` subscription. After login, send the returned access token in the
`Authorization: Bearer <token>` header for HTTP and WebSocket operations.
Knowledge fragments may include tags:

```graphql
mutation {
  createKnowledgeEntry(
    input: {
      title: "Office hours"
      content: "The office is open from 9 AM to 5 PM."
      tags: ["HR"]
    }
  ) {
    id
    title
    content
  }
}
```

The initial `KnowledgeEntry` model and reversible table migration are in
`api/src/knowledge/` and `api/migrations/`.
Chat data is stored in the `ChatConversations` and `ChatMessages` tables; the
migration is in `api/migrations/`.

## Ollama models

Ollama is hosted separately in this setup. Make sure the configured server has
the chat and embedding models available:

```bash
ollama pull qwen3:4b
ollama pull nomic-embed-text
ollama list
```

If running Ollama in this Compose stack instead, uncomment the `ollama` service
in `docker-compose.yaml`, then pull the models into that container:

```bash
docker compose exec ollama ollama pull qwen3:4b
docker compose exec ollama ollama pull nomic-embed-text
```

The chat model answers questions; the embedding model converts document chunks
and user questions into vectors. Use the same embedding model for indexing and
querying. Document-vector retrieval is not yet connected to chat.

## Stop services

Run `docker compose down`. The host data directories remain so models and
Qdrant data survive container removal.
