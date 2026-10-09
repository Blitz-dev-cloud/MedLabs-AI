import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bell, BookOpen,
  BrainCircuit, Check, ChevronDown, CircleHelp, Clock3, Database, Download,
  FileChartColumn, Fingerprint, Gauge, GitBranch, HeartPulse, Info, Layers3,
  LayoutDashboard, LockKeyhole, Menu, MessageSquareText, Network, PanelLeftClose,
  Plus, Search, Settings2, ShieldAlert, ShieldCheck, Sparkles, Stethoscope,
  TrendingUp, Waves, X, Zap,
} from 'lucide-react';
import NeuralScene from './components/NeuralScene.jsx';
import { createExplanation, createPrediction, getKnowledgeSources, isApiConfigured } from './api.js';

const reportedMetrics = {
  graphsage: { accuracy: 86.69, precision: 79.02, recall: 95.76, f1: 86.59, auc: 92.38, profileAccuracy: 83.22, profilePrecision: 75.00, profileRecall: 95.65, profileF1: 84.08, profileAuc: 90.69 },
  logistic_regression: { accuracy: 82.89, precision: 74.50, recall: 94.07, f1: 83.15, auc: 92.24, profileAccuracy: 80.54, profilePrecision: 72.22, profileRecall: 94.20, profileF1: 81.76, profileAuc: 90.45 },
};

const fields = [
  { name: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 100, required: true, help: 'Age in years' },
  { name: 'sex', label: 'Sex code', type: 'select', required: true, options: [['1', '1 · Dataset code'], ['0', '0 · Dataset code']], help: 'Use the codebook for the chosen dataset.' },
  { name: 'cp', label: 'Chest-pain category', type: 'select', required: true, options: [['1', '1 · Category'], ['2', '2 · Category'], ['3', '3 · Category'], ['4', '4 · Category']], help: 'Dataset-coded category, not a severity scale.' },
  { name: 'trestbps', label: 'Resting blood pressure', type: 'number', unit: 'mmHg*', min: 50, max: 300, help: 'Leave blank if unknown.' },
  { name: 'chol', label: 'Serum cholesterol', type: 'number', unit: 'mg/dL*', min: 50, max: 800, help: 'Leave blank if unknown.' },
  { name: 'fbs', label: 'Fasting blood sugar', type: 'selectNullable', options: [['0', '0 · No'], ['1', '1 · Yes']], help: 'Optional dataset-coded indicator.' },
  { name: 'restecg', label: 'Resting ECG', type: 'selectNullable', options: [['0', '0 · Category'], ['1', '1 · Category'], ['2', '2 · Category']], help: 'Dataset-coded category.' },
  { name: 'thalach', label: 'Maximum heart rate', type: 'number', unit: 'bpm*', min: 30, max: 250, help: 'Leave blank if unknown.' },
  { name: 'exang', label: 'Exercise-induced angina', type: 'selectNullable', options: [['0', '0 · No'], ['1', '1 · Yes']], help: 'Dataset-coded indicator.' },
  { name: 'oldpeak', label: 'Oldpeak', type: 'number', unit: 'source value', min: -5, max: 10, step: 0.1, help: 'Preserve the source definition.' },
  { name: 'slope', label: 'Slope category', type: 'selectNullable', options: [['1', '1 · Category'], ['2', '2 · Category'], ['3', '3 · Category']], help: 'Codes are from the retained-source experiment.' },
];

const samplePatient = {
  age: '54', sex: '1', cp: '4', trestbps: '130', chol: '239',
  fbs: '0', restecg: '0', thalach: '150', exang: '0', oldpeak: '0.8', slope: '2',
};

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'assessment', label: 'Risk assessment', icon: HeartPulse, tag: 'NEW' },
  { id: 'model-lab', label: 'Model lab', icon: GitBranch },
  { id: 'knowledge', label: 'Knowledge layer', icon: BookOpen },
];

function Sparkline({ positive = true }) {
  const path = positive
    ? 'M2 24 C12 23, 12 15, 24 18 S38 27, 48 13 S64 16, 75 8 S93 12, 108 2'
    : 'M2 8 C15 9, 17 22, 30 17 S49 8, 60 16 S82 26, 108 20';
  return <svg className="sparkline" viewBox="0 0 110 30" role="img" aria-label="Decorative trend line"><path d={path} fill="none" stroke={positive ? '#35d9bf' : '#a395ff'} strokeWidth="2.25" strokeLinecap="round" /></svg>;
}

