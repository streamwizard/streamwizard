'use server';

import axios from 'axios';
import { createClient } from '@/lib/supabase/server';


const SWBridgeApi = axios.create({
    baseURL: 'http://localhost:8080/api/',
    headers: {
        'Content-Type': 'application/json',
    },
});



SWBridgeApi.interceptors.request.use(async (config) => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw error;
    }
    config.headers.Authorization = `Bearer ${data.session?.access_token}`;
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default SWBridgeApi;