// Módulo de autenticación
import { getSupabase, onAuthChange, getUserId, getIsAuthReady } from './supabaseClient.js';

let userIdDisplay, authPrompt, authRequiredElements, signInWithMicrosoftBtn, messageBox;
let showViewFunction = null; // Función para cambiar de vista

function toggleUI(authenticated) {
    console.log('toggleUI llamado con authenticated:', authenticated);
    if (authenticated) {
        if (authPrompt) {
            authPrompt.style.display = 'none';
        }
        if (authRequiredElements) {
            authRequiredElements.forEach(el => el.classList.add('authenticated'));
        }
        // Redirigir automáticamente a la vista de búsqueda cuando se autentica
        if (showViewFunction) {
            console.log('Redirigiendo a vista de búsqueda...');
            showViewFunction('search');
        } else {
            console.error('showViewFunction no está disponible');
        }
    } else {
        if (authPrompt) {
            authPrompt.style.display = 'block';
        }
        if (authRequiredElements) {
            authRequiredElements.forEach(el => el.classList.remove('authenticated'));
        }
        if (userIdDisplay) {
            userIdDisplay.innerText = 'No Autenticado';
        }
    }
}

function showMessage(message, duration = 3000) {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.classList.add('show');
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, duration);
}

export async function signInWithMicrosoft() {
    const supabase = getSupabase();
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'microsoft',
            options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
    } catch (error) {
        showMessage('Error al iniciar sesión con Microsoft: ' + error.message, 5000);
    }
}

export async function signInAnonymously() {
    console.log('Intentando iniciar sesión como invitado...');
    const supabase = getSupabase();
    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
            console.error('Error en Supabase al intentar signInAnonymously:', error);
            throw error;
        }
        console.log('Sesión anónima exitosa:', data);
    } catch (error) {
        console.error('Error capturado en signInAnonymously:', error);
        showMessage('Error al iniciar sesión anónima: ' + error.message, 5000);
    }
}

export function setupAuth(showViewFn) {
    showViewFunction = showViewFn; // Guardar la función de cambio de vista
    userIdDisplay = document.getElementById('userIdDisplay');
    authPrompt = document.getElementById('authPrompt');
    signInWithMicrosoftBtn = document.getElementById('signInWithMicrosoftBtn');
    messageBox = document.getElementById('messageBox');
    authRequiredElements = document.querySelectorAll('.auth-required');

    if (signInWithMicrosoftBtn) {
        signInWithMicrosoftBtn.addEventListener('click', signInWithMicrosoft);
    }

    // Registrar el listener de autenticación siempre
    onAuthChange((userId, isAuthReady) => {
        // Re-obtener las referencias a los elementos del DOM en cada cambio
        // ya que pueden no estar disponibles en todas las vistas
        userIdDisplay = document.getElementById('userIdDisplay');
        authPrompt = document.getElementById('authPrompt');
        authRequiredElements = document.querySelectorAll('.auth-required');
        
        toggleUI(isAuthReady);
        if (userIdDisplay) {
            userIdDisplay.innerText = isAuthReady ? `ID: ${userId}` : 'No Autenticado';
        }
    });
}

export { showMessage }; 