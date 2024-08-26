//!native
import { bezier } from "shared/bezier";

const actor = script.GetActor();

const signal_done = actor ? game.Workspace
	.WaitForChild("Worker Job Finish Signal") as BindableEvent
	: undefined;

type MaybeReadonly<T> = T | Readonly<T>
export type BoundCompute = (
	range_start: number,
	range_end: number,
	resolution: number,
	compute_acceleration: boolean,
	compute_curvature: boolean,
	compute_size: boolean,
	positions: MaybeReadonly<[Vector3, ...Vector3[], Vector3]>
) => void

if (actor === undefined) {
	const threads = 256;

	let registered = 0;
	const loaded = new Instance("BoolValue");
	loaded.Name = "Loaded";
	loaded.Parent = script;
	const register = new Instance("BindableEvent");
	register.Name = "Registered";
	register.Parent = script;
	register.Event.Connect(() => {
		registered += 1;
		if (registered === threads) {
			loaded.Value = true;
		}
	})
	const actors = new Instance("Folder");
	actors.Name = "Actors";
	for (const id of $range(1, threads)) {
		const actor = new Instance("Actor");
		actor.Name = "#" +  id;
		actor.SetAttribute("ID", id);
		const job = script.Clone();
		job.Name = "Worker";
		job.Parent = actor;
		actor.Parent = actors;
	}
	actors.Parent = script;
} else {
	actor.BindToMessageParallel("Compute", ((start, finish, resolution, compute_acceleration, compute_curvature, compute_size, positions) => {
		const span = finish - start
		const data = table.create(span * 5)

		const sizes = new Array<Vector3>(span);

		compute_curvature ||= compute_size;
		compute_acceleration ||= compute_curvature;

		let cursor = 0;
		for (const step of $range(0, span)) {
			const fraction = (step + start) / (resolution + 1)
			const position = bezier(positions, fraction, 0);
			const velocity = bezier(positions, fraction, 1);
			data[cursor] = position; cursor += 1;
			data[cursor] = velocity; cursor += 1;
			let acceleration: Vector3 | undefined;
			if (compute_acceleration) {
				acceleration = bezier(positions, fraction, 2);
				data[cursor] = acceleration;
			} else {
				data[cursor] = 0;
			}
			cursor += 1
			let curvature: number | undefined;
			if (compute_curvature) {
				const speed = velocity.Magnitude ** 3;
				curvature = (speed !== 0) ? math.clamp(velocity.Cross(acceleration!).Magnitude / speed, 0, 1) : 0
				data[cursor] = curvature;
			} else {
				data[cursor] = 0;
			}
			cursor += 1
			if (compute_size) {
				const size = new Vector3((velocity.Magnitude / (resolution + (1 - curvature! * 1.5))) + math.min(curvature! / 3, 0.1), 1, 1)
				data[cursor] = size;
				sizes[step] = size;
			} else {
				data[cursor] = 0;
			}
			cursor += 1
		}

		signal_done!.Fire(data);
	}) as BoundCompute);

	(script.Parent!.Parent!.Parent!.WaitForChild("Registered") as BindableEvent).Fire();
}
