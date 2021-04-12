/// <reference path='./index.d.ts' />
import { EventEmitter } from 'events'
import bindings from 'bindings'

import { inherits } from 'util'

export interface JammerServer extends EventEmitter.EventEmitter {
    new (cryptoKey: string, port: number, stageId: string): JammerServer

    on(event: 'ready', listener: (port: number) => void): this

    stop: () => void
}

const NativeJammerServer: JammerServer = bindings('jammerserver').JammerServerWrapper

inherits(NativeJammerServer, EventEmitter)

export default NativeJammerServer
