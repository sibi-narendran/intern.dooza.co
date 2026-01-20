"""
SEO Tools

Tools for SEO analysis including:
- Website scraping and analysis
- Meta tag auditing
- Heading structure analysis
- Image alt tag checking
- Keyword extraction

Production-ready with:
- Input validation
- Timeout handling  
- Error recovery
- Comprehensive logging
"""

from __future__ import annotations
import logging
import re
from collections import Counter
from typing import Any, ClassVar, Dict, List, Tuple
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field, field_validator

from app.tools.base import (
    DoozaTool,
    ToolMetadata,
    ToolUISchema,
    UIDisplayType,
    UISection,
    FieldMapping,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Constants
# ============================================================================

# Request settings
DEFAULT_TIMEOUT = 30.0  # seconds
MAX_RESPONSE_SIZE = 10 * 1024 * 1024  # 10MB max response
USER_AGENT = 'Mozilla/5.0 (compatible; DoozaBot/1.0; +https://dooza.ai)'

# SEO thresholds
TITLE_MIN_LENGTH = 30
TITLE_MAX_LENGTH = 60
DESC_MIN_LENGTH = 120
DESC_MAX_LENGTH = 160
MAX_IMAGES_TO_REPORT = 10
MAX_KEYWORDS = 50

# Common stop words to filter out of keyword analysis
STOP_WORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when', 'where',
    'who', 'which', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'also', 'into',
    'our', 'your', 'their', 'we', 'you', 'i', 'me', 'my', 'do', 'does', 'did',
    'been', 'being', 'if', 'or', 'because', 'until', 'while', 'about', 'would',
    'could', 'get', 'got', 'us', 'am', 'him', 'her', 'them', 'these', 'those',
}


# ============================================================================
# Helper Functions
# ============================================================================

def normalize_url(url: str) -> str:
    """
    Normalize a URL by adding protocol if missing.
    
    Args:
        url: The URL to normalize
        
    Returns:
        URL with protocol
    """
    url = url.strip()
    if not url:
        raise ValueError("URL cannot be empty")
    
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    return url


async def fetch_url(url: str, timeout: float = DEFAULT_TIMEOUT) -> Tuple[str, int]:
    """
    Fetch URL content with proper error handling.
    
    Args:
        url: The URL to fetch
        timeout: Request timeout in seconds
        
    Returns:
        Tuple of (html_content, status_code)
        
    Raises:
        httpx.HTTPError: On network errors
        ValueError: On invalid URL
    """
    url = normalize_url(url)
    
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    async with httpx.AsyncClient(
        follow_redirects=True, 
        timeout=timeout,
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
    ) as client:
        response = await client.get(url, headers=headers)
        
        # Check response size
        content_length = response.headers.get('content-length')
        if content_length and int(content_length) > MAX_RESPONSE_SIZE:
            raise ValueError(f"Response too large: {content_length} bytes")
        
        return response.text, response.status_code


def parse_html(html: str) -> BeautifulSoup:
    """Parse HTML content with BeautifulSoup."""
    return BeautifulSoup(html, 'lxml')


def extract_text_content(soup: BeautifulSoup) -> str:
    """Extract clean text content from parsed HTML."""
    # Remove script and style elements
    for element in soup(['script', 'style', 'noscript', 'header', 'footer', 'nav']):
        element.decompose()
    
    # Get text
    text = soup.get_text(separator=' ', strip=True)
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text


# ============================================================================
# Tool Input Schemas
# ============================================================================

