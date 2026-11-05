import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar } from '@capacitor/status-bar'
import { getRepo } from './lib/db'
import { runBackHandler } from './lib/backButton'
import { tapFeedback } from './lib/haptics'
import { getGeminiKey, setGeminiKey } from './lib/gemini'
import type { Profile } from './lib/models'
import type { Repository } from './lib/repo'
import { STRINGS, useLanguage } from './lib/i18n'
import {
  defaultSettings,
  loadStoredSettings,
  type Settings,
} from './lib/settings'
import { useTheme, type Theme } from './lib/theme'
import { applySystemTheme } from './lib/systemUi'
import { SetupScreen } from './screens/SetupScreen'
import { CollectionScreen } from './screens/CollectionScreen'
import { HoldersScreen } from './screens/HoldersScreen'
import { HolderDetailScreen } from './screens/HolderDetailScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { BottomSheet } from './components/BottomSheet'
import { DataBackupSheet } from './components/DataBackupSheet'
import {
  ChartIcon,
  GearIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
  WalletIcon,
} from './components/Icons'

type Tab = 'collection' | 'holders' | 'reports'

export default function App() {
  const { lang, setLang } = useLanguage()
  const { theme, setTheme, toggleTheme } = useTheme()
  const s = STRINGS[lang]

  const [repo, setRepo] = useState<Repository | null>(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')
  const [bootToken, setBootToken] = useState(0)
  const [setupComplete, setSetupComplete] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('collection')
  const [holderId, setHolderId] = useState<number | null>(null)
  const [editHolderId, setEditHolderId] = useState<number | null>(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<Settings>(
    defaultSettings(lang),
  )
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const nextRepo = await getRepo()
        const [complete, stored] = await Promise.all([
          nextRepo.isSetupComplete(),
          nextRepo.getProfile(),
        ])
        if (cancelled) return
        setRepo(nextRepo)
        setSetupComplete(complete)
        setProfile(stored)
        setReady(true)
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bootToken])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    applySystemTheme(theme)
  }, [theme])

  const backAction = useRef<() => boolean>(() => false)
  useEffect(() => {
    backAction.current = () => {
      if (settingsOpen) {
        setSettingsOpen(false)
        return true
      }
      if (backupOpen) {
        setBackupOpen(false)
        return true
      }
      if (runBackHandler()) return true
      if (holderId != null) {
        setHolderId(null)
        return true
      }
      if (tab !== 'collection') {
        setTab('collection')
        return true
      }
      return false
    }
  })

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = CapacitorApp.addListener('backButton', () => {
      if (backAction.current()) return
      void CapacitorApp.minimizeApp()
    })
    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const control = target.closest('button, a[href], [role="button"]')
      if (!(control instanceof HTMLElement)) return
      if (control instanceof HTMLButtonElement && control.disabled) return
      if (control.getAttribute('aria-disabled') === 'true') return
      tapFeedback()
    }

    document.addEventListener('pointerdown', handlePointerDown, {
      passive: true,
    })
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  function handleSetupComplete(next: Profile) {
    setProfile(next)
    setSetupComplete(true)
    setTab('collection')
  }

  function handleImported() {
    setHolderId(null)
    setTab('collection')
    setBackupOpen(false)
    window.location.reload()
  }

  function openSettings() {
    setSettingsDraft(profile ?? defaultSettings(lang))
    setGeminiKeyDraft(getGeminiKey())
    setSettingsError('')
    setSettingsOpen(true)
  }

  async function saveSettings() {
    if (!repo) return
    if (!settingsDraft.societyName.trim()) {
      setSettingsError(s.nameRequired)
      return
    }
    setSavingSettings(true)
    setSettingsError('')
    try {
      await repo.saveProfile(settingsDraft)
      setProfile(settingsDraft)
      setGeminiKey(geminiKeyDraft)
      setSettingsOpen(false)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingSettings(false)
    }
  }

  if (!ready) {
    return (
      <>
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <main className="loading-screen">
          <div className="loading-card glass">
            <div className="brand">
              <strong>{s.appName}</strong>
              <span>{s.appSubtitle}</span>
            </div>
            {initError ? (
              <>
                <p className="form-error">{initError}</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setInitError('')
                    setReady(false)
                    setBootToken((token) => token + 1)
                  }}
                >
                  {s.retry}
                </button>
              </>
            ) : (
              <>
                <span className="spinner large" />
                <p>{s.loading}</p>
              </>
            )}
          </div>
        </main>
      </>
    )
  }

  if (!setupComplete || !repo) {
    return (
      <>
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <SetupScreen
          repo={repo!}
          initialProfile={
            profile ?? loadStoredSettings() ?? defaultSettings(lang)
          }
          onComplete={handleSetupComplete}
        />
      </>
    )
  }

  return (
    <>
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <main className="app">
        <header className="topbar glass">
          <div className="brand">
            <strong>{s.appName}</strong>
            <span>{profile?.societyName ?? s.appSubtitle}</span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="lang-pill"
              aria-label={s.language}
              onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')}
            >
              {lang === 'mr' ? 'मराठी' : 'EN'}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={s.theme}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={s.settings}
              onClick={openSettings}
            >
              <GearIcon />
            </button>
          </div>
        </header>

        {tab === 'collection' && profile ? (
          <CollectionScreen
            repo={repo}
            profile={profile}
            onGoToHolders={() => setTab('holders')}
          />
        ) : null}

        {tab === 'holders' && profile ? (
          holderId != null ? (
            <HolderDetailScreen
              repo={repo}
              profile={profile}
              holderId={holderId}
              onBack={() => setHolderId(null)}
              onEdit={() => {
                setEditHolderId(holderId)
                setHolderId(null)
              }}
            />
          ) : (
            <HoldersScreen
              repo={repo}
              onOpenHolder={setHolderId}
              editHolderId={editHolderId}
              onEditHandled={() => setEditHolderId(null)}
            />
          )
        ) : null}

        {tab === 'reports' && profile ? (
          <ReportsScreen repo={repo} profile={profile} />
        ) : null}
      </main>

      <nav className="tabbar glass" aria-label={s.appName}>
        <button
          type="button"
          className={`tab${tab === 'collection' ? ' active' : ''}`}
          onClick={() => setTab('collection')}
        >
          <WalletIcon />
          <span>{s.tabCollection}</span>
        </button>
        <button
          type="button"
          className={`tab${tab === 'holders' ? ' active' : ''}`}
          onClick={() => setTab('holders')}
        >
          <UsersIcon />
          <span>{s.tabHolders}</span>
        </button>
        <button
          type="button"
          className={`tab${tab === 'reports' ? ' active' : ''}`}
          onClick={() => setTab('reports')}
        >
          <ChartIcon />
          <span>{s.tabReports}</span>
        </button>
      </nav>

      {settingsOpen ? (
        <BottomSheet
          title={s.settings}
          closeLabel={s.close}
          onClose={() => setSettingsOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={savingSettings}
                onClick={() => setSettingsOpen(false)}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={savingSettings}
                onClick={() => void saveSettings()}
              >
                {savingSettings ? <span className="spinner" /> : null}
                {s.save}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="settingsSociety">{s.societyName}</label>
            <input
              id="settingsSociety"
              value={settingsDraft.societyName}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  societyName: event.target.value,
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="settingsAddress">{s.address}</label>
            <input
              id="settingsAddress"
              value={settingsDraft.address}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  address: event.target.value,
                })
              }
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="settingsAgent">{s.agentName}</label>
              <input
                id="settingsAgent"
                value={settingsDraft.agentName}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    agentName: event.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="settingsManager">{s.managerName}</label>
              <input
                id="settingsManager"
                value={settingsDraft.managerName}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    managerName: event.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="settingsGeminiKey">{s.geminiKey}</label>
            <input
              id="settingsGeminiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={geminiKeyDraft}
              onChange={(event) => setGeminiKeyDraft(event.target.value)}
            />
            <p className="field-hint">{s.geminiKeyHint}</p>
          </div>

          <div className="field">
            <span className="field-label">{s.theme}</span>
            <div className="segmented" role="group" aria-label={s.theme}>
              {(['dark', 'light'] as Theme[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={theme === mode ? 'active' : ''}
                  onClick={() => setTheme(mode)}
                >
                  {mode === 'dark' ? s.dark : s.light}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">{s.language}</span>
            <div className="segmented" role="group" aria-label={s.language}>
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
          </div>

          {settingsError ? (
            <p className="form-error">{settingsError}</p>
          ) : null}

          <div className="field">
            <span className="field-label">{s.dataBackup}</span>
            <button
              type="button"
              className="btn-ghost wide"
              onClick={() => setBackupOpen(true)}
            >
              {s.backupExport}
              <span aria-hidden>·</span>
              {s.backupImport}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {backupOpen && repo ? (
        <DataBackupSheet
          repo={repo}
          onClose={() => setBackupOpen(false)}
          onImported={handleImported}
        />
      ) : null}
    </>
  )
}
