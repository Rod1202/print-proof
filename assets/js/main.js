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
let currentRecordId = null; // ID de la impresora actualmente seleccionada
let allClientsData = []; // Para almacenar clientes con sus ADMs
let formState = {}; // Para preservar el estado del formulario
let shouldRestoreView = false; // Flag para restaurar vista después de foto

// Detectar cuando la página se vuelve visible (después de tomar foto en móviles)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Si estábamos en registro y tenemos estado preservado, restaurar
        if (currentView === 'register' && Object.keys(formState).length > 0) {
            console.log('Página vuelve visible - restaurando vista de registro');
            shouldRestoreView = true;
            showView('register');
        }
    }
});

// Detectar cuando la ventana se enfoca (alternativa para algunos navegadores móviles)
window.addEventListener('focus', () => {
    if (currentView === 'register' && Object.keys(formState).length > 0) {
        console.log('Ventana enfocada - restaurando vista de registro');
        shouldRestoreView = true;
        showView('register');
    }
});

// Función para verificar y restaurar estado guardado al cargar la página
function checkForSavedState() {
    const savedState = sessionStorage.getItem('registerFormState');
    if (savedState) {
        try {
            const formState = JSON.parse(savedState);
            console.log('Estado guardado encontrado al cargar página:', formState);
            
            // Si hay estado guardado, probablemente venimos de tomar una foto
            // Restaurar automáticamente la vista de registro
            currentView = 'register';
            showView('register');
            
            // El estado se restaurará en setupRegisterEvents
            shouldRestoreView = true;
        } catch (error) {
            console.error('Error al procesar estado guardado:', error);
            sessionStorage.removeItem('registerFormState');
        }
    }
}

// Verificar estado guardado cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Si hay estado guardado, forzar la vista de registro
    if (localStorage.getItem('registerFormState')) {
        currentView = 'register';
        showView('register');
    }
});

// Reutilizaremos este HTML para la subida de archivos
const fileUploadComponent = `
    <div class="section-title mt-4">Archivos</div>
    <div class="file-upload-area" id="fileUploadArea">
        <i class="fas fa-paperclip fa-2x mb-2 text-muted"></i>
        <div>Haz clic aquí o arrastra archivos para subir</div>
        <small class="text-muted">Máximo 10MB por archivo</small>
    </div>
    <div class="file-list" id="fileList"></div>
    <div class="d-flex justify-content-center align-items-center mt-3 gap-2">
        <button type="button" class="btn btn-outline-primary" id="takePhotoBtn" onclick="event.preventDefault(); event.stopPropagation(); return false;"><i class="fas fa-camera"></i> Tomar Foto</button>
        <select class="form-select w-auto" id="fileCategorySelect">
            <option value="general">General</option>
            <option value="manual">Manual</option>
            <option value="warranty">Garantía</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="photo">Foto</option>
            <option value="report">Reporte</option>
        </select>
    </div>
    <!-- Inputs movidos fuera del formulario para evitar submits accidentales -->
    <input type="file" id="fileInput" style="display: none; position: absolute; left: -9999px;" multiple onchange="event.preventDefault(); event.stopPropagation();">
    <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display: none; position: absolute; left: -9999px;" onchange="event.preventDefault(); event.stopPropagation();">`;

// Carga una vista parcial desde /views/{viewName}.html y ejecuta callback tras cargar
async function loadView(viewName, afterLoad) {
    const mainView = document.getElementById('mainView');
    const response = await fetch(`views/${viewName}.html`);
    const html = await response.text();
    mainView.innerHTML = html;
    if (afterLoad) afterLoad();
}

// Función para preservar el estado del formulario actual
function preserveFormState() {
    if (currentView === 'register') {
        const form = document.getElementById('registerForm');
        if (form) {
            formState = {
                serie: form.querySelector('#serie')?.value || '',
                client_id: form.querySelector('#client_id')?.value || '',
                printer_model_id: form.querySelector('#printer_model_id')?.value || '',
                current_estado: form.querySelector('#current_estado')?.value || '',
                current_observaciones: form.querySelector('#current_observaciones')?.value || '',
                current_contacto: form.querySelector('#current_contacto')?.value || '',
                current_empresa: form.querySelector('#current_empresa')?.value || '',
                current_direccion: form.querySelector('#current_direccion')?.value || '',
                current_dpto: form.querySelector('#current_dpto')?.value || '',
                current_provincia: form.querySelector('#current_provincia')?.value || '',
                current_distrito: form.querySelector('#current_distrito')?.value || '',
                current_sede: form.querySelector('#current_sede')?.value || '',
                adm_name: form.querySelector('#adm_name')?.value || '',
                adm_id: form.querySelector('#adm_id')?.value || ''
            };
            console.log('Estado del formulario preservado:', formState);
        }
    }
}

