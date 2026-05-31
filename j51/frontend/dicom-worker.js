let wasm = null;
let isInitialized = false;
let initializationPromise = null;

async function initWasm() {
    if (isInitialized) return;
    if (initializationPromise) return initializationPromise;
    
    initializationPromise = (async () => {
        try {
            const module = await import('./pkg/dicom_wasm.js');
            await module.default();
            if (module.init_panic_hook) {
                module.init_panic_hook();
            }
            wasm = module;
            isInitialized = true;
            self.postMessage({ type: 'init', success: true });
        } catch (error) {
            self.postMessage({ 
                type: 'init', 
                success: false, 
                error: error.message 
            });
            throw error;
        }
    })();
    
    return initializationPromise;
}

function readFileInChunks(file, chunkSize = 1024 * 1024 * 10) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let offset = 0;
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            if (e.target.error) {
                reject(e.target.error);
                return;
            }
            
            chunks.push(new Uint8Array(e.target.result));
            offset += chunkSize;
            
            if (offset < file.size) {
                readNextChunk();
            } else {
                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let position = 0;
                for (const chunk of chunks) {
                    result.set(chunk, position);
                    position += chunk.length;
                }
                resolve(result);
            }
        };
        
        reader.onerror = () => reject(reader.error);
        
        function readNextChunk() {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        }
        
        readNextChunk();
    });
}

async function processFile(fileId, file) {
    try {
        await initWasm();
        
        self.postMessage({
            type: 'progress',
            fileId,
            percent: 5,
            stage: '读取文件'
        });

        const fileSizeMB = file.size / (1024 * 1024);
        
        let data;
        if (file.size > 50 * 1024 * 1024) {
            data = await readFileInChunks(file, 10 * 1024 * 1024);
        } else {
            data = new Uint8Array(await file.arrayBuffer());
        }

        self.postMessage({
            type: 'progress',
            fileId,
            percent: 35,
            stage: '解析 DICOM'
        });

        const result = wasm.process_dicom_stream(data);
        
        self.postMessage({
            type: 'progress',
            fileId,
            percent: 75,
            stage: '脱敏处理'
        });

        data = null;
        
        if (fileSizeMB > 100) {
            setTimeout(() => {
                if (wasm.free_memory) {
                    wasm.free_memory();
                }
            }, 100);
        }

        self.postMessage({
            type: 'progress',
            fileId,
            percent: 100,
            stage: '完成'
        });

        self.postMessage({
            type: 'result',
            fileId,
            success: true,
            data: result.data,
            info: result.info
        }, [result.data.buffer]);

    } catch (error) {
        self.postMessage({
            type: 'result',
            fileId,
            success: false,
            error: error.message
        });
    }
}

async function getInfoOnly(fileId, file) {
    try {
        await initWasm();

        const data = new Uint8Array(await file.arrayBuffer());
        const info = wasm.process_dicom_info_only(data);
        
        self.postMessage({
            type: 'info',
            fileId,
            success: true,
            info: info
        });

    } catch (error) {
        self.postMessage({
            type: 'info',
            fileId,
            success: false,
            error: error.message
        });
    }
}

self.onmessage = async function(e) {
    const { type, fileId, file } = e.data;
    
    switch (type) {
        case 'init':
            await initWasm();
            break;
        case 'process':
            await processFile(fileId, file);
            break;
        case 'info':
            await getInfoOnly(fileId, file);
            break;
        case 'cancel':
            break;
    }
};

initWasm();
