"""
CREWAI - 10 CrewAI projects (4 Crews + 6 Flows) served as a FastAPI REST API.

Routes
    POST /agent1   Blog Post Crew               (Crew, sequential)
    POST /agent2   Competitor Analysis Crew     (Crew, hierarchical)
    POST /agent3   Meeting Notes Crew           (Crew, parallel async tasks)
    POST /agent4   Data Report Crew             (Crew, structured output)
    POST /agent5   Customer Support Flow        (Flow, router, direct LLM calls)
    POST /agent6   Resume Screening Flow        (Flow, router + Summary Crew)
    POST /agent7   Bug Triage Flow              (Flow + Crews, router)
    POST /agent8   Content Repurposing Flow     (Flow + Crews, parallel + and_)
    POST /agent9   Lead Qualification Flow      (Flow + Crews, router)
    POST /agent10  Approval Report Flow         (Flow + Crews, human feedback)

Run locally:  uvicorn app:app --reload      then open http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()
# Must be set before crewai is imported: no tracing prompts or telemetry on a server.
os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("CREWAI_DISABLE_TRACKING", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

import contextvars
import csv
import ctypes
import gc
import io
import json
import logging
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generic, Literal, Optional, TypeVar

import pandas as pd
from crewai import Agent, Crew, Process, Task
from crewai.flow.async_feedback import HumanFeedbackPending, HumanFeedbackProvider
from crewai.flow.flow import Flow, and_, listen, or_, router, start
from crewai.flow.human_feedback import human_feedback
from crewai.flow.persistence import SQLiteFlowPersistence
from crewai.llms.providers.gemini.completion import GeminiCompletion
from crewai.tools import BaseTool, tool
from crewai_tools import FileReadTool, FileWriterTool, ScrapeWebsiteTool
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator
from pypdf import PdfReader

logger = logging.getLogger("crewai_app")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# =============================================================================
# Configuration
# =============================================================================

# Free tier note: each model has its OWN daily request quota (Flash can be as low as 20/day),
# so the client walks down this chain when a model is busy (503) or out of quota (429).
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_LIGHT_MODEL = os.getenv("GEMINI_LIGHT_MODEL", "gemini-3.5-flash-lite")
GEMINI_FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv(
        "GEMINI_FALLBACK_MODELS",
        "gemini-3.5-flash,gemini-3.8-flash,gemini-3.7-flash,gemini-3.1-flash-lite,gemini-flash-lite-latest",
    ).split(",")
    if m.strip()
]
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "outputs")).resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CREW_VERBOSE = os.getenv("CREW_VERBOSE", "false").lower() == "true"
MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "5"))
MAX_CONCURRENT_RUNS = int(os.getenv("MAX_CONCURRENT_RUNS", "2"))
SCRAPE_MAX_CHARS = int(os.getenv("SCRAPE_MAX_CHARS", "8000"))
MAX_REVISIONS = int(os.getenv("MAX_REVISIONS", "3"))

_run_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RUNS)  # protects the free-tier quota
_csv_lock = threading.Lock()


def _require_api_key() -> None:
    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not set. Add it to .env locally or as an environment variable on Render.",
        )


# =============================================================================
# LLM: Gemini with retries and automatic model fallback
# =============================================================================

_TRANSIENT_MARKERS = (
    "503", "429", "500", "unavailable", "resource_exhausted", "high demand",
    "overloaded", "internal", "deadline", "timed out", "timeout", "rate limit",
)
_exhausted_until: dict[str, float] = {}  # model -> time when its daily quota is expected back
_llm_calls = {"count": 0}
_llm_lock = threading.Lock()


def _retry_delay_seconds(message: str) -> float | None:
    match = re.search(r"retry(?:Delay)?['\"]?\s*[:=]?\s*['\"]?(\d+(?:\.\d+)?)s", message, re.IGNORECASE)
    return float(match.group(1)) if match else None


class ResilientGemini(GeminiCompletion):
    """Gemini client for the free tier:
    - 503 "high demand"      -> short retry, then the next model
    - 429 per-minute limit   -> wait the suggested delay (max 60s) and retry
    - 429 per-day limit      -> mark the model exhausted and move to the next model at once
    """

    fallback_models: list[str] = []

    def _model_chain(self) -> list[str]:
        chain = []
        for m in [self.model, *self.fallback_models]:
            if m not in chain and _exhausted_until.get(m, 0) < time.time():
                chain.append(m)
        return chain

    def call(self, *args: Any, **kwargs: Any) -> Any:
        last_error: Exception | None = None
        for model in self._model_chain():
            self.model = model  # sticky: once we fall back we stay there for this run
            for attempt in range(3):
                try:
                    with _llm_lock:
                        _llm_calls["count"] += 1
                    return super().call(*args, **kwargs)
                except Exception as exc:  # noqa: BLE001
                    message = str(exc)
                    low = message.lower()
                    if not any(m in low for m in _TRANSIENT_MARKERS):
                        raise
                    last_error = exc
                    delay = _retry_delay_seconds(message)
                    if "perday" in low or "per day" in low or (delay or 0) > 120:
                        _exhausted_until[model] = time.time() + min(delay or 3600, 6 * 3600)
                        logger.warning("Gemini %s daily free quota used up; switching model", model)
                        break
                    if "429" in message and attempt < 2:
                        wait = min((delay or 10) + 1, 60)
                    elif attempt < 1:
                        wait = 3
                    else:
                        logger.warning("Gemini %s still failing (%s); switching model", model, message[:80])
                        break
                    logger.warning("Gemini %s transient error: %s. Retrying in %.0fs", model, message[:100], wait)
                    time.sleep(wait)
        raise RuntimeError(
            "All Gemini models are busy or out of free daily quota. Try again later. "
            f"Last error: {str(last_error)[:300]}"
        )

    async def acall(self, *args: Any, **kwargs: Any) -> Any:
        import asyncio

        return await asyncio.to_thread(self.call, *args, **kwargs)


def make_llm(temperature: float = 0.4, light: bool = False) -> ResilientGemini:
    """`light=True` uses the faster Flash-Lite model for simple steps
    (classifying, scoring, extracting) to save the free-tier quota."""
    primary = GEMINI_LIGHT_MODEL if light else GEMINI_MODEL
    return ResilientGemini(
        model=primary,
        fallback_models=GEMINI_FALLBACK_MODELS + [GEMINI_MODEL, GEMINI_LIGHT_MODEL],
        temperature=temperature,
        api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
    )


T = TypeVar("T", bound=BaseModel)


def llm_structured(prompt: str, schema: type[T], temperature: float = 0.1, light: bool = True) -> T:
    """Direct LLM call (no Crew) that returns a validated Pydantic object."""
    result = make_llm(temperature=temperature, light=light).call(prompt, response_model=schema)
    if isinstance(result, schema):
        return result
    if isinstance(result, BaseModel):
        return schema.model_validate(result.model_dump())
    if isinstance(result, dict):
        return schema.model_validate(result)
    text = str(result).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    return schema.model_validate_json(text)


def make_agent(role: str, goal: str, backstory: str, tools: list | None = None,
               temperature: float = 0.4, light: bool = False, **kwargs: Any) -> Agent:
    return Agent(
        role=role,
        goal=goal,
        backstory=backstory,
        tools=tools or [],
        llm=make_llm(temperature=temperature, light=light),
        allow_delegation=kwargs.pop("allow_delegation", False),
        max_iter=kwargs.pop("max_iter", 6),
        memory=False,
        verbose=CREW_VERBOSE,
        **kwargs,
    )


def task_pydantic(task: Task, schema: type[T]) -> T:
    """Read a task's structured output safely."""
    output = task.output
    if output is None:
        raise RuntimeError(f"Task '{task.description[:40]}...' produced no output")
    if output.pydantic is not None:
        return schema.model_validate(output.pydantic.model_dump())
    if output.json_dict:
        return schema.model_validate(output.json_dict)
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", output.raw.strip())
    return schema.model_validate_json(raw)


# =============================================================================
# Source tracking: every URL that a tool really returned in THIS run is recorded,
# so the API can drop "sources" an LLM wrote from memory.
# =============================================================================

_seen_urls: contextvars.ContextVar[Optional[set]] = contextvars.ContextVar("seen_urls", default=None)
_read_urls: contextvars.ContextVar[Optional[set]] = contextvars.ContextVar("read_urls", default=None)


def _norm_url(url: str) -> str:
    url = str(url).strip().lower().split("#")[0]
    url = re.sub(r"^https?://(www\.)?", "", url)
    return url.rstrip("/")


def _record(var: contextvars.ContextVar, url: str) -> None:
    bucket = var.get()
    if bucket is not None and url:
        bucket.add(_norm_url(url))


def seen_urls() -> set:
    """URLs that appeared in search results or were scraped during this run."""
    return set(_seen_urls.get() or set())


def was_read(url: str) -> bool:
    """True if this exact page was scraped successfully during this run."""
    return _norm_url(url) in (_read_urls.get() or set())


def verified_only(urls_or_sources: list, key: str | None = None) -> list:
    """Keeps only items whose URL a tool actually returned in this run."""
    seen = seen_urls()
    out = []
    for item in urls_or_sources:
        url = _norm_url(item[key] if key else item)
        if url and any(url == s or url.startswith(s + "/") or s.startswith(url + "/") for s in seen):
            out.append(item)
    return out


# =============================================================================
# Tools
# =============================================================================


@tool("DuckDuckGoSearch")
def duckduckgo_search(query: str) -> str:
    """Search the web with DuckDuckGo (free, no API key). Input: a search query.
    Returns the top results with title, URL and snippet."""
    try:
        from ddgs import DDGS

        results = DDGS().text(query, max_results=6)
    except Exception as exc:  # noqa: BLE001
        return (f"Search failed ({type(exc).__name__}: {str(exc)[:150]}). "
                "Continue with your own knowledge, say that live search was unavailable, "
                "and do NOT invent URLs or statistics.")
    if not results:
        return "No results found. Try a shorter or different query."
    for r in results:
        _record(_seen_urls, r.get("href", ""))
    return "\n\n".join(
        f"[{i}] {r.get('title', '')}\nURL: {r.get('href', '')}\n{r.get('body', '')}"
        for i, r in enumerate(results, 1)
    )


class LimitedScrapeWebsiteTool(ScrapeWebsiteTool):
    """ScrapeWebsiteTool that never crashes the crew and caps the text length
    so a single page cannot use up the token quota."""

    max_chars: int = SCRAPE_MAX_CHARS

    def _run(self, **kwargs: Any) -> Any:
        try:
            text = super()._run(**kwargs)
        except Exception as exc:  # noqa: BLE001
            url = kwargs.get("website_url", self.website_url)
            return (f"Could not read {url}: {type(exc).__name__}: {str(exc)[:150]}. "
                    "Do NOT guess the page content from memory; report that the page could not be read.")
        url = kwargs.get("website_url", self.website_url)
        _record(_seen_urls, url)
        _record(_read_urls, url)
        if len(text) > self.max_chars:
            text = text[: self.max_chars] + "\n...[content truncated]"
        return text


def scrape_url(url: str, max_chars: int = SCRAPE_MAX_CHARS) -> str:
    tool_ = LimitedScrapeWebsiteTool()
    tool_.max_chars = max_chars
    return tool_.run(website_url=url)


