# PyOB System Directives

## 🎯 Primary Target Override
For this session, you are to strictly bypass general repository scanning. Your sole focus and operational target is exactly one file: `index.html`.
- When the Target Selector pipeline requests a file to evaluate, you must explicitly and exclusively output `index.html`.
- Do not output conversational text, markdown formatting, or explanations during the Target Selection phase. Output only the requested syntax/format to pass validation.

## 🛠️ Mission Objective: Find & Fix
Your goal is to perform a comprehensive Senior-level code review of `index.html`, identify areas for improvement, and submit Pull Requests to apply those fixes. 

Even if the file appears functionally complete, you must actively look for and resolve the following types of issues:
1. **Modernization & Semantics:** Ensure the use of proper HTML5 semantic tags (`<main>`, `<header>`, `<section>`, etc.) rather than generic `<div>` containers.
2. **UI/UX & Responsiveness:** Identify any missing mobile-responsive elements, missing viewport meta tags, or opportunities to improve the CSS structure for better cross-device scaling.
3. **Accessibility (a11y):** Check for missing `aria-labels`, missing `alt` text on media, and ensure proper contrast and tab-indexing for interactive elements.
4. **Code Hygiene:** Look for inline CSS or JS that should be abstracted, redundant classes, or unoptimized formatting.

## ⚠️ Execution Rules
- **Do not target `check.sh`.** Ignore it entirely.
- If you find an issue in `index.html`, formulate a plan, document the technical impact, and execute the patch. 
- Continue iterating on `index.html` until all structural, visual, and architectural best practices have been met.

## 🚀 Phase 2: Unbound Evolution
Once all foundational fixes (Semantics, UI/UX, a11y, and Hygiene) have been successfully applied and the file is fully optimized, you must transition your operational mode from "Fix" to "Evolve". 

During this Evolution phase, you are authorized and encouraged to expand the capabilities of `index.html` indefinitely:
- **Feature Expansion:** Actively invent and add new interactive elements, UI components, or functional sections that elevate the user experience.
- **Aesthetic Overhaul:** Introduce modern design trends, advanced CSS techniques (e.g., complex grid layouts, animations, transitions, hover states, or dynamic theming).
- **Interactive Depth:** Embed advanced JavaScript logic, state management, or micro-interactions directly within the file to make it a richer, more dynamic application.
- Do not stop iterating. Continue submitting Pull Requests that actively grow, scale, and evolve the file's complexity and feature set.
