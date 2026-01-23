"""
Brand Extractor Service

Extracts brand information from company URLs using:
1. Reliable HTML parsing (meta tags, favicon, social links)
2. LLM analysis of page text (description, value prop, audience, industry)

Production-ready with:
- Graceful degradation (saves what we can extract)
- Proper error handling and logging
- Timeout handling for HTTP requests
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field as PydanticField

from app.agents.base import get_llm
from app.core.database import get_supabase_client
from app.services.knowledge_service import get_knowledge_service

logger = logging.getLogger(__name__)


# =============================================================================
# HTTP UTILITIES
# =============================================================================

DEFAULT_TIMEOUT = 30.0
MAX_RESPONSE_SIZE = 10 * 1024 * 1024  # 10MB
USER_AGENT = 'Mozilla/5.0 (compatible; DoozaBot/1.0; +https://dooza.ai)'


async def fetch_url(url: str, timeout: float = DEFAULT_TIMEOUT) -> Tuple[str, int]:
    """
    Fetch URL content with proper error handling.
    
    Args:
        url: The URL to fetch
        timeout: Request timeout in seconds
        
    Returns:
        Tuple of (html_content, status_code)
    """
    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
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
    return BeautifulSoup(html, 'html.parser')


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


async def download_and_upload_logo(
    logo_url: str, 
    org_id: str, 
    company_name: Optional[str] = None
) -> Optional[dict]:
    """
    Download logo from external URL and upload to Supabase Storage.
    
    Args:
        logo_url: External URL of the logo
        org_id: Organization ID for storage path
        company_name: Optional company name for file naming
        
    Returns:
        dict with storage_path and public_url, or None if failed
    """
    try:
        logger.info(f"Downloading logo from: {logo_url}")
        
        # Download the image
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
        ) as client:
            response = await client.get(logo_url, headers={
                'User-Agent': USER_AGENT,
                'Accept': 'image/*',
            })
            
            if response.status_code != 200:
                logger.warning(f"Failed to download logo: HTTP {response.status_code}")
                return None
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                logger.warning(f"Logo URL returned non-image content type: {content_type}")
                return None
            
            # Determine file extension
            ext_map = {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/svg+xml': 'svg',
                'image/x-icon': 'ico',
                'image/vnd.microsoft.icon': 'ico',
            }
            ext = ext_map.get(content_type.split(';')[0], 'png')
            
            # Also try to get extension from URL
            url_ext = logo_url.split('.')[-1].lower()
            if url_ext in ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico']:
                ext = url_ext if url_ext != 'jpeg' else 'jpg'
            
            image_data = response.content
            
            # Check file size (max 5MB)
            if len(image_data) > 5 * 1024 * 1024:
                logger.warning(f"Logo too large: {len(image_data)} bytes")
                return None
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        if not supabase:
            logger.error("Supabase client not available for storage upload")
            return None
        
        # Generate storage path
        import time
        timestamp = int(time.time())
        safe_name = re.sub(r'[^a-zA-Z0-9]', '_', company_name or 'company')[:30]
        file_name = f"logo_{safe_name}_{timestamp}.{ext}"
        storage_path = f"{org_id}/logo/{file_name}"
        
        logger.info(f"Uploading logo to storage: {storage_path}")
        
        # Upload to 'brand-assets' bucket
        result = supabase.storage.from_('brand-assets').upload(
            path=storage_path,
            file=image_data,
            file_options={
                'content-type': content_type or f'image/{ext}',
                'upsert': 'true'  # Overwrite if exists
            }
        )
        
        # Get public URL
        public_url_result = supabase.storage.from_('brand-assets').get_public_url(storage_path)
        
        logger.info(f"Logo uploaded successfully: {public_url_result}")
        
        return {
            'storage_path': storage_path,
            'public_url': public_url_result,
            'file_size': len(image_data),
            'mime_type': content_type or f'image/{ext}',
        }
        
    except Exception as e:
        logger.error(f"Failed to download/upload logo: {e}", exc_info=True)
        return None


# =============================================================================
# CONSTANTS
# =============================================================================

# Social media domain patterns for link detection
SOCIAL_PATTERNS = {
    "twitter": r"(?:twitter\.com|x\.com)/",
    "linkedin": r"linkedin\.com/(?:company|in)/",
    "instagram": r"instagram\.com/",
    "facebook": r"facebook\.com/",
    "youtube": r"youtube\.com/(?:@|channel|c/|user/)",
    "tiktok": r"tiktok\.com/@",
    "github": r"github\.com/",
    "pinterest": r"pinterest\.com/",
}

# CSS variable patterns for color extraction
COLOR_VAR_PATTERNS = [
    r"--primary(?:-color)?",
    r"--secondary(?:-color)?",
    r"--accent(?:-color)?",
    r"--brand(?:-color)?",
    r"--main(?:-color)?",
]

# Max text length to send to LLM (to avoid token limits)
MAX_TEXT_FOR_LLM = 4000


# =============================================================================
# RELIABLE EXTRACTION (HTML Parsing)
# =============================================================================

def extract_company_name(soup: BeautifulSoup, url: str = "") -> Optional[str]:
    """
    Extract company name from reliable sources.
    
    Priority:
    1. og:site_name meta tag (most reliable)
    2. Schema.org Organization name
    3. Domain name extraction
    4. Title tag (cleaned, last resort)
    """
    # Try og:site_name first - this is specifically for the site name
    og_site = soup.find("meta", property="og:site_name")
    if og_site and og_site.get("content"):
        name = og_site["content"].strip()
        # og:site_name should be short company name, not tagline
        if len(name) < 50 and "|" not in name and "-" not in name:
            return name
    
    # Try schema.org
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict):
                if data.get("@type") == "Organization" and data.get("name"):
                    return data["name"]
                # Check for nested organization
                if isinstance(data.get("publisher"), dict):
                    if data["publisher"].get("name"):
                        return data["publisher"]["name"]
        except (json.JSONDecodeError, TypeError):
            continue
    
    # Try to extract from domain name (often more reliable than title)
    if url:
        domain_name = extract_domain_name(url)
        if domain_name and len(domain_name) > 2:
            return domain_name
    
    # Fall back to title tag - but be smart about taglines
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
        
        # Split on common separators and take the shortest part that looks like a name
        parts = re.split(r"\s*[|\-–—:]\s*", title)
        
        # Find the part that looks most like a company name (short, capitalized)
        for part in parts:
            part = part.strip()
            # Skip very long parts (likely taglines)
            if len(part) > 40:
                continue
            # Skip parts that look like taglines (contain common words)
            tagline_words = ["that", "your", "the", "for", "with", "and", "our", "best", "top", "free"]
            if any(word in part.lower().split() for word in tagline_words):
                continue
            # Good candidate
            if part and len(part) < 40:
                return part
        
        # If no good candidate found, use the shortest part
        if parts:
            shortest = min(parts, key=len)
            if shortest and len(shortest) < 50:
                return shortest.strip()
    
    return None


def extract_tagline(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract tagline/slogan from meta description or og:title.
    """
    # Try og:title (often contains tagline)
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        content = og_title["content"].strip()
        if len(content) < 150:  # Reasonable tagline length
            return content
    
    # Try meta description as fallback
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        content = meta_desc["content"].strip()
        # Only use if it's short enough to be a tagline
        if len(content) < 100:
            return content
    
    return None


