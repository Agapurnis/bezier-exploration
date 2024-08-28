//!native
import { ComputationMethod } from "shared/curve-configuration";
import { ComputeCurvature, CurveComputationStep, ComputeSize, DoCurveComputationStep, GetBezierFunction } from "shared/curve-rendering"
import { inspect } from "shared/internal/inspect";
import { MaybeReadonly } from "shared/util";

const actor = script.GetActor();

const CurveWorkerOrchestratorModule = (actor)
	? script.Parent!.Parent!.Parent! as  ModuleScript
	: script.Parent!.WaitForChild("curve-worker-orchestrator") as ModuleScript;

export type BoundCompute = (
	range_start: number,
	range_end: number,
	resolution: number,
	method:  ComputationMethod,
	compute_velocity: boolean,
	compute_acceleration: boolean,
	compute_curvature: boolean,
	compute_size: boolean,
	positions: MaybeReadonly<[Vector3, ...Vector3[], Vector3]>
) => void

export type NullRepr = -1;

if (actor) {
	const signal_done = CurveWorkerOrchestratorModule.WaitForChild("JobCompletion") as BindableEvent
	const signal_initialized = CurveWorkerOrchestratorModule.WaitForChild("Registered") as BindableEvent

	actor.BindToMessageParallel("Compute", ((
		start,
		finish,
		resolution,
		method,
		compute_velocity,
		compute_acceleration,
		compute_curvature,
		compute_size,
		positions
	) => {
		const bezier = GetBezierFunction(method)
		const out = table.create(5) as CurveComputationStep
		const span = finish - start
		const data = table.create(span * 5)

		let cursor = 0;
		for (const step of $range(0, span)) {
			const progress = (step + start) / (resolution + 1)
			DoCurveComputationStep(
				bezier,
				resolution,
				positions,
				progress,
				out,
				compute_velocity,
				compute_acceleration,
				compute_curvature,
				compute_size
			);

			(out as defined[]).move(0, 4, cursor, (data as defined[]))
			cursor += 5;
		}

		signal_done!.Fire(data);
	}) as BoundCompute);

	signal_initialized.Fire()
}
