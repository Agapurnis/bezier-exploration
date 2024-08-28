import { BezierCurveDisplay } from "client/curve";
import { selected_curve } from "client/state/selected_curve";
import { make, round } from "shared/util";

export class EditorCurvesListItem {
	private static readonly InstanceTemplate = make("TextButton", {
		Name: "EditorCurvesListItem",
		Size: new UDim2(1, 0, 0, 30)
	})

	public IsSelected() {
		return selected_curve.Get() === this.Curve
	}

	private Update(is_selected = this.IsSelected()) {
		const length = tostring(round(this.Curve.GetLength(), 2)) + "studs"
		this.Instance.Text = (is_selected)
			? "✅ " + length
			:         length
	}

	public readonly Instance: typeof EditorCurvesListItem.InstanceTemplate;

	private static readonly CurveMap = new WeakMap<BezierCurveDisplay, EditorCurvesListItem>();

	public static UpdateOnceFor(curve: BezierCurveDisplay) {
		this.CurveMap.get(curve)?.Update();
	}

	static {
		let curve_update_connection: RBXScriptConnection | undefined
		const new_selected_connection = selected_curve.Signal.Connect((curve, old) => {
			this.CurveMap.get(old!)?.Update();
			const selected = this.CurveMap.get(curve!);
			if (selected) {
				selected.Update();
				curve_update_connection?.Disconnect();
				curve_update_connection = curve!.OnUpdate.Connect(() => {
					// This isn't a constant `true` since in the event of
					selected.Update(selected_curve.Get() === curve)
				})
			}
		});
	}

	constructor(public readonly Curve: BezierCurveDisplay) {
		this.Instance = EditorCurvesListItem.InstanceTemplate.Clone();
		this.Instance.MouseButton1Click.Connect(() => {
			selected_curve.Set(this.IsSelected() ? undefined : this.Curve);
		});
		EditorCurvesListItem.CurveMap.set(Curve, this);
		this.Update();
	}
}

export namespace EditorCurvesListItem {
	export type Instance = EditorCurvesListItem["Instance"]
}