def extract_logo_url(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """
    Extract logo URL from reliable sources.
    
    Priority:
    1. Schema.org logo
    2. Apple touch icon (high quality)
    3. Large favicon
    4. og:image (if it looks like a logo)
    """
    # Try schema.org logo
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict):
                logo = data.get("logo")
                if isinstance(logo, str):
                    return urljoin(base_url, logo)
                if isinstance(logo, dict) and logo.get("url"):
                    return urljoin(base_url, logo["url"])
        except (json.JSONDecodeError, TypeError):
            continue
    
    # Try apple-touch-icon (usually high quality)
    apple_icon = soup.find("link", rel=lambda x: x and "apple-touch-icon" in x)
    if apple_icon and apple_icon.get("href"):
        return urljoin(base_url, apple_icon["href"])
    
    # Try large favicon
    for link in soup.find_all("link", rel=lambda x: x and "icon" in str(x).lower()):
        href = link.get("href")
        sizes = link.get("sizes", "")
        if href:
            # Prefer larger icons
            if "192" in sizes or "180" in sizes or "152" in sizes or "144" in sizes:
                return urljoin(base_url, href)
    
    # Fallback to any favicon
    favicon = soup.find("link", rel="icon") or soup.find("link", rel="shortcut icon")
    if favicon and favicon.get("href"):
        return urljoin(base_url, favicon["href"])
    
    # Try og:image as last resort
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        return og_image["content"]
    
    # Default favicon location
    return urljoin(base_url, "/favicon.ico")


