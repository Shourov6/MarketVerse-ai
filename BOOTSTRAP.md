# Local Bootstrap

Use the canonical cross-platform setup command from the repository root:

```bash
npm run setup
```

It installs the locked dependencies, checks the PostgreSQL connection configured in `.env`, seeds the database, and starts the development server at `http://localhost:5173`.

`npm run dev` alone only starts Vite. It does not install Node.js, PostgreSQL, Docker, Ollama, or model weights.

Requirements:

- Node.js 20 or newer
- A Supabase project (or Docker Desktop with Compose for local PostgreSQL)
- Ollama for the local LLM path; setup pulls `qwen2.5:3b-instruct` and `nomic-embed-text` when Ollama is installed

Set `DATABASE_URL` in `.env` to the PostgreSQL URI from Supabase **Project Settings → Database → Connect**, then run the same command. Add `OPENAI_API_KEY` to `.env` to enable API-backed AI features.

See `DEVELOPER_GUIDE.md` for the project structure, environment reference, daily commands, and troubleshooting.
