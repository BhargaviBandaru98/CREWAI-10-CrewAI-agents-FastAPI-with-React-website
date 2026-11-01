# CREWAI: 10 AI Agent Projects with CrewAI

A REST API built with **FastAPI** and **CrewAI**. It serves 10 multi-agent projects (4 Crews and 6 Flows), each on its own route from `/agent1` to `/agent10`. Everything runs on free tools: the **Gemini API free tier**, DuckDuckGo search, and the open-source `crewai_tools`.

| Route | Project | Type | Pattern |
|---|---|---|---|
| `POST /agent1` | Blog Post Crew | Crew | Sequential |
| `POST /agent2` | Competitor Analysis Crew | Crew | Hierarchical (`manager_llm`) |
| `POST /agent3` | Meeting Notes Crew | Crew | Parallel tasks (`async_execution=True`) |
| `POST /agent4` | Data Report Crew | Crew | Structured output (`output_pydantic`) |
| `POST /agent5` | Customer Support Flow | Flow | Router, direct LLM calls |
| `POST /agent6` | Resume Screening Flow | Flow | Router + Summary Crew |
| `POST /agent7` | Bug Triage Flow | Flow + Crews | Router |
| `POST /agent8` | Content Repurposing Flow | Flow + Crews | Parallel + `and_` |
| `POST /agent9` | Lead Qualification Flow | Flow + Crews | Router |
| `POST /agent10` | Approval Report Flow | Flow + Crews | `@human_feedback` |

Interactive docs, where you can try every route in the browser: **`/docs`**

**Website:** the same server also serves a React website at **`/`**. You pick a project, fill in its form, get the real result, and explore an interactive workflow of how the backend produced it, guided by **CrewBot**, an animated mascot.

---

## Quick start (local)

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then put your key in .env
uvicorn app:app --reload
```

Open http://127.0.0.1:8000/docs. Python 3.10–3.13 is required (CrewAI does not support 3.14 yet).

Get a free Gemini API key at https://aistudio.google.com/apikey and set it as `GEMINI_API_KEY`.

---

## Response format (same for every route)

```json
{
  "agent": "agent5",
  "project": "Customer Support Flow",
  "status": "completed",            // or "pending_review" (agent10 only)
  "run_id": "20261101-045515-d9de92",
  "duration_seconds": 16.3,
  "steps": ["receive_ticket", "categorize_ticket (direct LLM call)", "..."],
  "result": { "...project-specific, validated by Pydantic..." },
  "files": { "blog_post.md": "...file content..." }
}
```

- `steps` shows which agents or flow steps actually ran, in order (useful for a UI).
- `files` returns the content of every file the project saved. Files are also written to `outputs/<agent>/<run_id>/`.
- Bad input returns **422** with a clear message. An LLM or tool failure returns **502**.

---

## The 10 agents

### 01 Blog Post Crew: `POST /agent1` (sequential)
**Problem:** Writing a well-researched blog post takes hours for every topic.
**Flow:** Researcher (DuckDuckGo search) → Writer (600-word draft) → Editor (fixes tone and facts) → `blog_post.md` (FileWriterTool)

```json
{ "topic": "AI in farming", "target_audience": "small farm owners" }
```
**Result:** `title`, `word_count`, `blog_post` (Markdown), `research_notes`, `sources` (only URLs the search really returned).

### 02 Competitor Analysis Crew: `POST /agent2` (hierarchical)
**Problem:** Tracking what competitors ship, charge and say takes hours every week.
**Flow:** a Manager agent (`manager_llm`) splits the work and delegates to the Site Scraper (ScrapeWebsiteTool), the Pricing Analyst, the News Analyst (DuckDuckGo) and the Strategist (SWOT table) → `report.md`

```json
{ "competitors": ["https://www.notion.so", "https://www.clickup.com", "https://asana.com"],
  "your_company": "optional: your product, for tailored recommendations" }
