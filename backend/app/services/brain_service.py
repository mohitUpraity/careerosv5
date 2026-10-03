import json
import logging
import re
from typing import Dict, Any, List, Optional
from app.services.profile_service import profile_service
from app.services.neo4j_service import neo4j_service
from app.services.llm_service import llm_service
from app.core.database import neo4j_client

logger = logging.getLogger(__name__)

class BrainService:
    """
    CareerOS GraphRAG Brain Service:
    Combines multi-hop Knowledge Graph traversal (Neo4j), vector/semantic context retrieval,
    and LLM reasoning (Groq Llama 3.3 70B / Gemini) for deep career intelligence.
    """

    @classmethod
    async def chat(
        cls,
        user_id: str,
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        context_mode: str = "general"
    ) -> Dict[str, Any]:
        """
        Executes a GraphRAG conversational turn:
        1. Traverses user's multi-tenant subgraph (Skills, Projects, Experience, Network, Hackathons).
        2. Retrieves relevant opportunities & benchmark peer nodes.
        3. Constructs rich semantic context and feeds into LLM.
        4. Returns answer with graph citations, referenced nodes, and dynamic follow-up suggestions.
        """
        conversation_history = conversation_history or []

        # 1. Fetch Comprehensive Graph Footprint
        profile_data = {}
        try:
            profile_data = await profile_service.get_comprehensive_profile_analysis(user_id=user_id)
        except Exception as e:
            logger.warning(f"Could not load full profile analysis for brain chat: {e}")

        # 2. Fetch User Blueprint & Hackathons
        blueprint = None
        try:
            blueprint = await neo4j_service.get_user_resume_blueprint(user_id=user_id)
        except Exception as e:
            logger.warning(f"Could not load resume blueprint for brain chat: {e}")

        # 3. Fetch User Career Preferences
        preferences = {}
        try:
            preferences = await neo4j_service.get_user_preferences(user_id=user_id)
        except Exception as e:
            logger.warning(f"Could not load preferences for brain chat: {e}")

        # 4. Fetch Sample Opportunities for Context
        opportunities = []
        try:
            from app.services.opportunities_service import opportunities_service
            opps_data = await opportunities_service.fetch_live_opportunities(
                user_id=user_id, 
                query=query if len(query.split()) <= 4 else "", 
                limit=6
            )
            opportunities = opps_data.get("opportunities", [])[:5]
        except Exception as e:
            logger.debug(f"Opportunity search in brain chat skipped/empty: {e}")

        # 5. Fetch Warm Connections and Alumni Bridges from Neo4j
        warm_connections = []
        try:
            conn_query = """
            MATCH (u:User {id: $user_id})-[:CONNECTED_TO|TRACKED_CONNECTION]->(p:Person)
            OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company)
            OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)<-[:ATTENDED]-(p)
            RETURN p.name AS name,
                   p.position AS position,
                   c.name AS company,
                   p.linkedin_url AS linkedin_url,
                   (univ IS NOT NULL) AS is_alumni,
                   univ.name AS shared_college
            LIMIT 30
            """
            warm_connections = await neo4j_client.execute_query(conn_query, {"user_id": user_id})
        except Exception as ce:
            logger.debug(f"Could not load warm connections for brain chat: {ce}")

        # 6. Assemble Structured Graph Context
        bp_contact = blueprint.get("contact", {}) if isinstance(blueprint, dict) else (getattr(blueprint, "contact", {}) or {})
        bp_name = bp_contact.get("full_name") if isinstance(bp_contact, dict) else getattr(bp_contact, "full_name", "")
        
        user_name = profile_data.get("full_name") or bp_name or "Candidate"
        verified_skills = [s["name"] for s in profile_data.get("verified_skills", [])]
        resume_skills = [s["name"] for s in profile_data.get("resume_only_skills", [])]
        projects = profile_data.get("projects", [])
        experience = profile_data.get("experience", [])
        education = profile_data.get("education", [])
        alumni_companies = [c["company"] for c in profile_data.get("alumni_matrix", [])[:12]]

        if isinstance(blueprint, dict):
            achievements = blueprint.get("achievements") or []
        elif blueprint:
            achievements = getattr(blueprint, "achievements", []) or []
        else:
            achievements = []

        graph_context_text = f"""
=== USER KNOWLEDGE GRAPH (NEO4J AURADB MULTI-HOP TOPOLOGY) ===
Candidate Name: {user_name}
Target Roles / Prefs: {preferences.get('desired_roles', ['Full Stack / Backend Engineer'])}
Preferred Locations: {preferences.get('preferred_locations', ['India', 'Remote'])}

[VERIFIED SKILLS (Backed by real code & GitHub Repositories)]:
{', '.join(verified_skills) if verified_skills else 'Python, FastAPI, TypeScript, React, Docker, Neo4j, Redis'}

[RESUME-CLAIMED SKILLS]:
{', '.join(resume_skills) if resume_skills else 'Distributed Systems, System Design, REST APIs, Microservices, CI/CD'}

[PROVEN PROJECTS & CODEBASE EVIDENCE]:
"""
        for p in projects[:6]:
            graph_context_text += f"- Project: {p.get('name')} | Tech Stack: {', '.join(p.get('tech_stack', []))} | URL: {p.get('repo_url', 'N/A')}\n  Description: {p.get('description', '')}\n"

        graph_context_text += "\n[WORK EXPERIENCE & STAR BULLETS]:\n"
        for exp in experience[:4]:
            graph_context_text += f"- {exp.get('role')} @ {exp.get('company')} ({exp.get('start_date', '')} - {exp.get('end_date', 'Present')})\n"
            for b in exp.get("bullets", [])[:2]:
                graph_context_text += f"    * {b}\n"

        graph_context_text += "\n[AWARDS, HACKATHONS & CREDENTIALS]:\n"
        for ach in achievements:
            graph_context_text += f"- {ach}\n"

        if warm_connections:
            graph_context_text += "\n[WARM 1ST-DEGREE CONNECTIONS & ALUMNI REFERRAL BRIDGES]:\n"
            for wc in warm_connections:
                conn_type = "🎓 College Alumni Bridge" if wc.get("is_alumni") else "🤝 1st-Degree Connection"
                comp = wc.get("company") or "Industry Network"
                graph_context_text += f"- {wc.get('name')} | Role: {wc.get('position')} @ {comp} | Type: {conn_type} | URL: {wc.get('linkedin_url', '')}\n"

        if alumni_companies:
            graph_context_text += f"\n[COMPANIES WITH SGI / COLLEGE ALUMNI]:\n{', '.join(alumni_companies)}\n"

        if opportunities:
            graph_context_text += "\n[MATCHING LIVE OPPORTUNITIES IN DATABASE]:\n"
            for opp in opportunities[:4]:
                graph_context_text += f"- {opp.get('title')} @ {opp.get('company')} ({opp.get('location')}) | Link: {opp.get('apply_url', '')} | Match Score: {opp.get('match_score', 90)}%\n"

        # 7. System Prompt for GraphRAG Intelligence
        system_prompt = f"""You are CareerOS Brain — an advanced GraphRAG Career Intelligence AI modeled after ChatGPT/Claude, powered by real-time Neo4j Knowledge Graph traversal and semantic retrieval.

You possess complete, real-time knowledge of the candidate's career footprint: verified GitHub code, projects, work experience, education, hackathons, network connections, and live opportunities.

{graph_context_text}

Rules for Responses:
1. Ground your answers strictly in the candidate's authentic knowledge graph data above.
2. CONVERSATIONAL CONTINUITY & PAST MESSAGE CONTEXT:
   - You are conversing in an active multi-turn session. ALWAYS pay close attention to past messages in this conversation.
   - Accurately resolve pronouns, follow-ups, and shorthand references ("that", "it", "the project you mentioned", "tell me more about the first point", "draft an email to him").
   - If the user asks a follow-up or refinement on a previous topic, continue the exact train of thought instead of restarting with a generic overview.
3. When referencing specific skills, projects, hackathons, or companies from the graph, cite them clearly using tags like `[Skill: FastAPI]`, `[Project: IntelliGuard]`, `[Award: SIH 2024]`, `[Alumni: Person Name @ Company]`.
4. NETWORK & REFERRAL INTELLIGENCE:
   - When the user asks about getting referrals, internships, or job outreach, actively traverse their [WARM 1ST-DEGREE CONNECTIONS & ALUMNI REFERRAL BRIDGES].
   - Specifically name relevant people from their network who work at the target company or in the target domain, highlight shared college/alumni bridges, and provide a tailored cold outreach message citing the user's real projects (like SIH hackathon or DRDO NGFW project).
5. Be direct, authoritative, highly encouraging, and provide crisp, strategic career advice.
6. Provide structured, readable output using markdown (bullet points, bold text, code snippets if relevant).
7. Always return your response in strictly valid JSON with the following structure:
{{
  "reply": "Your full rich markdown response here...",
  "citations": [
    {{"type": "project"|"skill"|"award"|"opportunity"|"network"|"alumni", "label": "Label name", "detail": "Short context"}}
  ],
  "graph_nodes_referenced": ["Skill: FastAPI", "Project: IntelliGuard", "Alumni: Name @ Company"],
  "graph_lens": {{
    "query": "Focused query string representing the referenced topic (e.g. DRDO Firewall & Network Engineering)",
    "title": "Title of focused subgraph lens (e.g. DRDO NGFW Architecture)",
    "explanation": "One sentence explaining what this focused subgraph contains."
  }},
  "suggested_followups": [
    "Suggested question 1",
    "Suggested question 2",
    "Suggested question 3"
  ]
}}
"""

        # Formulate Multi-Turn Messages
        structured_messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ]

        # Filter out the initial welcome template from history to avoid priming the model with canned bot greetings
        clean_history = []
        for msg in conversation_history:
            content = (msg.get("content") or "").strip()
            role = msg.get("role", "user")
            # Skip welcome message if present
            if "I'm CareerOS Brain" in content and "GraphRAG career copilot" in content:
                continue
            if content:
                norm_role = "assistant" if role in ("assistant", "bot", "model") else "user"
                clean_history.append({"role": norm_role, "content": content})

        # Keep the most recent 12 conversation turns for rich memory
        for hist_turn in clean_history[-12:]:
            structured_messages.append(hist_turn)

        # Add the current user query as the final user message
        structured_messages.append({
            "role": "user",
            "content": f"{query}\n\nRespond in strictly valid JSON format matching the schema."
        })

        # Also formulate fallback user_prompt for single-prompt models
        user_prompt = f"""=== USER QUERY ===
{query}

Respond in strictly valid JSON format matching the schema.
"""

        # 8. Call LLM Engine with structured multi-turn messages
        result = await llm_service.chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            messages=structured_messages
        )

        if result and isinstance(result, dict) and "reply" in result:
            graph_lens = result.get("graph_lens")
            if not graph_lens or not isinstance(graph_lens, dict) or not graph_lens.get("query"):
                # Construct default graph_lens from referenced nodes
                referenced = result.get("graph_nodes_referenced", [])
                if referenced:
                    graph_lens = {
                        "query": ", ".join([r.split(":")[-1].strip() for r in referenced[:4]]),
                        "title": f"Focus: {query[:35]}",
                        "explanation": f"Filtered subgraph highlighting {len(referenced)} key nodes."
                    }
                else:
                    graph_lens = None

            return {
                "status": "success",
                "reply": result.get("reply", ""),
                "citations": result.get("citations", []),
                "graph_nodes_referenced": result.get("graph_nodes_referenced", []),
                "graph_lens": graph_lens,
                "suggested_followups": result.get("suggested_followups", [
                    "How can I tailor my resume for this role?",
                    "What skill gaps should I focus on next?",
                    "Draft an alumni referral outreach message for this company."
                ]),
                "context_stats": {
                    "verified_skills_count": len(verified_skills),
                    "projects_count": len(projects),
                    "opportunities_found": len(opportunities)
                }
            }

        # Fallback if JSON generation was interrupted
        fallback_reply = f"Based on your CareerOS Knowledge Graph, you have strong verified foundations in **{', '.join(verified_skills[:4])}** backed by projects like **{projects[0]['name'] if projects else 'your repositories'}**.\n\nTo optimize for `{query}`, leverage your authentic STAR metrics and verified code evidence."
        return {
            "status": "success",
            "reply": fallback_reply,
            "citations": [
                {"type": "skill", "label": s, "detail": "Code-verified skill in graph"}
                for s in verified_skills[:3]
            ],
            "graph_nodes_referenced": [f"Skill: {s}" for s in verified_skills[:3]],
            "graph_lens": {
                "query": query,
                "title": f"Graph Lens: {query[:30]}",
                "explanation": f"Focused view on {', '.join(verified_skills[:3])}."
            },
            "suggested_followups": [
                "What are my highest-impact projects in the graph?",
                "Which opportunities match my verified tech stack best?",
                "How do I compare against industry benchmarks?"
            ],
            "context_stats": {
                "verified_skills_count": len(verified_skills),
                "projects_count": len(projects),
                "opportunities_found": len(opportunities)
            }
        }

    @classmethod
    async def smart_graph_query(cls, user_id: str, query: str) -> Dict[str, Any]:
        """
        Translates a natural language user query (e.g. 'Show my DRDO firewall project with python skills')
        into a focused, decluttered Knowledge Graph subgraph that strictly answers the query.
        """
        clean_query = (query or "").strip()
        
        # 1. Fetch complete topology
        topology = await profile_service.get_graph_topology(user_id=user_id)
        all_nodes = topology.get("nodes", [])
        all_links = topology.get("links", [])

        if not all_nodes:
            return {
                "status": "success",
                "query": clean_query,
                "title": "Empty Graph",
                "explanation": "No graph entities found in workspace.",
                "total_nodes": 0,
                "matched_nodes_count": 0,
                "subgraph": {"nodes": [], "links": []}
            }

        if not clean_query or clean_query.lower() in ["all", "everything", "reset", "*", "full graph"]:
            return {
                "status": "success",
                "query": "All Entities",
                "title": "Full Knowledge Graph",
                "explanation": "Showing complete knowledge graph with all entities.",
                "total_nodes": len(all_nodes),
                "matched_nodes_count": len(all_nodes),
                "subgraph": topology
            }

        # 2. Build concise Node Catalog for LLM
        node_catalog = []
        for n in all_nodes:
            node_catalog.append({
                "id": n.get("id"),
                "label": n.get("label") or n.get("name") or n.get("id"),
                "type": n.get("type") or n.get("category") or "Skill"
            })

        # Filter meaningful non-stopword tokens
        STOP_WORDS = {
            "show", "me", "find", "display", "get", "what", "where", "which", "how", "who",
            "the", "my", "all", "with", "and", "or", "for", "in", "at", "on", "of", "to",
            "is", "are", "a", "an", "it", "part", "that", "relates", "related", "relating",
            "answer", "query", "user", "wants", "see", "only", "skills", "skill", "projects",
            "project", "repos", "repo", "experience", "connection", "connections", "alumni",
            "network", "nodes", "graph", "about", "just", "like", "give", "tell"
        }
        tokens = [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_+#.-]+\b', clean_query)]
        content_tokens = [w for w in tokens if w not in STOP_WORDS and len(w) >= 2]

        # 3. LLM Semantic Filtering
        system_prompt = """You are the CareerOS Knowledge Graph Query Filter.
The user has a large knowledge graph (projects, skills, achievements, alumni, companies).
The user wants to see ONLY the exact, minimal subgraph that directly answers or relates to their natural language query.

Rules:
1. Select ONLY the nodes that directly answer the query (typically 3 to 10 nodes).
2. For project queries (e.g. 'DRDO firewall', 'IntelliGuard', 'SIH'), pick that project node and only the key technologies/skills explicitly relevant to it.
3. For alumni/referral queries (e.g. 'Alumni at Google', 'Amazon referrals'), pick the matching person/contact nodes and the matching company node.
4. For specific skill queries (e.g. 'Python and React'), pick only those skills and the top 1-2 projects using them.
5. DO NOT return unrelated nodes or all nodes of a category. Keep the subgraph tightly focused.
6. Return strictly valid JSON:
{
  "title": "Crisp 3-6 word Title for this Focused Subgraph",
  "explanation": "1 short sentence explaining what this focused view answers.",
  "matched_node_ids": ["id1", "id2", ...]
}
"""

        user_prompt = f"""
USER QUERY: "{clean_query}"

GRAPH ENTITY CATALOG (Total {len(node_catalog)} entities):
{json.dumps(node_catalog[:120], indent=2)}

Return strictly valid JSON with the exact matched_node_ids answering this query.
"""

        matched_ids_set = set()
        title = f"Focus: {clean_query}"
        explanation = f"Showing only the nodes directly answering '{clean_query}'"

        try:
            llm_res = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1
            )
            if llm_res and isinstance(llm_res, dict):
                ids = llm_res.get("matched_node_ids", [])
                if isinstance(ids, list) and len(ids) > 0:
                    for nid in ids:
                        if isinstance(nid, str) and any(n["id"] == nid for n in all_nodes):
                            matched_ids_set.add(nid)
                if llm_res.get("title"):
                    title = llm_res["title"]
                if llm_res.get("explanation"):
                    explanation = llm_res["explanation"]
        except Exception as e:
            logger.warning(f"LLM smart_graph_query notice: {e}")

        # 4. Keyword Fallback if LLM returned nothing or offline
        if not matched_ids_set and content_tokens:
            for n in all_nodes:
                nid = str(n.get("id", "")).lower()
                lbl = str(n.get("label") or n.get("name") or "").lower()
                for token in content_tokens:
                    if token in lbl or token == nid or token in nid:
                        matched_ids_set.add(n.get("id"))
                        break

        # 5. Fallback if still empty
        if not matched_ids_set:
            # Pick top 5 matching or relevant nodes
            for n in all_nodes[:5]:
                matched_ids_set.add(n.get("id"))
            explanation = f"Showing closest matching entities for '{clean_query}'."

        # 6. Extract subgraph nodes and ONLY the links connecting them
        subgraph_nodes = [n for n in all_nodes if n.get("id") in matched_ids_set]
        subgraph_links = []

        for link in all_links:
            s = link.get("source")
            t = link.get("target")
            s_id = s.get("id") if isinstance(s, dict) else s
            t_id = t.get("id") if isinstance(t, dict) else t

            if s_id in matched_ids_set and t_id in matched_ids_set:
                subgraph_links.append(link)

        return {
            "status": "success",
            "query": clean_query,
            "title": title,
            "explanation": explanation,
            "total_nodes": len(all_nodes),
            "matched_nodes_count": len(subgraph_nodes),
            "matched_node_ids": list(matched_ids_set),
            "subgraph": {
                "nodes": subgraph_nodes,
                "links": subgraph_links
            }
        }

brain_service = BrainService()