function MetricCard({ label, value, suffix = '', detail, trend = 'up', icon: Icon, delay = 0 }) {
  return (
    <motion.article className="metric-card surface-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay }} whileHover={{ y: -3 }}>
      <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div>
      <div className="metric-value">{value}<small>{suffix}</small></div>
      <div className="metric-bottom"><span className={`metric-trend ${trend === 'down' ? 'metric-trend--muted' : ''}`}>{trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{detail}</span><Sparkline positive={trend === 'up'} /></div>
    </motion.article>
  );
}

function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="section-title-row">
      <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

function Sidebar({ active, onNavigate, mobileOpen, onClose }) {
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Activity size={21} strokeWidth={2.7} /></div>
          <div className="brand-copy"><strong>cardio<span>graph</span></strong><small>RESEARCH STUDIO</small></div>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar"><BrainCircuit size={17} /></div>
          <div className="workspace-copy"><strong>Heart intelligence</strong><small>Course workspace</small></div>
          <ChevronDown size={14} className="workspace-chevron" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon, tag }) => (
            <button key={id} className={`nav-item ${active === id ? 'nav-item--active' : ''}`} onClick={() => { onNavigate(id); onClose(); }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{tag && <em>{tag}</em>}
              {active === id && <motion.i layoutId="nav-active" className="nav-active-indicator" />}
            </button>
          ))}
        </nav>
        <div className="nav-label nav-label--spaced">SYSTEM</div>
        <button className="nav-item" onClick={() => onNavigate('knowledge')}><Database size={17} strokeWidth={1.8} /><span>Evidence sources</span></button>
        <button className="nav-item" onClick={() => onNavigate('model-lab')}><Settings2 size={17} strokeWidth={1.8} /><span>Model settings</span></button>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <div className="status-orb"><ShieldCheck size={17} /></div>
          <div><strong>Research environment</strong><small><span className="live-dot" /> {isApiConfigured ? 'API URL configured' : 'Preview mode active'}</small></div>
        </div>
        <div className="profile-row">
          <div className="profile-avatar">CG</div>
          <div className="profile-copy"><strong>Project workspace</strong><small>Research team</small></div>
          <button className="icon-button" aria-label="Profile options"><ChevronDown size={15} /></button>
        </div>
        <div className="sidebar-footer">CARDIOGRAPH <span>v1.0.0</span></div>
      </aside>
    </>
  );
}

function Topbar({ active, onToggleSidebar, onOpenSearch }) {
  const title = navItems.find((item) => item.id === active)?.label || 'Overview';
  return (
    <header className="topbar">
      <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onToggleSidebar}><Menu size={19} /></button><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
      <div className="topbar-right">
        <div className={`api-state ${isApiConfigured ? 'api-state--configured' : ''}`}><span className="live-dot" />{isApiConfigured ? 'API configured' : 'Preview mode'}</div>
        <button className="icon-button topbar-search" aria-label="Search sections" onClick={onOpenSearch}><Search size={17} /></button>
        <button className="icon-button bell-button" aria-label="Notifications"><Bell size={17} /><span /></button>
        <div className="topbar-avatar">R</div>
      </div>
    </header>
  );
}