// Función para restaurar el estado del formulario
function restoreFormState() {
    if (currentView === 'register' && Object.keys(formState).length > 0) {
        const form = document.getElementById('registerForm');
        if (form) {
            Object.keys(formState).forEach(key => {
                const element = form.querySelector(`#${key}`);
                if (element) {
                    element.value = formState[key];
                }
            });
            console.log('Estado del formulario restaurado:', formState);
        }
    }
}

export function showView(view, data = null) {
    // Preservar el estado actual antes de cambiar de vista
    if (currentView === 'register') {
        preserveFormState();
    }
    
    currentView = view;
    switch (view) {
        case 'auth':
            loadView('auth', () => setupAuthEvents(showView));
            break;
        case 'search':
            loadView('search', setupSearchEvents);
            break;
        case 'register':
            loadView('register', () => {
                setupRegisterEvents();
                // Restaurar estado si hay localStorage
                const savedState = localStorage.getItem('registerFormState');
                if (savedState) {
                    try {
                        const formState = JSON.parse(savedState);
                        const form = document.getElementById('registerForm');
                        if (form) {
                            Object.keys(formState).forEach(key => {
                                const element = form.querySelector(`#${key}`);
                                if (element) {
                                    element.value = formState[key];
                                }
                            });
                            console.log('Estado del formulario restaurado desde localStorage:', formState);
                        }
                        // Limpiar el estado guardado
                        localStorage.removeItem('registerFormState');
                    } catch (error) {
                        console.error('Error al restaurar estado desde localStorage:', error);
                        localStorage.removeItem('registerFormState');
                    }
                }
            });
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
        case 'edit_status':
            loadView('edit_status', () => setupEditStatusEvents(data));
            break;
        case 'edit_client':
            loadView('edit_client', () => setupEditClientEvents(data));
            break;
        case 'edit_contact':
            loadView('edit_contact', () => setupEditContactEvents(data));
            break;
        case 'edit_model':
            loadView('edit_model', () => setupEditModelEvents(data));
            break;
        case 'error':
            loadView('error', setupErrorEvents);
            break;
    }
}

// VISTA 1: Autenticación
function setupAuthEvents(showViewFn) {
    const msBtn = document.getElementById('signInWithMicrosoftBtn');
    if (msBtn) {
        msBtn.onclick = (e) => {
            e.preventDefault();
            showView('error');
            return false;
        };
    }
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

    // Interceptar el submit del formulario para máxima robustez
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            if (document.activeElement && document.activeElement.id === 'signInWithMicrosoftBtn') {
                e.preventDefault();
                showView('error');
                return false;
            }
        });
    }
}

function setupErrorEvents() {
    const btn = document.getElementById('errorBackBtn');
    if (btn) {
        btn.onclick = () => showView('auth');
    }
}

// VISTA 2: Búsqueda
async function setupSearchEvents() {
    // Configurar el botón de registro
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => showView('register'));
    }

    // Configurar el botón de búsqueda
    const searchBtn = document.getElementById('searchBtnView');
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const searchTerm = document.getElementById('searchInputView').value.trim();
            if (!searchTerm) {
                alert('Por favor, ingrese un término de búsqueda.');
                return;
            }

            const supabase = getSupabase();
            const { data: printers, error } = await supabase
                .from('printers')
                .select(`
                    *,
                    client:clients(name, adm:adms(name)),
                    model:printer_models(name)
                `)
                .ilike('serie', `%${searchTerm}%`);

            if (error) {
                console.error('Error searching records:', error);
                alert(`Error en la búsqueda: ${error.message}`);
                return;
            }

            console.log("Search results:", printers);

            if (printers.length === 1) {
                // Si hay un solo resultado, vamos a detalle y le pasamos el objeto directamente
                showView('detail', printers[0]);
            } else {
                // Para 0 o múltiples resultados, pasamos los datos a la vista de resultados
                showView('results', printers);
            }
        });
    }

    // También permitir búsqueda con Enter en el input
    const searchInput = document.getElementById('searchInputView');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });
    }
}

