import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Search, Download, Edit2, AlertCircle, CheckCircle2, ShieldAlert, FileText, Briefcase, X } from 'lucide-react';

export default function ReportsView({ token, user, activeStore, viewPendingOnly = false }) {
  const [reportType, setReportType] = useState(viewPendingOnly ? 'waybills' : 'balances'); // 'balances', 'waybills', 'jobwise', 'inflows'
  const [data, setData] = useState([]);
  const [inflowMethodFilter, setInflowMethodFilter] = useState('All');
  const [externalStoreFilter, setExternalStoreFilter] = useState('All');
  const [externalStores, setExternalStores] = useState([]);
  const [inflowSummary, setInflowSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Lookup data for Job-wise Report
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobReportData, setJobReportData] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');

  // Waybill update dialog
  const [selectedWaybill, setSelectedWaybill] = useState(null);
  const [issueOrderNumberInput, setIssueOrderNumberInput] = useState('');
  const [issueOrderDateInput, setIssueOrderDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [waybillJobId, setWaybillJobId] = useState('');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('success');

  const activeStoreName = activeStore === 1 ? 'Habarana Store' : 'Heyyanthuduwa Store';

  // Toggle report types if viewPendingOnly is forced
  useEffect(() => {
    if (viewPendingOnly) {
      setReportType('waybills');
    } else {
      setReportType('balances');
    }
    setData([]);
    setSearchTerm('');
    setAlertMsg('');
  }, [viewPendingOnly, activeStore]);

  useEffect(() => {
    if (selectedWaybill) {
      setIssueOrderNumberInput(selectedWaybill.issue_order_number || '');
      setIssueOrderDateInput(selectedWaybill.issue_order_date || new Date().toISOString().split('T')[0]);
      setWaybillJobId(selectedWaybill.job_id || '');
    } else {
      setIssueOrderNumberInput('');
      setIssueOrderDateInput(new Date().toISOString().split('T')[0]);
      setWaybillJobId('');
    }
  }, [selectedWaybill]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      if (reportType === 'balances') {
        const res = await fetch(`/api/reports/balances?storeId=${activeStore}`, { headers });
        const resData = await res.json();
        if (res.ok) setData(resData);
      } else if (reportType === 'waybills') {
        const res = await fetch(`/api/reports/pending-issue-orders`, { headers });
        const resData = await res.json();
        if (res.ok) setData(resData.filter(w => w.store_id === activeStore));
        
        const jobsRes = await fetch('/api/jobs', { headers });
        const jobsData = await jobsRes.json();
        if (jobsRes.ok) setJobs(jobsData.filter(j => j.approval_status === 'Approved'));
      } else if (reportType === 'jobwise') {
        const res = await fetch('/api/jobs', { headers });
        const resData = await res.json();
        if (res.ok) setJobs(resData.filter(j => j.approval_status === 'Approved'));
      } else if (reportType === 'inflows') {
        const [sumRes, detRes, extRes] = await Promise.all([
          fetch(`/api/reports/inflows-summary?storeId=${activeStore}&inflowMethod=${inflowMethodFilter}&externalStoreId=${externalStoreFilter}`, { headers }),
          fetch(`/api/reports/inflows?storeId=${activeStore}&method=${inflowMethodFilter}&externalStoreId=${externalStoreFilter}`, { headers }),
          fetch('/api/external-stores', { headers })
        ]);
        
        const sumData = await sumRes.json();
        const detData = await detRes.json();
        const extData = await extRes.json();

        if (sumRes.ok) setInflowSummary(sumData);
        if (detRes.ok) setData(detData);
        if (extRes.ok) setExternalStores(extData.filter(ex => ex.approval_status === 'Approved'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activeStore, reportType, inflowMethodFilter, externalStoreFilter]);

  // Fetch job-wise report data
  const fetchJobReport = async () => {
    if (!selectedJobId) {
      setJobReportData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/job-materials?jobId=${selectedJobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok) setJobReportData(resData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportType === 'jobwise') {
      fetchJobReport();
    }
  }, [selectedJobId]);

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(order);
  };

  const getProcessedData = () => {
    let filtered = [...data];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (reportType === 'waybills') {
        filtered = filtered.filter(item => 
          item.waybill_number.toLowerCase().includes(term) ||
          item.material_name.toLowerCase().includes(term) ||
          item.material_code.toLowerCase().includes(term)
        );
      } else if (reportType === 'inflows') {
        filtered = filtered.filter(item => 
          item.material_code.toLowerCase().includes(term) ||
          item.material_name.toLowerCase().includes(term) ||
          (item.reference_number && item.reference_number.toLowerCase().includes(term))
        );
      } else {
        filtered = filtered.filter(item => 
          item.code.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term)
        );
      }
    }

    if (reportType === 'balances') {
      filtered.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const processedData = getProcessedData();

  // Excel Exporter
  const handleExportExcel = () => {
    let exportData = [];
    let filename = '';
    let sheetName = '';

    if (reportType === 'balances') {
      filename = `${activeStoreName.replace(' ', '_')}_Balances_${new Date().toISOString().split('T')[0]}.xlsx`;
      sheetName = 'Balances';
      exportData = processedData.map(item => ({
        'Store': item.store_name,
        'Material Code': item.code,
        'Material Name': item.name,
        'UOM': item.uom,
        'Grade Code': item.grade_code,
        'Quantity Allocated': item.quantity_allocated,
        'Quantity On Hand': item.quantity_on_hand,
        'Unit Price (LKR)': item.unit_price,
        'Total Value (LKR)': item.value
      }));
    } else if (reportType === 'inflows') {
      filename = `${activeStoreName.replace(' ', '_')}_Inflows_${new Date().toISOString().split('T')[0]}.xlsx`;
      sheetName = 'Material Inflows';
      exportData = processedData.map(item => ({
        'Store': item.store_name,
        'Material Code': item.material_code,
        'Material Name': item.material_name,
        'UOM': item.uom,
        'Inflow Method': item.inflow_method,
        'Quantity': item.quantity,
        'Unit Price (LKR)': item.unit_price,
        'Total Value (LKR)': item.total_value,
        'Receipt Status': item.receipt_status,
        'Approval Status': item.approval_status,
        'Reference #': item.reference_number || 'N/A',
        'Source External Store': item.external_store_name || 'N/A',
        'Date': item.created_date
      }));
    } else if (reportType === 'waybills') {
      filename = `${activeStoreName.replace(' ', '_')}_Pending_Waybills_${new Date().toISOString().split('T')[0]}.xlsx`;
      sheetName = 'Pending Waybills';
      exportData = processedData.map(w => {
        // Calculate pending duration (Section 15.4)
        const days = Math.floor((new Date() - new Date(w.waybill_date)) / (1000 * 60 * 60 * 24));
        return {
          'Store': w.store_name,
          'Waybill Number': w.waybill_number,
          'Waybill Date': w.waybill_date,
          'Material Code': w.material_code,
          'Material Name': w.material_name,
          'Quantity Issued': w.quantity,
          'Job Number': w.job_number || 'N/A',
          'Temporary Job Ref': w.temporary_job_reference || 'N/A',
          'Unit': w.unit || 'N/A',
          'Cost Code': w.cost_code || 'N/A',
          'Person Receiving': w.person_receiving || 'N/A',
          'Pending Duration (Days)': days,
          'Issue Order Status': w.issue_order_status
        };
      });
    } else if (reportType === 'jobwise' && jobReportData) {
      filename = `Job_${jobReportData.job.job_number}_Material_Report.xlsx`;
      sheetName = 'Job Materials';
      
      // Calculate net usage list (Section 15.6 alignment)
      const matMap = {};
      const addMat = (item, typeVal) => {
        if (!matMap[item.code]) {
          matMap[item.code] = { code: item.code, name: item.name, uom: item.uom, issued: 0, waybill: 0, returned: 0 };
        }
        matMap[item.code][typeVal] += item.total_qty;
      };

      jobReportData.outflows.forEach(o => {
        if (o.outflow_method === 'Issue by Issue Order') addMat(o, 'issued');
        else addMat(o, 'waybill');
      });
      jobReportData.returns.forEach(r => addMat(r, 'returned'));

      exportData = Object.values(matMap).map(m => ({
        'Material Code': m.code,
        'Material Name': m.name,
        'UOM': m.uom,
        'Issued (Issue Order)': m.issued,
        'Issued (Waybill)': m.waybill,
        'Returned Quantity': m.returned,
        'Net Material Used': (m.issued + m.waybill) - m.returned
      }));
    }

    if (exportData.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Auto-fit column widths
    const maxKeys = Object.keys(exportData[0] || {});
    worksheet['!cols'] = maxKeys.map(k => ({ wch: Math.max(k.length + 5, 15) }));

    XLSX.writeFile(workbook, filename);
  };

  // Submit Issue Order update
  const handleUpdateWaybillLink = async (e) => {
    e.preventDefault();
    if (!issueOrderNumberInput) return;

    setActionLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch(`/api/transactions/waybill/${selectedWaybill.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          issue_order_number: issueOrderNumberInput,
          issue_order_date: issueOrderDateInput,
          job_id: waybillJobId ? parseInt(waybillJobId) : null
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to link Issue Order');

      setAlertType('success');
      setAlertMsg('Waybill Issue Order linkage successfully submitted for approval.');
      setSelectedWaybill(null);
      fetchData();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate Net Job Use table
  const renderJobWiseReportTable = () => {
    if (!jobReportData) return null;
    const { job } = jobReportData;

    const matMap = {};
    const getOrInit = (code, name, uom) => {
      if (!matMap[code]) {
        matMap[code] = { code, name, uom, issued: 0, waybill: 0, pending: 0, returned: 0 };
      }
      return matMap[code];
    };

    jobReportData.outflows.forEach(o => {
      const entry = getOrInit(o.code, o.name, o.uom);
      if (o.outflow_method === 'Issue by Issue Order') {
        entry.issued += o.total_qty;
      } else {
        entry.waybill += o.total_qty;
      }
    });

    jobReportData.returns.forEach(r => {
      const entry = getOrInit(r.code, r.name, r.uom);
      entry.returned += r.total_qty;
    });

    jobReportData.pendingWaybills.forEach(p => {
      const entry = getOrInit(p.code, p.name, p.uom);
      entry.pending += p.total_qty;
    });

    const rows = Object.values(matMap);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Job Details Card */}
        <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', border: '1px solid var(--card-border)' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', color: 'var(--primary)' }}>
            Job Profile Details
          </h4>
          <div className="grid-3" style={{ gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Job Number</span>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '0.15rem' }}><code>{job.job_number}</code></div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Job Name</span>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '0.15rem' }}>{job.job_name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Job Status</span>
              <div style={{ marginTop: '0.15rem' }}>
                <span className={`status-pill ${
                  job.job_status === 'Active' ? 'status-approved' : 
                  job.job_status === 'Completed' ? 'status-pending' : 'status-rejected'
                }`}>
                  {job.job_status}
                </span>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unit</span>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '0.15rem' }}>{job.unit || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cost Code</span>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '0.15rem' }}>{job.cost_code || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Responsible Person</span>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '0.15rem' }}>{job.responsible_person || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Material Usage Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Material Name</th>
                <th>UOM</th>
                <th>Issued (Issue Order)</th>
                <th>Issued (Waybill)</th>
                <th>Pending Waybills</th>
                <th>Returns from Site</th>
                <th style={{ color: '#34d399' }}>Net Material Used</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No material movements recorded for this job.</td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const netUsed = (r.issued + r.waybill + r.pending) - r.returned;
                  return (
                    <tr key={i}>
                      <td><code>{r.code}</code></td>
                      <td>{r.name}</td>
                      <td>{r.uom}</td>
                      <td>{r.issued}</td>
                      <td>{r.waybill}</td>
                      <td>{r.pending}</td>
                      <td style={{ color: '#f87171' }}>{r.returned > 0 ? `-${r.returned}` : 0}</td>
                      <td style={{ fontWeight: 'bold', color: '#34d399' }}>{netUsed}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            {reportType === 'balances' && 'Inventory Asset Balance Sheet'}
            {reportType === 'waybills' && 'Waybills Pending Issue Orders'}
            {reportType === 'jobwise' && 'Job-wise Net Material Usage'}
            {reportType === 'inflows' && 'Material Inflows Report'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {reportType === 'balances' && `Approved quantities and valuations for ${activeStoreName}.`}
            {reportType === 'waybills' && `Active waybill issues requiring Issue Order updates at ${activeStoreName}.`}
            {reportType === 'jobwise' && 'Complete net material calculations (Issues + Waybills - Returns).'}
            {reportType === 'inflows' && `Aggregated summaries and inflow metrics for ${activeStoreName}.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {!viewPendingOnly && (
            <select 
              className="form-select" 
              style={{ width: '200px' }}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="balances">Inventory Balances</option>
              <option value="inflows">Material Inflows Report</option>
              <option value="waybills">Pending Waybills</option>
              <option value="jobwise">Job-wise Usage Report</option>
            </select>
          )}

          <button 
            className="btn btn-secondary" 
            style={{ gap: '0.5rem' }} 
            onClick={handleExportExcel}
            disabled={loading || (reportType !== 'jobwise' && processedData.length === 0) || (reportType === 'jobwise' && !jobReportData)}
          >
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {alertMsg && (
        <div className={`alert ${alertType === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alertType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Conditional Job Selector for Jobwise Tab */}
      {reportType === 'jobwise' && (
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Briefcase size={18} className="text-secondary" />
          <select 
            className="form-select"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            style={{ maxWidth: '400px' }}
          >
            <option value="">-- Choose Construction Job --</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.job_number} - {j.job_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Inflow Report Filters and Summaries */}
      {reportType === 'inflows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '200px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inflow Method</span>
              <select className="form-select" value={inflowMethodFilter} onChange={(e) => { setInflowMethodFilter(e.target.value); if (e.target.value !== 'Transfer') setExternalStoreFilter('All'); }}>
                <option value="All">All Inflow Methods</option>
                <option value="Direct Purchase">Direct Purchase</option>
                <option value="Transfer">Transfer</option>
                <option value="Return">Return</option>
              </select>
            </div>

            {(inflowMethodFilter === 'All' || inflowMethodFilter === 'Transfer') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '200px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>External Store (Transfers)</span>
                <select className="form-select" value={externalStoreFilter} onChange={(e) => setExternalStoreFilter(e.target.value)}>
                  <option value="All">All External Stores</option>
                  {externalStores.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Summarized Card Grid */}
          <div className="grid-4">
            <div className="glass-card" style={{ background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Pending Qty</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#60a5fa', marginTop: '0.25rem' }}>
                {inflowSummary.reduce((a, c) => a + (c.pending || 0), 0).toLocaleString()}
              </div>
            </div>

            <div className="glass-card" style={{ background: 'rgba(234, 179, 8, 0.04)', border: '1px solid rgba(234, 179, 8, 0.1)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Confirmed Qty</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#eab308', marginTop: '0.25rem' }}>
                {inflowSummary.reduce((a, c) => a + (c.confirmed || 0), 0).toLocaleString()}
              </div>
            </div>

            <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Rejected Qty</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#f87171', marginTop: '0.25rem' }}>
                {inflowSummary.reduce((a, c) => a + (c.rejected || 0), 0).toLocaleString()}
              </div>
            </div>

            <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Present Stock Balance</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#34d399', marginTop: '0.25rem' }}>
                {inflowSummary.reduce((a, c) => a + (c.presentStock || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar for Balances / Waybills / Inflows */}
      {reportType !== 'jobwise' && (
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingLeft: '38px' }}
              placeholder={
                reportType === 'waybills' ? "Search by Waybill Number or Material..." :
                reportType === 'inflows' ? "Search by Material Code, Name, or Reference..." :
                "Search by Material Code or Description..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Main Report Table Card */}
      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Compiling report data...</div>
        ) : reportType === 'jobwise' ? (
          /* JOBWISE RENDER */
          selectedJobId ? (
            renderJobWiseReportTable()
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Please select a job above to compile report.</div>
          )
        ) : processedData.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No records found matching filters.</div>
        ) : reportType === 'waybills' ? (
          /* PENDING WAYBILLS RENDER */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {processedData.map((wb) => {
              // Calculate pending duration (Section 15.4)
              const days = Math.floor((new Date() - new Date(wb.waybill_date)) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={wb.id} className="glass-card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                    <div>
                      <span className="status-pill status-pending" style={{ marginRight: '0.5rem' }}>
                        {wb.issue_order_status === 'Pending' ? 'Pending Issue Order' : wb.issue_order_status}
                      </span>
                      <strong style={{ fontSize: '1.1rem' }}>Waybill #: {wb.waybill_number}</strong>
                      <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Pending Duration: <strong style={{ color: '#f87171' }}>{days} Days</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Issued: {wb.waybill_date}</span>
                  </div>

                  <div className="grid-2" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', gap: '0.5rem 2rem' }}>
                    <div>Material: <strong>{wb.material_name} (Code: {wb.material_code})</strong></div>
                    <div>Quantity Issued: <strong>{wb.quantity} {wb.uom}</strong></div>
                    <div>Temporary Job Ref: <strong>{wb.temporary_job_reference || 'N/A'}</strong></div>
                    <div>Person Receiving: <strong>{wb.person_receiving || 'N/A'}</strong></div>
                    <div>Unit: <strong>{wb.unit || 'N/A'}</strong></div>
                    <div>Cost Code: <strong>{wb.cost_code || 'N/A'}</strong></div>
                  </div>

                  {user.role === 'DECPHMD1' && wb.issue_order_status === 'Pending' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', gap: '0.25rem' }}
                        onClick={() => setSelectedWaybill(wb)}
                      >
                        <Edit2 size={12} />
                        Update Issue Order
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : reportType === 'inflows' ? (
          /* INFLOW DETAILED RENDER */
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>UOM</th>
                  <th>Method</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total Value (LKR)</th>
                  <th>Receipt Status</th>
                  <th>Approval Status</th>
                  <th>Reference / Details</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((item, idx) => (
                  <tr key={idx}>
                    <td><code>{item.material_code}</code></td>
                    <td>{item.material_name}</td>
                    <td>{item.uom}</td>
                    <td>{item.inflow_method}</td>
                    <td>{item.quantity}</td>
                    <td>LKR {(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td><strong>LKR {(item.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                    <td>
                      <span className={`status-pill ${
                        item.receipt_status === 'Received' ? 'status-approved' :
                        item.receipt_status === 'Pending' ? 'status-pending' :
                        item.receipt_status === 'Confirmed' ? 'status-draft' :
                        'status-rejected'
                      }`}>
                        {item.receipt_status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${
                        item.approval_status === 'Approved' ? 'status-approved' :
                        item.approval_status === 'Pending Approval' ? 'status-pending' :
                        'status-rejected'
                      }`}>
                        {item.approval_status}
                      </span>
                    </td>
                    <td>
                      {item.reference_number && <div>Ref: <code>{item.reference_number}</code></div>}
                      {item.external_store_name && <div>From: {item.external_store_name}</div>}
                      {item.remarks && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.remarks}</div>}
                    </td>
                    <td>{item.created_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* INVENTORY BALANCES RENDER */
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('code')}>
                    Material Code {sortField === 'code' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    Material Name {sortField === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>UOM</th>
                  <th>Grade</th>
                  <th>Qty Allocated</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quantity_on_hand')}>
                    Qty On Hand {sortField === 'quantity_on_hand' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Unit Price</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('value')}>
                    Total Value (LKR) {sortField === 'value' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((item, idx) => (
                  <tr key={idx}>
                    <td><code>{item.code}</code></td>
                    <td>{item.name}</td>
                    <td>{item.uom}</td>
                    <td><span className="status-pill status-draft">{item.grade_code}</span></td>
                    <td>{item.quantity_allocated}</td>
                    <td style={{ fontWeight: item.quantity_on_hand <= 5 ? 'bold' : 'normal', color: item.quantity_on_hand <= 5 ? '#f87171' : 'inherit' }}>
                      {item.quantity_on_hand}
                      {item.quantity_on_hand <= 5 && <span style={{ fontSize: '0.75rem', color: '#f87171', marginLeft: '0.5rem' }}>(Low Stock)</span>}
                    </td>
                    <td>LKR {(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td><strong>LKR {(item.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for updating Waybill Issue Order details */}
      {selectedWaybill && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Link Issue Order Details</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setSelectedWaybill(null)} />
            </div>
            <form onSubmit={handleUpdateWaybillLink}>
              <div className="modal-body">
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--card-border)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                  Waybill: <strong>{selectedWaybill.waybill_number}</strong> | Date: <strong>{selectedWaybill.waybill_date}</strong><br />
                  Material: <strong>{selectedWaybill.material_name} x {selectedWaybill.quantity}</strong>
                </div>

                <div className="form-group">
                  <label className="form-label">Issue Order Number (Required)</label>
                  <input type="text" className="form-input" placeholder="e.g. IO-9875" value={issueOrderNumberInput} onChange={(e) => setIssueOrderNumberInput(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Issue Order Date (Required)</label>
                  <input type="date" className="form-input" value={issueOrderDateInput} onChange={(e) => setIssueOrderDateInput(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Link to Approved Job (Required)</label>
                  <select 
                    className="form-select"
                    value={waybillJobId}
                    onChange={(e) => setWaybillJobId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Approved Job --</option>
                    {jobs.filter(j => j.job_status === 'Active').map(j => (
                      <option key={j.id} value={j.id}>{j.job_number} - {j.job_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedWaybill(null)} disabled={actionLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Submit Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
