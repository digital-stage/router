import {TeckosClient} from "teckos-client";
import {API_KEY, API_URL, PORT} from "./env";
import {getDefaultMediasoupConfig, getInitialRouter} from "./utils";
import OvService from "./services/OvService";
import MediasoupService from "./services/MediasoupService";
import ITeckosClient from "teckos-client/dist/ITeckosClient";
import logger from "./logger";
import {ClientRouterEvents, ServerRouterEvents, ServerRouterPayloads} from "./types";

const {info, warn, error} = logger("");

let ovService: OvService;
let mediasoupService: MediasoupService;
let serverConnection: ITeckosClient;

declare global {
  namespace NodeJS {
    interface Global {
      __rootdir__: string;
    }
  }
}

const startService = () => {
  return getInitialRouter()
    .then((initialRouter) => {
      info("Using public IPv4 " + initialRouter.ipv4);
      info("Using public IPv6 " + initialRouter.ipv6);

      console.log(initialRouter);

      serverConnection = new TeckosClient(API_URL);

      const mediasoupConfig = getDefaultMediasoupConfig(initialRouter.ipv4);


      serverConnection.on(ServerRouterEvents.Ready, (router: ServerRouterPayloads.Ready) => {
          info("Successful authenticated on API server");
          const startServices = async function() {
            if (!ovService) {
              info("Starting ov service");
              ovService = new OvService(serverConnection, initialRouter.ipv4, initialRouter.ipv6);
            }
            if (!mediasoupService) {
              info("Starting mediasoup service");
              mediasoupService = new MediasoupService(serverConnection, router, mediasoupConfig);
              await mediasoupService.init();
              await mediasoupService.start(PORT);
              info("Running mediasoup on port " + PORT);
            }
          };
          startServices()
            .then(() => serverConnection.emit(ClientRouterEvents.Ready));
        }
      );

      serverConnection.on("disconnect", () => {
        warn("Disconnected from API server");
        /*if( ovService ) {
          info("Shutting down ov service");
          ovService.close();
          ovService = undefined;
        }
        if (mediasoupService) {
          info("Shutting down mediasoup service");
          mediasoupService.close();
          mediasoupService = undefined;
        }*/
      });

      serverConnection.on("connect", () => {
        info("Successful connected to API server");
        // Send initial router and authorize via api key
        serverConnection.emit("router", {
          apiKey: API_KEY,
          router: initialRouter
        })
      })

      serverConnection.connect();
    });
}

process.on('SIGTERM', () => {
  console.info('Shutting down services...');
  if (ovService)
    ovService.close();
  if (mediasoupService)
    mediasoupService.close();
  if (serverConnection)
    serverConnection.close();
  console.info('All services shut down.');
});

info("Starting service...");
startService()
  .then(() => info("Service started!"))
  .catch((err) => error(err));
