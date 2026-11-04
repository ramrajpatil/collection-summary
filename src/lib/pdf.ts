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
  }): Promise<PdfGeneratorResult>
}

export const PdfGenerator = registerPlugin<PdfGeneratorPlugin>('PdfGenerator')