```
Exactly 3 URLs are required. **Result:** `report` (summary, comparison table, a SWOT table per competitor, news, recommendations), `websites_read` (whether each site was really scraped), `sources_used`.
Missing data is reported as "not found on site" or "No verified news found". It is never filled in from the model's memory.

### 03 Meeting Notes Crew: `POST /agent3` (parallel tasks, multipart form)
**Problem:** After every meeting someone must write the summary and chase action items.
**Flow:** `transcript.txt` (FileReadTool) → **Summarizer | Action Finder | Decision Logger run in parallel** (`async_execution=True`) → the Formatter waits for all three → `notes.md`

| Form field | |
|---|---|
| `transcript_text` *or* `transcript_file` | pasted text, or a `.txt` / `.md` / `.vtt` file |
| `meeting_title` | optional |

**Result:** `summary` (5 lines), `action_items` (task, owner, due date), `decisions`, `notes_markdown`.

### 04 Data Report Crew: `POST /agent4` (structured output, multipart form)
**Problem:** Turning weekly sales CSVs into a readable report is slow, repetitive work.
**Flow:** `sales.csv` (FileReadTool + a custom **pandas tool**) → Data Analyst (`output_pydantic` stats) → Insight Writer (top 3 findings) → Reviewer (re-checks every number with the tool) → `report.md`

| Form field | |
|---|---|
| `csv_text` *or* `csv_file` | CSV with a header row |
| `report_title` | optional |

**Result:** `stats` (Pydantic), `top_findings` (3), `review` (`report_markdown`, `corrections_made`, `all_numbers_verified`), and `computed_stats` (the ground-truth numbers computed by pandas).
The pandas tool works on any sales CSV. It detects the revenue column (or computes quantity × price), the date column and the category columns automatically.

### 05 Customer Support Flow: `POST /agent5` (router, no Crew)
**Problem:** Support tickets arrive mixed together and must be sorted and sent to the right person.
**Flow:** `receive_ticket` → `categorize_ticket` (direct LLM call) → `@router route_by_category` → `handle_billing` / `handle_access` (priority = high) / `handle_other` (technical, feature, other) → `or_` → `resolve_ticket`

```json
{ "customer_name": "Priya Sharma", "issue_description": "I was charged twice for my subscription this month." }
```
**Result:** `ticket_id`, `category`, `route`, `priority`, `handled_by`, `resolution` (customer reply, internal next steps, whether to escalate).

### 06 Resume Screening Flow: `POST /agent6` (router + Crew, multipart form)
**Problem:** One job post brings hundreds of resumes, and reading them takes days.
**Flow (one run per resume):** `load_resumes` (FileReadTool / pypdf) → `score_resume` (direct LLM call, 0–10) → `@router check_score` → **shortlist**: Summary Crew (strengths and gaps) | **reject**: `draft_rejection` (polite email) → `or_` → `save_results` → `results.csv`

| Form field | |
|---|---|
| `job_description` | required |
| `resumes` | up to 10 files (`.pdf`, `.txt`, `.md`) |
| `resume_text` | or paste one resume |
| `threshold` | shortlist if score ≥ threshold (default 7) |

**Result:** totals, plus for each candidate: `score`, `decision`, `reasoning`, `matched_skills`, `missing_skills`, and a `summary` or `rejection_email`. Also `results.csv`.

### 07 Bug Triage Flow: `POST /agent7` (router + Crews)
**Problem:** Unlabeled issues pile up, and urgent bugs sit next to feature requests.
**Flow:** `read_issue` → `classify_issue` (direct LLM call) → `@router route_type` → **bug**: Bug Crew (severity, reproduction steps) | **feature**: Feature Crew (user story) | **question**: Answer Crew (reads the docs with ScrapeWebsiteTool) → `or_` → `post_reply`

```json
{ "title": "App crashes when uploading a PNG larger than 5 MB",
  "body": "Steps: open the editor, click Upload, choose a 6 MB PNG...",
  "docs_url": "https://github.com/crewAIInc/crewAI" }
