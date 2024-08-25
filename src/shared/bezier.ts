//!native

import { adaptive_guass_legendre_quadrature, gauss_legendre_quadrature } from "./integration";
import { AddOp, ScalarMultiplyOp, SubtractOp } from "./ops";

/**
 * @see https://en.wikipedia.org/wiki/Triangular_number
 */
function compute_nth_triangular_number(n: number) {
	return (n * (n + 1)) / 2;
}


// /**
//  * @param points the points to create a curve on: the first is the starting point, the last is the ending point, and those in-between are "control points"
//  * @param progress the progress into the interpolation: at zero, it will return the starting position, and at one, it will return the ending position
//  * @param derivative compute what derivative
//  * @see https://en.wikipedia.org/wiki/B%C3%A9zier_curve
//  */
// export function bezier<T extends number |Interpolatable>(
// 	points: MaybeReadonly<[start: T, ...control: Array<T>, end: T]>,
// 	progress: number,
// 	derivative = 0
// ): T {
// 	const degree = points.size() - 1;
// 	const powers = generate_powers(progress, degree);
// 	const coefficients = get_flattened_pascal_tetrahedron_layer(degree);
// 	let coefficient_index = 1; // skip first (fully weighted), used in terminator sum (see below)
// 	let sum = cn(points[points.size() - 1]) * powers[degree - 1];

// 	for (const index of $range(degree - 1, 0, -1)) {
// 		const point = points[index];
// 		let sign = (index % 2 === 1) ? 1 : -1;
// 		let scale = 0;
// 		for (const power of $range(degree - 1, index - 1, -1)) {
// 			const coefficient = (sign * coefficients[coefficient_index++]);
// 			scale += (power === -1) ? 1 : powers[power] * coefficient
// 			sign = -sign;
// 		}

// 		sum += cn(point) * scale;
// 	}

// 	return sum as unknown as T
// }

/**
 * @see https://oeis.org/A001399 ; Formula derived by Jon Perry on June 17th, 2003.
 *
 * This happens to be the required number of values in order to represent the `nth` layer
 * of Pascal's Tetrahedron when proper mirroring/reflections are used. I think.
 */
// Additional Facts:
//  - We only need to compute `floor(n / 3) + 1` lines of the tetrahedron to reach the center / obtain all values.
function A001399(n: number) {
	const d6 = n / 6;
	const m6 = n % 6;
	const t = math.floor(d6)
	const tn = t * (t + 1) / 2;
	return 6 * tn + m6 * (t + 1) + (m6 === 0 ? 1 : 0)
}


const pascal_halves: Array<Array<number>> = new Array(10)
function get_pascal_row_mirrorable(row: number): Array<number> {
	const memoized = pascal_halves[row];
	if (memoized !== undefined) return memoized;
	const len = math.ceil(row / 2);
	const output = new Array<number>(len);
	output[0] = 1;
	for (const index of $range(1, len)) {
		output[index] = output[index - 1] * (row - index + 1) / (index)
	}
	pascal_halves[row] = output;
	return output;
}


const flattened_pascal_tetrahedron_layers: Array<Array<number>> = table.create(10);
/**
 * @see https://en.wikipedia.org/wiki/Pascal%27s_pyramid
 */
function get_flattened_pascal_tetrahedron_layer(layer: number): Array<number> {
	const memoized = flattened_pascal_tetrahedron_layers[layer];
	if (memoized !== undefined) return memoized;
	const triangle_row = get_pascal_row_mirrorable(layer);
	const terms = compute_nth_triangular_number(layer); // you can actually compress to only `layer` elements !
	const output = new Array<number>(terms)
	output[0] = 1;
	let row_offset = 1;
	for (const row of $range(1, layer)) {
		const size = row + 1;
		const half = get_pascal_row_mirrorable(row)
		const triangle_row_multiplier = triangle_row[size > triangle_row.size() ? triangle_row.size() - row + math.floor(layer / 2) - 1 : row]
		for (const row_index of $range(1, math.ceil(size / 2))) { // use pairs?
			output[row_offset + size - row_index    ] = half[row_index - 1] * triangle_row_multiplier
			output[row_offset        + row_index - 1] = half[row_index - 1] * triangle_row_multiplier
			// TODO: i don't wanna have to make all of it actually
		}
		row_offset += size;
	}
	return output
}


