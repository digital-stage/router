/// <reference path='./index.d.ts' />
import { EventEmitter } from 'events'
import bindings from 'bindings'

import { inherits } from 'util'

export interface OvServer extends EventEmitter.EventEmitter {
    new (port: number, prio: number, stageId: string): OvServer

    on(event: 'ready', listener: (port: number) => void): this

    on(
        event: 'connect',
        listener: (report: {
            stageId: string
            ovStageDeviceId: number
            version: string
            ip: string
            localIp: string
            announced: number
            minPing: string
            maxPing: string
            received: string
            lost: number
        }) => void
    ): this

    on(
        event: 'latency',
        listener: (report: {
            stageId: string
            srcOvStageDevceId: number
            destOvStageDeviceId: number
            latency: number
            jitter: number
        }) => void
    ): this

    on(
        event: 'status',
        listener: (report: {
            stageId: string
            pin: number
            serverjitter: number
            port: number
        }) => void
    ): this

    on(event: 'disconnect', listener: (id: number) => void): this

    stop: () => void
}

const NativeOvServer: OvServer = bindings('ovserver').OvServerWrapper

inherits(NativeOvServer, EventEmitter)

export default NativeOvServer
