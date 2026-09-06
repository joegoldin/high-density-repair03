import { expect, test } from "bun:test"
import { AutoroutingDrcEngine, GlobalDrcForceImproveSolver } from "../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
  materializeRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("rejects a shared via pad candidate that introduces a foreign via collision", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  hdRoutes.push({
    connectionName: "foreign",
    traceThickness: 0.15,
    viaDiameter: 0.3,
    route: [
      { x: -0.4, y: 0, z: 0 },
      { x: -0.4, y: 0, z: 1 },
    ],
    vias: [{ x: -0.4, y: 0 }],
  })
  const input = structuredClone(hdRoutes)
  const engine = new AutoroutingDrcEngine(srj)
  const before = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  expect(before.errors).toHaveLength(2)
  expect(
    before.errors.every((error) => error.type === "pcb_pad_pad_clearance_error"),
  ).toBe(true)
  const candidate = cloneRoutes(hdRoutes)
  expect(
    applyDrcErrorForces(
      srj,
      candidate,
      before.errors,
      before.traceRouteIndexById,
      1,
    ),
  ).toBe(true)
  const after = getDrcSnapshot(
    srj,
    materializeRoutes(candidate),
    undefined,
    undefined,
    engine,
  )
  expect(
    after.errors.some((error) => error.type === "pcb_via_clearance_error"),
  ).toBe(true)
  expect(
    after.errors.some((error) => error.type === "pcb_pad_pad_clearance_error"),
  ).toBe(false)
  const solver = new GlobalDrcForceImproveSolver({
    srj,
    hdRoutes,
    autoroutingDrcEngine: engine,
    maxIterations: 1,
    enableBroadFallback: false,
    enableLargeBoardBroadFallback: false,
    enableTargetedErrorSweep: false,
    enablePostSolveClearanceRelaxation: false,
    enableSafeTraceLayerMoves: false,
    enableViaInPadLayerMoves: false,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.stats.globalDrcForceImproveCandidateAttempts).toBeGreaterThan(0)
  expect(solver.getOutput()).toEqual(input)
  expect(
    getDrcSnapshot(srj, solver.getOutput(), undefined, undefined, engine).errors,
  ).toEqual(before.errors)
  expect(hdRoutes).toEqual(input)
})
