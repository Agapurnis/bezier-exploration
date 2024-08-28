import { Signal } from "@rbxts/beacon";
import { BezierCurveDisplay } from "client/curve";
import { SignalView } from "shared/util";

export class CurveStore {
	private readonly Curves: BezierCurveDisplay[] = [];
	private readonly OnCurvesListChangeBindable = new Signal<ReadonlyArray<BezierCurveDisplay>>()
	public readonly OnCurvesListChange: SignalView<ReadonlyArray<BezierCurveDisplay>> = this.OnCurvesListChangeBindable;
	public GetCurves(): ReadonlyArray<BezierCurveDisplay> { return this.Curves }
	public AddCurve(curve: BezierCurveDisplay): BezierCurveDisplay {
		this.Curves.push(curve);
		this.OnCurvesListChangeBindable.Fire(this.Curves);
		return curve
	}
}

export const curves = new CurveStore();
curves.AddCurve(new BezierCurveDisplay([
	new Vector3( -5, 3, -10),
	new Vector3(  0, 7, -10),
	new Vector3(  5, 3, -10),
]))
