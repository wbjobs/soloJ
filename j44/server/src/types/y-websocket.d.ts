declare module 'y-websocket/bin/utils' {
  import * as Y from 'yjs';
  import { WebSocket } from 'ws';

  export function setupWSConnection(
    conn: WebSocket,
    req: any,
    opts?: { gc?: boolean }
  ): void;

  export function getYDoc(docName: string, gc?: boolean): Y.Doc;

  export const docs: Map<string, {
    conns: Set<any>;
    doc: Y.Doc;
    name: string;
  }>;
}
