import * as publicIp from 'public-ip'
import iplocate from 'node-iplocate'
import { Router } from '@digitalstage/api-types'
import {
    ANNOUNCED_IP,
    CITY,
    COUNTRY_CODE,
    DOMAIN,
    IP_V4,
    IP_V6,
    JAMMER_MAX_PORT,
    JAMMER_MIN_PORT,
    LATITUDE,
    LISTEN_IP,
    LONGITUDE,
    MEDIASOUP_CONFIG,
    OV_MAX_PORT,
    OV_MIN_PORT,
    PUBLIC_PORT,
    REST_PREFIX,
    ROOT_PATH,
    RTC_MAX_PORT,
    RTC_MIN_PORT,
    USE_IPV6,
    WS_PREFIX,
} from './env'
import { MediasoupConfiguration } from './services/MediasoupService'

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
        },
    }
}

const getInitialRouter = async (): Promise<Omit<Router, '_id'>> => {
    const ipv4: string = IP_V4 || (await publicIp.v4())
    const ipv6: string = USE_IPV6 ? IP_V6 || (await publicIp.v6()) : undefined
    const locates = await iplocate(ipv4)
    return {
        wsPrefix: WS_PREFIX,
        restPrefix: REST_PREFIX,
        url: DOMAIN,
        path: ROOT_PATH,
        ipv4,
        ipv6,
        port: PUBLIC_PORT,
        availableRTCSlots: RTC_MAX_PORT - RTC_MIN_PORT,
        availableOVSlots: OV_MAX_PORT - OV_MIN_PORT,
        availableJammerSlots: JAMMER_MAX_PORT - JAMMER_MIN_PORT,
        countryCode: COUNTRY_CODE || locates.country_code,
        city: CITY || locates.city,
        position: {
            lat: LATITUDE || locates.latitude,
            lng: LONGITUDE || locates.longitude,
        },
        types: {
            mediasoup: RTC_MAX_PORT - RTC_MIN_PORT,
            ov: OV_MAX_PORT - OV_MIN_PORT,
        },
    }
}

export { getInitialRouter, getDefaultMediasoupConfig }
