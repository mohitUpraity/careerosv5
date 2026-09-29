import httpx
import logging
from typing import List, Dict, Any, Optional
import base64

logger = logging.getLogger(__name__)

class GitHubService:
    BASE_URL = "https://api.github.com"

    @classmethod
    async def fetch_user_repositories(
        cls, 
        username: str, 
        token: Optional[str] = None, 
        max_repos: int = 10
    ) -> List[Dict[str, Any]]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CareerOS-v5-Ingestion"
        }
        if token and token.strip() and token.strip().lower() not in ["string", "none", "null", "undefined"]:
            headers["Authorization"] = f"Bearer {token.strip()}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Fetch public repositories
            url = f"{cls.BASE_URL}/users/{username}/repos?sort=updated&per_page={max_repos}"
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"Failed to fetch repos for {username}: {response.text}")
                return []

            raw_repos = response.json()
            processed_repos = []

            for repo in raw_repos:
                if repo.get("fork", False):
                    continue  # Skip forked repositories to capture original candidate work

                owner = repo["owner"]["login"]
                repo_name = repo["name"]

                # 2. Fetch primary languages
                lang_url = f"{cls.BASE_URL}/repos/{owner}/{repo_name}/languages"
                lang_res = await client.get(lang_url, headers=headers)
                languages = list(lang_res.json().keys()) if lang_res.status_code == 200 else []

                # 3. Fetch README.md content
                readme_url = f"{cls.BASE_URL}/repos/{owner}/{repo_name}/readme"
                readme_res = await client.get(readme_url, headers=headers)
                readme_text = ""
                if readme_res.status_code == 200:
                    try:
                        content_b64 = readme_res.json().get("content", "")
                        readme_text = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                    except Exception as e:
                        logger.debug(f"Error decoding README for {repo_name}: {e}")

                processed_repos.append({
                    "id": f"github:{owner}:{repo_name}",
                    "name": repo_name,
                    "description": repo.get("description") or "",
                    "url": repo.get("html_url") or "",
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "primary_language": repo.get("language") or (languages[0] if languages else "Unknown"),
                    "languages": languages,
                    "readme_snippet": readme_text[:2500]  # First 2500 characters for token efficiency
                })

            return processed_repos

github_service = GitHubService()
