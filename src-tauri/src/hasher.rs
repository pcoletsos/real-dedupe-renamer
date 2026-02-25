use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

const CHUNK_SIZE: usize = 1024 * 1024; // 1 MB

/// Return the SHA-256 hex digest for a file (streamed to handle large files).
pub fn sha256_file(path: &Path) -> Result<String, std::io::Error> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; CHUNK_SIZE];

    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_known_hash() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("test.txt");
        fs::write(&f, b"hello world").unwrap();
        assert_eq!(
            sha256_file(&f).unwrap(),
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
    }

    #[test]
    fn test_empty_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("empty.txt");
        fs::write(&f, b"").unwrap();
        assert_eq!(
            sha256_file(&f).unwrap(),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_large_file_exercises_chunking() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("large.bin");
        // Larger than 1 MB chunk to exercise the loop
        fs::write(&f, vec![0u8; CHUNK_SIZE + 1]).unwrap();
        let result = sha256_file(&f).unwrap();
        assert_eq!(result.len(), 64); // valid hex digest
    }
}
