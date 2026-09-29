# 📊 Neo4j Graph Schema & Cypher Query Library

This specification documents the graph data model, schema constraints, relationship semantics, and core Cypher query library used in **CareerOS**.

---

## 📐 Graph Data Model

```
(:User) -------[:BUILT]--------> (:Project) -------[:USES_TECH]--------> (:Skill)
   |                                                                        ^
   |---[:ATTENDED]---> (:University)                                        |
   |                         ^                                              |
   |---[:HAS_SKILL]----------+----------------------------------------------+
   |                         |                                              |
   |---[:CONNECTED_TO]---> (:Person) ---[:ATTENDED]                         |
   |                          |                                             |
   |                          +--------[:WORKS_AT]-----> (:Company)         |
   |                                                       |                |
   |                                                       +--[:POSTED]--> (:Job) --[:REQUIRES_SKILL]-+
   |                                                       |                |
   +---[:PARTICIPATED_IN]--> (:Opportunity) <---[:SPONSORS]+                |
                                   |                                        |
                                   +---[:REQUIRES_SKILL]--------------------+
```

---

## 🏷️ Node Specifications

### 1. `(:User)`
Represents the authenticated platform user.
- `id` (String, Unique): Supabase User UUID.
- `email` (String): Primary email address.
- `full_name` (String): Candidate name.
- `github_username` (String, Optional): Linked GitHub handle.
- `created_at` (Datetime): Account creation timestamp.

### 2. `(:Project)`
Represents a software repository or portfolio project.
- `id` (String, Unique): Unique hash or `github:{owner}:{repo_name}`.
- `name` (String): Project name.
- `description` (String): Cleaned summary.
- `repo_url` (String, Optional): GitHub repository URL.
- `stars_count` (Integer): GitHub stargazer count.
- `primary_language` (String): Main programming language.

### 3. `(:Skill)`
Represents a technical competence, framework, library, or tool.
- `name` (String, Unique): Standardized skill identifier (e.g. `"FastAPI"`, `"PostgreSQL"`).
- `category` (String): `"Language"`, `"Framework"`, `"Database"`, `"Cloud"`, `"DevOps"`, or `"AI/ML"`.
- `embedding` (List of Floats, Optional): 768-dim / 1536-dim vector for semantic skill grouping.

### 4. `(:University)`
Represents an academic institution.
- `name` (String, Unique): Standardized institution name (e.g. `"Stanford University"`).
- `location` (String, Optional): City/State/Country.

### 5. `(:Company)`
Represents an employer, sponsor, or hiring organization.
- `name` (String, Unique): Standardized company title (e.g. `"Google"`, `"Stripe"`, `"Flipkart"`).
- `domain` (String, Optional): Primary website domain.
- `ats_platform` (String, Optional): `"greenhouse"`, `"lever"`, `"unstop"`, or `"custom"`.

### 6. `(:Job)`
Represents an active vacancy.
- `id` (String, Unique): External ATS job ID or UUID.
- `title` (String): Job position title.
- `location` (String): Remote / City.
- `department` (String, Optional): Engineering / Product / Infra.
- `url` (String): Direct application link.
- `is_active` (Boolean): Current vacancy status.
- `posted_date` (Datetime): Date posted.
- `embedding` (List of Floats, Optional): Vector embedding of requirements.

### 7. `(:Opportunity)`
Represents a hackathon, hiring challenge, case competition, or fellowship.
- `id` (String, Unique): `unstop:{event_id}` or `devpost:{slug}`.
- `title` (String): Event title (e.g. `"Flipkart GRiD 6.0"`).
- `type` (String): `"Hackathon"`, `"HiringChallenge"`, `"CaseCompetition"`, `"Fellowship"`.
- `platform` (String): `"Unstop"`, `"Devpost"`, `"MLH"`, `"Kaggle"`.
- `url` (String): Registration & event URL.
- `prize_pool` (String, Optional): Reward or cash prize (e.g. `"$50,000"`, `"₹10,00,000"`).
- `offers_ppi` (Boolean): Direct interview / hiring shortlist flag.
- `deadline` (Datetime): Registration closing date.
- `is_active` (Boolean): Active status.

### 8. `(:Person)`
Represents a 1st-degree or 2nd-degree professional contact (e.g., imported from LinkedIn).
- `id` (String, Unique): Composite hash `linkedin:{first_name}_{last_name}_{company}`.
- `name` (String): Contact full name.
- `position` (String): Current or last known job title.
- `connected_date` (Date, Optional): LinkedIn connection timestamp.

---

## 🔗 Relationship Definitions

| Relationship | Source Node | Target Node | Properties |
| :--- | :--- | :--- | :--- |
| `[:BUILT]` | `(:User)` | `(:Project)` | `role`, `start_date`, `end_date` |
| `[:USES_TECH]` | `(:Project)` | `(:Skill)` | `proficiency`, `lines_of_code` |
| `[:HAS_SKILL]` | `(:User)` | `(:Skill)` | `source` (*"github"*, *"resume"*), `verified_at` |
| `[:ATTENDED]` | `(:User)` / `(:Person)` | `(:University)` | `degree`, `grad_year` |
| `[:WORKS_AT]` | `(:Person)` | `(:Company)` | `current` (*boolean*), `title` |
| `[:POSTED]` | `(:Company)` | `(:Job)` | `created_at` |
| `[:SPONSORS]` | `(:Company)` | `(:Opportunity)` | `track_name`, `is_lead_sponsor` |
| `[:REQUIRES_SKILL]`| `(:Job)` / `(:Opportunity)` | `(:Skill)` | `is_mandatory` (*boolean*), `min_years` |
| `[:PARTICIPATED_IN]`| `(:User)` / `(:Person)` | `(:Opportunity)` | `rank`, `won_prize` (*boolean*), `year` |
| `[:CONNECTED_TO]`| `(:User)` | `(:Person)` | `source` (*"linkedin"*), `strength` |

