export const DATA_TYPE_RANGE = 32767;

export const DATA_TYPES: { [key: number]: string } = {
  0: 'unknown',
  1: 'binary (1 bit)',
  2: 'unsigned char (8 bits)',
  4: 'signed short (16 bits)',
  8: 'signed int (32 bits)',
  16: 'float (32 bits)',
  32: 'complex (64 bits)',
  64: 'double (64 bits)',
  128: 'RGB triple (24 bits)',
  255: 'unknown',
  256: 'signed char (8 bits)',
  512: 'unsigned short (16 bits)',
  768: 'unsigned int (32 bits)',
  1024: 'long long (64 bits)',
  1280: 'unsigned long long (64 bits)',
  1536: 'long double (128 bits)',
  1792: 'double pair (128 bits)',
  2048: 'long double pair (256 bits)',
  2304: '4 byte RGBA (32 bits)',
};