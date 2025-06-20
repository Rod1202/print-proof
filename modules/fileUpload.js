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
    fileInput = document.getElementById('fileInput');
    fileUploadArea = document.getElementById('fileUploadArea');
    fileList = document.getElementById('fileList');
    takePhotoBtn = document.getElementById('takePhotoBtn');
    cameraInput = document.getElementById('cameraInput');
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleDrop);
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    updateFileList();
    // Lógica para tomar foto
    if (takePhotoBtn && cameraInput) {
        takePhotoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cameraInput.value = '';
            cameraInput.click();
        });
        cameraInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            addFiles(files);
        });
    }
} 