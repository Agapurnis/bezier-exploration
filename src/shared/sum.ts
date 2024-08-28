import { AddOp, SubtractOp } from "./ops"

interface Summable extends AddOp, SubtractOp {}
export function kahan<T extends number | Summable>(input: Array<T>, zero: T): T {
    let sum = zero as number;
    let c = zero as number;
    // The array input has elements indexed input[1] to input[input.length].
    for (const i of $range(1, input.size())) {
        const y = (input[i - 1] as number) - c
        const t = sum + y
        c = (t - sum) - y
        sum = t
	}
    return sum as T
}