---

## ⚙️ Schema Constraints & Vector Indexes

Execute these queries on Neo4j initialization:

```cypher
// Uniqueness Constraints
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT skill_name_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT company_name_unique IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT university_name_unique IF NOT EXISTS FOR (u:University) REQUIRE u.name IS UNIQUE;
CREATE CONSTRAINT job_id_unique IF NOT EXISTS FOR (j:Job) REQUIRE j.id IS UNIQUE;
CREATE CONSTRAINT opportunity_id_unique IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;

// Performance Lookup Indexes
CREATE INDEX job_active_index IF NOT EXISTS FOR (j:Job) ON (j.is_active);
CREATE INDEX opp_active_index IF NOT EXISTS FOR (o:Opportunity) ON (o.is_active);
CREATE INDEX skill_category_index IF NOT EXISTS FOR (s:Skill) ON (s.category);

// Vector Index for Semantic Matching (Cosine Similarity)
CREATE VECTOR INDEX job_embeddings_idx IF NOT EXISTS
FOR (j:Job) ON (j.embedding)
OPTIONS {indexConfig: {
 `vector.dimensions`: 768,
 `vector.similarity_function`: 'cosine'
}};
```

---

## 📚 Core Cypher Query Library

### 1. Ingest User GitHub Projects & Stack
```cypher
MERGE (u:User {id: $user_id})
MERGE (p:Project {id: $project_id})
  ON CREATE SET p.name = $project_name, 
                p.description = $description,
                p.repo_url = $repo_url,
                p.stars_count = $stars_count,
                p.primary_language = $primary_language
MERGE (u)-[:BUILT]->(p)
WITH p
UNWIND $skills AS skill_data
MERGE (s:Skill {name: skill_data.name})
  ON CREATE SET s.category = skill_data.category
MERGE (p)-[:USES_TECH]->(s)
MERGE (u)-[:HAS_SKILL {source: 'github'}]->(s);
```

### 2. Multi-Hop Hidden Referral Path Discovery
```cypher
MATCH (u:User {id: $user_id})
MATCH (j:Job {id: $job_id})<-[:POSTED]-(c:Company)
MATCH (conn:Person)-[:WORKS_AT]->(c)
WHERE (u)-[:CONNECTED_TO]->(conn) 
   OR EXISTS {
     MATCH (u)-[:ATTENDED]->(univ:University)<-[:ATTENDED]-(conn)
   }
OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)<-[:ATTENDED]-(conn)
RETURN conn.name AS referrer_name,
       conn.position AS referrer_position,
       c.name AS company_name,
       univ.name AS shared_alumni_school,
       CASE 
         WHEN (u)-[:CONNECTED_TO]->(conn) THEN "1st Degree LinkedIn Connection"
         ELSE "University Alumni Bridge"
       END AS connection_type;
```

### 3. Job Match Percentage & Skill Gap Discovery
```cypher
MATCH (u:User {id: $user_id})
MATCH (j:Job {is_active: true})
MATCH (j)-[:REQUIRES_SKILL]->(req:Skill)
WITH u, j, collect(req.name) AS all_required
OPTIONAL MATCH (u)-[:HAS_SKILL]->(user_skill:Skill)
WHERE user_skill.name IN all_required
WITH j, all_required, collect(user_skill.name) AS matched_skills
WITH j, all_required, matched_skills,
     size(matched_skills) * 1.0 / size(all_required) AS match_ratio,
     [s IN all_required WHERE NOT s IN matched_skills] AS missing_skills
WHERE match_ratio >= 0.50
RETURN j.id AS job_id,
       j.title AS job_title,
       j.location AS location,
       round(match_ratio * 100, 1) AS match_score,
       matched_skills,
       missing_skills
ORDER BY match_score DESC
LIMIT 25;
```

### 4. Fetch Candidate Portfolio Knowledge Graph Subgraph
```cypher
MATCH (u:User {id: $user_id})-[r1:BUILT]->(p:Project)-[r2:USES_TECH]->(s:Skill)
RETURN u, r1, p, r2, s;
```

### 5. Ingest & Link Hackathon / Hiring Challenge (Unstop / Devpost)
```cypher
MERGE (opp:Opportunity {id: $opportunity_id})
  ON CREATE SET opp.title = $title,
                opp.type = $type,
                opp.platform = $platform,
                opp.url = $url,
                opp.prize_pool = $prize_pool,
                opp.offers_ppi = $offers_ppi,
                opp.deadline = datetime($deadline),
                opp.is_active = true
WITH opp
UNWIND $sponsor_companies AS comp_name
MERGE (c:Company {name: comp_name})
MERGE (c)-[:SPONSORS]->(opp)
WITH opp
UNWIND $required_skills AS skill_name
MERGE (s:Skill {name: skill_name})
MERGE (opp)-[:REQUIRES_SKILL]->(s);
```
