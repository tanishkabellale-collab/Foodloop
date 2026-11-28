import React from 'react';
import { CheckCircle2, Clock, AlertCircle, PackageCheck, HelpCircle } from 'lucide-react';

const StatusBadge = ({ status = 'available', size = 'normal' }) => {
  const normStatus = (status || 'available').toLowerCase();

  const config = {
    available: {
      label: 'Available',
      className: 'status-badge-available',
      icon: <CheckCircle2 size={12} strokeWidth={1.75} />,
    },
    submitted: {
      label: 'Submitted',
      className: 'status-badge-submitted',
      icon: <Clock size={12} strokeWidth={1.75} />,
    },
    accepted: {
      label: 'Claimed',
      className: 'status-badge-accepted',
      icon: <PackageCheck size={12} strokeWidth={1.75} />,
    },
    collected: {
      label: 'Collected',
      className: 'status-badge-collected',
      icon: <CheckCircle2 size={12} strokeWidth={1.75} />,
    },
    under_review: {
      label: 'Under review',
      className: 'status-badge-submitted',
      icon: <Clock size={12} strokeWidth={1.75} />,
    },
    rejected: {
      label: 'Declined',
      className: 'status-badge-neutral',
      icon: <AlertCircle size={12} strokeWidth={1.75} />,
    },
    cancelled: {
      label: 'Cancelled',
      className: 'status-badge-neutral',
      icon: <AlertCircle size={12} strokeWidth={1.75} />,
    },
  };

  const current = config[normStatus] || {
    label: normStatus,
    className: 'status-badge-neutral',
    icon: <HelpCircle size={12} strokeWidth={1.75} />,
  };

  return (
    <span
      className={`status-badge ${current.className}`}
      style={size === 'small' ? { fontSize: '11px', padding: '2px 8px' } : undefined}
    >
      {current.icon}
      <span>{current.label}</span>
    </span>
  );
};

export default StatusBadge;
