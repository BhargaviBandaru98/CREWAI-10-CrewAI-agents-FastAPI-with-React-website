import { BadgeCheck, Bug, Headset, Repeat2, Target, UserSearch } from 'lucide-react'
import type { Project } from './types'
import { requestNode, responseNode } from './common'

export const supportDesk: Project = {
  slug: 'support-ticket-desk',
  endpoint: '/agent5',
  name: 'Support Ticket Desk',
  tagline: 'Sort a support ticket and draft the reply in seconds',
  short: 'Describe a customer problem. The flow sorts it, sends it to the right team, sets the priority and drafts the reply.',
  problem: 'Support tickets arrive mixed together, and each one has to be read, sorted and sent to the right person.',
  primary: 'Classifies the ticket, routes it to billing / account / other and writes the resolution.',
  type: 'Flow',
  pattern: 'Router flow',
  accent: '#D97706',
  icon: Headset,
  chips: ['Router', 'Direct LLM calls', 'Priority'],
  benefits: [
    'Every ticket lands with the right team automatically.',
    'Urgent money and security issues get high priority.',
    'A polite, specific customer reply is ready to send.',
  ],
  howToUse: [
    "Enter the customer's name and describe their issue in their words.",
    'Optionally add their email and an existing ticket ID.',
    'Press "Route this ticket". It takes about 5-15 seconds.',
    'See where the ticket went, its priority, and the drafted reply.',
  ],
  hello: 'A new ticket? Let me find the right team.',
  docs: {
    what: 'A CrewAI Flow: a fixed, code-defined path with a router. There is no crew here; two direct LLM calls do the thinking.',
    why: 'Sorting tickets needs predictable, repeatable behavior. A Flow fixes the path in code, so the same kind of ticket always goes the same way.',
    canDo: ['Classify tickets into 5 categories', 'Route billing and account issues as high priority', 'Draft a customer reply plus internal next steps'],
    inputs: [
      { name: 'Customer name', text: 'Required, up to 100 characters.' },
      { name: 'Issue description', text: 'Required, 10-4000 characters.' },
      { name: 'Email / Ticket ID', text: 'Optional. A ticket ID is generated if you leave it empty.' },
    ],
    outputs: ['Category and the reason for it', 'The route taken (billing / account_access / other)', 'Priority and the team that handles it', 'A customer reply, internal next steps and whether to escalate to a human'],
    backendSimple: [
      'The ticket gets an ID and is stored in the flow state.',
      'An LLM call picks one of 5 categories.',
      'The router sends billing and account problems to their own handlers (high priority); everything else goes to "other".',
      'A second LLM call writes the resolution for the chosen team.',
    ],
    technical: [
      'Flow[SupportTicketState]: @start receive_ticket -> @listen categorize_ticket -> @router route_by_category.',
      'categorize_ticket uses a direct LLM call with a Pydantic schema (category is a Literal of 5 values), so the label is always valid.',
      'Handlers: @listen("billing"), @listen("account_access"), @listen("other"). The "other" handler sets medium priority for technical issues and low for feature requests.',
      'resolve_ticket listens to or_(handle_billing, handle_access, handle_other), i.e. it runs after the handler that ran, so the priority is already set.',
    ],
    tech: ['CrewAI Flow', '@start / @listen / @router / or_', 'Pydantic structured output', 'Gemini'],
    useCases: ['Help desks', 'E-commerce support inboxes', 'IT service desks', 'SaaS customer success'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent5', "the customer's name and issue")] },
      {
        nodes: [{
          id: 'receive', label: 'receive_ticket', sub: '@start()', kind: 'code', match: ['receive_ticket'],
          say: 'A ticket arrives!',
          simple: 'The flow starts: the ticket is stored and gets an ID like T-1A2B3C4D.',
          technical: '@start() method. Inputs from kickoff(inputs=...) fill SupportTicketState; a ticket_id is generated if empty.',
        }],
      },
      {
        nodes: [{
          id: 'categorize', label: 'categorize_ticket', sub: 'direct LLM call', kind: 'llm', match: ['categorize_ticket'],
          say: 'What kind of problem is this?',
          simple: 'The AI reads the issue and picks one category: billing, account access, technical, feature request or other.',
          technical: '@listen(receive_ticket). llm.call(prompt, response_model=TicketClassification) returns a validated category, confidence and reason. No crew is used.',
        }],
      },
      {
        nodes: [{
          id: 'router', label: 'route_by_category', sub: '@router', kind: 'router', match: ['route_by_category'],
          say: 'Choosing the path. One label wins.',
          simple: 'A router chooses the path: billing, account access, or "other" for everything else.',
          technical: '@router(categorize_ticket) returns "billing", "account_access" or "other". Only listeners for that label run.',
        }],
      },
      {
        group: { label: 'one path is chosen', type: 'branch' },
        nodes: [
          {
            id: 'billing', label: 'handle_billing', sub: '@listen("billing")', kind: 'code', match: ['handle_billing'],
            say: 'Billing team, high priority.',
            simple: 'Billing problems are marked high priority for the billing team.',
            technical: 'Sets priority="high", handled_by="Billing team".',
          },
          {
            id: 'access', label: 'handle_access', sub: '@listen("account_access")', kind: 'code', match: ['handle_access'],
            say: 'Account security, high priority.',
            simple: 'Login and security problems are marked high priority for the account security team.',
            technical: 'Sets priority="high", handled_by="Account security team".',
          },
          {
            id: 'other', label: 'handle_other', sub: '@listen("other")', kind: 'code', match: ['handle_other'],
            say: 'Technical, feature or other.',
            simple: 'Technical issues get medium priority (technical support); feature requests and others get low priority.',
            technical: 'Branches on the stored category: technical_issue -> medium / Technical support; feature_request -> low / Product team; other -> low / General support.',
          },
        ],
      },
      {
        nodes: [{
          id: 'resolve', label: 'resolve_ticket', sub: '@listen(or_(...))', kind: 'llm', match: ['resolve_ticket'],
          say: 'Writing the reply.',
          simple: 'The AI writes a reply to the customer, internal next steps, and whether a human should take over.',
          technical: 'Listens to or_(handle_billing, handle_access, handle_other). Direct LLM call with response_model=TicketResolution.',
        }],
      },
      { nodes: [responseNode('ticket resolution')] },
    ],
  },
}

