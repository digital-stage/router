import {
  ANNOUNCED_IP, CITY, COUNTRY_CODE, DOMAIN,
  IP_V4,
  IP_V6, LATITUDE,
  LISTEN_IP, LONGITUDE,
  MEDIASOUP_CONFIG,
  OV_MAX_PORT,
  PUBLIC_PORT, REST_PREFIX, ROOT_PATH,
  RTC_MAX_PORT,
  RTC_MIN_PORT, USE_IPV6, WS_PREFIX
} from "./env";
import * as publicIp from "public-ip";
import {MediasoupConfiguration} from "./services/MediasoupService";
import {Router} from "./types";
import iplocate from "node-iplocate";

const getDefaultMediasoupConfig = (ipv4: string): MediasoupConfiguration => {
  return {
    ...MEDIASOUP_CONFIG,
    webRtcTransport: {
      ...MEDIASOUP_CONFIG.webRtcTransport,
      listenIps: [
        {
          ip: LISTEN_IP || '0.0.0.0',
          announcedIp: ANNOUNCED_IP || ipv4,
        },
      ],
    }
  };
}

const getInitialRouter = async (): Promise<Omit<Router, "_id">> => {
  const ipv4: string = IP_V4 || await publicIp.v4()
  const ipv6: string = USE_IPV6 ? IP_V6 || await publicIp.v6() : undefined;
  const locates = await iplocate(ipv4);
  console.log("LOCATES");
  console.log(locates);
  return {
    wsPrefix: WS_PREFIX,
    restPrefix: REST_PREFIX,
    url: DOMAIN,
    path: ROOT_PATH,
    ipv4: ipv4,
    ipv6: ipv6,
    port: PUBLIC_PORT,
    availableRTCSlots: (RTC_MAX_PORT - RTC_MIN_PORT),
    availableOVSlots: (OV_MAX_PORT - RTC_MIN_PORT),
    countryCode: COUNTRY_CODE || locates.country_code,
    city: CITY || locates.city,
    position: {
      lat: LATITUDE || locates.latitude,
      lng: LONGITUDE || locates.longitude
    }
  };
}

export {
  getInitialRouter,
  getDefaultMediasoupConfig
}
