import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("rejects malformed authoritative via pad shapes before mutating any route", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  const engine = new AutoroutingDrcEngine(srj)
  const before = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  const valid: Record<string, unknown> = { ...before.errors[0]!, pcb_obstacle_shape: { type: "rect", width: 0.4, height: 0.4 } }
  for (const shape of [undefined, null, {}, { type: "triangle" }, { type: "rect", width: 0, height: 1 }, { type: "rect", width: 1, height: Number.NaN }, { type: "circle", radius: -1 }, { type: "circle", radius: Number.POSITIVE_INFINITY }]) {
    const candidate = cloneRoutes(hdRoutes)
    expect((): void => { applyDrcErrorForces(srj, candidate, [valid, { ...valid, pcb_obstacle_shape: shape }], before.traceRouteIndexById, 1) }).toThrow("pcb_obstacle_shape")
    expect(candidate).toEqual(hdRoutes)
  }
  for (const minimum of [undefined, Number.NaN, -0.1]) {
    const candidate = cloneRoutes(hdRoutes)
    expect((): void => { applyDrcErrorForces(srj, candidate, [{ ...valid, minimum_clearance: minimum }], before.traceRouteIndexById, 1) }).toThrow("minimum_clearance")
    expect(candidate).toEqual(hdRoutes)
  }
  const candidate = cloneRoutes(hdRoutes)
  const { pcb_obstacle_center, ...missingCenter } = valid
  expect((): void => { applyDrcErrorForces(srj, candidate, [missingCenter], before.traceRouteIndexById, 1) }).toThrow("pcb_obstacle_center")
  expect(candidate).toEqual(hdRoutes)
})
