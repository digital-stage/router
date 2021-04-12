import { EventEmitter } from 'events'

declare class OvServer extends EventEmitter.EventEmitter {
    constructor(port: number, prio: number, group: string, name: string)

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

export = OvServer
