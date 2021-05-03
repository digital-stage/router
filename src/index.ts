import { TeckosClient } from 'teckos-client'
import ITeckosClient from 'teckos-client/dist/ITeckosClient'
import {
    ClientRouterEvents,
    ServerRouterEvents,
    ServerRouterPayloads,
} from '@digitalstage/api-types'
import { API_KEY, API_URL, PORT } from './env'
import { getDefaultMediasoupConfig, getInitialRouter } from './utils'
import OvService from './services/OvService'
import MediasoupService from './services/MediasoupService'
import logger from './logger'
import JammerService from './services/JammerService'

const { info, warn, error } = logger('')

let ovService: OvService
let jammerService: JammerService
let mediasoupService: MediasoupService
let serverConnection: ITeckosClient

const startService = () => {
    return getInitialRouter().then(async (initialRouter) => {
        info(`Using public IPv4 ${initialRouter.ipv4}`)
        info(`Using public IPv6 ${initialRouter.ipv6}`)

        serverConnection = new TeckosClient(API_URL)

        const mediasoupConfig = getDefaultMediasoupConfig(initialRouter.ipv4)

        mediasoupService = new MediasoupService(mediasoupConfig, PORT)
        await mediasoupService.listen()
        info(`Running mediasoup on port ${PORT}`)

        serverConnection.on(ServerRouterEvents.Ready, (router: ServerRouterPayloads.Ready) => {
            info('Successful authenticated on API server')
            const startServices = async () => {
                if (!jammerService) {
                    info('Starting jammer service')
                    jammerService = new JammerService(
                        serverConnection,
                        router,
                        initialRouter.ipv4,
                        initialRouter.ipv6
                    )
                }
                if (!ovService) {
                    info('Starting ov service')
                    ovService = new OvService(
                        serverConnection,
                        router,
                        initialRouter.ipv4,
                        initialRouter.ipv6
                    )
                }
                info('Starting mediasoup service')
                await mediasoupService.start(serverConnection, router)
            }
            return startServices()
                .then(() => serverConnection.emit(ClientRouterEvents.Ready))
                .catch((err) => error(err))
        })

        serverConnection.on('disconnect', () => {
            warn('Disconnected from API server')
            if (jammerService) {
                info('Shutting down jammer service')
                jammerService.close()
                jammerService = undefined
            }
            if (ovService) {
                info('Shutting down ov service')
                ovService.close()
                ovService = undefined
            }
            if (mediasoupService) {
                info('Shutting down mediasoup service')
                mediasoupService.close()
            }
        })

        serverConnection.on('connect', () => {
            info('Successful connected to API server')
            // Send initial router and authorize via api key
            serverConnection.emit('router', {
                apiKey: API_KEY,
                router: initialRouter,
            })
        })

        return serverConnection.connect()
    })
}

process.on('SIGTERM', () => {
    info('Shutting down services...')
    if (ovService) ovService.close()
    if (mediasoupService) mediasoupService.close()
    if (serverConnection) serverConnection.close()
    info('All services shut down.')
})

info('Starting service...')
startService()
    .then(() => info('Service started!'))
    .catch((err) => error(err))
