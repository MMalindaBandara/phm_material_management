import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckSquare, 
  FileText, 
  Clock, 
  LogOut, 
  User, 
  Lock, 
  Menu, 
  X, 
  Building,
  KeyRound,
  UserCheck,
  Briefcase,
  Bell,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ApprovalsPanel from './components/ApprovalsPanel';
import ReportsView from './components/ReportsView';
import ExcelImporter from './components/ExcelImporter';
import JobsManager from './components/JobsManager';
import InflowTracker from './components/InflowTracker';
import RejectedEntries from './components/RejectedEntries';
import logo from './logo.jpg';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [currentScreen, setCurrentScreen] = useState('Dashboard');
  const [activeStore, setActiveStore] = useState(1); // 1 = Habarana Store, 2 = Heyyanthuduwa Store
  const [stores, setStores] = useState([
    { id: 1, name: 'Habarana Store' },
    { id: 2, name: 'Heyyanthuduwa Store' }
  ]);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Auth Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('DECPHMD1');
  
  // Spec Mandated Registration Details (Section 2.3)
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [branch, setBranch] = useState('');
  const [unit, setUnit] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [token, user]);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      setUser(data.user);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, designation, branch, unit, contact_number: contactNumber,
          username, password, role 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      setAuthMessage(data.message);
      setIsRegistering(false);
      setName('');
      setDesignation('');
      setBranch('');
      setUnit('');
      setContactNumber('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setCurrentScreen('Dashboard');
    setShowNotifications(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPwSuccess(data.message);
      setOldPassword('');
      setNewPassword('');
      
      // Clear force password flag if any
      if (user && user.forcePasswordChange) {
        setUser({ ...user, forcePasswordChange: false });
      }

      setTimeout(() => {
        setShowPasswordModal(false);
        setPwSuccess('');
      }, 1500);
    } catch (err) {
      setPwError(err.message);
    }
  };

  const unreadCount = notifications.filter(n => n.read_status === 0).length;

  // Render Login/Register Screen
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: isRegistering ? '600px' : '450px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src={logo} alt="Logo" style={{ width: '120px', height: '120px', borderRadius: '16px', objectFit: 'cover', display: 'block', margin: '0 auto 0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
            <h2 className="brand-name" style={{ fontSize: '1.6rem', marginTop: '0.5rem' }}>PHM D1 Branch</h2>
            <div className="brand-subtitle">Material Management System</div>
          </div>

          <h3 className="auth-title">{isRegistering ? 'Account Registration' : 'Sign In'}</h3>
          <p className="auth-subtitle">
            {isRegistering ? 'Provide mandatory details to request access' : 'Enter credentials to manage transactions'}
          </p>

          {authError && <div className="alert alert-error">{authError}</div>}
          {authMessage && <div className="alert alert-success">{authMessage}</div>}

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            {isRegistering ? (
              /* Spec-Mandated Registration Details */
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Ruwan Silva" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input type="text" className="form-input" placeholder="e.g. Stores Clerk" value={designation} onChange={(e) => setDesignation(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input type="text" className="form-input" placeholder="e.g. Habarana" value={branch} onChange={(e) => setBranch(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit / Section</label>
                  <input type="text" className="form-input" placeholder="e.g. D1 Store Unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Contact Number</label>
                  <input type="text" className="form-input" placeholder="e.g. +94 77 123 4567" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} required />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <hr style={{ borderColor: 'var(--card-border)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Desired Username</label>
                  <input type="text" className="form-input" placeholder="e.g. ruwan_dec" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Role</label>
                  <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="DECPHMD1">DECPHMD1 - Data Entry Officer</option>
                    <option value="EEMMPHMD1">EEMMPHMD1 - Approving / Validating Officer</option>
                    <option value="General">General - Read-Only Viewer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input type="password" className="form-input" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </div>
            ) : (
              /* Normal Sign In */
              <>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input type="text" className="form-input" placeholder="decphmd1" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              {isRegistering ? 'Submit Registration Request' : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            {isRegistering ? (
              <>
                Already have an account?{' '}
                <span className="auth-footer-link" onClick={() => { setIsRegistering(false); setAuthError(''); }}>
                  Sign In
                </span>
              </>
            ) : (
              <>
                New user?{' '}
                <span className="auth-footer-link" onClick={() => { setIsRegistering(true); setAuthError(''); }}>
                  Request Registration
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Force Password Change on Initial Login (Section 3.1)
  if (user && user.forcePasswordChange) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🔒</span>
            <h3 className="auth-title" style={{ marginTop: '0.5rem' }}>First-Time Password Change</h3>
            <p className="auth-subtitle">For security purposes, you are required to change your initial password at first login.</p>
          </div>
          {pwError && <div className="alert alert-error">{pwError}</div>}
          {pwSuccess && <div className="alert alert-success">{pwSuccess}</div>}
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input" placeholder="e.g. test123" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" placeholder="At least 8 chars, 1 number, 1 capital" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Save New Password
            </button>
            <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleLogout}>
              Logout
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <img src={logo} alt="Logo" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }} />
          <div>
            <h1 className="brand-name">PHM D1 Branch</h1>
            <div className="brand-subtitle">Store Inventory & Approvals</div>
          </div>
        </div>

        {/* Global Store Selector (Section 4) */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Building size={18} className="text-secondary" />
          <select 
            className="form-select" 
            style={{ width: '220px', padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
            value={activeStore}
            onChange={(e) => setActiveStore(parseInt(e.target.value))}
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* User profile & Notifications widget */}
        <div className="user-profile-section" style={{ position: 'relative' }}>
          {/* Notifications bell */}
          <div 
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} className={unreadCount > 0 ? "text-secondary" : ""} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: 'var(--danger)', color: 'white', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {unreadCount}
              </span>
            )}
          </div>

          <div className={`user-badge ${user.role === 'EEMMPHMD1' ? 'role-approver' : ''}`}>
            <User size={14} />
            <span>{user.name}</span>
          </div>

          <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.825rem' }} onClick={() => setShowPasswordModal(true)}>
            <KeyRound size={14} />
            <span>Password</span>
          </button>

          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Logout
          </button>

          {/* Notifications Dropdown Panel (Section 16) */}
          {showNotifications && (
            <div className="glass-card" style={{ position: 'absolute', top: '50px', right: '0', width: '380px', maxHeight: '450px', overflowY: 'auto', zIndex: 1000, background: '#0f172a', border: '1px solid var(--card-border)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem' }}>Notifications ({unreadCount} unread)</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowNotifications(false)}>Close</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No recent notifications.</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{ background: n.read_status === 0 ? 'rgba(59,130,246,0.06)' : 'transparent', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.75rem', position: 'relative' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: n.read_status === 0 ? '#60a5fa' : 'white' }}>
                        {n.read_status === 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                        {n.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{n.message}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{n.created_date}</div>
                      {n.read_status === 0 && (
                        <button 
                          style={{ position: 'absolute', top: '6px', right: '6px', background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => handleMarkAsRead(n.id)}
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="main-content">
        {/* Navigation Sidebar */}
        <aside className="sidebar">
          <button className={`sidebar-nav-item ${currentScreen === 'Dashboard' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Dashboard'); setShowNotifications(false); }}>
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          {user.role === 'DECPHMD1' && (
            <button className={`sidebar-nav-item ${currentScreen === 'Inflow' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Inflow'); setShowNotifications(false); }}>
              <ArrowDownLeft size={18} />
              Material Inflow
            </button>
          )}

          <button className={`sidebar-nav-item ${currentScreen === 'InflowTracking' ? 'active' : ''}`} onClick={() => { setCurrentScreen('InflowTracking'); setShowNotifications(false); }}>
            <Clock size={18} />
            Inflow Receipts Tracking
          </button>

          {user.role === 'DECPHMD1' && (
            <button className={`sidebar-nav-item ${currentScreen === 'Outflow' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Outflow'); setShowNotifications(false); }}>
              <ArrowUpRight size={18} />
              Material Outflow
            </button>
          )}

          {user.role === 'EEMMPHMD1' && (
            <button className={`sidebar-nav-item ${currentScreen === 'Approvals' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Approvals'); setShowNotifications(false); }}>
              <CheckSquare size={18} />
              Approvals Panel
            </button>
          )}

          <button className={`sidebar-nav-item ${currentScreen === 'Reports' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Reports'); setShowNotifications(false); }}>
            <FileText size={18} />
            Inventory Balances
          </button>

          <button className={`sidebar-nav-item ${currentScreen === 'PendingWaybills' ? 'active' : ''}`} onClick={() => { setCurrentScreen('PendingWaybills'); setShowNotifications(false); }}>
            <Clock size={18} />
            Pending Waybills
          </button>

          <button className={`sidebar-nav-item ${currentScreen === 'Jobs' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Jobs'); setShowNotifications(false); }}>
            <Briefcase size={18} />
            Construction Jobs
          </button>

          {user.role === 'DECPHMD1' && (
            <>
              <button className={`sidebar-nav-item ${currentScreen === 'RejectedEntries' ? 'active' : ''}`} onClick={() => { setCurrentScreen('RejectedEntries'); setShowNotifications(false); }}>
                <AlertTriangle size={18} />
                Rejected Entries
              </button>
              <button className={`sidebar-nav-item ${currentScreen === 'Setup' ? 'active' : ''}`} onClick={() => { setCurrentScreen('Setup'); setShowNotifications(false); }}>
                <Building size={18} />
                Store Setup (Excel)
              </button>
            </>
          )}
        </aside>

        {/* Content Area */}
        <main className="content-pane">
          {currentScreen === 'Dashboard' && (
            <Dashboard token={token} user={user} activeStore={activeStore} setActiveScreen={setCurrentScreen} />
          )}
          {currentScreen === 'Inflow' && user.role === 'DECPHMD1' && (
            <TransactionForm type="INFLOW" token={token} user={user} activeStore={activeStore} />
          )}
          {currentScreen === 'InflowTracking' && (
            <InflowTracker token={token} user={user} activeStore={activeStore} />
          )}
          {currentScreen === 'Outflow' && user.role === 'DECPHMD1' && (
            <TransactionForm type="OUTFLOW" token={token} user={user} activeStore={activeStore} />
          )}
          {currentScreen === 'Approvals' && user.role === 'EEMMPHMD1' && (
            <ApprovalsPanel token={token} user={user} />
          )}
          {currentScreen === 'Reports' && (
            <ReportsView token={token} user={user} activeStore={activeStore} />
          )}
          {currentScreen === 'PendingWaybills' && (
            <ReportsView token={token} user={user} activeStore={activeStore} viewPendingOnly={true} />
          )}
          {currentScreen === 'Jobs' && (
            <JobsManager token={token} user={user} />
          )}
          {currentScreen === 'Setup' && user.role === 'DECPHMD1' && (
            <ExcelImporter token={token} activeStore={activeStore} />
          )}
          {currentScreen === 'RejectedEntries' && user.role === 'DECPHMD1' && (
            <RejectedEntries token={token} user={user} activeStore={activeStore} />
          )}
        </main>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowPasswordModal(false)} />
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                {pwError && <div className="alert alert-error">{pwError}</div>}
                {pwSuccess && <div className="alert alert-success">{pwSuccess}</div>}

                <div className="form-group">
                  <label className="form-label">Old Password</label>
                  <input type="password" className="form-input" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
