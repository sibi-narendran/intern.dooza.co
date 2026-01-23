"""
SEO Sub-Agents Package

This package will contain specialized SEO sub-agents that Seomi can delegate to.

Future sub-agents:
- auditor.py: SEO Auditor - comprehensive website SEO audits
- keywords.py: Keyword Researcher - keyword research and analysis
- content.py: Content Optimizer - optimize content for search engines
- technical.py: Technical SEO - technical SEO issues and fixes

Each sub-agent will be exposed as a tool that Seomi can call via the
standard LangGraph tool-calling pattern.
"""

# Sub-agent tools will be exported here as they are implemented
# Example:
# from app.agents.seo.auditor import seo_auditor_tool
# from app.agents.seo.keywords import keyword_researcher_tool
#
# SEO_SUBAGENT_TOOLS = [
#     seo_auditor_tool,
#     keyword_researcher_tool,
# ]

SEO_SUBAGENT_TOOLS = []  # Empty for now - sub-agents added later
