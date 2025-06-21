// Archivo principal de la app. Aquí se importan los módulos y se inicializa la aplicación.
import { initSupabase, getSupabase, getUserId, getIsAuthReady } from '../../modules/supabaseClient.js';
import { setupAuth, showMessage, signInWithMicrosoft, signInAnonymously } from '../../modules/auth.js';
import { setupPrinterForm } from '../../modules/printerForm.js';
import { setupFileUpload, uploadedFiles, resetFiles, updateFileList } from '../../modules/fileUpload.js';
import { setupSearch } from '../../modules/search.js';

// Estado global de la vista actual
let currentView = 'auth'; // 'auth', 'search', 'register', 'results', 'edit', 'detail'
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
        case 'detail':
            loadView('detail', () => setupDetailEvents(data));
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
        console.log('Búsqueda iniciada con término:', searchTerm);
        console.log('User ID:', getUserId());
        console.log('Is Auth Ready:', getIsAuthReady());
        
        if (!getIsAuthReady()) {
            showMessage('Debes iniciar sesión para usar la app.', 3000);
            return;
        }
        
        const supabase = getSupabase();
        
        // Si el término de búsqueda está vacío, mostrar todos los registros
        if (!searchTerm) {
            console.log('Búsqueda sin término - mostrando todos los registros');
            try {
                const { data, error } = await supabase
                    .from('printers')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                console.log('Resultados encontrados:', data);
                lastSearchResults = data;
                showView('results', lastSearchResults);
            } catch (error) {
                console.error('Error al buscar todos los registros:', error);
                showMessage('Error al buscar: ' + error.message, 4000);
            }
            return;
        }
        
        // Búsqueda con término específico
        console.log(`Buscando solo por serie: ${searchTerm}`);
        
        try {
            const { data, error } = await supabase
                .from('printers')
                .select('*')
                .ilike('serie', `%${searchTerm}%`)
                .order('created_at', { ascending: false });
            
            console.log('Respuesta completa de búsqueda:', { data, error });
            
            if (error) {
                console.error('Error de Supabase:', error);
                throw error;
            }
            console.log('Resultados de búsqueda encontrados:', data);
            console.log('Número de resultados:', data ? data.length : 0);
            
            lastSearchResults = data;

            if (data && data.length === 1) {
                // Si hay un único resultado, vamos directamente a la vista de detalle
                console.log('Se encontró un resultado único. Mostrando vista de detalle.');
                showView('detail', data[0]);
            } else {
                // Si hay 0 o múltiples resultados, mostramos la lista
                console.log('Se encontraron 0 o múltiples resultados. Mostrando lista.');
                showView('results', data);
            }
        } catch (error) {
            console.error('Error completo:', error);
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
        
        // Verificar que el user_id sea válido
        if (!cleanData.user_id) {
            console.error('User ID no válido:', cleanData.user_id);
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 4000);
            return;
        }
        
        const supabase = getSupabase();
        try {
            console.log('Intentando insertar en Supabase...');
            const { data: inserted, error } = await supabase
                .from('printers')
                .insert(cleanData)
                .select('id');
            if (error) {
                console.error('Error de Supabase:', error);
                console.error('Código de error:', error.code);
                console.error('Mensaje de error:', error.message);
                console.error('Detalles del error:', error.details);
                console.error('Hint del error:', error.hint);
                if (error.code === '23505') {
                    showMessage('Ya existe una impresora con esa serie.', 4000);
                } else {
                    showMessage('Error al guardar: ' + error.message, 4000);
                }
                return;
            }
            console.log('Inserción exitosa:', inserted);
            // Subida de archivos con categoría
            const printerId = inserted[0].id;
            await uploadAllFiles(printerId);
            showMessage('Registro guardado correctamente.', 2000);
            showView('search');
        } catch (error) {
            console.error('Error capturado:', error);
            console.error('Stack trace:', error.stack);
            showMessage('Error al guardar: ' + error.message, 4000);
        }
    };
    document.getElementById('cancelRegisterBtn').onclick = () => showView('search');
    setupFileCategoryEvents();
    setupFileUpload(); // Configurar la funcionalidad de subida de archivos
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
    console.log('Configurando vista de resultados con datos:', data);
    const resultsList = document.getElementById('resultsList');
    
    if (!resultsList) {
        console.error('Elemento resultsList no encontrado');
        return;
    }
    
    if (!data || data.length === 0) {
        console.log('No hay datos para mostrar');
        resultsList.innerHTML = '<li class="list-group-item">No se encontraron resultados.</li>';
    } else {
        console.log('Mostrando', data.length, 'resultados');
        resultsList.innerHTML = data.map(item => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span><b>${item.serie || 'Sin serie'}</b> - ${item.current_cliente || 'Sin cliente'} (${item.current_modelo || 'Sin modelo'}) <span class="badge bg-info">${item.current_estado || 'Sin estado'}</span></span>
                <button class="btn btn-primary btn-sm editResultBtn" data-id="${item.id}"><i class="fas fa-edit"></i> Editar</button>
            </li>
        `).join('');
        
        const editButtons = document.querySelectorAll('.editResultBtn');
        console.log('Botones de editar encontrados:', editButtons.length);
        
        editButtons.forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                console.log('Editando impresora con ID:', id);
                lastEditData = data.find(x => x.id == id);
                showView('edit', lastEditData);
            };
        });
    }
    document.getElementById('backToSearchBtn').onclick = () => showView('search');
}

// VISTA DE DETALLE (NUEVA)
function setupDetailEvents(data) {
    if (!data) {
        showMessage('No hay datos para mostrar', 3000);
        showView('search');
        return;
    }

    lastEditData = data; // Guardamos los datos para el botón de editar

    // Rellenar la información de solo lectura
    document.getElementById('detail_serie').textContent = data.serie || 'N/A';
    document.getElementById('detail_modelo').textContent = data.current_modelo || 'N/A';
    document.getElementById('detail_cliente').textContent = data.current_cliente || 'N/A';
    const estadoBadge = document.getElementById('detail_estado');
    estadoBadge.textContent = data.current_estado || 'Sin estado';
    estadoBadge.className = `badge bg-${getEstadoColor(data.current_estado)}`;
    document.getElementById('detail_observaciones').textContent = data.current_observaciones || 'Sin observaciones.';

    // Renderizar historial y archivos
    renderPrinterHistory(data.id, 'historyContainer');
    renderPrinterFiles(data.id, 'filesContainer');

    // Asignar eventos a los botones
    document.getElementById('editPrinterBtn').onclick = () => {
        showView('edit', data);
    };
    document.getElementById('backToSearchBtn').onclick = () => {
        showView('search');
    };
}

function getEstadoColor(estado) {
    switch (estado) {
        case 'produccion': return 'success';
        case 'backup': return 'info';
        case 'reportado': return 'warning';
        case 'cambiado': return 'secondary';
        case 'taller': return 'danger';
        case 'almacenado': return 'dark';
        default: return 'light';
    }
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
        // Renderizar historial y archivos en la vista de edición
        renderPrinterHistory(data.id, 'editHistoryContainer');
        renderPrinterFiles(data.id, 'editFilesContainer');
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
                .eq('id', data.id);
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
    setupFileUpload(); // Configurar la funcionalidad de subida de archivos
}

// Mostrar historial de la impresora (MODIFICADA)
async function renderPrinterHistory(printerId, containerId) {
    const historyContainer = document.getElementById(containerId);
    if (!historyContainer) {
        console.error(`Contenedor de historial '${containerId}' no encontrado.`);
        return;
    }
    historyContainer.innerHTML = '<div id="historyList">Cargando...</div>'; // Limpiado para evitar doble título
    const historyList = document.getElementById('historyList');

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('printer_history')
            .select('*')
            .eq('printer_id', printerId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            historyList.innerHTML = '<div class="text-muted small p-2">No hay historial de cambios para esta impresora.</div>';
        } else {
            historyList.innerHTML = data.map(h => `
                <div class="border-bottom py-2 small">
                    <div class="d-flex justify-content-between">
                        <strong>Tipo de cambio: <span class="badge bg-secondary">${h.change_type || 'N/A'}</span></strong>
                        <span class="text-muted">${new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <div class="mt-1">
                        <p class="mb-0"><strong>Cliente:</strong> ${h.cliente || 'N/A'} | <strong>Estado:</strong> ${h.estado || 'N/A'}</p>
                        <p class="mb-0 text-muted">${h.observaciones || ''}</p>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error detallado al cargar historial:', error); // Log del error
        if(historyList) historyList.innerHTML = '<div class="alert alert-danger small">Error al cargar historial. Revisa la consola para más detalles.</div>';
    }
}

// Mostrar archivos agrupados por categoría (MODIFICADA)
async function renderPrinterFiles(printerId, containerId) {
    const filesContainer = document.getElementById(containerId);
    if (!filesContainer) {
        console.error(`Contenedor de archivos '${containerId}' no encontrado.`);
        return;
    }
    filesContainer.innerHTML = '<div id="filesList">Cargando...</div>'; // Limpiado
    const filesList = document.getElementById('filesList');

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('printer_files')
            .select('*')
            .eq('printer_id', printerId);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            filesList.innerHTML = '<div class="text-muted small p-2">No hay archivos adjuntos.</div>';
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
        console.error('Error detallado al cargar archivos:', error); // Log del error
        if(filesList) filesList.innerHTML = '<div class="alert alert-danger small">Error al cargar archivos. Revisa la consola para más detalles.</div>';
    }
}

