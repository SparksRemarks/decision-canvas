import React, { useEffect, useMemo, useState } from 'react'
import { CubeLogo } from './CubeLogo.jsx'
import { DEMO_SCENARIO } from './demoScenario.js'
import {
  contextQuestionsPrompt,
  framingPrompt,
  missingOptionPrompt,
  dimensionsPrompt,
  analysisPrompt,
  parseQuestions,
  parseDimensions,
  parseAnalysis
} from './prompts.js'

const STEP_LABELS = ['Decision', 'Options', 'Factors', 'Ratings', 'Analysis']

async function callClaude({ system, user, messages, max_tokens = 600 }) {
  const body = {
    system,
    messages: messages || [{ role: 'user', content: user }],
    max_tokens
  }
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data.text
}

function totalScore(option, dimensions, ratings) {
  return dimensions.reduce((sum, _, di) => {
    const r = ratings?.[option.id]?.[di]
    if (r == null) return sum
    return sum + r * r
  }, 0)
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ff-theme') || 'dark')
  const [step, setStep] = useState(1)

  // Step 1
  const [decision, setDecision] = useState('')
  const [contextQuestions, setContextQuestions] = useState([])
  const [contextText, setContextText] = useState('')
  const [framing, setFraming] = useState('')

  // Step 2
  const [options, setOptions] = useState([
    { id: 1, name: '' },
    { id: 2, name: '' }
  ])
  const [missingOption, setMissingOption] = useState('')
  const [suggestedHistory, setSuggestedHistory] = useState([])
  const [predictedTopId, setPredictedTopId] = useState(null)

  // Step 3
  const [dimensions, setDimensions] = useState([])
  const [keepFlags, setKeepFlags] = useState({}) // {dimIdx: true}
  const [dimFeedback, setDimFeedback] = useState('')

  // Step 4
  const [ratings, setRatings] = useState({})

  // Step 5
  const [analysis, setAnalysis] = useState(null)
  const [analysisRaw, setAnalysisRaw] = useState('')
  const [analysisFeedback, setAnalysisFeedback] = useState('')

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

  const askContextQuestions = async () => {
    if (!decision.trim()) return
    setError(null); setLoading(true)
    try {
      const { system, user } = contextQuestionsPrompt(decision)
      const text = await callClaude({ system, user, max_tokens: 200 })
      setContextQuestions(parseQuestions(text))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const submitFraming = async () => {
    if (!decision.trim()) return
    setError(null); setLoading(true)
    try {
      const { system, user } = framingPrompt(decision, contextText)
      const text = await callClaude({ system, user })
      setFraming(text.trim())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const surfaceMissing = async () => {
    if (cleanOptions.length < 2) return
    setError(null); setLoading(true)
    try {
      const newHistory = missingOption
        ? [...suggestedHistory, missingOption]
        : suggestedHistory
      const { system, user } = missingOptionPrompt(
        decision,
        cleanOptions.map(o => o.name),
        newHistory
      )
      const text = await callClaude({ system, user })
      setMissingOption(text.trim())
      setSuggestedHistory(newHistory)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const requestDimensions = async () => {
    setError(null); setLoading(true)
    try {
      const kept = dimensions.filter((_, i) => keepFlags[i])
      const { system, user } = dimensionsPrompt(
        decision,
        cleanOptions.map(o => o.name),
        kept,
        dimFeedback
      )
      const text = await callClaude({ system, user })
      const fresh = parseDimensions(text)

      // Build the new list: kept dims stay in their positions, new dims fill the rest
      if (kept.length === 0) {
        setDimensions(fresh.slice(0, 4))
      } else {
        const result = []
        let freshIdx = 0
        for (let i = 0; i < 4; i++) {
          if (keepFlags[i] && dimensions[i]) {
            result.push(dimensions[i])
          } else if (freshIdx < fresh.length) {
            result.push(fresh[freshIdx++])
          }
        }
        setDimensions(result)
      }
      setKeepFlags({})
      setDimFeedback('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const submitAnalysis = async (feedback = '') => {
    setError(null); setLoading(true)
    try {
      const predictedTopName = cleanOptions.find(o => o.id === predictedTopId)?.name || ''
      const { system, user } = analysisPrompt({
        decision,
        context: contextText,
        options: cleanOptions.map(o => o.name),
        dimensions,
        ranked: ranked.map(r => ({ name: r.name, score: r.score })),
        ratings: cleanOptions.map(o => ({
          option: o.name,
          scores: dimensions.map((d, di) => ({
            dim: d.name,
            rating: ratings?.[o.id]?.[di] ?? null
          }))
        })),
        predictedTop: predictedTopName
      })

      const messages = feedback && analysisRaw
        ? [
            { role: 'user', content: user },
            { role: 'assistant', content: analysisRaw },
            { role: 'user', content: `Refine the analysis based on this feedback: ${feedback}\n\nReturn the same VALUE / CRUX / RISK format. Address me directly in second person ("you", "your") — never "the user" or "they". Do not repeat the previous wording.` }
          ]
        : [{ role: 'user', content: user }]

      const text = await callClaude({ system, messages })
      setAnalysisRaw(text)
      setAnalysis(parseAnalysis(text))
      if (feedback) setAnalysisFeedback('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const advance = async () => {
    if (step === 1) {
      if (!framing) { await submitFraming(); return }
      setStep(2); return
    }
    if (step === 2) {
      if (cleanOptions.length < 2) return
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
      await submitAnalysis()
      return
    }
  }

  const back = () => { if (step > 1) setStep(step - 1) }

  const loadDemo = () => {
    setDecision(DEMO_SCENARIO.decision)
    setContextText(DEMO_SCENARIO.context)
    setFraming(DEMO_SCENARIO.framing)
    setOptions(DEMO_SCENARIO.options.map((name, i) => ({ id: i + 1, name })))
    setMissingOption(DEMO_SCENARIO.missingOption)
    setPredictedTopId(DEMO_SCENARIO.predictedTopId)
    setDimensions(DEMO_SCENARIO.dimensions)
    setRatings(DEMO_SCENARIO.ratings)
    setAnalysis(null); setAnalysisRaw('')
    setStep(4)
  }

  const reset = () => {
    setStep(1)
    setDecision(''); setContextText(''); setContextQuestions([]); setFraming('')
    setOptions([{ id: 1, name: '' }, { id: 2, name: '' }])
    setMissingOption(''); setSuggestedHistory([]); setPredictedTopId(null)
    setDimensions([]); setKeepFlags({}); setDimFeedback('')
    setRatings({})
    setAnalysis(null); setAnalysisRaw(''); setAnalysisFeedback('')
    setError(null)
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
    if (predictedTopId === id) setPredictedTopId(null)
  }

  const updateDim = (i, patch) => {
    setDimensions(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }
  const toggleKeep = (i) => {
    setKeepFlags(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const setRating = (oid, di, value) => {
    setRatings(prev => ({
      ...prev,
      [oid]: { ...(prev[oid] || {}), [di]: value }
    }))
  }

  const advanceDisabled =
    loading ||
    (step === 1 && !decision.trim()) ||
    (step === 2 && cleanOptions.length < 2) ||
    (step === 3 && dimensions.length < 2)

  const advanceLabel =
    step === 1 && !framing ? 'Frame this →' :
    'Next →'

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <CubeLogo size={26} />
          <div className="brand-text">
            <strong>Forcing Function</strong> · EV Calculator
          </div>
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={() => {
              if (step > 1 || decision || framing) {
                if (!confirm('Reset everything and start over?')) return
              }
              reset()
            }}
            aria-label="reset"
            title="Start over"
          >
            ↻ Reset
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="toggle theme"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
        </div>
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

      <div style={{ height: 16 }} />

      {error && <div className="error">⚠ {error}</div>}

      {step === 1 && (
        <Step1
          decision={decision}
          setDecision={setDecision}
          contextQuestions={contextQuestions}
          contextText={contextText}
          setContextText={setContextText}
          framing={framing}
          loading={loading}
          onAskContext={askContextQuestions}
          onFrame={submitFraming}
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
          suggestedHistory={suggestedHistory}
          loading={loading}
          onSurface={surfaceMissing}
          predictedTopId={predictedTopId}
          setPredictedTopId={setPredictedTopId}
          cleanOptions={cleanOptions}
        />
      )}

      {step === 3 && (
        <Step3
          dimensions={dimensions}
          updateDim={updateDim}
          keepFlags={keepFlags}
          toggleKeep={toggleKeep}
          dimFeedback={dimFeedback}
          setDimFeedback={setDimFeedback}
          loading={loading}
          onRegen={requestDimensions}
        />
      )}

      {step === 4 && (
        <Step4
          options={cleanOptions}
          dimensions={dimensions}
          ratings={ratings}
          setRating={setRating}
        />
      )}

      {step === 5 && (
        <Step5
          ranked={ranked}
          predictedTopId={predictedTopId}
          analysis={analysis}
          loading={loading}
          analysisFeedback={analysisFeedback}
          setAnalysisFeedback={setAnalysisFeedback}
          onRegen={() => submitAnalysis(analysisFeedback)}
        />
      )}

      <div className="actions">
        <button className="ghost" onClick={back} disabled={step === 1}>← Back</button>
        {step < 5 ? (
          <button className="primary" onClick={advance} disabled={advanceDisabled}>
            {loading ? <Loading /> : advanceLabel}
          </button>
        ) : (
          <button className="ghost" onClick={reset}>Start over</button>
        )}
      </div>

      <footer className="footer">
        Inputs are sent to Anthropic for processing. Not stored by us.
      </footer>
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

function Step1({
  decision, setDecision,
  contextQuestions, contextText, setContextText,
  framing, loading,
  onAskContext, onFrame,
  onLoadDemo, onReframe
}) {
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

      {!framing && contextQuestions.length === 0 && (
        <div className="hint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <button className="link-btn" onClick={onAskContext} disabled={!decision.trim() || loading}>
            {loading ? '…' : 'What context would help? →'}
          </button>
          <span>or <button className="link-btn" onClick={onLoadDemo}>load demo scenario →</button></span>
        </div>
      )}

      {contextQuestions.length > 0 && !framing && (
        <>
          <AIBlock tag="To frame this well, tell me about">
            <div style={{ fontSize: 16 }}>
              {contextQuestions.map((q, i) => (
                <div key={i} style={{ marginBottom: 4 }}>· {q}</div>
              ))}
            </div>
          </AIBlock>
          <div className="field">
            <label className="field-label">Context</label>
            <textarea
              value={contextText}
              onChange={e => setContextText(e.target.value)}
              placeholder="Answer any or all of the above. Or anything else relevant — timeline, constraints, what you've already tried."
            />
          </div>
        </>
      )}

      {framing && (
        <AIBlock tag="Reflected back">
          {framing}
          <div style={{ marginTop: 12 }}>
            <button className="link-btn" onClick={onReframe}>Reframe →</button>
          </div>
        </AIBlock>
      )}
    </div>
  )
}

function Step2({
  options, updateOption, addOption, removeOption,
  missingOption, suggestedHistory, loading, onSurface,
  predictedTopId, setPredictedTopId, cleanOptions
}) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 02 / Options</div>
      <h1 className="step-title">What are the options on the table?</h1>
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

      <div className="field">
        <button className="link-btn" onClick={onSurface} disabled={cleanOptions.length < 2 || loading}>
          {loading ? '…' : missingOption ? '↻ Surface another option →' : 'Surface what I missed →'}
        </button>
      </div>

      {missingOption && (
        <AIBlock tag="One you didn't name">
          {missingOption}
        </AIBlock>
      )}

      {cleanOptions.length >= 2 && (
        <div className="field" style={{ marginTop: 32 }}>
          <label className="field-label">Gut check — which do you expect to rank highest?</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {cleanOptions.map(o => (
              <label key={o.id} className="predict-row">
                <input
                  type="radio"
                  name="predicted"
                  checked={predictedTopId === o.id}
                  onChange={() => setPredictedTopId(o.id)}
                />
                <span>{o.name}</span>
              </label>
            ))}
          </div>
          <div className="hint">We'll surface the gap between your gut and the numbers in the analysis.</div>
        </div>
      )}
    </div>
  )
}

function Step3({
  dimensions, updateDim,
  keepFlags, toggleKeep,
  dimFeedback, setDimFeedback,
  loading, onRegen
}) {
  const keptCount = Object.values(keepFlags).filter(Boolean).length
  const willReplace = dimensions.length - keptCount

  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 03 / Factors</div>
      <h1 className="step-title">What are the factors driving your decision?</h1>
      <p className="step-sub">You can edit each, or keep the ones you like and regenerate new factors with feedback.</p>

      {loading && dimensions.length === 0 && (
        <AIBlock tag="Proposing"><Loading /></AIBlock>
      )}

      {dimensions.length > 0 && (
        <>
          <div className="field">
            {dimensions.map((d, i) => (
              <div key={i} className="dim-row-keep">
                <label className="keep-check">
                  <input
                    type="checkbox"
                    checked={!!keepFlags[i]}
                    onChange={() => toggleKeep(i)}
                  />
                  <span>Keep</span>
                </label>
                <input
                  value={d.name}
                  onChange={e => updateDim(i, { name: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label className="field-label">Feedback (optional) — steer the regeneration</label>
            <textarea
              value={dimFeedback}
              onChange={e => setDimFeedback(e.target.value)}
              placeholder="e.g. focus more on team impact, drop financial framing, consider reversibility..."
              style={{ minHeight: 60 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onRegen} disabled={loading}>
              {loading ? <Loading /> : keptCount === 0
                ? '↻ Regenerate all factors'
                : `↻ Regenerate ${willReplace} unchecked`}
            </button>
            <span className="hint" style={{ marginTop: 0 }}>
              {keptCount > 0
                ? `Keeping ${keptCount}, replacing ${willReplace}`
                : 'Check the factors you want to keep'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function Step4({ options, dimensions, ratings, setRating }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 04 / Ratings</div>
      <h1 className="step-title">Score each option, 1 to 5.</h1>
      <p className="step-sub">5 = best on this factor. Sliders default to 3 — move them.</p>

      <div className="rate-table">
        {options.map(o => (
          <div key={o.id} className="rate-row">
            <div className="rate-option-name">{o.name}</div>
            <div className="rate-grid">
              {dimensions.map((d, di) => {
                const value = ratings?.[o.id]?.[di] ?? 3
                return (
                  <div key={di} className="rate-dim-row">
                    <div className="rate-dim-label">{d.name}</div>
                    <div className="slider-wrap">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={value}
                        onChange={e => setRating(o.id, di, Number(e.target.value))}
                        className="rate-slider"
                      />
                      <div className="slider-ticks">
                        <span>1 low</span><span>5 high</span>
                      </div>
                    </div>
                    <div className="slider-value">{value}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="hint">Scores reveal on the next screen.</p>
    </div>
  )
}

function Step5({
  ranked, predictedTopId,
  analysis, loading,
  analysisFeedback, setAnalysisFeedback,
  onRegen
}) {
  const actualTop = ranked[0]
  const predictedTop = ranked.find(r => r.id === predictedTopId)
  const surprised = predictedTop && actualTop && predictedTop.id !== actualTop.id

  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 05 / Analysis</div>
      <h1 className="step-title">Here's what the numbers say.</h1>

      {surprised && (
        <p className="step-sub" style={{ color: 'var(--gold)' }}>
          You predicted <em>{predictedTop.name}</em> would win. The numbers disagree.
        </p>
      )}

      <div className="rank-list-compact">
        {ranked.map((o, i) => (
          <div key={o.id} className={`rank-item-compact ${i === 0 ? 'top' : ''} ${o.id === predictedTopId ? 'predicted' : ''}`}>
            <span className="rank-num-c">{i + 1}</span>
            <span className="rank-name-c">{o.name}</span>
            {o.id === predictedTopId && <span className="rank-tag">your pick</span>}
            <span className="rank-score-c">{o.score}</span>
          </div>
        ))}
      </div>

      {loading && !analysis && <AIBlock tag="Analyzing"><Loading /></AIBlock>}

      {analysis && (
        <div className="read-block">
          <div className="read-line">
            <div className="read-tag">Value</div>
            <div className="read-text">{analysis.value}</div>
          </div>
          <div className="read-line">
            <div className="read-tag">Crux</div>
            <div className="read-text">{analysis.crux}</div>
          </div>
          <div className="read-line">
            <div className="read-tag">Risk</div>
            <div className="read-text">{analysis.risk}</div>
          </div>

          <div className="field" style={{ marginTop: 24 }}>
            <label className="field-label">Sharpen the analysis (optional)</label>
            <textarea
              value={analysisFeedback}
              onChange={e => setAnalysisFeedback(e.target.value)}
              placeholder="e.g. push harder on the founder-time crux, or consider what changes in 12 months..."
              style={{ minHeight: 60 }}
            />
            <div style={{ marginTop: 8 }}>
              <button onClick={onRegen} disabled={loading}>
                {loading ? <Loading /> : '↻ Regenerate analysis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
