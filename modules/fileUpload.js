import { getSupabase, getUserId } from './supabaseClient.js';
import { showMessage } from './auth.js';

export let uploadedFiles = [];
let fileList, fileInput, fileUploadArea, takePhotoBtn, cameraInput;
const SUPABASE_BUCKET_NAME = 'printer-documents';

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function updateFileList() {
    // Re-obtener la referencia al elemento fileList en caso de que haya cambiado
    fileList = document.getElementById('fileList');
    
    if (!fileList) {
        console.warn('Elemento fileList no encontrado en el DOM');
        return;
    }
    
    fileList.innerHTML = '';
    uploadedFiles.forEach((fileObj, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        const fileLink = fileObj.download_url ? `<a href="${fileObj.download_url}" target="_blank" class="file-link">${fileObj.name}</a>` : fileObj.name;
        fileItem.innerHTML = `
            <span><i class="fas fa-file me-2"></i>${fileLink} (${formatFileSize(fileObj.size)})</span>
            <button type="button" class="btn btn-sm btn-outline-danger" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(fileItem);
    });
    fileList.querySelectorAll('.btn-outline-danger').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.currentTarget.dataset.index;
            removeFile(index);
        });
    });
}

export function removeFile(index) {
    uploadedFiles.splice(index, 1);
    updateFileList();
}

export function resetFiles() {
    uploadedFiles = [];
    updateFileList();
}

function addFiles(files) {
    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
            showMessage(`El archivo ${file.name} excede el tamaño máximo de 10MB`, 4000);
            return;
        }
        uploadedFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            file: file
        });
    });
    updateFileList();
}

export async function syncFilesWithRecord(printerRecordId) {
    const supabase = getSupabase();
    const userId = getUserId();
    // Obtener archivos existentes
    const { data: existingFileRecords, error: fetchFilesError } = await supabase
        .from('printer_files')
        .select('id, file_name, storage_path, download_url')
        .eq('printer_id', printerRecordId)
        .eq('user_id', userId);
    if (fetchFilesError) throw fetchFilesError;
    const filesToDelete = existingFileRecords.filter(oldFile =>
        !uploadedFiles.some(newFile =>
            newFile.name === oldFile.file_name && (newFile.file || newFile.download_url === oldFile.download_url)
        )
    );
    for (const fileToDelete of filesToDelete) {
        await supabase.storage.from(SUPABASE_BUCKET_NAME).remove([fileToDelete.storage_path]);
        await supabase.from('printer_files').delete().eq('id', fileToDelete.id).eq('user_id', userId);
    }
    for (const fileObj of uploadedFiles) {
        if (fileObj.file) {
            const filePath = `${userId}/${printerRecordId}/${fileObj.name}`;
            await supabase.storage.from(SUPABASE_BUCKET_NAME).upload(filePath, fileObj.file, { cacheControl: '3600', upsert: true });
            const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET_NAME).getPublicUrl(filePath);
            const fileMetadata = {
                printer_id: printerRecordId,
                file_name: fileObj.name,
                file_size: fileObj.size,
                file_type: fileObj.type,
                storage_path: filePath,
                download_url: publicUrlData.publicUrl,
                user_id: userId
            };
            const { data: existingFileEntry, error: checkFileError } = await supabase
                .from('printer_files')
                .select('id')
                .eq('printer_id', printerRecordId)
                .eq('file_name', fileObj.name)
                .single();
            if (checkFileError && checkFileError.code !== 'PGRST116') throw checkFileError;
            if (existingFileEntry) {
                await supabase.from('printer_files').update(fileMetadata).eq('id', existingFileEntry.id).eq('user_id', userId);
            } else {
                await supabase.from('printer_files').insert(fileMetadata);
            }
        }
    }
}

async function handleDragOver(e) {
    e.preventDefault();
    fileUploadArea.classList.add('dragover');
}
async function handleDragLeave(e) {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
}
async function handleDrop(e) {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
}
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
}

export function setupFileUpload() {
    console.log('Configurando funcionalidad de subida de archivos...');
    
    fileInput = document.getElementById('fileInput');
    fileUploadArea = document.getElementById('fileUploadArea');
    fileList = document.getElementById('fileList');
    takePhotoBtn = document.getElementById('takePhotoBtn');
    cameraInput = document.getElementById('cameraInput');
    
    console.log('Elementos encontrados:', {
        fileInput: !!fileInput,
        fileUploadArea: !!fileUploadArea,
        fileList: !!fileList,
        takePhotoBtn: !!takePhotoBtn,
        cameraInput: !!cameraInput
    });
    
    if (fileUploadArea) {
        fileUploadArea.addEventListener('dragover', handleDragOver);
        fileUploadArea.addEventListener('dragleave', handleDragLeave);
        fileUploadArea.addEventListener('drop', handleDrop);
        fileUploadArea.addEventListener('click', () => {
            if (fileInput) {
                fileInput.click();
            } else {
                console.error('Elemento fileInput no encontrado');
            }
        });
        console.log('Event listeners de drag & drop configurados');
    } else {
        console.error('Elemento fileUploadArea no encontrado');
    }
    
    // Protección robusta para el input de archivo regular
    if (fileInput) {
        // Remover cualquier event listener previo para evitar duplicados
        fileInput.replaceWith(fileInput.cloneNode(true));
        
        // Re-obtener la referencia después del reemplazo
        fileInput = document.getElementById('fileInput');
        
        fileInput.addEventListener('change', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Input de archivo cambió');
            
            const files = Array.from(e.target.files);
            addFiles(files);
            
            // Limpiar el valor después de procesar
            setTimeout(() => {
                fileInput.value = '';
            }, 100);
            
            return false;
        });
        
        // Protección adicional: prevenir cualquier submit del formulario padre
        const form = fileInput.closest('form');
        if (form) {
            const originalSubmit = form.onsubmit;
            form.onsubmit = (e) => {
                // Si el evento viene del input de archivo, prevenirlo
                if (e.target === fileInput || e.submitter === fileInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Submit desde input de archivo prevenido');
                    return false;
                }
                // Si hay un submit handler original, llamarlo
                if (originalSubmit) {
                    return originalSubmit.call(form, e);
                }
            };
        }
        
        console.log('Event listener de fileInput configurado con protección adicional');
    } else {
        console.error('Elemento fileInput no encontrado');
    }
    
    updateFileList();
    
    // Lógica para tomar foto con protección adicional
    if (takePhotoBtn && cameraInput) {
        // Remover cualquier event listener previo para evitar duplicados
        takePhotoBtn.replaceWith(takePhotoBtn.cloneNode(true));
        cameraInput.replaceWith(cameraInput.cloneNode(true));
        
        // Re-obtener las referencias después del reemplazo
        takePhotoBtn = document.getElementById('takePhotoBtn');
        cameraInput = document.getElementById('cameraInput');
        
        takePhotoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Botón de tomar foto clickeado');
            
            // Preservar el estado del formulario antes de abrir la cámara
            const form = document.getElementById('registerForm');
            if (form) {
                const formState = {
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
                
                // Guardar en sessionStorage para persistir durante la sesión de la cámara
                sessionStorage.setItem('registerFormState', JSON.stringify(formState));
                console.log('Estado del formulario guardado antes de abrir cámara:', formState);
            }
            
            // Limpiar el valor del input antes de abrir la cámara
            cameraInput.value = '';
            
            // Usar setTimeout para asegurar que el evento se procese completamente
            setTimeout(() => {
                cameraInput.click();
            }, 100);
            
            return false;
        });
        
        cameraInput.addEventListener('change', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Input de cámara cambió');
            
            const files = Array.from(e.target.files);
            addFiles(files);
            
            // Restaurar el estado del formulario después de tomar la foto
            const savedState = sessionStorage.getItem('registerFormState');
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
                        console.log('Estado del formulario restaurado después de tomar foto:', formState);
                    }
                    // Limpiar el estado guardado
                    sessionStorage.removeItem('registerFormState');
                } catch (error) {
                    console.error('Error al restaurar estado del formulario:', error);
                }
            }
            
            // Limpiar el valor después de procesar
            setTimeout(() => {
                cameraInput.value = '';
            }, 100);
            
            return false;
        });
        
        // Protección adicional: prevenir cualquier submit del formulario padre
        const form = cameraInput.closest('form');
        if (form) {
            const originalSubmit = form.onsubmit;
            form.onsubmit = (e) => {
                // Si el evento viene del input de la cámara, prevenirlo
                if (e.target === cameraInput || e.submitter === cameraInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Submit desde input de cámara prevenido');
                    return false;
                }
                // Si hay un submit handler original, llamarlo
                if (originalSubmit) {
                    return originalSubmit.call(form, e);
                }
            };
        }
        
        console.log('Event listeners de cámara configurados con protección adicional');
    } else {
        console.warn('Elementos de cámara no encontrados:', {
            takePhotoBtn: !!takePhotoBtn,
            cameraInput: !!cameraInput
        });
    }
    
    console.log('Configuración de subida de archivos completada');
} 