type BackHandler = () => boolean

const handlers: BackHandler[] = []

export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const index = handlers.lastIndexOf(handler)
    if (index >= 0) handlers.splice(index, 1)
  }
}

export function runBackHandler(): boolean {
  const handler = handlers[handlers.length - 1]
  if (!handler) return false
  return handler()
}