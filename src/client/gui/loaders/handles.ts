/* eslint-disable no-mixed-spaces-and-tabs */
import { Point } from "client/point";
import { selected_point } from "client/state/selected_point";
import { get_point_on_cursor } from "client/util";

const UserInputService = game.GetService("UserInputService");

let did_just_release_handle = false;
UserInputService.InputBegan.Connect((input) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1) {
		const point = get_point_on_cursor();
		if (point) {
			selected_point.Set(point);
			point.AdjustHighlight(Point.StateHighlightModifier.Held, true)
		}
	}
})
let was_hovering: Point | undefined;
UserInputService.InputChanged.Connect((input, processed) => {
	if (!processed && input.UserInputType === Enum.UserInputType.MouseMovement) {
		const hovering = get_point_on_cursor();
		hovering?.AdjustHighlight(Point.StateHighlightModifier.Hover, true)
		if (hovering !== was_hovering) {
			was_hovering?.AdjustHighlight(Point.StateHighlightModifier.Hover, false)
		}
		was_hovering = hovering
	}
})
UserInputService.InputEnded.Connect((input, processed) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1) {
		const was_selected = selected_point.Get();
		if (get_point_on_cursor() === undefined && !processed) {
			if (did_just_release_handle) return;
			selected_point.Set(undefined)
		}
		was_selected?.AdjustHighlight(Point.StateHighlightModifier.Held, false)
	}
})
selected_point.Signal.Connect((point, old) => {
	if (old) {
		old.RemoveHandles();
		task.defer(() => old.TweenHighlight())
	}
	if (point) {
		point.AddHandles().MouseButton1Up.Connect(() => {
			did_just_release_handle = true;
			task.delay(0, () => did_just_release_handle = false);
		});
	}
})
