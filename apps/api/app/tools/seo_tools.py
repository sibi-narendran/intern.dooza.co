"""
SEO Analysis Tools for Seomi

These tools analyze websites for SEO issues using HTML parsing.
They are used by Seomi to provide SEO audits and recommendations.

Tools:
- get_user_website: Get user's website URL from the knowledge base (Brain)
- analyze_page_seo: Full single-page SEO audit
- analyze_site_seo: Multi-page analysis (homepage + key pages)
- check_technical_seo: robots.txt, sitemap, structured data

Usage:
    These tools are registered with Seomi and return structured data
    that Seomi interprets and presents to the user.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from langchain_core.tools import tool

# Reuse HTTP utilities from brand_extractor (DRY principle)
from app.services.brand_extractor import (
    fetch_url,
    parse_html,
    extract_text_content,
    USER_AGENT,
)

# For accessing user context (knowledge base)
from app.tools.task import get_agent_context

logger = logging.getLogger(__name__)


# =============================================================================
# USER WEBSITE TOOL (Get URL from Brain/Knowledge Base)
# =============================================================================

@tool
async def get_user_website() -> dict:
    """
    Get the user's website URL from their Brain (knowledge base).
    
    Use this FIRST when the user says "analyze my website" or "audit my site"
    without providing a specific URL. This fetches the website they've saved
    in their brand settings.
    
    Returns:
        dict with:
        - website: The user's website URL (or None if not set)
        - brand_name: The business name (for context)
        - has_website: Boolean indicating if website is configured
        - message: Human-readable status
    """
    from app.services.knowledge_service import get_knowledge_service
    
    ctx = get_agent_context()
    if not ctx:
        logger.warning("No agent context - cannot get user website")
        return {
            "error": "no_context",
            "has_website": False,
            "website": None,
            "message": "Could not determine user - please try again",
        }
    
    user_id = ctx.user_id
    service = get_knowledge_service()
    
    try:
        org_id = await service.get_user_org_id(user_id)
        if not org_id:
            return {
                "error": "no_organization",
                "has_website": False,
                "website": None,
                "message": "No organization found. Please set up your brand in the Brain tab first.",
            }
        
        brand = await service.get_brand_settings(org_id)
        
        if brand.website:
            return {
                "has_website": True,
                "website": brand.website,
                "brand_name": brand.business_name or "Your Brand",
                "message": f"Found website: {brand.website}",
            }
        else:
            return {
                "has_website": False,
                "website": None,
                "brand_name": brand.business_name or "Your Brand",
                "message": "No website URL saved. Please add your website in the Brain tab, or provide the URL directly.",
            }
        
    except Exception as e:
        logger.error(f"Failed to get user website: {e}")
        return {
            "error": "load_failed",
            "has_website": False,
            "website": None,
            "message": f"Could not load brand settings: {str(e)}",
        }


# =============================================================================
# CONSTANTS
# =============================================================================

# Scoring weights for overall score calculation
SCORE_WEIGHTS = {
    "meta_tags": 0.25,
    "headings": 0.15,
    "content": 0.20,
    "images": 0.15,
    "links": 0.15,
    "mobile": 0.10,
}

# Ideal ranges for SEO elements
TITLE_MIN_LENGTH = 30
TITLE_MAX_LENGTH = 60
TITLE_IDEAL_LENGTH = 55

DESCRIPTION_MIN_LENGTH = 120
DESCRIPTION_MAX_LENGTH = 160
DESCRIPTION_IDEAL_LENGTH = 155

MIN_WORD_COUNT = 300
IDEAL_WORD_COUNT = 800

# Key page patterns for site crawl
KEY_PAGE_PATTERNS = [
    r"/about",
    r"/services",
    r"/products",
    r"/contact",
    r"/blog/?$",
    r"/pricing",
    r"/features",
]


# =============================================================================
# ADDITIONAL HTTP UTILITIES (specific to SEO tools)
# =============================================================================

async def fetch_text_file(url: str, timeout: float = 15.0) -> Tuple[str, int]:
    """
    Fetch a text file (robots.txt, sitemap.xml) with error handling.
    
    This is specific to SEO tools - fetches plain text/XML files
    with appropriate Accept headers.
    
    Args:
        url: The URL to fetch
        timeout: Request timeout in seconds
        
    Returns:
        Tuple of (content, status_code)
    """
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/plain, text/xml, application/xml',
    }
    
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
        ) as client:
            response = await client.get(url, headers=headers)
            return response.text, response.status_code
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return "", 0


# =============================================================================
# ANALYSIS HELPERS
# =============================================================================

def analyze_meta_tags(soup, url: str) -> dict:
    """
    Analyze meta tags for SEO best practices.
    
    Returns dict with title, description, canonical, robots, og_tags, score, issues
    """
    issues = []
    score = 100
    
    # Title analysis
    title_tag = soup.find('title')
    title_value = title_tag.get_text(strip=True) if title_tag else None
    title_length = len(title_value) if title_value else 0
    
    title_info = {
        "value": title_value,
        "length": title_length,
        "status": "good",
    }
    
    if not title_value:
        issues.append("Missing title tag - critical for SEO")
        title_info["status"] = "missing"
        score -= 30
    elif title_length < TITLE_MIN_LENGTH:
        issues.append(f"Title too short ({title_length} chars) - aim for {TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH}")
        title_info["status"] = "too_short"
        score -= 10
    elif title_length > TITLE_MAX_LENGTH:
        issues.append(f"Title too long ({title_length} chars) - may be truncated in search results")
        title_info["status"] = "too_long"
        score -= 5
    
    # Meta description analysis
    desc_tag = soup.find('meta', attrs={'name': 'description'})
    desc_value = desc_tag.get('content', '').strip() if desc_tag else None
    desc_length = len(desc_value) if desc_value else 0
    
    description_info = {
        "value": desc_value[:200] + "..." if desc_value and len(desc_value) > 200 else desc_value,
        "length": desc_length,
        "status": "good",
    }
    
    if not desc_value:
        issues.append("Missing meta description - important for click-through rate")
        description_info["status"] = "missing"
        score -= 20
    elif desc_length < DESCRIPTION_MIN_LENGTH:
        issues.append(f"Meta description too short ({desc_length} chars) - aim for {DESCRIPTION_MIN_LENGTH}-{DESCRIPTION_MAX_LENGTH}")
        description_info["status"] = "too_short"
        score -= 10
    elif desc_length > DESCRIPTION_MAX_LENGTH:
        issues.append(f"Meta description too long ({desc_length} chars) - may be truncated")
        description_info["status"] = "too_long"
        score -= 5
    
    # Canonical tag
    canonical_tag = soup.find('link', rel='canonical')
    canonical_value = canonical_tag.get('href') if canonical_tag else None
    
    canonical_info = {
        "value": canonical_value,
        "is_self_referencing": canonical_value == url if canonical_value else False,
        "status": "good" if canonical_value else "missing",
    }
    
    if not canonical_value:
        issues.append("Missing canonical tag - helps prevent duplicate content issues")
        score -= 10
    
    # Robots meta
    robots_tag = soup.find('meta', attrs={'name': 'robots'})
    robots_value = robots_tag.get('content', '').lower() if robots_tag else None
    
    robots_info = {
        "value": robots_value,
        "index": "noindex" not in (robots_value or ""),
        "follow": "nofollow" not in (robots_value or ""),
    }
    
    if robots_value and "noindex" in robots_value:
        issues.append("Page is set to noindex - won't appear in search results")
        score -= 15
    
    # Open Graph tags
    og_tags = {}
    for prop in ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']:
        og_tag = soup.find('meta', property=prop)
        if og_tag:
            og_tags[prop] = og_tag.get('content', '')
    
    og_info = {
        "tags_found": list(og_tags.keys()),
        "has_image": 'og:image' in og_tags,
        "count": len(og_tags),
    }
    
    if len(og_tags) < 3:
        issues.append("Missing Open Graph tags - important for social sharing")
        score -= 5
    
    return {
        "title": title_info,
        "description": description_info,
        "canonical": canonical_info,
        "robots": robots_info,
        "og_tags": og_info,
        "score": max(0, score),
        "issues": issues,
    }


def analyze_headings(soup) -> dict:
    """
    Analyze heading structure for SEO best practices.
    
    Returns dict with h1_count, structure, score, issues
    """
    issues = []
    score = 100
    
    # Count all headings
    heading_counts = {}
    for level in range(1, 7):
        headings = soup.find_all(f'h{level}')
        heading_counts[f'h{level}'] = len(headings)
    
    h1_count = heading_counts['h1']
    h1_tags = soup.find_all('h1')
    h1_texts = [h.get_text(strip=True)[:100] for h in h1_tags]
    
    # Check H1
    if h1_count == 0:
        issues.append("Missing H1 tag - every page should have exactly one H1")
        score -= 30
    elif h1_count > 1:
        issues.append(f"Multiple H1 tags ({h1_count}) - use only one H1 per page")
        score -= 15
    
    # Check heading hierarchy
    hierarchy_issues = []
    prev_level = 0
    for level in range(1, 7):
        if heading_counts[f'h{level}'] > 0:
            if prev_level > 0 and level > prev_level + 1:
                hierarchy_issues.append(f"Skipped heading level: H{prev_level} to H{level}")
            prev_level = level
    
    if hierarchy_issues:
        issues.extend(hierarchy_issues)
        score -= 5 * len(hierarchy_issues)
    
    # Check if H2s exist (important for content structure)
    if heading_counts['h2'] == 0 and heading_counts['h1'] > 0:
        issues.append("No H2 tags - consider adding subheadings for better structure")
        score -= 10
    
    return {
        "h1_count": h1_count,
        "h1_texts": h1_texts,
        "heading_counts": heading_counts,
        "hierarchy_valid": len(hierarchy_issues) == 0,
        "score": max(0, score),
        "issues": issues,
    }


def analyze_content(soup, text: str) -> dict:
    """
    Analyze content for SEO best practices.
    
    Returns dict with word_count, readability hints, score, issues
    """
    issues = []
    score = 100
    
    # Word count
    words = text.split()
    word_count = len(words)
    
    content_status = "good"
    if word_count < MIN_WORD_COUNT:
        issues.append(f"Thin content ({word_count} words) - aim for at least {MIN_WORD_COUNT} words")
        content_status = "thin"
        score -= 25
    elif word_count < IDEAL_WORD_COUNT:
        content_status = "okay"
        score -= 5
    
    # Check for paragraphs
    paragraphs = soup.find_all('p')
    paragraph_count = len(paragraphs)
    
    if paragraph_count < 3 and word_count > 100:
        issues.append("Few paragraph tags - break content into readable sections")
        score -= 10
    
    # Check for lists (good for readability)
    lists = soup.find_all(['ul', 'ol'])
    has_lists = len(lists) > 0
    
    # Check for bold/emphasis (good for scannability)
    emphasis = soup.find_all(['strong', 'b', 'em'])
    has_emphasis = len(emphasis) > 0
    
    return {
        "word_count": word_count,
        "status": content_status,
        "paragraph_count": paragraph_count,
        "has_lists": has_lists,
        "has_emphasis": has_emphasis,
        "score": max(0, score),
        "issues": issues,
    }


def analyze_images(soup) -> dict:
    """
    Analyze images for SEO best practices.
    
    Returns dict with total, missing_alt, score, issues
    """
    issues = []
    score = 100
    
    images = soup.find_all('img')
    total_images = len(images)
    
    missing_alt = []
    empty_alt = []
    has_lazy_loading = 0
    
    for img in images:
        src = img.get('src', img.get('data-src', ''))
        alt = img.get('alt')
        
        if alt is None:
            missing_alt.append(src[:50] if src else "unknown")
        elif alt.strip() == '':
            empty_alt.append(src[:50] if src else "unknown")
        
        if img.get('loading') == 'lazy' or img.get('data-lazy'):
            has_lazy_loading += 1
    
    missing_count = len(missing_alt)
    empty_count = len(empty_alt)
    
    if missing_count > 0:
        issues.append(f"{missing_count} image(s) missing alt attribute - add descriptive alt text")
        score -= min(30, missing_count * 5)
    
    if empty_count > 0:
        issues.append(f"{empty_count} image(s) have empty alt text - add descriptions (unless decorative)")
        score -= min(15, empty_count * 3)
    
    return {
        "total": total_images,
        "missing_alt_count": missing_count,
        "empty_alt_count": empty_count,
        "missing_alt_examples": missing_alt[:3],
        "lazy_loading_count": has_lazy_loading,
        "score": max(0, score),
        "issues": issues,
    }


def analyze_links(soup, base_url: str) -> dict:
    """
    Analyze links for SEO best practices.
    
    Returns dict with internal, external, score, issues
    """
    issues = []
    score = 100
    
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.lower()
    
    links = soup.find_all('a', href=True)
    
    internal_links = []
    external_links = []
    nofollow_links = []
    
    for link in links:
        href = link.get('href', '')
        rel = link.get('rel', [])
        
        # Skip anchors and javascript
        if href.startswith('#') or href.startswith('javascript:'):
            continue
        
        # Parse the link
        parsed_href = urlparse(href)
        
        # Determine if internal or external
        if parsed_href.netloc == '' or parsed_href.netloc.lower() == base_domain:
            internal_links.append(href)
        else:
            external_links.append({
                "url": href[:100],
                "nofollow": 'nofollow' in rel,
            })
            if 'nofollow' in rel:
                nofollow_links.append(href)
    
    internal_count = len(internal_links)
    external_count = len(external_links)
    
    if internal_count < 3:
        issues.append("Few internal links - add more links to other pages on your site")
        score -= 15
    
    if external_count == 0:
        # Not necessarily bad, but noted
        pass
    
    # Check for links without text
    empty_links = [l for l in links if not l.get_text(strip=True) and not l.find('img')]
    if empty_links:
        issues.append(f"{len(empty_links)} link(s) have no anchor text - add descriptive text")
        score -= min(10, len(empty_links) * 2)
    
    return {
        "internal_count": internal_count,
        "external_count": external_count,
        "nofollow_count": len(nofollow_links),
        "total": len(links),
        "score": max(0, score),
        "issues": issues,
    }


def analyze_mobile(soup) -> dict:
    """
    Analyze mobile-friendliness indicators.
    
    Returns dict with has_viewport, score, issues
    """
    issues = []
    score = 100
    
    # Check viewport meta
    viewport = soup.find('meta', attrs={'name': 'viewport'})
    has_viewport = viewport is not None
    viewport_content = viewport.get('content', '') if viewport else None
    
    if not has_viewport:
        issues.append("Missing viewport meta tag - essential for mobile responsiveness")
        score -= 40
    elif viewport_content:
        if 'width=device-width' not in viewport_content:
            issues.append("Viewport should include 'width=device-width'")
            score -= 10
    
    # Check for mobile-specific issues in styles
    # (Limited check - full check requires rendering)
    
    return {
        "has_viewport": has_viewport,
        "viewport_content": viewport_content,
        "score": max(0, score),
        "issues": issues,
    }


def calculate_overall_score(analysis: dict) -> int:
    """Calculate weighted overall score from all analyses."""
    total_score = 0
    
    for category, weight in SCORE_WEIGHTS.items():
        if category in analysis and "score" in analysis[category]:
            total_score += analysis[category]["score"] * weight
    
    return round(total_score)


def get_priority_issues(analysis: dict, max_issues: int = 5) -> list[dict]:
    """Extract and prioritize top issues from analysis."""
    all_issues = []
    
    # Define priority order for categories
    category_priority = {
        "meta_tags": 1,
        "headings": 2,
        "content": 3,
        "images": 4,
        "links": 5,
        "mobile": 6,
    }
    
    for category, data in analysis.items():
        if isinstance(data, dict) and "issues" in data:
            for issue in data["issues"]:
                all_issues.append({
                    "category": category,
                    "issue": issue,
                    "priority": category_priority.get(category, 10),
                })
    
    # Sort by priority
    all_issues.sort(key=lambda x: x["priority"])
    
    return all_issues[:max_issues]


def extract_key_pages(soup, base_url: str, max_pages: int = 5) -> list[str]:
    """
    Extract key internal pages for site-wide analysis.
    
    Looks for common important pages like about, services, contact, blog.
    """
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.lower()
    base_scheme = parsed_base.scheme
    
    links = soup.find_all('a', href=True)
    found_pages = set()
    
    for link in links:
        href = link.get('href', '')
        
        # Skip external, anchors, javascript
        if href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
            continue
        
        # Parse and normalize
        parsed = urlparse(href)
        
        # Check if internal
        if parsed.netloc and parsed.netloc.lower() != base_domain:
            continue
        
        # Build full URL
        if not parsed.netloc:
            full_url = urljoin(base_url, href)
        else:
            full_url = href
        
        # Remove query params and fragments for comparison
        clean_url = urlparse(full_url)
        clean_path = clean_url.path.rstrip('/')
        
        # Check if matches key page pattern
        for pattern in KEY_PAGE_PATTERNS:
            if re.search(pattern, clean_path, re.IGNORECASE):
                normalized_url = f"{base_scheme}://{base_domain}{clean_path}"
                found_pages.add(normalized_url)
                break
    
    # Add base URL if not already included
    base_normalized = f"{base_scheme}://{base_domain}"
    result = [base_url]
    
    for page in list(found_pages)[:max_pages - 1]:
        if page not in result:
            result.append(page)
    
    return result[:max_pages]


# =============================================================================
# MAIN TOOLS
# =============================================================================

@tool
async def analyze_page_seo(url: str) -> dict:
    """
    Analyze a single page for SEO issues.
    
    Provides a comprehensive SEO audit including meta tags, headings,
    content quality, images, links, and mobile-friendliness.
    
    Use this when:
    - User wants to check a specific URL
    - Analyzing a landing page or blog post
    - Quick SEO health check
    
    Args:
        url: The URL to analyze (e.g., "example.com" or "https://example.com/page")
    
    Returns:
        dict with:
        - url: The analyzed URL
        - overall_score: 0-100 (higher is better)
        - meta_tags: Title, description, canonical, OG tags analysis
        - headings: H1-H6 structure analysis
        - content: Word count, readability analysis
        - images: Alt text, lazy loading analysis
        - links: Internal/external link analysis
        - mobile: Viewport and mobile-friendliness
        - priority_issues: Top 5 issues to fix first
    """
    logger.info(f"Analyzing page SEO for: {url}")
    
    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    try:
        html, status_code = await fetch_url(url)
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return {
            "error": "fetch_failed",
            "error_detail": str(e),
            "url": url,
        }
    
    if status_code != 200:
        return {
            "error": "http_error",
            "error_detail": f"HTTP {status_code}",
            "url": url,
        }
    
    soup = parse_html(html)
    text = extract_text_content(soup)
    
    # Run all analyses
    analysis = {
        "url": url,
        "meta_tags": analyze_meta_tags(soup, url),
        "headings": analyze_headings(soup),
        "content": analyze_content(soup, text),
        "images": analyze_images(soup),
        "links": analyze_links(soup, url),
        "mobile": analyze_mobile(soup),
    }
    
    # Calculate overall score
    analysis["overall_score"] = calculate_overall_score(analysis)
    
    # Get priority issues
    analysis["priority_issues"] = get_priority_issues(analysis)
    
    logger.info(f"Page analysis complete for {url}: score {analysis['overall_score']}/100")
    
    return analysis


@tool
async def analyze_site_seo(url: str, max_pages: int = 5) -> dict:
    """
    Analyze multiple pages of a website for SEO health.
    
    Crawls the homepage and discovers key pages (about, services, blog, contact)
    to provide a site-wide SEO assessment.
    
    Use this when:
    - User wants a comprehensive site audit
    - Analyzing overall site SEO health
    - Looking for site-wide issues
    
    Args:
        url: The website URL (usually homepage)
        max_pages: Maximum pages to analyze (default 5, max 10)
    
    Returns:
        dict with:
        - site_url: The base URL analyzed
        - pages_analyzed: List of page URLs checked
        - overall_score: Site-wide average score
        - page_results: Individual results for each page
        - common_issues: Issues appearing on multiple pages
        - recommendations: Prioritized site-wide action items
    """
    logger.info(f"Starting site SEO analysis for: {url}")
    
    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    max_pages = min(max_pages, 10)  # Cap at 10
    
    # Fetch homepage first
    try:
        html, status_code = await fetch_url(url)
    except Exception as e:
        logger.error(f"Failed to fetch homepage {url}: {e}")
        return {
            "error": "fetch_failed",
            "error_detail": str(e),
            "site_url": url,
        }
    
    if status_code != 200:
        return {
            "error": "http_error",
            "error_detail": f"HTTP {status_code}",
            "site_url": url,
        }
    
    soup = parse_html(html)
    
    # Find key pages to analyze
    pages_to_analyze = extract_key_pages(soup, url, max_pages)
    logger.info(f"Found {len(pages_to_analyze)} pages to analyze: {pages_to_analyze}")
    
    # Analyze each page
    page_results = {}
    all_issues = {}  # Track issues across pages
    total_score = 0
    
    for page_url in pages_to_analyze:
        logger.info(f"Analyzing: {page_url}")
        
        try:
            if page_url == url:
                # Reuse already fetched homepage
                page_soup = soup
                page_html = html
            else:
                page_html, page_status = await fetch_url(page_url)
                if page_status != 200:
                    page_results[page_url] = {
                        "error": f"HTTP {page_status}",
                        "score": 0,
                    }
                    continue
                page_soup = parse_html(page_html)
            
            page_text = extract_text_content(page_soup)
            
            # Run analysis
            analysis = {
                "meta_tags": analyze_meta_tags(page_soup, page_url),
                "headings": analyze_headings(page_soup),
                "content": analyze_content(page_soup, page_text),
                "images": analyze_images(page_soup),
                "links": analyze_links(page_soup, page_url),
                "mobile": analyze_mobile(page_soup),
            }
            
            page_score = calculate_overall_score(analysis)
            total_score += page_score
            
            # Collect issues for common issue detection
            for category, data in analysis.items():
                if isinstance(data, dict) and "issues" in data:
                    for issue in data["issues"]:
                        if issue not in all_issues:
                            all_issues[issue] = []
                        all_issues[issue].append(page_url)
            
            page_results[page_url] = {
                "score": page_score,
                "meta_tags_score": analysis["meta_tags"]["score"],
                "headings_score": analysis["headings"]["score"],
                "content_score": analysis["content"]["score"],
                "word_count": analysis["content"]["word_count"],
                "images_score": analysis["images"]["score"],
                "issues_count": sum(len(d.get("issues", [])) for d in analysis.values() if isinstance(d, dict)),
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze {page_url}: {e}")
            page_results[page_url] = {
                "error": str(e),
                "score": 0,
            }
    
    # Calculate overall site score
    analyzed_count = len([r for r in page_results.values() if "score" in r and r["score"] > 0])
    overall_score = round(total_score / analyzed_count) if analyzed_count > 0 else 0
    
    # Find common issues (appearing on 2+ pages)
    common_issues = [
        {
            "issue": issue,
            "affected_pages": len(pages),
            "pages": pages[:3],  # Limit to 3 examples
        }
        for issue, pages in all_issues.items()
        if len(pages) >= 2
    ]
    common_issues.sort(key=lambda x: x["affected_pages"], reverse=True)
    
    # Generate recommendations
    recommendations = []
    
    if common_issues:
        recommendations.append({
            "priority": "high",
            "action": f"Fix site-wide issue: {common_issues[0]['issue']}",
            "impact": f"Affects {common_issues[0]['affected_pages']} pages",
        })
    
    # Check for low-scoring pages
    low_score_pages = [url for url, data in page_results.items() if data.get("score", 100) < 60]
    if low_score_pages:
        recommendations.append({
            "priority": "medium",
            "action": "Improve low-scoring pages",
            "pages": low_score_pages,
        })
    
    logger.info(f"Site analysis complete: {overall_score}/100 across {analyzed_count} pages")
    
    return {
        "site_url": url,
        "pages_analyzed": pages_to_analyze,
        "pages_count": len(pages_to_analyze),
        "overall_score": overall_score,
        "page_results": page_results,
        "common_issues": common_issues[:5],
        "recommendations": recommendations,
    }


@tool
async def check_technical_seo(url: str) -> dict:
    """
    Check technical SEO elements for a website.
    
    Analyzes robots.txt, sitemap.xml, structured data, and HTTPS configuration.
    
    Use this when:
    - User asks about technical SEO
    - Checking if search engines can crawl the site
    - Verifying sitemap and robots.txt setup
    
    Args:
        url: The website URL (base domain)
    
    Returns:
        dict with:
        - robots_txt: Robots.txt analysis (exists, rules, issues)
        - sitemap: Sitemap.xml analysis (exists, URL count, issues)
        - structured_data: Schema.org markup found on homepage
        - https: HTTPS configuration
        - score: Overall technical SEO score (0-100)
    """
    logger.info(f"Checking technical SEO for: {url}")
    
    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    issues = []
    score = 100
    
    # Check robots.txt
    robots_url = f"{base_url}/robots.txt"
    robots_content, robots_status = await fetch_text_file(robots_url)
    
    robots_info = {
        "url": robots_url,
        "exists": robots_status == 200,
        "content_preview": robots_content[:500] if robots_content else None,
        "has_sitemap_reference": False,
        "blocks_important": False,
        "issues": [],
    }
    
    if robots_status == 200 and robots_content:
        robots_lower = robots_content.lower()
        
        # Check for sitemap reference
        if 'sitemap:' in robots_lower:
            robots_info["has_sitemap_reference"] = True
        
        # Check for problematic rules
        if 'disallow: /' in robots_lower and 'disallow: / ' not in robots_lower:
            # Check if it's blocking everything
            lines = robots_lower.split('\n')
            for line in lines:
                if line.strip() == 'disallow: /':
                    robots_info["blocks_important"] = True
                    robots_info["issues"].append("robots.txt may be blocking all crawlers")
                    issues.append("robots.txt blocking all crawlers")
                    score -= 30
                    break
    else:
        robots_info["issues"].append("No robots.txt found - consider adding one")
        issues.append("Missing robots.txt")
        score -= 5
    
    # Check sitemap
    sitemap_urls = [
        f"{base_url}/sitemap.xml",
        f"{base_url}/sitemap_index.xml",
    ]
    
    sitemap_info = {
        "exists": False,
        "url": None,
        "url_count": 0,
        "issues": [],
    }
    
    for sitemap_url in sitemap_urls:
        sitemap_content, sitemap_status = await fetch_text_file(sitemap_url)
        
        if sitemap_status == 200 and sitemap_content:
            sitemap_info["exists"] = True
            sitemap_info["url"] = sitemap_url
            
            # Count URLs (rough estimate)
            url_count = sitemap_content.count('<loc>') or sitemap_content.count('<url>')
            sitemap_info["url_count"] = url_count
            
            if url_count == 0:
                sitemap_info["issues"].append("Sitemap exists but appears empty")
                issues.append("Empty sitemap")
                score -= 10
            
            break
    
    if not sitemap_info["exists"]:
        sitemap_info["issues"].append("No sitemap.xml found - important for search engine discovery")
        issues.append("Missing sitemap.xml")
        score -= 15
    
    # Check homepage for structured data
    try:
        html, status = await fetch_url(url)
        if status == 200:
            soup = parse_html(html)
            
            # Find JSON-LD structured data
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            
            structured_data_info = {
                "found": len(json_ld_scripts) > 0,
                "count": len(json_ld_scripts),
                "types": [],
                "issues": [],
            }
            
            for script in json_ld_scripts:
                try:
                    data = json.loads(script.string or '{}')
                    if isinstance(data, dict):
                        schema_type = data.get('@type', 'Unknown')
                        structured_data_info["types"].append(schema_type)
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                structured_data_info["types"].append(item.get('@type', 'Unknown'))
                except json.JSONDecodeError:
                    structured_data_info["issues"].append("Invalid JSON-LD found")
            
            if not structured_data_info["found"]:
                structured_data_info["issues"].append("No structured data found - add schema.org markup")
                issues.append("Missing structured data")
                score -= 10
        else:
            structured_data_info = {
                "error": f"Could not fetch homepage: HTTP {status}",
            }
    except Exception as e:
        structured_data_info = {
            "error": str(e),
        }
    
    # Check HTTPS
    https_info = {
        "enabled": parsed.scheme == 'https',
        "issues": [],
    }
    
    if parsed.scheme != 'https':
        https_info["issues"].append("Site not using HTTPS - security and ranking factor")
        issues.append("Not using HTTPS")
        score -= 20
    
    return {
        "site_url": base_url,
        "robots_txt": robots_info,
        "sitemap": sitemap_info,
        "structured_data": structured_data_info,
        "https": https_info,
        "issues": issues,
        "score": max(0, score),
    }


# =============================================================================
# TOOL EXPORTS
# =============================================================================

SEO_TOOLS = [
    get_user_website,      # Get URL from Brain (use first when user says "my website")
    analyze_page_seo,
    analyze_site_seo,
    check_technical_seo,
]


def get_seo_tools() -> list:
    """Get the SEO analysis tools for Seomi."""
    return SEO_TOOLS
