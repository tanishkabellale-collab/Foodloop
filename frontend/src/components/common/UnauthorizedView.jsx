import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const UnauthorizedView = ({ userRole, requiredRoles = [], onBack }) => {
  return (
    <div className="card" style={{ maxWidth: '560px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem 2rem' }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-danger-subtle)',
        color: 'var(--color-danger)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1rem'
      }}>
        <ShieldAlert size={28} />
      </div>
      <h2 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>Access Restricted</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
        Your current role (<strong>{userRole || 'Unknown'}</strong>) does not have permission to access this section.
        {requiredRoles.length > 0 && (
          <> Required role: <strong>{requiredRoles.join(' or ')}</strong>.</>
        )}
      </p>
      <button type="button" className="btn btn-primary" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <ArrowLeft size={16} />
        <span>Return to Dashboard</span>
      </button>
    </div>
  );
};

export default UnauthorizedView;