```
**Result:** `issue_type`, `labels` (e.g. `bug`, `severity: high`), and a ready-to-post `comment` in Markdown, plus the full `analysis`. The reply is returned, not posted to any tracker.

### 08 Content Repurposing Flow: `POST /agent8` (parallel + `and_`, multipart form)
**Problem:** Turning one article into a LinkedIn post, a tweet thread and a newsletter wastes a day.
**Flow:** `load_article` (URL via ScrapeWebsiteTool, or text) → `extract_points` (direct LLM call) → **LinkedIn Crew | Twitter Crew | Newsletter Crew run side by side** → `and_` → `publish_pack` (3 files)

| Form field | |
|---|---|
| `article_url` *or* `article_text` *or* `article_file` | one of them |

**Result:** `key_points`, `linkedin_post` (hook, ~150 words, hashtags), `twitter_thread` (6 tweets, each under 280 characters), `newsletter` (subject, intro, 3 bullets). Files: `linkedin_post.md`, `twitter_thread.md`, `newsletter.md`.

### 09 Lead Qualification Flow: `POST /agent9` (router + Crews)
**Problem:** Sales teams waste time on cold leads while hot leads wait days for a reply.
**Flow:** `capture_lead` → Enrich Crew (scrapes the website) → `@router score_lead` (0–100: ≥70 hot, 40–69 warm, <40 cold) → **hot**: Outreach Crew (personal email) | **warm**: `add_to_nurture` (weekly tips list) | **cold**: `archive_lead` → `or_` → `log_lead` → `leads.csv`

```json
{ "name": "Rahul Verma", "company_website": "https://example.com", "email": "rahul@example.com",
  "notes": "Asked about pricing on the demo form",
  "product_description": "An AI tool that automates invoice processing for small businesses",
  "ideal_customer_profile": "Businesses with 10-200 staff handling 100+ invoices a month" }
```
**Result:** `company_profile`, `website_read`, `score`, `tier`, `score_reasoning`, `action`, and `outreach_email` (for hot leads). `leads.csv` and `nurture_list.csv` grow with every lead.

### 10 Approval Report Flow: `POST /agent10` (human feedback)
**Problem:** Auto-generated reports are risky to publish unchecked.
**Flow:** `collect_topic` → Research Crew (Lead Researcher, Fact Checker, Source Curator) → Writing Crew → **`@human_feedback review_draft`** → `@router check_decision` → **approved**: `publish_report` (`final.md`) | **revise**: Revision Crew → back to review

A person can't reply in the middle of an HTTP request, so the flow **pauses** (saved in SQLite) and is resumed by a second call:

```json
// 1. Start: returns status "pending_review", the draft and a flow_id
{ "topic": "Impact of AI on healthcare jobs", "audience": "hospital managers" }

// 2a. Ask for changes: returns a revised draft, still "pending_review" (up to 3 revisions)
{ "flow_id": "<from step 1>", "decision": "revise", "notes": "Add a section on training costs" }

// 2b. Approve: returns status "completed" and final.md
{ "flow_id": "<from step 1>", "decision": "approved" }
```
Sources in the report are kept only if the search tool really returned them. If search finds nothing, the report says "No verified sources".

---

## The website (`frontend/`)

A React + TypeScript + Tailwind + GSAP single-page app. FastAPI serves the built files from `frontend/dist`, so **one Render service hosts both the website and the API**. The website calls the API with relative paths (`/agent5`), so it works on any domain.

| Part | What it does |
|---|---|
| Home page | Hero, scrolling project and concept marquee, the 10 project cards (filter Crews / Flows), "How it works", Crews vs Flows with a live workflow explorer |
| Project pages `/projects/<name>` | Intro (problem, benefits, how to use), a form built for that endpoint, a result view built for that project, the workflow explorer, and docs (simple + technical) |
| Workflow explorer | Nodes match the backend code. **How it works** is an educational walkthrough (click, Next / Previous, Play tour). **Your run** highlights the nodes that really ran, using the `steps` list from the API response (e.g. which router branch was taken). It is not a live trace, and the page says so. |
| CrewBot | SVG + GSAP mascot with 9 states (idle, wave, move, look, point, think, explain, celebrate, react). It travels in its own **reserved rail** on large screens and in its own lane inside each workflow, so it never covers content. On phones it appears in small inline rows. It can be paused or hidden, and it respects the OS "reduce motion" setting. |
| Themes | Dark (default) and light, remembered per browser |

Project names on the site: Blog Post Studio (`/agent1`), Competitor Radar (`/agent2`), Meeting Notes Assistant (`/agent3`), Sales Report Analyst (`/agent4`), Support Ticket Desk (`/agent5`), Resume Screener (`/agent6`), Issue Triage Bot (`/agent7`), Content Remixer (`/agent8`), Lead Scout (`/agent9`), Report Approval Desk (`/agent10`).

### Frontend development

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (API calls are proxied to http://127.0.0.1:8000)
npm run build      # writes frontend/dist, which FastAPI serves
```

