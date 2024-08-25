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
