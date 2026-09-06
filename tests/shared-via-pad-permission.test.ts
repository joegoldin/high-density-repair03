import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("refuses shared via pad movement when the caller denies permission", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  const engine = new AutoroutingDrcEngine(srj)
  const snapshot = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  const candidate = cloneRoutes(hdRoutes)
  expect(
    applyDrcErrorForces(
      srj,
      candidate,
      snapshot.errors,
      snapshot.traceRouteIndexById,
      1,
      undefined,
      true,
      false,
      false,
    ),
  ).toBe(false)
  expect(candidate).toEqual(hdRoutes)
})
