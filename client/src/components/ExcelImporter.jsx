import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Download } from 'lucide-react';

export default function ExcelImporter({ token, activeStore }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const activeStoreName = activeStore === 1 ? 'Habarana Store' : 'Heyyanthuduwa Store';

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle file drops
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  // Handle file input selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMsg('');
    setSuccessMsg('');
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls') {
      setErrorMsg('Invalid file type. Please upload an Excel file (.xlsx or .xls).');
      setFile(null);
      return;
    }
    setFile(file);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('storeId', activeStore);

    try {
      const res = await fetch('/api/stores/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize store.');

      setSuccessMsg(`Inventory initialized successfully for ${activeStoreName}!`);
      setFile(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate Sample Excel Template in-browser (Section 5.1 & 5.2 alignment)
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Material Code': '00117',
        'Material Name': 'FUEL ORDER BOOK',
        'Major UOM': 'NO.',
        'Grade Code': 'NEW',
        'Quantity Allocated': 0.0,
        'Quantity On Hand': 0.0,
        'Unit Price': 415.00,
        'Value': 0.0
      },
      {
        'Material Code': '00616',
        'Material Name': 'G.R.N. (EDL) BOOKS',
        'Major UOM': 'NO.',
        'Grade Code': 'NEW',
        'Quantity Allocated': 0.0,
        'Quantity On Hand': 0.0,
        'Unit Price': 947.00,
        'Value': 0.0
      },
      {
        'Material Code': '00620',
        'Material Name': 'PURCHASE ORDERS',
        'Major UOM': 'BOOK',
        'Grade Code': 'NEW',
        'Quantity Allocated': 0.0,
        'Quantity On Hand': 0.0,
        'Unit Price': 875.00,
        'Value': 0.0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Inventory');

    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 }
    ];

    XLSX.writeFile(workbook, 'PHM_Store_Initialization_Template.xlsx');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Store Inventory Initialization</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Initialize the physical inventory balance sheet for <strong>{activeStoreName}</strong> by uploading an Excel file.
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
        {/* Drag and Drop card */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Upload Excel Spreadsheet</h3>

          <div 
            className={`file-drop-area ${dragActive ? 'drag-over' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              style={{ display: 'none' }}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />
            
            <UploadCloud className="file-drop-icon" style={{ margin: '0 auto 1rem auto' }} />
            <div className="file-drop-text">
              {file ? `Selected File: ${file.name}` : 'Drag & drop your Excel file here, or click to browse'}
            </div>
            <div className="file-drop-subtext">
              Supports Microsoft Excel .xlsx and .xls file formats
            </div>
          </div>

          {file && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setFile(null)} disabled={loading}>
                Clear
              </button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={loading}>
                {loading ? 'Processing Spreadsheet...' : 'Initialize Store'}
              </button>
            </div>
          )}
        </div>

        {/* Instructions card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Spreadsheet Guidelines</h3>
          
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p>
              Your uploaded Excel sheet should contain the following column headers exactly in the first row:
            </p>
            
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li><code>Material Code</code> - Unique material code</li>
              <li><code>Material Name</code> - Description of material</li>
              <li><code>Major UOM</code> - Unit of measurement (e.g. NO., BOOK)</li>
              <li><code>Grade Code</code> - Condition/grade of material (e.g. NEW)</li>
              <li><code>Quantity Allocated</code> - Allocated stock quantity</li>
              <li><code>Quantity On Hand</code> - Available stock quantity</li>
              <li><code>Unit Price</code> - Cost price per unit</li>
              <li><code>Value</code> - Total stock value</li>
            </ul>

            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p>Download a pre-formatted sample Excel file to populate with your store data:</p>
              
              <button className="btn btn-outline" style={{ width: '100%', gap: '0.5rem' }} onClick={handleDownloadTemplate}>
                <Download size={14} />
                Download Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
