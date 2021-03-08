export interface Stage {
    _id: string;
    name: string;

    // SETTINGS
    admins: string[];
    password: string | null;
    // 3D Room specific
    width: number;
    length: number;
    height: number;
    absorption: number;
    damping: number;

    renderAmbient: boolean;
    ambientSoundUrl?: string;
    ambientLevel: number;

    ovServer?: {
        router: string;
        ipv4: string;
        ipv6?: string;
        port: number;
        pin: number;
        serverJitter?: number;
    };

    ovLatency?: {
        [srcOvStageDeviceId: number]: {
            [desOvStageDeviceId: number]: {
                latency: number;
                jitter: number;
            };
        };
    };
}
