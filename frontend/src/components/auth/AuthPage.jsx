import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  ShieldCheck,
  Building2,
  Package,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    role: 'DONOR',
    label: 'Donor Demo',
    email: 'donor.demo@foodloop.local',
    password: 'DonorDemo!2026',
    desc: 'Create & manage own donations, run AI assessment',
  },
  {
    role: 'NGO',
    label: 'NGO Demo',
    email: 'ngo.demo@foodloop.local',
    password: 'NgoDemo!2026',
    desc: 'Browse donations, view matches, accept & collect',
  },
  {
    role: 'ADMIN',
    label: 'Admin Demo',
    email: 'admin.demo@foodloop.local',
    password: 'AdminDemo!2026',
    desc: 'Full oversight, flagged review queue & analytics',
  },
];

const AuthPage = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'DONOR',
    organization: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demo) => {
    setError('');
    setLoading(true);
    try {
      await login(demo.email, demo.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Demo sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-container">
        {/* Left Brand Panel */}
        <div className="auth-brand-panel">
          <div className="auth-logo-row">
            <div className="sidebar-logo-icon">
              <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
                <path d="M22 36C22 28.268 28.268 22 36 22C43.732 22 50 28.268 50 36C50 43.732 43.732 50 36 50C31.5 50 28 47.5 25 43" stroke="#F47A20" strokeWidth="5" strokeLinecap="round" />
                <path d="M42 28C42 35.732 35.732 42 28 42C20.268 42 14 35.732 14 28C14 20.268 20.268 14 28 14C32.5 14 36 16.5 39 21" stroke="#A8D99C" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="auth-brand-name">FoodLoop</span>
          </div>

          <h1 className="auth-brand-title">Intelligent Food Rescue Coordination</h1>
          <p className="auth-brand-desc">
            Role-based access for food donors, verified NGOs, and quality oversight reviewers.
          </p>

          <div className="auth-demo-box">
            <div className="auth-demo-header">
              <Sparkles size={14} />
              <span>Local Demo Accounts (Presentation Only)</span>
            </div>
            <div className="auth-demo-list">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  className="auth-demo-btn"
                  disabled={loading}
                  onClick={() => handleDemoLogin(demo)}
                >
                  <div className="auth-demo-btn-top">
                    <strong>{demo.label}</strong>
                    <span className="auth-role-pill">{demo.role}</span>
                  </div>
                  <span className="auth-demo-desc">{demo.desc}</span>
                  <span className="auth-demo-creds">{demo.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              <UserPlus size={16} />
              <span>Create Account</span>
            </button>
          </div>

          <h2 className="auth-form-heading">
            {mode === 'login' ? 'Welcome back' : 'Join FoodLoop'}
          </h2>
          <p className="auth-form-sub">
            {mode === 'login'
              ? 'Sign in with your account credentials or use a local demo profile.'
              : 'Register as a Food Donor or Receiving NGO.'}
          </p>

          {error && (
            <div className="auth-error-alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <>
                <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                  <label className="form-label">Account Role</label>
                  <div className="auth-role-grid">
                    <button
                      type="button"
                      className={`auth-role-choice ${form.role === 'DONOR' ? 'active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, role: 'DONOR' }))}
                    >
                      <Package size={16} />
                      <span>Food Donor</span>
                    </button>
                    <button
                      type="button"
                      className={`auth-role-choice ${form.role === 'NGO' ? 'active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, role: 'NGO' }))}
                    >
                      <Building2 size={16} />
                      <span>Receiving NGO</span>
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. Priya Sharma"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                  <label className="form-label">Organization / Kitchen Name</label>
                  <input
                    type="text"
                    name="organization"
                    value={form.organization}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. Campus Canteen or Hope Shelter"
                  />
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: '0.9rem' }}>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="form-input"
                placeholder="you@organization.org"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">
                Password * {mode === 'register' && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(min 8 chars)</span>}
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="form-input"
                placeholder="••••••••"
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              {loading ? <Loader2 size={18} className="spin-icon" /> : <ShieldCheck size={18} />}
              <span>{loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

