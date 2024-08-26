import { BezierCurveDisplay } from "client/curve";
import { SubscribableStore } from "shared/store";
import { selected_point } from "./selected_point";

export const selected_curve = new SubscribableStore<BezierCurveDisplay | undefined>(undefined);
selected_point.Signal.Connect((point) => selected_curve.Set(point ? BezierCurveDisplay.GetFromInstance(point.Instance.Parent!.Parent as BezierCurveDisplay.Instance) : undefined))