function Overview({ onNavigate }) {
  return (
    <motion.div className="page-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
      <div className="page-heading-row">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> CARDIOGRAPH / INTELLIGENCE OVERVIEW</div><h1>Clinical signals,<br /><span>connected.</span></h1><p className="page-lede">Explore a graph-first approach to heart disease classification, with evidence-grounded explanations layered on top.</p></div>
        <div className="heading-actions"><div className="research-badge"><span className="badge-glyph"><Fingerprint size={15} /></span><span><strong>RESEARCH BUILD</strong><small>Multi-source experiment</small></span></div><button className="button button-primary" onClick={() => onNavigate('assessment')}><Plus size={17} /> New assessment <ArrowRight size={15} /></button></div>
      </div>

      <div className="hero-panel">
        <div className="hero-copy">
          <div className="hero-pill"><span className="hero-pill-dot" /> GRAPH-BASED INTELLIGENCE <span className="pill-separator">/</span> MODEL SNAPSHOT</div>
          <h2>Every patient is a signal.<br /><em>Every connection, context.</em></h2>
          <p>CardioGraph learns from structured patient features and their similarity network, then pairs model outputs with a retrieval-backed explanation layer.</p>
          <div className="hero-actions"><button className="button button-light" onClick={() => onNavigate('assessment')}>Run an assessment <ArrowRight size={16} /></button><button className="button button-ghost-light" onClick={() => onNavigate('model-lab')}>Explore model lab <ArrowUpRight size={15} /></button></div>
          <div className="hero-footnote"><ShieldCheck size={14} /> Educational research prototype <span>·</span> not clinically validated</div>
        </div>
        <div className="hero-visual">
          <div className="visual-topline"><span><i /> PATIENT SIMILARITY GRAPH</span><span className="mono">KNN / 05</span></div>
          <NeuralScene />
          <div className="visual-float visual-float--top"><span className="float-swatch mint" /><span><b>Node features</b><small>11 clinical variables</small></span></div>
          <div className="visual-float visual-float--bottom"><span className="float-wave"><Waves size={17} /></span><span><b>Message passing</b><small>Neighbor aggregation</small></span><span className="float-arrow"><ArrowUpRight size={14} /></span></div>
          <div className="visual-corner-mark">CG / 3D</div>
        </div>
        <div className="hero-grid-decoration" />
      </div>

      <div className="section-title-row metrics-heading"><div><div className="eyebrow">EXPERIMENT SNAPSHOT</div><h2>Model performance</h2></div><button className="text-link" onClick={() => onNavigate('model-lab')}>View evaluation <ArrowRight size={14} /></button></div>
      <div className="metrics-grid">
        <MetricCard label="Test accuracy" value="86.69" suffix="%" detail="GraphSAGE · row-level" icon={Gauge} delay={0.02} />
        <MetricCard label="F1 score" value="86.59" suffix="%" detail="+3.44 pp vs baseline" icon={Activity} delay={0.08} />
        <MetricCard label="Positive-class recall" value="95.76" suffix="%" detail="113 / 118 in this split" icon={ShieldCheck} delay={0.14} />
        <MetricCard label="ROC-AUC" value="92.38" suffix="%" detail="Ranking metric · test set" icon={TrendingUp} delay={0.2} />
      </div>
      <div className="notice-strip"><div className="notice-icon"><Info size={17} /></div><div><strong>Read the metrics in context</strong><p>These are exploratory results from 263 test rows representing 149 unique feature profiles. Repeated profiles and a transductive-style graph limit claims about unseen clinical populations.</p></div><button className="notice-action" onClick={() => onNavigate('model-lab')}>Methodology <ArrowRight size={14} /></button></div>

      <div className="content-grid content-grid--main">
        <section className="surface-card model-comparison-card">
          <SectionTitle eyebrow="BENCHMARKS" title="The model landscape" description="Same reported holdout · current experiment" action={<button className="icon-button" aria-label="Open model lab" onClick={() => onNavigate('model-lab')}><ArrowUpRight size={17} /></button>} />
          <div className="model-row model-row--highlight">
            <div className="model-identity"><div className="model-symbol model-symbol--graph"><Network size={19} /></div><span><strong>GraphSAGE</strong><small>Graph neural network</small></span><span className="model-tag">CANDIDATE</span></div>
            <div className="model-score"><strong>86.59<span>%</span></strong><small>F1 score</small></div>
            <div className="model-score"><strong>92.38<span>%</span></strong><small>ROC-AUC</small></div>
            <div className="model-score"><strong>86.69<span>%</span></strong><small>Accuracy</small></div>
          </div>
          <div className="model-row">
            <div className="model-identity"><div className="model-symbol model-symbol--linear"><TrendingUp size={19} /></div><span><strong>Logistic Regression</strong><small>Tabular baseline</small></span><span className="model-tag model-tag--quiet">BASELINE</span></div>
            <div className="model-score"><strong>83.15<span>%</span></strong><small>F1 score</small></div>
            <div className="model-score"><strong>92.24<span>%</span></strong><small>ROC-AUC</small></div>
            <div className="model-score"><strong>82.89<span>%</span></strong><small>Accuracy</small></div>
          </div>
          <div className="comparison-footer"><span><i className="legend-dot legend-dot--mint" /> GraphSAGE</span><span><i className="legend-dot legend-dot--purple" /> Logistic Regression</span><button className="text-link" onClick={() => onNavigate('model-lab')}>View all metrics <ArrowRight size={13} /></button></div>
        </section>

        <section className="surface-card evidence-card">
          <div className="evidence-card-top"><div><div className="eyebrow">EXPLANATION LAYER</div><h3>Grounded by evidence</h3><p>A prediction is a score. An explanation needs sources.</p></div><div className="evidence-orb"><BookOpen size={20} /></div></div>
          <div className="evidence-flow">
            <div className="flow-step"><span className="flow-step-number">01</span><span><b>Model output</b><small>Fixed class score + version</small></span><Check size={15} /></div>
            <div className="flow-connector" />
            <div className="flow-step"><span className="flow-step-number">02</span><span><b>Retrieve evidence</b><small>Approved source snippets</small></span><Check size={15} /></div>
            <div className="flow-connector" />
            <div className="flow-step"><span className="flow-step-number">03</span><span><b>Explain with citations</b><small>Limitations stay visible</small></span><Sparkles size={15} /></div>
          </div>
          <button className="button button-outline button-full" onClick={() => onNavigate('knowledge')}>Explore knowledge layer <ArrowRight size={15} /></button>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="surface-card activity-card">
          <SectionTitle eyebrow="LATEST ACTIVITY" title="Research timeline" action={<span className="tiny-status"><span className="live-dot" /> LIVE WORKSPACE</span>} />
          <div className="timeline-item"><div className="timeline-marker timeline-marker--mint"><Check size={13} /></div><div className="timeline-copy"><b>Source conflict audit completed</b><small>Excluded two source groups implicated in opposite labels</small></div><time>Step 04</time></div>
          <div className="timeline-item"><div className="timeline-marker timeline-marker--violet"><GitBranch size={13} /></div><div className="timeline-copy"><b>Group-aware split rebuilt</b><small>1,280 complete-profile rows · group overlap checks passed</small></div><time>Step 05</time></div>
          <div className="timeline-item"><div className="timeline-marker timeline-marker--coral"><FileChartColumn size={13} /></div><div className="timeline-copy"><b>Model comparison recorded</b><small>GraphSAGE and Logistic Regression evaluated</small></div><time>Step 19</time></div>
        </section>
        <section className="surface-card protocol-card">
          <div className="protocol-top"><div className="protocol-icon"><LockKeyhole size={17} /></div><span className="protocol-label">PROTOCOL NOTE</span></div>
          <h3>Evidence over overclaiming.</h3><p>Model scores describe how this experiment behaved on its chosen split. They are not calibrated medical risk and do not replace professional assessment.</p>
          <button className="text-link" onClick={() => onNavigate('model-lab')}>Read methodology <ArrowRight size={14} /></button>
        </section>
      </div>
      <Footer />
    </motion.div>
  );
}

