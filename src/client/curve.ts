//!native
import { Signal } from "@rbxts/beacon";
import { bezier_length, BezierInput } from "shared/bezier";
import { make, SignalView, timed } from "shared/util";
import { Point } from "./point";
import { BoundCompute } from "./curve-worker.client";
import { selected_point } from "./state/selected_point";
import { use_sound_effects } from "./state/sfx";
import { BezierConfiguration, BezierConfigurationBuilder, ComputationMethod, is_measured_source, VisualColorDataSource } from "../shared/curve-configuration";
import { CurveComputationStep, DoPathStepAndReturnMaxMeasured, GetBezierFunction, RunDeferredPathModifications, MergeTimings, RenderMillisecondTimings, DefaultAccumulablePathStepTimings, DoCurveComputationStep } from "../shared/curve-rendering";
import { Janitor } from "@rbxts/janitor";
import WorkerOrchestrator from "./curve-worker-orchestrator"
import { inspect } from "shared/internal/inspect";

const RunService = game.GetService("RunService")

export class BezierCurveDisplay {
	private static readonly PathPartDefaultTemplate = new Instance("Part");
	static {
		this.PathPartDefaultTemplate.Transparency = 0
		this.PathPartDefaultTemplate.Material = Enum.Material.SmoothPlastic;
		this.PathPartDefaultTemplate.Size = Vector3.one;
		this.PathPartDefaultTemplate.Anchored = true;
		this.PathPartDefaultTemplate.CanCollide = false;
		this.PathPartDefaultTemplate.CanQuery = false;
		this.PathPartDefaultTemplate.CanTouch = false;
		this.PathPartDefaultTemplate.CastShadow = false;
		this.PathPartDefaultTemplate.Massless = true;
		this.PathPartDefaultTemplate.Locked = true;
	}

	private static readonly InstanceTemplate = make("Model", {
		Name: "Unnamed Bezier Curve",
		Children: {
			Points: new Instance("Folder"),
			Path: new Instance("Folder"),
			Tracers: new Instance("Folder"),
			Highlight: make("Highlight", {
				OutlineColor: new Color3(1, 1, 1),
				FillTransparency: 1,
				Enabled: false,
			})
		}
	})

	private static readonly TickAudio = new Instance("Sound");
	static {
		this.TickAudio.Name = "Tick";
		this.TickAudio.SoundId = "rbxassetid://9114065998"
	}

	private static readonly TracerTemplate = new Instance("Part")
	static {
		this.TracerTemplate.Name = "Tracer"
		this.TracerTemplate.Material = Enum.Material.SmoothPlastic;
		this.TracerTemplate.Anchored = true;
		this.TracerTemplate.Size = Vector3.one.mul(1.5)
	}

	private static readonly InstanceMapping = new WeakMap<BezierCurveDisplay.Instance, BezierCurveDisplay>();

	public static GetFromInstance(instance: BezierCurveDisplay.Instance): BezierCurveDisplay | undefined {
		return this.InstanceMapping.get(instance)
	}

	public readonly PathInstanceTemplate = BezierCurveDisplay.PathPartDefaultTemplate.Clone()
	public readonly Instance: BezierCurveDisplay.Instance;

	private Points: Point[] = [];
	private PathInstances: Part[] = [];

	public GetPoints(): ReadonlyArray<Point> { return this.Points }

	private readonly OnPointsChangeController = new Signal<[ReadonlyArray<Point>]>();
	private readonly OnDestroyBindable: BindableEvent<() => void> = new Instance("BindableEvent");
	private readonly OnUpdateBindable: BindableEvent<() => void> = new Instance("BindableEvent");
	private readonly OnRenderBindable: BindableEvent<(timings: RenderMillisecondTimings) => void> = new Instance("BindableEvent");
	public readonly OnPointsChange = this.OnPointsChangeController as SignalView<[ReadonlyArray<Point>]>
	public readonly OnDestroy = this.OnDestroyBindable.Event
	public readonly OnUpdate = this.OnUpdateBindable.Event;
	public readonly OnRender = this.OnRenderBindable.Event;

	private Threads!: number;
	private Method!: ComputationMethod
	private ColorSource!: VisualColorDataSource
	private Size!: boolean
	private DoComputeVelocity!: boolean
	private DoComputeCurvature!: boolean
	private DoComputeAcceleration!: boolean

	public GetThreads() { return this.Threads }
	public GetMethod() { return this.Method }
	public GetSize() { return this.Size }
	public GetColorSource() { return this.ColorSource }

