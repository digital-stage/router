import { EventEmitter } from 'events'

declare class JammerServer extends EventEmitter.EventEmitter {
    constructor(cryptoKey: string, port: number, stageId: string)

    on(event: 'ready', listener: (port: number) => void): this

    stop: () => void
}

export = JammerServer
