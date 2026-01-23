/**
 * BrandIdentityTab
 * 
 * Main brand settings form with logo and media library.
 * Auto-saves as user types (debounced).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Building2, 
  Image, 
  Loader2,
  Globe,
  Palette,
  MessageSquare,
  Target,
  Trash2,
  Upload,
  FileText,
  Check,
  AlertCircle,
  ImagePlus,
  X,
  Cloud,
  Download,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { 
  getBrandSettings,
  updateBrandSettings,
  getBrandAssets,
  deleteBrandAsset,
  createBrandAsset,
  extractBrandFromUrl,
  type BrandSettings,
  type BrandAsset,
} from '../../lib/api'
import { supabase } from '../../lib/supabase'

// ============================================================================
// Types
// ============================================================================

interface BrandFormData {
  business_name: string
  website: string
  tagline: string
  brand_voice: string
  colors: { primary: string; secondary: string; tertiary: string }
  description: string
  value_proposition: string
  industry: string
  target_audience: string
}

const INITIAL_FORM_DATA: BrandFormData = {
  business_name: '',
  website: '',
  tagline: '',
  brand_voice: '',
  colors: { primary: '#14b8a6', secondary: '#0d9488', tertiary: '#0f766e' },
  description: '',
  value_proposition: '',
  industry: '',
  target_audience: '',
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ============================================================================
// Styles
// ============================================================================

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  padding: '24px',
  marginBottom: '20px',
}

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '20px',
}

const iconWrapperStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: 'var(--gray-700)',
  marginBottom: '8px',
  letterSpacing: '-0.01em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: '1.5px solid var(--gray-200)',
  borderRadius: '10px',
  fontSize: '14px',
  transition: 'all 0.15s ease',
  outline: 'none',
  background: 'var(--gray-50)',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: '1.6',
}

// ============================================================================
// Sub-components
// ============================================================================

interface SaveStatusIndicatorProps {
  status: SaveStatus
}

function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  if (status === 'idle') return null
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      fontWeight: '500',
      color: status === 'error' ? '#dc2626' : 'var(--gray-500)',
      transition: 'all 0.2s ease',
    }}>
      {status === 'saving' && (
        <>
          <Cloud size={14} style={{ color: 'var(--primary-500)' }} />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check size={14} style={{ color: 'var(--primary-600)' }} />
          <span style={{ color: 'var(--primary-600)' }}>Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle size={14} />
          <span>Failed to save</span>
        </>
      )}
    </div>
  )
}

interface LogoCardProps {
  logo: BrandAsset | null
  uploading: boolean
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function LogoCard({ logo, uploading, onUpload, onDelete, inputRef }: LogoCardProps) {
  return (
    <div style={{ ...cardStyle, marginBottom: '20px' }}>
      <div style={{ ...sectionTitleStyle, marginBottom: '16px' }}>
        <div style={{ ...iconWrapperStyle, background: 'var(--primary-100)' }}>
          <Building2 size={18} style={{ color: 'var(--primary-600)' }} />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
          Brand Logo
        </h3>
      </div>
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onUpload}
        style={{ display: 'none' }}
      />
      
      {logo && logo.public_url ? (
        <div>
          <div style={{
            width: '100%',
            aspectRatio: '16/10',
            background: 'var(--gray-50)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '1px solid var(--gray-200)',
            position: 'relative',
          }}>
            <img
              src={logo.public_url}
              alt="Brand Logo"
              style={{ maxWidth: '75%', maxHeight: '75%', objectFit: 'contain' }}
            />
            <button
              onClick={onDelete}
              disabled={uploading}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <X size={16} style={{ color: 'var(--gray-500)' }} />
            </button>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '12px',
              background: 'var(--gray-50)',
              color: 'var(--gray-600)',
              border: '1.5px solid var(--gray-200)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={16} />
            Replace Logo
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            width: '100%',
            aspectRatio: '16/10',
            background: 'var(--gray-50)',
            borderRadius: '14px',
            border: '2px dashed var(--gray-300)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {uploading ? (
            <Loader2 size={28} style={{ color: 'var(--gray-400)', animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                marginBottom: '12px',
              }}>
                <ImagePlus size={26} style={{ color: 'var(--gray-400)' }} />
              </div>
              <span style={{ fontSize: '14px', color: 'var(--gray-600)', fontWeight: '500' }}>
                Upload your logo
              </span>
              <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
                PNG, JPG, or SVG
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface MediaLibraryCardProps {
  assets: BrandAsset[]
  loading: boolean
  uploading: boolean
  deletingId: string | null
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: (id: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

const ASSET_TYPE_CONFIG: Record<string, { icon: typeof Image; color: string }> = {
  logo: { icon: Building2, color: 'var(--primary-600)' },
  image: { icon: Image, color: 'var(--primary-500)' },
  video: { icon: FileText, color: '#dc2626' },
  document: { icon: FileText, color: '#ea580c' },
  font: { icon: FileText, color: 'var(--primary-700)' },
}

function MediaLibraryCard({ assets, loading, uploading, deletingId, onUpload, onDelete, inputRef }: MediaLibraryCardProps) {
  return (
    <div style={cardStyle}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '16px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ ...iconWrapperStyle, background: 'var(--primary-100)' }}>
            <Image size={18} style={{ color: 'var(--primary-600)' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
            Media Library
          </h3>
        </div>
        
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={onUpload}
          style={{ display: 'none' }}
        />
        
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: 'var(--primary-600)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {uploading ? (
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Upload size={14} />
          )}
          Add
        </button>
      </div>
      
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Loader2 size={24} style={{ color: 'var(--primary-600)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : assets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {assets.map(asset => {
            const config = ASSET_TYPE_CONFIG[asset.asset_type] || ASSET_TYPE_CONFIG.image
            const Icon = config.icon
            
            return (
              <div
                key={asset.id}
                style={{
                  background: 'var(--gray-50)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid var(--gray-200)',
                }}
              >
                <div style={{
                  height: '90px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--gray-50)',
                }}>
                  {asset.public_url && asset.asset_type === 'image' ? (
                    <img
                      src={asset.public_url}
                      alt={asset.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Icon size={28} style={{ color: config.color, opacity: 0.4 }} />
                  )}
                </div>
                
                <button
                  onClick={() => onDelete(asset.id)}
                  disabled={deletingId === asset.id}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    opacity: deletingId === asset.id ? 0.5 : 1,
                  }}
                >
                  {deletingId === asset.id ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Trash2 size={12} style={{ color: 'var(--gray-500)' }} />
                  )}
                </button>
                
                <div style={{ 
                  padding: '10px 12px', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  color: 'var(--gray-600)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  background: 'white',
                }}>
                  {asset.name}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '32px 20px',
          background: 'var(--gray-50)',
          borderRadius: '12px',
          border: '2px dashed var(--gray-200)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <Image size={22} style={{ color: 'var(--gray-400)' }} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0, fontWeight: '500' }}>
            No media yet
          </p>
          <p style={{ fontSize: '12px', color: 'var(--gray-400)', margin: '4px 0 0 0' }}>
            Upload images for your content
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Custom Hook: Debounced Auto-Save
// ============================================================================

function useAutoSave(
  formData: BrandFormData,
  isLoaded: boolean,
  onSave: (data: BrandFormData) => Promise<void>
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstRender = useRef(true)
  const lastSavedRef = useRef<string>('')

  useEffect(() => {
    // Skip first render (initial load) and when not loaded
    if (!isLoaded) return
    if (isFirstRender.current) {
      isFirstRender.current = false
      lastSavedRef.current = JSON.stringify(formData)
      return
    }

    // Skip if data hasn't actually changed
    const currentData = JSON.stringify(formData)
    if (currentData === lastSavedRef.current) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set saving status immediately for feedback
    setStatus('saving')

    // Debounce save (800ms after user stops typing)
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(formData)
        lastSavedRef.current = currentData
        setStatus('saved')
        // Clear "Saved" indicator after 2s
        setTimeout(() => setStatus('idle'), 2000)
      } catch {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      }
    }, 800)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [formData, isLoaded, onSave])

  return status
}

// ============================================================================
// Main Component
// ============================================================================

export default function BrandIdentityTab() {
  const { user } = useAuth()
  
  // Loading state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<BrandFormData>(INITIAL_FORM_DATA)
  
  // Logo state
  const [logo, setLogo] = useState<BrandAsset | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  
  // Media library state
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  
  // Media name prompt state
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [assetName, setAssetName] = useState('')
  
  // Website extraction state
  const [extracting, setExtracting] = useState(false)

  // Auto-save callback
  const handleSave = useCallback(async (data: BrandFormData) => {
    await updateBrandSettings({
      business_name: data.business_name || null,
      website: data.website || null,
      tagline: data.tagline || null,
      brand_voice: data.brand_voice || null,
      colors: data.colors,
      description: data.description || null,
      value_proposition: data.value_proposition || null,
      industry: data.industry || null,
      target_audience: data.target_audience || null,
    })
  }, [])

  // Auto-save hook
  const saveStatus = useAutoSave(formData, !loading, handleSave)

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!user) return
      setLoading(true)
      setAssetsLoading(true)
      setError(null)
      
      try {
        const settings = await getBrandSettings()
        
        setFormData({
          business_name: settings.business_name || '',
          website: settings.website || '',
          tagline: settings.tagline || '',
          brand_voice: settings.brand_voice || '',
          colors: {
            primary: settings.colors?.primary || '#14b8a6',
            secondary: settings.colors?.secondary || '#0d9488',
            tertiary: settings.colors?.tertiary || '#0f766e',
          },
          description: settings.description || '',
          value_proposition: settings.value_proposition || '',
          industry: settings.industry || '',
          target_audience: settings.target_audience || '',
        })
        
        const allAssets = await getBrandAssets()
        const logoAsset = allAssets.find(a => a.asset_type === 'logo')
        const otherAssets = allAssets.filter(a => a.asset_type !== 'logo')
        
        setLogo(logoAsset || null)
        setAssets(otherAssets)
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
        setAssetsLoading(false)
      }
    }
    
    loadData()
  }, [user])
  
  // Upload logo
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    
    setLogoUploading(true)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `${user.id}/logo/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, file, { upsert: true })
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(filePath)
      
      if (logo) {
        await deleteBrandAsset(logo.id)
      }
      
      const newLogo = await createBrandAsset({
        asset_type: 'logo',
        name: file.name,
        file_path: filePath,
        public_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
      })
      
      setLogo(newLogo)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setError('Failed to upload logo')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }, [user, logo])
  
  // Handle file selection - show name prompt first
  const handleMediaSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    
    // Store the file and show name prompt
    setPendingFile(file)
    // Default name is filename without extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setAssetName(nameWithoutExt)
    setShowNamePrompt(true)
    
    // Clear input so same file can be selected again if needed
    if (mediaInputRef.current) mediaInputRef.current.value = ''
  }, [user])
  
  // Cancel the name prompt
  const handleCancelUpload = useCallback(() => {
    setPendingFile(null)
    setAssetName('')
    setShowNamePrompt(false)
  }, [])
  
  // Confirm and upload with the entered name
  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFile || !user || !assetName.trim()) return
    
    setShowNamePrompt(false)
    setMediaUploading(true)
    
    try {
      let assetType: 'image' | 'video' | 'document' = 'image'
      if (pendingFile.type.startsWith('video/')) assetType = 'video'
      else if (pendingFile.type.startsWith('application/')) assetType = 'document'
      
      const fileExt = pendingFile.name.split('.').pop()
      const fileName = `${assetType}-${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${assetType}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, pendingFile)
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(filePath)
      
      const newAsset = await createBrandAsset({
        asset_type: assetType,
        name: assetName.trim(),  // Use the user-entered name
        file_path: filePath,
        public_url: publicUrl,
        file_size: pendingFile.size,
        mime_type: pendingFile.type,
      })
      
      setAssets(prev => [newAsset, ...prev])
    } catch (err) {
      console.error('Media upload failed:', err)
      setError('Failed to upload media')
    } finally {
      setMediaUploading(false)
      setPendingFile(null)
      setAssetName('')
    }
  }, [user, pendingFile, assetName])
  
  // Delete asset
  const handleDeleteAsset = useCallback(async (assetId: string) => {
    setDeletingAsset(assetId)
    try {
      await deleteBrandAsset(assetId)
      setAssets(prev => prev.filter(a => a.id !== assetId))
    } catch (err) {
      console.error('Failed to delete asset:', err)
    } finally {
      setDeletingAsset(null)
    }
  }, [])
  
  // Delete logo
  const handleDeleteLogo = useCallback(async () => {
    if (!logo) return
    setLogoUploading(true)
    try {
      await deleteBrandAsset(logo.id)
      setLogo(null)
    } catch (err) {
      console.error('Failed to delete logo:', err)
    } finally {
      setLogoUploading(false)
    }
  }, [logo])
  
  // Extract brand from website
  const handleExtractFromWebsite = useCallback(async () => {
    const url = formData.website.trim()
    if (!url) {
      setError('Please enter a website URL first')
      return
    }
    
    setExtracting(true)
    setError(null)
    
    try {
      const result = await extractBrandFromUrl(url)
      
      if (!result.success) {
        throw new Error(result.error || 'Extraction failed')
      }
      
      const extracted = result.extracted
      
      // Update form with extracted data
      setFormData({
        business_name: extracted.business_name || '',
        website: extracted.website || url,
        tagline: extracted.tagline || '',
        brand_voice: '', // Not extracted, keep empty
        colors: {
          primary: extracted.colors?.primary || '#14b8a6',
          secondary: extracted.colors?.secondary || '#0d9488',
          tertiary: '#0f766e', // Not typically extracted
        },
        description: extracted.description || '',
        value_proposition: extracted.value_proposition || '',
        industry: extracted.industry || '',
        target_audience: extracted.target_audience || '',
      })
      
      // Reload assets to get the new logo if extracted
      if (result.logo.saved) {
        const allAssets = await getBrandAssets()
        const logoAsset = allAssets.find(a => a.asset_type === 'logo')
        setLogo(logoAsset || null)
      }
      
    } catch (err) {
      console.error('Brand extraction failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to extract brand data')
    } finally {
      setExtracting(false)
    }
  }, [formData.website])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={36} style={{ color: 'var(--primary-600)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 360px', 
      gap: '28px', 
      alignItems: 'start' 
    }}>
      {/* Left Column - Brand Settings */}
      <div>
        {/* Error notification */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            marginBottom: '20px',
            color: '#991b1b',
            fontWeight: '500',
            fontSize: '14px',
          }}>
            <AlertCircle size={20} />
            {error}
            <button 
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} color="#991b1b" />
            </button>
          </div>
        )}
        
        {/* Business Identity */}
        <div style={cardStyle}>
          <div style={{ ...sectionTitleStyle, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ ...iconWrapperStyle, background: 'var(--primary-100)' }}>
                <Building2 size={18} style={{ color: 'var(--primary-600)' }} />
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
                Business Identity
              </h2>
            </div>
            <SaveStatusIndicator status={saveStatus} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Business Name</label>
              <input
                type="text"
                value={formData.business_name}
                onChange={e => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                placeholder="e.g., Dooza"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={13} style={{ color: 'var(--gray-500)' }} />
                Website
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleExtractFromWebsite}
                  disabled={extracting || !formData.website.trim()}
                  title="Fetch brand info from website"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    background: extracting ? 'var(--gray-100)' : 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
                    color: extracting ? 'var(--gray-400)' : 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: extracting || !formData.website.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    boxShadow: extracting ? 'none' : '0 2px 8px rgba(20, 184, 166, 0.3)',
                  }}
                >
                  {extracting ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Auto-fill
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label style={labelStyle}>Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={e => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                placeholder="Your memorable slogan"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                placeholder="e.g., SaaS, E-commerce"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
        
        {/* Brand Voice */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <div style={{ ...iconWrapperStyle, background: 'var(--primary-100)' }}>
              <MessageSquare size={18} style={{ color: 'var(--primary-600)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
                Brand Voice
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)', margin: '2px 0 0 0' }}>
                How your brand speaks and connects
              </p>
            </div>
          </div>
          
          <textarea
            value={formData.brand_voice}
            onChange={e => setFormData(prev => ({ ...prev, brand_voice: e.target.value }))}
            placeholder="Describe your brand's personality and tone. For example: 'We speak like a knowledgeable friend—warm, clear, and confident. We avoid jargon and focus on being helpful.'"
            rows={4}
            style={textareaStyle}
          />
        </div>
        
        {/* Color Palette */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <div style={{ ...iconWrapperStyle, background: 'var(--primary-100)' }}>
              <Palette size={18} style={{ color: 'var(--primary-600)' }} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
              Color Palette
            </h2>
          </div>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            {(['primary', 'secondary', 'tertiary'] as const).map(colorKey => (
              <div key={colorKey} style={{ flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: 'var(--gray-500)', 
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {colorKey}
                </label>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '10px 14px',
                  background: 'var(--gray-50)',
                  borderRadius: '12px',
                  border: '1.5px solid var(--gray-200)',
                }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="color"
                      value={formData.colors[colorKey]}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        colors: { ...prev.colors, [colorKey]: e.target.value }
                      }))}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '10px',
                      border: '3px solid white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                  <input
                    type="text"
                    value={formData.colors[colorKey]}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      colors: { ...prev.colors, [colorKey]: e.target.value }
                    }))}
                    style={{
                      width: '80px',
                      padding: '8px',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--gray-700)',
                      fontWeight: '500',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Company Details */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <div style={{ ...iconWrapperStyle, background: 'var(--primary-100)' }}>
              <Target size={18} style={{ color: 'var(--primary-600)' }} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
              Company Story
            </h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>What We Do</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your business and the problems you solve..."
                rows={3}
                style={textareaStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>What Makes Us Different</label>
              <textarea
                value={formData.value_proposition}
                onChange={e => setFormData(prev => ({ ...prev, value_proposition: e.target.value }))}
                placeholder="Your unique value proposition..."
                rows={3}
                style={textareaStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Target Audience</label>
              <input
                type="text"
                value={formData.target_audience}
                onChange={e => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                placeholder="Who are your ideal customers?"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Column - Logo & Media */}
      <div style={{ position: 'sticky', top: '32px' }}>
        <LogoCard
          logo={logo}
          uploading={logoUploading}
          onUpload={handleLogoUpload}
          onDelete={handleDeleteLogo}
          inputRef={logoInputRef}
        />
        
        <MediaLibraryCard
          assets={assets}
          loading={assetsLoading}
          uploading={mediaUploading}
          deletingId={deletingAsset}
          onUpload={handleMediaSelect}
          onDelete={handleDeleteAsset}
          inputRef={mediaInputRef}
        />
      </div>
      
      {/* Name Prompt Dialog */}
      {showNamePrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--gray-900)',
              margin: '0 0 8px 0',
            }}>
              Name this asset
            </h3>
            <p style={{
              fontSize: '14px',
              color: 'var(--gray-500)',
              margin: '0 0 20px 0',
            }}>
              Give a descriptive name to help AI find and use this media.
            </p>
            
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g., Company logo dark, Team photo 2024, Product hero image"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && assetName.trim()) {
                  handleConfirmUpload()
                } else if (e.key === 'Escape') {
                  handleCancelUpload()
                }
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1.5px solid var(--gray-200)',
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '20px',
              }}
            />
            
            {pendingFile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                background: 'var(--gray-50)',
                borderRadius: '10px',
                marginBottom: '20px',
              }}>
                <Image size={20} style={{ color: 'var(--gray-400)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--gray-700)',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {pendingFile.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    {(pendingFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelUpload}
                style={{
                  padding: '10px 20px',
                  background: 'var(--gray-100)',
                  color: 'var(--gray-600)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={!assetName.trim()}
                style={{
                  padding: '10px 20px',
                  background: assetName.trim() 
                    ? 'linear-gradient(135deg, var(--primary-500), var(--primary-600))' 
                    : 'var(--gray-200)',
                  color: assetName.trim() ? 'white' : 'var(--gray-400)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: assetName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
