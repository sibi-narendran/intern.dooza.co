/**
 * WorkspaceCalendar
 * 
 * Calendar view for workspace tasks using FullCalendar.
 * Shows tasks by due date with status-based coloring.
 */

import { useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Task, STATUS_CONFIG, getTaskConfigWithFallback } from '../../registry';

interface WorkspaceCalendarProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick?: (date: Date) => void;
  isLoading?: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    task: Task;
    status: string;
    taskType: string;
  };
}

export default function WorkspaceCalendar({
  tasks,
  onTaskClick,
  onDateClick,
  isLoading = false,
}: WorkspaceCalendarProps) {
  const [currentView, setCurrentView] = useState<'dayGridMonth' | 'timeGridWeek'>('dayGridMonth');
  
  // Convert tasks to FullCalendar events
  const events: CalendarEvent[] = tasks.map(task => {
    const statusConfig = STATUS_CONFIG[task.status];
    const taskConfig = getTaskConfigWithFallback(task.agent_slug, task.task_type);
    
    return {
      id: task.id,
      title: task.title,
      start: task.due_date || task.created_at,
      backgroundColor: statusConfig?.bgColor || '#f3f4f6',
      borderColor: statusConfig?.color || '#6b7280',
      textColor: statusConfig?.color || '#6b7280',
      extendedProps: {
        task,
        status: task.status,
        taskType: task.task_type,
      },
    };
  });
  
  // Handle event click
  const handleEventClick = useCallback((info: { event: { extendedProps: { task: Task } } }) => {
    onTaskClick(info.event.extendedProps.task);
  }, [onTaskClick]);
  
  // Handle date click
  const handleDateClick = useCallback((info: { date: Date }) => {
    if (onDateClick) {
      onDateClick(info.date);
    }
  }, [onDateClick]);
  
  // Custom event content renderer
  const renderEventContent = (eventInfo: { 
    event: { 
      title: string; 
      extendedProps: { task: Task; status: string } 
    } 
  }) => {
    const { task, status } = eventInfo.event.extendedProps;
    const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    const taskConfig = getTaskConfigWithFallback(task.agent_slug, task.task_type);
    
    return (
      <div
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: taskConfig.color,
              flexShrink: 0,
            }}
          />
          <span style={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {eventInfo.event.title}
          </span>
        </div>
        <div style={{
          fontSize: '10px',
          opacity: 0.8,
          marginTop: '2px',
        }}>
          {statusConfig?.label}
        </div>
      </div>
    );
  };
  
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}>
          <div style={{ color: 'var(--gray-500)' }}>Loading tasks...</div>
        </div>
      )}
      
      {/* Calendar */}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={currentView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek',
        }}
        events={events}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        eventContent={renderEventContent}
        height="100%"
        dayMaxEvents={3}
        nowIndicator
        selectable
        eventDisplay="block"
        viewDidMount={(view) => {
          setCurrentView(view.view.type as 'dayGridMonth' | 'timeGridWeek');
        }}
      />
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        fontSize: '11px',
      }}>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div
            key={status}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: config.bgColor,
                border: `1px solid ${config.color}`,
              }}
            />
            <span style={{ color: 'var(--gray-600)' }}>{config.label}</span>
          </div>
        ))}
      </div>
      
      {/* Styles for FullCalendar customization */}
      <style>{`
        .fc {
          font-family: inherit;
        }
        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .fc .fc-button {
          background: white;
          border: 1px solid var(--gray-300);
          color: var(--gray-700);
          font-size: 13px;
          padding: 6px 12px;
        }
        .fc .fc-button:hover {
          background: var(--gray-50);
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background: var(--primary-600);
          border-color: var(--primary-600);
          color: white;
        }
        .fc .fc-daygrid-day:hover {
          background: var(--gray-50);
        }
        .fc .fc-daygrid-day-number {
          font-size: 13px;
          padding: 8px;
        }
        .fc .fc-event {
          cursor: pointer;
          border-radius: 4px;
          transition: transform 0.1s ease;
        }
        .fc .fc-event:hover {
          transform: scale(1.02);
        }
        .fc .fc-daygrid-more-link {
          font-size: 11px;
          font-weight: 500;
          color: var(--primary-600);
        }
      `}</style>
    </div>
  );
}
