import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Plus, Building, Briefcase } from 'lucide-react';

export default function TransactionForm({ type, token, user, activeStore }) {
  const [subtype, setSubtype] = useState(type === 'INFLOW' ? 'Direct Purchase' : 'Issue by Issue Order');
  
  // Core Fields
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalValue, setTotalValue] = useState(0);

  // Common Fields
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  // Conditional Fields
  // Inflow - Direct Purchase
  const [quotationNumber, setQuotationNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);

  // Inflow - Transfer & Outflow - External Stores
  const [selectedExtStoreId, setSelectedExtStoreId] = useState('');
  const [costCode, setCostCode] = useState('');

  // Return & Outflow Jobs
  const [selectedJobId, setSelectedJobId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [gradeCode, setGradeCode] = useState('NEW');

  // Outflow - Waybills
  const [waybillNumber, setWaybillNumber] = useState('');
  const [waybillDate, setWaybillDate] = useState(new Date().toISOString().split('T')[0]);
  const [personReceiving, setPersonReceiving] = useState('');
  const [temporaryJobReference, setTemporaryJobReference] = useState('');
  const [unit, setUnit] = useState('');

  // Outflow - Issue Order
  const [issueOrderNumber, setIssueOrderNumber] = useState('');
  const [issueOrderDate, setIssueOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Outflow - Disposal
  const [approvalRefNumber, setApprovalRefNumber] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('Sale');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);

  // Data lists
  const [materials, setMaterials] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [externalStores, setExternalStores] = useState([]);

  // Modals for inline creation
  const [showJobModal, setShowJobModal] = useState(false);
  const [newJobNumber, setNewJobNumber] = useState('');
  const [newJobName, setNewJobName] = useState('');
  const [newJobUnit, setNewJobUnit] = useState('');
  const [newJobCost, setNewJobCost] = useState('');
  const [newJobPerson, setNewJobPerson] = useState('');

  const [showExtStoreModal, setShowExtStoreModal] = useState(false);
  const [newExtStoreName, setNewExtStoreName] = useState('');
  const [newExtStoreCost, setNewExtStoreCost] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const storeName = activeStore === 1 ? 'Habarana Store' : 'Heyyanthuduwa Store';

  // Fetch Lookups
  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [matRes, jobsRes, extRes] = await Promise.all([
        fetch('/api/materials', { headers }),
        fetch('/api/jobs', { headers }),
        fetch('/api/external-stores', { headers })
      ]);
      const matData = await matRes.json();
      const jobsData = await jobsRes.json();
      const extData = await extRes.json();

      if (matRes.ok) setMaterials(matData);
      // Only show Approved Jobs and Stores for transactions (Section 6.2 & 7.3)
      if (jobsRes.ok) setJobs(jobsData.filter(j => j.approval_status === 'Approved' && j.job_status === 'Active'));
      if (extRes.ok) setExternalStores(extData.filter(ex => ex.approval_status === 'Approved' && ex.status === 'Active'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activeStore]);

  // Handle default subtype resets
  useEffect(() => {
    setSubtype(type === 'INFLOW' ? 'Direct Purchase' : 'Issue by Issue Order');
    setSelectedMaterialId('');
    setQuantity('');
    setUnitPrice('');
    setTotalValue(0);
    setReferenceNumber('');
    setRemarks('');
    setQuotationNumber('');
    setSupplierName('');
    setSelectedExtStoreId('');
    setCostCode('');
    setSelectedJobId('');
    setWaybillNumber('');
    setIssueOrderNumber('');
    setTemporaryJobReference('');
    setPersonReceiving('');
    setApprovalRefNumber('');
    setErrorMsg('');
    setSuccessMsg('');
  }, [type]);

  // Update unit price and total value when material is selected
  useEffect(() => {
    if (selectedMaterialId) {
      const mat = materials.find(m => m.id === parseInt(selectedMaterialId));
      if (mat) {
        setUnitPrice(mat.price);
        if (quantity) {
          setTotalValue(parseFloat(quantity) * mat.price);
        }
      }
    } else {
      setUnitPrice('');
      setTotalValue(0);
    }
  }, [selectedMaterialId, quantity, materials]);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!newJobNumber || !newJobName) return;
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          job_number: newJobNumber, 
          job_name: newJobName, 
          unit: newJobUnit, 
          cost_code: newJobCost, 
          responsible_person: newJobPerson 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(`Job ${newJobNumber} submitted for approval. Awaiting EEMMPHMD1 validation.`);
      setShowJobModal(false);
      setNewJobNumber('');
      setNewJobName('');
      setNewJobUnit('');
      setNewJobCost('');
      setNewJobPerson('');
      fetchData();
    } catch (err) {
      setErrorMsg('Failed to create Job: ' + err.message);
    }
  };

  const handleCreateExtStore = async (e) => {
    e.preventDefault();
    if (!newExtStoreName) return;
    try {
      const res = await fetch('/api/external-stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newExtStoreName, cost_code: newExtStoreCost })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(`External store ${newExtStoreName} submitted for approval. Awaiting EEMMPHMD1 validation.`);
      setShowExtStoreModal(false);
      setNewExtStoreName('');
      setNewExtStoreCost('');
      fetchData();
    } catch (err) {
      setErrorMsg('Failed to create External Store: ' + err.message);
    }
  };

  const handleSubmit = async (submitStatus) => { // 'Draft' or 'Pending Approval'
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedMaterialId) return setErrorMsg('Material Code is required.');
    if (!quantity || parseFloat(quantity) <= 0) return setErrorMsg('Please enter a valid quantity.');

    // Outflow specific validations
    if (type === 'OUTFLOW') {
      if (subtype === 'Issue by Issue Order' && !issueOrderNumber) {
        return setErrorMsg('Issue Order number is required.');
      }
      if (subtype.startsWith('Issue by Waybill') && !waybillNumber) {
        return setErrorMsg('Waybill number is required.');
      }
      if ((subtype === 'Issue by Issue Order' || subtype === 'Issue by Waybill for approved jobs') && !selectedJobId) {
        return setErrorMsg('An approved Job must be selected.');
      }
      if (subtype === 'Issue to external stores' && !selectedExtStoreId) {
        return setErrorMsg('An approved target External Store is required.');
      }
    } else {
      if (subtype === 'Transfer' && !selectedExtStoreId) {
        return setErrorMsg('Source External Store is required.');
      }
      if (subtype === 'Return' && !selectedJobId) {
        return setErrorMsg('Select the Job returning the materials.');
      }
    }

    setLoading(true);

    try {
      const endpoint = type === 'INFLOW' ? '/api/transactions/inflow' : '/api/transactions/outflow';
      
      const payload = {
        store_id: activeStore,
        material_id: parseInt(selectedMaterialId),
        quantity: parseFloat(quantity),
        unit_price: parseFloat(unitPrice),
        remarks,
        status: submitStatus
      };

      if (type === 'INFLOW') {
        payload.inflow_method = subtype;
        if (subtype === 'Direct Purchase') {
          payload.reference_number = quotationNumber;
          payload.remarks = `Supplier: ${supplierName}. Date: ${receivedDate}. ${remarks}`;
        } else if (subtype === 'Transfer') {
          payload.reference_number = referenceNumber;
          payload.external_store_id = parseInt(selectedExtStoreId);
          payload.remarks = `Cost Code: ${costCode}. ${remarks}`;
        } else if (subtype === 'Return') {
          payload.job_id = parseInt(selectedJobId);
          payload.remarks = `Grade: ${gradeCode}. Date: ${returnDate}. ${remarks}`;
        }
      } else {
        payload.outflow_method = subtype;
        payload.reference_number = referenceNumber;
        
        if (subtype === 'Disposal or sale') {
          payload.reference_number = approvalRefNumber;
          payload.remarks = `Method: ${disposalMethod}. Date: ${disposalDate}. ${remarks}`;
        } else if (subtype === 'Issue by Issue Order') {
          payload.issue_order_number = issueOrderNumber;
          payload.issue_order_date = issueOrderDate;
          payload.job_id = parseInt(selectedJobId);
        } else if (subtype === 'Issue by Waybill before Issue Order is created') {
          payload.waybill_number = waybillNumber;
          payload.waybill_date = waybillDate;
          payload.temporary_job_reference = temporaryJobReference;
          payload.remarks = `Receiver: ${personReceiving}. Unit: ${unit}. Cost Code: ${costCode}. ${remarks}`;
        } else if (subtype === 'Issue by Waybill for approved jobs') {
          payload.waybill_number = waybillNumber;
          payload.waybill_date = waybillDate;
          payload.job_id = parseInt(selectedJobId);
          payload.remarks = `Receiver: ${personReceiving}. ${remarks}`;
        } else if (subtype === 'Issue to external stores') {
          payload.external_store_id = parseInt(selectedExtStoreId);
          payload.remarks = `Cost Code: ${costCode}. ${remarks}`;
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit transaction');

      setSuccessMsg(submitStatus === 'Draft' ? 'Entry saved as draft.' : 'Transaction successfully submitted for Approver validation!');
      setSelectedMaterialId('');
      setQuantity('');
      setUnitPrice('');
      setTotalValue(0);
      setReferenceNumber('');
      setRemarks('');
      setQuotationNumber('');
      setSupplierName('');
      setSelectedExtStoreId('');
      setSelectedJobId('');
      setWaybillNumber('');
      setIssueOrderNumber('');
      setTemporaryJobReference('');
      setPersonReceiving('');
      setApprovalRefNumber('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
          Record Material {type === 'INFLOW' ? 'Inflow (Receipt)' : 'Outflow (Issue)'}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Selected store: <strong>{storeName}</strong>. Double-entry transaction will follow role-based approvals.
        </p>
      </div>

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid-3" style={{ alignItems: 'start' }}>
        {/* Left Card: Transaction Details */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
            Transaction Information
          </h3>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{type === 'INFLOW' ? 'Receipt / Issue Method' : 'Issue method'}</label>
              {type === 'INFLOW' ? (
                <select className="form-select" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
                  <option value="Direct Purchase">Direct Purchase by Quotation / Tender</option>
                  <option value="Transfer">Transfer from External Store</option>
                  <option value="Return">Return from Job</option>
                </select>
              ) : (
                <select className="form-select" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
                  <option value="Issue by Issue Order">Issue by Issue Order (Approved Jobs)</option>
                  <option value="Issue by Waybill before Issue Order is created">Waybill issue (Pending Issue Order)</option>
                  <option value="Issue by Waybill for approved jobs">Waybill issue (Approved Jobs)</option>
                  <option value="Issue to external stores">Issue to External Store</option>
                  <option value="Disposal or sale">Disposal or Sale</option>
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Material Code & Name</label>
              <select className="form-select" value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)}>
                <option value="">-- Search Material Code --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.code} [Grade: {m.grade_code}] - {m.name} ({m.uom})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" placeholder="0.00" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Unit Price (LKR)</label>
              <input 
                type="number" 
                className="form-input" 
                value={unitPrice} 
                onChange={(e) => setUnitPrice(e.target.value)}
                readOnly={type === 'OUTFLOW'} 
                style={{ background: type === 'OUTFLOW' ? 'rgba(255,255,255,0.02)' : 'inherit' }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimated Transaction Value</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#34d399' }}>LKR {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">General Remarks / Explanation</label>
            <textarea className="form-textarea" placeholder="Add optional transaction remarks..." value={remarks} onChange={(e) => setRemarks(e.target.value)} rows="3"></textarea>
          </div>
        </div>

        {/* Right Card: Conditional Parameters (Section 7, 8, 9, 10, 11 alignment) */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
            Conditional Fields
          </h3>

          {/* 1. Inflow - Direct Purchase */}
          {type === 'INFLOW' && subtype === 'Direct Purchase' && (
            <>
              <div className="form-group">
                <label className="form-label">Quotation / Tender Number</label>
                <input type="text" className="form-input" placeholder="e.g. QT-40291" value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Name</label>
                <input type="text" className="form-input" placeholder="e.g. Apex Materials Ltd" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Received Date</label>
                <input type="date" className="form-input" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
              </div>
            </>
          )}

          {/* 2. Inflow/Outflow - External Stores Transfers */}
          {((type === 'INFLOW' && subtype === 'Transfer') || (type === 'OUTFLOW' && subtype === 'Issue to external stores')) && (
            <>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">External Store</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowExtStoreModal(true)}>+ Add New</span>
                </div>
                <select className="form-select" value={selectedExtStoreId} onChange={(e) => setSelectedExtStoreId(e.target.value)}>
                  <option value="">-- Choose External Store --</option>
                  {externalStores.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transfer Ref # / Gate Pass</label>
                <input type="text" className="form-input" placeholder="e.g. TR-8756" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost Code</label>
                <input type="text" className="form-input" placeholder="e.g. CC-D1-HAB" value={costCode} onChange={(e) => setCostCode(e.target.value)} />
              </div>
            </>
          )}

          {/* 3. Inflow - Returns from Jobs */}
          {type === 'INFLOW' && subtype === 'Return' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Source Job</label>
                <select className="form-select" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                  <option value="">-- Choose Approved Job --</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.job_number} - {j.job_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Grade / Condition Code</label>
                <select className="form-select" value={gradeCode} onChange={(e) => setGradeCode(e.target.value)}>
                  <option value="NEW">NEW - Unused Pole/Cable</option>
                  <option value="USED">USED - Recovered Pole/Cable</option>
                  <option value="SCRAP">SCRAP - Unusable Pole/Cable</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Return Date</label>
                <input type="date" className="form-input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
            </>
          )}

          {/* 4. Outflow - Issue Order */}
          {type === 'OUTFLOW' && subtype === 'Issue by Issue Order' && (
            <>
              <div className="form-group">
                <label className="form-label">Issue Order Number</label>
                <input type="text" className="form-input" placeholder="e.g. IO-9875" value={issueOrderNumber} onChange={(e) => setIssueOrderNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Issue Order Date</label>
                <input type="date" className="form-input" value={issueOrderDate} onChange={(e) => setIssueOrderDate(e.target.value)} />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">Target Approved Job</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowJobModal(true)}>+ Add Job</span>
                </div>
                <select className="form-select" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                  <option value="">-- Choose Approved Job --</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.job_number} - {j.job_name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* 5. Outflow - Waybills (Pending Issue Order) */}
          {type === 'OUTFLOW' && subtype === 'Issue by Waybill before Issue Order is created' && (
            <>
              <div className="form-group">
                <label className="form-label">Waybill Number</label>
                <input type="text" className="form-input" placeholder="e.g. WB-40291" value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Waybill Date</label>
                <input type="date" className="form-input" value={waybillDate} onChange={(e) => setWaybillDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Job Reference</label>
                <input type="text" className="form-input" placeholder="e.g. Site extension line 3" value={temporaryJobReference} onChange={(e) => setTemporaryJobReference(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Person Receiving Material</label>
                <input type="text" className="form-input" placeholder="e.g. Tech Officer Silva" value={personReceiving} onChange={(e) => setPersonReceiving(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <input type="text" className="form-input" placeholder="e.g. Habarana Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost Code</label>
                <input type="text" className="form-input" placeholder="e.g. CC-34091" value={costCode} onChange={(e) => setCostCode(e.target.value)} />
              </div>
            </>
          )}

          {/* 6. Outflow - Waybill (Approved Jobs) */}
          {type === 'OUTFLOW' && subtype === 'Issue by Waybill for approved jobs' && (
            <>
              <div className="form-group">
                <label className="form-label">Waybill Number</label>
                <input type="text" className="form-input" placeholder="e.g. WB-50391" value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Waybill Date</label>
                <input type="date" className="form-input" value={waybillDate} onChange={(e) => setWaybillDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Approved Job</label>
                <select className="form-select" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                  <option value="">-- Choose Approved Job --</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.job_number} - {j.job_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Person Receiving Material</label>
                <input type="text" className="form-input" placeholder="e.g. Tech Officer Silva" value={personReceiving} onChange={(e) => setPersonReceiving(e.target.value)} />
              </div>
            </>
          )}

          {/* 7. Outflow - Disposals */}
          {type === 'OUTFLOW' && subtype === 'Disposal or sale' && (
            <>
              <div className="form-group">
                <label className="form-label">Approval Reference Number</label>
                <input type="text" className="form-input" placeholder="e.g. AP-9840" value={approvalRefNumber} onChange={(e) => setApprovalRefNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Disposal / Sale Method</label>
                <select className="form-select" value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value)}>
                  <option value="Sale">Sale by Tender</option>
                  <option value="Disposal">Scrapped / Melted</option>
                  <option value="Write-Off">Asset Write-off</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Disposal Date</label>
                <input type="date" className="form-input" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
              </div>
            </>
          )}

          {/* Form Actions (Draft and Submit) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem' }}>
            {type === 'OUTFLOW' && (
              <button type="button" className="btn btn-outline" style={{ width: '100%' }} disabled={loading} onClick={() => handleSubmit('Draft')}>
                Save as Draft
              </button>
            )}
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} disabled={loading} onClick={() => handleSubmit('Pending Approval')}>
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Job creation Modal */}
      {showJobModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Register Construction Job</h3>
              <span style={{ cursor: 'pointer' }} onClick={() => setShowJobModal(false)}>✕</span>
            </div>
            <form onSubmit={handleCreateJob}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Job Number (Unique)</label>
                  <input type="text" className="form-input" placeholder="e.g. JOB-D1-HAB-002" value={newJobNumber} onChange={(e) => setNewJobNumber(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Electrification Line 3" value={newJobName} onChange={(e) => setNewJobName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Responsible Person</label>
                  <input type="text" className="form-input" placeholder="e.g. Engineer Perera" value={newJobPerson} onChange={(e) => setNewJobPerson(e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input type="text" className="form-input" placeholder="e.g. Habarana Unit" value={newJobUnit} onChange={(e) => setNewJobUnit(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Code</label>
                    <input type="text" className="form-input" placeholder="e.g. CC-901" value={newJobCost} onChange={(e) => setNewJobCost(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowJobModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline External Store creation Modal */}
      {showExtStoreModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Register External Store</h3>
              <span style={{ cursor: 'pointer' }} onClick={() => setShowExtStoreModal(false)}>✕</span>
            </div>
            <form onSubmit={handleCreateExtStore}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">External Store Name (Unique)</label>
                  <input type="text" className="form-input" placeholder="e.g. Colombo Main Store" value={newExtStoreName} onChange={(e) => setNewExtStoreName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Code</label>
                  <input type="text" className="form-input" placeholder="e.g. CC-COL-01" value={newExtStoreCost} onChange={(e) => setNewExtStoreCost(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowExtStoreModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
