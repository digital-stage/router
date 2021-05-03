import ITeckosClient from 'teckos-client/dist/ITeckosClient'
import {
    ClientRouterEvents,
    ClientRouterPayloads,
    OvStage,
    Router,
    ServerRouterEvents,
    ServerRouterPayloads,
    Stage,
} from '@digitalstage/api-types'
import NativeOvServer, { OvServer } from './OvServer'
import { OV_MAX_PORT, OV_MIN_PORT } from '../../env'
import logger from '../../logger'

const TIMEOUT: number = 2000

const { info, warn, error } = logger('ov')

class OvService {
    private readonly serverConnection: ITeckosClient

    private readonly router: Router

    private readonly ipv4: string

    private readonly ipv6: string

    private managedStages: {
        [stageId: string]: {
            stage: Stage
            kind: 'audio' | 'video' | 'both'
            ovServer: OvServer
        }
    } = {}

    private ports: {
        [port: number]: string
    } = {}

    private delay: number = 0

    constructor(serverConnection: ITeckosClient, router: Router, ipv4: string, ipv6?: string) {
        this.serverConnection = serverConnection
        this.router = router
        this.ipv4 = ipv4
        this.ipv6 = ipv6
        this.serverConnection.on(ServerRouterEvents.ServeStage, this.manageStage)
        this.serverConnection.on(ServerRouterEvents.UnServeStage, this.unManageStage)
        this.serverConnection.on('disconnect', this.unManageAllStages)
    }

    public close = () => {
        this.unManageAllStages()
        this.serverConnection.off(ServerRouterEvents.ServeStage, this.manageStage)
        this.serverConnection.off(ServerRouterEvents.UnServeStage, this.unManageStage)
        this.serverConnection.off('disconnect', this.unManageAllStages)
    }

    private unManageAllStages = () => {
        Object.keys(this.managedStages).forEach((stageId) => {
            this.managedStages[stageId].ovServer.stop()
        })
        this.managedStages = {}
    }

    private manageStage = async (payload: ServerRouterPayloads.ServeStage) => {
        const { stage } = payload
        if (stage.audioType === 'ov' && !this.managedStages[stage._id]) {
            const port: number | null = this.getFreePort()
            if (port) {
                this.ports[port] = stage._id
                try {
                    const ovServer = await this.startOvServer(port, 50, stage._id)
                    this.managedStages[stage._id] = {
                        stage,
                        kind: 'audio',
                        ovServer,
                    }
                    ovServer.on('status', (status) => {
                        this.serverConnection.emit(ClientRouterEvents.ChangeStage, {
                            _id: status.stageId,
                            ovJitter: status.serverjitter,
                            ovPin: status.pin,
                        } as ClientRouterPayloads.ChangeStage<OvStage>)
                    })
                    ovServer.on('latency', (report) => {
                        this.serverConnection.emit(ClientRouterEvents.ChangeStage, {
                            _id: report.stageId,
                            latency: {
                                [report.srcOvStageDevceId]: {
                                    [report.destOvStageDeviceId]: {
                                        latency: report.latency,
                                        jitter: report.jitter,
                                    },
                                },
                            },
                        } as ClientRouterPayloads.ChangeStage<OvStage>)
                    })
                    info(`Manging stage ${stage._id} '${stage.name}' ${this.ipv4}:${port}`)
                    this.serverConnection.emit(ClientRouterEvents.StageServed, {
                        kind: 'audio',
                        type: 'ov',
                        update: {
                            _id: stage._id,
                            audioRouter: this.router._id,
                            ovIpv4: this.ipv4,
                            ovIpv6: this.ipv6,
                            ovPort: port,
                        },
                    } as ClientRouterPayloads.StageServed)
                } catch (err) {
                    error(err)
                }
            } else {
                warn(`Exhausted: Could not obtain a port for stage ${stage._id} '${stage.name}'`)
            }
        }
    }

    public startOvServer = (port: number, prio: number, stageId: string): Promise<OvServer> => {
        const promise = new Promise<OvServer>((resolve) => {
            const timeout = setTimeout(() => {
                clearTimeout(timeout)
                resolve(new NativeOvServer(port, 50, stageId))
                this.delay -= TIMEOUT
            }, this.delay)
        })
        this.delay += TIMEOUT
        return promise
    }

    private unManageStage = (payload: ServerRouterPayloads.UnServeStage) => {
        const { stageId, type, kind } = payload
        if (type === 'ov' && kind === 'audio') {
            const managedStage = this.managedStages[stageId]
            if (managedStage) {
                info(`Stop serving '${managedStage.stage.name}'`)
                managedStage.ovServer.stop()
                delete this.managedStages[stageId]
                this.serverConnection.emit(ClientRouterEvents.StageUnServed, {
                    type,
                    kind,
                    update: {
                        _id: stageId,
                        audioRouter: null,
                    },
                } as ClientRouterPayloads.StageUnServed)
            }
        }
    }

    private getFreePort = (): number | null => {
        for (let i = OV_MIN_PORT; i <= OV_MAX_PORT; i += 1) {
            if (!this.ports[i]) return i
        }
        return null
    }
}

export default OvService