	constructor(
		points: Vector3[],
		private ConfigurationBuilder = new BezierConfigurationBuilder()
	) {
		this.Instance = BezierCurveDisplay.InstanceTemplate.Clone();
		this.Instance.Parent = game.Workspace;
		BezierCurveDisplay.InstanceMapping.set(this.Instance, this);
		this.ApplyConfiguration(this.ConfigurationBuilder.Resolve())
		for (const point of points) {
			this.AddPoint(point)
		}

		this.OnUpdate.Connect(() => {
			this.Render()
			this.PlayTickSFX();
		})
		this.Render()
	}

	public ApplyConfiguration(configuration: BezierConfiguration) {
		this.SetThreads(configuration.threads)
		this.SetMethod(configuration.method)
		this.SetColorSource(configuration.color_source)
		this.Size = configuration.size;
		this.DoComputeVelocity = configuration.velocity;
		this.DoComputeCurvature = configuration.curvature;
		this.DoComputeAcceleration = configuration.acceleration;
		this.SetResolution(configuration.resolution);
	}

	public Modify(modify: (builder: BezierConfigurationBuilder) => BezierConfigurationBuilder) {
		this.ApplyConfiguration(modify(this.ConfigurationBuilder).Validate().Resolve())
	}

	public Bezier!: (points: BezierInput<Vector3>, progress: number, derivations?: number) => Vector3

	public AddPoint(position: Vector3, at = this.Points.size()): Point {
		if (at < 0) at = this.Points.size() + 1 + at;

		const point = new Point(position, Point.Appearance.Control, this.Instance.Points);
		this.Points.insert(at, point);
		point.OnMovement.Connect(() => this.OnUpdateBindable.Fire());

		if (at === 0) {
			if (this.Points.size() > 1) this.Points[1].UpdateStyle(Point.Appearance.Control);
			point.UpdateStyle(Point.Appearance.Terminal);
		} else if (at === this.Points.size() - 1 && this.Points.size() > 2) {
			this.Points[this.Points.size() - 2].UpdateStyle(Point.Appearance.Control);
			point.UpdateStyle(Point.Appearance.Terminal);
		}

		const before = this.Points[at - 1]
		const after = this.Points[at + 1]
		if (before) before.Instance.Beam.Attachment1 = point.Instance.Attachment;
		if (after) point.Instance.Beam.Attachment1 = after.Instance.Attachment;

		this.OnUpdateBindable.Fire();
		this.OnPointsChangeController.Fire(this.Points);
		return point
	}

	public RemovePoint(at: number): (
		| { ok: true,  err: undefined }
		| { ok: false, err: string }
	) {
		if (this.Points.size() <= 3) return { ok: false, err: "A curve must contain at least three points!" }
		if (!(this.Points[at])) return { ok: false, err: "That point already doesn't exist..?" }
		if (at < 0) at = this.Points.size() + 1 + at;

		const before = this.Points[at - 1]
		const after  = this.Points[at + 1]
		if (before && after) {
			before.Instance.Beam.Attachment1 = after.Instance.Attachment;
		} else if (before && !after) {
			before.UpdateStyle(Point.Appearance.Terminal);
			this.Points[at - 2].Instance.Beam.Attachment1 = before.Instance.Attachment;
		} else if (after) {
			after.UpdateStyle(Point.Appearance.Terminal);
			after.Instance.Beam.Attachment1 = this.Points[at + 1].Instance.Attachment
		}

		this.Points.remove(at)!.Destroy();

		this.OnUpdateBindable.Fire();
		this.OnPointsChangeController.Fire(this.Points);
		return { ok: true, err: undefined }
	}

	public SwapPoints(a: number, b: number) {
		const size = this.Points.size();
		if (a < 0) a = size + a; a %= size;
		if (b < 0) b = size + b; b %= size;
		const temp = this.Points[a];
		this.Points[a] = this.Points[b];
		this.Points[b] = temp;

		this.Points[a].UpdateStyle((a === 0 || a === size - 1) ? Point.Appearance.Terminal : Point.Appearance.Control)
		this.Points[b].UpdateStyle((b === 0 || b === size - 1) ? Point.Appearance.Terminal : Point.Appearance.Control)

		this.OnUpdateBindable.Fire();
		this.OnPointsChangeController.Fire(this.Points);
	}

	private Resolution: number = 0;
	public GetResolution() { return this.Resolution }
	private SetResolution(resolution: number) {
		const old = this.Resolution;
		this.Resolution = resolution;
		const diff = resolution - old;
		if (diff < 0) {
			for (const removed of $range(old - 1, resolution, -1)) {
				this.PathInstances[removed].Destroy();
				this.PathInstances.unorderedRemove(removed)
			}
		} else {
			for (const created of $range(old, resolution - 1)) {
				const instance = this.PathInstanceTemplate.Clone();
				this.PathInstances[created] = instance;
				instance.CFrame = new CFrame(new Vector3(9e9, 9e9, 9e9));
				instance.Parent = this.Instance.Path;
			}
		}
		if (is_measured_source(this.ColorSource)) {
			this.MeasuredScalarsBuffer = new Array<number>(resolution)
		}
		this.DestinationsBuffer = new Array<CFrame>(resolution);
	}

