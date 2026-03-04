//! Extract a lightweight media fingerprint from image files.
//!
//! Returns a string like `"img:1920x1080"` for images whose dimensions can be
//! read.  Currently supports JPEG/TIFF (via EXIF) and PNG (via IHDR header
//! parsing).  All errors are swallowed and return `None` so the caller can
//! simply skip non-media or unreadable files.

use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Try to extract a media fingerprint from a file.
///
/// Returns `Some("img:WxH")` for images with readable dimensions, or `None`
/// for non-media files, unreadable files, or images where the dimensions
/// cannot be determined.
pub fn extract_media_fingerprint(path: &Path) -> Option<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())?;

    match ext.as_str() {
        "jpg" | "jpeg" | "tif" | "tiff" => extract_exif_dimensions(path),
        "png" => extract_png_dimensions(path),
        _ => None,
    }
}

/// Read image dimensions from EXIF metadata (JPEG / TIFF).
fn extract_exif_dimensions(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;

    // Try PixelXDimension / PixelYDimension first (EXIF IFD).
    let width = exif
        .get_field(exif::Tag::PixelXDimension, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .or_else(|| {
            exif.get_field(exif::Tag::ImageWidth, exif::In::PRIMARY)
                .and_then(|f| f.value.get_uint(0))
        })?;

    let height = exif
        .get_field(exif::Tag::PixelYDimension, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .or_else(|| {
            exif.get_field(exif::Tag::ImageLength, exif::In::PRIMARY)
                .and_then(|f| f.value.get_uint(0))
        })?;

    Some(format!("img:{}x{}", width, height))
}

/// Read image dimensions from the PNG IHDR chunk (bytes 16–23).
fn extract_png_dimensions(path: &Path) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;

    // PNG signature is 8 bytes, then IHDR chunk: 4-byte length, 4-byte "IHDR",
    // then 4-byte width (BE u32) and 4-byte height (BE u32).
    // So width starts at offset 16, height at offset 20.
    let mut header = [0u8; 24];
    file.seek(SeekFrom::Start(0)).ok()?;
    file.read_exact(&mut header).ok()?;

    // Validate PNG signature.
    const PNG_SIG: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if header[..8] != PNG_SIG {
        return None;
    }

    let width = u32::from_be_bytes([header[16], header[17], header[18], header[19]]);
    let height = u32::from_be_bytes([header[20], header[21], header[22], header[23]]);

    if width == 0 || height == 0 {
        return None;
    }

    Some(format!("img:{}x{}", width, height))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_png_dimensions() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("test.png");

        // Minimal valid PNG: 1x1 pixel, RGBA.
        // PNG sig + IHDR chunk (width=1, height=1, bit depth=8, color type=6 RGBA).
        let mut png_data: Vec<u8> = Vec::new();
        // PNG signature
        png_data.extend_from_slice(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        // IHDR chunk: length=13
        png_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x0D]);
        // Chunk type: IHDR
        png_data.extend_from_slice(b"IHDR");
        // Width: 320
        png_data.extend_from_slice(&320u32.to_be_bytes());
        // Height: 240
        png_data.extend_from_slice(&240u32.to_be_bytes());
        // Bit depth=8, color=6 (RGBA), compression=0, filter=0, interlace=0
        png_data.extend_from_slice(&[8, 6, 0, 0, 0]);
        // CRC placeholder (not validated by our code)
        png_data.extend_from_slice(&[0x00; 4]);

        fs::write(&f, &png_data).unwrap();

        let result = extract_media_fingerprint(&f);
        assert_eq!(result, Some("img:320x240".into()));
    }

    #[test]
    fn test_non_media_returns_none() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("readme.txt");
        fs::write(&f, b"hello world").unwrap();
        assert_eq!(extract_media_fingerprint(&f), None);
    }

    #[test]
    fn test_missing_file_returns_none() {
        let path = Path::new("/nonexistent/image.jpg");
        assert_eq!(extract_media_fingerprint(path), None);
    }

    #[test]
    fn test_corrupt_jpg_returns_none() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("corrupt.jpg");
        fs::write(&f, b"this is not a real jpeg").unwrap();
        assert_eq!(extract_media_fingerprint(&f), None);
    }

    #[test]
    fn test_corrupt_png_returns_none() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("corrupt.png");
        fs::write(&f, b"this is not a real png").unwrap();
        assert_eq!(extract_media_fingerprint(&f), None);
    }

    #[test]
    fn test_no_extension_returns_none() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("noext");
        fs::write(&f, b"some data").unwrap();
        assert_eq!(extract_media_fingerprint(&f), None);
    }
}