// VISTA 3: Registro
async function setupRegisterEvents() {
    const registerForm = document.getElementById('registerForm');
    const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
    
    if (cancelRegisterBtn) {
        cancelRegisterBtn.addEventListener('click', () => showView('search'));
    }

    if (!registerForm) return;
    
    // Restaurar y configurar el componente de subida de archivos
    const fileUploadPartial = document.getElementById('fileUploadPartial');
    if (fileUploadPartial) {
        fileUploadPartial.innerHTML = fileUploadComponent;
        setupFileUpload(); // Configurar los eventos para el componente recién insertado
    }

    // Referencias a elementos del DOM
    const clientSelect = document.getElementById('client_id');
    const admNameInput = document.getElementById('adm_name');
    const admIdInput = document.getElementById('adm_id');

    // Cargar y poblar los desplegables
    try {
        allClientsData = await fetchAllClientsWithAdm();
        populateSelect(clientSelect.id, allClientsData, 'Seleccione un cliente');

        const models = await fetchPrinterModels();
        populateSelect('printer_model_id', models, 'Seleccione un modelo');
    } catch (e) {
        console.error("Failed to populate form selects", e);
    }

    // Event listener para cuando se seleccione un Cliente
    if (clientSelect) {
        clientSelect.addEventListener('change', (e) => {
            const selectedClientId = e.target.value;
            const selectedClient = allClientsData.find(c => c.id === selectedClientId);
            
            if (selectedClient && selectedClient.adm) {
                admNameInput.value = selectedClient.adm.name;
                admIdInput.value = selectedClient.adm.id;
            } else {
                admNameInput.value = '';
                admIdInput.value = '';
            }
        });
    }

    // Configurar el botón de submit manualmente para evitar conflictos
    const submitButton = registerForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const formData = new FormData(registerForm);

            const printerData = {
                serie: formData.get('serie'),
                client_id: formData.get('client_id'),
                printer_model_id: formData.get('printer_model_id'),
                current_estado: formData.get('current_estado'),
                current_observaciones: formData.get('current_observaciones'),
                user_id: getUserId(),
                // Nuevos campos de contacto y ubicación
                current_contacto: formData.get('current_contacto'),
                current_empresa: formData.get('current_empresa'),
                current_direccion: formData.get('current_direccion'),
                current_dpto: formData.get('current_dpto'),
                current_provincia: formData.get('current_provincia'),
                current_distrito: formData.get('current_distrito'),
                current_sede: formData.get('current_sede')
            };

            if (!printerData.client_id || !printerData.printer_model_id) {
                alert('Por favor, seleccione un cliente y un modelo.');
                return;
            }

            console.log("Attempting to insert printer:", printerData);

            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('printers')
                .insert(printerData)
                .select('id')
                .single();

            if (error) {
                console.error('Error creating record:', error);
                alert(`Error al guardar el registro: ${error.message}`);
                return;
            }

            console.log("Record created successfully:", data);
            const newPrinterId = data.id;

            // Subir archivos si los hay
            if (uploadedFiles.length > 0) {
                await uploadAllFiles(newPrinterId);
            }

            // Mostrar mensaje de éxito y regresar a la búsqueda
            showMessage('Registro guardado con éxito.', 2000);
            showView('search');
        });
    }

    // Prevenir cualquier submit del formulario que no sea del botón explícito
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Submit del formulario prevenido - debe usar el botón explícito');
        return false;
    });
}

async function fetchAllClientsWithAdm() {
    console.log("Fetching all clients with their ADM...");
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('clients')
        .select(`
            id, 
            name, 
            adm:adms(id, name)
        `)
        .order('name');
    
    if (error) {
        console.error("Error fetching clients with ADM:", error);
        alert("No se pudieron cargar los clientes. Revisa los permisos (RLS) en la consola de Supabase y asegúrate de que el usuario actual puede verlos.");
        return [];
    }
    console.log("Clients with ADM fetched:", data);
    return data;
}