	private SetColorSource(color_source: VisualColorDataSource) {
		if (color_source === VisualColorDataSource.None) {
			const gray = new Color3(0.5, 0.5, 0.5)
			this.ApplyPhysicalModification((part) => part.Color = gray)
		}
		this.ColorSource = color_source;
	}

	private SetMethod (method: ComputationMethod) {
		this.Method = method;
		this.Bezier = GetBezierFunction(method)
	}

	private SetThreads (count: number) {
		if (count < 0) error("Invalid thread count!");
		this.Threads = count;
		this.EnsureCorrectWorkerCount();
	}

	private EnsureCorrectWorkerCount(count = this.Threads) {
		WorkerOrchestrator.AdjustQuantity(count).await();
	}

	public GetLength(): number {
		return bezier_length(
			this.GetPointPositions(),
			0,
			(v) => v.Abs().Magnitude,
			(n) => math.abs(n),
			(m, d) => m < 0.01 / 2**d,
			5
		);
	}

	public GetPointPositions(): readonly [Vector3, ...Vector3[], Vector3] {
		return this.Points.map((point) => point.Instance.Position) as [Vector3, ...Vector3[], Vector3]
	}

	public static readonly OrientationBasis = CFrame.fromMatrix(
		Vector3.zero,
		new Vector3( 0,  0,  1),
		new Vector3(-1,  0,  0),
		new Vector3( 0, -1, -0),
	)

	private static TotalRenderCount = 0;
	public static GetTotalRenderCount() { return this.TotalRenderCount }

	private RenderCount = 0;
	public GetRenderCount() { return this.RenderCount }

	public ApplyPhysicalModification(apply_modification: (path_part: Part) => void) {
		apply_modification(this.PathInstanceTemplate);
		for (const part of this.PathInstances) {
			apply_modification(part)
		}
	}

	private DestinationsBuffer!: CFrame[]
	private MeasuredScalarsBuffer: number[] | undefined

	/**
	 * @returns the number of milliseconds it took, or nil if there weren't enough points to preform a render
	 */
	public RenderParallel(): Promise<RenderMillisecondTimings | undefined> {
		if (!(this.Points.size() >= 3)) return Promise.resolve(undefined);
		let jobs_completed = 0;

		this.EnsureCorrectWorkerCount();
		const actors = WorkerOrchestrator.GetActors()
		const positions = table.freeze(this.GetPointPositions());
		const outputs = new Array<defined[]>(this.Threads)
		const start_time = os.clock();
		const computed = table.create(5) as CurveComputationStep

		return new Promise((resolve) => {
			const connection = WorkerOrchestrator.OnJobComplete.Event.Connect((chunk) => {
				outputs[jobs_completed] = chunk;
				jobs_completed += 1;
				print(jobs_completed, '/', this.Threads)
				if (jobs_completed === this.Threads) {
					const accumulated_step_timings = DefaultAccumulablePathStepTimings();
					const computation_took = os.clock() - start_time;
					let max_measured: number | undefined = 0;
					let index = 0;
					for (const division of outputs) {
						const allotment = division.size() / 5;
						let cursor = 0;
						for (const _ of $range(0, allotment - 1)) {
							division.move(cursor, cursor + 4, 0, computed)
							max_measured = DoPathStepAndReturnMaxMeasured(
								this.PathInstances[index],
								index,
								this.ColorSource,
								this.DestinationsBuffer,
								max_measured,
								this.MeasuredScalarsBuffer,
								accumulated_step_timings,
								computed,
							)

							cursor += 5;
							index += 1;
						}
					}

					const deferred_timings = RunDeferredPathModifications(
						this.PathInstances,
						this.Resolution,
						this.DestinationsBuffer,
						this.ColorSource,
						this.MeasuredScalarsBuffer,
						max_measured
					);

					const timings = MergeTimings(accumulated_step_timings, deferred_timings, computation_took, start_time)
					connection.Disconnect();
					this.OnRenderBindable.Fire(timings);
					BezierCurveDisplay.TotalRenderCount += 1;
					this.RenderCount += 1;
					resolve(timings)
				}
			})

			const inc = math.floor(this.Resolution / this.Threads)
			const rem = this.Resolution % this.Threads;

			let lo = 1;
			let hi = inc;
			for (const thread of $range(0, this.Threads - 1)) {
				if (thread < rem) {
					hi += 1;
				}

				(actors[thread].SendMessage as (this: Actor, topic: string, ...parameters: Parameters<BoundCompute>) => void)("Compute",
					lo,
					hi,
					this.Resolution,
					this.Method,
					this.DoComputeVelocity,
					this.DoComputeAcceleration,
					this.DoComputeCurvature,
					this.Size,
					positions,
				)

				lo = hi + 1
				hi = lo + inc - 1;
			}
		})
	}


