"""
Image Generation Service - Nano Banana Pro Integration

Provides image generation capabilities using Google's Nano Banana Pro model
(also known as Gemini 3 Pro Image) via OpenRouter, Vertex AI, or Google AI Studio.

Authentication priority:
1. OpenRouter: Uses OPENROUTER_API_KEY (recommended - simplest setup)
2. Vertex AI: Uses GOOGLE_CLOUD_PROJECT + Application Default Credentials
3. Google AI Studio: Uses GEMINI_API_KEY

Usage:
    from app.services.image_gen_service import get_image_gen_service
    
    service = get_image_gen_service()
    result = await service.generate_image(
        prompt="A serene landscape at sunset",
        aspect_ratio="16:9",
    )
"""

from __future__ import annotations

import base64
import logging
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class ImageProvider(str, Enum):
    """Image generation provider."""
    openrouter = "openrouter"         # OpenRouter API (recommended)
    vertex_ai = "vertex_ai"           # Google Vertex AI (enterprise)
    google_ai_studio = "google_ai_studio"  # Google AI Studio (API key)
    stub = "stub"                      # Fallback when no provider configured


class ImageSize(str, Enum):
    """Supported image sizes for Nano Banana Pro."""
    size_1k = "1K"      # 1024x1024
    size_2k = "2K"      # 2048x2048 (higher quality)
    auto = "auto"       # Let the model decide based on aspect ratio


@dataclass
class GeneratedImage:
    """Result of image generation."""
    success: bool
    image_bytes: Optional[bytes] = None
    image_base64: Optional[str] = None
    image_url: Optional[str] = None  # Public URL after upload to storage
    mime_type: str = "image/png"
    prompt_used: str = ""
    enhanced_prompt: Optional[str] = None  # If prompt enhancement was used
    provider: ImageProvider = ImageProvider.stub
    model: str = ""
    error_message: Optional[str] = None
    
    def to_data_url(self) -> Optional[str]:
        """Convert to a data URL for embedding in HTML/responses."""
        if self.image_base64:
            return f"data:{self.mime_type};base64,{self.image_base64}"
        return None


# =============================================================================
# SERVICE CLASS
# =============================================================================

