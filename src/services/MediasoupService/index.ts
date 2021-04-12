import {UWSProvider} from 'teckos'
import * as mediasoup from 'mediasoup'
import {ITeckosClient} from 'teckos-client'
import * as uWS from 'teckos/uws'
import {TemplatedApp} from 'teckos/uws'
import {DtlsParameters, WebRtcTransport} from 'mediasoup/lib/WebRtcTransport'
import {Router as MediasoupRouter} from 'mediasoup/lib/Router'
import {PlainTransport} from 'mediasoup/lib/PlainTransport'
import {Producer} from 'mediasoup/lib/Producer'
import {Consumer} from 'mediasoup/lib/Consumer'
import omit from 'lodash/omit'
import os from 'os'
import {CONNECTIONS_PER_CPU, DOMAIN, PUBLIC_PORT, ROOT_PATH, WS_PREFIX} from '../../env'
import {RouterRequests} from './events'
import logger from '../../logger'
import {
  ClientRouterEvents,
  ClientRouterPayloads,
  Router,
  ServerRouterEvents,
  ServerRouterPayloads,
} from '../../types'

const {trace, warn, error} = logger('mediasoup')

export interface MediasoupConfiguration {
  worker: mediasoup.types.WorkerSettings
  router: mediasoup.types.RouterOptions
  webRtcTransport: mediasoup.types.WebRtcTransportOptions & {
    maxIncomingBitrate?: number
    minimumAvailableOutgoingBitrate?: number
  }
}

class MediasoupService {
  private readonly serverConnection: ITeckosClient

  private readonly provider: TemplatedApp

  private readonly socket: UWSProvider

  private readonly router: Router

  private readonly config: MediasoupConfiguration

  private initialized: boolean = false

  private mediasoupRouters: {
    router: MediasoupRouter
    numConnections: number
  }[] = []

  private transports: {
    webrtc: {
      [id: string]: WebRtcTransport
    }
    plain: {
      [id: string]: PlainTransport
    }
  } = {
    webrtc: {},
    plain: {},
  }

  private localProducers: {
    [id: string]: Producer
  } = {}

  private localConsumers: {
    [id: string]: Consumer
  } = {}

  constructor(serverConnection: ITeckosClient, router: Router, config: MediasoupConfiguration) {
    this.router = router
    this.config = config
    this.serverConnection = serverConnection
    this.provider = uWS.App()
    this.socket = new UWSProvider(this.provider)
    this.attachRestHandlers()
    this.attachSocketHandlers()
    this.serverConnection.on(
      ServerRouterEvents.ServeStage,
      (payload: ServerRouterPayloads.ServeStage) => {
        const {stage, type, kind} = payload
        if (type === 'mediasoup') {
          trace(
            `API told me to serve mediasoup for ${kind} at stage ${payload.stage.name}`
          )
          let sendPayload: ClientRouterPayloads.StageServed = {
            kind: payload.kind,
            type: 'mediasoup',
            update: {
              _id: stage._id,
              mediasoup: {
                url: WS_PREFIX + "://" + DOMAIN + (ROOT_PATH ? "/" + ROOT_PATH : ""),
                port: PUBLIC_PORT
              }
            },
          }
          if (stage.audioType === 'mediasoup' && stage.videoType === 'mediasoup') {
            // Both
            sendPayload = {
              ...sendPayload,
              update: {
                ...sendPayload.update,
                audioRouter: this.router._id,
                videoRouter: this.router._id,
              },
            }
          } else if (stage.audioType === 'mediasoup') {
            sendPayload = {
              ...sendPayload,
              update: {
                ...sendPayload.update,
                audioRouter: this.router._id,
              },
            }
          } else if (stage.videoType === 'mediasoup') {
            sendPayload = {
              ...sendPayload,
              update: {
                ...sendPayload.update,
                videoRouter: this.router._id,
              },
            }
          }
          this.serverConnection.emit(ClientRouterEvents.StageServed, sendPayload)
        }
      }
    )

    this.serverConnection.on(
      ServerRouterEvents.UnServeStage,
      (payload: ServerRouterPayloads.UnServeStage) => {
        if (payload.type === 'mediasoup') {
          trace(
            `API told me to stop serving ${payload.kind} the mediasoup stage ${payload.stageId}`
          )
          let sendPayload: ClientRouterPayloads.StageUnServed = {
            kind: payload.kind,
            type: 'mediasoup',
            update: {
              _id: payload.stageId,
            },
          }
          if (payload.kind === 'both') {
            sendPayload = {
              ...sendPayload,
              update: {
                ...sendPayload.update,
                audioRouter: null,
                videoRouter: null,
              },
            }
          }
          if (payload.kind === 'audio') {
            sendPayload = {
              ...sendPayload,
              update: {
                ...sendPayload.update,
                audioRouter: null,
              },
            }
          }
          if (payload.kind === 'video') {
            sendPayload = {
              ...sendPayload,
              update: {
                ...sendPayload.update,
                videoRouter: null,
              },
            }
          }
          this.serverConnection.emit(ClientRouterEvents.StageUnServed, sendPayload)
        }
      }
    )
  }

