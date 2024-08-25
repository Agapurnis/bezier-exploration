import { Point } from "./point";

import "./gui"
import { active_point } from "./curve";
const player = game.GetService("Players").LocalPlayer;
const mouse = player.GetMouse();

let did_just_release_handle = false;
const UserInputService = game.GetService("UserInputService");
UserInputService.InputBegan.Connect((input) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1) {
		const point = get_point_on_cursor();
		if (point) active_point.Set(point)
	}
})
UserInputService.InputEnded.Connect((input, processed) => {
	if (!processed && input.UserInputType === Enum.UserInputType.MouseButton1) {
		if (!get_point_on_cursor()) {
			if (did_just_release_handle) return;
			active_point.Set(undefined)
		}
	}
})

active_point.Signal.Connect((point, old) => {
	old?.RemoveHandles();
	point?.AddHandles().MouseButton1Up.Connect(() => {
		did_just_release_handle = true;
		task.delay(0, () => did_just_release_handle = false);
	})
})

function get_point_on_cursor (ray_distance = 100): Point | undefined {
	const hit = game.Workspace.Raycast(mouse.Origin.Position, mouse.Origin.LookVector.mul(ray_distance))
	if (!hit) return undefined;
	if (Point.TestInstance(hit.Instance)) return Point.GetPointFromInstance(hit.Instance);
}
