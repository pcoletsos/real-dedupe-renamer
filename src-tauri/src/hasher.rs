use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use sha2::{Digest, Sha256};

const CHUNK_SIZE: usize = 1024 * 1024; // 1 MB
const FAST_HASH_CHUNK: usize = 64 * 1024; // 64 KB

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

/// Return a fast SHA-256 digest based on file size + head chunk + tail chunk.
///
/// This is **not** a full content hash.  Two files with identical size, head,
/// and tail but different middle content will produce the same digest.
/// Intended as a probabilistic "likely duplicate" check for large files where
/// full hashing is impractical.
///
/// For files ≤ 128 KB the entire content is hashed (the head covers all or
/// head + remainder covers all), so small files degrade to a full-content
/// hash (prefixed by the size, so the digest differs from `sha256_file`).
pub fn sha256_fast(path: &Path) -> Result<String, std::io::Error> {
    let mut file = std::fs::File::open(path)?;
    let file_size = file.metadata()?.len();
    let mut hasher = Sha256::new();

    // Include file size so differently-sized files never collide.
    hasher.update(file_size.to_le_bytes());

    // Read head chunk.
    let head_len = std::cmp::min(FAST_HASH_CHUNK as u64, file_size) as usize;
    let mut head_buf = vec![0u8; head_len];
    file.read_exact(&mut head_buf)?;
    hasher.update(&head_buf);

    // Read tail chunk (only when file is large enough that tail differs from head).
    if file_size > (FAST_HASH_CHUNK as u64 * 2) {
        let tail_start = file_size - FAST_HASH_CHUNK as u64;
        file.seek(SeekFrom::Start(tail_start))?;
        let mut tail_buf = vec![0u8; FAST_HASH_CHUNK];
        file.read_exact(&mut tail_buf)?;
        hasher.update(&tail_buf);
    } else if file_size > head_len as u64 {
        // File is between head_len and 2 * FAST_HASH_CHUNK: read the rest.
        let remaining = (file_size - head_len as u64) as usize;
        let mut rest_buf = vec![0u8; remaining];
        file.read_exact(&mut rest_buf)?;
        hasher.update(&rest_buf);
    }
    // else: file fits entirely in head chunk — already fully hashed.

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

    // -- sha256_fast tests --

    #[test]
    fn test_fast_hash_deterministic() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("test.txt");
        fs::write(&f, b"hello world").unwrap();
        let h1 = sha256_fast(&f).unwrap();
        let h2 = sha256_fast(&f).unwrap();
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn test_fast_hash_large_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("large.bin");
        // Larger than 2 * FAST_HASH_CHUNK to exercise head + tail path.
        fs::write(&f, vec![0xAB; FAST_HASH_CHUNK * 3]).unwrap();
        let result = sha256_fast(&f).unwrap();
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn test_fast_hash_differs_from_full_hash() {
        // Fast hash prepends file size, so digests must differ.
        let dir = tempdir().unwrap();
        let f = dir.path().join("small.txt");
        fs::write(&f, b"same content").unwrap();
        let full = sha256_file(&f).unwrap();
        let fast = sha256_fast(&f).unwrap();
        assert_ne!(full, fast);
    }

    #[test]
    fn test_fast_hash_empty_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("empty.txt");
        fs::write(&f, b"").unwrap();
        let result = sha256_fast(&f).unwrap();
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn test_fast_hash_identical_files_match() {
        let dir = tempdir().unwrap();
        let f1 = dir.path().join("a.bin");
        let f2 = dir.path().join("b.bin");
        let content = vec![0x42; FAST_HASH_CHUNK * 4];
        fs::write(&f1, &content).unwrap();
        fs::write(&f2, &content).unwrap();
        assert_eq!(sha256_fast(&f1).unwrap(), sha256_fast(&f2).unwrap());
    }
}