export const resumeScreener: Project = {
  slug: 'resume-screener',
  endpoint: '/agent6',
  name: 'Resume Screener',
  tagline: 'Score resumes against a job and shortlist the best',
  short: 'Add a job description and up to 10 resumes. Each one is scored 0-10, then shortlisted with a summary or rejected with a polite email.',
  problem: 'One job post brings hundreds of resumes, and reading each one takes recruiters days.',
  primary: 'Scores each resume, then writes a candidate summary or a rejection email.',
  type: 'Flow',
  pattern: 'Router + crew',
  accent: '#DB2777',
  icon: UserSearch,
  chips: ['PDF resumes', 'Score 0-10', 'results.csv'],
  benefits: [
    'Screen up to 10 resumes in one go, ranked by score.',
    'See matched and missing skills for every candidate.',
    'Shortlisted candidates get interview tips; others get a kind email.',
  ],
  howToUse: [
    'Paste the job description (what is required and what is nice to have).',
    'Upload resumes (.pdf, .txt or .md, up to 10) and/or paste one resume as text.',
    'Choose the shortlist threshold (default 7 out of 10).',
    'Press "Screen resumes" and review the ranked candidates.',
  ],
  hello: 'Who fits the job best? Let me score them.',
  docs: {
    what: 'A Flow that runs once per resume: it scores the candidate, then a router sends them to a summary crew (shortlist) or a rejection email (reject).',
    why: 'Recruiters spend most time on the first read. This flow gives a consistent first-pass score with clear reasons.',
    canDo: ['Score candidates 0-10 with a rubric', 'Shortlist with strengths, gaps and interview focus', 'Draft polite rejection emails', 'Export results.csv'],
    inputs: [
      { name: 'Job description', text: 'Required, 30-8000 characters.' },
      { name: 'Resumes', text: 'Up to 10 files (.pdf, .txt, .md; max 5 MB each) and/or one pasted resume.' },
      { name: 'Threshold', text: '1-10. A score at or above it means shortlist. Default 7.' },
    ],
    outputs: ['Totals: screened, shortlisted, rejected', 'Per candidate: score, decision, reasoning, matched and missing skills', 'A summary (strengths, gaps, interview focus) or a rejection email', 'results.csv'],
    backendSimple: [
      'Each resume file is read (PDFs with a free PDF reader).',
      'The AI scores it 0-10 against the job, using a fixed rubric.',
      'If the score reaches the threshold, a Talent Analyst writes a summary; otherwise a polite email is drafted.',
      'Each result is added to results.csv.',
    ],
    technical: [
      'One ResumeScreeningFlow run per resume, in order (protects the free-tier rate limit).',
      'load_resumes: pypdf for PDFs, FileReadTool for text files; rejects files with too little text (e.g. scanned PDFs).',
      'score_resume: direct LLM call with response_model=ResumeScore (score is an int 0-10).',
      '@router check_score returns "shortlist" or "reject". Shortlist runs a one-agent Summary Crew (output_pydantic=CandidateSummary); reject runs draft_rejection (direct LLM call).',
      'save_results listens to or_(run_summary_crew, draft_rejection) and appends a row to results.csv.',
    ],
    tech: ['CrewAI Flow', '@router / or_', 'Summary Crew', 'pypdf', 'FileReadTool', 'Gemini'],
    useCases: ['Startup hiring', 'Campus placements', 'Recruitment agencies', 'Checking your own resume against a job'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent6', 'a job description and resumes', 'Files must be .pdf, .txt or .md, max 10, unique names.')] },
      {
        nodes: [{
          id: 'load', label: 'load_resumes', sub: '@start()', kind: 'tool', match: ['load_resumes'],
          say: 'Reading the resume.',
          simple: 'The resume is opened and its text is read. PDFs are read with a free PDF reader.',
          technical: '@start(). pypdf extracts PDF text; FileReadTool reads .txt/.md. Fewer than 50 characters -> error for that file only.',
        }],
      },
      {
        nodes: [{
          id: 'score', label: 'score_resume', sub: 'direct LLM, 0-10', kind: 'llm', match: ['score_resume'],
          say: 'Scoring against the job.',
          simple: 'The AI compares the resume with the job and gives a score from 0 to 10 with reasons and skills.',
          technical: 'Rubric: 9-10 all must-haves + most nice-to-haves, 7-8 all must-haves, 4-6 some missing, 0-3 poor. response_model=ResumeScore.',
        }],
      },
      {
        nodes: [{
          id: 'router', label: 'check_score', sub: '@router', kind: 'router', match: ['check_score'],
          say: 'Score >= threshold? One label wins.',
          simple: 'If the score is at or above your threshold the candidate is shortlisted, otherwise rejected.',
          technical: '@router(score_resume) returns "shortlist" if score >= threshold else "reject".',
        }],
      },
      {
        group: { label: 'one path is chosen', type: 'branch' },
        nodes: [
          {
            id: 'summary', label: 'Summary Crew', sub: '@listen("shortlist")', kind: 'agent', match: ['Summary Crew'],
            say: 'Shortlisted! Writing a summary.',
            simple: 'A Talent Analyst agent writes strengths, gaps, interview topics and a recommendation.',
            technical: 'One-agent Crew, Task output_pydantic=CandidateSummary. Method run_summary_crew.',
          },
          {
            id: 'reject', label: 'draft_rejection', sub: '@listen("reject")', kind: 'llm', match: ['draft_rejection'],
            say: 'Drafting a kind email.',
            simple: 'A warm, professional rejection email is drafted. It does not list weaknesses.',
            technical: 'Direct LLM call with response_model=RejectionEmail (subject, body).',
          },
        ],
      },
      {
        nodes: [{
          id: 'save', label: 'save_results', sub: 'results.csv', kind: 'code', match: ['save_results'],
          say: 'Adding the row to results.csv.',
          simple: 'The candidate is added to the results table.',
          technical: '@listen(or_(run_summary_crew, draft_rejection)) appends a CSV row (thread-safe).',
        }],
      },
      { nodes: [responseNode('ranked candidate list', 'Candidates are sorted by score; each has its own steps list.')] },
    ],
  },
}