def extract_social_links(soup: BeautifulSoup) -> dict[str, str]:
    """
    Extract social media links by matching URL patterns.
    
    Scans all links on the page and identifies social media profiles.
    """
    social_links = {}
    
    for link in soup.find_all("a", href=True):
        href = link["href"]
        
        for platform, pattern in SOCIAL_PATTERNS.items():
            if platform not in social_links and re.search(pattern, href, re.I):
                # Clean the URL
                if href.startswith("//"):
                    href = "https:" + href
                elif not href.startswith("http"):
                    continue  # Skip relative URLs for social links
                
                social_links[platform] = href
                break
    
    return social_links


def extract_colors_from_css(soup: BeautifulSoup) -> dict[str, str]:
    """
    Extract brand colors from CSS variables in style tags.
    
    Looks for common CSS variable patterns like --primary-color.
    """
    colors = {}
    color_mapping = {
        "primary": ["--primary", "--primary-color", "--brand", "--brand-color", "--main", "--main-color"],
        "secondary": ["--secondary", "--secondary-color", "--accent", "--accent-color"],
    }
    
    # Look in style tags
    for style in soup.find_all("style"):
        css_text = style.string or ""
        
        for color_key, var_names in color_mapping.items():
            if color_key in colors:
                continue
                
            for var_name in var_names:
                # Match CSS variable definition: --var-name: #color;
                pattern = rf"{re.escape(var_name)}\s*:\s*(#[0-9a-fA-F]{{3,8}}|rgb[a]?\([^)]+\))"
                match = re.search(pattern, css_text, re.I)
                if match:
                    colors[color_key] = match.group(1)
                    break
    
    return colors


def extract_fonts(soup: BeautifulSoup) -> dict[str, str]:
    """
    Extract font information from Google Fonts links.
    """
    fonts = {}
    
    # Look for Google Fonts links
    for link in soup.find_all("link", href=True):
        href = link["href"]
        if "fonts.googleapis.com" in href or "fonts.gstatic.com" in href:
            # Extract font family from URL
            # e.g., family=Roboto:wght@400 or family=Open+Sans
            match = re.search(r"family=([^:&]+)", href)
            if match:
                font_name = match.group(1).replace("+", " ")
                if "heading" not in fonts:
                    fonts["heading"] = font_name
                elif "body" not in fonts:
                    fonts["body"] = font_name
    
    return fonts


def extract_domain_name(url: str) -> str:
    """
    Extract clean domain name as fallback for company name.
    
    e.g., "https://my-company.com/about" -> "my company"
    """
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path
    
    # Remove www and TLD
    domain = re.sub(r"^www\.", "", domain)
    domain = re.sub(r"\.(com|io|ai|co|org|net|app|dev)$", "", domain, flags=re.I)
    
    # Convert hyphens to spaces and title case
    name = domain.replace("-", " ").replace("_", " ")
    
    return name.title()


# =============================================================================
# LLM ANALYSIS
# =============================================================================

class BrandAnalysis(BaseModel):
    """Structured output for brand analysis from LLM."""
    description: Optional[str] = PydanticField(
        None, 
        description="2-3 sentence summary of what this company does"
    )
    value_proposition: Optional[str] = PydanticField(
        None,
        description="What makes them unique or different (1-2 sentences)"
    )
    target_audience: Optional[str] = PydanticField(
        None,
        description="Who are their ideal customers"
    )
    industry: Optional[str] = PydanticField(
        None,
        description="Primary industry category (e.g., AI/SaaS, Healthcare, E-commerce)"
    )


