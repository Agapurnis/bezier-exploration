export function UsingTemplate<T extends GuiBase, U extends unknown[], V = void>(make_template: () => T, make: (instance: T, ...context: U) => V): (...context: U) => (V extends void | undefined ? T : V) {
	const template = make_template();
	return (...context) => {
		const instance = template.Clone();
		return (make(instance, ...context) ?? instance) as V extends void | undefined ? T : V
	}
}


const player = game.GetService("Players").LocalPlayer;
const player_gui = player.WaitForChild("PlayerGui") as PlayerGui;
export const screen = new Instance("ScreenGui", player_gui);
screen.ResetOnSpawn = false;
