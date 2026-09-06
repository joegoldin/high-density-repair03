import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("reports the checked normalized pad slice on the via's physical layer", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  hdRoutes.splice(1)
  srj.layerCount = 4
  srj.obstacles = [
    {
      type: "rect",
      obstacleId: "rotated_pad_approx_0",
      layers: ["inner1"],
      center: { x: 0.28, y: 0 },
      width: 0.12,
      height: 0.3,
      connectedTo: ["pcb_smtpad_rotated_slice_0", "foreign"],
    },
    {
      type: "rect",
      obstacleId: "rotated_pad_approx_1",
      layers: ["inner1"],
      center: { x: 0.4, y: 0.12 },
      width: 0.12,
      height: 0.3,
      connectedTo: ["pcb_smtpad_rotated_slice_1", "foreign"],
    },
    {
      type: "rect",
      layers: ["bottom"],
      center: { x: 0.1, y: 0 },
      width: 0.12,
      height: 0.3,
      connectedTo: ["pcb_smtpad_off_layer", "foreign"],
    },
  ]
  const engine = new AutoroutingDrcEngine(srj)
  const snapshot = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  expect(snapshot.errors).toHaveLength(1)
  expect(snapshot.errors[0]).toMatchObject({
    pcb_pad_ids: ["via_0", "pcb_smtpad_rotated_slice_0"],
    pcb_obstacle_center: srj.obstacles[0]!.center,
    center: { x: 0.14, y: 0 },
  })
})