`frontend/dist` is committed on purpose, so Render needs no Node.js build. **After changing the frontend, run `npm run build` and commit `frontend/dist`.** To host the website elsewhere, set `VITE_API_BASE_URL=https://your-api.onrender.com` before building.

## How it works

- **LLM:** Gemini through CrewAI's native provider. A small `ResilientGemini` subclass retries "high demand" (503) errors and per-minute limits (429). If a model's free **daily** quota runs out, it switches to the next model, because each model has its own free quota.
- **Tools:** `DuckDuckGoSearch` (a custom `@tool`, no API key), `ScrapeWebsiteTool` (capped at 8,000 characters per page to save tokens), `FileReadTool`, `FileWriterTool`, and a custom pandas `SalesDataTool`.
- **Accuracy guards:** structured output with Pydantic on every important step. Numbers are computed by pandas, not by the LLM. Sources are filtered to URLs a tool really returned. Router labels are validated.
- **Quota protection:** at most 2 agent runs at a time (`MAX_CONCURRENT_RUNS`).

## Configuration (environment variables)

| Variable | Default | |
|---|---|---|
| `GEMINI_API_KEY` | (required) | free key from AI Studio |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | main model |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.5-flash,gemini-3.8-flash,...` | tried in order when busy or out of quota |
| `CORS_ORIGINS` | `*` | allowed origins for a web UI |
| `CREW_VERBOSE` | `false` | print agent reasoning in the logs |
| `MAX_CONCURRENT_RUNS` | `2` | parallel agent runs |
| `MAX_REVISIONS` | `3` | revision limit for `/agent10` |
| `OUTPUT_DIR` | `outputs` | where files are saved |

## Deploy on Render

1. Push this repo to GitHub.
2. On Render: **New → Blueprint** and pick the repo (it reads `render.yaml`). Or create a **Web Service** manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - Environment: `PYTHON_VERSION=3.13.5`, `MALLOC_ARENA_MAX=2`, and **`GEMINI_API_KEY`** (paste it in the dashboard, never in git)
3. Open `https://<your-service>.onrender.com/docs`.

Render is used instead of Vercel or Netlify because one agent run can take 10 seconds to 3 minutes, which is longer than their serverless time limits.

Then open `https://<your-service>.onrender.com` for the website.

**Free plan notes:** the service sleeps after about 15 minutes idle, so the first request takes longer. Files in `outputs/` are temporary, which is why every response also returns the file content. A paused `/agent10` review is lost if the service restarts. Measured memory use is about 445 MB of the 512 MB limit.

## Free-tier limits

Gemini's free tier has per-minute and **per-day** request limits for each model. Approximate LLM calls per run, measured:

| Route | Calls | Route | Calls |
|---|---|---|---|
| agent1 | ~5 | agent6 | ~2–3 per resume |
| agent2 | ~30–35 | agent7 | ~2–9 |
| agent3 | ~7 | agent8 | ~4 |
| agent4 | ~7–20 | agent9 | ~3–5 |
| agent5 | ~2 | agent10 | ~8 to start, ~1 per revision |

## Project files

```
app.py            all 10 agents + FastAPI routes (+ serves the website from frontend/dist)
frontend/         React website (src/ = source, dist/ = built site served by FastAPI)
requirements.txt  pinned dependencies
render.yaml       Render deployment settings
.python-version   Python 3.13
.env.example      template for your .env (the real .env is git-ignored)
samples/          sample inputs: transcript.txt, sales.csv, article.txt, resumes, job description
```
