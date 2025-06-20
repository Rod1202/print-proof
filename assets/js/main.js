// Archivo principal de la app. Aquí se importan los módulos y se inicializa la aplicación.
import { initSupabase, getSupabase, getUserId, getIsAuthReady } from '../../modules/supabaseClient.js';
import { setupAuth, showMessage, signInWithMicrosoft, signInAnonymously } from '../../modules/auth.js';
import { setupPrinterForm } from '../../modules/printerForm.js';
import { setupFileUpload, uploadedFiles, resetFiles, updateFileList } from '../../modules/fileUpload.js';
import { setupSearch } from '../../modules/search.js';

// Estado global de la vista actual
let currentView = 'auth'; // 'auth', 'search', 'register', 'results', 'edit'
let lastSearchResults = null;
let lastEditData = null;

// Carga una vista parcial desde /views/{viewName}.html y ejecuta callback tras cargar
async function loadView(viewName, afterLoad) {
    const mainView = document.getElementById('mainView');
    const response = await fetch(`views/${viewName}.html`);
    const html = await response.text();
    mainView.innerHTML = html;
    if (afterLoad) afterLoad();
}

export function showView(view, data = null) {
    currentView = view;
    switch (view) {
        case 'auth':
            loadView('auth', () => setupAuthEvents(showView));
            break;
        case 'search':
            loadView('search', setupSearchEvents);
            break;
        case 'register':
            loadView('register', setupRegisterEvents);
            break;
        case 'results':
            loadView('results', () => setupResultsEvents(data));
            break;
        case 'edit':
            loadView('edit', () => setupEditEvents(data));
            break;
    }
}

// VISTA 1: Autenticación
function setupAuthEvents(showViewFn) {
    document.getElementById('signInWithMicrosoftBtn').onclick = () => {
        signInWithMicrosoft();
    };
    const guestButton = document.getElementById('guestLoginBtn');
    if (guestButton) {
        guestButton.onclick = () => {
            console.log('Botón de invitado clickeado.');
            signInAnonymously();
        };
    } else {
        console.error('No se encontró el botón de invitado (guestLoginBtn).');
    }
    
    // Configurar la autenticación con la función de cambio de vista
    setupAuth(showViewFn);
}

// VISTA 2: Búsqueda
function setupSearchEvents() {
    document.getElementById('registerBtn').onclick = () => showView('register');
    document.getElementById('searchBtnView').onclick = async () => {
        const searchTerm = document.getElementById('searchInputView').value.trim();
        if (!getIsAuthReady() || !getUserId()) {
            showMessage('Debes iniciar sesión.', 3000);
            return;
        }
        const supabase = getSupabase();
        let orQuery = [
            `serie.ilike.%${searchTerm}%`,
            `current_cliente.ilike.%${searchTerm}%`,
            `current_modelo.ilike.%${searchTerm}%`,
            `current_estado.ilike.%${searchTerm}%`
        ].join(',');
        try {
            const { data, error } = await supabase
                .from('printers')
                .select('*')
                .or(orQuery)
                .eq('user_id', getUserId());
            if (error) throw error;
            lastSearchResults = data;
            showView('results', lastSearchResults);
        } catch (error) {
            showMessage('Error al buscar: ' + error.message, 4000);
        }
    };
}

// VISTA 3: Registro
function setupRegisterEvents() {
    document.getElementById('registerForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!getIsAuthReady() || !getUserId()) {
            showMessage('Debes iniciar sesión.', 3000);
            return;
        }
        const form = e.target;
        const data = {
            serie: form.serie.value.trim() || null,
            current_modelo: form.current_modelo.value.trim() || null,
            current_cliente: form.current_cliente.value.trim() || null,
            current_contacto: form.current_contacto.value.trim() || null,
            current_direccion: form.current_direccion.value.trim() || null,
            current_sede: form.current_sede.value.trim() || null,
            current_empresa: form.current_empresa.value.trim() || null,
            current_dpto: form.current_dpto.value.trim() || null,
            current_provincia: form.current_provincia.value.trim() || null,
            current_distrito: form.current_distrito.value.trim() || null,
            current_zona: form.current_zona.value.trim() || null,
            current_estado: form.current_estado.value || null,
            current_observaciones: form.current_observaciones.value.trim() || null,
            user_id: getUserId()
        };
        
        // Filtrar campos null para evitar problemas con la base de datos
        const cleanData = {};
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
                cleanData[key] = data[key];
            }
        });
        
        console.log('Datos a enviar:', cleanData);
        console.log('User ID:', getUserId());
        console.log('Is Auth Ready:', getIsAuthReady());
        
        if (!cleanData.serie) {
            showMessage('El campo SERIE es obligatorio.', 3000);
            return;
        }
        const supabase = getSupabase();
        try {
            const { data: inserted, error } = await supabase
                .from('printers')
                .insert(cleanData)
                .select('id');
            if (error) {
                console.error('Error de Supabase:', error);
                if (error.code === '23505') {
                    showMessage('Ya existe una impresora con esa serie.', 4000);
                } else {
                    showMessage('Error al guardar: ' + error.message, 4000);
                }
                return;
            }
            // Subida de archivos con categoría
            const printerId = inserted[0].id;
            await uploadAllFiles(printerId);
            showMessage('Registro guardado correctamente.', 2000);
            showView('search');
        } catch (error) {
            console.error('Error capturado:', error);
            showMessage('Error al guardar: ' + error.message, 4000);
        }
    };
    document.getElementById('cancelRegisterBtn').onclick = () => showView('search');
    setupFileCategoryEvents();
}

