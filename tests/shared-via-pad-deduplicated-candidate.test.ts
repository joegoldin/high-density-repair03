import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("moves a shared via site only once for duplicate owner errors", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  const engine = new AutoroutingDrcEngine(srj)
  const snapshot = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  expect(snapshot.errors).toHaveLength(2)
  const candidate = cloneRoutes(hdRoutes)
  expect(
    applyDrcErrorForces(
      srj,
      candidate,
      snapshot.errors,
      snapshot.traceRouteIndexById,
      1,
    ),
  ).toBe(true)
  for (const route of candidate) {
    expect(route.route[1]!.x).toBeCloseTo(-0.010001, 10)
    expect(route.route[1]!.y).toBe(0)
    expect(route.route[2]!.x).toBe(route.route[1]!.x)
    expect(route.route[2]!.y).toBe(route.route[1]!.y)
  }
})
