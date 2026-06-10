import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Wrench, 
  ClipboardCheck, 
  AlertTriangle, 
  ArrowRight, 
  Plus, 
  Database,
  DollarSign
} from 'lucide-react';

export default function Dashboard({ token, user, activeStore, setActiveScreen }) {
  const [stats, setStats] = useState({
    totalMaterials: 0,
    activeJobs: 0,
    pendingApprovals: 0,
    pendingWaybillIssueOrders: 0,
    storeBalances: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [token, activeStore]);

  // Find active store values
  const currentStoreName = activeStore === 1 ? 'Habarana Store' : 'Heyyanthuduwa Store';
  const currentStoreBal = stats.storeBalances.find(b => b.store_name === currentStoreName) || { total_qty: 0, total_value: 0 };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard analytics...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Welcome back, {user.username}!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Here is a summary of PHM D1 Branch operations for <strong>{currentStoreName}</strong>.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid-4">
        <div className="glass-card metric-card">
          <div className="metric-info">
            <span className="metric-title">Material Types</span>
            <span className="metric-value">{stats.totalMaterials}</span>
          </div>
          <div className="metric-icon-wrapper">
            <Boxes size={22} />
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-info">
            <span className="metric-title">Active Jobs</span>
            <span className="metric-value">{stats.activeJobs}</span>
          </div>
          <div className="metric-icon-wrapper">
            <Wrench size={22} />
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-info">
            <span className="metric-title">Pending Approvals</span>
            <span className="metric-value">{stats.pendingApprovals}</span>
          </div>
          <div className={`metric-icon-wrapper ${stats.pendingApprovals > 0 ? 'icon-warning' : 'icon-success'}`}>
            <ClipboardCheck size={22} />
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-info">
            <span className="metric-title">Pending Waybills</span>
            <span className="metric-value">{stats.pendingWaybillIssueOrders}</span>
          </div>
          <div className={`metric-icon-wrapper ${stats.pendingWaybillIssueOrders > 0 ? 'icon-warning' : ''}`}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid-2">
        {/* Store Balances card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} className="text-secondary" />
            <span>Store Inventory Overview</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Store Name</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'white' }}>{currentStoreName}</div>
            </div>

            <div className="grid-2">
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Qty (UOM)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#60a5fa' }}>
                  {(currentStoreBal.total_qty || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Stock Value</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#34d399' }}>
                  LKR {(currentStoreBal.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Quick Actions</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {user.role === 'DECPHMD1' && (
              <>
                <button className="btn btn-primary" style={{ justifyContent: 'space-between' }} onClick={() => setActiveScreen('Inflow')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={16} />
                    Record Material Inflow
                  </span>
                  <ArrowRight size={16} />
                </button>

                <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => setActiveScreen('Outflow')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={16} />
                    Record Material Outflow
                  </span>
                  <ArrowRight size={16} />
                </button>

                <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => setActiveScreen('Setup')}>
                  <span>Upload & Initialize Inventory Excel</span>
                  <ArrowRight size={16} />
                </button>

                <button className="btn btn-outline" style={{ justifyContent: 'space-between', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={() => setActiveScreen('RejectedEntries')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    Correct Rejected Entries
                  </span>
                  <ArrowRight size={16} />
                </button>
              </>
            )}

            {user.role === 'EEMMPHMD1' && (
              <>
                <button className="btn btn-secondary" style={{ justifyContent: 'space-between' }} onClick={() => setActiveScreen('Approvals')}>
                  <span>Review Pending Transaction Approvals</span>
                  <ArrowRight size={16} />
                </button>
              </>
            )}

            <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => setActiveScreen('Reports')}>
              <span>View Inventory Balance Sheet</span>
              <ArrowRight size={16} />
            </button>

            <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => setActiveScreen('PendingWaybills')}>
              <span>Track Waybills (Pending Issue Orders)</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
