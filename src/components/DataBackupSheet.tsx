import { useState } from 'react'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  backupFileName,
  parseBackup,
  readTextFile,
  saveBackupFile,
  serializeBackup,
} from '../lib/backup'
import { BottomSheet } from './BottomSheet'
import { CloseIcon, CopyIcon, DownloadIcon, ShareIcon } from './Icons'

interface DataBackupSheetProps {
  repo: Repository
  onClose: () => void
  onImported: () => void
}

export function DataBackupSheet({
  repo,
  onClose,
  onImported,
}: DataBackupSheetProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [fileText, setFileText] = useState('')
  const [fileName, setFileName] = useState('')

  const hasContent = fileText.trim().length > 0 || text.trim().length > 0

  async function exportBackup() {
    if (busy) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const data = await repo.exportBackup()
      if (data.holders.length === 0 && data.collections.length === 0) {
        setStatus(s.backupEmpty)
        return
      }
      const result = await saveBackupFile(
        backupFileName(),
        serializeBackup(data),
      )
      setStatus(`${s.backupSavedTo} ${result.location}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function restore(raw: string) {
    if (busy || !raw.trim()) return
    let data
    try {
      data = parseBackup(raw)
    } catch {
      setError(s.backupInvalid)
      return
    }
    if (!window.confirm(s.backupRestoreConfirm)) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await repo.importBackup(data)
      onImported()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    try {
      const raw = await readTextFile(file)
      // Keep large files out of the textarea; rendering megabytes of text in
      // an input can freeze or blank the WebView on Android.
      setFileText(raw)
      setFileName(file.name)
      setText('')
      setError('')
    } catch {
      setError(s.backupInvalid)
    }
  }

  async function handlePasteBackupText() {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip && clip.trim()) {
        setText(clip.trim())
        setFileText('')
        setFileName('')
        setError('')
      }
    } catch {
      const el = document.getElementById(
        'backupText',
      ) as HTMLTextAreaElement | null
      el?.focus()
      el?.select()
    }
  }

  return (
    <BottomSheet
      title={s.dataBackup}
      closeLabel={s.close}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !hasContent}
          onClick={() => void restore(fileText.trim() || text)}
        >
          {busy ? <span className="spinner" /> : null}
          {s.backupImport}
        </button>
      }
    >
      <div className="backup-section">
        <h3>{s.backupExport}</h3>
        <p className="field-hint">{s.backupExportHint}</p>
        <button
          type="button"
          className="btn-primary wide"
          disabled={busy}
          onClick={() => void exportBackup()}
        >
          {busy ? <span className="spinner" /> : <ShareIcon />}
          {s.backupExport}
        </button>
      </div>

      <div className="backup-section">
        <h3>{s.backupImport}</h3>
        <p className="field-hint">{s.backupImportHint}</p>
        <label className="file-picker">
          <DownloadIcon />
          <span>{s.backupChooseFile}</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void pickFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {fileName ? (
          <div className="file-picked">
            <span>{fileName}</span>
            <button
              type="button"
              className="field-action-btn"
              onClick={() => {
                setFileText('')
                setFileName('')
              }}
            >
              <CloseIcon className="action-icon" />
              <span>{s.clear}</span>
            </button>
          </div>
        ) : null}
        <div className="field">
          <div className="field-head">
            <label htmlFor="backupText">{s.backupPaste}</label>
            <div className="field-actions">
              <button
                type="button"
                className="field-action-btn"
                onClick={() => void handlePasteBackupText()}
                title={s.paste}
              >
                <CopyIcon className="action-icon" />
                <span>{s.paste}</span>
              </button>
              {text ? (
                <button
                  type="button"
                  className="field-action-btn"
                  onClick={() => setText('')}
                  title={s.clear}
                >
                  <CloseIcon className="action-icon" />
                  <span>{s.clear}</span>
                </button>
              ) : null}
            </div>
          </div>
          <textarea
            id="backupText"
            rows={4}
            value={text}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value)
              setFileText('')
              setFileName('')
            }}
          />
        </div>
      </div>

      {status ? <p className="form-note">{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </BottomSheet>
  )
}
