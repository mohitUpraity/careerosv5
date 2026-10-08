import json
import logging
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.database import neo4j_client
from app.services.llm_service import llm_service
from app.services.github_service import github_service

logger = logging.getLogger(__name__)

BENCHMARK_ANALYSIS_PROMPT = """
You are a Principal Career Strategist and Staff-level Engineering Hiring Lead.
Analyze the side-by-side comparison between a Candidate and a Benchmark Peer (e.g., Staff Engineer / Target Level Peer).

Candidate Profile:
- Name: {candidate_name}
- Total Repos: {candidate_repos_count}
- Code-Verified Skills: {candidate_skills}
- Primary Languages: {candidate_languages}

Benchmark Peer Profile:
- Name / Handle: {peer_name}
- Title / Role: {peer_role}
- Total Repos: {peer_repos_count}
- Code-Verified Skills: {peer_skills}
- Primary Languages: {peer_languages}

Shared Skills: {shared_skills}
Skills Candidate Has That Peer Lacks: {candidate_unique_skills}
Skills Peer Has That Candidate Lacks (Skill Gap): {peer_unique_skills}

Generate a deep, actionable, high-velocity Gap Analysis & Strategic Roadmap for the candidate.
Return strictly valid JSON with this exact schema:
{{
  "candidate_score": 75,
  "peer_score": 92,
  "experience_gap_summary": "1-2 sentence high level summary of the experience delta",
  "critical_skill_gaps": [
    {{
      "skill": "Skill Name",
      "priority": "High|Medium|Low",
      "impact": "Why this skill matters for senior/staff level",
      "action_item": "Specific project or implementation idea to build and prove this skill"
    }}
  ],
  "candidate_superpowers": [
    "Skill or architectural strength where candidate outperforms the peer"
  ],
  "strategic_roadmap": [
    {{
      "phase": "Phase 1: Immediate Gap Closing (Weeks 1-2)",
      "milestones": ["Actionable milestone 1", "Actionable milestone 2"]
    }},
    {{
      "phase": "Phase 2: High-Impact Open Source / Architecture Proof (Weeks 3-4)",
      "milestones": ["Actionable milestone 1", "Actionable milestone 2"]
    }}
  ],
  "hiring_manager_verdict": "A blunt, encouraging 2-sentence assessment from a Silicon Valley Tech Lead on how close the candidate is to matching or surpassing this peer."
}}
"""