class UrlInput(BaseModel):
    """Base input with URL validation."""
    url: str = Field(
        description="The website URL to analyze (e.g., 'example.com' or 'https://example.com')",
        min_length=3,
        max_length=2048,
    )
    
    @field_validator('url')
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate and normalize URL."""
        v = v.strip()
        if not v:
            raise ValueError("URL cannot be empty")
        # Basic URL pattern check
        if ' ' in v or '\n' in v or '\t' in v:
            raise ValueError("URL cannot contain whitespace")
        return v


class AnalyzeUrlInput(UrlInput):
    """Input for analyze_url tool."""
    pass


class AuditMetaTagsInput(UrlInput):
    """Input for audit_meta_tags tool."""
    pass


class AnalyzeHeadingsInput(UrlInput):
    """Input for analyze_headings tool."""
    pass


class CheckImagesInput(UrlInput):
    """Input for check_images tool."""
    pass


class ExtractKeywordsInput(UrlInput):
    """Input for extract_keywords tool."""
    top_n: int = Field(
        default=20, 
        description="Number of top keywords to return",
        ge=1,
        le=MAX_KEYWORDS,
    )


# ============================================================================
# SEO Analysis Functions
# ============================================================================

def analyze_meta_tags(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """Analyze meta tags from parsed HTML."""
    results: Dict[str, Any] = {
        "title": None,
        "title_length": 0,
        "description": None,
        "description_length": 0,
        "keywords": None,
        "canonical": None,
        "robots": None,
        "og_tags": {},
        "twitter_tags": {},
        "issues": [],
        "score": 0,
    }
    
    # Title tag
    title_tag = soup.find('title')
    if title_tag:
        results["title"] = title_tag.get_text(strip=True)
        results["title_length"] = len(results["title"])
        
        if results["title_length"] < TITLE_MIN_LENGTH:
            results["issues"].append(f"Title is too short (< {TITLE_MIN_LENGTH} characters)")
        elif results["title_length"] > TITLE_MAX_LENGTH:
            results["issues"].append(f"Title is too long (> {TITLE_MAX_LENGTH} characters)")
    else:
        results["issues"].append("Missing title tag")
    
    # Meta description
    desc_tag = soup.find('meta', attrs={'name': 'description'})
    if desc_tag and desc_tag.get('content'):
        results["description"] = desc_tag['content']
        results["description_length"] = len(results["description"])
        
        if results["description_length"] < DESC_MIN_LENGTH:
            results["issues"].append(f"Meta description is too short (< {DESC_MIN_LENGTH} characters)")
        elif results["description_length"] > DESC_MAX_LENGTH:
            results["issues"].append(f"Meta description is too long (> {DESC_MAX_LENGTH} characters)")
    else:
        results["issues"].append("Missing meta description")
    
    # Meta keywords (less important but still check)
    keywords_tag = soup.find('meta', attrs={'name': 'keywords'})
    if keywords_tag and keywords_tag.get('content'):
        results["keywords"] = keywords_tag['content']
    
    # Canonical URL
    canonical = soup.find('link', attrs={'rel': 'canonical'})
    if canonical and canonical.get('href'):
        results["canonical"] = canonical['href']
    else:
        results["issues"].append("Missing canonical URL")
    
    # Robots meta
    robots = soup.find('meta', attrs={'name': 'robots'})
    if robots and robots.get('content'):
        results["robots"] = robots['content']
    
    # Open Graph tags
    for og_tag in soup.find_all('meta', attrs={'property': re.compile(r'^og:')}):
        prop = og_tag.get('property', '').replace('og:', '')
        content = og_tag.get('content', '')
        if prop and content:
            results["og_tags"][prop] = content
    
    if not results["og_tags"].get('title'):
        results["issues"].append("Missing og:title tag")
    if not results["og_tags"].get('description'):
        results["issues"].append("Missing og:description tag")
    if not results["og_tags"].get('image'):
        results["issues"].append("Missing og:image tag")
    
    # Twitter Card tags
    for tw_tag in soup.find_all('meta', attrs={'name': re.compile(r'^twitter:')}):
        name = tw_tag.get('name', '').replace('twitter:', '')
        content = tw_tag.get('content', '')
        if name and content:
            results["twitter_tags"][name] = content
    
    # Calculate score (out of 100)
    score = 100
    score -= len(results["issues"]) * 10
    results["score"] = max(0, score)
    
    return results


def analyze_heading_structure(soup: BeautifulSoup) -> Dict[str, Any]:
    """Analyze heading structure from parsed HTML."""
    results: Dict[str, Any] = {
        "h1_count": 0,
        "h1_texts": [],
        "h2_count": 0,
        "h2_texts": [],
        "h3_count": 0,
        "h4_count": 0,
        "h5_count": 0,
        "h6_count": 0,
        "hierarchy": [],
        "issues": [],
        "score": 0,
    }
    
    # Count and collect headings
    for level in range(1, 7):
        tag_name = f'h{level}'
        headings = soup.find_all(tag_name)
        results[f"h{level}_count"] = len(headings)
        
        if level <= 2:
            results[f"h{level}_texts"] = [h.get_text(strip=True)[:100] for h in headings[:5]]
        
        for h in headings:
            results["hierarchy"].append({
                "level": level,
                "text": h.get_text(strip=True)[:100]
            })
    
    # Check for issues
    if results["h1_count"] == 0:
        results["issues"].append("No H1 heading found")
    elif results["h1_count"] > 1:
        results["issues"].append(f"Multiple H1 headings found ({results['h1_count']})")
    
    if results["h2_count"] == 0:
        results["issues"].append("No H2 headings found")
    
    # Check hierarchy (H2 should come after H1, etc.)
    last_level = 0
    for item in results["hierarchy"]:
        if item["level"] > last_level + 1 and last_level > 0:
            results["issues"].append(f"Heading hierarchy skip: H{last_level} to H{item['level']}")
            break
        last_level = item["level"]
    
    # Calculate score
    score = 100
    score -= len(results["issues"]) * 15
    results["score"] = max(0, score)
    
    return results


def analyze_images(soup: BeautifulSoup, base_url: str) -> Dict[str, Any]:
    """Analyze images from parsed HTML."""
    results: Dict[str, Any] = {
        "total_images": 0,
        "images_with_alt": 0,
        "images_without_alt": 0,
        "images_with_empty_alt": 0,
        "missing_alt_images": [],
        "issues": [],
        "score": 0,
    }
    
    images = soup.find_all('img')
    results["total_images"] = len(images)
    
    for img in images:
        alt = img.get('alt')
        src = img.get('src', '')
        
        # Make src absolute for reporting
        if src and not src.startswith(('http://', 'https://', 'data:')):
            src = urljoin(base_url, src)
        
        if alt is None:
            results["images_without_alt"] += 1
            if len(results["missing_alt_images"]) < MAX_IMAGES_TO_REPORT:
                results["missing_alt_images"].append(src[:200])
        elif alt.strip() == '':
            results["images_with_empty_alt"] += 1
        else:
            results["images_with_alt"] += 1
    
    # Generate issues
    if results["images_without_alt"] > 0:
        results["issues"].append(
            f"{results['images_without_alt']} images missing alt attribute"
        )
    
    if results["images_with_empty_alt"] > 0:
        results["issues"].append(
            f"{results['images_with_empty_alt']} images have empty alt attribute"
        )
    
    # Calculate score
    if results["total_images"] > 0:
        alt_ratio = results["images_with_alt"] / results["total_images"]
        results["score"] = int(alt_ratio * 100)
    else:
        results["score"] = 100  # No images = no issues
    
    return results


def extract_keywords_from_text(text: str, top_n: int = 20) -> List[Dict[str, Any]]:
    """Extract top keywords from text content."""
    # Tokenize and clean
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    
    # Filter stop words
    words = [w for w in words if w not in STOP_WORDS]
    
    # Count frequencies
    counter = Counter(words)
    
    # Get top N with density
    total_words = len(words)
    keywords = []
    
    for word, count in counter.most_common(top_n):
        density = (count / total_words * 100) if total_words > 0 else 0
        keywords.append({
            "keyword": word,
            "count": count,
            "density": round(density, 2),
        })
    
    return keywords


# ============================================================================
# Tool Classes
# ============================================================================

class AnalyzeUrlTool(DoozaTool):
    """
    Comprehensive SEO analysis tool.
    
    Fetches a URL and performs full SEO audit including:
    - Meta tags analysis
    - Heading structure
    - Image alt tags
    - Keyword extraction
    """
    
    name: str = "seo_analyze_url"
    description: str = (
        "Perform a comprehensive SEO analysis of a website URL. "
        "Returns meta tags, heading structure, image audit, and keyword analysis."
    )
    args_schema: type = AnalyzeUrlInput
    
    # ClassVar tells Pydantic this is a class variable, not a model field
    tool_metadata: ClassVar[ToolMetadata] = ToolMetadata(
        slug="seo.analyze_url",  # slug can have dots for internal categorization
        category="seo",
        name="Analyze URL",
        description="Comprehensive SEO analysis of a website",
        min_tier="free",
        ui_schema=ToolUISchema(
            display=UIDisplayType.SCORE_CARD,
            title="SEO Analysis",
            summary_template="Score: {overall_score}/100 • {issues_count} issues",
            score_field="overall_score",
            sections=[
                UISection(
                    id="overview",
                    label="Overview",
                    display=UIDisplayType.SCORE_CARD,
                    icon="Globe",
                    score_field="overall_score",
                    fields=[
                        FieldMapping("issues_count", "Issues Found", "number"),
                        FieldMapping("word_count", "Word Count", "number"),
                    ],
                ),
                UISection(
                    id="meta",
                    label="Meta Tags",
                    display=UIDisplayType.KEY_VALUE,
                    icon="FileText",
                    score_field="meta_tags.score",
                    fields=[
                        FieldMapping("meta_tags.title", "Title"),
                        FieldMapping("meta_tags.title_length", "Title Length", "number"),
                        FieldMapping("meta_tags.description", "Description"),
                        FieldMapping("meta_tags.description_length", "Description Length", "number"),
                        FieldMapping("meta_tags.canonical", "Canonical URL", "url"),
                    ],
                ),
                UISection(
                    id="headings",
                    label="Headings",
                    display=UIDisplayType.KEY_VALUE,
                    icon="Heading",
                    score_field="headings.score",
                    fields=[
                        FieldMapping("headings.h1_count", "H1 Count", "number"),
                        FieldMapping("headings.h1_texts", "H1 Texts"),
                        FieldMapping("headings.h2_count", "H2 Count", "number"),
                    ],
                ),
                UISection(
                    id="images",
                    label="Images",
                    display=UIDisplayType.KEY_VALUE,
                    icon="Image",
                    score_field="images.score",
                    fields=[
                        FieldMapping("images.total", "Total Images", "number"),
                        FieldMapping("images.with_alt", "With Alt Text", "number"),
                        FieldMapping("images.without_alt", "Missing Alt Text", "number"),
                    ],
                ),
                UISection(
                    id="keywords",
                    label="Keywords",
                    display=UIDisplayType.DATA_TABLE,
                    icon="Key",
                    fields=[
                        FieldMapping("keywords", "Top Keywords"),
                    ],
                ),
                UISection(
                    id="issues",
                    label="Issues",
                    display=UIDisplayType.ISSUES_LIST,
                    icon="AlertCircle",
                    fields=[
                        FieldMapping("all_issues", "All Issues"),
                    ],
                ),
            ],
        ),
    )
    
    async def _arun(self, url: str) -> Dict[str, Any]:
        """Run the SEO analysis."""
        try:
            # Fetch the page
            html, status_code = await fetch_url(url)
            
            if status_code != 200:
                return {
                    "success": False,
                    "error": f"Failed to fetch URL (status: {status_code})",
                    "url": url,
                }
            
            # Parse HTML
            soup = parse_html(html)
            
            # Ensure URL has protocol for base URL
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            # Run all analyses
            meta_results = analyze_meta_tags(soup, url)
            heading_results = analyze_heading_structure(soup)
            image_results = analyze_images(soup, url)
            
            # Extract text and keywords
            text_content = extract_text_content(soup)
            keywords = extract_keywords_from_text(text_content, top_n=15)
            
            # Calculate overall score
            overall_score = int(
                (meta_results["score"] + heading_results["score"] + image_results["score"]) / 3
            )
            
            # Compile all issues
            all_issues = (
                meta_results["issues"] + 
                heading_results["issues"] + 
                image_results["issues"]
            )
            
            return {
                "success": True,
                "url": url,
                "overall_score": overall_score,
                "issues_count": len(all_issues),
                "meta_tags": {
                    "title": meta_results["title"],
                    "title_length": meta_results["title_length"],
                    "description": meta_results["description"],
                    "description_length": meta_results["description_length"],
                    "canonical": meta_results["canonical"],
                    "og_tags": meta_results["og_tags"],
                    "score": meta_results["score"],
                    "issues": meta_results["issues"],
                },
                "headings": {
                    "h1_count": heading_results["h1_count"],
                    "h1_texts": heading_results["h1_texts"],
                    "h2_count": heading_results["h2_count"],
                    "h2_texts": heading_results["h2_texts"],
                    "score": heading_results["score"],
                    "issues": heading_results["issues"],
                },
                "images": {
                    "total": image_results["total_images"],
                    "with_alt": image_results["images_with_alt"],
                    "without_alt": image_results["images_without_alt"],
                    "score": image_results["score"],
                    "issues": image_results["issues"],
                },
                "keywords": keywords[:10],
                "word_count": len(text_content.split()),
                "all_issues": all_issues,
            }
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error analyzing {url}: {e}")
            return {
                "success": False,
                "error": f"Network error: {str(e)}",
                "url": url,
            }
        except Exception as e:
            logger.error(f"Error analyzing {url}: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Analysis error: {str(e)}",
                "url": url,
            }
    
    def _run(self, url: str) -> Dict[str, Any]:
        """Sync version - not recommended."""
        import asyncio
        return asyncio.run(self._arun(url))


class AuditMetaTagsTool(DoozaTool):
    """Tool for auditing meta tags only."""
    
    name: str = "seo_audit_meta_tags"
    description: str = (
        "Check meta tags (title, description, Open Graph, Twitter Card) of a URL. "
        "Returns tag values, lengths, and issues found."
    )
    args_schema: type = AuditMetaTagsInput
    
    tool_metadata: ClassVar[ToolMetadata] = ToolMetadata(
        slug="seo.audit_meta_tags",
        category="seo",
        name="Audit Meta Tags",
        description="Check meta tags of a website",
        min_tier="free",
        ui_schema=ToolUISchema(
            display=UIDisplayType.SCORE_CARD,
            title="Meta Tags Audit",
            summary_template="Score: {score}/100",
            score_field="score",
            fields=[
                FieldMapping("title", "Title"),
                FieldMapping("title_length", "Title Length", "number"),
                FieldMapping("description", "Description"),
                FieldMapping("description_length", "Description Length", "number"),
                FieldMapping("canonical", "Canonical URL", "url"),
                FieldMapping("robots", "Robots Meta"),
            ],
        ),
    )
    
    async def _arun(self, url: str) -> Dict[str, Any]:
        try:
            html, status_code = await fetch_url(url)
            
            if status_code != 200:
                return {"success": False, "error": f"Failed to fetch (status: {status_code})"}
            
            soup = parse_html(html)
            results = analyze_meta_tags(soup, url)
            results["success"] = True
            results["url"] = url
            
            return results
            
        except Exception as e:
            return {"success": False, "error": str(e), "url": url}
    
    def _run(self, url: str) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self._arun(url))


class AnalyzeHeadingsTool(DoozaTool):
    """Tool for analyzing heading structure."""
    
    name: str = "seo_analyze_headings"
    description: str = (
        "Analyze the heading structure (H1-H6) of a webpage. "
        "Returns heading counts, texts, hierarchy issues."
    )
    args_schema: type = AnalyzeHeadingsInput
    
    tool_metadata: ClassVar[ToolMetadata] = ToolMetadata(
        slug="seo.analyze_headings",
        category="seo",
        name="Analyze Headings",
        description="Analyze heading structure of a website",
        min_tier="free",
        ui_schema=ToolUISchema(
            display=UIDisplayType.SCORE_CARD,
            title="Heading Structure",
            summary_template="Score: {score}/100 • {h1_count} H1, {h2_count} H2",
            score_field="score",
            fields=[
                FieldMapping("h1_count", "H1 Count", "number"),
                FieldMapping("h1_texts", "H1 Headings"),
                FieldMapping("h2_count", "H2 Count", "number"),
                FieldMapping("h2_texts", "H2 Headings"),
                FieldMapping("h3_count", "H3 Count", "number"),
                FieldMapping("issues", "Issues"),
            ],
        ),
    )
    
    async def _arun(self, url: str) -> Dict[str, Any]:
        try:
            html, status_code = await fetch_url(url)
            
            if status_code != 200:
                return {"success": False, "error": f"Failed to fetch (status: {status_code})"}
            
            soup = parse_html(html)
            results = analyze_heading_structure(soup)
            results["success"] = True
            results["url"] = url
            
            return results
            
        except Exception as e:
            return {"success": False, "error": str(e), "url": url}
    
    def _run(self, url: str) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self._arun(url))


class CheckImagesTool(DoozaTool):
    """Tool for checking image alt tags."""
    
    name: str = "seo_check_images"
    description: str = (
        "Check images on a webpage for alt tag usage. "
        "Returns counts of images with/without alt tags."
    )
    args_schema: type = CheckImagesInput
    
    tool_metadata: ClassVar[ToolMetadata] = ToolMetadata(
        slug="seo.check_images",
        category="seo",
        name="Check Images",
        description="Check image alt tags on a website",
        min_tier="free",
        ui_schema=ToolUISchema(
            display=UIDisplayType.SCORE_CARD,
            title="Image Alt Tags",
            summary_template="Score: {score}/100 • {total_images} images",
            score_field="score",
            fields=[
                FieldMapping("total_images", "Total Images", "number"),
                FieldMapping("images_with_alt", "With Alt Text", "number"),
                FieldMapping("images_without_alt", "Missing Alt", "number"),
                FieldMapping("images_with_empty_alt", "Empty Alt", "number"),
                FieldMapping("issues", "Issues"),
            ],
        ),
    )
    
    async def _arun(self, url: str) -> Dict[str, Any]:
        try:
            html, status_code = await fetch_url(url)
            
            if status_code != 200:
                return {"success": False, "error": f"Failed to fetch (status: {status_code})"}
            
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            soup = parse_html(html)
            results = analyze_images(soup, url)
            results["success"] = True
            results["url"] = url
            
            return results
            
        except Exception as e:
            return {"success": False, "error": str(e), "url": url}
    
    def _run(self, url: str) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self._arun(url))


class ExtractKeywordsTool(DoozaTool):
    """Tool for extracting keywords from a page."""
    
    name: str = "seo_extract_keywords"
    description: str = (
        "Extract top keywords from a webpage's content. "
        "Returns keywords with frequency counts and density percentages."
    )
    args_schema: type = ExtractKeywordsInput
    
    tool_metadata: ClassVar[ToolMetadata] = ToolMetadata(
        slug="seo.extract_keywords",
        category="seo",
        name="Extract Keywords",
        description="Extract keywords from website content",
        min_tier="free",
        ui_schema=ToolUISchema(
            display=UIDisplayType.DATA_TABLE,
            title="Keyword Analysis",
            summary_template="{word_count} words analyzed",
            fields=[
                FieldMapping("word_count", "Total Words", "number"),
                FieldMapping("keywords", "Top Keywords"),
            ],
        ),
    )
    
    async def _arun(self, url: str, top_n: int = 20) -> Dict[str, Any]:
        try:
            html, status_code = await fetch_url(url)
            
            if status_code != 200:
                return {"success": False, "error": f"Failed to fetch (status: {status_code})"}
            
            soup = parse_html(html)
            text_content = extract_text_content(soup)
            keywords = extract_keywords_from_text(text_content, top_n=top_n)
            
            return {
                "success": True,
                "url": url,
                "word_count": len(text_content.split()),
                "keywords": keywords,
            }
            
        except Exception as e:
            return {"success": False, "error": str(e), "url": url}
    
    def _run(self, url: str, top_n: int = 20) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self._arun(url, top_n))


# ============================================================================
# Tool Factory
# ============================================================================

def get_seo_tools() -> List[DoozaTool]:
    """
    Get all SEO tools for registration.
    
    Returns:
        List of SEO tool instances
    """
    return [
        AnalyzeUrlTool(),
        AuditMetaTagsTool(),
        AnalyzeHeadingsTool(),
        CheckImagesTool(),
        ExtractKeywordsTool(),
    ]
