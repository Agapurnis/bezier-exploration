import { BezierInput, de_casteljau_bezier, polynomic_bezier, polynomic_bezier_horners } from "shared/bezier";
import { ComputationMethod, is_measured_source, VisualColorDataSource } from "./curve-configuration";
import { CollisionGroup, evaluate_color_sequence, is_not_null, not_null, Null, random_color, timed, unchecked_not_null } from "./util";
import { inspect } from "./internal/inspect";

export function ComputeCFrame(position: Vector3, velocity: Vector3 | Null, basis: CFrame) {
	return is_not_null(velocity)
		? CFrame.lookAlong(position, (velocity)).mul(basis)
		: new CFrame(position)
}

export function ComputeCurvature(velocity: Vector3, acceleration: Vector3) {
	const speed = velocity.Magnitude ** 3;
	if (speed === 0) return 0;
	return math.clamp(velocity.Cross(acceleration).Magnitude / speed, 0, 1);
}

export function ComputeSize(velocity: Vector3, resolution: number, curvature: number | undefined): Vector3 {
	return (curvature !== undefined)
		? new Vector3((velocity.Magnitude / ((resolution - 2) + (1 - curvature! * 1.5))) + math.min(curvature! / 3, 0.1), 1, 1)
		: new Vector3(velocity.Magnitude / resolution, 1, 1)
}

export function GetBezierFunction(method: ComputationMethod): (points: BezierInput<Vector3>, progress: number, derivations?: number) => Vector3 {
	switch (method) {
		case ComputationMethod.DeCasteljau: return (p, t, d) => de_casteljau_bezier(p, t, d, p.size() - 1, (a, b, p) => a.Lerp(b, p), (a, b) => a.sub(b))
		case ComputationMethod.Polynomic: return polynomic_bezier;
		case ComputationMethod.PolynomicHorners: return polynomic_bezier_horners;
	}
}

export type CurveComputationStep = [
	position:     Vector3,
	velocity:     Vector3 | Null,
	acceleration: Vector3 | Null,
	curvature:    number  | Null,
	size:         Vector3 | Null
]
export function DoCurveComputationStep(
	bezier: ReturnType<typeof GetBezierFunction>,
	resolution: number,
	positions: BezierInput<Vector3>,
	progress: number,
	output: CurveComputationStep,
	compute_velocity: boolean,
	compute_acceleration: boolean,
	compute_curvature: boolean,
	compute_size: boolean
) {
	output[0] = bezier(positions, progress);
	let velocity: Vector3 | undefined;
	if (compute_velocity) {
		velocity = bezier(positions, progress, 1);
		output[1] = velocity;
	} else output[1] = Null;
	let acceleration: Vector3 | undefined
	if (compute_acceleration) {
		acceleration = bezier(positions, progress, 2);
		output[2] = acceleration;
	} else output[2] = Null;
	let curvature: number | undefined;
	if (compute_curvature) {
		curvature = ComputeCurvature(velocity!, acceleration!);
		output[3] = curvature;
	} else output[3] = Null;
	if (compute_size) {
		output[4] = ComputeSize(velocity!, resolution, curvature!)
	} else output[4] = Null;
}

export const OrientationBasis = CFrame.fromMatrix(
	Vector3.zero,
	new Vector3( 0,  0,  1),
	new Vector3(-1,  0,  0),
	new Vector3( 0, -1, -0),
)

