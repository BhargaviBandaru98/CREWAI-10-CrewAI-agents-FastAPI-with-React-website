import { ChartColumn, NotebookPen, PenLine, Radar } from 'lucide-react'
import type { Project } from './types'
import { requestNode, responseNode } from './common'

export const blogPost: Project = {
  slug: 'blog-post-studio',
  endpoint: '/agent1',
  name: 'Blog Post Studio',
  tagline: 'From a topic to a researched, edited blog post',
  short: 'Give it a topic. Three AI agents research, write and edit a ~600-word blog post for you.',
  problem: 'Writing a well-researched blog post takes hours of searching, drafting and editing for every topic.',
  primary: 'Researches the web, drafts the post and edits it for tone and facts.',
  type: 'Crew',
  pattern: 'Sequential crew',
  accent: '#7C3AED',
  icon: PenLine,
  chips: ['Web search', '3 agents', 'Markdown'],
  benefits: [
    'Save hours: research, drafting and editing happen in one click.',
    'Facts stay honest: the editor removes claims that the research does not support.',
    'Ready to publish: you get clean Markdown with a title and headings.',
  ],
  howToUse: [
    'Type the topic you want to write about.',
    'Optionally say who the readers are, so the tone fits them.',
    'Press "Write my blog post" and wait about 10-30 seconds.',
    'Read, copy or download the post. Check the sources list.',
  ],
  hello: "Let's turn your idea into a blog post!",
  docs: {
    what: 'A small team of three AI agents that works like a mini newsroom: a researcher, a writer and an editor.',
    why: 'Most of the time spent on a blog post goes into research and editing. This crew does those steps for you, in order, and passes each result to the next agent.',
    canDo: ['Write blog posts on any topic', 'Adapt the tone to a specific audience', 'Get a list of the web sources that were found'],
    inputs: [
      { name: 'Topic', text: '3-200 characters, e.g. "AI in farming".' },
      { name: 'Audience', text: 'Optional. Who will read it, e.g. "small farm owners". Default: general readers.' },
    ],
    outputs: ['A ~600-word post in Markdown (title, intro, sections, conclusion)', 'The word count and title', 'The research notes and the sources found by the search tool', 'A blog_post.md file you can download'],
    backendSimple: [
      'The Researcher searches the web and writes short fact notes with links.',
      'The Writer turns only those notes into a structured draft.',
      'The Editor fixes tone and grammar and removes anything the research does not support.',
      'The final post is saved as blog_post.md and sent back to you.',
    ],
    technical: [
      'CrewAI Crew with Process.sequential: Researcher -> Writer -> Editor. Each Task gets the previous outputs through context=[...].',
      'The Researcher uses a custom @tool "DuckDuckGoSearch" (ddgs package, no API key).',
      'Every URL the search tool returns is recorded during the run; only those appear in "sources", so the list can never contain made-up links.',
      'The FileWriterTool from crewai_tools saves blog_post.md.',
      'LLM: Gemini (free tier) through a client that retries busy models and falls back to another model when a daily quota is used up.',
    ],
    tech: ['CrewAI Crew (sequential)', 'DuckDuckGo search tool', 'FileWriterTool', 'Gemini', 'FastAPI'],
    useCases: ['Company blogs', 'Student assignments and drafts', 'Newsletters and content marketing', 'Quick explainers for a new topic'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent1', 'a topic (and optionally an audience)')] },
      {
        nodes: [{
          id: 'researcher', label: 'Researcher', sub: 'DuckDuckGoSearch', kind: 'agent', match: ['Researcher'],
          say: 'First, I dig up facts on the web.',
          simple: 'The Researcher agent searches the web 2-3 times and writes 8-12 short fact notes, each with its link.',
          technical: 'Agent "Senior Research Analyst" with the custom DuckDuckGoSearch @tool. Its task asks for bullet notes with source URLs. If search fails, the tool tells the agent not to invent URLs or numbers.',
        }],
      },
      {
        nodes: [{
          id: 'writer', label: 'Writer', sub: '600-word draft', kind: 'agent', match: ['Writer'],
          say: 'Now the Writer drafts the post.',
          simple: 'The Writer turns the research notes into a draft: a catchy title, an intro, 3-4 sections and a conclusion.',
          technical: 'Agent "Blog Writer" (temperature 0.7). Its Task receives the research through context=[research] and must use only those notes.',
        }],
      },
      {
        nodes: [{
          id: 'editor', label: 'Editor', sub: 'tone + facts', kind: 'agent', match: ['Editor'],
          say: 'The Editor polishes it and checks the facts.',
          simple: 'The Editor fixes grammar and tone, removes claims the research does not support and keeps it around 600 words.',
          technical: 'Agent "Senior Editor" (temperature 0.3) with context=[research, draft]. It must return only the final post (550-650 words) with no comments.',
        }],
      },
      {
        nodes: [{
          id: 'save', label: 'Save file', sub: 'FileWriterTool', kind: 'tool', match: ['FileWriter'],
          say: 'Saving your post as a file.',
          simple: 'The finished post is saved as blog_post.md.',
          technical: 'FileWriterTool (crewai_tools) writes outputs/agent1/<run_id>/blog_post.md. The content is also returned in the response "files" field.',
        }],
      },
      { nodes: [responseNode('blog post', 'result has title, word_count, blog_post, research_notes and sources.')] },
    ],
  },
}

