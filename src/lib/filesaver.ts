import { registerPlugin } from '@capacitor/core'

export interface FileSaverResult {
  uri: string
  location: string
  fileName: string
}

export interface FileSaverPlugin {
  saveToDownloads(options: {
    fileName: string
    data: string
    mimeType?: string
    share?: boolean
  }): Promise<FileSaverResult>
}

export const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver')
