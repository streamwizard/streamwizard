'use server';

import SWBridgeApi from '@/server/axios/SW-SMP-bridge-api';

export async function triggerEvent(
    action: string,
    streamer_id: string,
    metadata?: Record<string, any>,
    event_data?: Record<string, any>
) {
    const response = await SWBridgeApi.post('/websocket/trigger', {
        action,
        streamer_id,
        metadata,
        event_data,
    });
    return response.data;
}