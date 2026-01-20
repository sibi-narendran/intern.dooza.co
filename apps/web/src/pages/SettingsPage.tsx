import { useState } from 'react'
import { User, Building2, CreditCard, Users, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type SettingsTab = 'profile' | 'workspace' | 'billing' | 'team'

export default function SettingsPage() {
  const { user, profile, currentOrg } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'My Profile', icon: User },
    { id: 'workspace' as SettingsTab, label: currentOrg?.name || 'Workspace', icon: Building2 },
    { id: 'billing' as SettingsTab, label: 'Usage & Billing', icon: CreditCard },
    { id: 'team' as SettingsTab, label: 'Team Members', icon: Users },
  ]

  const getUserDisplayName = (): string => {
    if (profile?.first_name) {
      return profile.first_name
    }
    if (user?.user_metadata?.first_name) {
      return user.user_metadata.first_name as string
    }
    return user?.email?.split('@')[0] || 'User'
  }

  const getUserLastName = (): string => {
    if (profile?.last_name) {
      return profile.last_name
    }
    if (user?.user_metadata?.last_name) {
      return user.user_metadata.last_name as string
    }
    return ''
  }

  const getUserEmail = (): string => {
    return profile?.email || user?.email || ''
  }

  const getAvatarUrl = (): string | null => {
    return (user?.user_metadata?.avatar_url as string) || null
  }

  const getInitials = (): string => {
    const name = getUserDisplayName()
    return name[0]?.toUpperCase() || '?'
  }

  return (
    <div className="page-scrollable" style={{ padding: '32px 40px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-900)', margin: 0 }}>
            Settings
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '40px' }}>
          {/* Sidebar Navigation */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {tabs.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: isActive ? 'var(--gray-100)' : 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      color: isActive ? 'var(--gray-900)' : 'var(--gray-600)',
                      fontWeight: isActive ? '600' : '500',
                      fontSize: '14px'
                    }}
                  >
                    <Icon size={18} />
                    <span style={{ flex: 1 }}>{tab.label}</span>
                    {isActive && <ChevronRight size={16} style={{ color: 'var(--gray-400)' }} />}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1 }}>
            {activeTab === 'profile' && (
              <ProfileSection
                avatarUrl={getAvatarUrl()}
                initials={getInitials()}
                firstName={getUserDisplayName()}
                lastName={getUserLastName()}
                email={getUserEmail()}
              />
            )}

            {activeTab === 'workspace' && (
              <WorkspaceSection orgName={currentOrg?.name || 'Workspace'} />
            )}

            {activeTab === 'billing' && <BillingSection />}

            {activeTab === 'team' && <TeamSection />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Profile Section
// ============================================================================

interface ProfileSectionProps {
  avatarUrl: string | null
  initials: string
  firstName: string
  lastName: string
  email: string
}

function ProfileSection({ avatarUrl, initials, firstName, lastName, email }: ProfileSectionProps) {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '32px' }}>
        My Profile
      </h2>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--primary-400), var(--primary-600))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: '16px',
          position: 'relative'
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '36px', fontWeight: '600', color: 'white' }}>{initials}</span>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-900)', margin: '0 0 4px' }}>
            {firstName} {lastName}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', margin: 0 }}>
            {email}
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--gray-800)', margin: '0 0 8px' }}>
          Personal details
        </h3>

        <FormField label="Name" value={firstName} disabled />
        <FormField label="Surname" value={lastName} disabled />
        <FormField label="Email" value={email} disabled />
        <FormField label="Job title" value="" placeholder="Enter your job title" disabled />
      </div>

      <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '24px' }}>
        Profile information is managed through your Dooza account. Changes will sync automatically.
      </p>
    </div>
  )
}

// ============================================================================
// Workspace Section
// ============================================================================

function WorkspaceSection({ orgName }: { orgName: string }) {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '32px' }}>
        Workspace Settings
      </h2>

      <div style={{
        padding: '24px',
        background: 'var(--gray-50)',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={24} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
              {orgName}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0' }}>
              Your current workspace
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField label="Workspace name" value={orgName} disabled />
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '16px' }}>
        Workspace settings are managed by organization admins.
      </p>
    </div>
  )
}

// ============================================================================
// Billing Section
// ============================================================================

function BillingSection() {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '32px' }}>
        Usage & Billing
      </h2>

      <div style={{
        padding: '40px',
        background: 'var(--gray-50)',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
        textAlign: 'center'
      }}>
        <CreditCard size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', margin: '0 0 8px' }}>
          Billing information coming soon
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--gray-500)', margin: 0, maxWidth: '300px', marginInline: 'auto' }}>
          Usage tracking and billing management will be available here.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Team Section
// ============================================================================

function TeamSection() {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '32px' }}>
        Team Members
      </h2>

      <div style={{
        padding: '40px',
        background: 'var(--gray-50)',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
        textAlign: 'center'
      }}>
        <Users size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', margin: '0 0 8px' }}>
          Team management coming soon
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--gray-500)', margin: 0, maxWidth: '300px', marginInline: 'auto' }}>
          Invite team members and manage roles here.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Form Field Component
// ============================================================================

interface FormFieldProps {
  label: string
  value: string
  placeholder?: string
  disabled?: boolean
}

function FormField({ label, value, placeholder, disabled }: FormFieldProps) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--gray-600)',
        marginBottom: '6px'
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={disabled}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: '1px solid var(--gray-200)',
          borderRadius: '8px',
          fontSize: '14px',
          background: disabled ? 'var(--gray-50)' : 'white',
          color: disabled ? 'var(--gray-600)' : 'var(--gray-900)',
          outline: 'none'
        }}
      />
    </div>
  )
}
