import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

const UrgencyTimer = ({ pickupAvailableUntil }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!pickupAvailableUntil) return null;

  const diffMs = new Date(pickupAvailableUntil).getTime() - nowMs;
  const isExpired = diffMs <= 0;
  const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (isExpired) {
    return (
      <span
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: 'var(--color-danger-subtle)',
          color: 'var(--color-danger)',
        }}
      >
        <AlertTriangle size={12} strokeWidth={1.75} />
        <span>Window expired</span>
      </span>
    );
  }

  const isUrgent = totalMinutes <= 180;

  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: isUrgent ? 'var(--color-accent-subtle)' : 'var(--color-bg-base)',
        color: isUrgent ? 'var(--color-accent-ink)' : 'var(--color-text-muted)',
        border: isUrgent ? '1px solid rgba(234, 93, 26, 0.25)' : '1px solid var(--color-border)',
      }}
    >
      <Clock size={12} strokeWidth={1.75} />
      <span>{hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`}</span>
    </span>
  );
};

export default UrgencyTimer;