export const competitorRadar: Project = {
  slug: 'competitor-radar',
  endpoint: '/agent2',
  name: 'Competitor Radar',
  tagline: 'Three competitor websites in, a SWOT report out',
  short: 'Paste three competitor websites. A manager agent sends four specialists to build a full competitor report.',
  problem: 'Tracking what competitors ship, charge and say takes hours of manual browsing every week.',
  primary: 'Reads competitor sites, pricing and news, then writes a comparison and a SWOT for each.',
  type: 'Crew',
  pattern: 'Hierarchical crew',
  accent: '#0891B2',
  icon: Radar,
  chips: ['Manager agent', 'Scraping', 'SWOT'],
  benefits: [
    'One report instead of hours of tab-hopping.',
    'A SWOT table for every competitor, side by side.',
    'Honest gaps: missing prices or news are marked "not found", never guessed.',
  ],
  howToUse: [
    'Paste exactly three competitor website addresses (https://...).',
    'Optionally describe your own product to get tailored recommendations.',
    'Press "Analyze competitors". This is the biggest crew, so it can take 1-3 minutes.',
    'Read the report and check which sites were really read.',
  ],
  hello: 'Three competitors? My team of four is ready.',
  docs: {
    what: 'A team of four specialist agents led by a manager agent. The manager decides who does what, like a team lead.',
    why: 'Competitor research is repetitive: visit the site, find pricing, look for news, compare. A hierarchical crew splits that work between specialists.',
    canDo: ['Compare 3 competitors at once', 'Get a SWOT table per competitor', 'Get recommendations for your own product'],
    inputs: [
      { name: 'Competitor websites', text: 'Exactly 3 valid URLs (http or https).' },
      { name: 'Your company', text: 'Optional, up to 300 characters, to tailor the recommendations.' },
    ],
    outputs: ['A Markdown report: executive summary, comparison table, SWOT tables, news and recommendations', 'Which websites were really read (true/false)', 'The URLs the tools actually used', 'A report.md file'],
    backendSimple: [
      'A manager agent reads the four tasks and assigns each one to the best specialist.',
      'The Site Scraper reads each homepage, the Pricing Analyst looks for prices, the News Analyst searches for news.',
      'The Strategist combines everything into the final report with SWOT tables.',
      'The report is saved as report.md and sent back.',
    ],
    technical: [
      'CrewAI Crew with Process.hierarchical and manager_llm. Tasks have no fixed agent; the auto-created manager delegates each one to a co-worker in turn.',
      'Site Scraper and Pricing Analyst use ScrapeWebsiteTool (capped at 8,000 characters per page). The News Analyst uses the DuckDuckGoSearch tool.',
      'Agents are told to write "not found on site" / "No verified news found" instead of using memory.',
      'websites_read is computed from the pages the scraper actually loaded in this run.',
      'This is the most expensive route (about 30 LLM calls).',
    ],
    tech: ['CrewAI Crew (hierarchical, manager_llm)', 'ScrapeWebsiteTool', 'DuckDuckGo search tool', 'FileWriterTool', 'Gemini'],
    useCases: ['Startup market research', 'Weekly competitor tracking', 'Preparing a pitch or business plan', 'Product positioning'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent2', 'three competitor websites', 'The list must contain exactly 3 valid URLs.')] },
      {
        nodes: [{
          id: 'manager', label: 'Manager', sub: 'manager_llm', kind: 'manager', match: ['Manager'],
          say: 'The manager hands out the work.',
          simple: 'A manager agent looks at the four jobs and decides which specialist should do each one.',
          technical: 'Process.hierarchical creates a manager agent from manager_llm. It receives each task and uses CrewAI delegation tools to assign it to a co-worker, then reviews the answer.',
        }],
      },
      {
        group: { label: 'delegated by the manager', type: 'delegate' },
        nodes: [
          {
            id: 'scraper', label: 'Site Scraper', sub: 'ScrapeWebsiteTool', kind: 'agent', match: ['Site Scraper'],
            say: 'Reading each competitor homepage.',
            simple: 'Reads each competitor homepage and notes what they sell, who for, and their key features.',
            technical: 'Agent "Website Intelligence Scraper" with ScrapeWebsiteTool (text capped at 8,000 chars). Pages that fail to load return a message telling the agent not to guess.',
          },
          {
            id: 'pricing', label: 'Pricing Analyst', sub: 'reads plans', kind: 'agent', match: ['Pricing Analyst'],
            say: 'Looking for prices and plans.',
            simple: 'Looks for plans and prices (often on a /pricing page). Writes "not found on site" when there is no price.',
            technical: 'Agent "Pricing Analyst" with ScrapeWebsiteTool. Instructed to report only prices read in this run, with the URL.',
          },
          {
            id: 'news', label: 'News Analyst', sub: 'DuckDuckGoSearch', kind: 'agent', match: ['News Analyst'],
            say: 'Searching for recent news.',
            simple: 'Searches for recent launches and announcements for each competitor, with links.',
            technical: 'Agent "Market News Analyst" with the DuckDuckGoSearch tool. Writes "No verified news found" when search returns nothing.',
          },
        ],
      },
      {
        nodes: [{
          id: 'strategist', label: 'Strategist', sub: 'SWOT table', kind: 'agent', match: ['Strategist'],
          say: 'Building the SWOT tables.',
          simple: 'Combines all findings into one report: comparison table, a SWOT for each competitor, news and recommendations.',
          technical: 'The final Task has context=[sites, pricing, news] and must use only those facts. Output: Markdown with the required tables.',
        }],
      },
      {
        nodes: [{
          id: 'save', label: 'Save file', sub: 'FileWriterTool', kind: 'tool', match: ['FileWriter'],
          say: 'Saving report.md.',
          simple: 'The report is saved as report.md.',
          technical: 'FileWriterTool writes outputs/agent2/<run_id>/report.md.',
        }],
      },
      { nodes: [responseNode('competitor report', 'result also contains websites_read and sources_used.')] },
    ],
  },
}

