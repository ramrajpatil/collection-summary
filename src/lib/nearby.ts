import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core'

export interface NearbyEndpoint {
  endpointId: string
  endpointName: string
  serviceId?: string
}

export interface NearbyConnectionInfo {
  endpointId: string
  endpointName: string
  isIncoming: boolean
  authenticationDigits: string
}

export interface NearbyConnectionResult {
  endpointId: string
  endpointName: string
  connected: boolean
  message?: string
}

export interface NearbyPayload {
  endpointId: string
  data: string
}

export interface NearbyTransferUpdate {
  endpointId: string
  status: number
  bytesTransferred: number
  totalBytes: number
}

export interface NearbyEventMap {
  endpointFound: NearbyEndpoint
  endpointLost: { endpointId: string }
  connectionInitiated: NearbyConnectionInfo
  connectionResult: NearbyConnectionResult
  disconnected: { endpointId: string }
  payloadReceived: NearbyPayload
  payloadTransferUpdate: NearbyTransferUpdate
}

export interface NearbySyncPlugin {
  isAvailable(): Promise<{ available: boolean; reason?: string }>
  startAdvertising(options?: { name?: string }): Promise<void>
  startDiscovery(): Promise<void>
  connect(options: { endpointId: string; name?: string }): Promise<void>
  accept(options: { endpointId: string }): Promise<void>
  reject(options: { endpointId: string }): Promise<void>
  send(options: { data: string; endpointId?: string }): Promise<void>
  disconnect(options?: { endpointId?: string }): Promise<void>
  stop(): Promise<void>
  addListener<E extends keyof NearbyEventMap>(
    eventName: E,
    listenerFunc: (event: NearbyEventMap[E]) => void,
  ): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}

export const NearbySync = registerPlugin<NearbySyncPlugin>('NearbySync')

export function isNearbySupported(): boolean {
  return (
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  )
}