async def analyze_with_llm(page_text: str, company_name: Optional[str] = None) -> dict[str, Optional[str]]:
    """
    Use LLM with structured output to extract semantic fields from page text.
    
    Uses Pydantic model with `with_structured_output()` for guaranteed valid JSON.
    
    Returns:
        dict with keys: description, value_proposition, target_audience, industry
        Values are None if LLM couldn't determine confidently.
    """
    # Truncate text if too long
    text = page_text[:MAX_TEXT_FOR_LLM] if len(page_text) > MAX_TEXT_FOR_LLM else page_text
    
    if not text.strip():
        logger.warning("No text content to analyze")
        return {"description": None, "value_proposition": None, "target_audience": None, "industry": None}
    
    company_context = f"Company name: {company_name}\n" if company_name else ""
    
    prompt = f"""Analyze this company website and extract key business information.

{company_context}Website content:
---
{text}
---

Extract:
1. description: What does this company do? (2-3 factual sentences)
2. value_proposition: What makes them unique? (1-2 sentences, or null if unclear)
3. target_audience: Who are their ideal customers? (be specific)
4. industry: Primary category like "AI/SaaS", "Healthcare Tech", "E-commerce", "FinTech", "Marketing Tech"

Be factual and specific based on the content. If something is unclear, set it to null."""

    try:
        logger.info("Starting LLM analysis for brand extraction (structured output)...")
        llm = get_llm(streaming=False)
        
        # Use structured output - guarantees valid Pydantic model
        structured_llm = llm.with_structured_output(BrandAnalysis)
        result: BrandAnalysis = await structured_llm.ainvoke(prompt)
        
        extracted = {
            "description": result.description,
            "value_proposition": result.value_proposition,
            "target_audience": result.target_audience,
            "industry": result.industry,
        }
        logger.info(f"LLM extraction successful: industry={extracted.get('industry')}")
        return extracted
        
    except Exception as e:
        logger.error(f"LLM structured output failed: {e}", exc_info=True)
        
        # Fallback: try regex parsing if structured output fails
        try:
            logger.info("Falling back to regex JSON parsing...")
            llm = get_llm(streaming=False)
            response = await llm.ainvoke(prompt + "\n\nReturn as JSON only.")
            content = response.content if hasattr(response, "content") else str(response)
            
            # Try to extract JSON
            json_match = re.search(r"\{.*\}", content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    "description": result.get("description"),
                    "value_proposition": result.get("value_proposition"),
                    "target_audience": result.get("target_audience"),
                    "industry": result.get("industry"),
                }
        except Exception as fallback_error:
            logger.error(f"Fallback parsing also failed: {fallback_error}")
        
        return {"description": None, "value_proposition": None, "target_audience": None, "industry": None}


# =============================================================================
# MAIN EXTRACTION FUNCTION
# =============================================================================