  public start = (port: number): Promise<any> => {
    return this.socket.listen(port)
  }

  public close = () => {
    Object.keys(this.localProducers).forEach((id) => {
      this.localProducers[id].close()
    })
    Object.keys(this.localConsumers).forEach((id) => {
      this.localConsumers[id].close()
    })
    Object.keys(this.transports.webrtc).forEach((id) => {
      this.transports.webrtc[id].close()
    })
    Object.keys(this.transports.plain).forEach((id) => {
      this.transports.plain[id].close()
    })
    this.mediasoupRouters.forEach((mediasoupRouter) => {
      mediasoupRouter.router.close()
    })
  }

  public init = (): Promise<any> => {
    const cpuCount: number = os.cpus().length

    const results: Promise<MediasoupRouter>[] = []
    for (let i = 0; i < cpuCount; i += 1) {
      results.push(
        mediasoup
          .createWorker({
            logLevel: this.config.worker.logLevel,
            logTags: this.config.worker.logTags,
            rtcMinPort: this.config.worker.rtcMinPort,
            rtcMaxPort: this.config.worker.rtcMaxPort,
          })
          .then((worker) => worker.createRouter(this.config.router))
      )
    }
    return Promise.all(results).then((routers) => {
      if (routers.length === 0) {
        throw new Error('No mediasoup routers available')
      }
      routers.map((router) => this.mediasoupRouters.push({router, numConnections: 0}))
      this.initialized = true
      return undefined
    })
  }

  private attachRestHandlers = () => {
    this.provider.get('/beat', (res) => {
      res.end('Boom!')
    })
    this.provider.get('/ping', (res) => {
      res.writeHeader('Content-Type', 'image/svg+xml').end(
        '<svg height="200" width="580" xmlns="http://www.w3.org/2000/svg">\n' +
        '    <path d="m-1-1h582v402h-582z"/>\n' +
        '    <path d="m223 148.453125h71v65h-71z" stroke="#000" stroke-width="1.5"/>\n' +
        '</svg>'
      )
    })
  }

