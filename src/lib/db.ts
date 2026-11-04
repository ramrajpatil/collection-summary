import { Capacitor } from '@capacitor/core'
import type { Repository } from './repo'

let repoPromise: Promise<Repository> | null = null

export function getRepo(): Promise<Repository> {
  if (!repoPromise) {
    repoPromise = (async () => {
      if (Capacitor.isNativePlatform()) {
        const { NativeRepository } = await import('./repo.native')
        const repo = NativeRepository.get()
        await repo.init()
        return repo
      }
      const { WebRepository } = await import('./repo.web')
      const repo = WebRepository.get()
      await repo.init()
      return repo
    })().catch((err) => {
      repoPromise = null
      throw err
    })
  }
  return repoPromise
}

export function isAccountExistsError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /unique constraint failed: holders\.account_no/i.test(message)
}
