import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar } from '@capacitor/status-bar'
import { getRepo } from './lib/db'
import { runBackHandler } from './lib/backButton'
import { tapFeedback } from './lib/haptics'
import { getGeminiKey, setGeminiKey } from './lib/gemini'
import {
  loadNotifySettings,
  saveNotifySettings,
  type NotifySettings,
} from './lib/notifications'
import { SmsSender } from './lib/sms'
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
import { ExportScreen } from './screens/ExportScreen'
import { BottomSheet } from './components/BottomSheet'
import { DataBackupSheet } from './components/DataBackupSheet'
import {
  ArchiveIcon,
  ChartIcon,
  CloseIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GearIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
  WalletIcon,
} from './components/Icons'

type Tab = 'collection' | 'holders' | 'reports' | 'export'

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
  const [tabbarHidden, setTabbarHidden] = useState(false)
  const [holderId, setHolderId] = useState<number | null>(null)
  const [editHolderId, setEditHolderId] = useState<number | null>(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<Settings>(
    defaultSettings(lang),
  )
  const [notifySettings, setNotifySettings] =
    useState<NotifySettings>(loadNotifySettings)
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  function selectTab(next: Tab) {
    setTabbarHidden(false)
    setTab(next)
  }

  function toggleNotify(key: 'sms' | 'whatsapp') {
    const next = { ...notifySettings, [key]: !notifySettings[key] }
    setNotifySettings(next)
    saveNotifySettings(next)
  }

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

  useEffect(() => {
    if (!ready || !setupComplete || !Capacitor.isNativePlatform()) return
    // Ask once at startup so a collected amount can send the SMS automatically.
    void SmsSender.request().catch(() => {})
  }, [ready, setupComplete])

  useEffect(() => {
    let lastY = window.scrollY
    let accumulated = 0
    const THRESHOLD = 10
    const HIDE_AFTER = 64

    function handleScroll() {
      const y = window.scrollY
      if (y <= 8) {
        setTabbarHidden(false)
        lastY = y
        accumulated = 0
        return
      }

      accumulated += y - lastY
      lastY = y

      if (accumulated > THRESHOLD && y > HIDE_AFTER) {
        setTabbarHidden(true)
        accumulated = 0
      } else if (accumulated < -THRESHOLD) {
        setTabbarHidden(false)
        accumulated = 0
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        selectTab('collection')
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
    selectTab('collection')
  }

  function handleImported() {
    setHolderId(null)
    selectTab('collection')
    setBackupOpen(false)
    window.location.reload()
  }

  function openSettings() {
    setSettingsDraft(profile ?? defaultSettings(lang))
    setGeminiKeyDraft(getGeminiKey())
    setShowGeminiKey(false)
    setSettingsError('')
    setSettingsOpen(true)
  }

  async function handlePasteGeminiKey() {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip && clip.trim()) {
        setGeminiKeyDraft(clip.trim())
      }
    } catch {
      const el = document.getElementById(
        'settingsGeminiKey',
      ) as HTMLInputElement | null
      el?.focus()
      el?.select()
    }
  }

  function handleClearGeminiKey() {
    setGeminiKeyDraft('')
    const el = document.getElementById(
      'settingsGeminiKey',
    ) as HTMLInputElement | null
    el?.focus()
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
            onGoToHolders={() => selectTab('holders')}
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

        {tab === 'export' ? <ExportScreen repo={repo} /> : null}
      </main>

      <nav
        className={`tabbar glass${tabbarHidden ? ' is-hidden' : ''}`}
        aria-label={s.appName}
      >
        <button
          type="button"
          className={`tab${tab === 'collection' ? ' active' : ''}`}
          onClick={() => selectTab('collection')}
        >
          <WalletIcon />
          <span>{s.tabCollection}</span>
        </button>
        <button
          type="button"
          className={`tab${tab === 'holders' ? ' active' : ''}`}
          onClick={() => selectTab('holders')}
        >
          <UsersIcon />
          <span>{s.tabHolders}</span>
        </button>
        <button
          type="button"
          className={`tab${tab === 'reports' ? ' active' : ''}`}
          onClick={() => selectTab('reports')}
        >
          <ChartIcon />
          <span>{s.tabReports}</span>
        </button>
        <button
          type="button"
          className={`tab${tab === 'export' ? ' active' : ''}`}
          onClick={() => selectTab('export')}
        >
          <ArchiveIcon />
          <span>{s.tabExport}</span>
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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
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
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
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
            <div className="field-head">
              <label htmlFor="settingsGeminiKey">{s.geminiKey}</label>
              <div className="field-actions">
                <button
                  type="button"
                  className="field-action-btn"
                  onClick={() => void handlePasteGeminiKey()}
                  title={s.paste}
                >
                  <CopyIcon className="action-icon" />
                  <span>{s.paste}</span>
                </button>
                {geminiKeyDraft ? (
                  <button
                    type="button"
                    className="field-action-btn"
                    onClick={handleClearGeminiKey}
                    title={s.clear}
                  >
                    <CloseIcon className="action-icon" />
                    <span>{s.clear}</span>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="input-group">
              <input
                id="settingsGeminiKey"
                type={showGeminiKey ? 'text' : 'password'}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                placeholder="AIzaSy..."
                value={geminiKeyDraft}
                onChange={(event) => setGeminiKeyDraft(event.target.value)}
              />
              <button
                type="button"
                className="input-toggle-btn"
                onClick={() => setShowGeminiKey((prev) => !prev)}
                aria-label={showGeminiKey ? s.hideKey : s.showKey}
                title={showGeminiKey ? s.hideKey : s.showKey}
              >
                {showGeminiKey ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
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
            <span className="field-label">{s.notifications}</span>
            <label className="toggle-row">
              <span>{s.smsNotifications}</span>
              <input
                type="checkbox"
                checked={notifySettings.sms}
                onChange={() => toggleNotify('sms')}
              />
              <span className="toggle-switch" aria-hidden>
                <span />
              </span>
            </label>
            <label className="toggle-row">
              <span>{s.whatsappNotifications}</span>
              <input
                type="checkbox"
                checked={notifySettings.whatsapp}
                onChange={() => toggleNotify('whatsapp')}
              />
              <span className="toggle-switch" aria-hidden>
                <span />
              </span>
            </label>
            <p className="field-hint">{s.notificationsHint}</p>
          </div>

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
