---
type: "query"
date: "2026-10-31T09:36:37.913463+00:00"
question: "Which parts of the job opportunity pipeline connect ingestion, matching, resume tailoring, and interview preparation?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Opportunity", "OpportunitiesRadar.tsx", "apiService"]
---

# Q: Which parts of the job opportunity pipeline connect ingestion, matching, resume tailoring, and interview preparation?

## Answer

Expanded from original query via graph vocabulary: [opportunity, ingestion, github, linkedin, resume, interview, company, match, application, score]. The traversed graph connects the Opportunity type and OpportunitiesRadar UI to frontend API service and profile preference types. Backend code review confirms separate GitHub/LinkedIn/resume ingestion, job match, resume tailoring, and interview modules; the graph did not establish a complete automatic application or email-tracking path.

## Outcome

- Signal: useful

## Source Nodes

- Opportunity
- OpportunitiesRadar.tsx
- apiService