export const issueTriage: Project = {
  slug: 'issue-triage',
  endpoint: '/agent7',
  name: 'Issue Triage Bot',
  tagline: 'Label an issue and write the reply automatically',
  short: 'Paste an issue from a project tracker. It is classified as a bug, feature or question, and the right crew writes the reply.',
  problem: 'Issues pile up without labels, so urgent bugs sit unseen next to feature requests.',
  primary: 'Classifies the issue, then a specialist crew writes severity + repro steps, a user story, or an answer from the docs.',
  type: 'Flow',
  pattern: 'Router + crews',
  accent: '#DC2626',
  icon: Bug,
  chips: ['Router', '3 crews', 'Reads docs'],
  benefits: [
    'Urgent bugs get a severity label straight away.',
    'Feature requests become proper user stories.',
    'Questions get an answer based on your docs.',
  ],
  howToUse: [
    'Paste the issue title and its description.',
    'For questions, add a docs page URL so the answer comes from your docs.',
    'Press "Triage this issue". It takes about 5-60 seconds.',
    'Copy the labels and the ready-to-post comment.',
  ],
  hello: 'Bug, feature or question? Let me check.',
  docs: {
    what: 'A Flow with a router and three different crews. Each kind of issue gets its own specialist.',
    why: 'Triage is the boring part of maintaining a project. Automatic labels and first replies mean nothing important gets lost.',
    canDo: ['Classify issues as bug / feature / question', 'Rate bug severity and write reproduction steps', 'Write user stories with acceptance criteria', 'Answer questions from a docs page'],
    inputs: [
      { name: 'Title', text: 'Required, 3-300 characters.' },
      { name: 'Body', text: 'Required, 10-8000 characters.' },
      { name: 'Docs URL', text: 'Optional http(s) link, used by the Answer Crew for questions.' },
    ],
    outputs: ['The issue type and why', 'Labels (e.g. bug, severity: high)', 'A Markdown comment ready to post', 'The full analysis from the crew', 'docs_read: whether the docs page was really read'],
    backendSimple: [
      'The AI reads the issue and decides: bug, feature or question.',
      'A router sends it to the matching crew.',
      'The crew writes its analysis: severity and steps, a user story, or an answer.',
      'Labels and a reply comment are built from that analysis.',
    ],
    technical: [
      'Flow[BugTriageState]: read_issue -> classify_issue (direct LLM, Literal type) -> @router route_type.',
      'Bug Crew: "QA Triage Engineer", output_pydantic=BugReport (severity is critical/high/medium/low with a rubric).',
      'Feature Crew: "Product Manager", output_pydantic=UserStory. Answer Crew: "Developer Support Engineer" with ScrapeWebsiteTool when docs_url is given, output_pydantic=DocsAnswer.',
      'post_reply listens to or_(all three crews) and builds labels + comment in Python. The reply is returned, not posted to a real tracker.',
    ],
    tech: ['CrewAI Flow', '@router / or_', '3 single-agent crews', 'ScrapeWebsiteTool', 'Gemini'],
    useCases: ['Open-source maintainers', 'Product teams with a public tracker', 'Internal IT request queues', 'Support teams'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent7', 'the issue title, body and an optional docs URL')] },
      {
        nodes: [{
          id: 'read', label: 'read_issue', sub: '@start()', kind: 'code', match: ['read_issue'],
          say: 'Reading the issue.',
          simple: 'The flow starts and stores the title and body.',
          technical: '@start(). Trims the inputs into BugTriageState.',
        }],
      },
      {
        nodes: [{
          id: 'classify', label: 'classify_issue', sub: 'direct LLM call', kind: 'llm', match: ['classify_issue'],
          say: 'Bug, feature or question?',
          simple: 'The AI decides if this is a bug, a feature request, or a question.',
          technical: 'llm.call(response_model=IssueClassification): issue_type is Literal["bug","feature","question"].',
        }],
      },
      {
        nodes: [{
          id: 'router', label: 'route_type', sub: '@router', kind: 'router', match: ['route_type'],
          say: 'Sending it to the right crew.',
          simple: 'A router sends the issue to the matching specialist crew.',
          technical: '@router(classify_issue) returns the issue_type label.',
        }],
      },
      {
        group: { label: 'one path is chosen', type: 'branch' },
        nodes: [
          {
            id: 'bug', label: 'Bug Crew', sub: '@listen("bug")', kind: 'agent', match: ['Bug Crew'],
            say: 'Rating severity, writing repro steps.',
            simple: 'A QA engineer agent rates the severity and writes steps to reproduce the bug.',
            technical: 'Severity rubric: critical = data loss/security/outage, high = core feature broken, medium = workaround exists, low = cosmetic. output_pydantic=BugReport.',
          },
          {
            id: 'feature', label: 'Feature Crew', sub: '@listen("feature")', kind: 'agent', match: ['Feature Crew'],
            say: 'Turning it into a user story.',
            simple: 'A product manager agent writes a user story with acceptance criteria and a priority.',
            technical: 'output_pydantic=UserStory: "As a ..., I want ..., so that ...", 3-6 acceptance criteria.',
          },
          {
            id: 'answer', label: 'Answer Crew', sub: '@listen("question")', kind: 'agent', match: ['Answer Crew'],
            say: 'Looking it up in the docs.',
            simple: 'A support engineer agent reads your docs page (if given) and answers the question.',
            technical: 'Gets ScrapeWebsiteTool only when docs_url is set. output_pydantic=DocsAnswer with confident=false when unsure.',
          },
        ],
      },
      {
        nodes: [{
          id: 'reply', label: 'post_reply', sub: 'labels + comment', kind: 'code', match: ['post_reply'],
          say: 'Labels and comment ready.',
          simple: 'Labels and a friendly reply comment are put together from the crew\'s analysis.',
          technical: '@listen(or_(run_bug_crew, run_feature_crew, run_answer_crew)). Built in Python, so the format is always consistent.',
        }],
      },
      { nodes: [responseNode('labels and reply')] },
    ],
  },
}

