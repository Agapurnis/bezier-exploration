import { BezierCurveDisplay } from "client/curve";
import { make } from "shared/util";
import { EditorCurvesListItem } from "./EditorCurvesListItem";
import { curves as curves_store } from "client/state/curves";

export class EditorCurvesList {
	private static readonly InstanceTemplate = make("ScrollingFrame", {
		Name: "Curves List",
		Size: UDim2.fromScale(0.2, 0.85),
		Position: UDim2.fromScale(0, 0.15),
	})

	public Update(curves: ReadonlyArray<BezierCurveDisplay> = curves_store.GetCurves()) {
		this.Instance.ClearAllChildren();
		new Instance("UIListLayout", this.Instance);
		for (const curve of curves) {
			new EditorCurvesListItem(curve).Instance.Parent = this.Instance;
		}
	}

	public readonly Instance: typeof EditorCurvesList.InstanceTemplate;

	constructor(parent: GuiBase | undefined) {
		this.Instance = EditorCurvesList.InstanceTemplate.Clone();
		const curves_change_connection = curves_store.OnCurvesListChange.Connect((curves) => this.Update(curves))
		this.Update();
		this.Instance.Destroying.Connect(() => curves_change_connection.Disconnect())
		this.Instance.Parent = parent;
	}
}

export namespace EditorCurvesList {
	export type Instance = EditorCurvesList["Instance"]
}
