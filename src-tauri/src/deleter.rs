use std::path::PathBuf;

/// Result of a batch delete operation.
pub struct DeleteResult {
    pub deleted: usize,
    pub errors: Vec<(String, String)>, // (path, error_message)
}

/// Delete files, preferring Recycle Bin / Trash when available.
///
/// Falls back to permanent deletion (`std::fs::remove_file`) if the trash
/// crate fails. Returns the count of deleted files and any errors.
pub fn delete_files(paths: &[PathBuf]) -> DeleteResult {
    let mut deleted: usize = 0;
    let mut errors: Vec<(String, String)> = Vec::new();

    for path in paths {
        // Try trash first (cross-platform recycle bin).
        match trash::delete(path) {
            Ok(()) => {
                deleted += 1;
                continue;
            }
            Err(_) => {
                // Fallback to permanent deletion.
                match std::fs::remove_file(path) {
                    Ok(()) => {
                        deleted += 1;
                    }
                    Err(e) => {
                        errors.push((
                            path.to_string_lossy().to_string(),
                            format!("Could not delete {}:\n{}", path.display(), e),
                        ));
                    }
                }
            }
        }
    }

    DeleteResult { deleted, errors }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_delete_removes_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("file.txt");
        fs::write(&f, b"data").unwrap();
        assert!(f.exists());

        let result = delete_files(&[f.clone()]);
        // The file should be gone (either trashed or deleted).
        assert!(!f.exists());
        assert_eq!(result.deleted, 1);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_empty_list_does_nothing() {
        let result = delete_files(&[]);
        assert_eq!(result.deleted, 0);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_error_on_nonexistent_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("gone.txt");
        let result = delete_files(&[f]);
        // Should report an error since the file doesn't exist.
        assert_eq!(result.deleted, 0);
        assert_eq!(result.errors.len(), 1);
    }
}
