import { Signal } from "@rbxts/beacon";

export type SignalView<T> = Omit<Signal<T>,
	| "Fire"
	| "FireDeferred"
	| "Destroy"
	| "DisconnectAll"
>

export function round (value: number, digits: number) {
	const mod = 10 ** digits;
	return math.floor(value * mod) / mod
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
			return new Color3(
                (nxt.Value.R - cur.Value.R) * blend + cur.Value.R,
                (nxt.Value.G - cur.Value.G) * blend + cur.Value.G,
                (nxt.Value.B - cur.Value.B) * blend + cur.Value.B
            )
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
		if ((child as Instance).Name === (child as Instance).ClassName) {
			(child as Instance).Name = name as string;
		}
		(child as Instance).Parent = instance;
	}
	if ("Parent" in properties) instance.Parent = properties.Parent as Instance
	return instance as CreatableInstances[T] & (U extends undefined ? unknown : U)
}

export const enum CollisionGroup {
	Character = "Character",
	PointRay = "PointRay"
}
