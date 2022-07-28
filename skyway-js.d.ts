// Type definitions for SkyWay@4.4.5
// Project: https://github.com/skyway/skyway-js-sdk
// Definitions by: Yuji Sugiura <https://github.com/leader22>

/// <reference types="node" />
import { EventEmitter } from "events";

// 0: none | 1: error | 2: warn | 3: full
type LogLevel = 0 | 1 | 2 | 3;
type DataConnectionSerialization = "binary" | "binary-utf8" | "json" | "none";

export interface PeerCredential {
  timestamp: number;
  ttl: number;
  authToken: string;
}

export interface PeerConstructorOption {
  key: string;
  debug?: LogLevel;
  turn?: boolean;
  credential?: PeerCredential;
  config?: RTCConfiguration;
  secure?: boolean;
  host?: string;
  port?: number;
}

export interface PeerError extends Error {
  type: string;
}

interface PeerOption {
  // specified as default(and also overrode)
  debug: LogLevel;
  secure: boolean | undefined;
  config: RTCConfiguration;
  turn: boolean;
  dispatcherSecure: boolean;
  dispatcherHost: string;
  dispatcherPort: number;

  // overrode by PeerConstructorOption(passed by user)
  key: string;
  credential?: PeerCredential;
  host?: string;
  port?: number;

  // fixed
  token: string;
}

interface ConnectionOption {
  metadata?: any;
  connectionId?: string;
}

export interface CallOption extends ConnectionOption {
  videoBandwidth?: number;
  audioBandwidth?: number;
  videoCodec?: string;
  audioCodec?: string;
  videoReceiveEnabled?: boolean;
  audioReceiveEnabled?: boolean;
}

export interface ConnectOption extends ConnectionOption {
  serialization?: DataConnectionSerialization;
  dcInit?: RTCDataChannelInit;
}

export interface AnswerOption {
  videoBandwidth?: number;
  audioBandwidth?: number;
  videoCodec?: string;
  audioCodec?: string;
  videoReceiveEnabled?: boolean;
  audioReceiveEnabled?: boolean;
}

declare class Connection extends EventEmitter {
  open: boolean;
  type: string;
  metadata: any;
  remoteId: string;
  id: string;

  getPeerConnection(): RTCPeerConnection | null;
  close(forceClose?: boolean): void;
}

export declare class MediaConnection extends Connection {
  type: "media";
  localStream: MediaStream;

  answer(stream?: MediaStream, options?: AnswerOption): void;
  replaceStream(stream: MediaStream): void;

  on(event: "stream", listener: (stream: MediaStream) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (err: PeerError) => void): this;
  on(event: string, listener: Function): this;

  once(event: "stream", listener: (stream: MediaStream) => void): this;
  once(event: "close", listener: () => void): this;
  once(event: "error", listener: (err: PeerError) => void): this;
  once(event: string, listener: Function): this;
}

export declare class DataConnection extends Connection {
  type: "data";
  label: string;
  serialization: DataConnectionSerialization;
  dcInit: RTCDataChannelInit;

  send(data: any): void;

  on(event: "open", listener: () => void): this;
  on(event: "data", listener: (data: any) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (err: PeerError) => void): this;
  on(event: string, listener: Function): this;

  once(event: "open", listener: () => void): this;
  once(event: "data", listener: (data: any) => void): this;
  once(event: "close", listener: () => void): this;
  once(event: "error", listener: (err: PeerError) => void): this;
  once(event: string, listener: Function): this;
}

interface RoomOption {
  mode?: "mesh" | "sfu";
  stream?: MediaStream;
  videoBandwidth?: number;
  audioBandwidth?: number;
  videoCodec?: string;
  audioCodec?: string;
  videoReceiveEnabled?: boolean;
  audioReceiveEnabled?: boolean;
}

export interface RoomData {
  src: string;
  data: any;
}

export interface RoomStream extends MediaStream {
  peerId: string;
}

declare class Room extends EventEmitter {
  name: string;

  getLog(): void;
  close(): void;
  replaceStream(stream: MediaStream): void;
  send(data: any): void;

  on(event: "open", listener: () => void): this;
  on(event: "peerJoin", listener: (peerId: string) => void): this;
  on(event: "peerLeave", listener: (peerId: string) => void): this;
  on(event: "log", listener: (logs: string[]) => void): this;
  on(event: "stream", listener: (stream: RoomStream) => void): this;
  on(event: "data", listener: (data: RoomData) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (err: PeerError) => void): this;
  on(event: string, listener: Function): this;

  once(event: "open", listener: () => void): this;
  once(event: "peerJoin", listener: (peerId: string) => void): this;
  once(event: "peerLeave", listener: (peerId: string) => void): this;
  once(event: "log", listener: (logs: string[]) => void): this;
  once(event: "stream", listener: (stream: RoomStream) => void): this;
  once(event: "data", listener: (data: RoomData) => void): this;
  once(event: "close", listener: () => void): this;
  once(event: "error", listener: (err: PeerError) => void): this;
  once(event: string, listener: Function): this;
}

export declare class MeshRoom extends Room {
  connections: {
    [peerId: string]: MediaConnection[] | DataConnection[];
  };
  getPeerConnections(): {
    [peerId: string]: RTCPeerConnection;
  };
}

export declare class SfuRoom extends Room {
  remoteStreams: {
    [peerId: string]: RoomStream;
  };
  members: string[];
  getPeerConnection(): RTCPeerConnection | null;
}

declare class Peer extends EventEmitter {
  id: string;
  connections: {
    [peerId: string]: MediaConnection[] | DataConnection[];
  };
  rooms: {
    [roomName: string]: MeshRoom | SfuRoom;
  };
  options: PeerOption;
  open: boolean;

  constructor(peerId: string, options: PeerConstructorOption);
  constructor(options: PeerConstructorOption);

  call(
    peerId: string,
    stream?: MediaStream,
    options?: CallOption
  ): MediaConnection;
  connect(peerId: string, options?: ConnectOption): DataConnection;
  joinRoom<T extends Room, Options extends RoomOption>(
    roomName: string,
    options?: Options
  ): Options["mode"] extends "sfu"
    ? SfuRoom
    : Options["mode"] extends "mesh"
    ? MeshRoom
    : SfuRoom | MeshRoom;
  joinRoom<T extends Room>(roomName: string, options?: RoomOption): T;

  destroy(): void;
  disconnect(): void;
  reconnect(): void;

  listAllPeers(callback: (peers: string[]) => void): void;
  fetchPeerExists(peerId: string): Promise<boolean>;
  getConnection<T extends Connection>(
    peerId: string,
    connectionId: string
  ): T | null;
  updateCredential(credential: PeerCredential): void;

  on(event: "open", listener: (peerId: string) => void): this;
  on(event: "call", listener: (conn: MediaConnection) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "connection", listener: (conn: DataConnection) => void): this;
  on(event: "disconnected", listener: (peerId: string) => void): this;
  on(event: "expiresin", listener: (sec: number) => void): this;
  on(event: "error", listener: (err: PeerError) => void): this;
  on(event: string, listener: Function): this;

  once(event: "open", listener: (peerId: string) => void): this;
  once(event: "call", listener: (conn: MediaConnection) => void): this;
  once(event: "close", listener: () => void): this;
  once(event: "connection", listener: (conn: DataConnection) => void): this;
  once(event: "disconnected", listener: (peerId: string) => void): this;
  once(event: "expiresin", listener: (sec: number) => void): this;
  once(event: "error", listener: (err: PeerError) => void): this;
  once(event: string, listener: Function): this;
}

export default Peer;