async function uploadAllFiles(printerId) {
    const supabase = getSupabase();
    const userId = getUserId();
    const fileCategory = document.getElementById('fileCategorySelect')?.value || 'general';
    
    // Solo procesar archivos si hay archivos para subir
    if (uploadedFiles.length === 0) {
        console.log('No hay archivos para subir');
        return;
    }
    
    for (const fileObj of uploadedFiles) {
        if (fileObj.file) {
            const filePath = `${userId}/${printerId}/${fileObj.name}`;
            // Subir a Storage
            const { error: storageError } = await supabase.storage
                .from('printer-documents')
                .upload(filePath, fileObj.file, { cacheControl: '3600', upsert: true });
            if (storageError) {
                showMessage('Error al subir archivo: ' + storageError.message, 4000);
                continue;
            }
            // Obtener URL pública
            const { data: publicUrlData } = supabase.storage
                .from('printer-documents')
                .getPublicUrl(filePath);
            // Insertar metadatos
            const fileMetadata = {
                printer_id: printerId,
                file_name: fileObj.name,
                file_size: fileObj.size,
                file_type: fileObj.type,
                storage_path: filePath,
                download_url: publicUrlData.publicUrl,
                file_category: fileCategory,
                user_id: userId
            };
            await supabase.from('printer_files').insert(fileMetadata);
        }
    }
    
    // Solo resetear archivos si estamos en una vista donde el elemento fileList existe
    try {
        resetFiles();
        updateFileList();
    } catch (error) {
        console.warn('No se pudo resetear la lista de archivos:', error);
        // Limpiar el array de archivos de todas formas
        uploadedFiles.length = 0;
    }
}

function setupFileCategoryEvents() {
    // Puedes usar este hook para manejar la categoría de archivos al subir
    const fileCategorySelect = document.getElementById('fileCategorySelect');
    if (fileCategorySelect) {
        fileCategorySelect.onchange = () => {
            // Aquí puedes guardar la categoría seleccionada para usarla al subir archivos
            // Ejemplo: window.selectedFileCategory = fileCategorySelect.value;
        };
    }
}

