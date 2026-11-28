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
      padding: '48px 24px',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px dashed var(--color-border-strong)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      margin: '24px 0'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-bg-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-ink)',
        marginBottom: '4px'
      }}>
        <Icon size={22} strokeWidth={1.65} />
      </div>
      <h3 style={{ fontSize: '18px', marginBottom: 0 }}>{title}</h3>
      <p style={{ maxWidth: '420px', fontSize: '14px', margin: 0 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-outline"
          style={{ marginTop: '12px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