async function fetchClientsByAdm(admId) {
    console.log("Fetching clients for ADM:", admId);
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('adm_id', admId)
        .order('name');
    if (error) {
        console.error("Error fetching clients for ADM:", error);
        return [];
    }
    console.log("Clients for ADM fetched:", data);
    return data;
}

async function fetchAdms() {
    console.log("Fetching ADMs...");
    const supabase = getSupabase();
    const { data, error } = await supabase.from('adms').select('id, name').order('name');
    if (error) {
        console.error("Error fetching ADMs:", error);
        alert("No se pudieron cargar los ADMs. Revise la consola.");
        return [];
    }
    console.log("ADMs fetched:", data);
    return data;
}

async function fetchPrinterModels() {
    console.log("Fetching printer models...");
    const supabase = getSupabase();
    const { data, error } = await supabase.from('printer_models').select('id, name').order('name');
    if (error) {
        console.error("Error fetching printer models:", error);
        alert("No se pudieron cargar los modelos de impresora. Revise la consola.");
        return [];
    }
    console.log("Printer models fetched:", data);
    return data;
}

function populateSelect(selectId, items, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

// VISTA 4: Resultados
function setupResultsEvents(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultItemTemplate = document.getElementById('result-item-template');
    const newSearchBtn = document.getElementById('newSearchBtn');

    if (!resultsContainer || !resultItemTemplate || !newSearchBtn) {
        console.error("Faltan elementos en la vista de resultados.");
        return;
    }

    // Funcionalidad del botón Nueva Búsqueda
    newSearchBtn.onclick = () => showView('search');

    resultsContainer.innerHTML = ''; // Limpiar resultados anteriores

    if (data && data.length > 0) {
        data.forEach(printer => {
            const clone = resultItemTemplate.content.cloneNode(true);
            const card = clone.querySelector('.result-item-card');
            
            // Guardamos el objeto completo en el dataset para pasarlo a la vista de detalle
            card.dataset.printerData = JSON.stringify(printer);

            clone.querySelector('.result-item-serie').textContent = printer.serie;
            clone.querySelector('.result-item-cliente').textContent = printer.client?.name || 'N/A';
            clone.querySelector('.result-item-modelo').textContent = printer.model?.name || 'N/A';
            
            const estadoBadge = clone.querySelector('.result-item-estado');
            estadoBadge.textContent = printer.current_estado;
            estadoBadge.className = `badge bg-${getEstadoColor(printer.current_estado)}`;

            const admElement = clone.querySelector('.result-item-adm');
            if (admElement) {
                admElement.textContent = `ADM: ${printer.client?.adm?.name || 'N/A'}`;
            }

            resultsContainer.appendChild(clone);
        });

        // Añadir evento de clic a cada tarjeta de resultado
        document.querySelectorAll('.result-item-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const printerData = JSON.parse(card.dataset.printerData);
                showView('detail', printerData);
            });
        });

    } else {
        resultsContainer.innerHTML = '<p class="text-center text-muted mt-3">No se encontraron registros con ese criterio.</p>';
    }
}