export interface PathAccumulatedStepTimings {
	SizeAssignment: number,
	ColorEvaluation: number,
	ColorAssignment: number
}
export function DefaultAccumulablePathStepTimings(): PathAccumulatedStepTimings {
	return {
		SizeAssignment: 0,
		ColorEvaluation: 0,
		ColorAssignment: 0,
	}
}
export function DoPathStepAndReturnMaxMeasured(
	part: Part,
	part_index: number,
	color_source: VisualColorDataSource,
	destinations: Array<CFrame>,
	measured_max: number | undefined,
	measured: Array<number> | undefined,
	timings: PathAccumulatedStepTimings,
	computed: CurveComputationStep,
): number | undefined {
	const [position, velocity, acceleration, curvature, size] = computed;
	destinations[part_index] = ComputeCFrame(position as Vector3, velocity, OrientationBasis)

	if (is_not_null(size)) {
		const [_, time] = timed(() => part.Size = size)
		timings.SizeAssignment += time;
	}
	let color: Color3 | undefined;
	let color_eval_time: number | undefined;
	switch (color_source) {
		case VisualColorDataSource.None: break;
		case VisualColorDataSource.Curvature: {
			[color, color_eval_time] = timed(() => evaluate_color_sequence(intensity_gradient, unchecked_not_null(curvature)));
			break
		}
		case VisualColorDataSource.Direction: {
			[color, color_eval_time] = timed(() => {
				const nv = unchecked_not_null(velocity).Abs().Unit;
				return new Color3(nv.X, nv.Y, nv.Z)
			});
			break
		}
		case VisualColorDataSource.Velocity: {
			const magnitude = unchecked_not_null(velocity).Magnitude;
			measured![part_index] = magnitude;
			return math.max(measured_max!, magnitude)
		}
		case VisualColorDataSource.Acceleration: {
			const magnitude = unchecked_not_null(acceleration).Magnitude;
			measured![part_index] = magnitude;
			return math.max(measured_max!, magnitude)
		}
		case VisualColorDataSource.Random: {
			[color, color_eval_time] = timed(random_color);
			break
		}
	}
	if (color) {
		timings.ColorEvaluation += color_eval_time!;
		timings.ColorAssignment += timed(() => part.Color = color!)[1]

	}
}

const geoservice = game.GetService("GeometryService")

export interface DeferredPathModificationsTimings {
	ColorEvaluation?: number,
	ColorAssignment?: number,
	BulkMove: number
}
export function RunDeferredPathModifications(
	parts: Part[],
	part_count: number,
	destinations: CFrame[],
	color_source: VisualColorDataSource,
	measured: Array<number> | undefined,
	measured_max: number | undefined,
): DeferredPathModificationsTimings {
	const timings = {} as DeferredPathModificationsTimings;
	if (is_measured_source(color_source)) {
		let t_eval = 0;
		let t_assn = 0;
		for (const i of $range(1,  part_count)) {
			const t1 = os.clock();
			const color = evaluate_color_sequence(intensity_gradient, measured![i - 1] / measured_max!);
			const t2 = os.clock();
			t_eval += t2 - t1;
			parts[i - 1].Color = color;
			t_assn += os.clock() - t2;
		}
		timings.ColorEvaluation = t_eval;
		timings.ColorEvaluation = t_assn;
	}

	const t = os.clock();
	game.Workspace.BulkMoveTo(parts, destinations, Enum.BulkMoveMode.FireCFrameChanged)
	timings.BulkMove = os.clock() - t;
	return timings;
}

export interface RenderMillisecondTimings {
	Total: number,
	BulkMove: number,
	BezierComputation: number,
	Color: {
		Evaluation: number,
		Assignment: number,
	}
}
export function MergeTimings(
	step: PathAccumulatedStepTimings,
	deferred: DeferredPathModificationsTimings,
	computation_took: number,
	start_time: number
): RenderMillisecondTimings {
	return {
		Total: (os.clock() - start_time) * 1000,
		BulkMove: deferred.BulkMove * 1000,
		BezierComputation: computation_took * 1000,
		Color: {
			Evaluation: (deferred.ColorEvaluation ?? step.ColorEvaluation) * 1000,
			Assignment: (deferred.ColorAssignment ?? step.ColorAssignment) * 1000,
		}
	}
}

const intensity_gradient = new ColorSequence([
	new ColorSequenceKeypoint(0, new Color3(0, 1, 0)),
	new ColorSequenceKeypoint(0.3, new Color3(1, 1, 0)),
	new ColorSequenceKeypoint(1, new Color3(1, 0, 0))
])
