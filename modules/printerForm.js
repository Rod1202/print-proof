import { getSupabase, getUserId, getIsAuthReady } from './supabaseClient.js';
import { showMessage } from './auth.js';
import { updateFileList, uploadedFiles, resetFiles, syncFilesWithRecord, removeFile } from './fileUpload.js';

let printerForm, estadoSelect, saveButton, editButton;
let editMode = false;
let currentEditId = null;

function updateEstadoStyle() {
    const value = estadoSelect.value;
    estadoSelect.classList.remove('estado-produccion', 'estado-backup', 'estado-reportado', 'estado-cambiado', 'estado-taller', 'estado-almacenado');
    if (value) {
        estadoSelect.classList.add(`estado-${value}`);
        estadoSelect.style.color = value === 'reportado' ? '#000' : '#fff';
        estadoSelect.style.fontWeight = 'bold';
    } else {
        estadoSelect.style.color = '';
        estadoSelect.style.fontWeight = '';
    }
}

function resetForm() {
    printerForm.reset();
    resetFiles();
    updateEstadoStyle();
    editMode = false;
    currentEditId = null;
    saveButton.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Registro';
    const searchResultsEl = document.getElementById('searchResults');
    if (searchResultsEl) searchResultsEl.innerHTML = '';
}

async function handleSubmit(e) {
    e.preventDefault();
    if (!getIsAuthReady() || !getUserId()) {
        showMessage('La autenticación de Supabase no está lista. Espera un momento o recarga la página.', 3000);
        return;
    }
    const formData = new FormData(printerForm);
    const serie = formData.get('serie');
    if (!serie) {
        showMessage('El número de serie es obligatorio', 3000);
        return;
    }
    const printerData = {
        cliente: formData.get('cliente') || '',
        contacto: formData.get('contacto') || '',
        direccion: formData.get('direccion') || '',
        sede: formData.get('sede') || '',
        empresa: formData.get('empresa') || '',
        dpto: formData.get('dpto') || '',
        provincia: formData.get('provincia') || '',
        distrito: formData.get('distrito') || '',
        zona: formData.get('zona') || '',
        modelo: formData.get('modelo') || '',
        serie: serie,
        estado: formData.get('estado') || '',
        observaciones: formData.get('observaciones') || '',
        user_id: getUserId(),
    };
    const supabase = getSupabase();
    try {
        let printerRecordId;
        if (editMode && currentEditId) {
            const { error: updateError } = await supabase.from('printers').update(printerData).eq('id', currentEditId).eq('user_id', getUserId());
            if (updateError) throw updateError;
            printerRecordId = currentEditId;
        } else {
            const { data, error } = await supabase.from('printers').insert(printerData).select('id');
            if (error) throw error;
            printerRecordId = data[0].id;
        }
        await syncFilesWithRecord(printerRecordId);
        showMessage(editMode ? 'Registro actualizado exitosamente en Supabase!' : 'Registro guardado exitosamente en Supabase!', 3000);
        resetForm();
    } catch (error) {
        showMessage('Error al guardar/actualizar el registro: ' + error.message, 5000);
    }
}

async function editRecordBySerie() {
    if (!getIsAuthReady() || !getUserId()) {
        showMessage('La autenticación de Supabase no está lista. Espera un momento o recarga la página.', 3000);
        return;
    }
    const serie = document.getElementById('serie').value.trim();
    if (!serie) {
        showMessage('Ingresa un número de serie para buscar y editar.', 3000);
        return;
    }
    const supabase = getSupabase();
    try {
        const { data: records, error } = await supabase.from('printers').select('id').eq('serie', serie).eq('user_id', getUserId());
        if (error) throw error;
        if (records && records.length > 0) {
            await loadForEdit(records[0].id);
            showMessage('Registro encontrado y cargado para edición.', 3000);
        } else {
            showMessage('No se encontró un registro con esa serie para editar o no tienes permisos.', 3000);
        }
    } catch (error) {
        showMessage('Error al buscar registro para edición: ' + error.message, 5000);
    }
}

export async function loadForEdit(recordId) {
    if (!getIsAuthReady() || !getUserId()) {
        showMessage('La autenticación de Supabase no está lista. Espera un momento o recarga la página.', 3000);
        return;
    }
    const supabase = getSupabase();
    try {
        const { data: record, error: printerError } = await supabase.from('printers').select('*').eq('id', recordId).eq('user_id', getUserId()).single();
        if (printerError) throw printerError;
        if (!record) {
            showMessage('Registro no encontrado para edición o no tienes permisos.', 3000);
            return;
        }
        document.getElementById('cliente').value = record.cliente || '';
        document.getElementById('contacto').value = record.contacto || '';
        document.getElementById('direccion').value = record.direccion || '';
        document.getElementById('sede').value = record.sede || '';
        document.getElementById('empresa').value = record.empresa || '';
        document.getElementById('dpto').value = record.dpto || '';
        document.getElementById('provincia').value = record.provincia || '';
        document.getElementById('distrito').value = record.distrito || '';
        document.getElementById('zona').value = record.zona || '';
        document.getElementById('modelo').value = record.modelo || '';
        document.getElementById('serie').value = record.serie || '';
        estadoSelect.value = record.estado || '';
        document.getElementById('observaciones').value = record.observaciones || '';
        updateEstadoStyle();
        await syncFilesWithRecord(recordId);
        editMode = true;
        currentEditId = recordId;
        saveButton.innerHTML = '<i class="fas fa-save me-2"></i>Actualizar Registro';
        printerForm.scrollIntoView({behavior: 'smooth'});
    } catch (error) {
        showMessage('Error al cargar registro para edición: ' + error.message, 5000);
    }
}

export function setupPrinterForm() {
    printerForm = document.getElementById('printerForm');
    estadoSelect = document.getElementById('estado');
    saveButton = printerForm.querySelector('.btn-success');
    editButton = document.getElementById('editButton');
    estadoSelect.addEventListener('change', updateEstadoStyle);
    printerForm.addEventListener('submit', handleSubmit);
    editButton.addEventListener('click', editRecordBySerie);
    updateEstadoStyle();
}

export { resetForm, editMode, currentEditId }; 