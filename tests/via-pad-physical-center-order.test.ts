import { expect, test } from "bun:test"
import { AutoroutingDrcEngine, type HighDensityRoute } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
  materializeRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("uses the exact pad center despite routing obstacle and alias order", (): void => {
  const { srj: physicalSrj, hdRoutes } = createSharedViaPadFixture()
  hdRoutes.splice(1)
  physicalSrj.obstacles.unshift({
    type: "rect",
    layers: ["top"],
    center: { x: -0.44, y: 2 },
    width: 0.4,
    height: 0.4,
    connectedTo: ["pcb_smtpad_distractor", "foreign"],
  })
  const original = structuredClone({ physicalSrj, hdRoutes })
  const candidates: HighDensityRoute[][] = []
  for (const reverseObstacles of [false, true]) {
    for (const reverseAliases of [false, true]) {
      const engineSrj = structuredClone(physicalSrj)
      const routingSrj = structuredClone(physicalSrj)
      for (const obstacle of routingSrj.obstacles) {
        obstacle.connectedTo = [
          "pcb_smtpad_distractor",
          "foreign",
          "pcb_smtpad_foreign",
        ]
      }
      if (reverseObstacles) {
        engineSrj.obstacles.reverse()
        routingSrj.obstacles.reverse()
      }
      if (reverseAliases) {
        for (const obstacle of engineSrj.obstacles) obstacle.connectedTo.reverse()
        for (const obstacle of routingSrj.obstacles) obstacle.connectedTo.reverse()
      }
      const routingInput = structuredClone(routingSrj)
      const engine = new AutoroutingDrcEngine(engineSrj)
      const before = getDrcSnapshot(
        routingSrj,
        hdRoutes,
        undefined,
        undefined,
        engine,
      )
      expect(before.errors).toHaveLength(1)
      expect(before.errors[0]!.pcb_obstacle_center).toEqual({ x: 0.44, y: 0 })
      expect(before.errors[0]!.center).toEqual({ x: 0.22, y: 0 })
      const candidate = cloneRoutes(hdRoutes)
      expect(
        applyDrcErrorForces(
          routingSrj,
          candidate,
          before.errors,
          before.traceRouteIndexById,
          1,
        ),
      ).toBe(true)
      const output = materializeRoutes(candidate)
      expect(output[0]!.route[1]!.x).toBeCloseTo(-0.010001, 10)
      expect(output[0]!.route[1]!.y).toBe(0)
      expect(
        getDrcSnapshot(routingSrj, output, undefined, undefined, engine).errors,
      ).toEqual([])
      expect(output[0]!.route).toEqual(
        hdRoutes[0]!.route.map((point, index) =>
          index === 1 || index === 2
            ? { ...point, x: output[0]!.route[1]!.x }
            : point,
        ),
      )
      expect(output[0]!.traceThickness).toBe(hdRoutes[0]!.traceThickness)
      expect(output[0]!.viaDiameter).toBe(hdRoutes[0]!.viaDiameter)
      expect(routingSrj).toEqual(routingInput)
      candidates.push(output)
    }
  }
  for (const candidate of candidates) expect(candidate).toEqual(candidates[0]!)
  expect({ physicalSrj, hdRoutes }).toEqual(original)
})
