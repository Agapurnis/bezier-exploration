// conditions: must impl metaops
export interface AddOp { add(rhs: this): this }
export interface SubtractOp { add(rhs: this): this }
export interface ScalarMultiplyOp { mul(scalar: number): this }