class BenchmarkService:
    @classmethod
    async def get_user_peers(cls, user_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all benchmark peers created by or assigned to the current user.
        """
        query = """
        MATCH (u:User {id: $user_id})-[:HAS_BENCHMARK_PEER]->(p:BenchmarkPeer)
        OPTIONAL MATCH (p)-[:BUILT]->(pr:Project)
        OPTIONAL MATCH (pr)-[:USES]->(s:Skill)
        RETURN p.id AS id,
               p.name AS name,
               p.github_username AS github_username,
               p.role AS role,
               p.company AS company,
               p.avatar_url AS avatar_url,
               p.bio AS bio,
               p.created_at AS created_at,
               count(DISTINCT pr) AS repos_count,
               collect(DISTINCT s.name) AS skills
        ORDER BY p.created_at DESC
        """
        try:
            records = await neo4j_client.run_read_query(query, {"user_id": user_id})
            peers = []
            for r in records:
                peers.append({
                    "id": r["id"],
                    "name": r["name"] or r["github_username"] or "Benchmark Peer",
                    "github_username": r["github_username"] or "",
                    "role": r["role"] or "Staff Engineer",
                    "company": r["company"] or "Top Tech",
                    "avatar_url": r["avatar_url"] or (f"https://github.com/{r['github_username']}.png" if r["github_username"] else ""),
                    "bio": r["bio"] or "",
                    "repos_count": r["repos_count"] or 0,
                    "skills": [s for s in r["skills"] if s]
                })
            
            # If user has no custom peers yet, provide a curated default benchmark peer
            if not peers:
                peers.append({
                    "id": f"default_peer_{user_id}",
                    "name": "Staff ML & Systems Peer",
                    "github_username": "staff-ml-engineer",
                    "role": "Staff Distributed Systems Engineer",
                    "company": "Scale AI / Google DeepMind",
                    "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                    "bio": "Specializes in high-throughput GraphRAG, distributed inference, Kubernetes operators, and low-latency C++ kernels.",
                    "repos_count": 8,
                    "skills": ["Python", "C++", "Rust", "CUDA", "Kubernetes", "Distributed Systems", "GraphRAG", "vLLM", "Triton", "FastAPI", "Neo4j"]
                })
            return peers
        except Exception as e:
            logger.error(f"Error fetching benchmark peers for {user_id}: {e}")
            return []

    @classmethod
    async def add_benchmark_peer(
        cls,
        user_id: str,
        github_username: Optional[str] = None,
        name: Optional[str] = None,
        role: Optional[str] = None,
        company: Optional[str] = None,
        custom_skills: Optional[List[str]] = None,
        github_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Ingests a new peer via GitHub profile scan or custom specifications.
        """
        handle = (github_username or "").strip().lower()
        peer_id = f"peer_{user_id}_{handle or 'custom'}_{int(neo4j_client.driver is not None)}"
        display_name = name or (f"@{handle}" if handle else "Senior Benchmark Peer")
        target_role = role or "Senior Software Engineer"
        target_company = company or "Target Tech"
        avatar = f"https://github.com/{handle}.png" if handle else ""
        bio = ""

        extracted_skills: List[str] = list(custom_skills or [])
        repos_data = []

        # If GitHub username provided, scan real GitHub profile
        if handle:
            try:
                raw_repos = await github_service.fetch_user_repositories(
                    username=handle,
                    github_token=github_token or settings.GITHUB_PERSONAL_ACCESS_TOKEN,
                    max_repos=10,
                    include_forks=False
                )
                for r in raw_repos:
                    lang = r.get("language")
                    if lang and lang not in extracted_skills:
                        extracted_skills.append(lang)
                    
                    # Extract topics / tags
                    topics = r.get("topics", [])
                    for top in topics:
                        if top and top not in extracted_skills:
                            extracted_skills.append(top.capitalize())
                    
                    repos_data.append({
                        "name": r.get("name"),
                        "description": r.get("description", ""),
                        "stars": r.get("stargazers_count", 0),
                        "language": lang or "General",
                        "url": r.get("html_url", "")
                    })
            except Exception as ge:
                logger.warning(f"Could not fetch public GitHub repos for {handle}: {ge}")

        # Ingest into Neo4j
        cypher = """
        MERGE (u:User {id: $user_id})
        MERGE (p:BenchmarkPeer {id: $peer_id})
        SET p.name = $name,
            p.github_username = $github_username,
            p.role = $role,
            p.company = $company,
            p.avatar_url = $avatar_url,
            p.bio = $bio,
            p.created_at = datetime()
        MERGE (u)-[:HAS_BENCHMARK_PEER]->(p)
        """
        await neo4j_client.run_write_query(cypher, {
            "user_id": user_id,
            "peer_id": peer_id,
            "name": display_name,
            "github_username": handle,
            "role": target_role,
            "company": target_company,
            "avatar_url": avatar,
            "bio": bio
        })

        # Attach Repos & Skills in Neo4j
        for repo in repos_data:
            repo_id = f"peer_repo_{peer_id}_{repo['name']}"
            repo_cypher = """
            MATCH (p:BenchmarkPeer {id: $peer_id})
            MERGE (pr:Project {id: $repo_id})
            SET pr.name = $name,
                pr.description = $description,
                pr.primary_language = $language,
                pr.stars = $stars,
                pr.url = $url
            MERGE (p)-[:BUILT]->(pr)
            """
            await neo4j_client.run_write_query(repo_cypher, {
                "peer_id": peer_id,
                "repo_id": repo_id,
                "name": repo["name"],
                "description": repo["description"],
                "language": repo["language"],
                "stars": repo["stars"],
                "url": repo["url"]
            })
            if repo["language"]:
                skill_cypher = """
                MATCH (pr:Project {id: $repo_id})
                MERGE (s:Skill {id: $skill_id})
                SET s.name = $skill_name
                MERGE (pr)-[:USES]->(s)
                """
                await neo4j_client.run_write_query(skill_cypher, {
                    "repo_id": repo_id,
                    "skill_id": f"skill_{repo['language'].lower()}",
                    "skill_name": repo["language"]
                })

        return {
            "status": "success",
            "peer": {
                "id": peer_id,
                "name": display_name,
                "github_username": handle,
                "role": target_role,
                "company": target_company,
                "avatar_url": avatar,
                "repos_count": len(repos_data),
                "skills": extracted_skills
            }
        }

    @classmethod
    async def compare_candidate_vs_peer(
        cls,
        user_id: str,
        peer_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Runs complete AST & Graph-driven Gap Analysis between candidate and target benchmark peer.
        """
        # 1. Fetch Candidate's Graph Data
        candidate_cypher = """
        MATCH (u:User {id: $user_id})
        OPTIONAL MATCH (u)-[:BUILT]->(p:Project)
        OPTIONAL MATCH (p)-[:USES]->(ps:Skill)
        OPTIONAL MATCH (u)-[verification:HAS_SKILL]->(vs:Skill)
        WHERE verification.is_verified = true
        OPTIONAL MATCH (u)-[:CONNECTED_TO]->(c:Contact)
        RETURN u.name AS name,
               count(DISTINCT p) AS repos_count,
               sum(p.stars) AS total_stars,
               collect(DISTINCT p.primary_language) AS languages,
               collect(DISTINCT ps.name) + collect(DISTINCT vs.name) AS skills,
               count(DISTINCT c) AS connections_count
        """
        cand_res = await neo4j_client.run_read_query(candidate_cypher, {"user_id": user_id})
        cand_data = cand_res[0] if cand_res else {}

        candidate_name = cand_data.get("name") or "Candidate"
        cand_repos_count = cand_data.get("repos_count", 0)
        cand_stars = cand_data.get("total_stars", 0) or 0
        cand_languages = [l for l in cand_data.get("languages", []) if l]
        cand_skills = list(set([s for s in cand_data.get("skills", []) if s]))
        cand_connections = cand_data.get("connections_count", 0)

        # 2. Fetch Peer Data
        peer_name = "Staff ML & Systems Peer"
        peer_role = "Staff Distributed Systems Engineer"
        peer_company = "Scale AI / Google DeepMind"
        peer_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        peer_repos_count = 8
        peer_stars = 340
        peer_languages = ["Python", "C++", "Rust", "CUDA"]
        peer_skills = ["Python", "C++", "Rust", "CUDA", "Kubernetes", "Distributed Systems", "GraphRAG", "vLLM", "Triton", "FastAPI", "Neo4j", "Docker"]
        peer_handle = "staff-ml-engineer"

        if peer_id and not peer_id.startswith("default_peer"):
            peer_cypher = """
            MATCH (p:BenchmarkPeer {id: $peer_id})
            OPTIONAL MATCH (p)-[:BUILT]->(pr:Project)
            OPTIONAL MATCH (pr)-[:USES]->(ps:Skill)
            RETURN p.name AS name,
                   p.role AS role,
                   p.company AS company,
                   p.avatar_url AS avatar_url,
                   p.github_username AS github_username,
                   count(DISTINCT pr) AS repos_count,
                   sum(pr.stars) AS total_stars,
                   collect(DISTINCT pr.primary_language) AS languages,
                   collect(DISTINCT ps.name) AS skills
            """
            peer_res = await neo4j_client.run_read_query(peer_cypher, {"peer_id": peer_id})
            if peer_res and peer_res[0].get("name"):
                pr = peer_res[0]
                peer_name = pr["name"] or peer_name
                peer_role = pr["role"] or peer_role
                peer_company = pr["company"] or peer_company
                peer_avatar = pr["avatar_url"] or peer_avatar
                peer_handle = pr["github_username"] or ""
                peer_repos_count = pr["repos_count"] or peer_repos_count
                peer_stars = pr["total_stars"] or peer_stars
                peer_languages = [l for l in pr.get("languages", []) if l] or peer_languages
                peer_skills = list(set([s for s in pr.get("skills", []) if s])) or peer_skills

        # Compute Sets
        cand_set = set([s.lower() for s in cand_skills])
        peer_set = set([s.lower() for s in peer_skills])

        shared_skills = [s for s in cand_skills if s.lower() in peer_set]
        candidate_unique_skills = [s for s in cand_skills if s.lower() not in peer_set]
        peer_unique_skills = [s for s in peer_skills if s.lower() not in cand_set]

        # 3. Request LLM Deep Strategic Breakdown
        user_prompt = BENCHMARK_ANALYSIS_PROMPT.format(
            candidate_name=candidate_name,
            candidate_repos_count=cand_repos_count,
            candidate_skills=", ".join(cand_skills) or "None code-verified yet",
            candidate_languages=", ".join(cand_languages) or "None",
            peer_name=peer_name,
            peer_role=peer_role,
            peer_repos_count=peer_repos_count,
            peer_skills=", ".join(peer_skills),
            peer_languages=", ".join(peer_languages),
            shared_skills=", ".join(shared_skills) or "None yet",
            candidate_unique_skills=", ".join(candidate_unique_skills) or "None",
            peer_unique_skills=", ".join(peer_unique_skills) or "None"
        )

        ai_eval = await llm_service.chat_json(
            system_prompt="You are a Principal Engineering Career Strategist and Hiring Lead.",
            user_prompt=user_prompt
        )

        if not ai_eval or not isinstance(ai_eval, dict):
            # Fallback deterministic comparison
            ai_eval = {
                "candidate_score": 72 if cand_repos_count > 0 else 25,
                "peer_score": 90,
                "experience_gap_summary": f"The benchmark peer holds strong mastery in distributed infra ({', '.join(peer_unique_skills[:3])}), while candidate demonstrates solid core foundations.",
                "critical_skill_gaps": [
                    {
                        "skill": s,
                        "priority": "High" if i < 2 else "Medium",
                        "impact": "Crucial for scaling concurrent systems and distributed AI orchestration.",
                        "action_item": f"Build a hands-on production repository implementing {s} with unit tests and benchmark throughput metrics."
                    } for i, s in enumerate(peer_unique_skills[:4])
                ],
                "candidate_superpowers": candidate_unique_skills[:3] or ["Rapid prototyping", "Modern web stack agility"],
                "strategic_roadmap": [
                    {
                        "phase": "Phase 1: Implement Missing Core Architecture",
                        "milestones": [
                            f"Build proof-of-concept incorporating {peer_unique_skills[0] if peer_unique_skills else 'distributed caching'}",
                            "Publish benchmarks and AST-verifiable code to GitHub"
                        ]
                    },
                    {
                        "phase": "Phase 2: Scale and Public Demonstration",
                        "milestones": [
                            "Containerize and deploy with high availability CI/CD",
                            "Draft targeted technical post on architectural trade-offs"
                        ]
                    }
                ],
                "hiring_manager_verdict": "Candidate has strong fundamental agility. Bridging 2-3 key systems skills will place them on par with staff-level benchmarks."
            }

        return {
            "status": "success",
            "candidate": {
                "name": candidate_name,
                "repos_count": cand_repos_count,
                "stars_count": cand_stars,
                "languages": cand_languages,
                "skills": cand_skills,
                "connections_count": cand_connections
            },
            "peer": {
                "id": peer_id or f"default_peer_{user_id}",
                "name": peer_name,
                "github_username": peer_handle,
                "role": peer_role,
                "company": peer_company,
                "avatar_url": peer_avatar,
                "repos_count": peer_repos_count,
                "stars_count": peer_stars,
                "languages": peer_languages,
                "skills": peer_skills
            },
            "skill_matrix": {
                "shared_skills": shared_skills,
                "candidate_unique_skills": candidate_unique_skills,
                "missing_peer_skills": peer_unique_skills,
                "overlap_percentage": round((len(shared_skills) / max(len(peer_skills), 1)) * 100)
            },
            "ai_analysis": ai_eval
        }

    @classmethod
    async def delete_peer(cls, user_id: str, peer_id: str) -> bool:
        """
        Deletes a benchmark peer and associated sub-graph nodes.
        """
        cypher = """
        MATCH (u:User {id: $user_id})-[:HAS_BENCHMARK_PEER]->(p:BenchmarkPeer {id: $peer_id})
        OPTIONAL MATCH (p)-[:BUILT]->(pr:Project)
        DETACH DELETE p, pr
        """
        await neo4j_client.run_write_query(cypher, {"user_id": user_id, "peer_id": peer_id})
        return True

benchmark_service = BenchmarkService()