export const meetingNotes: Project = {
  slug: 'meeting-notes',
  endpoint: '/agent3',
  name: 'Meeting Notes Assistant',
  tagline: 'Transcript in, summary + action items + decisions out',
  short: 'Paste or upload a meeting transcript. Three agents work at the same time to pull out the summary, the to-dos and the decisions.',
  problem: 'After every meeting someone must write the summary and chase action items, and details get lost.',
  primary: 'Finds the summary, every action item with owner and due date, and every decision.',
  type: 'Crew',
  pattern: 'Parallel tasks',
  accent: '#2563EB',
  icon: NotebookPen,
  chips: ['Parallel agents', 'File upload', 'Action items'],
  benefits: [
    'No more lost to-dos: every action item gets an owner and a due date.',
    'Decisions are logged separately from open questions.',
    'Fast: three agents read the transcript at the same time.',
  ],
  howToUse: [
    'Paste the meeting transcript, or upload a .txt / .md / .vtt file.',
    'Optionally give the meeting a title.',
    'Press "Create meeting notes". It usually takes 5-40 seconds.',
    'Copy the notes or download notes.md.',
  ],
  hello: 'Got a meeting transcript? I will find every to-do.',
  docs: {
    what: 'A crew where three agents read the same transcript in parallel, each looking for something different, and a fourth agent formats the notes.',
    why: 'Summaries, action items and decisions are separate jobs. Running them in parallel is faster and each agent can focus on one thing.',
    canDo: ['Summarize a meeting in 5 lines', 'Extract action items with owner and due date', 'Log decisions and who made them'],
    inputs: [
      { name: 'Transcript', text: 'Paste text or upload .txt, .md or .vtt (at least 30 words, max 5 MB).' },
      { name: 'Meeting title', text: 'Optional, used as the notes heading.' },
    ],
    outputs: ['A 5-line summary', 'An action items list (task, owner, due date)', 'A decisions list (decision, who, context)', 'Formatted notes.md'],
    backendSimple: [
      'Your transcript is saved as transcript.txt for the agents to read.',
      'The Summarizer, Action Finder and Decision Logger read it at the same time.',
      'The Formatter waits for all three and writes clean Markdown notes.',
    ],
    technical: [
      'Three Tasks with async_execution=True run concurrently; the Formatter Task has context=[summary, actions, decisions], so it waits for all of them.',
      'Each reading agent gets a FileReadTool bound to the saved transcript.txt.',
      'output_pydantic models (MeetingSummary, ActionItems, Decisions) make the lists structured and validated.',
      'Owners and dates are never invented: "Unassigned" / "Not specified" are used instead.',
    ],
    tech: ['CrewAI async tasks', 'FileReadTool', 'output_pydantic', 'FileWriterTool', 'Gemini'],
    useCases: ['Team stand-ups and syncs', 'Client calls', 'Lecture or interview transcripts', 'Project reviews'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent3', 'a transcript (text or file)', 'Files must be .txt, .md or .vtt and the text must have at least 30 words.')] },
      {
        nodes: [{
          id: 'read', label: 'Read transcript', sub: 'FileReadTool', kind: 'tool', match: ['FileReadTool'],
          say: 'Saving and reading your transcript.',
          simple: 'The transcript is saved as a file so every agent can read the exact same text.',
          technical: 'The API writes outputs/agent3/<run_id>/transcript.txt and gives each reading agent a FileReadTool bound to that path.',
        }],
      },
      {
        group: { label: 'run at the same time', type: 'parallel' },
        nodes: [
          {
            id: 'summarizer', label: 'Summarizer', sub: '5-line summary', kind: 'agent', match: ['Summarizer'],
            say: 'Summing it up in 5 lines.',
            simple: 'Writes a 5-line summary of the meeting.',
            technical: 'Task(async_execution=True, output_pydantic=MeetingSummary). The API keeps the first 5 lines.',
          },
          {
            id: 'actions', label: 'Action Finder', sub: 'owner + due date', kind: 'agent', match: ['Summarizer'],
            say: 'Finding every to-do.',
            simple: 'Lists every action item with who owns it and when it is due.',
            technical: 'Task(async_execution=True, output_pydantic=ActionItems). Missing owner -> "Unassigned", missing date -> "Not specified".',
          },
          {
            id: 'decisions', label: 'Decision Logger', sub: 'decisions made', kind: 'agent', match: ['Summarizer'],
            say: 'Writing down the decisions.',
            simple: 'Records the decisions that were agreed (not open questions).',
            technical: 'Task(async_execution=True, output_pydantic=Decisions) with decision, made_by and context.',
          },
        ],
      },
      {
        nodes: [{
          id: 'formatter', label: 'Formatter', sub: 'waits for all 3', kind: 'agent', match: ['Formatter'],
          say: 'Putting it all together.',
          simple: 'Waits for the three agents, then writes tidy notes: summary, action items table and decisions.',
          technical: 'Sync Task with context=[t_summary, t_actions, t_decisions], so it only starts after all async tasks finish. Not allowed to add new information.',
        }],
      },
      {
        nodes: [{
          id: 'save', label: 'Save file', sub: 'FileWriterTool', kind: 'tool', match: ['FileWriter'],
          say: 'Saving notes.md.',
          simple: 'The notes are saved as notes.md.',
          technical: 'FileWriterTool writes outputs/agent3/<run_id>/notes.md.',
        }],
      },
      { nodes: [responseNode('meeting notes', 'result has summary, action_items, decisions and notes_markdown.')] },
    ],
  },
}