export const contentRemixer: Project = {
  slug: 'content-remixer',
  endpoint: '/agent8',
  name: 'Content Remixer',
  tagline: 'One article becomes a LinkedIn post, a thread and a newsletter',
  short: 'Give it an article URL or text. Three crews work side by side to write a LinkedIn post, a 6-tweet thread and a newsletter section.',
  problem: 'One long article should become a LinkedIn post, a tweet thread and a newsletter, but rewriting it three times wastes a day.',
  primary: 'Extracts the key points, then writes three formats in parallel.',
  type: 'Flow',
  pattern: 'Parallel + and_',
  accent: '#C026D3',
  icon: Repeat2,
  chips: ['Parallel crews', 'and_', '3 formats'],
  benefits: [
    'Three ready-to-post formats from one article.',
    'Fast: the three writers work at the same time.',
    'Every tweet is checked to fit the 280-character limit.',
  ],
  howToUse: [
    'Choose a source: an article URL, pasted text, or a .txt / .md file.',
    'The article needs at least about 80 words.',
    'Press "Remix my content". It usually takes 5-20 seconds.',
    'Copy each format or download the three files.',
  ],
  hello: 'One article, three formats. Watch this!',
  docs: {
    what: 'A Flow that extracts the key points once and then runs three crews in parallel, joining them with and_.',
    why: 'Repurposing content is the same job three times. Doing it in parallel from one set of key points keeps the message consistent.',
    canDo: ['Write a LinkedIn post (~150 words) with a hook and hashtags', 'Write a 6-tweet thread', 'Write a newsletter section with 3 bullets'],
    inputs: [
      { name: 'Source', text: 'One of: article URL (http/https), pasted text, or a .txt/.md file (max 5 MB).' },
    ],
    outputs: ['The key points (title, main message, 5-7 points, audience)', 'A LinkedIn post', 'A 6-tweet thread', 'A newsletter section', 'linkedin_post.md, twitter_thread.md, newsletter.md'],
    backendSimple: [
      'The article is loaded from the URL, the text or the file.',
      'The AI pulls out the title, main message and key points.',
      'Three writers (LinkedIn, Twitter, Newsletter) work at the same time from those points.',
      'When all three finish, the three files are saved.',
    ],
    technical: [
      'Flow[RepurposeState]: load_article (ScrapeWebsiteTool for URLs, up to 20,000 chars) -> extract_points (direct LLM, response_model=KeyPoints).',
      'Three methods all @listen(extract_points), so CrewAI runs them concurrently. Each is a one-agent crew with output_pydantic.',
      'publish_pack uses @listen(and_(linkedin, twitter, newsletter)): it waits for all three.',
      'Tweets are trimmed to 6 and to 280 characters in Python as a safety net.',
    ],
    tech: ['CrewAI Flow', 'Parallel listeners + and_', 'ScrapeWebsiteTool', 'FileWriterTool', 'Gemini'],
    useCases: ['Content marketing', 'Founders sharing blog posts', 'Creators and newsletters', 'Turning reports into social posts'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent8', 'an article URL, text or file')] },
      {
        nodes: [{
          id: 'load', label: 'load_article', sub: '@start()', kind: 'tool', match: ['load_article'],
          say: 'Loading your article.',
          simple: 'The article is loaded. For a URL, the page text is read from the website.',
          technical: '@start(). ScrapeWebsiteTool for URLs (max 20,000 chars). Fewer than ~80 words -> error.',
        }],
      },
      {
        nodes: [{
          id: 'extract', label: 'extract_points', sub: 'direct LLM call', kind: 'llm', match: ['extract_points'],
          say: 'Finding the key points.',
          simple: 'The AI pulls out the title, the main message, 5-7 key points and the audience.',
          technical: 'llm.call(response_model=KeyPoints). Told to ignore navigation, ads and cookie text.',
        }],
      },
      {
        group: { label: 'run side by side', type: 'parallel' },
        nodes: [
          {
            id: 'linkedin', label: 'LinkedIn Crew', sub: 'hook, ~150 words', kind: 'agent', match: ['LinkedIn Crew'],
            say: 'Writing the LinkedIn post.',
            simple: 'A LinkedIn ghostwriter writes a post with a strong hook, short paragraphs and hashtags.',
            technical: '@listen(extract_points), output_pydantic=LinkedInPost (hook, body, call_to_action, hashtags).',
          },
          {
            id: 'twitter', label: 'Twitter Crew', sub: '6-tweet thread', kind: 'agent', match: ['Twitter Crew'],
            say: 'Writing the 6-tweet thread.',
            simple: 'A thread writer creates exactly 6 tweets: a hook, 4 key points and a takeaway.',
            technical: '@listen(extract_points), output_pydantic=TwitterThread. Python then keeps 6 tweets and enforces 280 chars.',
          },
          {
            id: 'newsletter', label: 'Newsletter Crew', sub: 'intro + 3 bullets', kind: 'agent', match: ['Newsletter Crew'],
            say: 'Writing the newsletter.',
            simple: 'A newsletter editor writes a subject line, a short intro, 3 bullets and a closing line.',
            technical: '@listen(extract_points), output_pydantic=Newsletter (bullets trimmed to 3).',
          },
        ],
      },
      {
        nodes: [{
          id: 'publish', label: 'publish_pack', sub: '@listen(and_(...))', kind: 'tool', match: ['publish_pack'],
          say: 'All three done. Saving the pack!',
          simple: 'Once all three are done, the three files are saved together.',
          technical: '@listen(and_(run_linkedin_crew, run_twitter_crew, run_newsletter_crew)) saves 3 files with FileWriterTool.',
        }],
      },
      { nodes: [responseNode('content pack')] },
    ],
  },
}