// Función de prueba para diagnosticar problemas de datos
async function testSupabaseConnection() {
    console.log('=== PRUEBA DE CONEXIÓN SUPABASE ===');
    const supabase = getSupabase();
    const userId = getUserId();
    
    console.log('User ID actual:', userId);
    console.log('Is Auth Ready:', getIsAuthReady());
    
    try {
        // Prueba 1: Contar todos los registros sin filtro
        console.log('Prueba 1: Contando todos los registros...');
        const { count: totalCount, error: countError } = await supabase
            .from('printers')
            .select('*', { count: 'exact', head: true });
        
        console.log('Total de registros en la tabla:', totalCount);
        if (countError) console.error('Error al contar:', countError);
        
        // Prueba 2: Obtener todos los registros sin filtro
        console.log('Prueba 2: Obteniendo todos los registros...');
        const { data: allData, error: allError } = await supabase
            .from('printers')
            .select('*')
            .limit(5);
        
        console.log('Primeros 5 registros:', allData);
        if (allError) console.error('Error al obtener todos:', allError);
        
        // Prueba 3: Buscar por user_id específico
        console.log('Prueba 3: Buscando por user_id =', userId);
        const { data: userData, error: userError } = await supabase
            .from('printers')
            .select('*')
            .eq('user_id', userId);
        
        console.log('Registros del usuario actual:', userData);
        if (userError) console.error('Error al buscar por user_id:', userError);
        
        // Prueba 4: Verificar estructura de un registro
        if (userData && userData.length > 0) {
            console.log('Prueba 4: Estructura del primer registro:', userData[0]);
            console.log('Campos disponibles:', Object.keys(userData[0]));
        }
        
    } catch (error) {
        console.error('Error en prueba de conexión:', error);
    }
}

// Agregar botón de prueba temporal
function addTestButton() {
    const searchSection = document.querySelector('.form-section');
    if (searchSection) {
        const testBtn = document.createElement('button');
        testBtn.className = 'btn btn-warning mt-2';
        testBtn.innerHTML = '<i class="fas fa-bug"></i> Prueba de Conexión';
        testBtn.onclick = testSupabaseConnection;
        searchSection.appendChild(testBtn);
    }
}

// Inicialización
initSupabase();
document.addEventListener('DOMContentLoaded', () => {
    // Añadir navegación al logo
    const logo = document.getElementById('logo');
    if (logo) {
        logo.style.cursor = 'pointer'; // Cambiar cursor para indicar que es clickeable
        logo.addEventListener('click', () => {
            if (getIsAuthReady()) {
                showView('search');
            }
        });
    }

    showView('auth');
}); 