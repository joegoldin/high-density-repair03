import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
  materializeRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("clears the largest actual shared via radius in one atomic movement", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  hdRoutes[1]!.viaDiameter = 0.34
  const input = structuredClone(hdRoutes)
  const engine = new AutoroutingDrcEngine(srj)
  const before = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  expect(before.errors).toHaveLength(2)
  const candidate = cloneRoutes(hdRoutes)
  expect(applyDrcErrorForces(srj, candidate, before.errors, before.traceRouteIndexById, 1)).toBe(true)
  const output = materializeRoutes(candidate)
  expect(output[0]!.vias[0]!.x).toBeCloseTo(-0.030001, 10)
  expect(output[0]!.vias).toEqual(output[1]!.vias)
  expect(getDrcSnapshot(srj, output, undefined, undefined, engine).errors).toEqual([])
  for (const [index, route] of output.entries()) {
    expect(route.viaDiameter).toBe(input[index]!.viaDiameter)
    expect(route.route).toEqual(input[index]!.route.map((point, pointIndex) => pointIndex === 1 || pointIndex === 2 ? { ...point, x: output[0]!.vias[0]!.x } : point))
  }
  expect(hdRoutes).toEqual(input)
})
