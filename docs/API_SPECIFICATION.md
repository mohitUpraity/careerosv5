# 🔌 CareerOS REST API Specification

FastAPI application routes and endpoint contracts for **CareerOS**.

---

## 🔐 Authentication & Security Headers

All requests to `/api/v1/*` (except health checks and public webhooks) require a Bearer token issued by Supabase Auth:

```http
Authorization: Bearer <SUPABASE_JWT_ACCESS_TOKEN>
Content-Type: application/json
```

---

## 🧭 Endpoint Catalog Summary

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/v1/health` | Service health and DB connectivity check |
| **Ingestion** | `POST` | `/api/v1/ingest/github` | Ingest candidate repositories via GitHub PAT / Username |
| **Ingestion** | `POST` | `/api/v1/ingest/resume` | Process and blueprint uploaded Golden Base Resume PDF |
| **Ingestion** | `POST` | `/api/v1/ingest/linkedin` | Ingest Connections.csv & Positions.csv export files |
| **Graph** | `GET` | `/api/v1/graph/subgraph` | Fetch candidate profile knowledge graph (nodes + links) |
| **Matchmaking**| `GET` | `/api/v1/jobs/matches` | Retrieve matched job vacancies with skill gap breakdown |
| **Opportunities**| `GET` | `/api/v1/opportunities/matches` | Retrieve matched hackathons, hiring challenges (Unstop/Devpost) |
| **Opportunities**| `GET` | `/api/v1/opportunities/teammates/{opp_id}` | Find alumni & connections with complementary skills |
| **Referrals** | `GET` | `/api/v1/referrals/paths/{job_id}` | Trace 1st degree and alumni referral bridges for a job |
| **Referrals** | `POST`| `/api/v1/referrals/generate-pitch`| Generate low-latency referral outreach message (Groq) |
| **Resume** | `GET` | `/api/v1/resume/blueprint` | Retrieve candidate's active JSON Layout Blueprint |
| **Resume** | `PUT` | `/api/v1/resume/blueprint` | Update / verify JSON Layout Blueprint schema |
| **Resume** | `POST`| `/api/v1/resume/tailor` | Tailor resume for job & compile PDF via WeasyPrint |

---

## 📄 Endpoint Details & Payloads

### 1. Ingest GitHub Repositories
`POST /api/v1/ingest/github`

**Request Body:**
```json
{
  "github_token": "ghp_xxxxxxxxxxxx",
  "username": "janedoe",
  "max_repos": 10
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "repos_processed": 8,
  "skills_extracted": 24,
  "nodes_merged": 33
}
```

---

### 2. Ingest Golden Base Resume
`POST /api/v1/ingest/resume`

**Request Body:**
```json
{
  "storage_path": "resumes/user_12345/golden_base.pdf"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "blueprint_generated": true,
  "detected_sections": ["EXPERIENCE", "EDUCATION", "PROJECTS", "SKILLS"],
  "skills_found": 18
}
```

---

### 3. Ingest LinkedIn CSV Package
`POST /api/v1/ingest/linkedin`

*Multipart Form Data:*
- `connections_file`: `Connections.csv`
- `positions_file`: `Positions.csv` (Optional)

**Response (200 OK):**
```json
{
  "status": "success",
  "connections_imported": 482,
  "companies_mapped": 126,
  "universities_mapped": 14
}
```

---

### 4. Fetch Candidate Portfolio Knowledge Graph Subgraph
`GET /api/v1/graph/subgraph`

**Response (200 OK):**
```json
{
  "nodes": [
    {"id": "u1", "label": "User", "properties": {"name": "Jane Doe"}},
    {"id": "p1", "label": "Project", "properties": {"name": "CareerOS", "stars": 42}},
    {"id": "s1", "label": "Skill", "properties": {"name": "FastAPI", "category": "Backend"}},
    {"id": "s2", "label": "Skill", "properties": {"name": "Neo4j", "category": "Database"}}
  ],
  "edges": [
    {"id": "e1", "source": "u1", "target": "p1", "type": "BUILT"},
    {"id": "e2", "source": "p1", "target": "s1", "type": "USES_TECH"},
    {"id": "e3", "source": "p1", "target": "s2", "type": "USES_TECH"}
  ]
}
```

---

### 5. Get Matched Job Vacancies
`GET /api/v1/jobs/matches?min_score=60&limit=10`

**Response (200 OK):**
```json
{
  "total_matches": 18,
  "items": [
    {
      "job_id": "gh_job_99214",
      "company": "Stripe",
      "title": "Backend Software Engineer",
      "location": "Remote - US",
      "match_percentage": 87.5,
      "matched_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
      "missing_skills": ["Kubernetes", "Kafka"],
      "has_referral_path": true
    }
  ]
}
```

---

### 6. Get Matched Hackathons & Competitions (Unstop / Devpost)
`GET /api/v1/opportunities/matches?type=Hackathon&has_ppi=true`

**Response (200 OK):**
```json
{
  "total_opportunities": 8,
  "items": [
    {
      "opportunity_id": "unstop:flipkart-grid-6",
      "title": "Flipkart GRiD 6.0 - Software Development Track",
      "platform": "Unstop",
      "type": "Hackathon",
      "sponsor_company": "Flipkart",
      "prize_pool": "₹10,00,000 + PPI",
      "offers_ppi": true,
      "deadline": "2026-10-15T23:59:59Z",
      "match_percentage": 83.3,
      "matched_skills": ["Python", "Distributed Systems", "Algorithms"],
      "missing_skills": ["System Design"]
    }
  ]
}
```

---

### 7. Discover Complementary Teammates for Hackathons
`GET /api/v1/opportunities/teammates/unstop:flipkart-grid-6`

**Response (200 OK):**
```json
{
  "opportunity_id": "unstop:flipkart-grid-6",
  "missing_skills_to_fill": ["System Design"],
  "suggested_teammates": [
    {
      "name": "Sarah Connor",
      "shared_context": "University of California, Berkeley (Alumni)",
      "position": "Infrastructure Engineer at Uber",
      "fills_skills": ["System Design", "Kubernetes"],
      "linkedin_profile": "linkedin.com/in/sarahconnor"
    }
  ]
}
```

---

### 8. Discover Referral Paths
`GET /api/v1/referrals/paths/{job_id}`

**Response (200 OK):**
```json
{
  "job_id": "gh_job_99214",
  "company": "Stripe",
  "referral_candidates": [
    {
      "name": "Alex Smith",
      "position": "Staff Engineer",
      "connection_type": "University Alumni Bridge",
      "shared_institution": "University of Waterloo",
      "confidence_score": 0.92
    }
  ]
}
```

---

### 7. Generate Personalized Referral Outreach Pitch (Groq LPU)
`POST /api/v1/referrals/generate-pitch`

**Request Body:**
```json
{
  "referrer_name": "Alex Smith",
  "job_id": "gh_job_99214",
  "shared_context": "Waterloo Alumni, both built distributed systems in Python",
  "tone": "friendly_professional"
}
```

**Response (200 OK):**
```json
{
  "subject": "Fellow UWaterloo alum reaching out / Stripe Backend role",
  "message_body": "Hi Alex,\n\nI hope you're having a great week! I noticed you're at Stripe working as a Staff Engineer...\n\nBest,\nJane"
}
```

---

### 8. Tailor Resume & Compile PDF
`POST /api/v1/resume/tailor`

**Request Body:**
```json
{
  "job_id": "gh_job_99214",
  "custom_notes": "Emphasize high-scale distributed graph architectures"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "pdf_download_url": "https://<supabase-id>.supabase.co/storage/v1/object/public/resumes/user_123/tailored_stripe_backend.pdf",
  "tailored_bullets_count": 4,
  "compilation_time_ms": 780
}
```