// VISTA DE DETALLE (NUEVA)
async function setupDetailEvents(data) {
    // El objeto 'data' es ahora el registro de la impresora que viene de la búsqueda o de la lista de resultados.
    if (!data || !data.id) {
        showMessage('Error: No se pudo cargar la información del registro.', 3000);
        showView('search');
        return;
    }

    // Establecemos el ID y los datos actuales para usarlos en otras partes (como los botones de edición)
    currentRecordId = data.id;
    lastEditData = data; 

    // Rellenar la vista con los datos que ya tenemos, sin necesidad de volver a consultar
    document.getElementById('detail-serie').textContent = data.serie || 'N/A';
    document.getElementById('detail-cliente').textContent = data.client?.name || 'N/A';
    document.getElementById('detail-modelo').textContent = data.model?.name || 'N/A';
    const estadoBadge = document.getElementById('detail-estado');
    if(estadoBadge) {
        estadoBadge.textContent = data.current_estado || 'N/A';
        estadoBadge.className = `badge bg-${getEstadoColor(data.current_estado)}`;
    }
    document.getElementById('detail-observaciones').textContent = data.current_observaciones || 'Sin observaciones.';
    
    // Rellenar campos de contacto/ubicación
    document.getElementById('detail-contacto').textContent = data.current_contacto || 'N/A';
    document.getElementById('detail-direccion').textContent = data.current_direccion || 'N/A';
    
    const sedeZona = [data.current_sede, data.current_zona].filter(Boolean).join(' / ');
    document.getElementById('detail-sede-zona').textContent = sedeZona || 'N/A';

    const empresaDpto = [data.current_empresa, data.current_dpto].filter(Boolean).join(' / ');
    document.getElementById('detail-empresa-dpto').textContent = empresaDpto || 'N/A';

    const admInfo = document.querySelector('#detail-adm'); // Usamos un ID específico
    if (admInfo) {
        admInfo.textContent = data.client?.adm?.name || 'N/A';
    }

    // Renderizar historial y archivos (estas funciones sí necesitan hacer su propia consulta)
    renderPrinterHistory(data.id, 'historyContainer');
    renderPrinterFiles(data.id, 'filesContainer');

    // Asignar eventos a los botones
    document.getElementById('editStatusBtn').onclick = () => showView('edit_status', data);
    document.getElementById('editClientBtn').onclick = () => showView('edit_client', data);
    document.getElementById('editContactBtn').onclick = () => showView('edit_contact', data);
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
        console.error('Error detallado al cargar historial:', error);
        if(historyList) historyList.innerHTML = '<div class="alert alert-danger small">Error al cargar historial. Revisa la consola para más detalles.</div>';
    }
}

// Mostrar archivos agrupados por categoría
async function renderPrinterFiles(printerId, containerId) {
    const filesContainer = document.getElementById(containerId);
    if (!filesContainer) {
        console.error(`Contenedor de archivos '${containerId}' no encontrado.`);
        return;
    }
    filesContainer.innerHTML = '<div id="filesList">Cargando...</div>';
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
        console.error('Error detallado al cargar archivos:', error);
        if(filesList) filesList.innerHTML = '<div class="alert alert-danger small">Error al cargar archivos. Revisa la consola para más detalles.</div>';
    }
}

// Función genérica para manejar la actualización
async function handleUpdate(printerId, updateData, successMessage) {
    if (Object.keys(updateData).length === 0) {
        showMessage('No se realizaron cambios.', 2000);
        return;
    }
    const supabase = getSupabase();
    try {
        const { data: updatedRecord, error } = await supabase
            .from('printers')
            .update(updateData)
            .eq('id', printerId)
            .select();
        if (error) throw error;

        showMessage(successMessage, 2000);
        showView('detail', updatedRecord[0]);

    } catch (error) {
        showMessage('Error al actualizar: ' + error.message, 4000);
    }
}

// FUNCIONES DE SETUP PARA FORMULARIOS DE EDICIÓN
function setupEditStatusEvents(data) {
    document.getElementById('form_serie_display').textContent = data.serie;

    const form = document.getElementById('editStatusForm');
    form.current_estado.value = data.current_estado;
    form.current_observaciones.value = data.current_observaciones;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const updateData = {
            current_estado: form.current_estado.value,
            current_observaciones: form.current_observaciones.value.trim()
        };
        await handleUpdate(data.id, updateData, 'Estado actualizado.');
    };
    document.getElementById('cancelBtn').onclick = () => showView('detail', data);
}

