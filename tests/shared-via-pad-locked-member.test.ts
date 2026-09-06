import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  collectViaNodes,
  getDrcSnapshot,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("refuses the entire shared via pad move when one member is a terminal", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  hdRoutes[1]!.route.shift()
  hdRoutes[1]!.route[0]!.pcb_port_id = "start_1"
  const engine = new AutoroutingDrcEngine(srj)
  const snapshot = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  expect(snapshot.errors).toHaveLength(2)
  expect(collectViaNodes(hdRoutes).map((via) => via.movable)).toEqual([true, false])
  const candidate = cloneRoutes(hdRoutes)
  expect(
    applyDrcErrorForces(
      srj,
      candidate,
      snapshot.errors,
      snapshot.traceRouteIndexById,
      1,
    ),
  ).toBe(false)
  expect(candidate).toEqual(hdRoutes)
})