def save_file(run_dir: Path, filename: str, content: str) -> str:
    """Save an output file with crewai_tools' FileWriterTool."""
    run_dir.mkdir(parents=True, exist_ok=True)
    FileWriterTool(base_dir=str(OUTPUT_DIR)).run(
        filename=filename, content=content, directory=str(run_dir), overwrite=True
    )
    return content


def read_text_file(path: Path) -> str:
    """Read a .txt/.md/.csv file with crewai_tools' FileReadTool."""
    return FileReadTool(base_dir=str(OUTPUT_DIR)).run(file_path=str(path))


def pdf_to_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def new_run_dir(agent: str) -> tuple[str, Path]:
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    path = OUTPUT_DIR / agent / run_id
    path.mkdir(parents=True, exist_ok=True)
    return run_id, path


def append_csv(path: Path, row: dict[str, Any]) -> None:
    with _csv_lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        is_new = not path.exists()
        with path.open("a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(row.keys()))
            if is_new:
                writer.writeheader()
            writer.writerow(row)


def read_upload(upload: UploadFile, allowed: tuple[str, ...]) -> tuple[str, bytes]:
    name = Path(upload.filename or "upload").name
    ext = Path(name).suffix.lower()
    if ext not in allowed:
        raise HTTPException(422, f"File '{name}' has type '{ext or 'none'}'. Allowed: {', '.join(allowed)}")
    data = upload.file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File '{name}' is larger than {MAX_UPLOAD_MB} MB")
    if not data:
        raise HTTPException(422, f"File '{name}' is empty")
    return name, data


def decode_text(data: bytes, name: str) -> str:
    for enc in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise HTTPException(422, f"Could not read '{name}' as text")


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w[\w'-]*\b", text))


def strip_fences(text: str) -> str:
    text = text.strip()
    match = re.match(r"^```(?:markdown|md)?\s*\n(.*)\n```$", text, re.DOTALL)
    return match.group(1).strip() if match else text


# =============================================================================
# Common response envelope (same shape for all 10 routes, so a UI can treat
# every project the same way)
# =============================================================================

R = TypeVar("R")


class AgentResponse(BaseModel, Generic[R]):
    agent: str = Field(description="Route name, e.g. agent1")
    project: str
    status: Literal["completed", "pending_review"]
    run_id: str
    duration_seconds: float
    steps: list[str] = Field(description="The agents / flow steps that ran, in order")
    result: R
    files: dict[str, str] = Field(default_factory=dict, description="Saved file name -> content")


def _release_memory() -> None:
    """Return freed memory to the OS after each run (keeps the app inside Render's free 512 MB)."""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass  # not glibc (macOS/Windows): nothing to do


def run_agent(agent: str, project: str, fn) -> dict[str, Any]:
    """Runs a project with quota protection and turns failures into clean HTTP errors."""
    _require_api_key()
    if not _run_slots.acquire(timeout=300):
        raise HTTPException(503, "Server is busy with other agent runs. Try again in a minute.")
    started, calls_before = time.time(), _llm_calls["count"]
    tokens = (_seen_urls.set(set()), _read_urls.set(set()))
    try:
        out = fn()
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("%s failed", agent)
        raise HTTPException(status_code=502, detail=f"{project} failed: {type(exc).__name__}: {str(exc)[:500]}")
    finally:
        _seen_urls.reset(tokens[0])
        _read_urls.reset(tokens[1])
        _run_slots.release()
        _release_memory()
        logger.info("%s finished in %.0fs using ~%s LLM calls", agent, time.time() - started,
                    _llm_calls["count"] - calls_before)
    out.setdefault("status", "completed")
    out.update(agent=agent, project=project, duration_seconds=round(time.time() - started, 1))
    return out


# =============================================================================
# 01 Blog Post Crew  (Crew, sequential)
# Researcher (DuckDuckGo) -> Writer (600-word draft) -> Editor (tone and facts) -> blog_post.md
# =============================================================================


class Agent1Request(BaseModel):
    topic: str = Field(min_length=3, max_length=200, examples=["AI in farming"])
    target_audience: str = Field("general readers", max_length=150)


class Agent1Result(BaseModel):
    topic: str
    title: str
    word_count: int
    blog_post: str
    research_notes: str
    sources: list[str] = Field(description="URLs the search tool really returned in this run")


def run_blog_post_crew(req: Agent1Request) -> dict[str, Any]:
    run_id, run_dir = new_run_dir("agent1")
    researcher = make_agent(
        "Senior Research Analyst",
        "Find accurate, current facts, statistics and examples about {topic}",
        "You are a meticulous researcher. You only report facts you found in search results, "
        "always keep the source URL next to each fact, and never invent numbers.",
        tools=[duckduckgo_search], temperature=0.2,
    )
    writer = make_agent(
        "Blog Writer",
        "Write an engaging, well-structured 600-word blog post about {topic} for {audience}",
        "You are a professional content writer who turns research into clear, engaging posts "
        "with a strong title, short paragraphs and helpful subheadings.",
        temperature=0.7,
    )
    editor = make_agent(
        "Senior Editor",
        "Polish the draft so the tone is consistent and every fact matches the research",
        "You are an experienced editor. You fix grammar, flow and tone, remove claims that are "
        "not supported by the research, and keep the post close to 600 words.",
        temperature=0.3,
    )
    research = Task(
        description=(
            "Research the topic '{topic}' for {audience}. Use the DuckDuckGoSearch tool with 2-3 "
            "different queries. Collect key facts, recent developments, real-world examples and "
            "statistics."
        ),
        expected_output=(
            "8-12 bullet points of research notes. Each bullet is one fact with its source URL. "
            "End with a 'Sources' list of the URLs used. Only use URLs that appeared in the search results; "
            "if search was unavailable, say so and list no sources."
        ),
        agent=researcher,
    )
    draft = Task(
        description=(
            "Using ONLY the research notes, write a blog post about '{topic}' for {audience}. "
            "Structure: a catchy H1 title, a short hook introduction, 3-4 sections with H2 "
            "subheadings, and a conclusion with a takeaway. Target length: 600 words."
        ),
        expected_output="A ~600-word blog post draft in Markdown, starting with '# <Title>'.",
        agent=writer,
        context=[research],
    )
    edit = Task(
        description=(
            "Edit the draft. Fix grammar, flow and tone so it reads naturally for {audience}. "
            "Check every fact and number against the research notes and remove or correct "
            "anything not supported. Keep the length between 550 and 650 words. "
            "Return ONLY the final post - no comments, no notes about your edits."
        ),
        expected_output="The final blog post in Markdown, starting with '# <Title>', 550-650 words.",
        agent=editor,
        context=[research, draft],
    )
    crew = Crew(agents=[researcher, writer, editor], tasks=[research, draft, edit],
                process=Process.sequential, verbose=CREW_VERBOSE)
    output = crew.kickoff(inputs={"topic": req.topic, "audience": req.target_audience})

    post = strip_fences(output.raw)
    title_match = re.search(r"^#\s+(.+)$", post, re.MULTILINE)
    save_file(run_dir, "blog_post.md", post)
    return {
        "run_id": run_id,
        "steps": ["Researcher (DuckDuckGoSearch)", "Writer (draft)", "Editor (final)", "FileWriter: blog_post.md"],
        "result": Agent1Result(
            topic=req.topic,
            title=title_match.group(1).strip() if title_match else req.topic,
            word_count=word_count(post),
            blog_post=post,
            research_notes=research.output.raw if research.output else "",
            sources=sorted(seen_urls()),
        ),
        "files": {"blog_post.md": post},
    }


# =============================================================================
# 02 Competitor Analysis Crew  (Crew, hierarchical with manager_llm)
# Manager splits and assigns -> Site Scraper, Pricing Analyst, News Analyst, Strategist -> report.md
# =============================================================================


class Agent2Request(BaseModel):
    competitors: list[HttpUrl] = Field(
        min_length=3, max_length=3,
        examples=[["https://www.notion.so", "https://www.clickup.com", "https://asana.com"]],
    )
    your_company: str = Field("", max_length=300, description="Optional: your product, for tailored recommendations")


class Agent2Result(BaseModel):
    competitors: list[str]
    websites_read: dict[str, bool] = Field(description="Whether each competitor site was really scraped")
    sources_used: list[str] = Field(description="URLs the tools really returned in this run")
    report: str


def run_competitor_crew(req: Agent2Request) -> dict[str, Any]:
    run_id, run_dir = new_run_dir("agent2")
    urls = [str(u) for u in req.competitors]
    url_list = "\n".join(f"- {u}" for u in urls)
    scraper = make_agent(
        "Website Intelligence Scraper",
        "Read each competitor website and extract what they sell, who for, and how they position themselves",
        "You are a web researcher who extracts facts from websites accurately and never guesses.",
        tools=[LimitedScrapeWebsiteTool()], temperature=0.2,
    )
    pricing = make_agent(
        "Pricing Analyst",
        "Find each competitor's plans, prices and free tiers",
        "You are a SaaS pricing expert. You read pricing pages (often at /pricing) and report exact "
        "plan names and prices. You ONLY report prices you actually read on a page during this task; "
        "you never fill gaps from memory. If you could not find a price you write 'not found on site'.",
        tools=[LimitedScrapeWebsiteTool()], temperature=0.2,
    )
    news = make_agent(
        "Market News Analyst",
        "Find recent news, launches and announcements for each competitor",
        "You are a market analyst who tracks company news. You ONLY report news items that appear in your "
        "search results, each with its URL. If search fails or finds nothing you write "
        "'No verified news found' instead of using memory.",
        tools=[duckduckgo_search], temperature=0.2,
    )
    strategist = make_agent(
        "Competitive Strategist",
        "Turn competitor intelligence into a SWOT table and clear recommendations",
        "You are a strategy consultant who writes crisp, evidence-based competitive reports.",
        temperature=0.4,
    )
    t_sites = Task(
        description=f"Scrape each competitor homepage and summarize the product, target customers, "
                    f"key features and positioning:\n{url_list}",
        expected_output="For each competitor: name, URL, product summary, target customers, 3-5 key features, positioning.",
    )
    t_pricing = Task(
        description=f"Find the pricing of each competitor (try the /pricing page of each site):\n{url_list}",
        expected_output="For each competitor: plan names, prices, billing period, free tier (yes/no), and the URL "
                        "where you read them. Use 'not found on site' if you could not read a price.",
    )
    t_news = Task(
        description=f"Search for recent news, product launches and announcements for each competitor:\n{url_list}",
        expected_output="For each competitor: 2-4 recent news items with a one-line summary and source URL.",
    )
    t_report = Task(
        description=(
            "Write the final competitor analysis report using the site, pricing and news findings. "
            + (f"Our company: {req.your_company}. Tailor the recommendations to us. " if req.your_company else "")
            + "Include: 1) an executive summary, 2) a comparison table (Competitor | Product | Target "
            "customers | Pricing), 3) a SWOT table for EACH competitor (Strengths | Weaknesses | "
            "Opportunities | Threats), 4) recent news highlights, 5) 3-5 recommendations. Use ONLY facts from the "
            "findings; keep 'not found on site' / 'No verified news found' where data is missing, never fill it in."
        ),
        expected_output="A complete competitor analysis report in Markdown with the tables described.",
        context=[t_sites, t_pricing, t_news],
    )
    crew = Crew(
        agents=[scraper, pricing, news, strategist],
        tasks=[t_sites, t_pricing, t_news, t_report],
        process=Process.hierarchical,
        manager_llm=make_llm(temperature=0.2),
        verbose=CREW_VERBOSE,
    )
    output = crew.kickoff()
    report = strip_fences(output.raw)
    save_file(run_dir, "report.md", report)
    return {
        "run_id": run_id,
        "steps": ["Manager (manager_llm) delegates", "Site Scraper", "Pricing Analyst", "News Analyst",
                  "Strategist (SWOT)", "FileWriter: report.md"],
        "result": Agent2Result(competitors=urls, websites_read={u: was_read(u) for u in urls},
                               sources_used=sorted(seen_urls()), report=report),
        "files": {"report.md": report},
    }


# =============================================================================
# 03 Meeting Notes Crew  (Crew, parallel tasks with async_execution=True)
# transcript.txt (FileReadTool) -> Summarizer | Action Finder | Decision Logger -> Formatter -> notes.md
# =============================================================================


class MeetingSummary(BaseModel):
    lines: list[str] = Field(description="Exactly 5 summary lines")


class ActionItem(BaseModel):
    task: str
    owner: str = Field(description="Person responsible, or 'Unassigned'")
    due_date: str = Field(description="Due date as stated in the meeting, or 'Not specified'")


class ActionItems(BaseModel):
    action_items: list[ActionItem]


class Decision(BaseModel):
    decision: str
    made_by: str = Field(description="Who made or approved it, or 'Team'")
    context: str = Field(description="One-line reason or context")


class Decisions(BaseModel):
    decisions: list[Decision]


class Agent3Result(BaseModel):
    summary: list[str]
    action_items: list[ActionItem]
    decisions: list[Decision]
    notes_markdown: str


def run_meeting_notes_crew(transcript: str, meeting_title: str) -> dict[str, Any]:
    run_id, run_dir = new_run_dir("agent3")
    transcript_path = run_dir / "transcript.txt"
    transcript_path.write_text(transcript, encoding="utf-8")
    reader = FileReadTool(file_path=str(transcript_path), base_dir=str(OUTPUT_DIR))

    common = "Read the meeting transcript with your file read tool first. Use only what is in the transcript."
    summarizer = make_agent("Meeting Summarizer", "Summarize meetings in exactly 5 clear lines",
                            "You write short, factual meeting summaries.", tools=[reader], temperature=0.2)
    action_finder = make_agent("Action Item Finder", "Find every action item with its owner and due date",
                               "You never miss a follow-up and never invent owners or dates.",
                               tools=[reader], temperature=0.1)
    decision_logger = make_agent("Decision Logger", "Record every decision made in the meeting",
                                 "You keep an accurate decision log for the team.", tools=[reader], temperature=0.1)
    formatter = make_agent("Notes Formatter", "Combine summary, actions and decisions into clean meeting notes",
                           "You produce well-formatted Markdown meeting notes.", temperature=0.2)

    t_summary = Task(
        description=f"{common} Write a summary of the meeting in exactly 5 lines.",
        expected_output="Exactly 5 summary lines.",
        agent=summarizer, async_execution=True, output_pydantic=MeetingSummary,
    )
    t_actions = Task(
        description=f"{common} List every action item. For each: the task, the owner (or 'Unassigned'), "
                    "and the due date exactly as said (or 'Not specified').",
        expected_output="All action items with task, owner and due_date.",
        agent=action_finder, async_execution=True, output_pydantic=ActionItems,
    )
    t_decisions = Task(
        description=f"{common} List every decision that was agreed or approved (not open questions).",
        expected_output="All decisions with decision, made_by and context.",
        agent=decision_logger, async_execution=True, output_pydantic=Decisions,
    )
    t_format = Task(
        description=(
            f"Create the final meeting notes for '{meeting_title}' from the three results. Use sections: "
            "'# <title>', '## Summary' (the 5 lines as bullets), '## Action Items' (a table: Task | Owner | "
            "Due date), '## Decisions' (a numbered list with who decided). Do not add anything new."
        ),
        expected_output="Meeting notes in Markdown with Summary, Action Items table and Decisions.",
        agent=formatter, context=[t_summary, t_actions, t_decisions],
    )
    crew = Crew(agents=[summarizer, action_finder, decision_logger, formatter],
                tasks=[t_summary, t_actions, t_decisions, t_format],
                process=Process.sequential, verbose=CREW_VERBOSE)
    output = crew.kickoff()
    notes = strip_fences(output.raw)
    save_file(run_dir, "notes.md", notes)
    summary = task_pydantic(t_summary, MeetingSummary).lines[:5]
    return {
        "run_id": run_id,
        "steps": ["FileReadTool: transcript.txt", "Summarizer | Action Finder | Decision Logger (parallel)",
                  "Formatter (waits for all three)", "FileWriter: notes.md"],
        "result": Agent3Result(
            summary=summary,
            action_items=task_pydantic(t_actions, ActionItems).action_items,
            decisions=task_pydantic(t_decisions, Decisions).decisions,
            notes_markdown=notes,
        ),
        "files": {"notes.md": notes},
    }


# =============================================================================
# 04 Data Report Crew  (Crew, structured output)
# sales.csv (FileReadTool + custom pandas tool) -> Data Analyst (output_pydantic) -> Insight Writer
# -> Reviewer (checks every number) -> report.md
# =============================================================================

_REVENUE_HINTS = ("revenue", "sales", "amount", "total", "turnover", "income", "value")
_QTY_HINTS = ("qty", "quantity", "units", "count", "volume")
_PRICE_HINTS = ("price", "unit_price", "unitprice", "rate", "cost")


def _find_col(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for hint in hints:
        for col in columns:
            if hint in col.lower().replace(" ", "_"):
                return col
    return None


def load_sales_frame(csv_path: str) -> tuple[pd.DataFrame, str | None, str | None]:
    """Returns (dataframe, revenue column, date column)."""
    df = pd.read_csv(csv_path)
    df.columns = [str(c).strip() for c in df.columns]
    numeric = df.select_dtypes("number").columns.tolist()

    date_col = None
    for col in df.columns:
        if col in numeric:
            continue
        if any(h in col.lower() for h in ("date", "time", "day", "month", "week", "period")):
            parsed = pd.to_datetime(df[col], errors="coerce")
            if parsed.notna().mean() > 0.8:
                df[col] = parsed
                date_col = col
                break

    revenue_col = _find_col(numeric, _REVENUE_HINTS)
    if revenue_col is None:
        qty, price = _find_col(numeric, _QTY_HINTS), _find_col(numeric, _PRICE_HINTS)
        if qty and price:
            df["computed_revenue"] = df[qty] * df[price]
            revenue_col = "computed_revenue"
    return df, revenue_col, date_col


def summarize_sales(csv_path: str, group_by: str = "") -> dict[str, Any]:
    df, revenue_col, date_col = load_sales_frame(csv_path)
    numeric = df.select_dtypes("number").columns.tolist()
    r2 = lambda v: round(float(v), 2)  # noqa: E731

    if group_by:
        if group_by not in df.columns:
            return {"error": f"Column '{group_by}' not found", "columns": list(df.columns)}
        grouped = df.groupby(group_by)[numeric].sum().sort_values(revenue_col or numeric[0], ascending=False)
        return {"group_by": group_by, "totals": {str(k): {c: r2(v) for c, v in row.items()} for k, row in grouped.iterrows()}}

    summary: dict[str, Any] = {
        "row_count": int(len(df)),
        "columns": {c: str(df[c].dtype) for c in df.columns},
        "revenue_column": revenue_col,
        "numeric_totals": {c: r2(df[c].sum()) for c in numeric},
        "numeric_stats": {c: {"mean": r2(df[c].mean()), "min": r2(df[c].min()), "max": r2(df[c].max())} for c in numeric},
        "missing_values": {c: int(n) for c, n in df.isna().sum().items() if n},
    }
    if revenue_col:
        summary["total_revenue"] = r2(df[revenue_col].sum())
    metric = revenue_col or (numeric[0] if numeric else None)

    breakdowns = {}
    for col in df.columns:
        if col == date_col or col in numeric:
            continue
        nunique = df[col].nunique()
        if 1 < nunique <= 50 and metric:
            totals = df.groupby(col)[metric].sum().sort_values(ascending=False)
            share = (totals / totals.sum() * 100) if totals.sum() else totals * 0
            breakdowns[col] = [
                {"name": str(k), metric: r2(v), "share_pct": r2(share[k])} for k, v in totals.items()
            ][:10]
    summary["breakdowns"] = breakdowns

    if date_col and metric:
        dates = df[date_col].dropna()
        span_days = (dates.max() - dates.min()).days if len(dates) else 0
        freq, label = ("D", "daily") if span_days <= 31 else (("W", "weekly") if span_days <= 120 else ("MS", "monthly"))
        series = df.set_index(date_col)[metric].resample(freq).sum()
        series.index = series.index.strftime("%Y-%m-%d")
        summary["date_range"] = f"{dates.min():%Y-%m-%d} to {dates.max():%Y-%m-%d}"
        summary[f"{label}_{metric}"] = {k: r2(v) for k, v in series.items()}
        if len(series) >= 2 and series.iloc[0]:
            summary["first_vs_last_period_change_pct"] = r2((series.iloc[-1] - series.iloc[0]) / series.iloc[0] * 100)
    return summary


class SalesToolArgs(BaseModel):
    group_by: str = Field("", description="Optional column name to total all numeric columns by. Empty = full summary.")


class SalesDataTool(BaseTool):
    name: str = "Sales Data Analyzer"
    description: str = ("Computes EXACT statistics from the uploaded sales CSV using pandas: totals, averages, "
                        "breakdowns by category and trends over time. Pass group_by=<column> for totals per value "
                        "of a column. Always use these numbers instead of calculating yourself.")
    args_schema: type[BaseModel] = SalesToolArgs
    csv_path: str

    def _run(self, group_by: str = "") -> str:
        return json.dumps(summarize_sales(self.csv_path, group_by), default=str)


class Metric(BaseModel):
    name: str
    value: float
    unit: str = ""


class SalesStats(BaseModel):
    row_count: int
    date_range: str = Field(description="e.g. '2026-01-01 to 2026-03-31' or 'not available'")
    total_revenue: Optional[float] = None
    key_metrics: list[Metric]
    top_segments: list[str] = Field(description="Best products/regions/etc. with their numbers")
    weakest_segments: list[str]
    trend: str = Field(description="One or two sentences on the trend over time, with numbers")


class Finding(BaseModel):
    title: str
    detail: str
    evidence: str = Field(description="The exact numbers supporting this finding")


class Findings(BaseModel):
    findings: list[Finding] = Field(description="Exactly 3 findings")


class ReviewedReport(BaseModel):
    report_markdown: str
    corrections_made: list[str] = Field(description="Numbers that were wrong and fixed, or empty")
    all_numbers_verified: bool


class Agent4Result(BaseModel):
    stats: SalesStats
    top_findings: list[Finding]
    review: ReviewedReport
    computed_stats: dict[str, Any] = Field(description="Ground-truth numbers computed by pandas")


def run_data_report_crew(csv_text: str, report_title: str) -> dict[str, Any]:
    run_id, run_dir = new_run_dir("agent4")
    csv_path = run_dir / "sales.csv"
    csv_path.write_text(csv_text, encoding="utf-8")
    try:
        computed = summarize_sales(str(csv_path))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Could not parse the CSV: {exc}") from exc
    if computed["row_count"] == 0:
        raise HTTPException(422, "The CSV has no data rows")

    pandas_tool = SalesDataTool(csv_path=str(csv_path))
    reader = FileReadTool(file_path=str(csv_path), base_dir=str(OUTPUT_DIR))

    analyst = make_agent("Data Analyst", "Produce accurate sales statistics from the CSV",
                         "You are a careful analyst. You get every number from the Sales Data Analyzer tool "
                         "and never do mental math. You never assume a currency the CSV does not state.", tools=[pandas_tool, reader], temperature=0.1)
    writer = make_agent("Insight Writer", "Turn statistics into the 3 most important business findings",
                        "You explain data to managers in plain language, always backed by numbers.", temperature=0.4)
    reviewer = make_agent("Data Reviewer", "Verify every number in the report against the tool and publish it",
                          "You are a strict reviewer. You re-check each number with the Sales Data Analyzer tool "
                          "and correct anything that does not match.", tools=[pandas_tool], temperature=0.1)

    t_stats = Task(
        description="Analyze the sales CSV. Call the Sales Data Analyzer tool (full summary, then group_by on the "
                    "most useful category columns). Report row count, date range, total revenue, key metrics, top "
                    "and weakest segments, and the trend over time.",
        expected_output="Structured sales statistics.", agent=analyst, output_pydantic=SalesStats,
    )
    t_findings = Task(
        description="From the statistics, write the top 3 findings a sales manager must know. Each finding needs "
                    "a short title, a plain-language explanation and the exact supporting numbers.",
        expected_output="Exactly 3 findings with evidence.", agent=writer, context=[t_stats], output_pydantic=Findings,
    )
    t_review = Task(
        description=(
            f"Write and verify the final report titled '{report_title}'. Check EVERY number in the statistics and "
            "findings against the Sales Data Analyzer tool and fix any mistake. Report format (Markdown): "
            "'# <title>', '## Overview' (rows, date range, total revenue), '## Key Metrics' (table), "
            "'## Top 3 Findings', '## Recommendations' (3 bullets). Do not add currency symbols unless the CSV "
            "states a currency. List any corrections you made."
        ),
        expected_output="The verified Markdown report, the corrections made, and whether all numbers were verified.",
        agent=reviewer, context=[t_stats, t_findings], output_pydantic=ReviewedReport,
    )
    crew = Crew(agents=[analyst, writer, reviewer], tasks=[t_stats, t_findings, t_review],
                process=Process.sequential, verbose=CREW_VERBOSE)
    crew.kickoff()
    review = task_pydantic(t_review, ReviewedReport)
    review.report_markdown = strip_fences(review.report_markdown)
    save_file(run_dir, "report.md", review.report_markdown)
    return {
        "run_id": run_id,
        "steps": ["FileReadTool + pandas tool: sales.csv", "Data Analyst (output_pydantic)",
                  "Insight Writer (top 3)", "Reviewer (checks every number)", "FileWriter: report.md"],
        "result": Agent4Result(
            stats=task_pydantic(t_stats, SalesStats),
            top_findings=task_pydantic(t_findings, Findings).findings[:3],
            review=review,
            computed_stats=computed,
        ),
        "files": {"report.md": review.report_markdown},
    }


# =============================================================================
# 05 Customer Support Flow  (Flow, router, direct LLM calls, no Crew)
# receive_ticket -> categorize_ticket -> route_by_category -> billing | account_access | other
# -> or_ -> resolve_ticket
# =============================================================================

TicketCategory = Literal["billing", "account_access", "technical_issue", "feature_request", "other"]


class TicketClassification(BaseModel):
    category: TicketCategory
    confidence: float = Field(ge=0, le=1)
    reason: str


class TicketResolution(BaseModel):
    customer_reply: str = Field(description="Polite reply to the customer that resolves or moves the issue forward")
    internal_next_steps: list[str]
    escalate_to_human: bool


class SupportTicketState(BaseModel):
    ticket_id: str = ""
    customer_name: str = ""
    customer_email: str = ""
    issue_description: str = ""
    category: str = ""
    category_reason: str = ""
    route: str = ""
    priority: str = "medium"
    handled_by: str = ""
    resolution: dict[str, Any] = {}
    steps: list[str] = []


class CustomerSupportFlow(Flow[SupportTicketState]):
    @start()
    def receive_ticket(self):
        self.state.steps.append("receive_ticket")
        if not self.state.ticket_id:
            self.state.ticket_id = "T-" + uuid.uuid4().hex[:8].upper()

    @listen(receive_ticket)
    def categorize_ticket(self):
        self.state.steps.append("categorize_ticket (direct LLM call)")
        result = llm_structured(
            "You are a support ticket classifier. Classify the ticket into exactly one category:\n"
            "- billing: charges, refunds, invoices, payments, subscription price\n"
            "- account_access: login, password, 2FA, locked or hacked account\n"
            "- technical_issue: bugs, errors, crashes, something not working\n"
            "- feature_request: asking for new functionality\n"
            "- other: anything else\n\n"
            f"Ticket: {self.state.issue_description}",
            TicketClassification,
        )
        self.state.category = result.category
        self.state.category_reason = result.reason

    @router(categorize_ticket)
    def route_by_category(self):
        label = self.state.category if self.state.category in ("billing", "account_access") else "other"
        self.state.route = label
        self.state.steps.append(f"route_by_category -> '{label}'")
        return label

    @listen("billing")
    def handle_billing(self):
        self.state.steps.append("handle_billing")
        self.state.priority = "high"
        self.state.handled_by = "Billing team"

    @listen("account_access")
    def handle_access(self):
        self.state.steps.append("handle_access")
        self.state.priority = "high"
        self.state.handled_by = "Account security team"

    @listen("other")
    def handle_other(self):
        self.state.steps.append("handle_other")
        if self.state.category == "technical_issue":
            self.state.priority, self.state.handled_by = "medium", "Technical support"
        elif self.state.category == "feature_request":
            self.state.priority, self.state.handled_by = "low", "Product team"
        else:
            self.state.priority, self.state.handled_by = "low", "General support"

    # Listens to the handlers (not the labels) so it runs AFTER the priority is set.
    @listen(or_(handle_billing, handle_access, handle_other))
    def resolve_ticket(self):
        self.state.steps.append("resolve_ticket (direct LLM call)")
        res = llm_structured(
            f"You are a {self.state.handled_by} agent. Write the resolution for this support ticket.\n"
            f"Customer: {self.state.customer_name}\nCategory: {self.state.category}\n"
            f"Priority: {self.state.priority}\nIssue: {self.state.issue_description}\n\n"
            "The customer_reply must greet the customer by name, acknowledge the issue, give concrete next "
            "steps, and never promise refunds or actions you cannot verify. Set escalate_to_human to true "
            "for high-priority, security or money-related issues.",
            TicketResolution, temperature=0.4, light=False,
        )
        self.state.resolution = res.model_dump()
        return self.state.resolution


class Agent5Request(BaseModel):
    customer_name: str = Field(min_length=1, max_length=100, examples=["Priya Sharma"])
    issue_description: str = Field(min_length=10, max_length=4000, examples=["I was charged twice for my subscription this month."])
    customer_email: str = Field("", max_length=200)
    ticket_id: str = Field("", max_length=50, description="Optional; generated if empty")


class Agent5Result(BaseModel):
    ticket_id: str
    customer_name: str
    category: str
    category_reason: str
    route: str
    priority: str
    handled_by: str
    resolution: TicketResolution


def run_support_flow(req: Agent5Request) -> dict[str, Any]:
    run_id, _ = new_run_dir("agent5")
    flow = CustomerSupportFlow()
    flow.kickoff(inputs=req.model_dump())
    s = flow.state
    return {
        "run_id": run_id,
        "steps": s.steps,
        "result": Agent5Result(
            ticket_id=s.ticket_id, customer_name=s.customer_name, category=s.category,
            category_reason=s.category_reason, route=s.route, priority=s.priority,
            handled_by=s.handled_by, resolution=TicketResolution(**s.resolution),
        ),
    }


# =============================================================================
# 06 Resume Screening Flow  (Flow, router + Summary Crew)
# load_resumes -> score_resume (0-10) -> check_score -> shortlist (Summary Crew) | reject (email)
# -> or_ -> save_results (results.csv)
# =============================================================================


class ResumeScore(BaseModel):
    candidate_name: str = Field(description="From the resume, or 'Unknown'")
    score: int = Field(ge=0, le=10)
    reasoning: str
    matched_skills: list[str]
    missing_skills: list[str]


class CandidateSummary(BaseModel):
    strengths: list[str]
    gaps: list[str]
    interview_focus: list[str] = Field(description="2-3 topics to probe in the interview")
    recommendation: str


class RejectionEmail(BaseModel):
    subject: str
    body: str


class ResumeState(BaseModel):
    job_description: str = ""
    file_name: str = ""
    file_path: str = ""
    resume_text: str = ""
    threshold: int = 7
    results_csv: str = ""
    candidate_name: str = ""
    score: int = 0
    reasoning: str = ""
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    decision: str = ""
    summary: dict[str, Any] = {}
    rejection_email: dict[str, Any] = {}
    steps: list[str] = []


class ResumeScreeningFlow(Flow[ResumeState]):
    @start()
    def load_resumes(self):
        self.state.steps.append("load_resumes")
        path = Path(self.state.file_path)
        if not self.state.resume_text:
            if path.suffix.lower() == ".pdf":
                self.state.resume_text = pdf_to_text(path.read_bytes())  # free PDF text reader (pypdf)
            else:
                self.state.resume_text = read_text_file(path)  # FileReadTool
        if len(self.state.resume_text.strip()) < 50:
            raise ValueError(f"Could not extract enough text from '{self.state.file_name}' (scanned PDF?)")

    @listen(load_resumes)
    def score_resume(self):
        self.state.steps.append("score_resume (direct LLM call)")
        r = llm_structured(
            "You are an expert technical recruiter. Score how well this resume matches the job, 0-10.\n"
            "Rubric: 9-10 meets all must-haves and most nice-to-haves; 7-8 meets all must-haves; "
            "4-6 missing some must-haves; 0-3 poor match. Judge only on evidence in the resume.\n\n"
            f"JOB DESCRIPTION:\n{self.state.job_description}\n\nRESUME:\n{self.state.resume_text[:12000]}",
            ResumeScore, light=False,
        )
        self.state.candidate_name = r.candidate_name
        self.state.score = r.score
        self.state.reasoning = r.reasoning
        self.state.matched_skills = r.matched_skills
        self.state.missing_skills = r.missing_skills

    @router(score_resume)
    def check_score(self):
        label = "shortlist" if self.state.score >= self.state.threshold else "reject"
        self.state.decision = label
        self.state.steps.append(f"check_score: {self.state.score} >= {self.state.threshold}? -> '{label}'")
        return label

    @listen("shortlist")
    def run_summary_crew(self):
        self.state.steps.append("Summary Crew (Talent Analyst)")
        analyst = make_agent("Talent Analyst", "Summarize a shortlisted candidate's strengths and gaps for the hiring manager",
                             "You are a senior recruiter who writes balanced, evidence-based candidate summaries.",
                             temperature=0.3)
        task = Task(
            description=f"Job description:\n{self.state.job_description}\n\nResume:\n{self.state.resume_text[:12000]}\n\n"
                        f"Score given: {self.state.score}/10 ({self.state.reasoning}). Write 3-5 strengths, the gaps, "
                        "2-3 interview focus topics and a one-line recommendation. Base everything on the resume.",
            expected_output="Strengths, gaps, interview focus and recommendation.",
            agent=analyst, output_pydantic=CandidateSummary,
        )
        Crew(agents=[analyst], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.summary = task_pydantic(task, CandidateSummary).model_dump()

    @listen("reject")
    def draft_rejection(self):
        self.state.steps.append("draft_rejection (direct LLM call)")
        email = llm_structured(
            f"Write a short, warm, professional rejection email to {self.state.candidate_name} for this role. "
            "Thank them, do not list their weaknesses, do not claim to be impressed or invent praise, "
            "encourage them to apply for future roles that fit their background. "
            "Sign as 'The Hiring Team'.\n\n"
            f"Job description:\n{self.state.job_description[:2000]}",
            RejectionEmail, temperature=0.5,
        )
        self.state.rejection_email = email.model_dump()

    @listen(or_(run_summary_crew, draft_rejection))
    def save_results(self):
        self.state.steps.append("save_results -> results.csv")
        append_csv(Path(self.state.results_csv), {
            "file_name": self.state.file_name,
            "candidate_name": self.state.candidate_name,
            "score": self.state.score,
            "decision": self.state.decision,
            "reasoning": self.state.reasoning,
            "matched_skills": "; ".join(self.state.matched_skills),
            "missing_skills": "; ".join(self.state.missing_skills),
            "strengths": "; ".join(self.state.summary.get("strengths", [])),
            "gaps": "; ".join(self.state.summary.get("gaps", [])),
        })


class ScreenedCandidate(BaseModel):
    file_name: str
    candidate_name: str
    score: int
    decision: Literal["shortlist", "reject"]
    reasoning: str
    matched_skills: list[str]
    missing_skills: list[str]
    summary: Optional[CandidateSummary] = None
    rejection_email: Optional[RejectionEmail] = None
    steps: list[str]


class Agent6Result(BaseModel):
    total: int
    shortlisted: int
    rejected: int
    threshold: int
    candidates: list[ScreenedCandidate]
    errors: list[str] = []


def run_resume_flow(job_description: str, threshold: int, resumes: list[tuple[str, bytes]]) -> dict[str, Any]:
    run_id, run_dir = new_run_dir("agent6")
    results_csv = run_dir / "results.csv"
    candidates, errors = [], []
    for name, data in resumes:  # one Flow run per resume, in order (protects the rate limit)
        path = run_dir / "resumes" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        flow = ResumeScreeningFlow()
        try:
            flow.kickoff(inputs={"job_description": job_description, "file_name": name, "file_path": str(path),
                                 "threshold": threshold, "results_csv": str(results_csv)})
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{name}: {exc}")
            continue
        s = flow.state
        candidates.append(ScreenedCandidate(
            file_name=name, candidate_name=s.candidate_name, score=s.score, decision=s.decision,
            reasoning=s.reasoning, matched_skills=s.matched_skills, missing_skills=s.missing_skills,
            summary=CandidateSummary(**s.summary) if s.summary else None,
            rejection_email=RejectionEmail(**s.rejection_email) if s.rejection_email else None,
            steps=s.steps,
        ))
    if not candidates:
        raise HTTPException(422, "No resume could be processed: " + " | ".join(errors))
    candidates.sort(key=lambda c: c.score, reverse=True)
    csv_text = results_csv.read_text(encoding="utf-8") if results_csv.exists() else ""
    shortlisted = sum(c.decision == "shortlist" for c in candidates)
    return {
        "run_id": run_id,
        "steps": ["load_resumes", "score_resume", "check_score (router)", "shortlist: Summary Crew | reject: draft_rejection",
                  "save_results -> results.csv"],
        "result": Agent6Result(total=len(candidates), shortlisted=shortlisted, rejected=len(candidates) - shortlisted,
                               threshold=threshold, candidates=candidates, errors=errors),
        "files": {"results.csv": csv_text},
    }


# =============================================================================
# 07 Bug Triage Flow  (Flow + Crews, router)
# read_issue -> classify_issue -> route_type -> Bug Crew | Feature Crew | Answer Crew -> or_ -> post_reply
# =============================================================================


class IssueClassification(BaseModel):
    issue_type: Literal["bug", "feature", "question"]
    reason: str


class BugReport(BaseModel):
    severity: Literal["critical", "high", "medium", "low"]
    severity_reason: str
    steps_to_reproduce: list[str]
    expected_behavior: str
    actual_behavior: str
    suspected_component: str
    missing_information: list[str] = Field(description="Details to ask the reporter for, or empty")


class UserStory(BaseModel):
    title: str
    user_story: str = Field(description="As a <user>, I want <goal>, so that <benefit>.")
    acceptance_criteria: list[str]
    priority: Literal["high", "medium", "low"]


class DocsAnswer(BaseModel):
    answer: str
    doc_references: list[str] = Field(description="Doc URLs or sections used; empty if none")
    confident: bool


class BugTriageState(BaseModel):
    title: str = ""
    body: str = ""
    docs_url: str = ""
    issue_type: str = ""
    classification_reason: str = ""
    analysis: dict[str, Any] = {}
    labels: list[str] = []
    comment: str = ""
    steps: list[str] = []


class BugTriageFlow(Flow[BugTriageState]):
    @start()
    def read_issue(self):
        self.state.steps.append("read_issue")
        self.state.title, self.state.body = self.state.title.strip(), self.state.body.strip()

    @listen(read_issue)
    def classify_issue(self):
        self.state.steps.append("classify_issue (direct LLM call)")
        c = llm_structured(
            "Classify this issue from a software project's tracker:\n"
            "- bug: something is broken, an error, crash or wrong behavior\n"
            "- feature: a request for new or changed functionality\n"
            "- question: the user asks how to do something / needs help\n\n"
            f"Title: {self.state.title}\nBody: {self.state.body}",
            IssueClassification,
        )
        self.state.issue_type, self.state.classification_reason = c.issue_type, c.reason

    @router(classify_issue)
    def route_type(self):
        self.state.steps.append(f"route_type -> '{self.state.issue_type}'")
        return self.state.issue_type

    def _issue_text(self) -> str:
        return f"Issue title: {self.state.title}\nIssue body:\n{self.state.body}"

    @listen("bug")
    def run_bug_crew(self):
        self.state.steps.append("Bug Crew (QA Triage Engineer)")
        agent = make_agent("QA Triage Engineer", "Assess bug severity and write clear reproduction steps",
                           "You are a senior QA engineer. Severity: critical = data loss/security/outage, "
                           "high = core feature broken with no workaround, medium = broken with workaround, "
                           "low = cosmetic.", temperature=0.2)
        task = Task(description=f"Triage this bug report.\n{self._issue_text()}\nIf steps are not given, infer "
                                "the most likely steps and list what to ask the reporter.",
                    expected_output="Severity, reason, steps to reproduce, expected/actual behavior, component, missing info.",
                    agent=agent, output_pydantic=BugReport)
        Crew(agents=[agent], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.analysis = task_pydantic(task, BugReport).model_dump()

    @listen("feature")
    def run_feature_crew(self):
        self.state.steps.append("Feature Crew (Product Manager)")
        agent = make_agent("Product Manager", "Turn feature requests into clear user stories",
                           "You are a product manager who writes crisp user stories with testable acceptance criteria.",
                           temperature=0.4)
        task = Task(description=f"Draft a user story for this feature request.\n{self._issue_text()}",
                    expected_output="Title, user story, 3-6 acceptance criteria, priority.",
                    agent=agent, output_pydantic=UserStory)
        Crew(agents=[agent], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.analysis = task_pydantic(task, UserStory).model_dump()

    @listen("question")
    def run_answer_crew(self):
        self.state.steps.append("Answer Crew (Developer Support Engineer)")
        tools = [LimitedScrapeWebsiteTool()] if self.state.docs_url else []
        docs_hint = (f"Read the project documentation at {self.state.docs_url} with your scraping tool and base "
                     "the answer on it. Cite the docs URL." if self.state.docs_url else
                     "No docs URL was given: answer from general knowledge and set confident=false if unsure.")
        agent = make_agent("Developer Support Engineer", "Answer user questions accurately from the project docs",
                           "You are a friendly support engineer who only states what the docs support.",
                           tools=tools, temperature=0.3)
        task = Task(description=f"Answer this question from a user.\n{self._issue_text()}\n{docs_hint}",
                    expected_output="A helpful answer, doc references, and whether you are confident.",
                    agent=agent, output_pydantic=DocsAnswer)
        Crew(agents=[agent], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.analysis = task_pydantic(task, DocsAnswer).model_dump()

    @listen(or_(run_bug_crew, run_feature_crew, run_answer_crew))
    def post_reply(self):
        self.state.steps.append("post_reply (label + comment)")
        a = self.state.analysis
        if self.state.issue_type == "bug":
            self.state.labels = ["bug", f"severity: {a['severity']}", "needs-triage" if a["missing_information"] else "triaged"]
            steps = "\n".join(f"{i}. {s}" for i, s in enumerate(a["steps_to_reproduce"], 1))
            missing = "".join(f"\n- {m}" for m in a["missing_information"])
            self.state.comment = (
                f"Thanks for reporting this! We've labeled it as a **{a['severity']}** severity bug.\n\n"
                f"**Why:** {a['severity_reason']}\n\n**Steps to reproduce**\n{steps}\n\n"
                f"**Expected:** {a['expected_behavior']}\n\n**Actual:** {a['actual_behavior']}\n\n"
                f"**Suspected component:** {a['suspected_component']}"
                + (f"\n\n**Could you share:**{missing}" if missing else "")
            )
        elif self.state.issue_type == "feature":
            self.state.labels = ["enhancement", f"priority: {a['priority']}"]
            criteria = "\n".join(f"- [ ] {c}" for c in a["acceptance_criteria"])
            self.state.comment = (
                f"Thanks for the suggestion! We've drafted a user story:\n\n### {a['title']}\n\n"
                f"> {a['user_story']}\n\n**Acceptance criteria**\n{criteria}\n\n**Priority:** {a['priority']}"
            )
        else:
            self.state.labels = ["question"] + ([] if a["confident"] else ["needs-maintainer"])
            refs = "".join(f"\n- {r}" for r in a["doc_references"])
            self.state.comment = a["answer"] + (f"\n\n**References:**{refs}" if refs else "")
        return self.state.comment


class Agent7Request(BaseModel):
    title: str = Field(min_length=3, max_length=300, examples=["App crashes when uploading a PNG larger than 5 MB"])
    body: str = Field(min_length=10, max_length=8000,
                      examples=["Steps: open the editor, click upload, choose a 6 MB PNG. The app freezes then closes."])
    docs_url: Optional[HttpUrl] = Field(None, description="Docs page used by the Answer Crew for questions")


class Agent7Result(BaseModel):
    issue_type: Literal["bug", "feature", "question"]
    docs_read: Optional[bool] = Field(None, description="For questions with docs_url: was the docs page really read")
    classification_reason: str
    labels: list[str]
    comment: str
    analysis: dict[str, Any]


def run_bug_triage_flow(req: Agent7Request) -> dict[str, Any]:
    run_id, _ = new_run_dir("agent7")
    flow = BugTriageFlow()
    flow.kickoff(inputs={"title": req.title, "body": req.body, "docs_url": str(req.docs_url or "")})
    s = flow.state
    return {
        "run_id": run_id, "steps": s.steps,
        "result": Agent7Result(issue_type=s.issue_type, classification_reason=s.classification_reason,
                               docs_read=was_read(s.docs_url) if (s.docs_url and s.issue_type == "question") else None,
                               labels=s.labels, comment=s.comment, analysis=s.analysis),
    }


# =============================================================================
# 08 Content Repurposing Flow  (Flow + Crews, parallel + and_)
# load_article -> extract_points -> LinkedIn Crew | Twitter Crew | Newsletter Crew (side by side)
# -> and_ -> publish_pack (3 files)
# =============================================================================


class KeyPoints(BaseModel):
    title: str
    main_message: str
    key_points: list[str] = Field(description="5-7 key points")
    target_audience: str


class LinkedInPost(BaseModel):
    hook: str = Field(description="First 1-2 lines that make people click 'see more'")
    body: str
    call_to_action: str
    hashtags: list[str]


class TwitterThread(BaseModel):
    tweets: list[str] = Field(description="Exactly 6 tweets, each under 280 characters")


class Newsletter(BaseModel):
    subject_line: str
    intro: str
    bullets: list[str] = Field(description="Exactly 3 bullets")
    closing: str


class RepurposeState(BaseModel):
    source_url: str = ""
    article_text: str = ""
    run_dir: str = ""
    points: dict[str, Any] = {}
    linkedin: dict[str, Any] = {}
    twitter: dict[str, Any] = {}
    newsletter: dict[str, Any] = {}
    files: dict[str, str] = {}
    steps: list[str] = []


def _single_agent_crew(role: str, goal: str, backstory: str, description: str, expected: str, schema: type[T]) -> T:
    agent = make_agent(role, goal, backstory, temperature=0.7)
    task = Task(description=description, expected_output=expected, agent=agent, output_pydantic=schema)
    Crew(agents=[agent], tasks=[task], verbose=CREW_VERBOSE).kickoff()
    return task_pydantic(task, schema)


class ContentRepurposingFlow(Flow[RepurposeState]):
    @start()
    def load_article(self):
        self.state.steps.append("load_article")
        if self.state.source_url and not self.state.article_text:
            text = scrape_url(self.state.source_url, max_chars=20000)  # ScrapeWebsiteTool
            if text.startswith("Could not read"):
                raise ValueError(text)
            self.state.article_text = text
        if word_count(self.state.article_text) < 80:
            raise ValueError("The article is too short (need at least ~80 words).")

    @listen(load_article)
    def extract_points(self):
        self.state.steps.append("extract_points (direct LLM call)")
        p = llm_structured(
            "Extract the essence of this article for repurposing. Ignore navigation, ads and cookie text.\n\n"
            f"ARTICLE:\n{self.state.article_text[:20000]}",
            KeyPoints, light=False,
        )
        self.state.points = p.model_dump()

    def _points_text(self) -> str:
        p = self.state.points
        return (f"Title: {p['title']}\nMain message: {p['main_message']}\nAudience: {p['target_audience']}\n"
                "Key points:\n" + "\n".join(f"- {k}" for k in p["key_points"]))

    @listen(extract_points)
    def run_linkedin_crew(self):
        self.state.steps.append("LinkedIn Crew")
        post = _single_agent_crew(
            "LinkedIn Ghostwriter", "Write LinkedIn posts that get engagement",
            "You write professional, human LinkedIn posts with a strong hook and short lines.",
            f"Write a LinkedIn post (about 150 words total) from these points:\n{self._points_text()}\n"
            "Start with a scroll-stopping hook, use short paragraphs, end with a question or call to action, "
            "add 3-5 relevant hashtags. Only use facts from the points.",
            "Hook, body, call to action, hashtags.", LinkedInPost,
        )
        self.state.linkedin = post.model_dump()

    @listen(extract_points)
    def run_twitter_crew(self):
        self.state.steps.append("Twitter Crew")
        thread = _single_agent_crew(
            "Twitter/X Thread Writer", "Write punchy, informative threads",
            "You turn articles into viral but accurate threads.",
            f"Write a thread of EXACTLY 6 tweets from these points:\n{self._points_text()}\n"
            "Tweet 1 is the hook, tweets 2-5 each deliver one key point, tweet 6 is the takeaway/CTA. "
            "Number them '1/6' ... '6/6'. Each tweet MUST be under 270 characters. Only use facts from the points.",
            "Exactly 6 tweets.", TwitterThread,
        )
        tweets = [t.strip() for t in thread.tweets if t.strip()][:6]
        # remove a duplicated counter at the end, e.g. "1/6 ... text 1/6"
        tweets = [re.sub(r"\s+\d/6$", "", t) if re.match(r"^\d/6", t) else t for t in tweets]
        tweets = [t if len(t) <= 280 else t[:277].rstrip() + "..." for t in tweets]
        self.state.twitter = {"tweets": tweets}

    @listen(extract_points)
    def run_newsletter_crew(self):
        self.state.steps.append("Newsletter Crew")
        letter = _single_agent_crew(
            "Newsletter Editor", "Write short newsletter sections readers love",
            "You write warm, skimmable email newsletters.",
            f"Write a newsletter section from these points:\n{self._points_text()}\n"
            "Give a subject line, a 2-3 sentence intro, EXACTLY 3 bullets with the key takeaways, and a one-line closing.",
            "Subject, intro, 3 bullets, closing.", Newsletter,
        )
        letter.bullets = letter.bullets[:3]
        self.state.newsletter = letter.model_dump()

    @listen(and_(run_linkedin_crew, run_twitter_crew, run_newsletter_crew))
    def publish_pack(self):
        self.state.steps.append("publish_pack (3 files saved)")
        li, tw, nl = self.state.linkedin, self.state.twitter, self.state.newsletter
        files = {
            "linkedin_post.md": f"{li['hook']}\n\n{li['body']}\n\n{li['call_to_action']}\n\n" + " ".join(
                h if h.startswith("#") else f"#{h}" for h in li["hashtags"]),
            "twitter_thread.md": "\n\n---\n\n".join(tw["tweets"]),
            "newsletter.md": f"**Subject:** {nl['subject_line']}\n\n{nl['intro']}\n\n"
                             + "\n".join(f"- {b}" for b in nl["bullets"]) + f"\n\n{nl['closing']}",
        }
        for name, content in files.items():
            save_file(Path(self.state.run_dir), name, content)
        self.state.files = files
        return files


class Agent8Result(BaseModel):
    source: str
    key_points: KeyPoints
    linkedin_post: LinkedInPost
    twitter_thread: list[str]
    newsletter: Newsletter


def run_repurpose_flow(url: str, text: str) -> dict[str, Any]:
    run_id, run_dir = new_run_dir("agent8")
    flow = ContentRepurposingFlow()
    flow.kickoff(inputs={"source_url": url, "article_text": text, "run_dir": str(run_dir)})
    s = flow.state
    return {
        "run_id": run_id, "steps": s.steps,
        "result": Agent8Result(source=url or "pasted text / uploaded file", key_points=KeyPoints(**s.points),
                               linkedin_post=LinkedInPost(**s.linkedin), twitter_thread=s.twitter["tweets"],
                               newsletter=Newsletter(**s.newsletter)),
        "files": s.files,
    }


# =============================================================================
# 09 Lead Qualification Flow  (Flow + Crews, router)
# capture_lead -> Enrich Crew (scrapes website) -> score_lead (hot/warm/cold)
# -> Outreach Crew | add_to_nurture | archive_lead -> or_ -> log_lead (leads.csv)
# =============================================================================


class CompanyProfile(BaseModel):
    company_name: str
    industry: str
    what_they_do: str
    estimated_size: str = Field(description="e.g. '1-10', '11-50', '51-200', '200+' or 'unknown'")
    target_customers: str
    buying_signals: list[str]
    likely_needs: list[str]


class LeadScore(BaseModel):
    score: int = Field(ge=0, le=100)
    reasoning: str
    fit_signals: list[str]
    concerns: list[str]


class OutreachEmail(BaseModel):
    subject: str
    body: str


class LeadState(BaseModel):
    name: str = ""
    email: str = ""
    company_website: str = ""
    notes: str = ""
    product_description: str = ""
    ideal_customer_profile: str = ""
    profile: dict[str, Any] = {}
    score: int = 0
    tier: str = ""
    score_reasoning: str = ""
    fit_signals: list[str] = []
    concerns: list[str] = []
    action: str = ""
    outreach_email: dict[str, Any] = {}
    steps: list[str] = []


LEADS_CSV = OUTPUT_DIR / "agent9" / "leads.csv"
NURTURE_CSV = OUTPUT_DIR / "agent9" / "nurture_list.csv"


class LeadQualificationFlow(Flow[LeadState]):
    @start()
    def capture_lead(self):
        self.state.steps.append("capture_lead")
        self.state.name = self.state.name.strip()

    @listen(capture_lead)
    def run_enrich_crew(self):
        self.state.steps.append("Enrich Crew (scrapes the website)")
        agent = make_agent("Lead Research Analyst", "Build an accurate company profile from the lead's website",
                           "You are a B2B researcher. You only state what the website shows and use 'unknown' otherwise.",
                           tools=[LimitedScrapeWebsiteTool()], temperature=0.2)
        task = Task(description=f"Scrape {self.state.company_website} and build a company profile. "
                                f"Extra notes from sales: {self.state.notes or 'none'}",
                    expected_output="Company profile with industry, what they do, size, customers, buying signals, needs.",
                    agent=agent, output_pydantic=CompanyProfile)
        Crew(agents=[agent], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.profile = task_pydantic(task, CompanyProfile).model_dump()
        if not was_read(self.state.company_website):
            self.state.profile["buying_signals"] = self.state.profile.get("buying_signals", []) + [
                "NOTE: the website could not be read, so this profile is based only on the lead's details"]

    @router(run_enrich_crew)
    def score_lead(self):
        s = llm_structured(
            "You are a sales operations analyst. Score this lead 0-100 for fit with our product.\n"
            "70-100 = strong fit and clear need (hot), 40-69 = some fit (warm), 0-39 = poor fit (cold).\n\n"
            f"OUR PRODUCT: {self.state.product_description}\n"
            f"IDEAL CUSTOMER PROFILE: {self.state.ideal_customer_profile}\n"
            f"LEAD: {self.state.name}, {self.state.email}\nNOTES: {self.state.notes}\n"
            f"COMPANY PROFILE: {json.dumps(self.state.profile)}",
            LeadScore, light=False,
        )
        self.state.score, self.state.score_reasoning = s.score, s.reasoning
        self.state.fit_signals, self.state.concerns = s.fit_signals, s.concerns
        self.state.tier = "hot" if s.score >= 70 else "warm" if s.score >= 40 else "cold"
        self.state.steps.append(f"score_lead: {s.score}/100 -> '{self.state.tier}'")
        return self.state.tier

    @listen("hot")
    def run_outreach_crew(self):
        self.state.steps.append("Outreach Crew (personal email draft)")
        agent = make_agent("Sales Development Representative", "Write personal outreach emails that get replies",
                           "You write short, specific, non-pushy B2B emails that reference the prospect's business.",
                           temperature=0.6)
        task = Task(description=f"Write a personal outreach email to {self.state.name} at "
                                f"{self.state.profile.get('company_name')}.\nOur product: {self.state.product_description}\n"
                                f"Their profile: {json.dumps(self.state.profile)}\nWhy they fit: {self.state.score_reasoning}\n"
                                "Under 140 words, mention one specific detail about their business, one clear benefit, "
                                "and a soft call to action for a 15-minute call. Sign as 'The Sales Team'.",
                    expected_output="Email subject and body.", agent=agent, output_pydantic=OutreachEmail)
        Crew(agents=[agent], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.outreach_email = task_pydantic(task, OutreachEmail).model_dump()
        self.state.action = "outreach email drafted"

    @listen("warm")
    def add_to_nurture(self):
        self.state.steps.append("add_to_nurture (weekly tips list)")
        append_csv(NURTURE_CSV, {"added_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                 "name": self.state.name, "email": self.state.email,
                                 "company": self.state.profile.get("company_name", ""), "list": "weekly tips"})
        self.state.action = "added to weekly tips nurture list"

    @listen("cold")
    def archive_lead(self):
        self.state.steps.append("archive_lead (saved, no action)")
        self.state.action = "archived, no action"

    @listen(or_(run_outreach_crew, add_to_nurture, archive_lead))
    def log_lead(self):
        self.state.steps.append("log_lead -> leads.csv")
        append_csv(LEADS_CSV, {
            "logged_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "name": self.state.name, "email": self.state.email,
            "company": self.state.profile.get("company_name", ""), "website": self.state.company_website,
            "industry": self.state.profile.get("industry", ""), "score": self.state.score,
            "tier": self.state.tier, "action": self.state.action,
        })


class Agent9Request(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Rahul Verma"])
    company_website: HttpUrl = Field(examples=["https://www.example-bakery.com"])
    email: str = Field("", max_length=200)
    notes: str = Field("", max_length=2000, description="Anything the lead said, e.g. from a form")
    product_description: str = Field(min_length=10, max_length=2000,
                                      examples=["An AI tool that automates invoice processing for small businesses"])
    ideal_customer_profile: str = Field(min_length=10, max_length=2000,
                                        examples=["Small and mid-size businesses (10-200 staff) handling 100+ invoices a month"])


class Agent9Result(BaseModel):
    lead: str
    website_read: bool = Field(description="False means the site could not be scraped, so the profile is limited")
    company_profile: CompanyProfile
    score: int
    tier: Literal["hot", "warm", "cold"]
    score_reasoning: str
    fit_signals: list[str]
    concerns: list[str]
    action: str
    outreach_email: Optional[OutreachEmail] = None


def run_lead_flow(req: Agent9Request) -> dict[str, Any]:
    run_id, _ = new_run_dir("agent9")
    flow = LeadQualificationFlow()
    flow.kickoff(inputs={**req.model_dump(), "company_website": str(req.company_website)})
    s = flow.state
    return {
        "run_id": run_id, "steps": s.steps,
        "result": Agent9Result(lead=s.name, website_read=was_read(s.company_website),
                               company_profile=CompanyProfile(**s.profile), score=s.score, tier=s.tier,
                               score_reasoning=s.score_reasoning, fit_signals=s.fit_signals, concerns=s.concerns,
                               action=s.action,
                               outreach_email=OutreachEmail(**s.outreach_email) if s.outreach_email else None),
        "files": {"leads.csv": LEADS_CSV.read_text(encoding="utf-8") if LEADS_CSV.exists() else ""},
    }


# =============================================================================
# 10 Approval Report Flow  (Flow + Crews, @human_feedback)
# collect_topic -> Research Crew (3 agents) -> Writing Crew -> review_draft (@human_feedback)
# -> check_decision -> approved: publish_report (final.md) | revise: Revision Crew -> back to review
#
# Over REST the human step is two calls: the first returns the draft + flow_id and pauses
# (HumanFeedbackPending, saved in SQLite); the second sends the decision and resumes the flow.
# =============================================================================

FLOW_DB = SQLiteFlowPersistence(str(OUTPUT_DIR / "flows.db"))


class APIFeedbackProvider(HumanFeedbackProvider):
    """Pauses the flow instead of asking on the console; the API resumes it later."""

    def request_feedback(self, context, flow):
        raise HumanFeedbackPending(context=context)


class Source(BaseModel):
    title: str
    url: str


class ResearchBrief(BaseModel):
    key_findings: list[str]
    statistics: list[str] = Field(description="Facts with numbers, each with its source")
    sources: list[Source]


class ApprovalState(BaseModel):
    topic: str = ""
    audience: str = ""
    research: dict[str, Any] = {}
    draft: str = ""
    revision_count: int = 0
    feedback_history: list[str] = []
    final_report: str = ""
    final_file: str = ""
    steps: list[str] = []


class ApprovalReportFlow(Flow[ApprovalState]):
    @start()
    def collect_topic(self):
        self.state.steps.append("collect_topic")

    @listen(collect_topic)
    def run_research_crew(self):
        self.state.steps.append("Research Crew (Lead Researcher, Fact Checker, Source Curator)")
        researcher = make_agent("Lead Researcher", "Gather current, relevant facts about {topic} for {audience}",
                                "You research thoroughly with web search and keep the source URL for every fact.",
                                tools=[duckduckgo_search], temperature=0.2)
        checker = make_agent("Fact Checker", "Verify each finding and remove anything unsupported",
                             "You double-check claims with a second search and flag weak sources.",
                             tools=[duckduckgo_search], temperature=0.1)
        curator = make_agent("Source Curator", "Organize verified findings and sources into a research brief",
                             "You turn verified research into a clean, well-sourced brief. You only list sources "
                             "whose URLs appeared in this run's search results - never from memory.", temperature=0.2)
        t1 = Task(description="Research '{topic}' for {audience}. Run 2-3 searches. Collect key findings and "
                              "statistics with their source URLs.",
                  expected_output="10 findings, each with a source URL.", agent=researcher)
        t2 = Task(description="Fact-check the findings. Verify the most important claims with a search, remove or "
                              "correct anything unsupported, and mark which sources are strongest.",
                  expected_output="The verified findings with sources.", agent=checker, context=[t1])
        t3 = Task(description="Create the final research brief from the verified findings. Only include sources "
                              "whose URLs appeared in the search results above. If live search was unavailable, "
                              "return an EMPTY sources list and make the first key finding: 'Live web search was "
                              "unavailable, so these findings come from general knowledge and should be verified.'",
                  expected_output="Key findings, statistics with sources, and the list of sources.",
                  agent=curator, context=[t2], output_pydantic=ResearchBrief)
        Crew(agents=[researcher, checker, curator], tasks=[t1, t2, t3], verbose=CREW_VERBOSE).kickoff(
            inputs={"topic": self.state.topic, "audience": self.state.audience})
        brief = task_pydantic(t3, ResearchBrief)
        brief.sources = [Source(**x) for x in verified_only([x.model_dump() for x in brief.sources], key="url")]
        if not brief.sources:
            note = ("Live web search returned no usable sources, so these findings come from general "
                    "knowledge and should be verified before publishing.")
            if not any("general knowledge" in f.lower() for f in brief.key_findings):
                brief.key_findings.insert(0, note)
        self.state.research = brief.model_dump()

    @listen(run_research_crew)
    def run_writing_crew(self):
        self.state.steps.append("Writing Crew (Report Writer)")
        writer = make_agent("Report Writer", f"Write clear, well-structured reports for {self.state.audience}",
                            "You are a professional analyst-writer who writes reports decision makers trust.",
                            temperature=0.5)
        task = Task(description=f"Write a report on '{self.state.topic}' for {self.state.audience} using ONLY "
                                "this research brief:\n" + json.dumps(self.state.research) +
                                "\nStructure: '# <Title>', '## Executive Summary', 3-4 '##' sections, "
                                "'## Recommendations', '## Sources' (Markdown links to the brief's sources only; "
                                "if there are none, write 'No verified sources'). 500-800 words.",
                    expected_output="A Markdown report of 500-800 words.", agent=writer)
        out = Crew(agents=[writer], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.draft = strip_fences(out.raw)
        return self.state.draft

    @listen(or_(run_writing_crew, "revised"))
    @human_feedback(message="Review the draft report: approve it or ask for changes.", provider=APIFeedbackProvider())
    def review_draft(self):
        self.state.steps.append("review_draft (@human_feedback: waiting for a person)")
        return self.state.draft

    @router(review_draft)
    def check_decision(self, result):
        decision = json.loads(result.feedback or '{"decision": "approved"}')
        self.state.feedback_history.append(f"{decision['decision']}: {decision.get('notes', '')}".strip(": "))
        label = "approved" if decision["decision"] == "approved" else "revise"
        self.state.steps.append(f"check_decision -> '{label}'")
        return label

    @listen("approved")
    def publish_report(self):
        self.state.steps.append("publish_report -> final.md")
        self.state.final_report = self.state.draft
        run_dir = OUTPUT_DIR / "agent10" / self.state.id
        save_file(run_dir, "final.md", self.state.final_report)
        self.state.final_file = str(run_dir / "final.md")
        return self.state.final_report

    @listen("revise")
    def run_revision_crew(self):
        self.state.revision_count += 1
        self.state.steps.append(f"Revision Crew (revision {self.state.revision_count})")
        notes = json.loads(self.last_human_feedback.feedback).get("notes", "")
        editor = make_agent("Revision Editor", "Revise reports precisely according to reviewer feedback",
                            "You apply every reviewer note faithfully while keeping facts tied to the research.",
                            temperature=0.4)
        task = Task(description=f"Revise this report according to the reviewer's notes.\n\nREVIEWER NOTES:\n{notes}\n\n"
                                f"RESEARCH BRIEF:\n{json.dumps(self.state.research)}\n\nCURRENT DRAFT:\n{self.state.draft}\n\n"
                                "Return the complete revised report in Markdown, keeping the same structure.",
                    expected_output="The full revised Markdown report.", agent=editor)
        out = Crew(agents=[editor], tasks=[task], verbose=CREW_VERBOSE).kickoff()
        self.state.draft = strip_fences(out.raw)

    @router(run_revision_crew)
    def back_to_review(self):
        self.state.steps.append("back to review")
        return "revised"


class Agent10Request(BaseModel):
    """Start: send `topic` and `audience`. Review: send `flow_id` and `decision` (+ `notes` to revise)."""

    topic: Optional[str] = Field(None, min_length=3, max_length=200, examples=["Impact of AI on healthcare jobs"])
    audience: Optional[str] = Field(None, min_length=2, max_length=150, examples=["Hospital managers"])
    flow_id: Optional[str] = Field(None, description="From the first response, to submit the review")
    decision: Optional[Literal["approved", "revise"]] = None
    notes: str = Field("", max_length=3000, description="Required when decision is 'revise'")

    @model_validator(mode="after")
    def _check_mode(self):
        if self.flow_id:
            if not self.decision:
                raise ValueError("decision ('approved' or 'revise') is required with flow_id")
            if self.decision == "revise" and len(self.notes.strip()) < 5:
                raise ValueError("notes are required when decision is 'revise'")
        elif not (self.topic and self.audience):
            raise ValueError("Send topic and audience to start, or flow_id and decision to review")
        return self


class Agent10Result(BaseModel):
    flow_id: str
    topic: str
    audience: str
    revision_count: int
    revisions_left: int
    report: str = Field(description="The draft (pending_review) or the published report (completed)")
    research: ResearchBrief
    feedback_history: list[str]
    next_step: str


def _agent10_payload(flow: ApprovalReportFlow, pending: bool) -> dict[str, Any]:
    s = flow.state
    left = max(MAX_REVISIONS - s.revision_count, 0)
    next_step = (
        f"POST /agent10 with {{\"flow_id\": \"{s.id}\", \"decision\": \"approved\"}} to publish, or "
        f"\"decision\": \"revise\" with \"notes\" ({left} revisions left)." if pending
        else "Published. final.md is saved."
    )
    return {
        "run_id": s.id, "steps": s.steps, "status": "pending_review" if pending else "completed",
        "result": Agent10Result(flow_id=s.id, topic=s.topic, audience=s.audience, revision_count=s.revision_count,
                                revisions_left=left, report=s.draft if pending else s.final_report,
                                research=ResearchBrief(**s.research), feedback_history=s.feedback_history,
                                next_step=next_step),
        "files": {} if pending else {"final.md": s.final_report},
    }


def run_approval_flow(req: Agent10Request) -> dict[str, Any]:
    if not req.flow_id:
        flow = ApprovalReportFlow(persistence=FLOW_DB)
        result = flow.kickoff(inputs={"topic": req.topic, "audience": req.audience})
        return _agent10_payload(flow, pending=isinstance(result, HumanFeedbackPending))

    try:
        flow = ApprovalReportFlow.from_pending(req.flow_id, FLOW_DB)
    except ValueError:
        raise HTTPException(404, f"No report is waiting for review with flow_id '{req.flow_id}'. "
                                 "It may be finished already, or the server restarted.")
    if req.decision == "revise" and flow.state.revision_count >= MAX_REVISIONS:
        raise HTTPException(409, f"Maximum of {MAX_REVISIONS} revisions reached. Send decision 'approved'.")
    result = flow.resume(json.dumps({"decision": req.decision, "notes": req.notes}))
    return _agent10_payload(flow, pending=isinstance(result, HumanFeedbackPending))


# =============================================================================
# FastAPI app and routes
# =============================================================================

app = FastAPI(
    title="CREWAI - 10 CrewAI Agents",
    description="Ten CrewAI projects (Crews and Flows) on the Gemini free tier. Each route is one project.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECTS = {
    "agent1": "Blog Post Crew",
    "agent2": "Competitor Analysis Crew",
    "agent3": "Meeting Notes Crew",
    "agent4": "Data Report Crew",
    "agent5": "Customer Support Flow",
    "agent6": "Resume Screening Flow",
    "agent7": "Bug Triage Flow",
    "agent8": "Content Repurposing Flow",
    "agent9": "Lead Qualification Flow",
    "agent10": "Approval Report Flow",
}


# The website (React build in frontend/dist) is served by this same app, so one Render
# service hosts both. Without a build, "/" keeps returning the JSON index.
FRONTEND_DIST = (Path(__file__).parent / "frontend" / "dist").resolve()


@app.get("/api", tags=["info"])
def api_index():
    return {"name": "CREWAI", "docs": "/docs", "agents": {f"/{k}": v for k, v in PROJECTS.items()}}


@app.get("/", tags=["info"], include_in_schema=False)
def index():
    if (FRONTEND_DIST / "index.html").is_file():
        return FileResponse(FRONTEND_DIST / "index.html")
    return api_index()


@app.get("/health", tags=["info"])
def health():
    return {"status": "ok", "gemini_key_set": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
            "model": GEMINI_MODEL, "light_model": GEMINI_LIGHT_MODEL, "fallbacks": GEMINI_FALLBACK_MODELS}


@app.post("/agent1", response_model=AgentResponse[Agent1Result], tags=["Crews"], summary="01 Blog Post Crew")
def agent1(req: Agent1Request):
    """Researcher (DuckDuckGo) -> Writer (600-word draft) -> Editor -> blog_post.md"""
    return run_agent("agent1", PROJECTS["agent1"], lambda: run_blog_post_crew(req))


@app.post("/agent2", response_model=AgentResponse[Agent2Result], tags=["Crews"], summary="02 Competitor Analysis Crew")
def agent2(req: Agent2Request):
    """Hierarchical: a manager_llm delegates to Site Scraper, Pricing Analyst, News Analyst and Strategist -> report.md"""
    return run_agent("agent2", PROJECTS["agent2"], lambda: run_competitor_crew(req))


@app.post("/agent3", response_model=AgentResponse[Agent3Result], tags=["Crews"], summary="03 Meeting Notes Crew")
def agent3(
    transcript_text: str = Form("", description="Paste the transcript here, or upload a file below"),
    transcript_file: Optional[UploadFile] = File(None, description=".txt, .md or .vtt"),
    meeting_title: str = Form("Meeting Notes", max_length=150),
):
    """Summarizer, Action Finder and Decision Logger run in parallel (async_execution) -> Formatter -> notes.md"""
    text = transcript_text.strip()
    if transcript_file is not None and transcript_file.filename:
        name, data = read_upload(transcript_file, (".txt", ".md", ".vtt"))
        text = decode_text(data, name).strip()
    if word_count(text) < 30:
        raise HTTPException(422, "Provide a meeting transcript (at least 30 words) as text or a file")
    return run_agent("agent3", PROJECTS["agent3"], lambda: run_meeting_notes_crew(text, meeting_title))


@app.post("/agent4", response_model=AgentResponse[Agent4Result], tags=["Crews"], summary="04 Data Report Crew")
def agent4(
    csv_text: str = Form("", description="Paste CSV content here, or upload a file below"),
    csv_file: Optional[UploadFile] = File(None, description="sales.csv"),
    report_title: str = Form("Weekly Sales Report", max_length=150),
):
    """Data Analyst (pandas tool, output_pydantic) -> Insight Writer (top 3) -> Reviewer (checks numbers) -> report.md"""
    text = csv_text.strip()
    if csv_file is not None and csv_file.filename:
        name, data = read_upload(csv_file, (".csv",))
        text = decode_text(data, name).strip()
    if text.count("\n") < 1:
        raise HTTPException(422, "Provide a CSV with a header row and at least one data row")
    return run_agent("agent4", PROJECTS["agent4"], lambda: run_data_report_crew(text, report_title))


@app.post("/agent5", response_model=AgentResponse[Agent5Result], tags=["Flows"], summary="05 Customer Support Flow")
def agent5(req: Agent5Request):
    """receive_ticket -> categorize_ticket -> route_by_category -> handler -> resolve_ticket"""
    return run_agent("agent5", PROJECTS["agent5"], lambda: run_support_flow(req))


@app.post("/agent6", response_model=AgentResponse[Agent6Result], tags=["Flows"], summary="06 Resume Screening Flow")
def agent6(
    job_description: str = Form(..., min_length=30, max_length=8000),
    resumes: list[UploadFile] = File(default=[], description="Up to 10 resumes (.pdf, .txt, .md)"),
    resume_text: str = Form("", description="Or paste one resume as text"),
    threshold: int = Form(7, ge=1, le=10, description="Shortlist if score >= threshold"),
):
    """load_resumes -> score_resume -> check_score -> Summary Crew | draft_rejection -> save_results (results.csv)"""
    items: list[tuple[str, bytes]] = []
    for up in resumes or []:
        if up is not None and up.filename:
            items.append(read_upload(up, (".pdf", ".txt", ".md")))
    if resume_text.strip():
        items.append(("pasted_resume.txt", resume_text.strip().encode("utf-8")))
    if not items:
        raise HTTPException(422, "Upload at least one resume or paste resume_text")
    if len(items) > 10:
        raise HTTPException(422, "Maximum 10 resumes per request")
    names = [n for n, _ in items]
    if len(set(names)) != len(names):
        raise HTTPException(422, "Resume file names must be unique")
    return run_agent("agent6", PROJECTS["agent6"], lambda: run_resume_flow(job_description.strip(), threshold, items))


@app.post("/agent7", response_model=AgentResponse[Agent7Result], tags=["Flows"], summary="07 Bug Triage Flow")
def agent7(req: Agent7Request):
    """read_issue -> classify_issue -> route_type -> Bug | Feature | Answer Crew -> post_reply (label + comment)"""
    return run_agent("agent7", PROJECTS["agent7"], lambda: run_bug_triage_flow(req))


@app.post("/agent8", response_model=AgentResponse[Agent8Result], tags=["Flows"], summary="08 Content Repurposing Flow")
def agent8(
    article_url: str = Form("", description="URL of the article"),
    article_text: str = Form("", description="Or paste the article"),
    article_file: Optional[UploadFile] = File(None, description="Or upload .txt / .md"),
):
    """load_article -> extract_points -> LinkedIn | Twitter | Newsletter Crews (parallel) -> and_ -> publish_pack"""
    text = article_text.strip()
    if article_file is not None and article_file.filename:
        name, data = read_upload(article_file, (".txt", ".md"))
        text = decode_text(data, name).strip()
    url = article_url.strip()
    if url:
        try:
            url = str(HttpUrl(url))
        except Exception:  # noqa: BLE001
            raise HTTPException(422, "article_url is not a valid http(s) URL")
    if not url and not text:
        raise HTTPException(422, "Provide article_url, article_text or article_file")
    return run_agent("agent8", PROJECTS["agent8"], lambda: run_repurpose_flow("" if text else url, text))


@app.post("/agent9", response_model=AgentResponse[Agent9Result], tags=["Flows"], summary="09 Lead Qualification Flow")
def agent9(req: Agent9Request):
    """capture_lead -> Enrich Crew -> score_lead -> Outreach Crew | add_to_nurture | archive_lead -> log_lead (leads.csv)"""
    return run_agent("agent9", PROJECTS["agent9"], lambda: run_lead_flow(req))


@app.post("/agent10", response_model=AgentResponse[Agent10Result], tags=["Flows"], summary="10 Approval Report Flow")
def agent10(req: Agent10Request):
    """Call 1 {topic, audience} -> draft + flow_id (pending_review).
    Call 2 {flow_id, decision: approved | revise, notes} -> published report, or a revised draft to review again."""
    return run_agent("agent10", PROJECTS["agent10"], lambda: run_approval_flow(req))


if FRONTEND_DIST.is_dir():
    if (FRONTEND_DIST / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def website(full_path: str):
        """Static files from the build, otherwise index.html (client-side routes like /projects/...)."""
        target = (FRONTEND_DIST / full_path).resolve()
        if full_path and target.is_file() and FRONTEND_DIST in target.parents:
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