function FormField({ field, value, onChange }) {
  const shared = { id: `field-${field.name}`, name: field.name, value, onChange: (event) => onChange(field.name, event.target.value), required: Boolean(field.required), 'aria-describedby': `help-${field.name}` };
  return (
    <div className="form-field">
      <label htmlFor={`field-${field.name}`}>{field.label}{field.required && <i>*</i>}</label>
      <div className="input-shell">
        {field.type === 'select' || field.type === 'selectNullable' ? (
          <select {...shared}>
            {field.type === 'selectNullable' && <option value="">Not provided</option>}
            {field.options.map(([v, text]) => <option value={v} key={v}>{text}</option>)}
          </select>
        ) : (
          <><input {...shared} type="number" min={field.min} max={field.max} step={field.step || '1'} placeholder="—" /><span className="input-unit">{field.unit}</span></>
        )}
        {(field.type === 'select' || field.type === 'selectNullable') && <ChevronDown size={15} className="select-chevron" />}
      </div>
      <small id={`help-${field.name}`}>{field.help}</small>
    </div>
  );
}

function ScoreResult({ prediction, onExplain, explanation, explanationLoading }) {
  const items = prediction?.predictions || [];
  return (
    <div className="result-stack">
      <div className="result-panel surface-card">
        <div className="result-panel-head"><div><div className="eyebrow">INFERENCE RESPONSE</div><h3>Prediction overview</h3></div>{prediction?.mode === 'demo' ? <span className="demo-badge">SIMULATED</span> : <span className="live-response-badge"><span className="live-dot" /> API RESULT</span>}</div>
        {prediction?.mode === 'demo' && <div className="demo-warning"><Info size={15} /> Preview payload only — no trained model was called. Connect the FastAPI backend for real inference.</div>}
        {items.map((item) => (
          <div className="prediction-result" key={item.model}>
            <div className="prediction-result-top"><span className={`result-model-icon ${item.model === 'graphsage' ? 'result-model-icon--mint' : 'result-model-icon--purple'}`}>{item.model === 'graphsage' ? <Network size={17} /> : <TrendingUp size={17} />}</span><span className="prediction-model-name"><b>{item.model === 'graphsage' ? 'GraphSAGE' : 'Logistic Regression'}</b><small>{item.model_version || 'Model version not supplied'}</small></span><span className={`class-chip ${item.predicted_class === 1 ? 'class-chip--one' : 'class-chip--zero'}`}>Class {item.predicted_class}</span></div>
            <div className="score-track-label"><span>Class-1 model score</span><strong>{(Number(item.probability) * 100).toFixed(1)}%</strong></div>
            <div className="score-track"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, Number(item.probability) * 100))}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} className={`score-track-fill ${item.model === 'graphsage' ? 'score-track-fill--mint' : 'score-track-fill--purple'}`} /></div>
            <p className="result-subnote">Threshold: {item.threshold ?? 0.5}. Class 1 means disease recorded in the dataset, not a clinical diagnosis.</p>
          </div>
        ))}
        {prediction?.disclaimer && <p className="result-disclaimer"><ShieldAlert size={14} />{prediction.disclaimer}</p>}
        <button className="button button-primary button-full" onClick={onExplain} disabled={explanationLoading}>{explanationLoading ? <><span className="spinner" /> Preparing explanation…</> : <><Sparkles size={16} /> Explain with evidence <ArrowRight size={15} /></>}</button>
      </div>
      {explanation && <div className="explanation-panel surface-card"><div className="explanation-heading"><span className="explanation-icon"><MessageSquareText size={16} /></span><span><b>Explanation</b><small>{explanation.mode === 'demo' ? 'Preview · no LLM request made' : `Grounding: ${explanation.grounding_status || 'not specified'}`}</small></span></div><p>{explanation.summary}</p>{explanation.evidence?.length > 0 && <div className="source-citations">{explanation.evidence.map((e) => <a href={e.url || '#'} target={e.url ? '_blank' : undefined} rel="noreferrer" key={e.source_id}>{e.title} <ArrowUpRight size={12} /></a>)}</div>}<div className="explanation-limit"><Info size={14} />{(explanation.limitations || ['No clinical decision support is provided.']).join(' ')}</div></div>}
      {!prediction && <div className="empty-result surface-card"><div className="empty-illustration"><HeartPulse size={25} /></div><div className="eyebrow">AWAITING INPUT</div><h3>Your assessment will appear here.</h3><p>Enter the dataset-coded clinical fields and submit to see the response shape and explanation flow.</p><div className="empty-mini-stats"><span><b>11</b><small>input fields</small></span><span><b>02</b><small>models</small></span><span><b>01</b><small>evidence layer</small></span></div></div>}
    </div>
  );
}

