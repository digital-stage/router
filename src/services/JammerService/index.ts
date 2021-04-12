import ITeckosClient from 'teckos-client/dist/ITeckosClient'
import NativeJammerServer, { JammerServer } from './JammerServer'
import { JAMMER_MAX_PORT, JAMMER_MIN_PORT } from '../../env'
import logger from '../../logger'
import {
    ClientRouterEvents,
    ClientRouterPayloads,
    JammerStage,
    Router,
    ServerRouterEvents,
    ServerRouterPayloads,
    Stage,
} from '../../types'

const TIMEOUT: number = 2000

const { info, warn, error } = logger('jammer')

class JammerService {
    private readonly serverConnection: ITeckosClient

    private readonly router: Router

    private readonly ipv4: string

    private readonly ipv6: string

    private managedStages: {
        [stageId: string]: {
            stage: Stage
            kind: 'audio' | 'video' | 'both'
            jammerServer: JammerServer
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

    private unManageAllStages = () => {
        Object.keys(this.managedStages).forEach((stageId) => {
            this.managedStages[stageId].jammerServer.stop()
        })
        this.managedStages = {}
    }

    public close = () => {
        this.unManageAllStages()
        this.serverConnection.off(ServerRouterEvents.ServeStage, this.manageStage)
        this.serverConnection.off(ServerRouterEvents.UnServeStage, this.unManageStage)
        this.serverConnection.off('disconnect', this.unManageAllStages)
    }

    private manageStage = async (payload: ServerRouterPayloads.ServeStage) => {
        const { stage } = payload
        if (stage.audioType === 'jammer' && !this.managedStages[stage._id]) {
            const port: number | null = this.getFreePort()
            if (port) {
                this.ports[port] = stage._id
                try {
                    const key: string = 'blablabla'
                    const jammerServer = await this.startJammerServer(key, port, stage._id)
                    this.managedStages[stage._id] = {
                        stage,
                        kind: 'audio',
                        jammerServer,
                    }
                    jammerServer.on('ready', (listenPort) => {
                        info(`Jammer is ready at port ${listenPort}`)
                    })
                    info(`Manging stage ${stage._id} '${stage.name}' ${this.ipv4}:${port}`)
                    this.serverConnection.emit(ClientRouterEvents.StageServed, {
                        kind: 'audio',
                        type: 'jammer',
                        update: {
                            _id: stage._id,
                            audioRouter: this.router.id,
                            jammerIpv4: this.ipv4,
                            jammerIpv6: this.ipv6,
                            jammerPort: port,
                            jammerKey: key,
                        },
                    } as ClientRouterPayloads.StageServed<JammerStage>)
                } catch (err) {
                    error(err)
                }
            } else {
                warn(`Exhausted: Could not obtain a port for stage ${stage._id} '${stage.name}'`)
            }
        }
    }

    public startJammerServer = (
        key: string,
        port: number,
        stageId: string
    ): Promise<JammerServer> => {
        // TODO: Create secret key
        const promise = new Promise<JammerServer>((resolve) => {
            const timeout = setTimeout(() => {
                clearTimeout(timeout)
                resolve(new NativeJammerServer(key, port, stageId))
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
                managedStage.jammerServer.stop()
                delete this.managedStages[stageId]

                this.serverConnection.emit(ClientRouterEvents.StageUnServed, {
                    type,
                    kind,
                    update: {
                        _id: stageId,
                        audioRouter: null,
                    },
                } as ClientRouterPayloads.StageUnServed<JammerStage>)
            }
        }
    }

    private getFreePort = (): number | null => {
        for (let i = JAMMER_MIN_PORT; i <= JAMMER_MAX_PORT; i += 1) {
            if (!this.ports[i]) return i
        }
        return null
    }
}

export default JammerService
