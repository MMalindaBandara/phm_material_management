import React, { useState, useEffect } from 'react';
import { Search, Edit2, AlertCircle, CheckCircle2, Package, RefreshCw, X, SlidersHorizontal, Filter } from 'lucide-react';

export default function InflowTracker({ token, user, activeStore }) {
  const [inflows, setInflows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [approvalFilter, setApprovalFilter] = useState('All');

  // Modal State
  const [selectedInflow, setSelectedInflow] = useState(null);
  const [receiptStatusInput, setReceiptStatusInput] = useState('Received');
  const [revisedQuantityInput, setRevisedQuantityInput] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('success');

  const activeStoreName = activeStore === 1 ? 'Habarana Store' : 'Heyyanthuduwa Store';

  const fetchInflows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/inflows?storeId=${activeStore}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setInflows(data);
      }
    } catch (err) {
      console.error('Failed to fetch inflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInflows();
    setAlertMsg('');
  }, [token, activeStore]);

  // Sync inputs when selected inflow changes
  useEffect(() => {
    if (selectedInflow) {
      setReceiptStatusInput(selectedInflow.receipt_status === 'Pending' ? 'Received' : selectedInflow.receipt_status);
      setRevisedQuantityInput(selectedInflow.quantity);
    } else {
      setReceiptStatusInput('Received');
      setRevisedQuantityInput('');
    }
  }, [selectedInflow]);

  // Handle Receipt Status Update submission
  const handleUpdateReceiptStatus = async (e) => {
    e.preventDefault();
    if (!selectedInflow) return;

    const revisedQty = parseFloat(revisedQuantityInput);
    if (isNaN(revisedQty) || revisedQty <= 0) {
      setAlertType('error');
      setAlertMsg('Please enter a valid quantity greater than zero.');
      return;
    }

    setActionLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch(`/api/transactions/inflow/${selectedInflow.id}/receipt-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receipt_status: receiptStatusInput,
          revised_quantity: revisedQty
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update receipt status');

      setAlertType('success');
      setAlertMsg(`Receipt status updated to ${receiptStatusInput} for Inflow ID #${selectedInflow.id}.`);
      setSelectedInflow(null);
      fetchInflows();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Process data with filters
  const getProcessedData = () => {
    let filtered = [...inflows];

    // Status Filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(item => item.receipt_status === statusFilter);
    }

    // Method Filter
    if (methodFilter !== 'All') {
      filtered = filtered.filter(item => item.inflow_method === methodFilter);
    }

    // Approval Filter
    if (approvalFilter !== 'All') {
      filtered = filtered.filter(item => item.approval_status === approvalFilter);
    }

    // Search Term Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.material_code.toLowerCase().includes(term) ||
        item.material_name.toLowerCase().includes(term) ||
        (item.reference_number && item.reference_number.toLowerCase().includes(term)) ||
        (item.remarks && item.remarks.toLowerCase().includes(term)) ||
        (item.external_store_name && item.external_store_name.toLowerCase().includes(term)) ||
        (item.job_number && item.job_number.toLowerCase().includes(term))
      );
    }

    return filtered;
  };

  const processedData = getProcessedData();

  // Summary Metrics calculations
  const metrics = inflows.reduce(
    (acc, cur) => {
      const qty = cur.quantity;
      const status = cur.receipt_status;
      if (!acc[status]) acc[status] = { count: 0, qty: 0 };
      acc[status].count += 1;
      acc[status].qty += qty;
      return acc;
    },
    {
      Pending: { count: 0, qty: 0 },
      Confirmed: { count: 0, qty: 0 },
      Received: { count: 0, qty: 0 },
      Rejected: { count: 0, qty: 0 }
    }
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Material Inflow Tracking Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Monitor and update status (Pending, Confirmed, Received, Rejected) of inflows at <strong>{activeStoreName}</strong>.
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchInflows} disabled={loading} style={{ gap: '0.5rem' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Reload Data
        </button>
      </div>

      {alertMsg && (
        <div className={`alert ${alertType === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alertType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Metric summary deck */}
      <div className="grid-2">
        <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.02)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Receipts</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '0.25rem', color: '#f59e0b' }}>{metrics.Pending.qty.toLocaleString()}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{metrics.Pending.count} transactions pending</span>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #60a5fa', background: 'rgba(96, 165, 250, 0.02)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirmed Receipts</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '0.25rem', color: '#60a5fa' }}>{metrics.Confirmed.qty.toLocaleString()}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{metrics.Confirmed.count} shipments confirmed</span>
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <SlidersHorizontal size={14} /> Custom Filters
        </h4>
        <div className="grid-4">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Receipt Status</label>
            <select className="form-select" style={{ padding: '0.4rem' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Received">Received</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Inflow Method</label>
            <select className="form-select" style={{ padding: '0.4rem' }} value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="All">All Methods</option>
              <option value="Direct Purchase">Direct Purchase</option>
              <option value="Transfer">Transfer from External Store</option>
              <option value="Return">Return from Job</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Approving Status</label>
            <select className="form-select" style={{ padding: '0.4rem' }} value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)}>
              <option value="All">All Approvals</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Keywords</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-input" 
                style={{ padding: '0.35rem 0.5rem 0.35rem 1.8rem', fontSize: '0.85rem' }} 
                placeholder="Search material, ref, job..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Fetching inflow database...</div>
        ) : processedData.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No inflows found matching selected filters.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Method</th>
                  <th>Material Code & Description</th>
                  <th>Source / Origin Details</th>
                  <th>Quantity</th>
                  <th>Total Value</th>
                  <th>Receipt Status</th>
                  <th>Approver Status</th>
                  {user.role === 'DECPHMD1' && <th style={{ width: '130px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {processedData.map((item) => {
                  let sourceStr = '';
                  if (item.inflow_method === 'Direct Purchase') {
                    sourceStr = `Supplier: ${item.remarks?.match(/Supplier: (.*?)\./)?.[1] || 'N/A'} (Quotation: ${item.reference_number || 'N/A'})`;
                  } else if (item.inflow_method === 'Transfer') {
                    sourceStr = `External Store: ${item.external_store_name || 'N/A'} (Ref: ${item.reference_number || 'N/A'})`;
                  } else if (item.inflow_method === 'Return') {
                    sourceStr = `Job: ${item.job_number || 'N/A'}`;
                  }

                  const canUpdate = user.role === 'DECPHMD1' && 
                                    item.approval_status === 'Approved' && 
                                    item.receipt_status !== 'Received' &&
                                    item.receipt_status !== 'Cancelled';

                  return (
                    <tr key={item.id}>
                      <td><code>#{item.id}</code></td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.inflow_method}</span>
                      </td>
                      <td>
                        <strong>{item.material_code}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.material_name} ({item.uom})</div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {sourceStr}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Date: {item.created_date}</div>
                      </td>
                      <td>
                        {item.revised_quantity !== null && item.revised_quantity !== item.quantity ? (
                          <>
                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '0.4rem', fontSize: '0.8rem' }}>{item.quantity}</span>
                            <strong style={{ color: '#10b981' }}>{item.revised_quantity}</strong>
                          </>
                        ) : (
                          <strong>{item.quantity}</strong>
                        )}
                      </td>
                      <td>LKR {(item.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`status-pill ${
                          item.receipt_status === 'Received' ? 'status-approved' :
                          item.receipt_status === 'Pending' ? 'status-pending' :
                          item.receipt_status === 'Confirmed' ? 'status-draft' : 'status-rejected'
                        }`}>
                          {item.receipt_status}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${
                          item.approval_status === 'Approved' ? 'status-approved' :
                          item.approval_status === 'Pending Approval' ? 'status-pending' : 'status-rejected'
                        }`}>
                          {item.approval_status}
                        </span>
                      </td>
                      {user.role === 'DECPHMD1' && (
                        <td>
                          {canUpdate ? (
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', gap: '0.2rem' }}
                              onClick={() => setSelectedInflow(item)}
                            >
                              <Edit2 size={11} />
                              Update Receipt
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.approval_status !== 'Approved' ? 'Awaiting Approval' : 'Completed'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Status update dialog */}
      {selectedInflow && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Update Physical Inflow Receipt</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setSelectedInflow(null)} />
            </div>
            <form onSubmit={handleUpdateReceiptStatus}>
              <div className="modal-body">
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--card-border)', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>Inflow ID: <strong>#{selectedInflow.id}</strong> | Method: <strong>{selectedInflow.inflow_method}</strong></div>
                  <div>Material: <strong>{selectedInflow.material_code} - {selectedInflow.material_name}</strong></div>
                  <div>Expected Quantity: <strong>{selectedInflow.quantity} {selectedInflow.uom}</strong></div>
                </div>

                <div className="form-group">
                  <label className="form-label">Receipt Status</label>
                  <select 
                    className="form-select"
                    value={receiptStatusInput}
                    onChange={(e) => setReceiptStatusInput(e.target.value)}
                    required
                  >
                    <option value="Confirmed">Confirmed (Shipment Verified but not received yet)</option>
                    <option value="Received">Received (Materials added to inventory stock)</option>
                    <option value="Rejected">Rejected (Shipment damaged / failed verification)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Actual Received / Revised Quantity</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    step="0.001"
                    placeholder="Enter quantity"
                    value={revisedQuantityInput}
                    onChange={(e) => setRevisedQuantityInput(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    * Changing this quantity will adjust the final total value and stock increment.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedInflow(null)} disabled={actionLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
