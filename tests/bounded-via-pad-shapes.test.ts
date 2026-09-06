import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
  materializeRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("derives via escape from the checked rectangle or circle and requested clearance", (): void => {
  const cases = [
    { width: 0.4, height: 0.2, circle: false, x: 0.43, y: 0.03, radius: 0.15, clearance: 0.1, dx: 0.020001, dy: 0 },
    { width: 0.4, height: 0.2, circle: false, x: 0.35, y: 0.25, radius: 0.15, clearance: 0.1, dx: 0.250001 / Math.SQRT2 - 0.15, dy: 0.250001 / Math.SQRT2 - 0.15 },
    { width: 0.4, height: 0.4, circle: true, x: 0.43, y: 0, radius: 0.15, clearance: 0.1, dx: 0.020001, dy: 0 },
    { width: 0.08, height: 0.12, circle: false, x: 0.01, y: 0, radius: 0.02, clearance: 0.03, dx: 0.080001, dy: 0 },
    { width: 0.08, height: 0.08, circle: true, x: 0, y: 0, radius: 0.02, clearance: 0.03, dx: 0.090001, dy: 0 },
    { width: 0.4, height: 0.2, circle: false, x: 0.44, y: 0, radius: 0.18, clearance: 0.13, dx: 0.070001, dy: 0 },
    { width: 2, height: 2, circle: false, x: 0, y: 0, radius: 0.15, clearance: 0.1, dx: 0, dy: 0.14 },
  ]
  for (const row of cases) {
    const { srj, hdRoutes } = createSharedViaPadFixture()
    hdRoutes.splice(1)
    const obstacle = srj.obstacles[0]!
    Object.assign(obstacle, { center: { x: 0, y: 0 }, width: row.width, height: row.height, layers: row.circle ? ["top", "bottom"] : ["top"] })
    const route = hdRoutes[0]!
    route.viaDiameter = row.radius * 2
    route.route[1] = { x: row.x, y: row.y, z: 0 }
    route.route[2] = { x: row.x, y: row.y, z: 1 }
    route.vias = [{ x: row.x, y: row.y }]
    const input = structuredClone({ srj, hdRoutes })
    const engine = new AutoroutingDrcEngine(srj, { viaToPadClearance: row.clearance })
    const before = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
    const errors = before.errors.filter(error => error.type === "pcb_pad_pad_clearance_error")
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_obstacle_shape).toEqual(row.circle ? { type: "circle", radius: row.width / 2 } : { type: "rect", width: row.width, height: row.height })
    const candidate = cloneRoutes(hdRoutes)
    expect(applyDrcErrorForces(srj, candidate, errors, before.traceRouteIndexById, 1)).toBe(true)
    const output = materializeRoutes(candidate)
    expect(output[0]!.vias[0]!.x).toBeCloseTo(row.x + row.dx, 10)
    expect(output[0]!.vias[0]!.y).toBeCloseTo(row.y + row.dy, 10)
    if (row.width !== 2) {
      const via = output[0]!.vias[0]!
      const distance = row.circle ? Math.hypot(via.x, via.y) - row.width / 2 : Math.hypot(Math.max(Math.abs(via.x) - row.width / 2, 0), Math.max(Math.abs(via.y) - row.height / 2, 0))
      expect(distance - row.radius).toBeCloseTo(row.clearance + 1e-6, 10)
    }
    expect({ srj, hdRoutes }).toEqual(input)
  }
})