async function setupEditClientEvents(data) {
    const form = document.getElementById('editClientForm');
    if (!form) return;

    // Poblar la UI antes de configurar el formulario
    const supabase = getSupabase();
    const { data: printer, error: printerError } = await supabase
        .from('printers')
        .select(`
            serie, 
            client_id,
            client:clients(adm_id)
        `)
        .eq('id', currentRecordId)
        .single();
    
    if (printerError) {
        alert('No se pudo cargar la información de la impresora.');
        return;
    }
    
    document.getElementById('edit-client-serie').textContent = printer.serie;

    // Cargar ADMs y seleccionar el actual
    const adms = await fetchAdms();
    populateSelect('adm_id', adms, 'Seleccione un ADM');
    form.adm_id.value = printer.client?.adm_id || '';

    // Cargar clientes del ADM actual
    if (printer.client?.adm_id) {
        const clients = await fetchClientsByAdm(printer.client.adm_id);
        populateSelect('client_id', clients, 'Seleccione un nuevo cliente');
        form.client_id.disabled = false;
        form.client_id.value = printer.client_id;
    }
    
    // Event listener para cuando se seleccione un ADM
    const admSelect = document.getElementById('adm_id');
    if (admSelect) {
        admSelect.addEventListener('change', async (e) => {
            const clientSelect = document.getElementById('client_id');
            if (e.target.value) {
                const clients = await fetchClientsByAdm(e.target.value);
                populateSelect('client_id', clients, 'Seleccione un nuevo cliente');
                clientSelect.disabled = false;
            } else {
                clientSelect.innerHTML = '<option value="">Primero seleccione un ADM</option>';
                clientSelect.disabled = true;
            }
        });
    }
    
    document.getElementById('cancelEditClientBtn')?.addEventListener('click', () => showView('detail', lastEditData));

    form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newClientId = formData.get('client_id');
        const nuevoEstado = formData.get('current_estado');
        const observaciones = formData.get('observaciones');

        if (!newClientId) {
            alert('Por favor, seleccione un cliente.');
            return;
        }

        // 1. Preparar el objeto de actualización
        const updateData = { client_id: newClientId };
        if (nuevoEstado) {
            updateData.current_estado = nuevoEstado;
        }

        // 2. Actualizar la impresora y pedir el registro actualizado
        const supabase = getSupabase();
        const { data: updatedPrinter, error: updateError } = await supabase
            .from('printers')
            .update(updateData)
            .eq('id', currentRecordId)
            .select(`
                *,
                client:clients(name, adm:adms(name)),
                model:printer_models(name)
            `)
            .single();

        if (updateError) {
            alert('Error al reasignar el cliente: ' + updateError.message);
            return;
        }

        // 3. Añadir entrada al historial
        await addHistoryEntry('client_change', `Cliente reasignado.`, {
            field: 'client_id',
            new_value: newClientId,
            observaciones: observaciones
        });

        alert('Cliente reasignado con éxito.');
        // 4. Volver a la vista de detalle con los datos frescos
        showView('detail', updatedPrinter);
    };
}

function setupEditContactEvents(data) {
    document.getElementById('form_serie_display').textContent = data.serie;

    const form = document.getElementById('editContactForm');
    // Rellenar todos los campos del formulario de contacto
    form.current_direccion.value = data.current_direccion || '';
    form.current_sede.value = data.current_sede || '';
    form.current_dpto.value = data.current_dpto || '';
    // ... etc para todos los campos

    form.onsubmit = async (e) => {
        e.preventDefault();
        const updateData = {
            current_direccion: form.current_direccion.value.trim(),
            current_sede: form.current_sede.value.trim(),
            // ... etc para todos los campos
        };
        if (form.current_estado.value) {
            updateData.current_estado = form.current_estado.value;
        }
        await handleUpdate(data.id, updateData, 'Ubicación actualizada.');
    };
    document.getElementById('cancelBtn').onclick = () => showView('detail', data);
}

async function setupEditModelEvents(data) {
    const form = document.getElementById('editModelForm');
    if (!form) return;

    // Poblar la UI
    const supabase = getSupabase();
    const { data: printer, error: printerError } = await supabase.from('printers').select('serie, printer_model_id').eq('id', currentRecordId).single();
    if (printerError) {
        alert('No se pudo cargar la información de la impresora.');
        return;
    }
    document.getElementById('edit-model-serie').textContent = printer.serie;

    const models = await fetchPrinterModels();
    populateSelect('printer_model_id', models, 'Seleccione un nuevo modelo');
    form.printer_model_id.value = printer.printer_model_id;
    
    document.getElementById('cancelEditModelBtn')?.addEventListener('click', () => showView('detail'));

    form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newModelId = formData.get('printer_model_id');
        const observaciones = formData.get('observaciones');

        if (!newModelId) {
            alert('Por favor, seleccione un modelo.');
            return;
        }

        // 1. Actualizar la impresora y pedir el registro actualizado
        const supabase = getSupabase();
        const { data: updatedPrinter, error: updateError } = await supabase
            .from('printers')
            .update({ printer_model_id: newModelId })
            .eq('id', currentRecordId)
            .select(`
                *,
                client:clients(name, adm:adms(name)),
                model:printer_models(name)
            `)
            .single();

        if (updateError) {
            alert('Error al cambiar el modelo: ' + updateError.message);
            return;
        }

        // 2. Añadir entrada al historial
        await addHistoryEntry('model_change', `Modelo de impresora cambiado.`, {
            field: 'printer_model_id',
            new_value: newModelId,
            observaciones: observaciones
        });

        alert('Modelo cambiado con éxito.');
        // 3. Volver a la vista de detalle con los datos frescos
        showView('detail', updatedPrinter);
    };
}

