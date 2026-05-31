use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufReader, BufWriter, Read, Write, Seek, SeekFrom};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChunkResult {
    pub chunk: String,
    pub offset: u64,
    pub total_size: u64,
    pub has_more: bool,
}

#[cfg(windows)]
mod windows_fs {
    use super::*;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    type HANDLE = *mut std::ffi::c_void;
    type BOOL = i32;
    type DWORD = u32;
    type LPCWSTR = *const u16;
    type LPVOID = *mut std::ffi::c_void;
    type LPDWORD = *mut u32;
    type LPOVERLAPPED = *mut std::ffi::c_void;
    type LONG = i32;
    type LPLONG = *mut i32;
    type PLARGE_INTEGER = *mut i64;

    const INVALID_HANDLE_VALUE: HANDLE = -1isize as HANDLE;
    const OPEN_EXISTING: DWORD = 3;
    const CREATE_ALWAYS: DWORD = 2;
    const FILE_SHARE_READ: DWORD = 1;
    const FILE_GENERIC_READ: DWORD = 0x80000000 | 0x00100000 | 0x00000001;
    const FILE_GENERIC_WRITE: DWORD = 0x40000000 | 0x00100000 | 0x00000002;
    const FILE_BEGIN: DWORD = 0;
    const ERROR_SUCCESS: u32 = 0;
    const ERROR_FILE_NOT_FOUND: u32 = 2;
    const ERROR_PATH_NOT_FOUND: u32 = 3;
    const ERROR_ACCESS_DENIED: u32 = 5;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateFileW(
            lpFileName: LPCWSTR,
            dwDesiredAccess: DWORD,
            dwShareMode: DWORD,
            lpSecurityAttributes: LPVOID,
            dwCreationDisposition: DWORD,
            dwFlagsAndAttributes: DWORD,
            hTemplateFile: HANDLE,
        ) -> HANDLE;

        fn ReadFile(
            hFile: HANDLE,
            lpBuffer: LPVOID,
            nNumberOfBytesToRead: DWORD,
            lpNumberOfBytesRead: LPDWORD,
            lpOverlapped: LPOVERLAPPED,
        ) -> BOOL;

        fn WriteFile(
            hFile: HANDLE,
            lpBuffer: LPVOID,
            nNumberOfBytesToWrite: DWORD,
            lpNumberOfBytesWritten: LPDWORD,
            lpOverlapped: LPOVERLAPPED,
        ) -> BOOL;

        fn CloseHandle(hObject: HANDLE) -> BOOL;

        fn GetFileSizeEx(hFile: HANDLE, lpFileSize: PLARGE_INTEGER) -> BOOL;

        fn SetFilePointerEx(
            hFile: HANDLE,
            liDistanceToMove: i64,
            lpNewFilePointer: PLARGE_INTEGER,
            dwMoveMethod: DWORD,
        ) -> BOOL;

        fn GetLastError() -> u32;

