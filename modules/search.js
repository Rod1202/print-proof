// Módulo para la lógica de búsqueda y visualización de resultados
import { getSupabase, getUserId, getIsAuthReady } from './supabaseClient.js';
import { showMessage } from './auth.js';
import { loadForEdit } from './printerForm.js';

function getEstadoClass(estado) {
    return estado ? `estado-${estado}` : '';
}

function getEstadoText(estado) {
    return estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : 'Sin estado';
}

async function searchRecord() {
    if (!getIsAuthReady() || !getUserId()) {
        showMessage('La autenticación de Supabase no está lista. Espera un momento o recarga la página.', 3000);
        return;
    }
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim();
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    if (!searchTerm) return;
    const supabase = getSupabase();
    try {
        const { data: printers, error: printerError } = await supabase
            .from('printers')
            .select('*')
            .or(`serie.ilike.%${searchTerm}%,cliente.ilike.%${searchTerm}%,modelo.ilike.%${searchTerm}%`)
            .eq('user_id', getUserId());
        if (printerError) throw printerError;
        if (!printers || printers.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-results">
                    <h5>Resultados de búsqueda</h5>
                    <p class="text-muted">No se encontraron registros que coincidan con: "${searchTerm}"</p>
                </div>
            `;
            return;
        }
        let resultsHtml = `
            <div class="search-results">
                <h5>Resultados de búsqueda (${printers.length})</h5>
        `;
        for (const record of printers) {
            const estadoClass = getEstadoClass(record.estado);
            const estadoText = getEstadoText(record.estado);
            let filesHtml = '';
            const { data: recordFiles, error: filesError } = await supabase
                .from('printer_files')
                .select('file_name, download_url')
                .eq('printer_id', record.id)
                .eq('user_id', getUserId());
            if (filesError) {
                filesHtml = `<div class="mt-2 text-danger">Error al cargar archivos.</div>`;
            } else if (recordFiles && recordFiles.length > 0) {
                filesHtml = `
                    <div class="mt-2">
                        <strong>Archivos:</strong><br>
                        ${recordFiles.map(file => `
                            <a href="${file.download_url}" target="_blank" class="file-link d-block">
                                <i class="fas fa-file me-1"></i>${file.file_name}
                            </a>
                        `).join('')}
                    </div>
                `;
            }
            resultsHtml += `
                <div class="result-item">
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Cliente:</strong> ${record.cliente || 'N/A'}<br>
                            <strong>Serie:</strong> ${record.serie}<br>
                            <strong>Modelo:</strong> ${record.modelo || 'N/A'}<br>
                            <strong>Contacto:</strong> ${record.contacto || 'N/A'}<br>
                            <strong>Dirección:</strong> ${record.direccion || 'N/A'}
                        </div>
                        <div class="col-md-6">
                            <strong>Empresa:</strong> ${record.empresa || 'N/A'}<br>
                            <strong>Sede:</strong> ${record.sede || 'N/A'}<br>
                            <strong>Estado:</strong> <span class="badge ${estadoClass}">${estadoText}</span><br>
                            <strong>Observaciones:</strong> ${record.observaciones || 'N/A'}<br>
                            <strong>Última actualización:</strong> ${new Date(record.updated_at || record.created_at).toLocaleString()}
                        </div>
                    </div>
                    ${filesHtml}
                    <div class="mt-2">
                        <button class="btn btn-sm btn-primary load-for-edit-btn" data-record-id="${record.id}">
                            <i class="fas fa-edit me-1"></i>Cargar para Editar
                        </button>
                    </div>
                </div>
            `;
        }
        resultsHtml += '</div>';
        resultsContainer.innerHTML = resultsHtml;
        document.querySelectorAll('.load-for-edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const recordId = e.currentTarget.dataset.recordId;
                loadForEdit(recordId);
            });
        });
    } catch (error) {
        showMessage('Error al buscar registros: ' + error.message, 5000);
    }
}

export function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    searchButton.addEventListener('click', searchRecord);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchRecord();
    });
} 