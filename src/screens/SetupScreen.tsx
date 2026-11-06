import { useState } from 'react'
import type { Profile } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from '../components/Icons'

interface SetupScreenProps {
  repo: Repository
  initialProfile: Profile
  onComplete: (profile: Profile) => void
}

export function SetupScreen({
  repo,
  initialProfile,
  onComplete,
}: SetupScreenProps) {
  const { lang, setLang } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const s = STRINGS[lang]
  const [draft, setDraft] = useState<Profile>(initialProfile)
  const [busy, setBusy] = useState<'save' | 'demo' | null>(null)
  const [error, setError] = useState('')

  async function submit(withDemo: boolean) {
    if (!draft.societyName.trim()) {
      setError(s.nameRequired)
      return
    }
    setBusy(withDemo ? 'demo' : 'save')
    setError('')
    try {
      if (withDemo) {
        await repo.seedDemoData(draft)
      } else {
        await repo.saveProfile(draft)
        await repo.setSetupComplete(true)
      }
      onComplete(draft)
    } catch (err) {
      setError(
        `${s.setupFailed} ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="setup">
      <div className="setup-card glass">
        <div className="setup-top">
          <div className="brand">
            <strong>{s.appName}</strong>
            <span>{s.appSubtitle}</span>
          </div>
          <div className="topbar-actions">
            <div className="lang-switch" role="group" aria-label={s.language}>
              <button
                type="button"
                className={lang === 'mr' ? 'active' : ''}
                onClick={() => setLang('mr')}
              >
                मराठी
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'active' : ''}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={s.theme}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        <div className="setup-intro">
          <h1>{s.setupTitle}</h1>
          <p className="setup-lead">{s.setupSubtitle}</p>
          <p>{s.setupIntro}</p>
        </div>

        <div className="field">
          <label htmlFor="setupSociety">{s.societyName}</label>
          <input
            id="setupSociety"
            value={draft.societyName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) =>
              setDraft({ ...draft, societyName: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="setupAddress">{s.address}</label>
          <input
            id="setupAddress"
            value={draft.address}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) =>
              setDraft({ ...draft, address: event.target.value })
            }
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="setupAgent">{s.agentName}</label>
            <input
              id="setupAgent"
              value={draft.agentName}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) =>
                setDraft({ ...draft, agentName: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="setupManager">{s.managerName}</label>
            <input
              id="setupManager"
              value={draft.managerName}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) =>
                setDraft({ ...draft, managerName: event.target.value })
              }
            />
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="setup-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void submit(true)}
            disabled={busy !== null}
          >
            {busy === 'demo' ? <span className="spinner dark" /> : null}
            {s.setupDemo}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void submit(false)}
            disabled={busy !== null}
          >
            {busy === 'save' ? <span className="spinner" /> : null}
            {s.setupStart}
          </button>
        </div>
        <p className="setup-hint">{s.setupDemoHint}</p>
      </div>
    </main>
  )
}