function Assessment({ onNavigate }) {
  const [form, setForm] = useState({ ...samplePatient });
  const [selectedModel, setSelectedModel] = useState('compare');
  const [prediction, setPrediction] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const preparePatient = () => Object.fromEntries(fields.map((field) => {
    const raw = form[field.name];
    return [field.name, raw === '' || raw === undefined ? null : Number(raw)];
  }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true); setError(''); setExplanation(null);
    try {
      const payload = preparePatient();
      const result = await createPrediction(payload, selectedModel);
      setPrediction(result);
    } catch (err) {
      setError(`${err.message}${err.requestId ? ` · Request ID ${err.requestId}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const explain = async () => {
    if (!prediction?.prediction_id) return;
    setExplanationLoading(true); setError('');
    try { setExplanation(await createExplanation(prediction.prediction_id)); }
    catch (err) { setError(`Prediction returned, but explanation failed: ${err.message}`); }
    finally { setExplanationLoading(false); }
  };

  return (
    <motion.div className="page-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
      <div className="page-heading-row page-heading-row--simple"><div><div className="eyebrow"><span className="eyebrow-dot" /> MODEL INTERACTION / 01</div><h1>Risk <span>assessment.</span></h1><p className="page-lede">Structured clinical inputs in. Model response and evidence flow out.</p></div><button className="button button-outline" onClick={() => onNavigate('model-lab')}><FileChartColumn size={16} /> Evaluation details</button></div>
      <div className="assessment-callout"><div className="assessment-callout-icon"><ShieldAlert size={18} /></div><div><b>Research interface — not medical advice</b><p>Use de-identified, dataset-shaped example records only. The result represents a model output for a recorded dataset label, not an individual's calibrated clinical risk.</p></div><span className="mono">SCHEMA 1.0</span></div>
      <div className="assessment-layout">
        <form className="surface-card assessment-form" onSubmit={submit}>
          <div className="form-header"><div><div className="eyebrow">PATIENT FEATURE VECTOR</div><h2>Clinical inputs</h2><p>Fields follow the current 11-feature model schema.</p></div><button type="button" className="sample-button" onClick={() => { setForm({ ...samplePatient }); setError(''); }}><Sparkles size={14} /> Load sample</button></div>
          <div className="form-grid">
            {fields.map((field) => <FormField key={field.name} field={field} value={form[field.name]} onChange={updateField} />)}
          </div>
          <div className="excluded-fields"><div className="excluded-icon"><Info size={14} /></div><div><b>Two fields intentionally excluded</b><p><code>ca</code> and <code>thal</code> are not part of this experiment's input contract because their availability and encodings varied significantly across retained data sources.</p></div></div>
          <div className="form-footer"><span><LockKeyhole size={14} /> Keep identifiers out of feature payloads</span><button type="submit" className="button button-primary" disabled={loading}>{loading ? <><span className="spinner" /> Running…</> : <><Zap size={16} /> Run prediction <ArrowRight size={15} /></>}</button></div>
          <div className="model-select-row"><label htmlFor="selectedModel">Model requested</label><select id="selectedModel" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}><option value="compare">Compare both models</option><option value="graphsage">GraphSAGE</option><option value="logistic_regression">Logistic Regression</option></select><small>Uses API endpoint when configured; otherwise the result is explicitly simulated.</small></div>
          {error && <div className="inline-error"><ShieldAlert size={15} />{error}</div>}
        </form>
        <aside className="assessment-output"><ScoreResult prediction={prediction} onExplain={explain} explanation={explanation} explanationLoading={explanationLoading} /><div className="mini-graph-card"><div><div className="eyebrow">CONTEXT GRAPH</div><h3>Similarity network</h3><p>Graph connections are built from transformed feature similarity — not from the target label.</p></div><div className="mini-graph-visual"><NeuralScene compact /></div></div></aside>
      </div>
      <Footer />
    </motion.div>
  );
}

function ModelLab({ onNavigate }) {
  const [metric, setMetric] = useState('f1');
  const [view, setView] = useState('row');
  const names = { accuracy: 'Accuracy', precision: 'Precision', recall: 'Recall', f1: 'F1 score', auc: 'ROC-AUC' };
  const displayVal = (model) => view === 'profile' ? reportedMetrics[model][`profile${metric === 'auc' ? 'Auc' : metric.charAt(0).toUpperCase() + metric.slice(1)}`] : reportedMetrics[model][metric];
  const graph = displayVal('graphsage'); const lr = displayVal('logistic_regression');
  return (
    <motion.div className="page-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
      <div className="page-heading-row page-heading-row--simple"><div><div className="eyebrow"><span className="eyebrow-dot" /> EXPERIMENTS / MODEL LAB</div><h1>Proof, not <span>promises.</span></h1><p className="page-lede">Inspect the current holdout snapshot and understand where the GNN helps — and where it does not.</p></div><div className="lab-status"><span className="live-dot" /> REPORTED RUN / CURRENT SNAPSHOT</div></div>
      <div className="model-lab-hero surface-card"><div className="lab-copy"><div className="eyebrow">SELECTED CANDIDATE</div><h2>GraphSAGE <span>·</span> k = 5</h2><p>Two neighborhood-aggregation layers with a 32-dimensional hidden representation. This configuration was selected from the current grouped experiment; model results are exploratory.</p><div className="lab-chip-row"><span><Network size={13} /> Graph neural network</span><span><GitBranch size={13} /> Cosine k-nearest neighbors</span><span><Database size={13} /> 21 processed features</span></div><button className="button button-primary" onClick={() => onNavigate('assessment')}>Try an assessment <ArrowRight size={15} /></button></div><div className="lab-art"><NeuralScene compact /><div className="lab-art-caption"><span>FEATURE GRAPH</span><span className="mono">G = (V, E)</span></div></div></div>
      <div className="section-title-row section-title-row--spaced"><div><div className="eyebrow">PERFORMANCE COMPARISON</div><h2>Baseline vs. graph model</h2><p>Toggle between row-level and unique-profile-level test results.</p></div><div className="segmented-control"><button className={view === 'row' ? 'active' : ''} onClick={() => setView('row')}>Row-level</button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>Unique profiles</button></div></div>
      <div className="lab-metrics-layout">
        <section className="surface-card metric-explorer"><div className="metric-explorer-head"><div><div className="eyebrow">METRIC EXPLORER</div><h3>{names[metric]}</h3></div><span className="metric-delta">{graph >= lr ? '+' : ''}{(graph - lr).toFixed(2)} pp</span></div><div className="metric-selector" role="group" aria-label="Select metric">{Object.entries(names).map(([key, label]) => <button key={key} className={metric === key ? 'selected' : ''} onClick={() => setMetric(key)}>{label}</button>)}</div><div className="bar-compare"><div className="bar-label"><span><i className="legend-dot legend-dot--mint" /> GraphSAGE</span><strong>{graph.toFixed(2)}%</strong></div><div className="bar-track"><motion.div initial={{ width: 0 }} animate={{ width: `${graph}%` }} className="bar-fill bar-fill--mint" /></div><div className="bar-label"><span><i className="legend-dot legend-dot--purple" /> Logistic Regression</span><strong>{lr.toFixed(2)}%</strong></div><div className="bar-track"><motion.div initial={{ width: 0 }} animate={{ width: `${lr}%` }} className="bar-fill bar-fill--purple" /></div><div className="bar-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div><div className="metric-insight"><Sparkles size={15} /><p>{metric === 'auc' ? 'AUC differs only slightly. The evidence does not establish a large ranking advantage for the GNN.' : metric === 'recall' ? 'Recall is high in this reported split; precision and false positives still matter when interpreting the output.' : graph > lr ? 'GraphSAGE is higher on this reported metric. Keep the split and repeated-profile limitations visible.' : 'The baseline remains competitive; a lower metric should be reported honestly, not hidden.'}</p></div></section>
        <section className="surface-card metrics-table-card"><div className="eyebrow">REPORTED TEST SNAPSHOT</div><h3>All metrics</h3><p className="table-context">{view === 'row' ? '263 test rows · 149 unique profiles' : 'One representative row per unique profile'}</p><div className="responsive-table"><table><thead><tr><th>Metric</th><th>GraphSAGE</th><th>LR baseline</th></tr></thead><tbody>{[['Accuracy', 'accuracy'], ['Precision', 'precision'], ['Recall', 'recall'], ['F1 score', 'f1'], ['ROC-AUC', 'auc']].map(([label, key]) => <tr key={key}><td>{label}</td><td className="table-best">{(view === 'profile' ? reportedMetrics.graphsage[`profile${key === 'auc' ? 'Auc' : key.charAt(0).toUpperCase() + key.slice(1)}`] : reportedMetrics.graphsage[key]).toFixed(2)}%</td><td>{(view === 'profile' ? reportedMetrics.logistic_regression[`profile${key === 'auc' ? 'Auc' : key.charAt(0).toUpperCase() + key.slice(1)}`] : reportedMetrics.logistic_regression[key]).toFixed(2)}%</td></tr>)}</tbody></table></div><div className="table-note"><Info size={14} /> Results reflect the previously reported experiment. This page does not recompute model metrics.</div></section>
      </div>
      <div className="protocol-grid">
        <div className="protocol-note-card"><span className="protocol-note-icon"><Layers3 size={17} /></span><div><b>Evaluation protocol</b><p>Group-aware split by an eight-field clinical profile; matching profiles were kept in one split.</p></div></div>
        <div className="protocol-note-card"><span className="protocol-note-icon protocol-note-icon--violet"><Database size={17} /></span><div><b>Dataset caveat</b><p>Five retained sources, source-dependent missingness and 1,280 complete-profile rows used in the reported grouped experiment.</p></div></div>
        <div className="protocol-note-card"><span className="protocol-note-icon protocol-note-icon--coral"><ShieldAlert size={17} /></span><div><b>Interpretation</b><p>Transductive-style graph evaluation; repeated profiles mean row counts are not independent patient counts.</p></div></div>
      </div>
      <Footer />
    </motion.div>
  );
}

function Knowledge({ onNavigate }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setSources(await getKnowledgeSources()); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return (
    <motion.div className="page-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
      <div className="page-heading-row page-heading-row--simple"><div><div className="eyebrow"><span className="eyebrow-dot" /> RETRIEVAL / KNOWLEDGE LAYER</div><h1>Evidence with <span>receipts.</span></h1><p className="page-lede">The LLM should explain the model output using approved sources, not improvise clinical facts.</p></div><button className="button button-primary" onClick={load} disabled={loading}><Database size={16} /> {loading ? 'Loading…' : 'Load source catalog'}</button></div>
      <div className="knowledge-hero"><div className="knowledge-hero-copy"><div className="eyebrow">RAG PIPELINE</div><h2>Retrieve first.<br /><em>Explain second.</em></h2><p>Separate model inference from language generation. Keep evidence retrieval, source citations and limitations visible in the response contract.</p><div className="knowledge-stats"><span><b>01</b><small>Prediction</small></span><span><b>02</b><small>Retrieval</small></span><span><b>03</b><small>Explanation</small></span></div></div><div className="knowledge-visual"><div className="doc-orbit doc-orbit--one" /><div className="doc-orbit doc-orbit--two" /><div className="doc-card doc-card--back"><div /><div /><div /></div><div className="doc-card doc-card--front"><div className="doc-card-icon"><BookOpen size={19} /></div><span>KNOWLEDGE CHUNK</span><b>Evidence reference</b><small>source_id · chunk_id</small><div className="doc-lines"><i /><i /><i /></div><div className="doc-verified"><BadgeCheck size={13} /> APPROVED SOURCE</div></div><div className="doc-star doc-star--a">✳</div><div className="doc-star doc-star--b">✦</div></div></div>
      <div className="section-title-row section-title-row--spaced"><div><div className="eyebrow">SOURCE CATALOG</div><h2>Evidence registry</h2><p>Showing sample metadata until the backend source catalog is connected.</p></div><span className={`api-state ${isApiConfigured ? 'api-state--configured' : ''}`}><span className="live-dot" />{isApiConfigured ? 'API configured' : 'Preview catalog'}</span></div>
      {error && <div className="inline-error"><ShieldAlert size={15} />{error}</div>}
      <div className="source-grid">{(sources?.sources || [
        { source_id: 'uci-heart-disease-doc', title: 'UCI Heart Disease dataset documentation', source_type: 'public_dataset', url: 'https://archive.ics.uci.edu/dataset/45/heart+disease', status: 'reference' },
        { source_id: 'project-model-card', title: 'CardioGraph model card', source_type: 'project_document', url: null, status: 'local' },
        { source_id: 'evidence-index', title: 'Approved clinical evidence index', source_type: 'knowledge_index', url: null, status: 'not-connected' },
      ]).map((source, idx) => <motion.article key={source.source_id} className="source-card surface-card" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.06 }}><div className="source-card-head"><div className={`source-icon source-icon--${idx % 3}`}><BookOpen size={18} /></div><span className="source-status"><span className="live-dot" />{source.status || 'status unknown'}</span></div><div className="source-type">{String(source.source_type || 'source').replaceAll('_', ' ').toUpperCase()}</div><h3>{source.title}</h3><p className="mono source-id">{source.source_id}</p><div className="source-card-foot">{source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open reference <ArrowUpRight size={13} /></a> : <span>Backend source required</span>}<ChevronDown size={15} /></div></motion.article>)}</div>
      <div className="rag-policy surface-card"><div className="rag-policy-icon"><ShieldCheck size={18} /></div><div><b>Grounding policy</b><p>Every factual health statement should be supported by retrieved evidence. If the retriever returns nothing useful, the API should say evidence is unavailable rather than invent a citation. Model-specific feature attribution must come from a separate explanation method.</p></div><button className="text-link" onClick={() => onNavigate('model-lab')}>Model limitations <ArrowRight size={14} /></button></div>
      <Footer />
    </motion.div>
  );
}

