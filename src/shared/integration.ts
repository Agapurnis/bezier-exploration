//!native

import { AddOp, ScalarMultiplyOp, SubtractOp } from "./ops";

function legendre_polynomial(n: number, x: number) {
	switch (n) {
		case 0: return 1;
		case 1: return x;
		default: {
			let a = 1
			let b = x
			let P: number | undefined = undefined
			for (const k of $range(2, n)) {
				P = ((2 * k - 1) * x * b - (k - 1) * a) / k
				a = b
				b = P
			}
			if (P === undefined) error("uh oh")
			return P
		}
	}
}

function legendre_polynomial_derivative(n: number, x: number) {
	return n * (x * legendre_polynomial(n, x) - legendre_polynomial(n - 1, x)) / (x ** 2 - 1)
}

const gauss_legendre_nodes_and_weights_cache: Record<number, [nodes: number[], weights: number[]]> = {}
function get_gauss_legendre_nodes_and_weights(n: number): LuaTuple<[nodes: ReadonlyArray<number>, weights: ReadonlyArray<number>]> {
	const memoized = gauss_legendre_nodes_and_weights_cache[n];
	if (memoized) return $tuple(...memoized);

    const nodes = new Array<number>(n);
	const weights = new Array<number>(n);

    for (const i of $range(1, n)) {
        let x = math.cos(math.pi * (i - 0.25) / (n + 0.5))
		let dP: number

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const P = legendre_polynomial(n, x)
			dP = legendre_polynomial_derivative(n, x)
            const xn = x - P / dP
            if (math.abs(xn - x) < 1e-15) break;
            x = xn
		}

        nodes[i - 1] = x
        weights[i - 1] = 2 / ((1 - x ** 2) * (dP ** 2))
	}

	gauss_legendre_nodes_and_weights_cache[n] = [nodes, weights];

    return $tuple(nodes, weights)
}


interface Integrable extends ScalarMultiplyOp, AddOp, SubtractOp {}


export function gauss_legendre_quadrature<T extends number | Integrable, U extends unknown[]>(
	func: (time: number, ...args: U) => T,
	zero: T,
	a: number,
	b: number,
	samples: number,
	...args: U
): T {
    const [points, weights] = get_gauss_legendre_nodes_and_weights(samples);
    let integral = (zero as number)
	const x = (b - a) * 0.5;
	const y = (b + a) * 0.5
    for (const i of $range(0, samples - 1)) {
        integral += (func((x * points[i] + y), ...args) as number) * weights[i]
	}
    return (integral * (b - a) * 0.5) as T
}

export function adaptive_guass_legendre_quadrature<T extends number | Integrable, U extends unknown[]>(func: (time: number, ...args: U) => T, zero: T, abs: (value: T) => T, is_error_marginal: (value: T, depth: number) => boolean, a: number, b: number, max_depth: number, depth: number, ...args: U): T {
    const m = (a + b) * 0.5;
    const full = gauss_legendre_quadrature(func, zero, a, b, 10, ...args)
	const l = gauss_legendre_quadrature(func, zero, a, m, 10, ...args)
	const r = gauss_legendre_quadrature(func, zero, m, b, 10, ...args)
    const merge = (l as number) + (r as number);
	const divergence = abs((merge - (full as number)) as T);
	if (depth === max_depth || is_error_marginal(divergence, depth)) return merge as T;
	/* eslint-disable no-mixed-spaces-and-tabs */
    return ((adaptive_guass_legendre_quadrature(func, zero, abs, is_error_marginal, a, m, max_depth, depth + 1, ...args) as number) +
	        (adaptive_guass_legendre_quadrature(func, zero, abs, is_error_marginal, m, b, max_depth, depth + 1, ...args) as number)) as T
	/* eslint-enable no-mixed-spaces-and-tabs */
}


