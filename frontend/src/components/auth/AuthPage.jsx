import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  ShieldCheck,
  Building2,
  Package,
  Truck,
  AlertCircle,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const DEMO_ACCOUNTS = [
  {
    role: 'DONOR',
    label: 'Kitchen donor',
    email: 'donor.demo@foodloop.local',
    password: 'DonorDemo!2026',
    desc: 'Register surplus batches and view AI image triage',
  },
  {
    role: 'NGO',
    label: 'Receiving NGO',
    email: 'ngo.demo@foodloop.local',
    password: 'NgoDemo!2026',
    desc: 'Match listings, claim surplus, and confirm handoffs',
  },
  {
    role: 'VOLUNTEER',
    label: 'Courier volunteer',
    email: 'volunteer.demo@foodloop.local',
    password: 'VolunteerDemo!2026',
    desc: 'Claim pickups and verify OTP chain of custody',
  },
  {
    role: 'ADMIN',
    label: 'Quality reviewer',
    email: 'admin.demo@foodloop.local',
    password: 'AdminDemo!2026',
    desc: 'Inspect flagged donations and oversee dispatches',
  },
];

const AuthPage = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'DONOR',
    organization: '',
    location_text: '',
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
      setError(err.response?.data?.error || 'Authentication failed. Check your credentials');
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
      setError(err.response?.data?.error || 'Demo sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-container">
        {/* Left Brand Panel (Black Anchor) */}
        <div className="auth-brand-panel">
          <div className="auth-logo-row">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M22 36C22 28.268 28.268 22 36 22C43.732 22 50 28.268 50 36C50 43.732 43.732 50 36 50C31.5 50 28 47.5 25 43" stroke="#EA5D1A" strokeWidth="6" strokeLinecap="round" />
              <path d="M42 28C42 35.732 35.732 42 28 42C20.268 42 14 35.732 14 28C14 20.268 20.268 14 28 14C32.5 14 36 16.5 39 21" stroke="#CBE5C8" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <span className="auth-brand-name">FoodLoop</span>
          </div>

          <h1 className="auth-brand-title">Surplus food rescue and dispatch for local kitchens</h1>
          <p className="auth-brand-desc">
            Role-based coordination connecting kitchen donors, verified NGOs, and volunteer couriers before pickup windows close.
          </p>

          <div className="auth-demo-box">
            <div className="auth-demo-header">
              <KeyRound size={14} strokeWidth={1.65} />
              <span>Local demo accounts</span>
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
                    <span>{demo.label}</span>
                    <span className="auth-role-pill">{demo.role}</span>
                  </div>
                  <span className="auth-demo-desc">{demo.desc}</span>
                  <span className="auth-demo-creds">{demo.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Form Panel (White on Cream Canvas) */}
        <div className="auth-form-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              <LogIn size={15} strokeWidth={1.65} />
              <span>Sign in</span>
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              <UserPlus size={15} strokeWidth={1.65} />
              <span>Create account</span>
            </button>
          </div>

          <h2 className="auth-form-heading">
            {mode === 'login' ? 'Sign in to workspace' : 'Create organization account'}
          </h2>
          <p className="auth-form-sub">
            {mode === 'login'
              ? 'Enter your email and password or select a local demo profile'
              : 'Register as a kitchen donor, receiving NGO, or courier volunteer'}
          </p>

          {error && (
            <div className="auth-error-alert">
              <AlertCircle size={16} strokeWidth={1.65} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Account role</label>
                  <div className="auth-role-grid auth-role-grid-3">
                    <button
                      type="button"
                      className={`auth-role-choice ${form.role === 'DONOR' ? 'active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, role: 'DONOR' }))}
                    >
                      <Package size={15} strokeWidth={1.65} />
                      <span>Donor</span>
                    </button>
                    <button
                      type="button"
                      className={`auth-role-choice ${form.role === 'NGO' ? 'active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, role: 'NGO' }))}
                    >
                      <Building2 size={15} strokeWidth={1.65} />
                      <span>NGO</span>
                    </button>
                    <button
                      type="button"
                      className={`auth-role-choice ${form.role === 'VOLUNTEER' ? 'active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, role: 'VOLUNTEER' }))}
                    >
                      <Truck size={15} strokeWidth={1.65} />
                      <span>Volunteer</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Priya Sharma"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {form.role === 'VOLUNTEER' ? 'Vehicle or fleet note' : 'Organization or kitchen'}
                  </label>
                  <input
                    type="text"
                    name="organization"
                    value={form.organization}
                    onChange={handleChange}
                    className="form-input"
                    placeholder={form.role === 'VOLUNTEER' ? 'Two-wheeler courier' : 'Campus Canteen or Hope Shelter'}
                  />
                </div>

                {form.role === 'NGO' && (
                  <div className="form-group">
                    <label className="form-label">Service city or locality</label>
                    <input
                      type="text"
                      name="location_text"
                      value={form.location_text}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Wakad, Pune"
                    />
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="form-input"
                placeholder="name@organization.org"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">
                Password {mode === 'register' && <span style={{ fontWeight: 400, color: 'var(--color-text-subtle)' }}>(min 8 characters)</span>}
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter password"
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ height: '42px' }}
            >
              {loading ? <Loader2 size={16} className="spin-icon" /> : <ShieldCheck size={16} strokeWidth={1.65} />}
              <span>{loading ? 'Signing in' : mode === 'login' ? 'Sign in' : 'Create account'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