	public RenderSingleThreaded(): RenderMillisecondTimings | undefined {
		if (!(this.Points.size() >= 3)) return undefined;
		const bezier = this.Bezier;
		const positions = this.GetPointPositions();
		const start_time = os.clock()
		const computed = table.create(5) as CurveComputationStep
		const accumulated_step_timings = DefaultAccumulablePathStepTimings();
		let computation_took = 0;

		let max_measured: number | undefined = 0;
		for (const step of $range(0, this.Resolution - 1)) {
			computation_took += timed(() => DoCurveComputationStep(
				bezier,
				this.Resolution,
				positions,
				step / (this.Resolution - 1),
				computed,
				this.DoComputeVelocity,
				this.DoComputeAcceleration,
				this.DoComputeCurvature,
				this.Size
			))[1];


			max_measured = DoPathStepAndReturnMaxMeasured(
				this.PathInstances[step],
				step,
				this.ColorSource,
				this.DestinationsBuffer,
				max_measured,
				this.MeasuredScalarsBuffer,
				accumulated_step_timings,
				computed,
			)
		}

		const deferred_timings = RunDeferredPathModifications(
			this.PathInstances,
			this.Resolution,
			this.DestinationsBuffer,
			this.ColorSource,
			this.MeasuredScalarsBuffer,
			max_measured
		)

		const timing = MergeTimings(accumulated_step_timings, deferred_timings, computation_took, start_time)
		this.OnRenderBindable.Fire(timing);
		BezierCurveDisplay.TotalRenderCount += 1;
		this.RenderCount += 1;
		return timing
	}

	public async Render(): Promise<RenderMillisecondTimings | undefined>  {
		if (this.Threads > 0) {
			return this.RenderParallel()
		} else {
			return this.RenderSingleThreaded()
		}
	}

	public Repool() {
		const resolution = this.Resolution;
		for (const path of this.PathInstances) path.Destroy();
		table.clear(this.PathInstances);
		this.Resolution = 0;
		this.SetResolution(resolution)
	}

	private LastSFXPlayed = 0;
	private LastActivePosition = Vector3.zero;
	private PlayTickSFX() {
		if (use_sound_effects.Get()) {
			const part = selected_point.Get()?.Instance;
			if (!part) return;
			const now = tick();
			const since = now - this.LastSFXPlayed;
			const travel = this.LastActivePosition.sub(part.Position).Magnitude / 4;
			if (travel < 0.1 && since < .2) return;
			this.LastActivePosition = part.Position;
			if (since < math.max(0.05, .1 - travel)) return;
			this.LastSFXPlayed = now;
			const sound = BezierCurveDisplay.TickAudio.Clone();
			sound.PlaybackSpeed = math.clamp(0.9 + travel * 2, 0.7, 1.3) + (math.random() / (4 + travel * 3) - 0.125)
			sound.TimePosition = 0.2;
			sound.Ended.Once(() => sound.Destroy());
			sound.Parent = part;
			sound.Play()
		}
	}

	public Trace(seconds: number): Part {
		const tracer = BezierCurveDisplay.TracerTemplate.Clone();
		tracer.Parent = this.Instance.Tracers;
		let positions = this.GetPointPositions();
		let elapsed = 0;

		const janitor = new Janitor();
		janitor.Add(tracer.Destroying.Connect(() => janitor.Destroy()))
		janitor.Add(this.OnUpdate.Connect(() => positions = this.GetPointPositions()))
		janitor.Add(RunService.Heartbeat.Connect((delta) => {
			const progress = (elapsed / seconds)
			if (progress > 1) return tracer.Destroy();
			const position = this.Bezier(positions, progress);
			const velocity = this.Bezier(positions, progress, 1)
			tracer.CFrame = CFrame.lookAlong(position, velocity).mul(BezierCurveDisplay.OrientationBasis);
			elapsed += delta;
		}));

		return tracer;
	}
}

export namespace BezierCurveDisplay {
	export type Instance = typeof BezierCurveDisplay["InstanceTemplate"]
}
