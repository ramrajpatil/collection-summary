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
import { DownloadIcon, ShareIcon } from './Icons'

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
      await saveBackupFile(backupFileName(), serializeBackup(data))
      setStatus(s.backupExported)
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
      setText(raw)
      setError('')
    } catch {
      setError(s.backupInvalid)
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
          disabled={busy || !text.trim()}
          onClick={() => void restore(text)}
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
        <div className="field">
          <label htmlFor="backupText">{s.backupPaste}</label>
          <textarea
            id="backupText"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>

      {status ? <p className="form-note">{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </BottomSheet>
  )
}