export const leadScout: Project = {
  slug: 'lead-scout',
  endpoint: '/agent9',
  name: 'Lead Scout',
  tagline: 'Know if a lead is hot, warm or cold before you reply',
  short: "Enter a lead and their company website. An agent researches the company, scores the fit, and drafts an email for hot leads.",
  problem: 'Sales teams waste time on cold leads while hot leads wait days for a reply.',
  primary: 'Researches the website, scores the lead 0-100 and takes the right action.',
  type: 'Flow',
  pattern: 'Router + crews',
  accent: '#65A30D',
  icon: Target,
  chips: ['Website research', 'Hot / warm / cold', 'leads.csv'],
  benefits: [
    'Reply to the best leads first.',
    'Hot leads get a personal email draft that mentions their business.',
    'Every lead is logged, so nothing falls through the cracks.',
  ],
  howToUse: [
    "Enter the lead's name and company website.",
    'Describe your product and your ideal customer, so the score means something.',
    'Optionally add their email and any notes (e.g. what they asked).',
    'Press "Qualify this lead" and see the score, tier and next action.',
  ],
  hello: "Let's see how hot this lead is!",
  docs: {
    what: 'A Flow with an Enrich Crew (website research), a scoring router and three different actions for hot, warm and cold leads.',
    why: 'Speed matters with good leads. Automatic research and scoring tells you who to call first, and drafts the first email.',
    canDo: ['Research a company from its website', 'Score fit 0-100 against your ideal customer', 'Draft outreach emails for hot leads', 'Keep a lead log and a nurture list'],
    inputs: [
      { name: 'Name & website', text: 'Required. Website must be a valid http(s) URL.' },
      { name: 'Your product', text: 'Required, 10-2000 characters.' },
      { name: 'Ideal customer', text: 'Required, 10-2000 characters.' },
      { name: 'Email & notes', text: 'Optional.' },
    ],
    outputs: ['A company profile (industry, what they do, size, buying signals, needs)', 'website_read: whether the site could really be read', 'Score, tier and reasoning, fit signals and concerns', 'The action taken and, for hot leads, an email draft', 'leads.csv'],
    backendSimple: [
      'A research agent reads the company website and builds a profile.',
      'The AI scores the lead from 0 to 100 against your product and ideal customer.',
      '70+ is hot (email drafted), 40-69 warm (added to the weekly tips list), below 40 cold (archived).',
      'The lead is added to leads.csv.',
    ],
    technical: [
      'Flow[LeadState]: capture_lead -> Enrich Crew (ScrapeWebsiteTool, output_pydantic=CompanyProfile).',
      '@router score_lead: direct LLM call (response_model=LeadScore); the tier is computed in Python from the score, so it is always consistent.',
      'hot -> Outreach Crew (output_pydantic=OutreachEmail), warm -> add_to_nurture (nurture_list.csv), cold -> archive_lead.',
      'log_lead listens to or_(all three) and appends to leads.csv. If the website could not be scraped, the profile is flagged and website_read=false.',
    ],
    tech: ['CrewAI Flow', 'Enrich + Outreach crews', 'ScrapeWebsiteTool', '@router / or_', 'Gemini'],
    useCases: ['B2B sales teams', 'Startups doing outreach', 'Agencies qualifying inbound leads', 'Event follow-ups'],
  },
  workflow: {
    stages: [
      { nodes: [requestNode('/agent9', 'the lead, their website, your product and your ideal customer')] },
      {
        nodes: [{
          id: 'capture', label: 'capture_lead', sub: '@start()', kind: 'code', match: ['capture_lead'],
          say: 'New lead captured.',
          simple: 'The flow starts and stores the lead details.',
          technical: '@start(). Inputs fill LeadState.',
        }],
      },
      {
        nodes: [{
          id: 'enrich', label: 'Enrich Crew', sub: 'scrapes the website', kind: 'agent', match: ['Enrich Crew'],
          say: 'Researching their website.',
          simple: 'A research agent reads the company website and writes a profile: industry, what they do, size, signals and needs.',
          technical: 'Agent "Lead Research Analyst" with ScrapeWebsiteTool, output_pydantic=CompanyProfile. Uses "unknown" when the site does not say.',
        }],
      },
      {
        nodes: [{
          id: 'router', label: 'score_lead', sub: '@router', kind: 'router', match: ['score_lead'],
          say: 'Scoring 0-100. One label wins.',
          simple: 'The AI scores the fit from 0 to 100. 70+ is hot, 40-69 warm, below 40 cold.',
          technical: '@router(run_enrich_crew). LLM returns score + reasoning; the hot/warm/cold label is computed from the score in Python.',
        }],
      },
      {
        group: { label: 'one path is chosen', type: 'branch' },
        nodes: [
          {
            id: 'hot', label: 'Outreach Crew', sub: '@listen("hot")', kind: 'agent', match: ['Outreach Crew'],
            say: 'Hot lead! Drafting an email.',
            simple: 'A sales agent drafts a short, personal email that mentions their business.',
            technical: 'Agent "Sales Development Representative", output_pydantic=OutreachEmail, under 140 words.',
          },
          {
            id: 'warm', label: 'add_to_nurture', sub: '@listen("warm")', kind: 'code', match: ['add_to_nurture'],
            say: 'Warm: adding to weekly tips.',
            simple: 'The lead is added to the weekly tips list to keep them interested.',
            technical: 'Appends to nurture_list.csv.',
          },
          {
            id: 'cold', label: 'archive_lead', sub: '@listen("cold")', kind: 'code', match: ['archive_lead'],
            say: 'Cold: saved for later.',
            simple: 'The lead is saved, but no action is taken.',
            technical: 'Sets action="archived, no action".',
          },
        ],
      },
      {
        nodes: [{
          id: 'log', label: 'log_lead', sub: 'leads.csv', kind: 'code', match: ['log_lead'],
          say: 'Logged in leads.csv.',
          simple: 'Every lead is added to the lead log, whatever the tier.',
          technical: '@listen(or_(run_outreach_crew, add_to_nurture, archive_lead)) appends a row to leads.csv.',
        }],
      },
      { nodes: [responseNode('lead score and action')] },
    ],
  },
}

