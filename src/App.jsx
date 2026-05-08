import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileObj, setUploadedFileObj] = useState(null);
  const [metadata, setMetadata] = useState('—');
  const [hash, setHash] = useState('—');
  const [analysisState, setAnalysisState] = useState('idle');
  const [pipelineStages, setPipelineStages] = useState({
    stage1: 'idle',
    stage2: 'idle',
    stage3: 'idle'
  });
  const [showGeminiPanel, setShowGeminiPanel] = useState(false);
  const [trustScore, setTrustScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [geminiData, setGeminiData] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(URL.createObjectURL(file));
      setUploadedFileObj(file);
      setAnalysisState('idle');
      setPipelineStages({ stage1: 'idle', stage2: 'idle', stage3: 'idle' });
      setShowGeminiPanel(false);
      setTrustScore(0);
      setMetadata('—');
      setHash('—');
      setGeminiData(null);

      // Auto-run real analysis
      setTimeout(() => runRealAnalysis(file), 500);
    }
  };

  const runRealAnalysis = async (file) => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Reset
    setPipelineStages({ stage1: 'idle', stage2: 'idle', stage3: 'idle' });
    setShowGeminiPanel(false);
    setTrustScore(0);

    // Stage 1 animation
    setTimeout(() => {
      setPipelineStages(prev => ({ ...prev, stage1: 'running' }));
    }, 100);

    try {
      // Call backend API
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();

      // Update metadata and hash
      setMetadata(result.metadata);
      setHash(result.hash);

      // Animate based on result
      setTimeout(() => {
        setPipelineStages(prev => ({ ...prev, stage1: result.stage1 }));

        if (result.stage2 === 'skipped') {
          // Local verification
          setTimeout(() => {
            setPipelineStages(prev => ({ ...prev, stage2: 'skipped', stage3: result.stage3 }));
            setTrustScore(result.trustScore);
            setAnalysisState('verified_local');
            setIsAnimating(false);
          }, 400);
        } else {
          // Gemini analysis
          setTimeout(() => {
            setPipelineStages(prev => ({ ...prev, stage2: 'running' }));
          }, 400);

          setTimeout(() => {
            setPipelineStages(prev => ({ ...prev, stage2: result.stage2, stage3: result.stage3 }));
            setTrustScore(result.trustScore);
            setGeminiData(result.geminiData);
            setShowGeminiPanel(true);
            setAnalysisState(result.stage3);
            setIsAnimating(false);
          }, 1600);
        }
      }, 800);

    } catch (error) {
      console.error('Analysis error:', error);
      setPipelineStages({ stage1: 'flagged', stage2: 'idle', stage3: 'idle' });
      setIsAnimating(false);
      alert('Analysis failed. Make sure backend server is running with valid Gemini API key.');
    }
  };

  const getStageStatus = (stage) => {
    const status = pipelineStages[stage];
    const labels = {
      stage1: { label: 'HASH CHECK', sublabels: { pass: 'Hash matched in registry', flagged: 'No match — escalating', idle: 'Awaiting analysis', running: 'Checking hash database...' }},
      stage2: { label: 'GEMINI MULTIMODAL', sublabels: { pass: 'Analysis complete — authentic', flagged: 'Anomalies detected', skipped: 'Verification complete', idle: 'Standby', running: 'AI reasoning in progress...' }},
      stage3: { label: 'FINAL VERDICT', sublabels: { verified: 'Media verified', suspicious: 'Manipulation detected', ai_generated: 'AI-generated content', idle: 'Pending', running: 'Finalizing...' }}
    };
    return { status, ...labels[stage] };
  };

  return (
    <div className="truetrace-dashboard">
      <header className="dashboard-header">
        <div className="logo">
          <div className="logo-icon">◆</div>
          <div className="logo-text">
            <div className="logo-title">TRUETRACE</div>
            <div className="logo-subtitle">MEDIA FORENSICS PLATFORM</div>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Upload Zone */}
        <section className="upload-zone">
          <input
            type="file"
            id="file-upload"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" className="upload-label">
            {uploadedFile ? (
              <div className="uploaded-preview">
                <img src={uploadedFile} alt="Uploaded media" />
                <div className="upload-overlay">CLICK TO CHANGE FILE</div>
              </div>
            ) : (
              <div className="upload-prompt">
                <div className="upload-icon">↑</div>
                <div className="upload-text">DROP MEDIA FILE OR CLICK TO UPLOAD</div>
                <div className="upload-formats">JPEG · PNG · MP4 · MOV</div>
              </div>
            )}
          </label>
        </section>

        {/* Analysis Pipeline */}
        {uploadedFile && (
          <>
            <section className="pipeline-strip">
              {['stage1', 'stage2', 'stage3'].map((stage, idx) => {
                const { status, label, sublabels } = getStageStatus(stage);
                const stageNum = `0${idx + 1}`;

                return (
                  <React.Fragment key={stage}>
                    <div className={`pipeline-node ${status}`}>
                      <div className="node-number">{stageNum}</div>
                      <div className="node-content">
                        <div className="node-label">
                          {label}
                          {stage === 'stage2' && status === 'running' && (
                            <span className="gemini-badge">◆ GEMINI 1.5 PRO</span>
                          )}
                        </div>
                        <div className="node-status">
                          {status === 'running' && <div className="spinner" />}
                          {status === 'pass' && <span className="icon">✓</span>}
                          {status === 'flagged' && <span className="icon">⚠</span>}
                          {status === 'skipped' && <span className="icon">—</span>}
                          {status === 'verified' && <span className="icon">✓</span>}
                          {status === 'suspicious' && <span className="icon">⚠</span>}
                          {status === 'ai_generated' && <span className="icon">✕</span>}
                        </div>
                        <div className="node-sublabel">{sublabels[status]}</div>
                      </div>
                    </div>

                    {idx < 2 && (
                      <div className="pipeline-connector">
                        <div className={`connector-line ${pipelineStages[`stage${idx + 2}`] !== 'idle' ? 'active' : ''}`} />
                        {idx === 0 && pipelineStages.stage1 !== 'idle' && (
                          <div className={`escalation-badge ${pipelineStages.stage2 === 'skipped' ? 'verified' : 'escalated'}`}>
                            {pipelineStages.stage2 === 'skipped' ? (
                              <>✓ HASH VERIFIED — GEMINI ANALYSIS SKIPPED</>
                            ) : (
                              <>⚡ BORDERLINE: LOCAL SCORE 54% — ESCALATING TO GEMINI</>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </section>

            {/* Gemini Reasoning Panel */}
            <section className={`gemini-panel ${showGeminiPanel ? 'visible' : ''}`}>
              <div className="panel-header">
                <span className="panel-icon">◆</span> GEMINI MULTIMODAL ANALYSIS
                <span className="panel-model">MODEL: gemini-3.1-flash-lite</span>
              </div>
              <div className="panel-content">
                <div className="panel-left">
                  <div className="findings-label">ANOMALY EVIDENCE</div>
                  <table className="findings-table">
                    <thead>
                      <tr>
                        <th>DOMAIN</th>
                        <th>FINDING</th>
                        <th>SEVERITY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geminiData?.findings.map((finding, idx) => (
                        <tr key={idx} className={`severity-${finding.severity.toLowerCase()}`}>
                          <td className="domain">{finding.domain}</td>
                          <td className="finding">{finding.finding}</td>
                          <td className="severity">
                            <span className={`severity-pill ${finding.severity.toLowerCase()}`}>
                              {finding.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel-right">
                  <div className="probability-label">PROBABILITY BREAKDOWN</div>
                  <div className="probability-chart">
                    {geminiData && Object.entries(geminiData.probabilities).map(([key, value]) => (
                      <div key={key} className="probability-bar-container">
                        <div className="probability-label-text">{key.toUpperCase()}</div>
                        <div className="probability-bar-wrapper">
                          <div
                            className={`probability-bar ${key}`}
                            style={{ height: `${value}%` }}
                          >
                            <span className="probability-value">{value}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <blockquote className="verdict-quote">
                "{geminiData?.verdict}"
                <span className="verdict-attribution">— GEMINI/MULTIMODAL</span>
              </blockquote>
            </section>

            {/* Trust Gauge */}
            <section className="trust-gauge">
              <div className="gauge-label">TRUST SCORE</div>
              <div className="gauge-container">
                <svg viewBox="0 0 200 120" className="gauge-svg">
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--accent-danger)" />
                      <stop offset="50%" stopColor="var(--accent-warning)" />
                      <stop offset="100%" stopColor="var(--accent-verified)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="var(--bg-elevated)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (trustScore / 100) * 251.2}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                  />
                </svg>
                <div className="gauge-score">{trustScore}</div>
                <div className="gauge-status">
                  {trustScore >= 80 && 'VERIFIED'}
                  {trustScore >= 40 && trustScore < 80 && 'SUSPICIOUS'}
                  {trustScore < 40 && trustScore > 0 && 'AI GENERATED'}
                  {trustScore === 0 && 'AWAITING ANALYSIS'}
                </div>
              </div>
            </section>

            {/* Provenance Timeline */}
            <section className="provenance-timeline">
              <div className="timeline-label">PROVENANCE CHAIN</div>
              <div className="timeline-nodes">
                {[
                  { label: 'UPLOAD', value: uploadedFile ? 'May 7, 2026 11:03 GMT+8' : '—' },
                  { label: 'HASH', value: hash },
                  { label: 'METADATA', value: metadata },
                  { label: 'ANALYSIS METHOD', value: analysisState === 'verified_local' ? 'LOCAL HASH ONLY' : analysisState !== 'idle' ? 'LOCAL + GEMINI MULTIMODAL' : '—' }
                ].map((node, idx) => (
                  <div key={idx} className="timeline-node">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-node-label">{node.label}</div>
                      <div className="timeline-node-value">{node.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </>
        )}
      </main>
    </div>
  );
};

export default App;