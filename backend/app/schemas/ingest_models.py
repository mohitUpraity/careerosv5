from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class GitHubIngestRequest(BaseModel):
    username: Optional[str] = Field(None, description="GitHub username to inspect")
    github_token: Optional[str] = Field(None, description="Optional GitHub Personal Access Token for private repos and higher rate limits")
    max_repos: int = Field(10, description="Max number of repositories to ingest")

class ExtractedSkill(BaseModel):
    name: str
    category: str = Field(..., description="Language, Framework, Database, Cloud, DevOps, or AI/ML")
    proficiency_estimate: Optional[str] = "Intermediate"

class ExtractedProject(BaseModel):
    name: str
    description: Optional[str] = ""
    repo_url: Optional[str] = ""
    stars_count: int = 0
    primary_language: Optional[str] = ""
    skills: List[ExtractedSkill] = []

class GitHubIngestResponse(BaseModel):
    status: str
    username: str
    repos_processed: int
    skills_extracted: int
    projects: List[ExtractedProject]
    graph_nodes_merged: int
