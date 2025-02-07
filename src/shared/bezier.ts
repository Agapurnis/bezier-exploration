//!native

import { adaptive_guass_legendre_quadrature } from "./integration";
import { AddOp, ScalarMultiplyOp, SubtractOp } from "./ops";

type   MutableBezierInput<T> = [start: T, ...control: Array<T>, end: T]
type ImmutableBezierInput<T> = Readonly<MutableBezierInput<T>>
export type BezierInput<T> =
	| ImmutableBezierInput<T>
	|   MutableBezierInput<T>

/**
 * @see https://en.wikipedia.org/wiki/Triangular_number
 */
function compute_nth_triangular_number(n: number) {
	return (n * (n + 1)) / 2;
}

function factorial(n: number) {
	let sum = n;
	while (n > 1) {
		n -= 1
		sum *= n;
	}
	return n
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


const powers_cache: Record</* value */ number, Record</* to */ number, Array<number>>> = {}
function generate_powers(value: number, to: number): Array<number> {
	const in_power_cache = powers_cache[value] ??= {};
	const memoized = in_power_cache[to];
	if (memoized !== undefined) return memoized;
	const powers = new Array<number>(to);
	powers[0] = value;
	for (const i of $range(2, to)) {
		powers[i - 1] = powers[i - 2] * value;
	}
	in_power_cache[to] = powers;
	return powers
}


// todo: apply sign here instead of in bezier func
const bernstein_coefficients_cache: Record</* degree */ number, Record</* derivations */ number, Array<number>>> = {}
function get_bernstein_coefficients(degree: number, derivations: number = 0): Array<number> {
	const in_degree_cache = bernstein_coefficients_cache[degree] ??= {};
	const memoized = in_degree_cache[derivations];
	if (memoized) return memoized;

	const coefficients = table.clone(get_flattened_pascal_tetrahedron_layer(degree));

	let upsign = 1;
	let coefficient_index = 0;
	for (const span of $range(0, degree)) {
		let sign = upsign
		for (const _ of $range(0, span)) {
			coefficients[coefficient_index] *= sign
			coefficient_index += 1;
			sign = -sign;
		}
		upsign = -upsign;
	}

	if (derivations !== 0) {
		let derivatives_applied = -1;
		while (derivatives_applied !== derivations - 1) {
			coefficient_index = 0;
			for (const index of $range(degree, 0, -1)) {
				const skip = math.max(derivatives_applied - index, 0)
				for (const power of $range(degree - 1, index - 1 + skip, -1)) {
					if (power > derivatives_applied) {
						coefficients[coefficient_index] *= (power - derivatives_applied);
					}
					coefficient_index += 1;
				}
			}
			derivatives_applied += 1;
		}
	}

	in_degree_cache[derivations] = coefficients;

	return coefficients
}


export function polynomic_bezier<T extends number | Interpolatable>(
	points: BezierInput<T>,
	progress: number,
	derivative = 0,
	degree = points.size() - 1,
): T {
	const powers = generate_powers(progress, degree);
	const coefficients = get_bernstein_coefficients(degree, derivative);
	for (const outside of $range(-degree - derivative, -1)) powers[outside] = 1;
	let sum = (points[degree] as number) * (powers[degree - 1 - derivative]) * coefficients[0]
	let coefficient_index = 1;

	for (const index of $range(degree - 1, 0, -1)) {
		let scale = 0
		const skip = math.max(derivative - index, 0)
		for (const power of $range(degree, index + skip, -1)) {
			const coefficient = coefficients[coefficient_index];
			coefficient_index += 1
			scale += (powers[power - derivative - 1]) * coefficient
		}

		sum += (points[index] as number) * scale;
	}

	return sum as unknown as T;
}

export function polynomic_bezier_horners<T extends number | Interpolatable>(
	points: BezierInput<T>,
	progress: number,
	derivative = 0,
	degree = points.size() - 1,
): T {
	const coefficients = get_bernstein_coefficients(degree, derivative);
	let sum = (points[degree] as number) * math.pow(progress, degree - derivative) * coefficients[0]
	let coefficient_index = 1;

	for (const index of $range(degree - 1, 0, -1)) {
		let scale = coefficients[coefficient_index]; coefficient_index += 1;
		const skip = math.max(derivative - index, 0)
		for (const _ of $range(index + skip, degree - 1)) {
			const coefficient = coefficients[coefficient_index];
			coefficient_index += 1
			scale *= progress;
			scale += coefficient;
		}
		coefficient_index += skip
		scale *= math.pow(progress, math.max(index - derivative, 0))
		sum += (points[index] as number) * scale;
	}

	return sum as unknown as T;
}

function derive_control_points<T>(points: BezierInput<T>, derivative: number,
	degree = points.size() - 1,
	subtract: (lhs: T, rhs: T) => T,
	mutable = table.create(degree) as MutableBezierInput<T>,
): BezierInput<T> {
	while (derivative > 0) {
		for (const i of $range(0, degree - 1)) {
			mutable[i] = (degree * (subtract(
				points[i + 1],
				points[i    ],
			) as number)) as T;
		}
		derivative -= 1;
		degree -= 1;
		points = mutable
	}
	return points;
}

export function de_casteljau_bezier<T>(
	points: BezierInput<T>,
	progress: number,
	derivative = 0,
	degree = points.size() - 1,
	lerp: (from: T, dest: T, progress: number) => T,
	subtract: (lhs: T, rhs: T) => T
): T {
	const mutable = table.create(degree) as MutableBezierInput<T>
	points = derive_control_points(points, derivative, degree, subtract, mutable)
	degree -= derivative;

	while (degree > 0) {
		for (const i of $range(1, degree)) {
			mutable[i - 1] = lerp(
				points[i - 1],
				points[i    ],
				progress
			);
		}
		degree -= 1;
		points = mutable
	}

	return points[0];
}

export function bezier_length<
	T extends number | Interpolatable,
	U extends number | Interpolatable = T
>(points: BezierInput<T>, zero: U,
	transform_point: (value: T) => U,
	abs: (value: U) => U,
	is_error_marginal: (value: U, depth: number) => boolean,
	max_depth: number
) {
	return adaptive_guass_legendre_quadrature(
		(t) => transform_point(polynomic_bezier(points, t, 1)),
		zero,
		abs,
		is_error_marginal,
		0, 1,
		max_depth, 0
	)
}

interface Interpolatable extends ScalarMultiplyOp, AddOp, SubtractOp {}