        fn CreateDirectoryW(lpPathName: LPCWSTR, lpSecurityAttributes: LPVOID) -> BOOL;
    }

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn format_error(code: u32) -> String {
        match code {
            ERROR_FILE_NOT_FOUND => "系统找不到指定的文件".to_string(),
            ERROR_PATH_NOT_FOUND => "系统找不到指定的路径".to_string(),
            ERROR_ACCESS_DENIED => "拒绝访问".to_string(),
            _ => format!("Windows 错误代码: {}", code),
        }
    }

    fn create_directory_recursive(path: &str) -> Result<(), String> {
        let wide = to_wide(path);
        unsafe {
            if CreateDirectoryW(wide.as_ptr(), std::ptr::null_mut()) != 0 {
                return Ok(());
            }
            let err = GetLastError();
            if err == ERROR_SUCCESS || err == 183 {
                return Ok(());
            }
            if err == ERROR_PATH_NOT_FOUND {
                if let Some(parent) = std::path::Path::new(path).parent() {
                    if let Some(parent_str) = parent.to_str() {
                        create_directory_recursive(parent_str)?;
                        let wide2 = to_wide(path);
                        if CreateDirectoryW(wide2.as_ptr(), std::ptr::null_mut()) != 0 {
                            return Ok(());
                        }
                    }
                }
            }
            Err(format!("创建目录失败: {}", format_error(err)))
        }
    }

    fn open_file_read(path: &str) -> Result<HANDLE, String> {
        let wide = to_wide(path);
        unsafe {
            let handle = CreateFileW(
                wide.as_ptr(),
                FILE_GENERIC_READ,
                FILE_SHARE_READ,
                std::ptr::null_mut(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            );
            if handle == INVALID_HANDLE_VALUE {
                let err = GetLastError();
                return Err(format!("打开文件失败: {} ({})", format_error(err), path));
            }
            Ok(handle)
        }
    }

    fn get_file_size(handle: HANDLE) -> Result<u64, String> {
        unsafe {
            let mut size = 0i64;
            if GetFileSizeEx(handle, &mut size) == 0 {
                let err = GetLastError();
                return Err(format!("获取文件大小失败: {}", format_error(err)));
            }
            Ok(size as u64)
        }
    }

    fn seek_file(handle: HANDLE, offset: u64) -> Result<(), String> {
        unsafe {
            let mut new_pos = 0i64;
            if SetFilePointerEx(handle, offset as i64, &mut new_pos, FILE_BEGIN) == 0 {
                let err = GetLastError();
                return Err(format!("定位文件失败: {}", format_error(err)));
            }
            Ok(())
        }
    }

    pub fn read_file_impl(path: String) -> Result<FileContent, String> {
        let handle = open_file_read(&path)?;
        unsafe {
            let size = get_file_size(handle)?;
            seek_file(handle, 0)?;

            let mut buffer = vec![0u8; size as usize];
            let mut bytes_read = 0u32;
            if ReadFile(
                handle,
                buffer.as_mut_ptr() as *mut _,
                size as u32,
                &mut bytes_read,
                std::ptr::null_mut(),
            ) == 0
            {
                let err = GetLastError();
                CloseHandle(handle);
                return Err(format!("读取文件失败: {}", format_error(err)));
            }

            buffer.truncate(bytes_read as usize);
            let content = String::from_utf8(buffer).unwrap_or_else(|e| {
                String::from_utf8_lossy(&e.into_bytes()).into_owned()
            });

            CloseHandle(handle);
            Ok(FileContent { path, content, size })
        }
    }

    pub fn read_file_chunk_impl(
        path: String,
        offset: u64,
        chunk_size: usize,
    ) -> Result<ChunkResult, String> {
        let handle = open_file_read(&path)?;
        unsafe {
            let total_size = get_file_size(handle)?;
            seek_file(handle, offset)?;

            let mut buffer = vec![0u8; chunk_size];
            let mut bytes_read = 0u32;
            if ReadFile(
                handle,
                buffer.as_mut_ptr() as *mut _,
                chunk_size as u32,
                &mut bytes_read,
                std::ptr::null_mut(),
            ) == 0
            {
                let err = GetLastError();
                CloseHandle(handle);
                return Err(format!("读取文件失败: {}", format_error(err)));
            }

            buffer.truncate(bytes_read as usize);
            let chunk = String::from_utf8(buffer).unwrap_or_else(|e| {
                String::from_utf8_lossy(&e.into_bytes()).into_owned()
            });

            let new_offset = offset + bytes_read as u64;
            let has_more = new_offset < total_size;

            CloseHandle(handle);
            Ok(ChunkResult {
                chunk,
                offset: new_offset,
                total_size,
                has_more,
            })
        }
    }

    pub fn write_file_impl(path: String, content: String) -> Result<FileContent, String> {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            if let Some(parent_str) = parent.to_str() {
                if !parent_str.is_empty() {
                    create_directory_recursive(parent_str)?;
                }
            }
        }

        let wide = to_wide(&path);
        unsafe {
            let handle = CreateFileW(
                wide.as_ptr(),
                FILE_GENERIC_WRITE,
                FILE_SHARE_READ,
                std::ptr::null_mut(),
                CREATE_ALWAYS,
                0,
                std::ptr::null_mut(),
            );
            if handle == INVALID_HANDLE_VALUE {
                let err = GetLastError();
                return Err(format!("创建文件失败: {} ({})", format_error(err), path));
            }

            let bytes = content.as_bytes();
            let mut bytes_written = 0u32;
            if WriteFile(
                handle,
                bytes.as_ptr() as *mut _,
                bytes.len() as u32,
                &mut bytes_written,
                std::ptr::null_mut(),
            ) == 0
            {
                let err = GetLastError();
                CloseHandle(handle);
                return Err(format!("写入文件失败: {}", format_error(err)));
            }

            let size = get_file_size(handle)?;
            CloseHandle(handle);
            Ok(FileContent {
                path,
                content,
                size,
            })
        }
    }

    pub fn get_file_info_impl(path: String) -> Result<FileContent, String> {
        let handle = open_file_read(&path)?;
        unsafe {
            let size = get_file_size(handle)?;
            CloseHandle(handle);
            Ok(FileContent {
                path,
                content: String::new(),
                size,
            })
        }
    }
}