async function addHistoryEntry(changeType, changeDescription, additionalData = {}) {
    if (!currentRecordId) {
        console.error('No hay ID de impresora actual para añadir historial');
        return;
    }

    try {
        // Obtener información actual de la impresora para el historial
        const supabase = getSupabase();
        const { data: printer, error: printerError } = await supabase
            .from('printers')
            .select(`
                serie,
                client_id,
                printer_model_id,
                current_contacto,
                current_direccion,
                current_sede,
                current_empresa,
                current_dpto,
                current_provincia,
                current_distrito,
                current_zona,
                current_estado,
                current_observaciones,
                client:clients(name, adm:adms(id))
            `)
            .eq('id', currentRecordId)
            .single();

        if (printerError) {
            console.error('Error obteniendo datos de impresora para historial:', printerError);
            return;
        }

        const historyData = {
            printer_id: currentRecordId,
            serie: printer.serie,
            client_id: printer.client_id,
            printer_model_id: printer.printer_model_id,
            adm_id: printer.client?.adm?.id,
            cliente: printer.client?.name,
            contacto: printer.current_contacto,
            direccion: printer.current_direccion,
            sede: printer.current_sede,
            empresa: printer.current_empresa,
            dpto: printer.current_dpto,
            provincia: printer.current_provincia,
            distrito: printer.current_distrito,
            zona: printer.current_zona,
            estado: printer.current_estado,
            observaciones: printer.current_observaciones,
            change_type: changeType,
            change_description: changeDescription,
            change_reason: additionalData.observaciones || null
        };

        const { error: historyError } = await supabase
            .from('printer_history')
            .insert(historyData);

        if (historyError) {
            console.error('Error insertando en historial:', historyError);
        } else {
            console.log('Entrada de historial añadida correctamente');
        }
    } catch (error) {
        console.error('Error en addHistoryEntry:', error);
    }
}

async function uploadAllFiles(printerId) {
    const supabase = getSupabase();
    const userId = getUserId();
    const fileCategorySelect = document.getElementById('fileCategorySelect');
    const fileCategory = fileCategorySelect ? fileCategorySelect.value : 'general';

    if (uploadedFiles.length === 0) {
        return; // No files to upload
    }

    for (const fileObj of uploadedFiles) {
        if (fileObj.file) {
            const filePath = `${userId}/${printerId}/${fileObj.name}`;
            
            // Subir a Storage
            const { error: storageError } = await supabase.storage
                .from('printer-documents') // Nombre del bucket
                .upload(filePath, fileObj.file, { cacheControl: '3600', upsert: true });

            if (storageError) {
                console.error('Error uploading file:', storageError);
                showMessage('Error al subir archivo: ' + storageError.message, 4000);
                continue; // Ir al siguiente archivo
            }

            // Obtener URL pública
            const { data: publicUrlData } = supabase.storage
                .from('printer-documents')
                .getPublicUrl(filePath);
            
            if (!publicUrlData || !publicUrlData.publicUrl) {
                 console.error('Error getting public URL for file:', filePath);
                 continue;
            }

            // Insertar metadatos en la tabla printer_files
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

            const { error: dbError } = await supabase.from('printer_files').insert(fileMetadata);
            if (dbError) {
                console.error('Error inserting file metadata:', dbError);
                showMessage('Error al guardar metadatos del archivo: ' + dbError.message, 4000);
            }
        }
    }
    // Limpiar la lista de archivos después de subirlos
    resetFiles();
}

// Inicialización
initSupabase();
document.addEventListener('DOMContentLoaded', () => {
    // Añadir navegación al logo
    const logo = document.getElementById('logo');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            if (getIsAuthReady()) {
                showView('search');
            }
        });
    }

    showView('auth');
});