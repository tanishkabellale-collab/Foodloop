import React from 'react';
import { CheckCircle2, Clock, AlertCircle, PackageCheck, HelpCircle } from 'lucide-react';

const StatusBadge = ({ status = 'available', size = 'normal' }) => {
  const normStatus = (status || 'available').toLowerCase();

  const config = {
    available: {
      label: 'Available',
      className: 'status-badge-available',
      icon: <CheckCircle2 size={12} />
    },
    submitted: {
      label: 'Submitted',
      className: 'status-badge-submitted',
      icon: <Clock size={12} />
    },
    accepted: {
      label: 'Claimed / Accepted',
      className: 'status-badge-accepted',
      icon: <PackageCheck size={12} />
    },
    collected: {
      label: 'Collected',
      className: 'status-badge-collected',
      icon: <CheckCircle2 size={12} />
    },
    under_review: {
      label: 'Under Review',
      className: 'status-badge-submitted',
      icon: <Clock size={12} />
    },
    rejected: {
      label: 'Declined',
      className: 'status-badge-neutral',
      icon: <AlertCircle size={12} />
    },
    cancelled: {
      label: 'Cancelled',
      className: 'status-badge-neutral',
      icon: <AlertCircle size={12} />
    }
  };

  const current = config[normStatus] || {
    label: normStatus,
    className: 'status-badge-neutral',
    icon: <HelpCircle size={12} />
  };

  return (
    <span className={`status-badge ${current.className}`} style={size === 'small' ? { fontSize: '0.7rem', padding: '0.15rem 0.5rem' } : {}}>
      {current.icon}
      <span>{current.label}</span>
    </span>
  );
};

export default StatusBadge;

