import { selected_curve } from "client/state/selected_curve"
import { editor } from "./editor"

selected_curve.Signal.Connect((curve, old) => {
	if (curve) curve.Instance.Highlight.Enabled = editor.Visible
	if (old) old.Instance.Highlight.Enabled = false
})