async def extract_and_save_brand(url: str, org_id: str, user_id: Optional[str] = None) -> dict[str, Any]:
    """
    Extract brand information from URL and save to database.
    
    This is the main entry point. It:
    1. Fetches the URL
    2. Extracts reliable data (meta tags, favicon, social links)
    3. Uses LLM to analyze page text for semantic fields
    4. Saves everything to brand_settings and brand_assets
    
    Args:
        url: Company website URL
        org_id: Organization ID to save data for
        user_id: Optional user ID for audit trail
        
    Returns:
        dict with extraction results and what was saved
        
    Raises:
        ValueError: If URL cannot be fetched
    """
    logger.info(f"Extracting brand from URL: {url} for org: {org_id}")
    
    # Normalize URL
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    
    # Fetch HTML
    try:
        html, status_code = await fetch_url(url)
    except Exception as e:
        logger.error(f"Failed to fetch URL {url}: {e}")
        raise ValueError(f"Could not fetch URL: {e}")
    
    if status_code != 200:
        raise ValueError(f"Failed to fetch URL (HTTP {status_code})")
    
    # Parse HTML
    soup = parse_html(html)
    
    # ==========================================================================
    # Stage 1: Reliable Extraction
    # ==========================================================================
    
    company_name = extract_company_name(soup, url) or extract_domain_name(url)
    tagline = extract_tagline(soup)
    logo_url = extract_logo_url(soup, url)
    social_links = extract_social_links(soup)
    colors = extract_colors_from_css(soup)
    fonts = extract_fonts(soup)
    
    logger.info(f"Reliable extraction complete:")
    logger.info(f"  - Company name: {company_name}")
    logger.info(f"  - Tagline: {tagline}")
    logger.info(f"  - Logo found: {bool(logo_url)}")
    logger.info(f"  - Social links: {list(social_links.keys()) if social_links else 'none'}")
    logger.info(f"  - Colors: {colors}")
    logger.info(f"  - Fonts: {fonts}")
    
    # ==========================================================================
    # Stage 2: LLM Analysis
    # ==========================================================================
    
    page_text = extract_text_content(soup)
    logger.info(f"Page text extracted: {len(page_text)} characters")
    
    llm_fields = await analyze_with_llm(page_text, company_name)
    
    logger.info(f"LLM analysis complete:")
    logger.info(f"  - Description: {bool(llm_fields.get('description'))}")
    logger.info(f"  - Value prop: {bool(llm_fields.get('value_proposition'))}")
    logger.info(f"  - Target audience: {bool(llm_fields.get('target_audience'))}")
    logger.info(f"  - Industry: {llm_fields.get('industry')}")
    
    # ==========================================================================
    # Stage 3: Save to Database
    # ==========================================================================
    
    service = get_knowledge_service()
    
    # Save brand settings
    settings = await service.save_brand_settings(
        org_id,
        business_name=company_name,
        website=url,
        tagline=tagline,
        colors=colors if colors else None,
        fonts=fonts if fonts else None,
        social_links=social_links if social_links else None,
        description=llm_fields.get("description"),
        value_proposition=llm_fields.get("value_proposition"),
        target_audience=llm_fields.get("target_audience"),
        industry=llm_fields.get("industry"),
        created_by=user_id,
    )
    
    # Save logo as brand asset (if found and not just favicon.ico)
    # Download from external URL and upload to Supabase Storage
    logo_saved = False
    logo_storage_url = None
    if logo_url and not logo_url.endswith("/favicon.ico"):
        try:
            # Remove old auto-extracted logos first to avoid duplicates
            existing_logos = await service.get_brand_assets(org_id, asset_type="logo")
            for old_logo in existing_logos:
                if old_logo.description == "Auto-extracted from website":
                    await service.delete_brand_asset(org_id, old_logo.id)
                    logger.info(f"Deleted old auto-extracted logo: {old_logo.id}")
            
            # Download and upload to Supabase Storage
            upload_result = await download_and_upload_logo(logo_url, org_id, company_name)
            
            if upload_result:
                # Save with Supabase Storage URL
                await service.save_brand_asset(
                    org_id,
                    asset_type="logo",
                    name=f"{company_name} Logo" if company_name else "Company Logo",
                    file_path=upload_result['storage_path'],
                    public_url=upload_result['public_url'],
                    file_size=upload_result.get('file_size'),
                    mime_type=upload_result.get('mime_type'),
                    description="Auto-extracted from website",
                    uploaded_by=user_id,
                )
                logo_saved = True
                logo_storage_url = upload_result['public_url']
                logger.info(f"Logo saved to Supabase Storage: {upload_result['public_url']}")
            else:
                # Fallback: save external URL if upload failed
                logger.warning("Logo upload failed, saving external URL as fallback")
                await service.save_brand_asset(
                    org_id,
                    asset_type="logo",
                    name=f"{company_name} Logo" if company_name else "Company Logo",
                    file_path=logo_url,
                    public_url=logo_url,
                    description="Auto-extracted from website (external URL)",
                    uploaded_by=user_id,
                )
                logo_saved = True
                logo_storage_url = logo_url
                
        except Exception as e:
            logger.warning(f"Failed to save logo asset: {e}")
    
    logger.info(f"Brand extraction saved for org {org_id}")
    
    # ==========================================================================
    # Return Results
    # ==========================================================================
    
    return {
        "success": True,
        "url": url,
        "extracted": {
            "business_name": company_name,
            "website": url,
            "tagline": tagline,
            "colors": colors,
            "fonts": fonts,
            "social_links": social_links,
            "description": llm_fields.get("description"),
            "value_proposition": llm_fields.get("value_proposition"),
            "target_audience": llm_fields.get("target_audience"),
            "industry": llm_fields.get("industry"),
        },
        "logo": {
            "found": bool(logo_url),
            "saved": logo_saved,
            "url": logo_storage_url or logo_url,
            "original_url": logo_url,
        },
        "settings_saved": settings is not None,
    }