class ImageGenService:
    """
    Service for generating images using Google's Nano Banana Pro model.
    
    Supports OpenRouter (recommended), Vertex AI (enterprise), and Google AI Studio backends.
    Falls back to stub mode if no credentials are configured.
    """
    
    def __init__(self):
        self._settings = get_settings()
        self._client = None
        self._provider = self._determine_provider()
        
    def _determine_provider(self) -> ImageProvider:
        """Determine which provider to use based on configuration.
        
        Priority:
        1. OpenRouter (simplest, uses existing API key)
        2. Vertex AI (enterprise, requires GCP project)
        3. Google AI Studio (requires separate API key with billing)
        """
        # Prefer OpenRouter if configured (most reliable for image gen)
        if self._settings.openrouter_api_key:
            logger.info("Using OpenRouter for image generation")
            return ImageProvider.openrouter
        elif self._settings.google_cloud_project:
            return ImageProvider.vertex_ai
        elif self._settings.gemini_api_key:
            return ImageProvider.google_ai_studio
        else:
            logger.warning(
                "No image generation credentials configured. "
                "Set OPENROUTER_API_KEY (recommended), GOOGLE_CLOUD_PROJECT, or GEMINI_API_KEY."
            )
            return ImageProvider.stub
    
    def _get_client(self):
        """Lazily initialize the Google GenAI client (for Vertex AI / Google AI Studio)."""
        if self._client is not None:
            return self._client
        
        # OpenRouter uses httpx directly, not google-genai
        if self._provider == ImageProvider.openrouter:
            return None
            
        if self._provider == ImageProvider.stub:
            return None
            
        try:
            from google import genai
            
            if self._provider == ImageProvider.vertex_ai:
                # Vertex AI: Use project + Application Default Credentials
                # Requires: gcloud auth application-default login
                os.environ.setdefault("GOOGLE_CLOUD_PROJECT", self._settings.google_cloud_project)
                os.environ.setdefault("GOOGLE_CLOUD_LOCATION", self._settings.google_cloud_location)
                os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "True")
                
                self._client = genai.Client()
                logger.info(
                    "Initialized Vertex AI client for image generation "
                    f"(project: {self._settings.google_cloud_project})"
                )
            else:
                # Google AI Studio: Use API key
                self._client = genai.Client(api_key=self._settings.gemini_api_key)
                logger.info("Initialized Google AI Studio client for image generation")
                
            return self._client
            
        except ImportError:
            logger.error(
                "google-genai package not installed. "
                "Run: pip install google-genai"
            )
            self._provider = ImageProvider.stub
            return None
        except Exception as e:
            logger.error(f"Failed to initialize GenAI client: {e}")
            self._provider = ImageProvider.stub
            return None
    
    @property
    def provider(self) -> ImageProvider:
        """Get the current provider being used."""
        return self._provider
    
    @property
    def is_available(self) -> bool:
        """Check if image generation is available."""
        return self._provider != ImageProvider.stub
    
    async def upload_to_storage(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        user_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Upload image to Supabase Storage and return public URL.
        
        Args:
            image_bytes: Raw image bytes to upload
            mime_type: MIME type of the image
            user_id: Optional user ID for organizing files
            
        Returns:
            Public URL of the uploaded image, or None if upload fails
        """
        try:
            from app.core.database import get_supabase_client
            import time
            import uuid
            
            supabase = get_supabase_client()
            if not supabase:
                logger.error("Supabase client not available for image upload")
                return None
            
            # Generate unique filename
            timestamp = int(time.time())
            unique_id = str(uuid.uuid4())[:8]
            ext = "png" if "png" in mime_type else "jpg"
            file_name = f"gen_{timestamp}_{unique_id}.{ext}"
            
            # Organize by user if provided, otherwise use 'anonymous'
            folder = user_id or "anonymous"
            storage_path = f"{folder}/{file_name}"
            
            logger.info(f"Uploading generated image to storage: {storage_path}")
            
            # Upload to 'generated-images' bucket
            result = supabase.storage.from_('generated-images').upload(
                path=storage_path,
                file=image_bytes,
                file_options={
                    'content-type': mime_type,
                    'upsert': 'true'
                }
            )
            
            # Get public URL
            public_url = supabase.storage.from_('generated-images').get_public_url(storage_path)
            
            # Strip trailing '?' that Supabase SDK sometimes adds
            if public_url and public_url.endswith('?'):
                public_url = public_url[:-1]
            
            logger.info(f"Image uploaded successfully: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload image to storage: {e}", exc_info=True)
            return None
    
    def _is_gemini_model(self, model: str) -> bool:
        """Check if the model is a Gemini model (uses generate_content) vs Imagen (uses generate_images)."""
        return model.startswith("gemini-") or "gemini" in model.lower()
    
    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "1:1",
        image_size: ImageSize = ImageSize.size_2k,
        negative_prompt: Optional[str] = None,
        enhance_prompt: bool = True,
        num_images: int = 1,
        user_id: Optional[str] = None,
        upload_to_storage: bool = True,
        reference_images: Optional[list[str]] = None,
    ) -> GeneratedImage:
        """
        Generate an image using Google's image generation models.
        
        Supports:
        - OpenRouter (recommended): Uses chat completions API with image modality
        - Imagen models (imagen-*): Use generate_images API, require billing
        - Gemini models (gemini-*-image*): Use generate_content API with image modality
        
        Args:
            prompt: Text description of the image to generate
            aspect_ratio: Aspect ratio (1:1, 16:9, 9:16, 4:5, etc.)
            image_size: Output quality (1K, 2K, or auto)
            negative_prompt: What to avoid (appended to prompt as negative context)
            enhance_prompt: Whether to use LLM-based prompt enhancement (Vertex AI only)
            num_images: Number of images to generate (1-4)
            user_id: User ID for organizing uploaded images
            upload_to_storage: Whether to upload image to Supabase Storage (default: True)
            reference_images: List of image URLs to use as visual references (logo, brand images)
            
        Returns:
            GeneratedImage with the generated image bytes and URL (if uploaded)
        """
        # Check if service is available
        if self._provider == ImageProvider.stub:
            return self._stub_response(prompt, aspect_ratio)
        
        # Build the full prompt (including negative aspects if provided)
        full_prompt = prompt
        if negative_prompt:
            full_prompt = f"{prompt}. Avoid: {negative_prompt}"
        
        # Log reference images if provided
        if reference_images:
            logger.info(f"Using {len(reference_images)} reference image(s) for generation")
        
        # Generate the image
        result: GeneratedImage
        
        # Use OpenRouter if configured (preferred)
        if self._provider == ImageProvider.openrouter:
            model = self._settings.image_gen_model
            # Convert local model name to OpenRouter format if needed
            if not model.startswith("google/"):
                model = f"google/{model}"
            
            logger.info(f"Generating image with {model} via OpenRouter: aspect_ratio={aspect_ratio}")
            result = await self._generate_with_openrouter(model, full_prompt, aspect_ratio, reference_images)
        else:
            # Use Google's direct APIs (reference images not supported yet)
            if reference_images:
                logger.warning("Reference images are only supported with OpenRouter provider")
            
            client = self._get_client()
            if client is None:
                return self._stub_response(prompt, aspect_ratio)
            
            model = self._settings.image_gen_model
            
            logger.info(
                f"Generating image with {model} via {self._provider.value}: "
                f"aspect_ratio={aspect_ratio}"
            )
            
            # Use different APIs based on model type
            if self._is_gemini_model(model):
                result = await self._generate_with_gemini(client, model, full_prompt, aspect_ratio)
            else:
                result = await self._generate_with_imagen(
                    client, model, full_prompt, aspect_ratio, image_size, enhance_prompt, num_images
                )
        
        # Upload to storage if successful and enabled
        if result.success and upload_to_storage and result.image_bytes:
            image_url = await self.upload_to_storage(
                image_bytes=result.image_bytes,
                mime_type=result.mime_type,
                user_id=user_id,
            )
            if image_url:
                result.image_url = image_url
                logger.info(f"Image uploaded to storage: {image_url}")
            else:
                logger.warning("Failed to upload image to storage, returning base64 only")
        
        return result
    
    async def _generate_with_openrouter(
        self,
        model: str,
        prompt: str,
        aspect_ratio: str,
        reference_images: Optional[list[str]] = None,
    ) -> GeneratedImage:
        """Generate image using OpenRouter's chat completions API with image modality.
        
        Args:
            model: OpenRouter model name
            prompt: Text prompt for generation
            aspect_ratio: Target aspect ratio
            reference_images: Optional list of image URLs to use as visual references
        """
        try:
            # Build a detailed prompt for image generation
            image_prompt = f"Generate an image with aspect ratio {aspect_ratio}: {prompt}"
            
            # Build message content - can be multimodal (images + text)
            if reference_images:
                # Multimodal content: reference images + text prompt
                content = []
                
                # Add reference images first (limit to 3 to avoid token limits)
                for img_url in reference_images[:3]:
                    if img_url:
                        content.append({
                            "type": "image_url",
                            "image_url": {"url": img_url}
                        })
                        logger.info(f"Added reference image: {img_url[:80]}...")
                
                # Add text prompt with instructions to use the reference images
                content.append({
                    "type": "text",
                    "text": f"Using the provided reference images (logo, brand assets) as visual inspiration, {image_prompt}"
                })
                
                message_content = content
            else:
                # Simple text-only prompt
                message_content = image_prompt
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://dooza.ai",
                        "X-Title": "Dooza AI",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "user",
                                "content": message_content,
                            }
                        ],
                        "modalities": ["image", "text"],
                    },
                )
                
                if response.status_code != 200:
                    error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    error_msg = error_data.get("error", {}).get("message", response.text)
                    logger.error(f"OpenRouter error: {response.status_code} - {error_msg}")
                    return self._handle_error(Exception(error_msg), prompt, model)
                
                data = response.json()
                
                # Extract image from response
                # OpenRouter returns images in message.images array
                choices = data.get("choices", [])
                if choices and choices[0].get("message"):
                    message = choices[0]["message"]
                    
                    # Check for images array (OpenRouter's format)
                    images = message.get("images", [])
                    if images:
                        for img in images:
                            if img.get("type") == "image_url":
                                image_url = img.get("image_url", {}).get("url", "")
                                if image_url.startswith("data:"):
                                    return self._parse_data_url(image_url, prompt, model)
                    
                    # Fallback: Check content (older format)
                    content = message.get("content", "")
                    
                    # Check if content is a list (multimodal response)
                    if isinstance(content, list):
                        for part in content:
                            if part.get("type") == "image_url":
                                image_url = part.get("image_url", {}).get("url", "")
                                if image_url.startswith("data:"):
                                    return self._parse_data_url(image_url, prompt, model)
                    
                    # Check if content is a string with embedded data URL
                    elif isinstance(content, str) and content:
                        # Look for data URL in the response
                        data_url_match = re.search(r'data:image/[^;]+;base64,[A-Za-z0-9+/=]+', content)
                        if data_url_match:
                            return self._parse_data_url(data_url_match.group(0), prompt, model)
                
                return GeneratedImage(
                    success=False,
                    prompt_used=prompt,
                    provider=self._provider,
                    model=model,
                    error_message="No image was generated. The model may have returned text only.",
                )
                
        except httpx.TimeoutException:
            logger.error("OpenRouter request timed out")
            return GeneratedImage(
                success=False,
                prompt_used=prompt,
                provider=self._provider,
                model=model,
                error_message="Request timed out. Image generation can take up to 2 minutes.",
            )
        except Exception as e:
            logger.error(f"OpenRouter image generation failed: {e}", exc_info=True)
            return self._handle_error(e, prompt, model)
    
    def _parse_data_url(self, data_url: str, prompt: str, model: str) -> GeneratedImage:
        """Parse a data URL and return a GeneratedImage."""
        try:
            # Parse data URL: data:image/png;base64,<data>
            match = re.match(r'data:([^;]+);base64,(.+)', data_url)
            if match:
                mime_type = match.group(1)
                image_base64 = match.group(2)
                image_bytes = base64.b64decode(image_base64)
                
                return GeneratedImage(
                    success=True,
                    image_bytes=image_bytes,
                    image_base64=image_base64,
                    mime_type=mime_type,
                    prompt_used=prompt,
                    provider=self._provider,
                    model=model,
                )
        except Exception as e:
            logger.error(f"Failed to parse data URL: {e}")
        
        return GeneratedImage(
            success=False,
            prompt_used=prompt,
            provider=self._provider,
            model=model,
            error_message="Failed to parse image data from response.",
        )
    
    async def _generate_with_gemini(
        self,
        client,
        model: str,
        prompt: str,
        aspect_ratio: str,
    ) -> GeneratedImage:
        """Generate image using Gemini's generate_content API with image modality."""
        try:
            from google.genai.types import GenerateContentConfig
            
            # Build a detailed prompt for image generation
            image_prompt = f"Generate an image with aspect ratio {aspect_ratio}: {prompt}"
            
            response = client.models.generate_content(
                model=model,
                contents=image_prompt,
                config=GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )
            
            # Extract image from response
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        image_bytes = part.inline_data.data
                        mime_type = part.inline_data.mime_type or "image/png"
                        
                        return GeneratedImage(
                            success=True,
                            image_bytes=image_bytes,
                            image_base64=base64.b64encode(image_bytes).decode('utf-8'),
                            mime_type=mime_type,
                            prompt_used=prompt,
                            provider=self._provider,
                            model=model,
                        )
            
            return GeneratedImage(
                success=False,
                prompt_used=prompt,
                provider=self._provider,
                model=model,
                error_message="No image was generated. The model may have returned text only.",
            )
            
        except Exception as e:
            logger.error(f"Gemini image generation failed: {e}", exc_info=True)
            return self._handle_error(e, prompt, model)
    
    async def _generate_with_imagen(
        self,
        client,
        model: str,
        prompt: str,
        aspect_ratio: str,
        image_size: ImageSize,
        enhance_prompt: bool,
        num_images: int,
    ) -> GeneratedImage:
        """Generate image using Imagen's generate_images API."""
        try:
            from google.genai.types import GenerateImagesConfig
            
            # Configure generation
            config_kwargs = {
                "number_of_images": min(num_images, 4),
                "aspect_ratio": aspect_ratio,
            }
            
            if image_size != ImageSize.auto:
                config_kwargs["image_size"] = image_size.value
            
            # Only add enhance_prompt for Vertex AI (not supported in Google AI Studio)
            if self._provider == ImageProvider.vertex_ai and enhance_prompt:
                config_kwargs["enhance_prompt"] = True
            
            config = GenerateImagesConfig(**config_kwargs)
            
            # Generate the image
            response = client.models.generate_images(
                model=model,
                prompt=prompt,
                config=config,
            )
            
            # Extract the first generated image
            if response.generated_images and len(response.generated_images) > 0:
                generated = response.generated_images[0]
                image_bytes = generated.image.image_bytes
                
                # Get enhanced prompt if available
                enhanced_prompt = None
                if hasattr(generated, 'prompt') and generated.prompt:
                    enhanced_prompt = generated.prompt
                
                return GeneratedImage(
                    success=True,
                    image_bytes=image_bytes,
                    image_base64=base64.b64encode(image_bytes).decode('utf-8'),
                    mime_type="image/png",
                    prompt_used=prompt,
                    enhanced_prompt=enhanced_prompt,
                    provider=self._provider,
                    model=model,
                )
            else:
                return GeneratedImage(
                    success=False,
                    prompt_used=prompt,
                    provider=self._provider,
                    model=model,
                    error_message="No images were generated. The prompt may have been filtered.",
                )
                
        except Exception as e:
            logger.error(f"Imagen generation failed: {e}", exc_info=True)
            return self._handle_error(e, prompt, model)
    
    def _handle_error(self, e: Exception, prompt: str, model: str) -> GeneratedImage:
        """Handle generation errors with user-friendly messages."""
        error_msg = str(e)
        
        if "SAFETY" in error_msg.upper() or "BLOCKED" in error_msg.upper():
            error_msg = (
                "Image generation was blocked by safety filters. "
                "Please modify your prompt to be more appropriate."
            )
        elif "QUOTA" in error_msg.upper() or "RESOURCE_EXHAUSTED" in error_msg.upper():
            error_msg = (
                "Rate limit or quota exceeded. Please try again later or "
                "upgrade your Google AI plan for higher limits."
            )
        elif "billing" in error_msg.lower():
            error_msg = (
                "This model requires billing to be enabled on your Google Cloud account. "
                "Please enable billing or use a Gemini model like 'gemini-2.0-flash-exp-image-generation'."
            )
        elif "PERMISSION" in error_msg.upper() or "AUTH" in error_msg.upper():
            error_msg = "Authentication failed. Please check your API credentials."
        elif "NOT_FOUND" in error_msg.upper():
            error_msg = (
                f"Model '{model}' not found or not supported for image generation. "
                "Try 'gemini-2.0-flash-exp-image-generation' or 'imagen-4.0-generate-001'."
            )
        
        return GeneratedImage(
            success=False,
            prompt_used=prompt,
            provider=self._provider,
            model=model,
            error_message=error_msg,
        )
    
    def _stub_response(self, prompt: str, aspect_ratio: str) -> GeneratedImage:
        """Return a stub response when no provider is configured."""
        return GeneratedImage(
            success=False,
            prompt_used=prompt,
            provider=ImageProvider.stub,
            model="stub",
            error_message=(
                f"Image generation is not configured. "
                f"Set OPENROUTER_API_KEY in your environment. "
                f"Prompt ({aspect_ratio}): {prompt[:200]}..."
            ),
        )


# =============================================================================
# SERVICE SINGLETON
# =============================================================================

_service_instance: Optional[ImageGenService] = None


def get_image_gen_service() -> ImageGenService:
    """Get or create the image generation service singleton."""
    global _service_instance
    if _service_instance is None:
        _service_instance = ImageGenService()
    return _service_instance