#[cfg(not(windows))]
mod portable_fs {
    use super::*;

    pub fn read_file_impl(path: String) -> Result<FileContent, String> {
        let file_path = PathBuf::from(&path);
        if !file_path.exists() {
            return Err(format!("文件不存在: {}", path));
        }

        let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
        let size = metadata.len();

        let file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(file);

        let mut content = String::new();
        reader.read_to_string(&mut content).map_err(|e| e.to_string())?;

        Ok(FileContent { path, content, size })
    }

    pub fn read_file_chunk_impl(
        path: String,
        offset: u64,
        chunk_size: usize,
    ) -> Result<ChunkResult, String> {
        let file_path = PathBuf::from(&path);
        if !file_path.exists() {
            return Err(format!("文件不存在: {}", path));
        }

        let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
        let total_size = metadata.len();

        let file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(file);

        reader.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;

        let mut buffer = vec![0u8; chunk_size];
        let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        buffer.truncate(bytes_read);

        let chunk = String::from_utf8(buffer).unwrap_or_else(|e| {
            String::from_utf8_lossy(&e.into_bytes()).into_owned()
        });
        let new_offset = offset + bytes_read as u64;
        let has_more = new_offset < total_size;

        Ok(ChunkResult {
            chunk,
            offset: new_offset,
            total_size,
            has_more,
        })
    }

    pub fn write_file_impl(path: String, content: String) -> Result<FileContent, String> {
        let file_path = PathBuf::from(&path);

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
        let mut writer = BufWriter::new(file);
        writer.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;

        let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;

        Ok(FileContent {
            path,
            content,
            size: metadata.len(),
        })
    }

    pub fn get_file_info_impl(path: String) -> Result<FileContent, String> {
        let file_path = PathBuf::from(&path);
        if !file_path.exists() {
            return Err(format!("文件不存在: {}", path));
        }

        let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;

        Ok(FileContent {
            path,
            content: String::new(),
            size: metadata.len(),
        })
    }
}

#[cfg(windows)]
use windows_fs::*;

#[cfg(not(windows))]
use portable_fs::*;

#[tauri::command]
pub fn read_file(path: String) -> Result<FileContent, String> {
    read_file_impl(path)
}

#[tauri::command]
pub fn read_file_chunk(path: String, offset: u64, chunk_size: usize) -> Result<ChunkResult, String> {
    read_file_chunk_impl(path, offset, chunk_size)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<FileContent, String> {
    write_file_impl(path, content)
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileContent, String> {
    get_file_info_impl(path)
}
