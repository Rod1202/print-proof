// Módulo para inicializar y exportar el cliente de Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pvnggaleugsmqokcbugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bmdnYWxldWdzbXFva2NidWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODk3MTksImV4cCI6MjA2NTk2NTcxOX0.p3csZRJkUWy4kEkpkG3q-MF1-b7UudHRRbfQb5epbS4';

let supabase = null;
let userId = null;
let isAuthReady = false;
let authListeners = [];

export function initSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabase.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                userId = session.user.id;
                isAuthReady = true;
            } else {
                userId = null;
                isAuthReady = false;
            }
            // Notificar a los listeners
            authListeners.forEach(fn => fn(userId, isAuthReady));
        });
    }
    return supabase;
}

export function getSupabase() {
    return supabase;
}

export function getUserId() {
    return userId;
}

export function getIsAuthReady() {
    return isAuthReady;
}

export function onAuthChange(fn) {
    authListeners.push(fn);
} 