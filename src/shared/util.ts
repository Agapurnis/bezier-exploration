import { Signal } from "@rbxts/beacon";

declare const NullBrand: unique symbol
export type Null = "null" & { _: typeof NullBrand };
export const Null = "null" as Null;
export function is_null    <T>(value: T): value is Extract<T, Null> { return value === "null" }
export function is_not_null<T>(value: T): value is Exclude<T, Null> { return value !== "null" }
export function not_null<T>(value: T): Exclude<T, Null> { if (is_not_null(value)) return value; error("Assertion failure!");   }
export function unchecked_not_null<T>(value: T): Exclude<T, Null> { return value as Exclude<T, Null> }

export type MaybeReadonly<T> = T | Readonly<T>

export type SignalView<T> = Omit<Signal<T>,
	| "Fire"
	| "FireDeferred"
	| "Destroy"
	| "DisconnectAll"
>

export function round(value: number, digits: number) {
	const mod = 10 ** digits;
	return math.floor(value * mod) / mod
}

export function is_nan(value: number): boolean {
	return value !== value
}

export function in_inclusive_range(test: number, min: number, max: number) {
	return min <= test && test <= max
}

export function is_integer(value: number) {
	return value % 1 === 0
}

/**
 * @see https://create.roblox.com/docs/reference/engine/datatypes/ColorSequence
 */
export function evaluate_color_sequence(sequence: ColorSequence, time: number): Color3 {
	if (time === 0) return sequence.Keypoints[0].Value
	if (time === 1) return sequence.Keypoints[sequence.Keypoints.size() - 1].Value
	for (const i of $range(0, sequence.Keypoints.size() - 2)) {
		const cur = sequence.Keypoints[i];
		const nxt = sequence.Keypoints[i + 1];
		if (time >= cur.Time && time <= nxt.Time) {
			const blend = (time - cur.Time) / (nxt.Time - cur.Time);
			return nxt.Value.Lerp(cur.Value, blend)
			// return new Color3(
            //     (nxt.Value.R - cur.Value.R) * blend + cur.Value.R,
            //     (nxt.Value.G - cur.Value.G) * blend + cur.Value.G,
            //     (nxt.Value.B - cur.Value.B) * blend + cur.Value.B
            // )
		}
	}
	error("Bad! Got " + time);
}

export function format_vector3(data: Vector3, precision = 2) {
	return `(${round(data.X, precision)}, ${round(data.Y, precision)}, ${round(data.Z, precision)})`
}

export function make<
	const T extends keyof CreatableInstances,
	const U extends Record<string, Instance> | undefined
>(variant: T, properties:
	& Partial<WritableInstanceProperties<CreatableInstances[T]>>
	& { Children?: U & { [K in Extract<keyof U, keyof CreatableInstances[T]>]: K extends keyof CreatableInstances[T] ? { ERR: "This name overlaps with an instance property or method!" } : unknown }}
): CreatableInstances[T] & (U extends undefined ? unknown : U) {
	const instance = new Instance(variant);
	// eslint-disable-next-line roblox-ts/no-array-pairs
	for (const [property, value] of pairs(properties)) {
		if (property === "Children" || property === "Parent") continue;
		instance[property as unknown as never] = value as never;
	}
	// eslint-disable-next-line roblox-ts/no-array-pairs
	if (properties.Children !== undefined) for (const [name, child] of pairs(properties.Children)) {
		if (typeIs(child, "Instance")) {
			if (child.Name === child.ClassName) {
				child.Name = name as string;
			}
			child.Parent = instance;
		}
	}
	if ("Parent" in properties) instance.Parent = properties.Parent as Instance
	return instance as CreatableInstances[T] & (U extends undefined ? unknown : U)
}

export const enum CollisionGroup {
	Character = "Character",
	PointRay = "PointRay"
}

export function random_color(): Color3 {
	return new Color3(
		math.random(),
		math.random(),
		math.random()
	)
}

export function assert_narrowed_unreachable(never?: never, reason?: string): never {
   error("Unreachable!" + ((reason !== undefined) ? ": " + reason : ""))
}
export function assert_unreachable(reason?: string): never {
	error("Unreachable!" + ((reason !== undefined) ? ": " + reason : ""))
}

/**
 * @returns the output and the time it took in seconds
 */
export function timed<T, U extends unknown[]>(callback: (...args: U) => T, ...args: U): LuaTuple<[output: T, seconds: number]> {
	const t = os.clock();
	const v = callback(...args);
	return $tuple(v, os.clock() - t)
}
