"""Canonical skill names and categories shared by every ingestion path."""

import re
from typing import Optional


_SKILL_NAMES = {
    "js": "JavaScript", "javascript": "JavaScript",
    "ts": "TypeScript", "typescript": "TypeScript",
    "py": "Python", "python": "Python",
    "node": "Node.js", "nodejs": "Node.js", "node.js": "Node.js",
    "reactjs": "React", "react.js": "React", "react": "React",
    "vue": "Vue.js", "vuejs": "Vue.js", "nextjs": "Next.js", "postgres": "PostgreSQL", "postgresql": "PostgreSQL",
    "k8s": "Kubernetes", "golang": "Go", "c sharp": "C#",
    "cplusplus": "C++", "dotnet": ".NET", "aws": "AWS", "gcp": "Google Cloud",
    "ml": "Machine Learning", "llm": "LLMs", "llms": "LLMs",
    "rest api": "REST APIs", "rest apis": "REST APIs",
}

_CATEGORY_NAMES = {
    "programming languages": "Programming Languages", "programming": "Programming Languages", "language": "Programming Languages",
    "languages": "Programming Languages", "framework": "Frameworks & Libraries",
    "frameworks": "Frameworks & Libraries", "libraries": "Frameworks & Libraries",
    "database": "Databases", "databases": "Databases", "db": "Databases", "databases & cloud": "Databases",
    "cloud": "Cloud Platforms", "cloud platforms": "Cloud Platforms", "cloud computing": "Cloud Platforms",
    "devops": "DevOps & Infrastructure", "devops & cloud": "DevOps & Infrastructure", "cloud & devops": "DevOps & Infrastructure",
    "devops & infrastructure": "DevOps & Infrastructure", "infrastructure": "DevOps & Infrastructure",
    "ai/ml": "AI & Machine Learning", "ai": "AI & Machine Learning", "ai/ml & data science": "AI & Machine Learning",
    "ai/ml & security": "Other", "ai & machine learning": "AI & Machine Learning", "machine learning": "AI & Machine Learning",
    "security": "Security", "cybersecurity": "Security",
    "web": "Web Technologies", "web technologies": "Web Technologies", "web development": "Web Technologies", "frontend": "Web Technologies",
    "tool": "Tools & Platforms", "tools": "Tools & Platforms", "tools & platforms": "Tools & Platforms",
    "domain": "Architecture & Concepts", "architecture & concepts": "Architecture & Concepts",
    "technical": "Other", "technical skills": "Other", "other": "Other",
}

_SKILL_CATEGORIES = {
    "python": "Programming Languages", "javascript": "Programming Languages",
    "typescript": "Programming Languages", "java": "Programming Languages",
    "c++": "Programming Languages", "c#": "Programming Languages", "go": "Programming Languages",
    "rust": "Programming Languages", "ruby": "Programming Languages", "php": "Programming Languages",
    "swift": "Programming Languages", "kotlin": "Programming Languages", "scala": "Programming Languages",
    "html": "Web Technologies", "html5": "Web Technologies", "css": "Web Technologies", "css3": "Web Technologies",
    "react": "Frameworks & Libraries", "next.js": "Frameworks & Libraries", "vue.js": "Frameworks & Libraries", "node.js": "Frameworks & Libraries",
    "angular": "Frameworks & Libraries", "fastapi": "Frameworks & Libraries", "django": "Frameworks & Libraries",
    "flask": "Frameworks & Libraries", "express.js": "Frameworks & Libraries", "spring boot": "Frameworks & Libraries",
    "pytorch": "AI & Machine Learning", "tensorflow": "AI & Machine Learning", "scikit-learn": "AI & Machine Learning",
    "pandas": "AI & Machine Learning", "numpy": "AI & Machine Learning", "machine learning": "AI & Machine Learning",
    "nlp": "AI & Machine Learning", "rag": "AI & Machine Learning", "llms": "AI & Machine Learning",
    "neo4j": "Databases", "mongodb": "Databases", "postgresql": "Databases", "mysql": "Databases",
    "sqlite": "Databases", "redis": "Databases", "elasticsearch": "Databases",
    "aws": "Cloud Platforms", "azure": "Cloud Platforms", "google cloud": "Cloud Platforms",
    "gcp": "Cloud Platforms", "firebase": "Cloud Platforms", "supabase": "Cloud Platforms",
    "docker": "DevOps & Infrastructure", "kubernetes": "DevOps & Infrastructure", "terraform": "DevOps & Infrastructure",
    "jenkins": "DevOps & Infrastructure", "github actions": "DevOps & Infrastructure", "linux": "DevOps & Infrastructure",
    "git": "Tools & Platforms", "postman": "Tools & Platforms", "selenium": "Tools & Platforms",
    "wireshark": "Security", "network security": "Security", "tcp/ip": "Security",
    "system design": "Architecture & Concepts", "distributed systems": "Architecture & Concepts",
    "rest apis": "Architecture & Concepts", "graph databases": "Architecture & Concepts",
}


def normalize_skill_name(name: str) -> str:
    clean = re.sub(r"\s+", " ", str(name or "")).strip()
    if not clean:
        return ""
    key = re.sub(r"[^a-z0-9+#. ]", "", clean.lower()).strip()
    return _SKILL_NAMES.get(key, clean)


def normalize_skill_category(name: str, hinted_category: Optional[str] = None) -> str:
    skill_name = normalize_skill_name(name)
    category = _SKILL_CATEGORIES.get(skill_name.lower())
    if category:
        return category

    hint = re.sub(r"\s+", " ", str(hinted_category or "")).strip().lower()
    return _CATEGORY_NAMES.get(hint, "Other")
