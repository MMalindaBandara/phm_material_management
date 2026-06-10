import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, X, Lock, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';

export default function JobsManager({ token, user }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // New Job Form State
  const [jobNumber, setJobNumber] = useState('');
  const [jobName, setJobName] = useState('');
  const [unit, setUnit] = useState('');
  const [costCode, setCostCode] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  
  // Edit Job Form State
  const [editingJob, setEditingJob] = useState(null);
  const [editJobNumber, setEditJobNumber] = useState('');
  const [editJobName, setEditJobName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCostCode, setEditCostCode] = useState('');
  const [editResponsiblePerson, setEditResponsiblePerson] = useState('');
  const [editStatus, setEditStatus] = useState('Active');

  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('success');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [token]);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!jobNumber || !jobName) return;

    setActionLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          job_number: jobNumber, 
          job_name: jobName,
          unit,
          cost_code: costCode,
          responsible_person: responsiblePerson
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');

      setAlertType('success');
      setAlertMsg(`Job ${jobNumber} successfully created and submitted for approval!`);
      setJobNumber('');
      setJobName('');
      setUnit('');
      setCostCode('');
      setResponsiblePerson('');
      setShowModal(false);
      fetchJobs();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateJob = async (e) => {
    e.preventDefault();
    if (!editingJob || !editJobNumber || !editJobName) return;

    setActionLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          job_number: editJobNumber, 
          job_name: editJobName,
          unit: editUnit, 
          cost_code: editCostCode,
          responsible_person: editResponsiblePerson,
          job_status: editStatus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update job');

      setAlertType('success');
      setAlertMsg(`Job ${editJobNumber} successfully updated!`);
      setEditingJob(null);
      fetchJobs();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseJob = async (jobId, jobNum) => {
    if (!window.confirm(`Are you sure you want to close Job ${jobNum}? Once closed, no more material outflows can be registered against it.`)) {
      return;
    }

    setActionLoading(true);
    setAlertMsg('');

    try {
      const res = await fetch(`/api/jobs/${jobId}/close`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close job');

      setAlertType('success');
      setAlertMsg(`Job ${jobNum} has been closed.`);
      fetchJobs();
    } catch (err) {
      setAlertType('error');
      setAlertMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const startEditJob = (job) => {
    setEditingJob(job);
    setEditJobNumber(job.job_number);
    setEditJobName(job.job_name);
    setEditUnit(job.unit || '');
    setEditCostCode(job.cost_code || '');
    setEditResponsiblePerson(job.responsible_person || '');
    setEditStatus(job.job_status || 'Active');
  };

  const canCreate = user.role === 'DECPHMD1' || user.role === 'EEMMPHMD1';
  const canClose = user.role === 'EEMMPHMD1';
  const hasActions = canCreate || canClose;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Construction Jobs Management</h2>
          <p style={{ color: 'var(--text-secondary)' }}>View, register, update, and close electric installation jobs for material issues.</p>
        </div>

        {canCreate && (
          <button className="btn btn-primary" style={{ gap: '0.5rem' }} onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Create New Job
          </button>
        )}
      </div>

      {alertMsg && (
        <div className={`alert ${alertType === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alertType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Jobs Table Card */}
      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Loading jobs list...</div>
        ) : jobs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            No jobs found in the system. Click 'Create New Job' to add one.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job Number</th>
                  <th>Job Name</th>
                  <th>Unit</th>
                  <th>Cost Code</th>
                  <th>Responsible Person</th>
                  <th>Status</th>
                  <th>Validation</th>
                  {hasActions && <th style={{ width: '180px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <code style={{ fontSize: '1rem', fontWeight: 'bold' }}>{job.job_number}</code>
                    </td>
                    <td>{job.job_name}</td>
                    <td>{job.unit || <span style={{ color: 'var(--text-muted)' }}>N/A</span>}</td>
                    <td>{job.cost_code || <span style={{ color: 'var(--text-muted)' }}>N/A</span>}</td>
                    <td>{job.responsible_person || <span style={{ color: 'var(--text-muted)' }}>N/A</span>}</td>
                    <td>
                      <span className={`status-pill ${
                        job.job_status === 'Active' ? 'status-approved' : 
                        job.job_status === 'Completed' ? 'status-pending' : 'status-rejected'
                      }`}>
                        {job.job_status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${
                        job.approval_status === 'Approved' ? 'status-approved' : 
                        job.approval_status === 'Pending Approval' ? 'status-pending' : 'status-rejected'
                      }`}>
                        {job.approval_status}
                      </span>
                    </td>
                    {hasActions && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {canCreate && (
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', gap: '0.15rem' }}
                              onClick={() => startEditJob(job)}
                              disabled={actionLoading}
                            >
                              <Edit2 size={10} />
                              Edit
                            </button>
                          )}
                          
                          {canClose && job.job_status === 'Active' && job.approval_status === 'Approved' && (
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)', gap: '0.15rem' }}
                              onClick={() => handleCloseJob(job.id, job.job_number)}
                              disabled={actionLoading}
                            >
                              <Lock size={10} />
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Job Modal (Section 6.1 details alignment) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create Construction Job</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
            </div>
            <form onSubmit={handleCreateJob}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Job Number (Unique)</label>
                  <input type="text" className="form-input" placeholder="e.g. JOB-D1-HAB-002" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Rural Grid Extension" value={jobName} onChange={(e) => setJobName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Responsible Person</label>
                  <input type="text" className="form-input" placeholder="e.g. Eng. Kamal Silva" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input type="text" className="form-input" placeholder="e.g. Habarana Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Code</label>
                    <input type="text" className="form-input" placeholder="e.g. CC-304-D1" value={costCode} onChange={(e) => setCostCode(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  Submit Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Modal (Section 6.1 details alignment) */}
      {editingJob && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Edit Construction Job</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setEditingJob(null)} />
            </div>
            <form onSubmit={handleUpdateJob}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Job Number (Unique)</label>
                  <input type="text" className="form-input" value={editJobNumber} onChange={(e) => setEditJobNumber(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Name</label>
                  <input type="text" className="form-input" value={editJobName} onChange={(e) => setEditJobName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Responsible Person</label>
                  <input type="text" className="form-input" value={editResponsiblePerson} onChange={(e) => setEditResponsiblePerson(e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input type="text" className="form-input" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Code</label>
                    <input type="text" className="form-input" value={editCostCode} onChange={(e) => setEditCostCode(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Job Status</label>
                  <select 
                    className="form-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditingJob(null)} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
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