// VISTA 4: Resultados
function setupResultsEvents(data) {
    const resultsList = document.getElementById('resultsList');
    if (!data || data.length === 0) {
        resultsList.innerHTML = '<li class="list-group-item">No se encontraron resultados.</li>';
    } else {
        resultsList.innerHTML = data.map(item => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span><b>${item.serie}</b> - ${item.current_cliente} (${item.current_modelo}) <span class="badge bg-info">${item.current_estado || ''}</span></span>
                <button class="btn btn-primary btn-sm editResultBtn" data-id="${item.id}"><i class="fas fa-edit"></i> Editar</button>
            </li>
        `).join('');
        document.querySelectorAll('.editResultBtn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                lastEditData = data.find(x => x.id == id);
                showView('edit', lastEditData);
            };
        });
    }
    document.getElementById('backToSearchBtn').onclick = () => showView('search');
}

// VISTA 5: Edición
function setupEditEvents(data) {
    if (data) {
        document.getElementById('serie').value = data.serie || '';
        document.getElementById('current_modelo').value = data.current_modelo || '';
        document.getElementById('current_cliente').value = data.current_cliente || '';
        document.getElementById('current_contacto').value = data.current_contacto || '';
        document.getElementById('current_direccion').value = data.current_direccion || '';
        document.getElementById('current_sede').value = data.current_sede || '';
        document.getElementById('current_empresa').value = data.current_empresa || '';
        document.getElementById('current_dpto').value = data.current_dpto || '';
        document.getElementById('current_provincia').value = data.current_provincia || '';
        document.getElementById('current_distrito').value = data.current_distrito || '';
        document.getElementById('current_zona').value = data.current_zona || '';
        document.getElementById('current_estado').value = data.current_estado || '';
        document.getElementById('current_observaciones').value = data.current_observaciones || '';
        // Mostrar historial
        renderPrinterHistory(data.id);
        // Mostrar archivos agrupados por categoría
        renderPrinterFiles(data.id);
    }
    document.getElementById('editForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!getIsAuthReady() || !getUserId()) {
            showMessage('Debes iniciar sesión.', 3000);
            return;
        }
        const form = e.target;
        const updateData = {
            serie: form.serie.value.trim(),
            current_modelo: form.current_modelo.value.trim(),
            current_cliente: form.current_cliente.value.trim(),
            current_contacto: form.current_contacto.value.trim(),
            current_direccion: form.current_direccion.value.trim(),
            current_sede: form.current_sede.value.trim(),
            current_empresa: form.current_empresa.value.trim(),
            current_dpto: form.current_dpto.value.trim(),
            current_provincia: form.current_provincia.value.trim(),
            current_distrito: form.current_distrito.value.trim(),
            current_zona: form.current_zona.value.trim(),
            current_estado: form.current_estado.value,
            current_observaciones: form.current_observaciones.value.trim(),
            user_id: getUserId()
        };
        if (!updateData.serie) {
            showMessage('El campo SERIE es obligatorio.', 3000);
            return;
        }
        const supabase = getSupabase();
        try {
            const { error } = await supabase
                .from('printers')
                .update(updateData)
                .eq('id', data.id)
                .eq('user_id', getUserId());
            if (error) {
                showMessage('Error al actualizar: ' + error.message, 4000);
                return;
            }
            // Subida de archivos con categoría
            await uploadAllFiles(data.id);
            showMessage('Registro actualizado correctamente.', 2000);
            showView('search');
        } catch (error) {
            showMessage('Error al actualizar: ' + error.message, 4000);
        }
    };
    document.getElementById('cancelEditBtn').onclick = () => showView('search');
    setupFileCategoryEvents();
}

// Mostrar historial de la impresora
async function renderPrinterHistory(printerId) {
    const supabase = getSupabase();
    const userId = getUserId();
    const historyDiv = document.createElement('div');
    historyDiv.className = 'mt-4';
    historyDiv.innerHTML = '<h6>Historial de cambios</h6><div id="historyList">Cargando...</div>';
    document.getElementById('editForm').parentElement.appendChild(historyDiv);
    try {
        const { data, error } = await supabase
            .from('printer_history')
            .select('*')
            .eq('printer_id', printerId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        const historyList = document.getElementById('historyList');
        if (!data || data.length === 0) {
            historyList.innerHTML = '<div class="text-muted">Sin historial.</div>';
        } else {
            historyList.innerHTML = data.map(h => `
                <div class="border-bottom py-1 small">
                    <b>${h.change_type}</b> - ${h.change_reason || ''}<br>
                    <span class="text-muted">${new Date(h.created_at).toLocaleString()}</span>
                    <div>${h.change_description || ''}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        document.getElementById('historyList').innerHTML = 'Error al cargar historial.';
    }
}

// Mostrar archivos agrupados por categoría
async function renderPrinterFiles(printerId) {
    const supabase = getSupabase();
    const userId = getUserId();
    const filesDiv = document.createElement('div');
    filesDiv.className = 'mt-4';
    filesDiv.innerHTML = '<h6>Archivos adjuntos</h6><div id="filesList">Cargando...</div>';
    document.getElementById('editForm').parentElement.appendChild(filesDiv);
    try {
        const { data, error } = await supabase
            .from('printer_files')
            .select('*')
            .eq('printer_id', printerId)
            .eq('user_id', userId);
        if (error) throw error;
        const filesList = document.getElementById('filesList');
        if (!data || data.length === 0) {
            filesList.innerHTML = '<div class="text-muted">Sin archivos.</div>';
        } else {
            // Agrupar por categoría
            const grouped = {};
            data.forEach(f => {
                if (!grouped[f.file_category]) grouped[f.file_category] = [];
                grouped[f.file_category].push(f);
            });
            filesList.innerHTML = Object.entries(grouped).map(([cat, files]) => `
                <div class="mb-2">
                    <b>${cat.charAt(0).toUpperCase() + cat.slice(1)}</b>:
                    <ul class="list-unstyled ms-3">
                        ${files.map(f => `<li><a href="${f.download_url}" target="_blank">${f.file_name}</a></li>`).join('')}
                    </ul>
                </div>
            `).join('');
        }
    } catch (error) {
        document.getElementById('filesList').innerHTML = 'Error al cargar archivos.';
    }
}

// Inicialización
initSupabase();
document.addEventListener('DOMContentLoaded', () => {
    showView('auth');
}); 