export const reportApproval: Project = {
  slug: 'report-approval',
  endpoint: '/agent10',
  name: 'Report Approval Desk',
  tagline: 'AI writes the report. You approve it before it is published.',
  short: 'Choose a topic. A research crew and a writer prepare a report, then it waits for you: approve it, or ask for changes.',
  problem: 'Auto-generated reports are risky to publish unchecked, but reviewing every word by hand is slow.',
  primary: 'Researches and drafts a report, pauses for your review, revises on request, then publishes.',
  type: 'Flow',
  pattern: 'Human-in-the-loop',
  accent: '#4F46E5',
  icon: BadgeCheck,
  chips: ['Human review', '5 agents', 'Revise loop'],
  benefits: [
    'Nothing is published until a person approves it.',
    'Ask for changes in plain words; a revision agent applies them.',
    'Sources are kept only if the search tool really found them.',
  ],
  howToUse: [
    'Enter a topic and who the report is for.',
    'Press "Draft my report". The research and writing take about 20-60 seconds.',
    'Read the draft. Approve it, or type what to change and request a revision (up to 3).',
    'Once approved, the final report is published as final.md.',
  ],
  hello: 'I draft, you decide. Ready?',
  docs: {
    what: 'A Flow with a human approval step. It pauses in the middle, waits for your decision, and then continues.',
    why: 'Some content should never go out without a human check. This flow makes the review a real step in the process.',
    canDo: ['Research a topic with 3 agents', 'Write a structured report', 'Revise it with your notes (up to 3 times)', 'Publish the approved version'],
    inputs: [
      { name: 'Start', text: 'Topic (3-200 characters) and audience (2-150 characters).' },
      { name: 'Review', text: 'Approve, or revise with notes (at least 5 characters). The page sends the flow_id for you.' },
    ],
    outputs: ['The draft report and research brief (findings, statistics, sources)', 'Status pending_review or completed', 'Revision count and the review history', 'final.md after approval'],
    backendSimple: [
      'Three research agents gather and fact-check information.',
      'A writer turns the research into a report.',
      'The flow pauses and waits for your decision.',
      'Approve to publish, or send notes: a revision agent edits the report and it comes back to you.',
    ],
    technical: [
      'Research Crew (Lead Researcher + Fact Checker with DuckDuckGoSearch, Source Curator) -> output_pydantic=ResearchBrief. Sources not returned by a tool in this run are removed.',
      'review_draft uses @human_feedback with a custom provider that raises HumanFeedbackPending: the flow state is saved in SQLite and the API returns status "pending_review" with a flow_id.',
      'The second call uses Flow.from_pending(flow_id) and resume(feedback). @router check_decision returns "approved" or "revise".',
      'revise -> Revision Crew -> @router back_to_review returns "revised", which triggers review_draft again (a loop). Max 3 revisions.',
    ],
    tech: ['CrewAI Flow', '@human_feedback + resume', 'SQLite persistence', '5 agents', 'DuckDuckGo search', 'Gemini'],
    useCases: ['Reports for managers or clients', 'Policy or compliance documents', 'Research summaries for a team', 'Any content that needs sign-off'],
  },
  workflow: {
    loop: { from: 'revise', to: 'review', label: 'back to review' },
    stages: [
      { nodes: [requestNode('/agent10', 'a topic and an audience', 'Later review calls send flow_id + decision instead.')] },
      {
        nodes: [{
          id: 'collect', label: 'collect_topic', sub: '@start()', kind: 'code', match: ['collect_topic'],
          say: 'Got your topic.',
          simple: 'The flow starts with your topic and audience.',
          technical: '@start(). Flow state (ApprovalState) gets an automatic id: this becomes the flow_id.',
        }],
      },
      {
        nodes: [{
          id: 'research', label: 'Research Crew', sub: '3 agents', kind: 'agent', match: ['Research Crew'],
          say: 'Three researchers at work.',
          simple: 'A researcher searches, a fact checker verifies, and a curator builds a research brief with sources.',
          technical: 'Sequential crew of 3 agents. Fact Checker re-searches key claims. Brief sources are filtered to URLs the tools returned.',
        }],
      },
      {
        nodes: [{
          id: 'write', label: 'Writing Crew', sub: 'drafts the report', kind: 'agent', match: ['Writing Crew'],
          say: 'Writing the draft.',
          simple: 'A writer turns the research brief into a 500-800 word report.',
          technical: 'Agent "Report Writer". Uses only the brief; "No verified sources" if there are none.',
        }],
      },
      {
        nodes: [{
          id: 'review', label: 'review_draft', sub: '@human_feedback', kind: 'human', match: ['review_draft'],
          say: 'Your turn! Approve or revise?',
          simple: 'The flow pauses here and waits for you. You read the draft and decide.',
          technical: '@listen(or_(run_writing_crew, "revised")) + @human_feedback. The provider raises HumanFeedbackPending; state is saved to SQLite.',
        }],
      },
      {
        nodes: [{
          id: 'decide', label: 'check_decision', sub: '@router', kind: 'router', match: ['check_decision'],
          say: 'Approved or revise? One label wins.',
          simple: 'Your decision picks the next step.',
          technical: '@router(review_draft) parses the feedback JSON and returns "approved" or "revise".',
        }],
      },
      {
        group: { label: 'one path is chosen', type: 'branch' },
        nodes: [
          {
            id: 'publish', label: 'publish_report', sub: '@listen("approved")', kind: 'tool', match: ['publish_report'],
            say: 'Approved! Publishing final.md.',
            simple: 'The approved report is published and saved as final.md.',
            technical: 'Saves outputs/agent10/<flow_id>/final.md with FileWriterTool; status becomes "completed".',
          },
          {
            id: 'revise', label: 'Revision Crew', sub: '@listen("revise")', kind: 'agent', match: ['Revision Crew'],
            say: 'Applying your notes, then back to you.',
            simple: 'A revision editor applies your notes, then the new draft comes back to you for review.',
            technical: 'Agent "Revision Editor". Then @router back_to_review returns "revised", which re-triggers review_draft.',
          },
        ],
      },
      { nodes: [responseNode('report (draft or final)', 'status is "pending_review" while it waits for you, "completed" after approval.')] },
    ],
  },
}
