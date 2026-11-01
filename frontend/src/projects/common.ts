import type { FlowNode } from './types'

/** First node of every workflow: the browser sends the form to the API. */
export function requestNode(endpoint: string, what: string, extra = ''): FlowNode {
  return {
    id: 'request',
    label: 'Your input',
    sub: `POST ${endpoint}`,
    kind: 'input',
    say: 'Your input is on its way!',
    simple: `You fill in ${what} and press the button. The website sends it to the CREWAI server.`,
    technical: `The browser sends an HTTP POST to ${endpoint}. FastAPI validates every field with a Pydantic model (or form/file checks) before any AI call is made, so bad input is rejected with a 422 error and a clear message.${extra ? ' ' + extra : ''}`,
  }
}

/** Last node of every workflow: the JSON response comes back. */
export function responseNode(what: string, extra = ''): FlowNode {
  return {
    id: 'response',
    label: 'Your result',
    sub: 'JSON response',
    kind: 'output',
    say: "And here's your final result!",
    simple: `The finished ${what} comes back to this page and is shown in the result panel.`,
    technical: `The API returns one JSON envelope used by every project: status, run_id, duration_seconds, steps (what actually ran), result (validated by a Pydantic response model) and files (the content of every saved file).${extra ? ' ' + extra : ''}`,
  }
}
