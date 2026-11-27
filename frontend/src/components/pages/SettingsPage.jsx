import React from 'react';
import { Settings, User, Bell, Database, Shield, Info, ExternalLink } from 'lucide-react';

const SettingsSection = ({ icon: Icon, title, children }) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <Icon size={18} />
      <h3>{title}</h3>
    </div>
    <div className="settings-section-body">{children}</div>
  </div>
);

const SettingsRow = ({ label, value, muted }) => (
  <div className="settings-row">
    <span className="settings-row-label">{label}</span>
    <span className={`settings-row-value ${muted ? 'muted' : ''}`}>{value}</span>
  </div>
);

const SettingsPage = () => (
  <div className="settings-page">
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      <SettingsSection icon={User} title="Profile">
        <SettingsRow label="Display Name" value="Demo User" />
        <SettingsRow label="Role" value="Platform Admin" />
        <SettingsRow label="Email" value="demo@foodloop.local" muted />
        <div className="settings-note">
          Authentication and user accounts are planned for a future milestone. This is a demo profile.
        </div>
      </SettingsSection>

      <SettingsSection icon={Bell} title="Notifications">
        <SettingsRow label="Email Alerts" value="Not configured" muted />
        <SettingsRow label="Urgent Pickup Alerts" value="Not configured" muted />
        <SettingsRow label="New Donation Alerts" value="Not configured" muted />
        <div className="settings-note">
          Notification preferences will be configurable once user authentication is implemented.
        </div>
      </SettingsSection>

      <SettingsSection icon={Database} title="Data & Storage">
        <SettingsRow label="Storage Backend" value="Local JSON file (data.json)" />
        <SettingsRow label="Image Storage" value="Local filesystem (backend/uploads/)" />
        <SettingsRow label="AI Model" value="ResNet-18 ONNX (resnet18_foodloop.onnx — 42.6 MB)" />
        <div className="settings-note">
          Migration to a production ACID-compliant database (SQLite or PostgreSQL) is planned for a future infrastructure task.
        </div>
      </SettingsSection>

      <SettingsSection icon={Shield} title="Security">
        <SettingsRow label="Authentication" value="None (development mode)" muted />
        <SettingsRow label="CORS Policy" value="Wildcard (*) — development only" muted />
        <SettingsRow label="Rate Limiting" value="Not configured" muted />
        <div className="settings-note">
          JWT/session-based authentication, role-based access control, and rate limiting are planned for production deployment.
        </div>
      </SettingsSection>

      <SettingsSection icon={Info} title="About FoodLoop">
        <SettingsRow label="Version" value="1.0.0 — Donation Intake V1.0" />
        <SettingsRow label="Frontend" value="React 19.2 + Vite 8.0" />
        <SettingsRow label="Backend" value="Node.js + Express 5.2" />
        <SettingsRow label="AI Engine" value="ONNX Runtime (ResNet-18, fresh produce triage)" />
        <SettingsRow label="License" value="ISC" />
      </SettingsSection>
    </div>
  </div>
);

export default SettingsPage;

