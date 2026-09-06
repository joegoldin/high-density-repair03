import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
  materializeRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("retains legacy via pad displacement when optional shape metadata is absent", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  const engine = new AutoroutingDrcEngine(srj)
  const before = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  const errors = before.errors.map(({ pcb_obstacle_shape, ...error }) => error)
  const candidate = cloneRoutes(hdRoutes)
  expect(applyDrcErrorForces(srj, candidate, errors, before.traceRouteIndexById, 1)).toBe(true)
  const output = materializeRoutes(candidate)
  expect(output[0]!.vias[0]!.x).toBeCloseTo(-0.14, 10)
  expect(output[0]!.vias).toEqual(output[1]!.vias)
})