function Footer() {
  return <footer className="app-footer"><span>© CARDIOGRAPH <i /> RESEARCH STUDIO</span><span><ShieldAlert size={13} /> Educational prototype · Not for clinical use</span><a href="https://archive.ics.uci.edu/dataset/45/heart+disease" target="_blank" rel="noreferrer">Dataset reference <ArrowUpRight size={12} /></a></footer>;
}

export default function App() {
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const content = useMemo(() => {
    switch (active) {
      case 'assessment': return <Assessment onNavigate={setActive} />;
      case 'model-lab': return <ModelLab onNavigate={setActive} />;
      case 'knowledge': return <Knowledge onNavigate={setActive} />;
      default: return <Overview onNavigate={setActive} />;
    }
  }, [active]);

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" /><div className="ambient ambient--two" />
      <Sidebar active={active} onNavigate={setActive} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-shell">
        <Topbar active={active} onToggleSidebar={() => setMobileOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <AnimatePresence mode="wait"><div key={active} className="route-container">{content}</div></AnimatePresence>
      </main>
      <AnimatePresence>
        {searchOpen && <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSearchOpen(false)}><motion.div className="search-modal" initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}><Search size={18} /><input autoFocus placeholder="Search sections…" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} /><button className="icon-button" onClick={() => setSearchOpen(false)}><X size={17} /></button><div className="search-results">{navItems.filter((n) => n.label.toLowerCase().includes(globalSearch.toLowerCase())).map((n) => <button key={n.id} onClick={() => { setActive(n.id); setSearchOpen(false); }}><n.icon size={16} />{n.label}<ArrowRight size={14} /></button>)}</div></motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
