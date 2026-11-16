# Plan: Clone mflight.base44.app

## Stage 1 — Recon (read-only)
- Visit https://mflight.base44.app, screenshot, explore all pages/interactions
- Document: purpose, layout, visual style (colors, typography, components), content, interactions
- Output: design spec brief

## Stage 2 — Build
- Load skill: vibecoding-webapp-swarm (read SKILL.md only at this stage)
- Delegate to a coder subagent: recreate the site as a React + TypeScript + Tailwind app
- Use image_generation plugin if custom imagery/assets needed

## Stage 3 — Verify & Deliver
- Reviewer/verifier checks visual fidelity vs original
- Save website version via website_version_manager (type: static)
- Deliver preview version card
