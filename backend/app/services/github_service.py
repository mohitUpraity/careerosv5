import asyncio
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
        max_repos: int = 0,
        include_forks: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Fetches repositories for a GitHub user.
        If max_repos == 0 (or >= 1000), crawls ALL available repositories across all pages.
        Supports optional fork inclusion and parallelized language/README extraction.
        """
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CareerOS-v5-Ingestion"
        }
        if token and token.strip() and token.strip().lower() not in ["string", "none", "null", "undefined"]:
            headers["Authorization"] = f"Bearer {token.strip()}"

        raw_repo_list = []
        page = 1
        per_page = 100
        target_limit = 2000 if (max_repos <= 0 or max_repos >= 1000) else max_repos

        async with httpx.AsyncClient(timeout=25.0) as client:
            # 1. Paginate through GitHub repos
            while len(raw_repo_list) < target_limit:
                url = f"{cls.BASE_URL}/users/{username}/repos?sort=updated&per_page={per_page}&page={page}"
                try:
                    response = await client.get(url, headers=headers)
                except Exception as e:
                    logger.error(f"Network error fetching repos for {username} on page {page}: {e}")
                    break

                if response.status_code != 200:
                    logger.error(f"Failed to fetch repos for {username} (page {page}, status {response.status_code}): {response.text}")
                    break

                page_repos = response.json()
                if not page_repos or not isinstance(page_repos, list):
                    break

                for repo in page_repos:
                    if not include_forks and repo.get("fork", False):
                        continue  # Skip forked repositories if user did not request them
                    raw_repo_list.append(repo)
                    if len(raw_repo_list) >= target_limit:
                        break

                if len(page_repos) < per_page:
                    break  # Reached final page

                page += 1

            if not raw_repo_list:
                return []

            # 2. Concurrently enrich repository details (Languages + README) with concurrency control
            semaphore = asyncio.Semaphore(10)

            async def enrich_repo(repo: Dict[str, Any]) -> Dict[str, Any]:
                owner = repo.get("owner", {}).get("login", username)
                repo_name = repo.get("name", "untitled")
                
                languages = []
                readme_text = ""

                async with semaphore:
                    # Fetch languages
                    try:
                        lang_url = f"{cls.BASE_URL}/repos/{owner}/{repo_name}/languages"
                        lang_res = await client.get(lang_url, headers=headers)
                        if lang_res.status_code == 200:
                            languages = list(lang_res.json().keys())
                    except Exception:
                        languages = []

                    # Fetch README
                    try:
                        readme_url = f"{cls.BASE_URL}/repos/{owner}/{repo_name}/readme"
                        readme_res = await client.get(readme_url, headers=headers)
                        if readme_res.status_code == 200:
                            content_b64 = readme_res.json().get("content", "")
                            readme_text = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                    except Exception:
                        readme_text = ""

                return {
                    "id": f"github:{owner}:{repo_name}",
                    "name": repo_name,
                    "description": repo.get("description") or "",
                    "url": repo.get("html_url") or f"https://github.com/{owner}/{repo_name}",
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "is_fork": repo.get("fork", False),
                    "primary_language": repo.get("language") or (languages[0] if languages else "Unknown"),
                    "languages": languages,
                    "readme_snippet": readme_text[:2500]
                }

            enriched_repos = await asyncio.gather(*[enrich_repo(r) for r in raw_repo_list])
            return list(enriched_repos)

    @classmethod
    async def get_user_public_repo_count(cls, username: str, token: Optional[str] = None) -> int:
        """
        Quickly queries the GitHub user metadata to discover their total public repo count.
        """
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CareerOS-v5-Ingestion"
        }
        if token and token.strip() and token.strip().lower() not in ["string", "none", "null", "undefined"]:
            headers["Authorization"] = f"Bearer {token.strip()}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.get(f"{cls.BASE_URL}/users/{username}", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("public_repos", 0)
            except Exception as e:
                logger.warning(f"Failed to fetch public repo count for {username}: {e}")
        return 0

github_service = GitHubService()

