//!native
import { Signal } from "@rbxts/beacon";
import { bezier, bezier_length } from "shared/bezier";
import { evaluate_color_sequence, round, SignalView } from "shared/util";
import { Point } from "./point";
import { BoundCompute } from "./curve-worker.client";
import { SubscribableRememberingStore, SubscribableStore } from "./util";


export const active_point = new SubscribableRememberingStore<Point | undefined>(undefined)

export const use_sound_effects = new SubscribableStore(true);

const SharedTableRegistry = game.GetService("SharedTableRegistry");


// const destinations_shared = new SharedTable() as SharedTable & Array<SharedTable & CFrame[]>
// SharedTableRegistry.SetSharedTable("Destinations", destinations_shared);


const output = new SharedTable(table.create(1000)) as SharedTable & Array<SharedTable & unknown[]>
SharedTableRegistry.SetSharedTable("Output", output);

const actors = script.Parent!
	.WaitForChild("curve-worker")!
	.WaitForChild("Actors")!
	.GetChildren() as Actor[];

// const actors = game.Workspace.WaitForChild("Actors").GetChildren() as Actor[]

const worker_job_done_signal = new Instance("BindableEvent");
worker_job_done_signal.Parent = game.Workspace;
worker_job_done_signal.Name = "Worker Job Finish Signal"

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

	private static readonly InstanceTemplate = new Instance("Model") as BezierCurveDisplay.Instance
	static {
		this.InstanceTemplate.Name = "Unnamed Bezier Curve";
		const PointsFolder = new Instance("Folder");
		PointsFolder.Name = "Points";
		PointsFolder.Parent = this.InstanceTemplate;
		const PathFolder = new Instance("Folder");
		PathFolder.Name = "Path";
		PathFolder.Parent = this.InstanceTemplate;
		const Humanoid = new Instance("Humanoid");
		Humanoid.Parent = this.InstanceTemplate; // hack for highlight on transparent things
		const Highlight = new Instance("Highlight");
		Highlight.OutlineColor = new Color3(1, 1, 1);
		Highlight.FillTransparency = 1;
		Highlight.Enabled = false;
		Highlight.Parent = this.InstanceTemplate;
	}

	private static readonly TickAudio = new Instance("Sound");
	static {
		this.TickAudio.Name = "Tick";
		this.TickAudio.SoundId = "rbxassetid://9114065998"
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
	private readonly OnRenderBindable: BindableEvent<(timings: BezierCurveDisplay.RenderTimings) => void> = new Instance("BindableEvent");
	public readonly OnPointsChange = this.OnPointsChangeController as SignalView<[ReadonlyArray<Point>]>
	public readonly OnDestroy = this.OnDestroyBindable.Event
	public readonly OnUpdate = this.OnUpdateBindable.Event;
	public readonly OnRender = this.OnRenderBindable.Event;

	constructor(
		points: Vector3[],
		options: Partial<BezierCurveDisplay.InitializationOptions> = {}
	) {
		this.Instance = BezierCurveDisplay.InstanceTemplate.Clone();
		this.Instance.Parent = game.Workspace;
		BezierCurveDisplay.InstanceMapping.set(this.Instance, this);
		this.SetResolution(options.Resolution ?? 250);
		for (const point of points) {
			this.AddPoint(point)
		}

		this.UseSize = options.SizeParts ?? (this.Resolution <= 1000);
		this.Style = options.VisualizeWithColor ?? BezierCurveDisplay.VisualColorDataSource.Velocity;

		this.OnUpdate.Connect(() => {
			this.Render();
			this.PlayTickSFX();
		})
		this.Render()
	}

	private Resolution: number = 0;
	public GetResolution() { return this.Resolution }
	public SetResolution(resolution: number) {
		if (resolution <= 0) error("naughty!") // TODO: handle better
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
				instance.Parent = this.Instance.Path;
			}
		}
		for (const thread of $range(0, 256 - 1)) {
			actors[thread].SendMessage("UpdateInstances", this.Instance.Path)
		}
	}

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

	public UseSize = false;

	private Style = BezierCurveDisplay.VisualColorDataSource.Direction;
	public GetStyle() { return this.Style }
	public SetStyle(style: BezierCurveDisplay.VisualColorDataSource) {
		this.Style = style;
		if (style === BezierCurveDisplay.VisualColorDataSource.None) {
			const gray = new Color3(0.5, 0.5, 0.5);
			this.ApplyPhysicalModification((part) => {
				part.Color = gray;
			})
		}
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

	public OrientationBasis = CFrame.fromMatrix(
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

	private LastSFXPlayed = 0;
	private LastActivePosition = Vector3.zero;
	private PlayTickSFX() {
		if (use_sound_effects.Get()) {
			const part = active_point.Get()?.Instance;
			if (!part) return;
			const now = tick();
			const since = now - this.LastSFXPlayed;
			const travel = this.LastActivePosition.sub(part.Position).Magnitude / 4;
			if (travel < 0.1 && since < .2) return;
			this.LastActivePosition = part.Position;
			if (since < math.max(0.05, .1 - travel)) return;
			this.LastSFXPlayed = now;
			const sound = BezierCurveDisplay.TickAudio.Clone();
			sound.PlaybackSpeed = math.clamp(0.9 + travel * 2, 0.7, 1.3)
			sound.TimePosition = 0.2;
			sound.Ended.Once(() => sound.Destroy());
			sound.Parent = part;
			sound.Play()
		}
	}

	/**
	 * @returns the number of milliseconds it took, or nil if there weren't enough points to preform a render
	 */
	public RenderParallel(): Promise<BezierCurveDisplay.DetailedRenderTimings | undefined> {
		if (!(this.Points.size() >= 3)) return Promise.resolve(undefined);
		const threads = math.clamp(math.floor(this.Resolution / 100), 1, 256)
		let jobs_completed = 0;

		const positions = table.freeze(this.GetPointPositions());
		const outputs = new Array<unknown[]>(threads)
		const start_time = os.clock();

		return new Promise((resolve) => {
			const connection = worker_job_done_signal.Event.Connect((chunk) => {
				outputs[jobs_completed] = chunk;
				jobs_completed += 1;
				if (jobs_completed === threads) {
					const computation_took = (os.clock() - start_time) * 1000;
					const destinations = new Array<CFrame>(this.Resolution);
					const velocities = (this.Style === BezierCurveDisplay.VisualColorDataSource.Velocity) ? new Array<number>(this.Resolution) : undefined;
					let max_velocity = 0;
					let i = 0;

					for (const division of outputs) {
						const allotment = division.size() / 5
						for (const piece of $range(0, allotment - 1)) {
							const part = this.PathInstances[i];
							if (!part) {
								warn("uh oh");
								break
							}
							const offset = (piece * 5);
							const position = division[offset + 0] as Vector3;
							const velocity = division[offset + 1] as Vector3;
							destinations[i] = CFrame.lookAlong(position, velocity).mul(this.OrientationBasis) as never;
							const curvature = division[offset + 3] as number;
							const size = division[offset + 4] as Vector3;
							if (this.UseSize) part.Size = size;
							switch (this.Style) {
								case BezierCurveDisplay.VisualColorDataSource.None: break;
								case BezierCurveDisplay.VisualColorDataSource.Curvature: {
									part.Color = evaluate_color_sequence(gradient, curvature);
									break
								}
								case BezierCurveDisplay.VisualColorDataSource.Direction: {
									const nv = velocity.Abs().Unit;
									part.Color = new Color3(nv.X, nv.Y, nv.Z)
									break
								}
								case BezierCurveDisplay.VisualColorDataSource.Velocity: {
									velocities![i] = velocity.Magnitude;
									max_velocity = velocity.Magnitude > max_velocity ? velocity.Magnitude : max_velocity;
									break
								}
								case BezierCurveDisplay.VisualColorDataSource.Random: {
									part.Color = new Color3(
										math.random(),
										math.random(),
										math.random()
									)
									break
								}
							}

							i += 1;
						}
					}

					if (this.Style === BezierCurveDisplay.VisualColorDataSource.Velocity) {
						for (const i of $range(0, this.Resolution - 1)) {
							const t = velocities![i] / max_velocity;
							if (t === 0 || t > 1 || t !== t || max_velocity === 0) {
								print(t, max_velocity, evaluate_color_sequence(gradient, velocities![i] / max_velocity))

							}
							this.PathInstances[i].Color = evaluate_color_sequence(gradient, t)
						}
					}

					game.Workspace.BulkMoveTo(this.PathInstances, destinations, Enum.BulkMoveMode.FireCFrameChanged)
					const took = (os.clock() - start_time) * 1000;
					const timings: BezierCurveDisplay.DetailedRenderTimings = {
						Detail: "Complex",
						Computation: computation_took,
						Total: took
					}
					connection.Disconnect();
					this.OnRenderBindable.Fire(timings);
					BezierCurveDisplay.TotalRenderCount += 1;
					this.RenderCount += 1;
					resolve(timings)
				}
			})

			const inc = math.max(math.ceil((this.Resolution) / threads), 1)
			let lo = 1;
			let hi = inc;
			for (const thread of $range(0, threads - 1)) {
				(actors[thread].SendMessage as (this: Actor, topic: string, ...parameters: Parameters<BoundCompute>) => void)("Compute",
					lo,
					math.min(hi, this.Resolution),
					this.Resolution,
					true,
					true,//this.Style === BezierCurveDisplay.VisualColorDataSource.Curvature,
					this.UseSize,
					positions,
				)
				lo += inc;
				hi += inc;
			}
		})
	}

	public RenderBlocking(): BezierCurveDisplay.SimpleRenderTimings | undefined {
		if (!(this.Points.size() >= 3)) return undefined;
		const positions = this.GetPointPositions();
		const destinations = new Array(this.Resolution)
		const velocities = (this.Style === BezierCurveDisplay.VisualColorDataSource.Velocity) ? new Array<number>(this.Resolution) : undefined;
		const start_time = os.clock()
		let max_velocity = 0;
		for (const step of $range(0, this.Resolution - 1)) {
			const part = this.PathInstances[step];
			const fraction = step / (this.Resolution - 1)
			const position = bezier(positions, fraction);
			const velocity = bezier(positions, fraction, 1)
			destinations[step] = CFrame.lookAlong(position, velocity).mul(this.OrientationBasis)
			const speed = velocity.Magnitude ** 3;
			const acceleration = bezier(positions, fraction, 2)
			const curvature = (speed !== 0) ? math.clamp(velocity.Cross(acceleration).Magnitude / speed, 0, 1) : 0
			if (this.UseSize) part.Size = new Vector3((velocity.Magnitude / ((this.Resolution - 2) + (1 - curvature * 1.5))) + math.min(curvature / 3, 0.1), 1, 1)
			switch (this.Style) {
				case BezierCurveDisplay.VisualColorDataSource.None: break;
				case BezierCurveDisplay.VisualColorDataSource.Curvature: {
					part.Color = evaluate_color_sequence(gradient, curvature)
					break
				}
				case BezierCurveDisplay.VisualColorDataSource.Direction: {
					const nv = velocity.Abs().Unit;
					part.Color = new Color3(nv.X, nv.Y, nv.Z)
					break
				}
				case BezierCurveDisplay.VisualColorDataSource.Velocity: {
					velocities![step] = velocity.Magnitude;
					max_velocity = velocity.Magnitude > max_velocity ? velocity.Magnitude : max_velocity;
					break
				}
				case BezierCurveDisplay.VisualColorDataSource.Random: {
					part.Color = new Color3(math.random(), math.random(), math.random())
					break
				}
			}
		}
		if (this.Style === BezierCurveDisplay.VisualColorDataSource.Velocity) {
			for (const i of $range(0, this.Resolution - 1)) {
				this.PathInstances[i].Color = evaluate_color_sequence(gradient, velocities![i] / max_velocity)
			}
		}
		game.Workspace.BulkMoveTo(this.PathInstances, destinations, Enum.BulkMoveMode.FireCFrameChanged)
		const took = (os.clock() - start_time) * 1000;
		const timing: BezierCurveDisplay.SimpleRenderTimings = {
			Detail: "Light",
			Total: took
		}
		this.OnRenderBindable.Fire(timing);
		BezierCurveDisplay.TotalRenderCount += 1;
		this.RenderCount += 1;
		return timing
	}

	public async Render(parallel_render_resolution_heuristic = 750): Promise<BezierCurveDisplay.RenderTimings | undefined>  {
		if (this.Resolution >= parallel_render_resolution_heuristic) {
			return this.RenderParallel()
		} else {
			return this.RenderBlocking()
		}
	}

	public Repool() {
		const resolution = this.Resolution;
		for (const path of this.PathInstances) path.Destroy();
		table.clear(this.PathInstances);
		this.Resolution = 0;
		this.SetResolution(resolution)
	}
}

export namespace BezierCurveDisplay {
	export interface Instance extends Model {
		Humanoid: Humanoid // hack for highlight on transparent things
		Highlight: Highlight
		Points: Folder
		Path: Folder
	}

	export const enum VisualColorDataSource {
		Curvature = "Curvature",
		Direction = "Direction",
		Velocity = "Velocity",
		Random = "Random",
		None = "None"
	}

	export interface InitializationOptions {
		Resolution: number,
		SizeParts: boolean,
		VisualizeWithColor: VisualColorDataSource
	}

	export interface SimpleRenderTimings {
		Detail: "Light",
		Total: number,
	}

	export interface DetailedRenderTimings extends Omit<SimpleRenderTimings, "Detail"> {
		Detail: "Complex"
		Computation: number
	}

	export type RenderTimings =
		|   SimpleRenderTimings
		| DetailedRenderTimings
}

const gradient = new ColorSequence([
	new ColorSequenceKeypoint(0, new Color3(0, 1, 0)),
	new ColorSequenceKeypoint(0.3, new Color3(1, 1, 0)),
	new ColorSequenceKeypoint(1, new Color3(1, 0, 0))
])
