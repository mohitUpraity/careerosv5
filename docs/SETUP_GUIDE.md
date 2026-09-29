# 🛠️ CareerOS Setup & Deployment Guide

This guide walks you through configuring all cloud services (100% Free Tier) and running the platform locally or deploying to production.

---

## 📋 Prerequisites

- **Python 3.10+** & `pip`
- **Node.js 18+** & `npm`
- **Free Cloud Accounts**:
  1. [Neo4j AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/) (Free Tier Instance)
  2. [Supabase](https://supabase.com) (Free Project for Auth & Storage)
  3. [Google AI Studio](https://aistudio.google.com/) (Free Gemini 1.5 Flash API Key)
  4. [Groq Console](https://console.groq.com/) (Free LPU API Key)
  5. [Vercel](https://vercel.com) & [Render](https://render.com) (For Deployment)

---

## 🔑 1. Cloud Infrastructure Provisioning

### 1.1 Neo4j AuraDB (Free Tier)
1. Sign up at [Neo4j Aura](https://console.neo4j.io/).
2. Click **Create Database** $\rightarrow$ choose **AuraDB Free**.
3. Download the generated credentials file containing:
   - `NEO4J_URI` (e.g. `neo4j+s://xxxxxxxx.databases.neo4j.io`)
   - `NEO4J_USERNAME` (defaults to `neo4j`)
   - `NEO4J_PASSWORD`
4. Open the Neo4j Web Query Workspace and execute the constraint setup scripts from [GRAPH_SCHEMA.md](GRAPH_SCHEMA.md).

### 1.2 Supabase Configuration
1. Create a free project at [Supabase](https://supabase.com).
2. Under **Project Settings** $\rightarrow$ **API**, copy:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
3. Under **Storage**, create a new bucket named `resumes`:
   - Set **Public Bucket** to `False` (or configure authenticated RLS policies).

### 1.3 Google Gemini & Groq API Keys
1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/).
2. Get a Groq API key from [Groq Cloud Console](https://console.groq.com/keys).

---

## ⚙️ 2. Environment Configuration

Copy `.env.example` to `.env` in the root directory and populate with your credentials:

```bash
cp .env.example .env
```

---

## 💻 3. Local Development

### 3.1 Backend Service
```bash
cd backend
python3 -m venv venv
source venv/bin/activate

# Install dependencies (including WeasyPrint)
pip install -r requirements.txt

# Run FastAPI dev server with live-reloading
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
API Documentation will be live at `http://localhost:8000/docs`.

### 3.2 Frontend Service
```bash
cd ../frontend
npm install
npm run dev -- --port 3000
```
Dashboard will be live at `http://localhost:3000`.

---

## ☁️ 4. Free Cloud Deployment

### 4.1 Backend on Render.com
1. Push your code to GitHub.
2. Log in to [Render](https://dashboard.render.com/) $\rightarrow$ **New Web Service**.
3. Connect your repository and configure:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. Add all environment variables in the Render Environment tab.

### 4.2 Frontend on Vercel
1. Log in to [Vercel](https://vercel.com) $\rightarrow$ **Add New Project**.
2. Select your repository:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
3. Add frontend environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` (points to your Render backend URL)
4. Click **Deploy**.
