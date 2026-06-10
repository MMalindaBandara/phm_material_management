import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, Edit, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RejectedEntries({ token, user, activeStore }) {
  const [inflows, setInflows] = useState([]);
  const [outflows, setOutflows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [externalStores, setExternalStores] = useState([]);
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [editingTx, setEditingTx] = useState(null); // { tx, type: 'inflow' | 'outflow' }
  const [editMaterialId, setEditMaterialId] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editReferenceNumber, setEditReferenceNumber] = useState('');
  const [editJobId, setEditJobId] = useState('');
  const [editExtStoreId, setEditExtStoreId] = useState('');
  
  // Waybill / Outflow specific edit state
  const [editWaybillNumber, setEditWaybillNumber] = useState('');
  const [editWaybillDate, setEditWaybillDate] = useState('');
  const [editIssueOrderNumber, setEditIssueOrderNumber] = useState('');
  const [editIssueOrderDate, setEditIssueOrderDate] = useState('');
  const [editTempJobRef, setEditTempJobRef] = useState('');

  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('success');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const fetchRejectedAndLookups = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [txRes, matRes, jobsRes, extRes] = await Promise.all([
        fetch('/api/transactions/rejected', { headers }),
        fetch('/api/materials', { headers }),
        fetch('/api/jobs', { headers }),
        fetch('/api/external-stores', { headers })
      ]);

      const txData = await txRes.json();
      const matData = await matRes.json();
      const jobsData = await jobsRes.json();
      const extData = await extRes.json();

      if (txRes.ok) {
        setInflows(txData.inflows.filter(i => i.store_id === activeStore) || []);
        setOutflows(txData.outflows.filter(o => o.store_id === activeStore) || []);
      }
      if (matRes.ok) setMaterials(matData);
      if (jobsRes.ok) setJobs(jobsData.filter(j => j.approval_status === 'Approved' && j.job_status === 'Active'));
      if (extRes.ok) setExternalStores(extData.filter(ex => ex.approval_status === 'Approved' && ex.status === 'Active'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRejectedAndLookups();
  }, [token, activeStore]);

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to permanently delete this rejected ${type} entry?`)) return;
    setLoading(true);
    setAlertMsg('');
    try {
      const res = await fetch(`/api/transactions/rejected/${id}?type=${type}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      setAlertType('success');
      setAlertMsg('Entry successfully deleted.');
      fetchRejectedAndLookups();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
      setLoading(false);
    }
  };

  const openEditModal = (tx, type) => {
    setEditingTx({ tx, type });
    setModalError('');
    setEditMaterialId(tx.material_id);
    setEditQuantity(tx.quantity);
    setEditUnitPrice(tx.unit_price);
    setEditRemarks(tx.remarks || '');
    setEditReferenceNumber(tx.reference_number || '');
    setEditJobId(tx.job_id || '');
    setEditExtStoreId(tx.external_store_id || '');
    
    setEditWaybillNumber(tx.waybill_number || '');
    setEditWaybillDate(tx.waybill_date || '');
    setEditIssueOrderNumber(tx.issue_order_number || '');
    setEditIssueOrderDate(tx.issue_order_date || '');
    setEditTempJobRef(tx.temporary_job_reference || '');
  };

  const closeEditModal = () => {
    setEditingTx(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    if (!editMaterialId) return setModalError('Material is required');
    if (!editQuantity || parseFloat(editQuantity) <= 0) return setModalError('Valid quantity is required');

    const type = editingTx.type;
    const tx = editingTx.tx;

    const payload = {
      material_id: parseInt(editMaterialId),
      quantity: parseFloat(editQuantity),
      unit_price: parseFloat(editUnitPrice),
      remarks: editRemarks,
      reference_number: editReferenceNumber || null,
      job_id: editJobId ? parseInt(editJobId) : null,
      external_store_id: editExtStoreId ? parseInt(editExtStoreId) : null,
      waybill_number: editWaybillNumber || null,
      waybill_date: editWaybillDate || null,
      issue_order_number: editIssueOrderNumber || null,
      issue_order_date: editIssueOrderDate || null,
      temporary_job_reference: editTempJobRef || null
    };

    try {
      const res = await fetch(`/api/transactions/rejected/${tx.id}?type=${type}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Correction submission failed');

      setAlertType('success');
      setAlertMsg('Transaction successfully resubmitted for Approver validation!');
      closeEditModal();
      fetchRejectedAndLookups();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const renderEditFormFields = () => {
    if (!editingTx) return null;
    const { tx, type } = editingTx;
    const method = type === 'inflow' ? tx.inflow_method : tx.outflow_method;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Material Code & Name</label>
          <select className="form-select" value={editMaterialId} onChange={(e) => setEditMaterialId(e.target.value)}>
            <option value="">-- Choose Material --</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.code} [Grade: {m.grade_code}] - {m.name}</option>
            ))}
          </select>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input type="number" className="form-input" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Unit Price (LKR)</label>
            <input 
              type="number" 
              className="form-input" 
              value={editUnitPrice} 
              onChange={(e) => setEditUnitPrice(e.target.value)}
              readOnly={type === 'outflow'} 
              style={{ background: type === 'outflow' ? 'rgba(255,255,255,0.02)' : 'inherit' }}
            />
          </div>
        </div>

        {/* Conditional parameters */}
        {type === 'inflow' && method === 'Direct Purchase' && (
          <div className="form-group">
            <label className="form-label">Quotation / Reference #</label>
            <input type="text" className="form-input" value={editReferenceNumber} onChange={(e) => setEditReferenceNumber(e.target.value)} />
          </div>
        )}

        {((type === 'inflow' && method === 'Transfer') || (type === 'outflow' && method === 'Issue to external stores')) && (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">External Store</label>
              <select className="form-select" value={editExtStoreId} onChange={(e) => setEditExtStoreId(e.target.value)}>
                <option value="">-- Choose Store --</option>
                {externalStores.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Transfer Reference #</label>
              <input type="text" className="form-input" value={editReferenceNumber} onChange={(e) => setEditReferenceNumber(e.target.value)} />
            </div>
          </div>
        )}

        {((type === 'inflow' && method === 'Return') || (type === 'outflow' && (method === 'Issue by Issue Order' || method === 'Issue by Waybill for approved jobs'))) && (
          <div className="form-group">
            <label className="form-label">Construction Job</label>
            <select className="form-select" value={editJobId} onChange={(e) => setEditJobId(e.target.value)}>
              <option value="">-- Choose Job --</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.job_number} - {j.job_name}</option>
              ))}
            </select>
          </div>
        )}

        {type === 'outflow' && method === 'Issue by Issue Order' && (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Issue Order Number</label>
              <input type="text" className="form-input" value={editIssueOrderNumber} onChange={(e) => setEditIssueOrderNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Issue Order Date</label>
              <input type="date" className="form-input" value={editIssueOrderDate} onChange={(e) => setEditIssueOrderDate(e.target.value)} />
            </div>
          </div>
        )}

        {type === 'outflow' && method === 'Issue by Waybill before Issue Order is created' && (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Waybill Number</label>
              <input type="text" className="form-input" value={editWaybillNumber} onChange={(e) => setEditWaybillNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Waybill Date</label>
              <input type="date" className="form-input" value={editWaybillDate} onChange={(e) => setEditWaybillDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Temporary Job Reference</label>
              <input type="text" className="form-input" value={editTempJobRef} onChange={(e) => setEditTempJobRef(e.target.value)} />
            </div>
          </div>
        )}

        {type === 'outflow' && method === 'Issue by Waybill for approved jobs' && (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Waybill Number</label>
              <input type="text" className="form-input" value={editWaybillNumber} onChange={(e) => setEditWaybillNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Waybill Date</label>
              <input type="date" className="form-input" value={editWaybillDate} onChange={(e) => setEditWaybillDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Issue Order Number</label>
              <input type="text" className="form-input" value={editIssueOrderNumber} onChange={(e) => setEditIssueOrderNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Issue Order Date</label>
              <input type="date" className="form-input" value={editIssueOrderDate} onChange={(e) => setEditIssueOrderDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Remarks / Correction Details</label>
          <textarea className="form-textarea" rows="2" value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)}></textarea>
        </div>
      </div>
    );
  };

  const totalCount = inflows.length + outflows.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Rejected Entries Correction Panel</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Review, edit, or delete transactions rejected by the Approving Officer.</p>
      </div>

      {alertMsg && (
        <div className={`alert ${alertType === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alertType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alertMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Loading rejected entries...</div>
      ) : totalCount === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
          No rejected transactions found for correction.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Rejected Inflows list */}
          {inflows.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#f87171' }}>Rejected Inflows ({inflows.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inflows.map(tx => (
                  <div key={`inflow-${tx.id}`} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                      <div>
                        <span className="status-pill status-rejected" style={{ marginRight: '0.5rem' }}>INFLOW</span>
                        <strong>{tx.inflow_method}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                          Material: <code>{tx.material_code}</code> | Date: {tx.created_date}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }} onClick={() => openEditModal(tx, 'inflow')}>
                          <Edit size={12} /> Correct & Resubmit
                        </button>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }} onClick={() => handleDelete(tx.id, 'inflow')}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      Qty: <strong>{tx.quantity} {tx.uom}</strong> | Price: <strong>LKR {(tx.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> | Value: <strong>LKR {(tx.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                    {tx.reject_comment && (
                      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', color: '#fca5a5' }}>
                        <ShieldAlert size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                        <strong>Approver Comment:</strong> {tx.reject_comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected Outflows list */}
          {outflows.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#f87171' }}>Rejected Outflows ({outflows.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {outflows.map(tx => (
                  <div key={`outflow-${tx.id}`} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                      <div>
                        <span className="status-pill status-rejected" style={{ marginRight: '0.5rem' }}>OUTFLOW</span>
                        <strong>{tx.outflow_method}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                          Material: <code>{tx.material_code}</code> | Date: {tx.created_date}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }} onClick={() => openEditModal(tx, 'outflow')}>
                          <Edit size={12} /> Correct & Resubmit
                        </button>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }} onClick={() => handleDelete(tx.id, 'outflow')}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      Qty: <strong>{tx.quantity} {tx.uom}</strong>
                    </div>
                    {tx.reject_comment && (
                      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', color: '#fca5a5' }}>
                        <ShieldAlert size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                        <strong>Approver Comment:</strong> {tx.reject_comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Form Modal */}
      {editingTx && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Correct Rejected Transaction</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={closeEditModal} />
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {modalError && (
                  <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}
                {renderEditFormFields()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeEditModal} disabled={modalLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Resubmitting...' : 'Resubmit for Validation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
