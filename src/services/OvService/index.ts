import ITeckosClient from "teckos-client/dist/ITeckosClient";
import NativeOvServer, {OvServer} from "./OvServer";
import {OV_MAX_PORT, OV_MIN_PORT} from "../../env";
import logger from "../../logger";
import {
  ClientRouterEvents,
  ClientRouterPayloads,
  ServerRouterEvents,
  ServerRouterPayloads,
  Stage
} from "../../types";

const TIMEOUT: number = 2000;

const {info, warn, error} = logger("ov");

class OvService {
  private readonly serverConnection: ITeckosClient;
  private readonly ipv4: string;
  private readonly ipv6: string;
  private managedStages: {
    [stageId: string]: {
      stage: Stage,
      //kind: "audio" | "video" | "both";
      ovServer: OvServer
    }
  } = {};
  private ports: {
    [port: number]: string
  } = {};
  private delay: number = 0;

  constructor(serverConnection: ITeckosClient, ipv4: string, ipv6?: string) {
    this.serverConnection = serverConnection;
    this.ipv4 = ipv4;
    this.ipv6 = ipv6;
    this.serverConnection.on(ServerRouterEvents.ServeStage, this.manageStage);
    this.serverConnection.on(ServerRouterEvents.UnServeStage, this.unManageStage);
  }

  public close = () => {
    Object.keys(this.managedStages).map(stageId => {
      this.managedStages[stageId].ovServer.stop();
    });
    this.serverConnection.off(ServerRouterEvents.ServeStage, this.manageStage);
    this.serverConnection.off(ServerRouterEvents.UnServeStage, this.unManageStage);
  }

<<<<<<< Updated upstream
    private manageStage = async (stage: Stage) => {
        if (!this.managedStages[stage._id]) {
            const port: number | null = this.getFreePort();
            if (port) {
                this.ports[port] = stage._id;
                try {
                    const ovServer = await this.startOvServer(port, 50, stage._id);
                    this.managedStages[stage._id] = {
                        stage,
                        ovServer
                    };
                    ovServer.on("status", (status) => {
                        this.serverConnection.emit(ClientRouterEvents.STAGE_MANAGED, {
                            id: status.stageId,
                            ovServer: {
                                ipv4: this.ipv4,
                                ipv6: this.ipv6,
                                port,
                                serverJitter: status.serverjitter,
                                pin: status.pin,
                            }
                        });
                    });
                    ovServer.on("latency", (report) => {
                        this.serverConnection.emit(ClientRouterEvents.REPORT_LATENCY, {
                            stageId: report.stageId,
                            latency: {
                                [report.srcOvStageDevceId]: {
                                    [report.destOvStageDeviceId]: {
                                        latency: report.latency,
                                        jitter: report.jitter
                                    }
                                }
                            }
                        });
                    });
                    info("Manging stage " + stage._id + " '" + stage.name + "'");
                    this.serverConnection.emit(ClientRouterEvents.STAGE_MANAGED, {
                        id: stage._id,
                        ovServer: {
                            ipv4: this.ipv4,
                            ipv6: this.ipv6,
                            port
                        }
                    });
                } catch (err) {
                    error(err);
=======
  private manageStage = async (payload: ServerRouterPayloads.ServeStage) => {
    const {stage} = payload;
    if (!this.managedStages[stage._id]) {
      const port: number | null = this.getFreePort();
      if (port) {
        this.ports[port] = stage._id;
        try {
          const ovServer = await this.startOvServer(port, 50, stage._id);
          this.managedStages[stage._id] = {
            stage,
            ovServer
          };
          ovServer.on("status", (status) => {
            this.serverConnection.emit(ClientRouterEvents.StageServed, {
              _id: status.stageId,
              ovServer: {
                ipv4: this.ipv4,
                ipv6: this.ipv6,
                port,
                serverJitter: status.serverjitter,
                pin: status.pin,
              }
            } as ClientRouterPayloads.StageServed);
          });
          ovServer.on("latency", (report) => {
            this.serverConnection.emit(ClientRouterEvents.StageServed, {
              _id: report.stageId,
              ovServer: {
                latency: {
                  [report.srcOvStageDevceId]: {
                    [report.destOvStageDeviceId]: {
                      latency: report.latency,
                      jitter: report.jitter
                    }
                  }
>>>>>>> Stashed changes
                }
              }
            } as ClientRouterPayloads.StageServed);
          });
          info("Manging stage " + stage._id + " '" + stage.name + "'");
          this.serverConnection.emit(ClientRouterEvents.StageServed, {
            _id: stage._id,
            ovServer: {
              ipv4: this.ipv4,
              ipv6: this.ipv6,
              port
            }
          } as ClientRouterPayloads.StageServed);
        } catch (err) {
          error(err);
        }
      } else {
        warn("Exhausted: Could not obtain a port for stage " + stage._id + " '" + stage.name + "'");
      }
    }
  }

  public startOvServer = (port: number, prio: number, stageId: string): Promise<OvServer> => {
    const promise = new Promise<OvServer>((resolve) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve(new NativeOvServer(port, 50, stageId));
        this.delay -= TIMEOUT;
      }, this.delay);
    });
    this.delay += TIMEOUT;
    return promise;
  }

  private unManageStage = (stageId: string) => {
    const managedStage = this.managedStages[stageId];
    if (managedStage) {
      managedStage.ovServer.stop();
      delete this.managedStages[stageId];

      this.serverConnection.emit(ClientRouterEvents.StageUnServed, {
        stageId,
        type: "mediasoup",
        //kind: managedStage.kind,
      } as ClientRouterPayloads.StageUnServed);
    }
  }

  private getFreePort = (): number | null => {
    for (let i = OV_MIN_PORT; i <= OV_MAX_PORT; i++) {
      if (!this.ports[i])
        return i;
    }
    return null;
  };
}

export default OvService;