export const salesReport: Project = {
  slug: 'sales-report-analyst',
  endpoint: '/agent4',
  name: 'Sales Report Analyst',
  tagline: 'A sales CSV in, a number-checked report out',
  short: 'Upload a sales CSV. Agents analyze it with real pandas math, write the top 3 findings and double-check every number.',
  problem: 'Weekly sales CSV files pile up, and turning them into a readable report is slow, repetitive work.',
  primary: 'Computes exact stats with pandas, writes findings and verifies each number.',
  type: 'Crew',
  pattern: 'Structured output',
  accent: '#059669',
  icon: ChartColumn,
  chips: ['pandas tool', 'Verified numbers', 'CSV upload'],
  benefits: [
    'Numbers you can trust: math is done by pandas, not guessed by the AI.',
    'A reviewer agent re-checks every number before the report is published.',
    'Works with any sales CSV: it finds revenue, date and category columns itself.',
  ],
  howToUse: [
    'Upload a .csv file or paste CSV text (first row = column names).',
    'Optionally give the report a title.',
    'Press "Analyze my data". It usually takes 10-60 seconds.',
    'Compare the report with the "ground truth" numbers computed by pandas.',
  ],
  hello: 'Numbers time! Upload a sales CSV.',
  docs: {
    what: 'A crew of three agents (analyst, insight writer, reviewer) that share a custom pandas tool, so all numbers come from real calculations.',
    why: 'AI models are bad at arithmetic. Here the math is done in Python and the agents only explain and verify it.',
    canDo: ['Get totals, averages, best and weakest segments', 'See the trend over time', 'Get 3 findings with evidence and recommendations'],
    inputs: [
      { name: 'CSV', text: 'Upload .csv or paste text with a header row and at least one data row.' },
      { name: 'Report title', text: 'Optional.' },
    ],
    outputs: ['Structured stats (row count, date range, total revenue, metrics, segments, trend)', 'Top 3 findings with evidence', 'A reviewed Markdown report, the corrections made and a "verified" flag', 'computed_stats: the pandas ground truth', 'report.md'],
    backendSimple: [
      'The CSV is saved and pandas computes the exact statistics.',
      'The Data Analyst reads those statistics and fills in a structured summary.',
      'The Insight Writer picks the 3 most important findings.',
      'The Reviewer re-checks every number with the tool and publishes the report.',
    ],
    technical: [
      'Custom BaseTool "Sales Data Analyzer" (pandas): detects the revenue column (or quantity x price), the date column (daily/weekly/monthly resampling) and category breakdowns with shares.',
      'Data Analyst uses the pandas tool + FileReadTool; output_pydantic=SalesStats.',
      'Insight Writer: output_pydantic=Findings (exactly 3). Reviewer: output_pydantic=ReviewedReport with corrections_made and all_numbers_verified.',
      'The same pandas summary is returned as computed_stats so you can verify the report yourself.',
      'Agents are told not to assume a currency the CSV does not state.',
    ],
    tech: ['CrewAI Crew (sequential)', 'Custom pandas tool', 'FileReadTool', 'output_pydantic', 'FileWriterTool', 'Gemini'],
    useCases: ['Weekly or monthly sales reports', 'Small-business dashboards', 'Class projects with datasets', 'Quick data checks before a meeting'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent4', 'a sales CSV', 'The CSV is parsed with pandas first; an unreadable CSV is rejected before any AI call.')] },
      {
        nodes: [{
          id: 'pandas', label: 'Crunch numbers', sub: 'pandas tool', kind: 'tool', match: ['FileReadTool + pandas'],
          say: 'Python does the math, not guesswork.',
          simple: 'The file is saved and pandas calculates exact totals, averages, breakdowns and trends.',
          technical: 'summarize_sales() runs once for computed_stats; the same logic is exposed to the agents as the "Sales Data Analyzer" BaseTool (with an optional group_by column).',
        }],
      },
      {
        nodes: [{
          id: 'analyst', label: 'Data Analyst', sub: 'output_pydantic', kind: 'agent', match: ['Data Analyst'],
          say: 'The analyst reads the stats.',
          simple: 'Calls the pandas tool and fills in a structured summary: rows, date range, revenue, top and weakest segments, trend.',
          technical: 'Task output_pydantic=SalesStats. Tools: SalesDataTool + FileReadTool. Told never to do mental math.',
        }],
      },
      {
        nodes: [{
          id: 'writer', label: 'Insight Writer', sub: 'top 3 findings', kind: 'agent', match: ['Insight Writer'],
          say: 'Picking the 3 findings that matter.',
          simple: 'Turns the statistics into the 3 findings a manager must know, each with its numbers.',
          technical: 'Task with context=[stats], output_pydantic=Findings (title, detail, evidence).',
        }],
      },
      {
        nodes: [{
          id: 'reviewer', label: 'Reviewer', sub: 'checks every number', kind: 'agent', match: ['Reviewer'],
          say: 'Double-checking every number.',
          simple: 'Re-checks every number with the pandas tool, fixes mistakes and writes the final report.',
          technical: 'Task output_pydantic=ReviewedReport (report_markdown, corrections_made, all_numbers_verified). Has the pandas tool to verify.',
        }],
      },
      {
        nodes: [{
          id: 'save', label: 'Save file', sub: 'FileWriterTool', kind: 'tool', match: ['FileWriter'],
          say: 'Saving report.md.',
          simple: 'The report is saved as report.md.',
          technical: 'FileWriterTool writes outputs/agent4/<run_id>/report.md.',
        }],
      },
      { nodes: [responseNode('sales report', 'result has stats, top_findings, review and computed_stats.')] },
    ],
  },
}
