import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const UnauthorizedView = ({ userRole, requiredRoles = [], onBack }) => {
  return (
    <div className="card page-enter" style={{ maxWidth: '520px', margin: '48px auto', textAlign: 'center', padding: '32px 24px' }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-danger-subtle)',
        color: 'var(--color-danger)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px'
      }}>
        <ShieldAlert size={22} strokeWidth={1.65} />
      </div>
      <h2 style={{ color: 'var(--color-ink)', marginBottom: '8px' }}>Access restricted</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '20px' }}>
        Your current role (<strong style={{ fontWeight: 600 }}>{userRole || 'Unknown'}</strong>) does not have permission to open this section.
        {requiredRoles.length > 0 && (
          <> Required role: <strong style={{ fontWeight: 600 }}>{requiredRoles.join(' or ')}</strong>.</>
        )}
      </p>
      <button type="button" className="btn btn-primary" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.65} />
        <span>Return to overview</span>
      </button>
    </div>
  );
};

export default UnauthorizedView;

