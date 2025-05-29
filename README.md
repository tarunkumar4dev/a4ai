a4ai – AI-Powered Solutions Platform
Accelerating Innovation with Artificial Intelligence

Project Overview
Live URL: https://a4ai.in
Mission: Democratizing AI tools for businesses and developers.

Development Workflow
1. Collaborative Editing
Via GitHub:

bash
git clone https://github.com/[your-org]/a4ai.git
cd a4ai
npm install
npm run dev  # Local dev server (http://localhost:5173)
Direct GitHub Edits:
Edit files via GitHub UI (pencil icon) for quick fixes.

2. Tech Stack
Frontend: React + TypeScript (Vite)

Styling: Tailwind CSS + shadcn/ui

Deployment: Vercel (CI/CD via GitHub)

Production Deployment
Automated Deploys
Push to main branch triggers Vercel production deployment.

Manual redeploys: Vercel Dashboard.

Custom Domain (Hostinger)
Configured via Vercel:

txt
CNAME: a4ai.in → cname.vercel-dns.com
Domain Settings Guide.

Team Guidelines
Code Standards
Commits: Follow Conventional Commits.

Branches: feature/, fix/, release/ prefixes.

Critical Files
src/: Core application logic.

public/: Assets (favicon: ICON.ico).

vite.config.ts: Build configuration.

Support & Maintenance
Issues?

Check Vercel Deployment Logs.

Clear cache: npm run clean && npm run build.

Scale Up:

Enable Vercel Analytics for performance monitoring.

© 2024 a4ai Technologies | Privacy Policy | Contact