  private attachSocketHandlers = () => {
    this.socket.onConnection((socket) => {
      let transportIds: {} = {}
      let producerIds: {} = {}
      let consumerIds: {} = {}

      try {
        socket.on(
          RouterRequests.GetRTPCapabilities,
          (
            payload: {},
            callback: (
              error: string,
              rtpCapabilities?: mediasoup.types.RtpCapabilities
            ) => void
          ) => {
            trace(RouterRequests.GetRTPCapabilities)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            trace('Sending RTP Capabilities to client')
            return callback(undefined, this.mediasoupRouters[0].router.rtpCapabilities)
          }
        )

        socket.on(
          RouterRequests.CreateTransport,
          (
            payload: {},
            callback: (error: string | null, transportOptions?: any) => void
          ) => {
            trace(RouterRequests.CreateTransport)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const createdRouter: MediasoupRouter | null = this.getAvailableRouter()
            if (!createdRouter) {
              error('Router is full')
              return callback('Router is full')
            }
            return createdRouter
              .createWebRtcTransport({
                preferTcp: false,
                listenIps: this.config.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: this.config.webRtcTransport
                  .initialAvailableOutgoingBitrate,
              })
              .then((transport: WebRtcTransport) => {
                this.transports.webrtc[transport.id] = transport
                transportIds[transport.id] = true

                return callback(null, {
                  id: transport.id,
                  iceParameters: transport.iceParameters,
                  iceCandidates: transport.iceCandidates,
                  dtlsParameters: transport.dtlsParameters,
                  sctpParameters: transport.sctpParameters,
                  appData: transport.appData,
                })
              })
              .catch((err) => {
                error(err)
                return callback('Internal server error')
              })
          }
        )

        socket.on(
          RouterRequests.ConnectTransport,
          (
            payload: {
              transportId: string
              dtlsParameters: DtlsParameters
            },
            callback: (error: string | null) => void
          ) => {
            trace(RouterRequests.ConnectTransport)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const webRtcTransport: WebRtcTransport = this.transports.webrtc[
              payload.transportId
              ]
            if (webRtcTransport) {
              return webRtcTransport
                .connect({dtlsParameters: payload.dtlsParameters})
                .then(() => callback(null))
                .catch((connectionError) => {
                  warn(connectionError)
                  return callback('Internal server error')
                })
            }
            warn(`Could not find transport: ${payload.transportId}`)
            return callback('Internal server error')
          }
        )

        socket.on(
          RouterRequests.CloseTransport,
          (
            payload: {
              transportId: string
              dtlsParameters: DtlsParameters
            },
            callback: (error?: string) => void
          ) => {
            trace(RouterRequests.ConnectTransport)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const webRtcTransport: WebRtcTransport = this.transports.webrtc[
              payload.transportId
              ]
            if (webRtcTransport) {
              webRtcTransport.close()
              this.transports.webrtc = omit(
                this.transports.webrtc,
                payload.transportId
              )
              delete transportIds[webRtcTransport.id]
              return callback()
            }
            warn(`Could not find transport: ${payload.transportId}`)
            return callback('Could not find transport')
          }
        )

        socket.on(
          RouterRequests.CreateProducer,
          (
            payload: {
              transportId: string
              kind: 'audio' | 'video'
              rtpParameters: mediasoup.types.RtpParameters
            },
            callback: (error: string | null, payload?: { id: string }) => void
          ) => {
            trace(RouterRequests.CreateProducer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const transport: any = this.transports.webrtc[payload.transportId]
            if (!transport) {
              warn(`Could not find transport: ${payload.transportId}`)
              return callback('Could not find transport')
            }
            return transport
              .produce({
                kind: payload.kind,
                rtpParameters: payload.rtpParameters,
              })
              .then((producer: Producer) => {
                producer.on('close', () => {
                  trace(`producer closed: ${producer.id}`)
                })
                producer.on('transportclose', () => {
                  trace(`transport closed so producer closed: ${producer.id}`)
                })
                trace(
                  `Created ${payload.kind} producer ${
                    producer.id
                  } and producer is: ${producer.paused ? 'paused' : 'running'}`
                )
                this.localProducers[producer.id] = producer
                producerIds[producer.id] = true
                return callback(null, {
                  id: producer.id,
                })
              })
          }
        )

        socket.on(
          RouterRequests.PauseProducer,
          (id: string, callback: (error: string | null) => void) => {
            trace(RouterRequests.PauseProducer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const producer: Producer = this.localProducers[id]
            if (producer) {
              trace(`Pausing ${producer.kind} producer ${id}`)
              return producer.pause().then(() => callback(null))
            }
            warn(`Could not find producer: ${id}`)
            return callback('Producer not found')
          }
        )

        socket.on(
          RouterRequests.ResumeProducer,
          (id: string, callback: (error: string | null) => void) => {
            trace(RouterRequests.ResumeProducer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const producer: Producer = this.localProducers[id]
            if (producer) {
              trace(`Resuming ${producer.kind} producer ${id}`)
              return producer.resume().then(() => callback(null))
            }
            warn(`Could not find producer: ${id}`)
            return callback('Producer not found')
          }
        )

        socket.on(
          RouterRequests.CloseProducer,
          (id: string, callback: (error: string | null) => void) => {
            trace(RouterRequests.CloseProducer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const producer: Producer = this.localProducers[id]
            if (producer) {
              trace(`Closing ${producer.kind} producer ${id}`)
              producer.close()
              this.localProducers = omit(this.localProducers, producer.id)
              delete producerIds[producer.id]
              return callback(null)
            }
            warn(`Could not find producer: ${id}`)
            return callback('Producer not found')
          }
        )

        socket.on(
          RouterRequests.CreateConsumer,
          async (
            payload: {
              transportId: string
              producerId: string
              rtpCapabilities: mediasoup.types.RtpCapabilities
            },
            callback: (error: string | null, consumer?: any) => void
          ) => {
            trace(RouterRequests.CreateConsumer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            if (this.localProducers[payload.producerId]) {
              const transport: WebRtcTransport = this.transports.webrtc[
                payload.transportId
                ]
              if (!transport) {
                error('Transport not found')
                return callback('Transport not found')
              }
              const consumer: Consumer = await transport.consume({
                producerId: payload.producerId,
                rtpCapabilities: payload.rtpCapabilities,
                paused: true,
              })
              consumer.observer.on('close', () => {
                trace(`consumer closed: ${consumer.id}`)
              })
              trace(
                `Created consumer ${consumer.id} for producer ${
                  payload.producerId
                } and consumer is: ${consumer.paused ? 'paused' : 'running'}`
              )
              this.localConsumers[consumer.id] = consumer
              consumerIds[consumer.id] = true
              return callback(null, {
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                paused: consumer.paused,
                type: consumer.type,
              })
            }
            return callback('Producer not found')
          }
        )

        socket.on(
          RouterRequests.PauseConsumer,
          (id: string, callback: (error: string | null) => void) => {
            trace(RouterRequests.PauseConsumer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const consumer: Consumer = this.localConsumers[id]
            if (consumer) {
              trace(`Pausing consuer ${consumer.id}`)
              return consumer.pause().then(() => callback(null))
            }
            warn(`Could not find consumer: ${id}`)
            return callback('Consumer not found')
          }
        )

        socket.on(
          RouterRequests.ResumeConsumer,
          (id: string, callback: (error: string | null) => void) => {
            trace(RouterRequests.ResumeConsumer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const consumer: Consumer = this.localConsumers[id]
            if (consumer) {
              trace(`Resuming consumer ${consumer.id}`)
              return consumer.resume().then(() => callback(null))
            }
            warn(`Could not find consumer: ${id}`)
            return callback('Consumer not found')
          }
        )

        socket.on(
          RouterRequests.CloseConsumer,
          (id: string, callback: (error: string | null) => void) => {
            trace(RouterRequests.CloseConsumer)
            if (!this.initialized) {
              error('Router is not ready yet')
              return callback('Router is not ready yet')
            }
            const consumer: Consumer = this.localConsumers[id]
            if (consumer) {
              trace(`Closing consuer ${consumer.id}`)
              consumer.close()
              this.localConsumers = omit(this.localConsumers, id)
              delete consumerIds[consumer.id]
              return callback(null)
            }
            warn(`Could not find consumer: ${id}`)
            return callback('Consumer not found')
          }
        )

        socket.on('disconnect', () => {
          trace('Client disconnected, cleaning up')
          Object.keys(consumerIds).forEach((key) => {
            if (this.localConsumers[key]) {
              trace(`Removing consumer ${key}`)
              this.localConsumers[key].close()
              delete this.localConsumers[key]
            }
          })
          consumerIds = {}
          Object.keys(producerIds).forEach((key) => {
            if (producerIds[key]) {
              trace(`Removing producer ${key}`)
              this.localProducers[key].close()
              delete this.localProducers[key]
            }
          })
          producerIds = {}
          Object.keys(transportIds).forEach((key) => {
            if (transportIds[key]) {
              trace(`Removing transport ${key}`)
              this.transports.webrtc[key].close()
              delete this.transports.webrtc[key]
            }
          })
          transportIds = {}
        })
      } catch (socketError) {
        socket.disconnect()
        error(socketError)
      }
    })
  }

  private getAvailableRouter = (): MediasoupRouter | null => {
    for (let i = 0; i < this.mediasoupRouters.length; i += 1) {
      if (this.mediasoupRouters[i].numConnections < CONNECTIONS_PER_CPU) {
        return this.mediasoupRouters[i].router
      }
    }
    return null
  }
}

export default MediasoupService
