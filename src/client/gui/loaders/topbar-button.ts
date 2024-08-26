import { Icon } from "@rbxts/topbar-plus";
import { editor } from "./editor";
import { selected_curve } from "client/state/selected_curve";

export = new Icon()
	.setImage("http://www.roblox.com/asset/?id=8382597378")
	.setLabel("Menu")
	.align("Left")
	.bindToggleKey(Enum.KeyCode.E)
	.bindEvent("toggled", () => {
		editor.Visible = !editor.Visible;
		const curve = selected_curve.Get();
		if (curve) curve.Instance.Highlight.Enabled = editor.Visible;
	})
