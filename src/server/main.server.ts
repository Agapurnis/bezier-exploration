import { CollisionGroup } from "shared/util";
const PhysicsService = game.GetService("PhysicsService")
PhysicsService.RegisterCollisionGroup(CollisionGroup.Character)
PhysicsService.RegisterCollisionGroup(CollisionGroup.PointRay)
PhysicsService.CollisionGroupSetCollidable(CollisionGroup.Character, CollisionGroup.PointRay, false);
