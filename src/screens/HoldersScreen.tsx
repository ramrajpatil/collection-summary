import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { Holder, HolderInput } from '../lib/models'
import type {
  HolderSort,
  HolderStatus,
  Repository,
} from '../lib/repo'
import { isAccountExistsError } from '../lib/db'
import { pushBackHandler } from '../lib/backButton'
import { STRINGS, useLanguage } from '../lib/i18n'
import { formatDigits, formatRupees } from '../lib/marathi'
import { holderName, upperName } from '../lib/names'
import { BottomSheet } from '../components/BottomSheet'
import { Toast } from '../components/Toast'
import {
  CheckIcon,
  ChevronRightIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UserPlusIcon,
} from '../components/Icons'

interface HoldersScreenProps {
  repo: Repository
  onOpenHolder: (id: number) => void
  editHolderId?: number | null
  onEditHandled?: () => void
}

const EMPTY_DRAFT: HolderInput = {
  name: '',
  nameEn: '',
  accountNo: '',
  defaultAmount: 100,
  phone: '',
  active: true,
}

const ENTER_ROW_LIMIT = 8

export function HoldersScreen({
  repo,
  onOpenHolder,
  editHolderId,
  onEditHandled,
}: HoldersScreenProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]

  const [holders, setHolders] = useState<Holder[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<HolderStatus>('active')
  const [sort, setSort] = useState<HolderSort>('account')
  const [sortOpen, setSortOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Holder | null>(null)
  const [draft, setDraft] = useState<HolderInput>(EMPTY_DRAFT)
  const [error, setError] = useState('')
  const [nextAccount, setNextAccount] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = () => setReloadToken((token) => token + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    repo
      .listHolders({ search: '', status: statusFilter, sort })
      .then((rows) => {
        if (!cancelled) setHolders(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus(
            `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo, statusFilter, sort, reloadToken, s.failed])

  const srById = useMemo(() => {
    const map: Record<number, number> = {}
    holders.forEach((holder, index) => {
      map[holder.id] = index + 1
    })
    return map
  }, [holders])

  const deferredSearch = useDeferredValue(search)

  const visibleHolders = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase()
    if (!query) return holders
    return holders.filter((holder) =>
      `${holder.name} ${holder.nameEn} ${holder.accountNo}`
        .toLocaleLowerCase()
        .includes(query),
    )
  }, [holders, deferredSearch])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 6000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (!sheetOpen) return
    return pushBackHandler(() => {
      if (!busy) setSheetOpen(false)
      return true
    })
  }, [sheetOpen, busy])

  useEffect(() => {
    if (!sortOpen) return
    return pushBackHandler(() => {
      setSortOpen(false)
      return true
    })
  }, [sortOpen])

  useEffect(() => {
    if (editHolderId == null) return
    let active = true
    repo
      .getHolder(editHolderId)
      .then((holder) => {
        if (!active) return
        if (holder) openEdit(holder)
        onEditHandled?.()
      })
      .catch(() => onEditHandled?.())
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editHolderId, repo])

  async function openAdd() {
    setError('')
    setEditing(null)
    setDraft({ ...EMPTY_DRAFT })
    try {
      const next = await repo.nextAccountNo()
      setNextAccount(next)
      setDraft({ ...EMPTY_DRAFT, accountNo: next })
    } catch {
      setNextAccount('')
    }
    setSheetOpen(true)
  }

  function openEdit(holder: Holder) {
    setError('')
    setEditing(holder)
    setNextAccount('')
    setDraft({
      name: holder.name,
      nameEn: holder.nameEn,
      accountNo: holder.accountNo,
      defaultAmount: holder.defaultAmount,
      phone: holder.phone ?? '',
      active: holder.active,
    })
    setSheetOpen(true)
  }

  function closeSheet() {
    if (busy) return
    setSheetOpen(false)
  }

  async function save() {
    if (!draft.name.trim()) {
      setError(s.nameRequired)
      return
    }
    if (!draft.accountNo.trim()) {
      setError(s.accountRequired)
      return
    }
    const amount = Number(draft.defaultAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError(s.amountInvalid)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editing) {
        await repo.updateHolder(editing.id, draft)
      } else {
        await repo.createHolder(draft)
      }
      setSheetOpen(false)
      setStatus(s.holderSaved)
      refresh()
    } catch (err) {
      setError(
        isAccountExistsError(err)
          ? s.accountExists
          : err instanceof Error
            ? err.message
            : String(err),
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing) return
    if (!window.confirm(s.deleteHolderConfirm)) return
    setBusy(true)
    setError('')
    try {
      await repo.deleteHolder(editing.id)
      setSheetOpen(false)
      setStatus(s.holderDeleted)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const activeCount = holders.filter((holder) => holder.active).length
  const isSearching = search.trim().length > 0

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>{s.holdersTitle}</h1>
          <p>{s.holdersSubtitle}</p>
        </div>
        <button
          type="button"
          className="btn-primary compact"
          onClick={() => void openAdd()}
        >
          <UserPlusIcon />
          {s.addHolder}
        </button>
      </div>

      <div className="search-filter-row">
        <div className="searchbar glass">
          <SearchIcon />
          <input
            type="search"
            value={search}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={s.searchHolders}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-dropdown-wrapper">
          <button
            type="button"
            className="filter-select glass"
            aria-label={sort === 'name' ? s.sortName : s.sortAccount}
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((prev) => !prev)}
          >
            <span>{sort === 'name' ? s.sortName : s.sortAccount}</span>
            <ChevronRightIcon
              className={`filter-chevron${sortOpen ? ' open' : ''}`}
            />
          </button>
          {sortOpen ? (
            <>
              <div
                className="dropdown-backdrop"
                onClick={() => setSortOpen(false)}
              />
              <div className="dropdown-menu" role="menu">
                {(
                  [
                    { id: 'account', label: s.sortAccount },
                    { id: 'name', label: s.sortName },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitem"
                    className={`dropdown-item${
                      sort === option.id ? ' active' : ''
                    }`}
                    onClick={() => {
                      setSort(option.id)
                      setSortOpen(false)
                    }}
                  >
                    <span>{option.label}</span>
                    {sort === option.id ? (
                      <CheckIcon className="dropdown-check" />
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="filter-row">
        <div className="segmented">
          <button
            type="button"
            className={statusFilter === 'active' ? 'active' : ''}
            onClick={() => setStatusFilter('active')}
          >
            {s.filterActive}
          </button>
          <button
            type="button"
            className={statusFilter === 'inactive' ? 'active' : ''}
            onClick={() => setStatusFilter('inactive')}
          >
            {s.filterInactive}
          </button>
          <button
            type="button"
            className={statusFilter === 'all' ? 'active' : ''}
            onClick={() => setStatusFilter('all')}
          >
            {s.filterAll}
          </button>
        </div>
      </div>

      <div className="list-summary">
        <span>
          {s.totalCount}: {formatDigits(holders.length, lang)}
        </span>
        <span>
          {s.activeCount}: {formatDigits(activeCount, lang)}
        </span>
      </div>

      {loading ? (
        <div className="list-loading">
          <span className="spinner" />
        </div>
      ) : visibleHolders.length === 0 ? (
        <div className="empty glass">
          <UserPlusIcon />
          <h2>{isSearching ? s.noData : s.noHolders}</h2>
          <p>{isSearching ? s.searchHolders : s.noHoldersHint}</p>
          {!isSearching ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void openAdd()}
            >
              <PlusIcon />
              {s.addHolder}
            </button>
          ) : null}
        </div>
      ) : (
        <section className="holder-list">
          {visibleHolders.map((holder, index) => (
            <div
              key={holder.id}
              className={`holder-row${index < ENTER_ROW_LIMIT ? ' enter' : ''}${
                holder.active ? '' : ' inactive'
              }`}
              style={
                index < ENTER_ROW_LIMIT
                  ? { animationDelay: `${index * 0.025}s` }
                  : undefined
              }
            >
              <button
                type="button"
                className="holder-main"
                onClick={() => onOpenHolder(holder.id)}
              >
                <span className="holder-avatar">
                  {formatDigits(srById[holder.id] ?? index + 1, lang)}
                </span>
                <span className="holder-info">
                  <b>{holderName(holder.name, holder.nameEn, lang)}</b>
                  <small>
                    {s.accountNoShort}{' '}
                    {formatDigits(holder.accountNo, lang)} ·{' '}
                    {formatRupees(holder.defaultAmount, lang)}
                  </small>
                </span>
              </button>
              <span
                className={`status-chip${holder.active ? ' active' : ''}`}
              >
                {holder.active ? s.holderActive : s.holderInactive}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={s.edit}
                onClick={() => openEdit(holder)}
              >
                <EditIcon />
              </button>
            </div>
          ))}
        </section>
      )}

      {status ? (
        <Toast
          key={status}
          message={status}
          onDismiss={() => setStatus('')}
          dismissLabel={s.close}
        />
      ) : null}

      {sheetOpen ? (
        <BottomSheet
          title={editing ? s.editHolder : s.addHolder}
          closeLabel={s.close}
          onClose={closeSheet}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={closeSheet}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? <span className="spinner" /> : null}
                {s.save}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="holderName">{s.holderName}</label>
            <input
              id="holderName"
              value={draft.name}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) =>
                setDraft({ ...draft, name: upperName(event.target.value) })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="holderNameEn">{s.holderNameEn}</label>
            <input
              id="holderNameEn"
              value={draft.nameEn ?? ''}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={s.holderNameEnHint}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  nameEn: upperName(event.target.value),
                })
              }
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="holderAccount">{s.holderAccount}</label>
              <input
                id="holderAccount"
                value={draft.accountNo}
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) =>
                  setDraft({ ...draft, accountNo: event.target.value })
                }
              />
              {!editing && nextAccount ? (
                <small className="field-hint">
                  {s.nextAccount}: {formatDigits(nextAccount, lang)}
                </small>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="holderAmount">{s.holderAmount}</label>
              <input
                id="holderAmount"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                autoComplete="off"
                value={draft.defaultAmount}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    defaultAmount: Number(event.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="holderPhone">{s.holderPhone}</label>
            <input
              id="holderPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={draft.phone ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, phone: event.target.value })
              }
            />
          </div>

          <div className="field">
            <span className="field-label">{s.holderStatus}</span>
            <div className="segmented">
              <button
                type="button"
                className={draft.active !== false ? 'active' : ''}
                onClick={() => setDraft({ ...draft, active: true })}
              >
                {s.holderActive}
              </button>
              <button
                type="button"
                className={draft.active === false ? 'active' : ''}
                onClick={() => setDraft({ ...draft, active: false })}
              >
                {s.holderInactive}
              </button>
            </div>
            <small className="field-hint">{s.holderActiveHint}</small>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          {editing ? (
            <div className="sheet-danger">
              <button
                type="button"
                className="btn-danger-text"
                disabled={busy}
                onClick={() => void remove()}
              >
                <TrashIcon />
                {s.deleteHolder}
              </button>
            </div>
          ) : null}
        </BottomSheet>
      ) : null}
    </>
  )
}
