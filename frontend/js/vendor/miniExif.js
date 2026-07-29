/**
 * Minimal, dependency-free EXIF reader for JPEG files.
 * Extracts only what the Metadata Extractor tool needs: camera Make/Model,
 * DateTimeOriginal, and GPS coordinates. No image data ever leaves the
 * browser — this runs entirely client-side.
 */

const TAG = {
  Make: 0x010f,
  Model: 0x0110,
  ExifIFDPointer: 0x8769,
  GPSInfoIFDPointer: 0x8825,
  DateTimeOriginal: 0x9003,
};

const GPS_TAG = {
  GPSLatitudeRef: 1,
  GPSLatitude: 2,
  GPSLongitudeRef: 3,
  GPSLongitude: 4,
};

function readString(view, offset, length) {
  const bytes = new Uint8Array(view.buffer, offset, length);
  let s = '';
  for (let i = 0; i < bytes.length && bytes[i] !== 0; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function readIFD(view, tiffStart, ifdOffset, littleEndian) {
  const entries = {};
  const count = view.getUint16(tiffStart + ifdOffset, littleEndian);
  for (let i = 0; i < count; i++) {
    const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
    entries[view.getUint16(entryOffset, littleEndian)] = {
      type: view.getUint16(entryOffset + 2, littleEndian),
      numValues: view.getUint32(entryOffset + 4, littleEndian),
      valueOffsetField: entryOffset + 8,
    };
  }
  return entries;
}

function typeSize(type) {
  switch (type) {
    case 1:
    case 2:
    case 7:
      return 1; // BYTE, ASCII, UNDEFINED
    case 3:
      return 2; // SHORT
    case 4:
    case 9:
      return 4; // LONG, SLONG
    case 5:
    case 10:
      return 8; // RATIONAL, SRATIONAL
    default:
      return 1;
  }
}

function readValueOffset(view, entry, tiffStart, littleEndian) {
  const size = typeSize(entry.type) * entry.numValues;
  return size > 4
    ? tiffStart + view.getUint32(entry.valueOffsetField, littleEndian)
    : entry.valueOffsetField;
}

function readRational(view, offset, littleEndian) {
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

function readAscii(view, entry, tiffStart, littleEndian) {
  return readString(view, readValueOffset(view, entry, tiffStart, littleEndian), entry.numValues).trim();
}

function readGpsCoord(view, entry, tiffStart, littleEndian) {
  const offset = readValueOffset(view, entry, tiffStart, littleEndian);
  const deg = readRational(view, offset, littleEndian);
  const min = readRational(view, offset + 8, littleEndian);
  const sec = readRational(view, offset + 16, littleEndian);
  return deg + min / 60 + sec / 3600;
}

/**
 * Parse Make/Model/DateTimeOriginal/GPS out of a JPEG's EXIF header.
 * Fails safe: returns null on anything that isn't a well-formed JPEG+EXIF.
 * @param {ArrayBuffer} buffer
 * @returns {{ make: string|null, model: string|null, dateTimeOriginal: string|null, gpsLatitude: number|null, gpsLongitude: number|null } | null}
 */
export function parseExif(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    let exifOffset = null;

    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffda) break; // start of scan — no more metadata segments
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && readString(view, offset + 4, 6) === 'Exif') {
        exifOffset = offset + 4 + 6;
        break;
      }
      offset += 2 + size;
    }
    if (exifOffset == null) return null;

    const tiffStart = exifOffset;
    const littleEndian = view.getUint16(tiffStart) === 0x4949;
    const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
    const ifd0 = readIFD(view, tiffStart, firstIfdOffset, littleEndian);

    const result = {
      make: null,
      model: null,
      dateTimeOriginal: null,
      gpsLatitude: null,
      gpsLongitude: null,
    };

    if (ifd0[TAG.Make]) result.make = readAscii(view, ifd0[TAG.Make], tiffStart, littleEndian);
    if (ifd0[TAG.Model]) result.model = readAscii(view, ifd0[TAG.Model], tiffStart, littleEndian);

    if (ifd0[TAG.ExifIFDPointer]) {
      const exifIfdOffset = view.getUint32(ifd0[TAG.ExifIFDPointer].valueOffsetField, littleEndian);
      const exifIfd = readIFD(view, tiffStart, exifIfdOffset, littleEndian);
      if (exifIfd[TAG.DateTimeOriginal]) {
        result.dateTimeOriginal = readAscii(view, exifIfd[TAG.DateTimeOriginal], tiffStart, littleEndian);
      }
    }

    if (ifd0[TAG.GPSInfoIFDPointer]) {
      const gpsIfdOffset = view.getUint32(ifd0[TAG.GPSInfoIFDPointer].valueOffsetField, littleEndian);
      const gpsIfd = readIFD(view, tiffStart, gpsIfdOffset, littleEndian);

      if (gpsIfd[GPS_TAG.GPSLatitude] && gpsIfd[GPS_TAG.GPSLatitudeRef]) {
        const lat = readGpsCoord(view, gpsIfd[GPS_TAG.GPSLatitude], tiffStart, littleEndian);
        const ref = readString(
          view,
          readValueOffset(view, gpsIfd[GPS_TAG.GPSLatitudeRef], tiffStart, littleEndian),
          1,
        );
        result.gpsLatitude = ref === 'S' ? -lat : lat;
      }
      if (gpsIfd[GPS_TAG.GPSLongitude] && gpsIfd[GPS_TAG.GPSLongitudeRef]) {
        const lon = readGpsCoord(view, gpsIfd[GPS_TAG.GPSLongitude], tiffStart, littleEndian);
        const ref = readString(
          view,
          readValueOffset(view, gpsIfd[GPS_TAG.GPSLongitudeRef], tiffStart, littleEndian),
          1,
        );
        result.gpsLongitude = ref === 'W' ? -lon : lon;
      }
    }

    return result;
  } catch {
    return null;
  }
}