// const powers_cache: Record</* value */ number, Record</* to */ number, Array<number>>> = {}
function generate_powers(value: number, to: number): Array<number> {
	// const in_power_cache = powers_cache[value] ??= {};
	// const memoized = in_power_cache[to];
	// if (memoized !== undefined) return memoized;
	const powers = new Array<number>(to);
	powers[0] = value;
	for (const i of $range(2, to)) {
		powers[i - 1] = powers[i - 2] * value;
	}
	// in_power_cache[to] = powers;
	return powers
}


const bezier_coefficients_cache: Record</* degree */ number, Record</* derivations */ number, Array<number>>> = {}
function get_bezier_coefficients(degree: number, derivations: number): Array<number> {
	const in_degree_cache = bezier_coefficients_cache[degree] ??= {};
	const memoized = in_degree_cache[derivations];
	if (memoized) return memoized;

	let derivatives_applied = 0;
	let coefficients = get_flattened_pascal_tetrahedron_layer(degree);
	let coefficient_index = 0;

	if (derivations !== 0) {
		coefficients = table.clone(coefficients);

		while (derivatives_applied !== derivations) {
			for (const index of $range(degree, 0, -1)) {
				const skip = math.max(derivatives_applied - index + 1, 0)
				for (const power of $range(degree - 1, index - 1 + skip, -1)) {
					if (power >= derivatives_applied) {
						coefficients[coefficient_index] *= (power - derivatives_applied + 1);
					}
					coefficient_index += 1;
				}
			}

			derivatives_applied += 1;
			coefficient_index = 0;
		}
	}

	in_degree_cache[derivations] = coefficients;

	return coefficients
}

/**
 * @param points the points to create a curve on: the first is the starting point, the last is the ending point, and those in-between are "control points"
 * @param progress the progress into the interpolation: at zero, it will return the starting position, and at one, it will return the ending position
 * @param derivative compute what derivative
 * @see https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 */
export function bezier<T extends number | Interpolatable>(
	points: MaybeReadonly<[start: T, ...control: Array<T>, end: T]>,
	progress: number,
	derivative = 0,
	degree = points.size() - 1,
): T {
	const powers = generate_powers(progress, degree);
	const coefficients = get_bezier_coefficients(degree, derivative);
	for (const outside of $range(-degree - derivative, -1)) powers[outside] = 1;
	const upsign = (degree % 2 === 0) ? 1 : -1;
	let sum = (points[degree] as number) * (powers[degree - 1 - derivative]) * coefficients[0]
	let coefficient_index = 1;

	for (const index of $range(degree - 1, 0, -1)) {
		let sign = (index % 2 === 0) ? upsign : -upsign;
		let scale = 0;

		const skip = math.max(derivative - index, 0)
		for (const power of $range(degree - 1, index - 1 + skip, -1)) {
			const coefficient = (sign * coefficients[coefficient_index]);
			coefficient_index += 1
			scale += (powers[power - derivative]) * coefficient
			sign = -sign;
		}

		sum += (points[index] as number) * scale;
	}

	return sum as unknown as T
}

export function bezier_length<
	T extends number | Interpolatable,
	U extends number | Interpolatable = T
>(points: MaybeReadonly<[start: T, ...control: Array<T>, end: T]>, zero: U,
	transform_point: (value: T) => U,
	abs: (value: U) => U,
	is_error_marginal: (value: U, depth: number) => boolean,
	max_depth: number
) {
	return adaptive_guass_legendre_quadrature(
		(t) => transform_point(bezier(points, t, 1)),
		zero,
		abs,
		is_error_marginal,
		0, 1,
		max_depth, 0
	)
}


type MaybeReadonly<T> = T | Readonly<T>

interface Interpolatable extends ScalarMultiplyOp, AddOp, SubtractOp {}
