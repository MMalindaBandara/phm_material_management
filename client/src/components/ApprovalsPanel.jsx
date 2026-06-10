import React, { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, FileText, UserCheck, MessageSquare, Briefcase, Building, AlertTriangle, Clock } from 'lucide-react';

export default function ApprovalsPanel({ token, user }) {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions', 'users', 'waybills', 'masterData'
  
  // Data lists
  const [pendingTx, setPendingTx] = useState({ inflows: [], outflows: [] });
  const [pendingWaybills, setPendingWaybills] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [pendingExtStores, setPendingExtStores] = useState([]);

  // Form comments State
  const [comments, setComments] = useState({}); // txId -> text

  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('success');

  const fetchApprovalsData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [txRes, usersRes] = await Promise.all([
        fetch('/api/transactions/pending-approvals', { headers }),
        fetch('/api/auth/pending-users', { headers })
      ]);

      const txData = await txRes.json();
      const usersData = await usersRes.json();

      if (txRes.ok) {
        setPendingTx({ inflows: txData.inflows || [], outflows: txData.outflows || [] });
        setPendingWaybills(txData.waybills || []);
        setPendingJobs(txData.jobs || []);
        setPendingExtStores(txData.externalStores || []);
      }
      if (usersRes.ok) {
        setPendingUsers(usersData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovalsData();
  }, [token, activeTab]);

  const handleTxAction = async (txId, txType, action) => {
    setLoading(true);
    setAlertMsg('');
    const comment = comments[txId] || '';

    try {
      const res = await fetch('/api/transactions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: txId, transactionType: txType, action, comment })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setAlertType('success');
      setAlertMsg(`Transaction successfully ${action === 'Approve' ? 'Approved' : 'Rejected'}.`);
      
      const newComments = { ...comments };
      delete newComments[txId];
      setComments(newComments);

      fetchApprovalsData();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (targetUserId, action) => {
    setLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch('/api/auth/approve-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUserId, action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'User validation failed');

      setAlertType('success');
      setAlertMsg(`User registration request successfully ${action === 'Approve' ? 'Approved' : 'Rejected'}.`);
      fetchApprovalsData();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJobAction = async (jobId, action) => {
    setLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Job validation failed');

      setAlertType('success');
      setAlertMsg(`Job validation successfully ${action === 'Approve' ? 'Approved' : 'Rejected'}.`);
      fetchApprovalsData();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtStoreAction = async (storeId, action) => {
    setLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch(`/api/external-stores/${storeId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'External Store validation failed');

      setAlertType('success');
      setAlertMsg(`External Store validation successfully ${action === 'Approve' ? 'Approved' : 'Rejected'}.`);
      fetchApprovalsData();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalTxCount = pendingTx.inflows.length + pendingTx.outflows.length;
  const totalMasterCount = pendingJobs.length + pendingExtStores.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>EEMMPHMD1 Approvals Panel</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Validate and approve user registrations, material entries, jobs, external stores, and waybills.</p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', gap: '0.5rem', overflowX: 'auto' }}>
        <button 
          className={`sidebar-nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}
          onClick={() => { setActiveTab('transactions'); setAlertMsg(''); }}
        >
          <FileText size={16} />
          Inflows & Outflows ({totalTxCount})
        </button>

        <button 
          className={`sidebar-nav-item ${activeTab === 'waybills' ? 'active' : ''}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}
          onClick={() => { setActiveTab('waybills'); setAlertMsg(''); }}
        >
          <Clock size={16} />
          Waybill IO Linkages ({pendingWaybills.length})
        </button>

        <button 
          className={`sidebar-nav-item ${activeTab === 'users' ? 'active' : ''}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}
          onClick={() => { setActiveTab('users'); setAlertMsg(''); }}
        >
          <UserCheck size={16} />
          User Registrations ({pendingUsers.length})
        </button>

        <button 
          className={`sidebar-nav-item ${activeTab === 'masterData' ? 'active' : ''}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}
          onClick={() => { setActiveTab('masterData'); setAlertMsg(''); }}
        >
          <Briefcase size={16} />
          Jobs & External Stores ({totalMasterCount})
        </button>
      </div>

      {alertMsg && (
        <div className={`alert ${alertType === 'success' ? 'alert-success' : 'alert-error'}`}>
          <ShieldAlert size={18} />
          <span>{alertMsg}</span>
        </div>
      )}

      {/* TAB 1: INFLOWS & OUTFLOWS */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {totalTxCount === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
              No material receipts or issues pending approval.
            </div>
          ) : (
            <>
              {/* Inflows list */}
              {pendingTx.inflows.map(tx => (
                <div key={`inflow-${tx.id}`} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                    <div>
                      <span className="status-pill status-approved" style={{ marginRight: '0.5rem' }}>INFLOW</span>
                      <strong style={{ fontSize: '1.1rem' }}>{tx.inflow_method}</strong>
                      <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Store: {tx.store_name} | Submitter: <code>{tx.creator_name}</code>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{tx.created_date}</span>
                  </div>

                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Material Code</th>
                          <th>Material Name</th>
                          <th>UOM</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tx.is_batch ? (
                          tx.items.slice(0, 10).map((item, idx) => (
                            <tr key={idx}>
                              <td><code>{item.material_code}</code></td>
                              <td>{item.material_name}</td>
                              <td>{item.uom}</td>
                              <td>{item.quantity}</td>
                              <td>LKR {(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td><strong>LKR {(item.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td><code>{tx.material_code}</code></td>
                            <td>{tx.material_name}</td>
                            <td>{tx.uom}</td>
                            <td>{tx.quantity}</td>
                             <td>LKR {(tx.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                             <td><strong>LKR {(tx.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {tx.is_batch && tx.items.length > 10 && (
                      <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--card-border)' }}>
                        Showing first 10 items of {tx.items.length} total items in this batch.
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {tx.reference_number && <div>Reference: <strong>{tx.reference_number}</strong></div>}
                    {tx.remarks && <div style={{ marginTop: '0.25rem' }}>Remarks: <em>{tx.remarks}</em></div>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <MessageSquare size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                      <input type="text" className="form-input" style={{ paddingLeft: '32px' }} placeholder="Add an optional comment..." value={comments[tx.id] || ''} onChange={(e) => setComments({ ...comments, [tx.id]: e.target.value })} />
                    </div>
                    <button className="btn btn-secondary" onClick={() => handleTxAction(tx.id, 'INFLOW', 'Approve')}>Approve</button>
                    <button className="btn btn-danger" onClick={() => handleTxAction(tx.id, 'INFLOW', 'Reject')}>Reject</button>
                  </div>
                </div>
              ))}

              {/* Outflows list */}
              {pendingTx.outflows.map(tx => {
                const isCancellation = tx.approval_status === 'Pending Approval' && tx.remarks && tx.remarks.includes('Cancellation');
                const badgeStyle = isCancellation ? 'status-draft' : 'status-rejected';

                return (
                  <div key={`outflow-${tx.id}`} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                      <div>
                        <span className={`status-pill ${badgeStyle}`} style={{ marginRight: '0.5rem' }}>
                          {isCancellation ? 'CANCEL REQ' : 'OUTFLOW'}
                        </span>
                        <strong style={{ fontSize: '1.1rem' }}>{tx.outflow_method}</strong>
                        <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Store: {tx.store_name} | Submitter: <code>{tx.creator_name}</code>
                        </span>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{tx.created_date}</span>
                    </div>

                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Material Code</th>
                            <th>Material Name</th>
                            <th>UOM</th>
                            <th>Quantity Issued</th>
                            <th>Unit Price</th>
                           <th>Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><code>{tx.material_code}</code></td>
                            <td>{tx.material_name}</td>
                            <td>{tx.uom}</td>
                            <td>{tx.quantity}</td>
                             <td>LKR {(tx.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                             <td><strong>LKR {(tx.quantity * (tx.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {tx.waybill_number && <div>Waybill Number: <strong>{tx.waybill_number}</strong></div>}
                      {tx.issue_order_number && <div>Issue Order Number: <strong>{tx.issue_order_number}</strong></div>}
                      {tx.job_number && <div>Job Assignment: <strong>{tx.job_number}</strong></div>}
                      {tx.remarks && <div style={{ marginTop: '0.25rem' }}>Remarks/Details: <em>{tx.remarks}</em></div>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <MessageSquare size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                        <input type="text" className="form-input" style={{ paddingLeft: '32px' }} placeholder="Add an optional comment..." value={comments[tx.id] || ''} onChange={(e) => setComments({ ...comments, [tx.id]: e.target.value })} />
                      </div>
                      <button className="btn btn-secondary" onClick={() => handleTxAction(tx.id, isCancellation ? 'CANCELLATION' : 'OUTFLOW', 'Approve')}>
                        {isCancellation ? 'Approve Cancellation' : 'Approve'}
                      </button>
                      <button className="btn btn-danger" onClick={() => handleTxAction(tx.id, isCancellation ? 'CANCELLATION' : 'OUTFLOW', 'Reject')}>
                        {isCancellation ? 'Deny Cancellation' : 'Reject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* TAB 2: WAYBILL LINKAGES */}
      {activeTab === 'waybills' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {pendingWaybills.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
              No Waybill Issue Order updates pending validation.
            </div>
          ) : (
            pendingWaybills.map(wb => (
              <div key={`wb-${wb.id}`} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                  <div>
                    <span className="status-pill status-pending" style={{ marginRight: '0.5rem' }}>Waybill Linkage</span>
                    <strong style={{ fontSize: '1.1rem' }}>Waybill: {wb.waybill_number}</strong>
                    <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Store: {wb.store_name} | Updated by: <code>{wb.creator_name}</code>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Updated: {wb.update_submitted_date}</span>
                </div>

                <div className="grid-2" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <div>Waybill Date: <strong>{wb.waybill_date}</strong></div>
                  <div>Proposed Issue Order Number: <strong style={{ color: '#60a5fa' }}>{wb.issue_order_number}</strong></div>
                  <div>Proposed Issue Order Date: <strong>{wb.issue_order_date}</strong></div>
                  <div>Material Details: <strong>{wb.material_name} (Code: {wb.material_code}) x {wb.quantity}</strong></div>
                  {wb.remarks && <div style={{ gridColumn: 'span 2', marginTop: '0.25rem' }}>Remarks: <em>{wb.remarks}</em></div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => handleTxAction(wb.id, 'WAYBILL_UPDATE', 'Approve')}>Approve Linkage</button>
                  <button className="btn btn-danger" onClick={() => handleTxAction(wb.id, 'WAYBILL_UPDATE', 'Reject')}>Reject Linkage</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: USER REGISTRATIONS */}
      {activeTab === 'users' && (
        <div className="glass-card">
          {pendingUsers.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No pending user registration requests.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Role Designation</th>
                    <th>Branch & Unit</th>
                    <th>Contact Phone</th>
                    <th>Username</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td><code>{u.role}</code></td>
                      <td>{u.branch} - {u.unit}</td>
                      <td>{u.contact_number}</td>
                      <td><code>{u.username}</code></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleUserAction(u.id, 'Approve')}>Activate</button>
                          <button className="btn btn-danger" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleUserAction(u.id, 'Reject')}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: JOBS & EXTERNAL STORES */}
      {activeTab === 'masterData' && (
        <div className="grid-2">
          {/* Jobs validation */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
              <Briefcase size={16} />
              Pending Jobs ({pendingJobs.length})
            </h3>
            {pendingJobs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontSize: '0.9rem' }}>No pending jobs.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingJobs.map(job => (
                  <div key={job.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ fontWeight: '600' }}>Job Number: <code>{job.job_number}</code></div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Name: {job.job_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Person: {job.responsible_person || 'N/A'} | Cost Code: {job.cost_code || 'N/A'}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleJobAction(job.id, 'Approve')}>Approve</button>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleJobAction(job.id, 'Reject')}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External stores validation */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
              <Building size={16} />
              Pending External Stores ({pendingExtStores.length})
            </h3>
            {pendingExtStores.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontSize: '0.9rem' }}>No pending external stores.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingExtStores.map(ex => (
                  <div key={ex.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ fontWeight: '600' }}>Store Name: <strong>{ex.name}</strong></div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Cost Code: {ex.cost_code || 'N/A'}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleExtStoreAction(ex.id, 'Approve')}>Approve</button>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleExtStoreAction(ex.id, 'Reject')}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
