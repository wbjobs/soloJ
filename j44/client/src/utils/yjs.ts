import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const WEBSOCKET_URL = 'ws://localhost:3001'

export interface YjsConnection {
  doc: Y.Doc
  provider: WebsocketProvider
  awareness: WebsocketProvider['awareness']
  disconnect: () => void
}

export function createYjsProvider(roomId: string): YjsConnection {
  const doc = new Y.Doc()

  const provider = new WebsocketProvider(WEBSOCKET_URL, roomId, doc, {
    connect: true,
    maxBackoffTime: 2500,
  })

  const awareness = provider.awareness

  awareness.setLocalStateField('user', {
    id: Math.random().toString(36).substring(2, 10),
    name: `用户${Math.floor(Math.random() * 1000)}`,
    color: getRandomColor(),
  })

  const disconnect = () => {
    provider.disconnect()
    doc.destroy()
  }

  return {
    doc,
    provider,
    awareness,
    disconnect,
  }
}

export function getRandomColor(): string {
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function getYText(doc: Y.Doc, name: string = 'content'): Y.Text {
  return doc.getText(name)
}
