import { is_integer } from "shared/util";

export enum ComputationMethod {
	Polynomic = "Polynomic",
	PolynomicHorners = "Polynomic w/ Horner's",
	DeCasteljau = "De Casteljau",
}

export const enum VisualColorDataSource {
	Curvature = "Curvature",
	Direction = "Direction",
	Velocity = "Velocity",
	Acceleration = "Acceleration",
	Random = "Random",
	None = "None"
}

export function is_measured_source(source: VisualColorDataSource) {
	return (
		source === VisualColorDataSource.Acceleration,
		source === VisualColorDataSource.Velocity
	)
}

export type BezierCurveComputationalProperties = "Velocity" | "Acceleration" | "Curvature"

export class BezierConfigurationBuilder {
	private Threads?: number
	private Resolution?: number
	private Method?: ComputationMethod
	private Velocity?: boolean;
	private Acceleration?: boolean;
	private Curvature?: boolean;
	private Size?: boolean
	private ColorSource?: VisualColorDataSource

	constructor(base?: Partial<BezierConfiguration>) {
		if (base) {
			if (base.threads !== undefined) this.WithThreads(base.threads)
			if (base.resolution !== undefined) this.WithResolution(base.resolution)
			if (base.method !== undefined) this.WithMethod(base.method)
			if (base.velocity !== undefined) this.ComputeVelocity(base.velocity, undefined, undefined)
			if (base.acceleration !== undefined) this.ComputeAcceleration(base.acceleration, undefined, undefined)
			if (base.curvature !== undefined) this.ComputeCurvature(base.curvature, false, "")
			if (base.size !== undefined) this.WithSize(base.size)
			if (base.color_source !== undefined) this.WithColorSource(base.color_source)
		}
	}

	public Validate(): this {
		if (this.Threads !== undefined) this.WithThreads(this.Threads)
		if (this.Resolution !== undefined) this.WithResolution(this.Resolution)
		if (this.Method !== undefined) this.WithMethod(this.Method)
		if (this.Velocity !== undefined) this.ComputeVelocity(this.Velocity, undefined, "")
		if (this.Acceleration !== undefined) this.ComputeAcceleration(this.Acceleration, undefined, "")
		if (this.Curvature !== undefined) this.ComputeCurvature(this.Curvature, undefined, "")
		if (this.Size !== undefined) this.WithSize(this.Size)
		if (this.ColorSource !== undefined) this.WithColorSource(this.ColorSource)
		return this;
	}

	public WithMethod(method: ComputationMethod): this {
		this.Method = method;
		return this
	}

	public WithColorSource(color_source: VisualColorDataSource | undefined) {
		switch (color_source) {
			case VisualColorDataSource.Curvature:
				this.ComputeCurvature(true, true, "because of the selected ColorSource");
				break
			case VisualColorDataSource.Direction:
			case VisualColorDataSource.Velocity:
				this.ComputeVelocity(true, true, "because of the selected ColorSource");
				break
		}
		this.ColorSource = color_source;
		return this
	}

	private ResolveColorSource(velocity: boolean): VisualColorDataSource {
		if (this.ColorSource !== undefined) return this.ColorSource;
		if (velocity) return VisualColorDataSource.Velocity;
		return VisualColorDataSource.None;
	}

	public WithResolution(resolution: number): this {
		if (resolution < 1 || !is_integer(resolution)) error("Resolution must be a positive integer above one!");
		if (this.Threads !== undefined && resolution < this.Threads) error("Resolution cannot be lower than the thread count!")
		this.Resolution = resolution;
		return this
	}

	public WithThreads(threads: number): this {
		if (threads < 1 || !is_integer(threads)) error("Thread count must be a positive non-zero integer!");
		if (this.Resolution !== undefined && threads > this.Resolution) error("Thread count cannot be higher than the resolution!");
		this.Threads = threads;
		return this
	}

	public WithSize(value = true): this {
		if (value) {
			this.ComputeVelocity(true, true, "making the size incomputable")
			this.ComputeAcceleration(true, true, "making the size incomputable")
		}
		this.Size = value
		return this
	}

	public ComputeVelocity(value: boolean, internal_constraint = false, reasoning: string | undefined): this{
		if (!value) {
			if (this.Curvature === true) error(`Velocity computation ${reasoning !== undefined ? `(${reasoning}) ` : ""}is required to calculate curvature.`);
			if (
				this.ColorSource === VisualColorDataSource.Velocity ||
				this.ColorSource === VisualColorDataSource.Direction
			) error(`The current ColorSource requires that velocity be enabled.`)
		}
		if (this.Velocity ===  value) return this;
		if (this.Velocity === !value && internal_constraint) error(`Velocity computation is required to be ${value ? "enabled" : "disabled"} ` + reasoning);
		this.Velocity = value;
		return this;
	}

	public ComputeAcceleration(value: boolean, internal_constraint = false, reasoning: string | undefined): this {
		if (!value) {
			if (this.Curvature === true) error(`Acceleration computation ${reasoning !== undefined ? `(${reasoning}) ` : ""}is required to calculate curvature.`);
		}
		if (this.Acceleration ===  value) return this;
		if (this.Acceleration === !value && internal_constraint) error(`Acceleration computation is required to be ${value ? "enabled" : "disabled"} ` + reasoning);
		this.Acceleration = value;
		return this;
	}

	public ComputeCurvature(value: boolean, internal_constraint = false, reasoning: string): this {
		if (!value) {
			if (this.ColorSource === VisualColorDataSource.Curvature) error(`The current ColorSource requires that velocity be enabled.`)
		}
		if (this.Curvature === !value && internal_constraint) error("Curvature computation must be enabled " + reasoning);
		const reason = "which is required to calculate curvature" + (reasoning !== undefined ? ", " + reasoning : "");
		this.ComputeVelocity(true, true, reason);
		this.ComputeAcceleration(true, true, reason);
		this.Curvature = true;
		return this;
	}

	public static Default() {
		return new this().Resolve()
	}

	public Resolve(): BezierConfiguration {
		const method = this.Method ??= ComputationMethod.Polynomic;
		const velocity = this.Velocity ?? true;
		const acceleration = true // this.Acceleration ?? (this.Curvature === true);
		const curvature = this.Curvature ?? (velocity && acceleration)
		const size = this.Size ?? acceleration;
		const resolution = this.Resolution ?? 250
		const threads = this.Threads ?? math.clamp(math.floor(resolution / 100), 1, 100)
		const color_source = this.ResolveColorSource(velocity);
		return {
			threads,
			resolution,
			method,
			velocity,
			acceleration,
			curvature,
			size,
			color_source
		}
	}
}

export interface BezierConfiguration {
	threads:      number,
	resolution:   number,
	method:       ComputationMethod,
	velocity:     boolean,
	acceleration: boolean,
	curvature:    boolean,
	size:         boolean,
	color_source: VisualColorDataSource
}
