/**
 * TaskStatusBadge
 * 
 * Visual indicator for task lifecycle status.
 * Color-coded for quick scanning in calendar/dashboard.
 */

import { 
  FileEdit, 
  Clock, 
  CheckCircle, 
  Calendar, 
  Globe, 
  XCircle, 
  Ban,
  LucideIcon 
} from 'lucide-react';
import { TaskStatus, STATUS_CONFIG } from '../../registry';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  FileEdit,
  Clock,
  CheckCircle,
  Calendar,
  Globe,
  XCircle,
  Ban,
};

export default function TaskStatusBadge({ 
  status, 
  size = 'md',
  showLabel = true 
}: TaskStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  
  const Icon = ICONS[config.icon] || FileEdit;
  
  const sizeStyles = {
    sm: {
      padding: '2px 6px',
      fontSize: '11px',
      iconSize: 12,
      gap: '4px',
    },
    md: {
      padding: '4px 10px',
      fontSize: '12px',
      iconSize: 14,
      gap: '6px',
    },
    lg: {
      padding: '6px 14px',
      fontSize: '14px',
      iconSize: 16,
      gap: '8px',
    },
  };
  
  const styles = sizeStyles[size];
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: styles.gap,
        padding: styles.padding,
        borderRadius: '9999px',
        backgroundColor: config.bgColor,
        color: config.color,
        fontSize: styles.fontSize,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={styles.iconSize} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// Also export a simpler dot indicator for compact views
export function StatusDot({ status, size = 8 }: { status: TaskStatus; size?: number }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: config.color,
      }}
      title={config.label}
    />
  );
}
