import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Flag,
  RefreshCw,
} from 'lucide-react';

import { API_URL } from '../../config';

const AdminReviewPage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('flagged'); // 'flagged' | 'all'
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadOverview = useCallback(async () => {
    const res = await axios.get(`${API_URL}/admin/overview`);
    return res.data;
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadOverview();
      setOverview(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin review queue.');
    } finally {
      setLoading(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    loadOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Failed to load admin review queue.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadOverview]);

  const handleReviewDecision = async (donationId, decision) => {
    setActionLoadingId(donationId);
    try {
      await axios.patch(`${API_URL}/admin/donations/${donationId}/review`, {
        review_status: decision,
        review_note: `Marked ${decision} via Admin Review Dashboard`,
      });
      await fetchOverview();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save review decision.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && !overview) {
    return (
      <div className="matches-loading">
        <RefreshCw size={24} className="spin-icon" />
        <p>Loading Admin Review Queue...</p>
      </div>
    );
  }

  const stats = overview?.stats || {};
  const list =
    filter === 'flagged'
      ? overview?.flagged_donations || []
      : overview?.all_donations || [];

  return (
    <div className="matches-page page-enter">
      <div className="matches-header-card">
        <div className="matches-header-top">
          <div>
            <div className="matches-badge">
              <ShieldCheck size={14} strokeWidth={1.65} />
              <span>Admin oversight queue</span>
            </div>
            <h2 className="matches-title">Admin review</h2>
            <p className="matches-subtitle">
              Inspect flagged or AI-recommended listings, verify cutoff deadlines, and record auditable human review decisions.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={fetchOverview} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh queue</span>
          </button>
        </div>

        <div className="admin-stats-row">
          <div className="admin-stat-box">
            <span>Total listings</span>
            <strong className="tabular-nums">{stats.total_donations ?? 0}</strong>
          </div>
          <div className="admin-stat-box">
            <span>Flagged / needs review</span>
            <strong className="tabular-nums" style={{ color: 'var(--color-accent-ink)' }}>{stats.flagged_count ?? 0}</strong>
          </div>
          <div className="admin-stat-box">
            <span>Reviewed</span>
            <strong className="tabular-nums" style={{ color: 'var(--color-pastel-green-ink)' }}>{stats.reviewed_count ?? 0}</strong>
          </div>
          <div className="admin-stat-box">
            <span>Pending review</span>
            <strong className="tabular-nums">{stats.pending_review_count ?? 0}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="matches-alert-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="matches-toolbar">
        <div className="matches-toolbar-controls">
          <button
            type="button"
            className={`btn btn-sm ${filter === 'flagged' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('flagged')}
          >
            Flagged / Human Review ({overview?.flagged_donations?.length || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All Donations ({overview?.all_donations?.length || 0})
          </button>
        </div>
      </div>

      <div className="matches-grid">
        {list.map((d) => (
          <div key={d.id} className="ngo-match-card">
            <div className="ngo-match-top">
              <div>
                <div className="ngo-name-row">
                  <h3 className="ngo-name">{d.title || d.foodName}</h3>
                  <span className="demo-profile-tag" style={{ textTransform: 'capitalize' }}>
                    Status: {d.status}
                  </span>
                  {d.review_status && (
                    <span className="assigned-ngo-tag" style={{ textTransform: 'capitalize' }}>
                      Review: {d.review_status}
                    </span>
                  )}
                </div>
                <p className="ngo-meta">
                  {d.quantityText} • {d.address_text || d.location}
                  {d.reviewed_by ? ` • Reviewed by ${d.reviewed_by}` : ''}
                </p>
              </div>

              <div className="admin-action-btns">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={actionLoadingId === d.id}
                  onClick={() => handleReviewDecision(d.id, 'approved')}
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={actionLoadingId === d.id}
                  onClick={() => handleReviewDecision(d.id, 'flagged')}
                >
                  <Flag size={14} /> Flag
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={actionLoadingId === d.id}
                  onClick={() => handleReviewDecision(d.id, 'rejected')}
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminReviewPage;
