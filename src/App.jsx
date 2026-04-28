import React, { useEffect, useMemo, useState } from 'react'
import { CubeLogo } from './CubeLogo.jsx'
import { DEMO_SCENARIO } from './demoScenario.js'
import {
  framingPrompt,
  missingOptionPrompt,
  dimensionsPrompt,
  readoutPrompt,
  parseDimensions,
  parseReadout
} from './prompts.js'

const STEP_LABELS = ['Decision', 'Options', 'Dimensions', 'Ratings', 'Read']

async function callClaude({ system, user }) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: user }],
      max_tokens: 600
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data.text
}

function scoreRating(r, direction) {
  if (r == null) return 0
  const n = direction === 'down' ? 6 - r : r
  return n * n
}

function totalScore(option, dimensions, ratings) {
  return dimensions.reduce((sum, dim, di) => {
    const r = ratings?.[option.id]?.[di]
    return sum + scoreRating(r, dim.direction)
  }, 0)
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ff-theme') || 'dark')
  const [step, setStep] = useState(1)
  const [decision, setDecision] = useState('')
  const [framing, setFraming] = useState('')
  const [options, setOptions] = useState([
    { id: 1, name: '' },
    { id: 2, name: '' }
  ])
  const [missingOption, setMissingOption] = useState('')
  const [dimensions, setDimensions] = useState([])
  const [ratings, setRatings] = useState({})
  const [readout, setReadout] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ff-theme', theme)
  }, [theme])

  const cleanOptions = useMemo(
    () => options.filter(o => o.name.trim().length > 0),
    [options]
  )

  const ranked = useMemo(() => {
    return cleanOptions
      .map(o => ({ ...o, score: totalScore(o, dimensions, ratings) }))
      .sort((a, b) => b.score - a.score)
  }, [cleanOptions, dimensions, ratings])

  const submitStep1 = async () => {
    if (!decision.trim()) return
    setError(null); setLoading(true)
    try {
      const { system, user } = framingPrompt(decision)
      const text = await callClaude({ system, user })
      setFraming(text.trim())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const submitStep2 = async () => {
    if (cleanOptions.length < 2) return
    setError(null); setLoading(true)
    try {
      const { system, user } = missingOptionPrompt(decision, cleanOptions.map(o => o.name))
      const text = await callClaude({ system, user })
      setMissingOption(text.trim())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const requestDimensions = async () => {
    setError(null); setLoading(true)
    try {
      const { system, user } = dimensionsPrompt(decision, cleanOptions.map(o => o.name))
      const text = await callClaude({ system, user })
      const parsed = parseDimensions(text)
      setDimensions(parsed)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const submitStep5 = async () => {
    setError(null); setLoading(true)
    try {
      const { system, user } = readoutPrompt({
        decision,
        options: cleanOptions.map(o => o.name),
        dimensions,
        ranked: ranked.map(r => ({ name: r.name, score: r.score })),
        ratings: cleanOptions.map(o => ({
          option: o.name,
          scores: dimensions.map((d, di) => ({
            dim: d.name, direction: d.direction, rating: ratings?.[o.id]?.[di] ?? null
          }))
        }))
      })
      const text = await callClaude({ system, user })
      setReadout(parseReadout(text))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const advance = async () => {
    if (step === 1) {
      if (!framing) { await submitStep1(); return }
      setStep(2); return
    }
    if (step === 2) {
      if (cleanOptions.length < 2) return
      if (!missingOption) { await submitStep2(); return }
      setStep(3)
      if (dimensions.length === 0) await requestDimensions()
      return
    }
    if (step === 3) {
      if (dimensions.length < 2) return
      setStep(4); return
    }
    if (step === 4) {
      setStep(5)
      await submitStep5()
      return
    }
  }

  const back = () => { if (step > 1) setStep(step - 1) }

  const loadDemo = () => {
    setDecision(DEMO_SCENARIO.decision)
    setFraming(DEMO_SCENARIO.framing)
    setOptions(DEMO_SCENARIO.options.map((name, i) => ({ id: i + 1, name })))
    setMissingOption(DEMO_SCENARIO.missingOption)
    setDimensions(DEMO_SCENARIO.dimensions)
    setRatings(DEMO_SCENARIO.ratings)
    setReadout(null)
    setStep(4)
  }

  const reset = () => {
    setStep(1); setDecision(''); setFraming('')
    setOptions([{ id: 1, name: '' }, { id: 2, name: '' }])
    setMissingOption(''); setDimensions([]); setRatings({})
    setReadout(null); setError(null)
  }

  const updateOption = (id, name) => {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, name } : o))
  }
  const addOption = () => {
    if (options.length >= 5) return
    setOptions(prev => [...prev, { id: Date.now(), name: '' }])
  }
  const removeOption = (id) => {
    if (options.length <= 2) return
    setOptions(prev => prev.filter(o => o.id !== id))
    setRatings(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  const updateDim = (i, patch) => {
    setDimensions(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }
  const toggleDir = (i) => {
    updateDim(i, { direction: dimensions[i].direction === 'up' ? 'down' : 'up' })
  }

  const setRating = (oid, di, value) => {
    setRatings(prev => ({
      ...prev,
      [oid]: { ...(prev[oid] || {}), [di]: value }
    }))
  }

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <CubeLogo size={28} />
          <div className="brand-text">
            <strong>Forcing Function</strong> · EV Calculator
          </div>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="toggle theme"
        >
          {theme === 'dark' ? '☾  Dark' : '☀  Light'}
        </button>
      </div>

      <div className="progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={5}>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className={`progress-seg ${n <= step ? 'active' : ''}`} />
        ))}
      </div>
      <div className="progress-labels">
        {STEP_LABELS.map((label, i) => (
          <span key={label} className={i + 1 === step ? 'current' : ''}>{label}</span>
        ))}
      </div>

      <div style={{ height: 32 }} />

      {error && <div className="error">⚠ {error}</div>}

      {step === 1 && (
        <Step1
          decision={decision}
          setDecision={setDecision}
          framing={framing}
          loading={loading}
          onSubmit={submitStep1}
          onAdvance={() => setStep(2)}
          onLoadDemo={loadDemo}
          onReframe={() => setFraming('')}
        />
      )}

      {step === 2 && (
        <Step2
          options={options}
          updateOption={updateOption}
          addOption={addOption}
          removeOption={removeOption}
          missingOption={missingOption}
          loading={loading}
          onSubmit={submitStep2}
          onAdvance={async () => { setStep(3); if (dimensions.length === 0) await requestDimensions() }}
          onClear={() => setMissingOption('')}
        />
      )}

      {step === 3 && (
        <Step3
          dimensions={dimensions}
          updateDim={updateDim}
          toggleDir={toggleDir}
          loading={loading}
          onRegen={requestDimensions}
          onAdvance={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <Step4
          options={cleanOptions}
          dimensions={dimensions}
          ratings={ratings}
          setRating={setRating}
          ranked={ranked}
          onAdvance={async () => { setStep(5); await submitStep5() }}
        />
      )}

      {step === 5 && (
        <Step5
          ranked={ranked}
          readout={readout}
          loading={loading}
          onReset={reset}
          onRegen={submitStep5}
        />
      )}

      <div className="actions">
        <button className="ghost" onClick={back} disabled={step === 1}>← Back</button>
        {step < 5 ? (
          <button
            className="primary"
            onClick={advance}
            disabled={
              loading ||
              (step === 1 && !decision.trim()) ||
              (step === 2 && cleanOptions.length < 2) ||
              (step === 3 && dimensions.length < 2)
            }
          >
            {loading ? <Loading /> : (
              step === 1 && !framing ? 'Frame this →' :
              step === 2 && !missingOption ? 'Surface missing →' :
              'Next →'
            )}
          </button>
        ) : (
          <button className="ghost" onClick={reset}>Start over</button>
        )}
      </div>
    </div>
  )
}

function Loading() {
  return <span className="loading"><span className="dot" /> thinking</span>
}

function AIBlock({ tag, children }) {
  return (
    <div className="ai-block">
      {tag && <span className="ai-tag">{tag}</span>}
      {children}
    </div>
  )
}

function Step1({ decision, setDecision, framing, loading, onSubmit, onAdvance, onLoadDemo, onReframe }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 01 / Decision</div>
      <h1 className="step-title">What are you actually deciding?</h1>
      <p className="step-sub">One real decision you're sitting with. Write it the way you'd say it out loud.</p>

      <div className="field">
        <textarea
          value={decision}
          onChange={e => setDecision(e.target.value)}
          placeholder="e.g. Should we expand into enterprise next quarter, or double down on our current segment?"
          autoFocus
        />
      </div>

      {framing && (
        <AIBlock tag="Reflected back">
          {framing}
          <div style={{ marginTop: 12 }}>
            <button className="link-btn" onClick={onReframe}>Reframe →</button>
          </div>
        </AIBlock>
      )}

      <div className="hint">
        No live API key? <button className="link-btn" onClick={onLoadDemo}>Load demo scenario →</button>
      </div>
    </div>
  )
}

function Step2({ options, updateOption, addOption, removeOption, missingOption, loading, onSubmit, onAdvance, onClear }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 02 / Options</div>
      <h1 className="step-title">Name the moves on the table.</h1>
      <p className="step-sub">2 to 5 options. Be concrete — "do X" not "explore Y".</p>

      <div className="field">
        {options.map((o, i) => (
          <div key={o.id} className="option-row">
            <span className="badge">{String.fromCharCode(65 + i)}</span>
            <input
              value={o.name}
              onChange={e => updateOption(o.id, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
            />
            {options.length > 2 && (
              <button className="ghost" onClick={() => removeOption(o.id)} aria-label="remove">✕</button>
            )}
          </div>
        ))}
        {options.length < 5 && (
          <button className="link-btn" onClick={addOption}>+ Add option</button>
        )}
      </div>

      {missingOption && (
        <AIBlock tag="One you didn't name">
          {missingOption}
          <div style={{ marginTop: 12 }}>
            <button className="link-btn" onClick={onClear}>Surface another →</button>
          </div>
        </AIBlock>
      )}
    </div>
  )
}

function Step3({ dimensions, updateDim, toggleDir, loading, onRegen, onAdvance }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 03 / Dimensions</div>
      <h1 className="step-title">What actually matters here?</h1>
      <p className="step-sub">Four dimensions, tuned to this decision. Edit names, flip direction.</p>

      {loading && dimensions.length === 0 && (
        <AIBlock tag="Proposing"><Loading /></AIBlock>
      )}

      {dimensions.length > 0 && (
        <div className="field">
          {dimensions.map((d, i) => (
            <div key={i} className="dim-row">
              <input
                value={d.name}
                onChange={e => updateDim(i, { name: e.target.value })}
              />
              <button className="dim-direction" onClick={() => toggleDir(i)}>
                <span className="arrow">{d.direction === 'up' ? '↑' : '↓'}</span>
                {d.direction === 'up' ? 'More = better' : 'Less = better'}
              </button>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <button className="link-btn" onClick={onRegen} disabled={loading}>
              {loading ? '…' : '↻ Regenerate dimensions'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Step4({ options, dimensions, ratings, setRating, ranked }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 04 / Ratings</div>
      <h1 className="step-title">Score each option, 1 to 5.</h1>
      <p className="step-sub">Live exponential weighting — gut difference between a 3 and a 5 is bigger than it looks.</p>

      <div className="rate-table">
        {options.map(o => {
          const score = ranked.find(r => r.id === o.id)?.score ?? 0
          const isTop = ranked[0]?.id === o.id && score > 0
          return (
            <div key={o.id} className="rate-row">
              <div>
                <div className="rate-option-name">{o.name}</div>
                <div className="rate-grid">
                  {dimensions.map((d, di) => (
                    <div key={di} className="rate-dim-row">
                      <div className="rate-dim-label">
                        <span className="arrow">{d.direction === 'up' ? '↑' : '↓'}</span>
                        {d.name}
                      </div>
                      <div className="rate-pills">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            className={`rate-pill ${ratings?.[o.id]?.[di] === n ? 'selected' : ''}`}
                            onClick={() => setRating(o.id, di, n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rate-option-score" style={{ color: isTop ? 'var(--gold)' : 'var(--fg-dim)' }}>
                {score}
              </div>
            </div>
          )
        })}
      </div>

      <p className="hint">Score = Σ rating² (inverted for ↓ dims). Updates live.</p>
    </div>
  )
}

function Step5({ ranked, readout, loading, onReset, onRegen }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 05 / Read</div>
      <h1 className="step-title">Here's what the numbers say.</h1>
      <p className="step-sub">Ranked by weighted score. Then three sentences on what you're really choosing.</p>

      <div className="rank-list">
        {ranked.map((o, i) => (
          <div key={o.id} className={`rank-item ${i === 0 ? 'top' : ''}`}>
            <div className="rank-num">{i + 1}</div>
            <div className="rank-name">{o.name}</div>
            <div className="rank-score">{o.score}</div>
          </div>
        ))}
      </div>

      <div className="divider" />

      {loading && !readout && <AIBlock tag="Reading"><Loading /></AIBlock>}

      {readout && (
        <div className="read-block">
          <div className="read-line">
            <div className="read-tag">Value</div>
            <div className="read-text">{readout.value}</div>
          </div>
          <div className="read-line">
            <div className="read-tag">Crux</div>
            <div className="read-text">{readout.crux}</div>
          </div>
          <div className="read-line">
            <div className="read-tag">Risk</div>
            <div className="read-text">{readout.risk}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="link-btn" onClick={onRegen} disabled={loading}>↻ Regenerate read</button>
          </div>
        </div>
      )}
    </div>
  )
}
