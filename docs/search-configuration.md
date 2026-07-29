# Search configuration

Environment variables for the live search pipeline. Everything here is optional —
the pipeline degrades honestly when a key is absent rather than failing or
falling back to fabricated data.

## Search provider (Part 4)

Pick **one**. `SEARCH_PROVIDER` chooses explicitly; if it is unset, the first
provider with credentials wins, in the order Brave → Bing → Serper → Google PSE.

If `SEARCH_PROVIDER` names a provider whose key is missing, the pipeline resolves
to **no provider** rather than silently substituting another — a misconfigured
deployment should be visible.

| Variable | Provider | Notes |
|---|---|---|
| `SEARCH_PROVIDER` | — | `bing` \| `brave` \| `google-pse` \| `serper`. Optional. |
| `BRAVE_SEARCH_API_KEY` | Brave Search API | ~$0.003/query |
| `BING_SEARCH_API_KEY` | Bing Web Search | ~$0.005/query |
| `BING_SEARCH_ENDPOINT` | Bing | Optional; defaults to the v7.0 public endpoint |
| `SERPER_API_KEY` | Serper | ~$0.001/query |
| `GOOGLE_PSE_API_KEY` + `GOOGLE_PSE_ENGINE_ID` | Google Programmable Search | Both required; caps at 10 results/call |

**With no provider configured**, discovery runs the canonical layer only. Search
still works against curated entities; responses report reduced coverage.

## Budgets (Part 4/5)

Per user request, across every provider call it makes.

| Variable | Default | Meaning |
|---|---|---|
| `SEARCH_MAX_QUERIES` | `6` | Provider queries per search |
| `SEARCH_MAX_COST_USD` | `0.05` | Estimated spend per search |
| `SEARCH_MAX_PROVIDER_MS` | `6000` | Wall time across provider calls |

## Agentic fallback (Part 5)

Off by default. It only runs when earlier layers leave the pool short.

| Variable | Default | Meaning |
|---|---|---|
| `SEARCH_AGENT_ENABLED` | *(off)* | `on` to enable |
| `SEARCH_AGENT_MAX_ITERATIONS` | `2` | Planning loops |
| `SEARCH_AGENT_MAX_QUERIES` | `4` | Search queries |
| `SEARCH_AGENT_MAX_URLS` | `25` | Candidate URLs considered |
| `SEARCH_AGENT_MAX_EVIDENCE` | `0` | Evidence requests (the agent gathers none) |
| `SEARCH_AGENT_MAX_MS` | `4000` | Execution time |
| `SEARCH_AGENT_MAX_COST_USD` | `0.02` | Spend |

Every limit is enforced by the loop, not by prompt instructions. The default
planner is rule-based and costs nothing; a model-backed `QueryPlanner` can be
injected without changing any other code.

## Demo mode (Part 13)

| Variable | Meaning |
|---|---|
| `SEARCH_DEMO_MODE` | `on` enables the fixture corpus. **Ignored in production.** |

In production with no discovery adapter, search returns
`{ status: "error", code: "search_unavailable" }`. It never serves fixtures.

## Required owner credentials

To get web-scale discovery working, **one** search-provider key is needed. Nothing
else in this pipeline requires a credential the project does not already have.

Not configured, and deliberately so: no independent review/reputation source. The
architecture enforces the separation and reports the gap, but no vendor is
registered — GitHub, Trustpilot, Yelp, and Google Places remain prohibited by
standing project constraint, and no replacement has been approved.
