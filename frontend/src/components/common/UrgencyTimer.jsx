import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

const UrgencyTimer = ({ pickupAvailableUntil }) => {
  if (!pickupAvailableUntil) return null;

  const diffMs = new Date(pickupAvailableUntil).getTime() - Date.now();
  const isExpired = diffMs <= 0;
  const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (isExpired) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: 'var(--color-danger-subtle)',
        color: 'var(--color-danger)'
      }}>
        <AlertTriangle size={12} />
        <span>Window Expired</span>
      </span>
    );
  }

  const isUrgent = totalMinutes <= 180; // Less than 3 hours

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.2rem 0.55rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: isUrgent ? 'var(--color-warning-subtle)' : 'var(--color-bg-subtle)',
      color: isUrgent ? '#A06800' : 'var(--color-text-muted)',
      border: isUrgent ? '1px solid rgba(231, 165, 43, 0.35)' : '1px solid var(--color-border)'
    }}>
      <Clock size={12} />
      <span>{hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`}</span>
    </span>
  );
};

export default UrgencyTimer;

