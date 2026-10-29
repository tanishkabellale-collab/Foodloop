import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = ({
  icon: Icon = PackageOpen,
  title = 'No items found',
  description = 'There are no active records matching this filter.',
  actionLabel,
  onAction
}) => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3.5rem 1.5rem',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1.5px dashed var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      margin: '1.5rem 0'
    }}>
      <div style={{
        width: '54px',
        height: '54px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-bg-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-primary)',
        marginBottom: '0.25rem'
      }}>
        <Icon size={26} />
      </div>
      <h3 style={{ fontSize: '1.2rem', marginBottom: 0 }}>{title}</h3>
      <p style={{ maxWidth: '420px', fontSize: '0.925rem', margin: 0 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction} 
          className="btn btn-outline"
          style={{ marginTop: '0.75rem' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

