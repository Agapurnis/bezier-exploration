/**
 * A type that can be placed as a start or end point in a linear interpolation function.
 * This means it satisfies the following constraints:
 *   - It can be multiplied by a number and the result its own type.
 *   - It can be added and subtracted and the result is its own type.
 */
export type LinearlyInterpolatableViaMathOperations =
    | number
    | Vector2
    | Vector2int16
    | Vector3
    | Vector3int16

/**
 * A general monotonic linear interpolation function for types that support addition, subtraction, and scalar multiplication.
 *
 * It is unspecialized; creating specifically constructed native definitions in Luau can result in more optimal performance.
 * Additionally, usage of the native `Lerp` method on applicable types is recommended.
 *
 * Note that this uses an imprecise method of computation, with the outcome being `lerp(a, b, 1)` may not
 * always equal `b` due to floating point inaccuracies.
 * The more precise `flerp` can be used if this behavior is not desired.
 *
 * @param a the starting point
 * @param b the ending point
 * @param t the "time"; the progress in the interpolation; a value ranging from zero to one, inclusive on both ends
 * @returns a linearly interpolated value based on the inputs
 * @see https://en.wikipedia.org/wiki/Linear_interpolation
 * @see flerp - A general linear interpolation function with greater floating point precision.
 */
export declare function glerp<T extends LinearlyInterpolatableViaMathOperations>(a: T, b: T, t: number): T;

/**
 * A general precise & monotonic (given `0 <= t <= 1`) linear interpolation function for types that support addition, subtraction, and scalar multiplication.
 *
 * It is unspecialized; creating specifically constructed native definitions in Luau can result in more optimal performance.
 * Additionally, usage of the native `Lerp` method on applicable types is recommended.
 *
 * @param a the starting point
 * @param b the ending point
 * @param t the "time"; the progress in the interpolation; a value ranging from zero to one, inclusive on both ends
 * @returns a linearly interpolated value based on the inputs
 * @see https://en.wikipedia.org/wiki/Linear_interpolation
 * @see glerp - A more optimized general linear interpolation function that sacrifices some floating point precision.
 */
export declare function flerp<T extends LinearlyInterpolatableViaMathOperations>(a: T, b: T, t: number): T;

