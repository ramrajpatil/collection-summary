import { registerPlugin } from '@capacitor/core'

export interface PdfGeneratorResult {
  path: string
  uri: string
  size: number
}

export interface PdfGeneratorPlugin {
  generate(options: {
    html: string
    fileName: string
    baseUrl?: string
    saveToDownloads?: boolean
  }): Promise<PdfGeneratorResult>

  share(options: {
    uri: string
    fileName: string
    text?: string
    packageName?: string
  }): Promise<void>
}

export const PdfGenerator = registerPlugin<PdfGeneratorPlugin>('PdfGenerator')
