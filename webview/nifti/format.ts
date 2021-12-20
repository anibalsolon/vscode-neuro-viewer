export type NiftiDataType = 'NONE' | 'BINARY' | 'UINT8' | 'INT16' | 'INT32' |
                            'FLOAT32' | 'COMPLEX64' | 'FLOAT64' | 'RGB24' |
                            'INT8' | 'UINT16' | 'UINT32' | 'INT64' | 'UINT64' |
                            'FLOAT128' | 'COMPLEX128' | 'COMPLEX256';

export type NiftiHeader = {
  dimensions: number[],
  dataType: NiftiDataType,
  qOffset: { x: number, y: number, z: number },
  pixelSizes: number[],
  affine: number[][],
  values: {
    max: number,
    min: number,
    scaling: {
      slope: number,
      intercept: number,
    }
  }
};

export type NiftiImage = { header: NiftiHeader, data: Int16Array };
