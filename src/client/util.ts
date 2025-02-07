import { CollisionGroup } from "shared/util";
import { Point } from "./point";

const player = game.GetService("Players").LocalPlayer;
const mouse = player.GetMouse();

const Players = game.GetService("Players")

export function get_character(): Model {
	return player.Character ?? player.CharacterAdded.Wait()[0];
}

export function every_character_descendent(callback: (instance: Instance) => void): RBXScriptConnection {
	function watch_player(player: Player) {
		let descendant_added: RBXScriptConnection | undefined
		const character_created = player.CharacterAdded.Connect((character) => {
			descendant_added?.Disconnect();
			descendant_added = character.DescendantAdded.Connect((instance) => callback(instance));
			character.GetDescendants().forEach((instance) => callback(instance))
		});
		player.Destroying.Once(() => {
			descendant_added?.Disconnect();
			character_created.Disconnect();
		})
	}

	const connection = Players.PlayerAdded.Connect((player) => watch_player(player))
	for (const player of Players.GetPlayers()) watch_player(player);
	return connection
}

every_character_descendent((instance) => {
	if (instance.IsA("BasePart")) {
		instance.CollisionGroup = CollisionGroup.Character
	}
})

const point_ray_params = new RaycastParams();
point_ray_params.CollisionGroup = CollisionGroup.PointRay
export function get_point_on_cursor (ray_distance = 100): Point | undefined {
	const hit = game.Workspace.Raycast(mouse.Origin.Position, mouse.Origin.LookVector.mul(ray_distance), point_ray_params)
	if (!hit) return undefined;
	if (Point.TestInstance(hit.Instance)) return Point.GetPointFromInstance(hit.Instance);
}
