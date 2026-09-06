import { expect, test } from "bun:test"
import { AutoroutingDrcEngine, GlobalDrcForceImproveSolver } from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("repairs duplicate owner errors by moving their shared via site atomically", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  const input = structuredClone(hdRoutes)
  const engine = new AutoroutingDrcEngine(srj)
  const before = getDrcSnapshot(srj, hdRoutes, undefined, undefined, engine)
  expect(before.errors).toHaveLength(2)
  expect(
    before.errors.every((error) => error.type === "pcb_pad_pad_clearance_error"),
  ).toBe(true)
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
  const output = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    getDrcSnapshot(srj, output, undefined, undefined, engine).errors,
  ).toEqual([])
  expect(solver.stats.globalDrcForceImproveTargetedForceAccepted).toBe(true)
  expect(solver.stats.globalDrcForceImproveCandidateAttempts).toBe(1)
  for (const [index, route] of output.entries()) {
    const original = input[index]!
    expect(route.route).toHaveLength(original.route.length)
    expect(route.route.map((point) => point.z)).toEqual(
      original.route.map((point) => point.z),
    )
    expect(route.route[1]!.x).toBeCloseTo(-0.010001, 10)
    expect(route.route[1]!.y).toBe(0)
    expect(route.route[1]!.z).toBe(original.route[1]!.z)
    expect(route.route[2]).toEqual({ ...route.route[1]!, z: original.route[2]!.z })
    expect(route.vias).toEqual([{ x: route.route[1]!.x, y: 0 }])
    expect(route.route[0]).toEqual(original.route[0])
    expect(route.route.at(-1)).toEqual(original.route.at(-1))
    expect(route.connectionName).toBe(original.connectionName)
    expect(route.rootConnectionName).toBe(original.rootConnectionName)
    expect(route.traceThickness).toBe(original.traceThickness)
    expect(route.viaDiameter).toBe(original.viaDiameter)
  }
  expect(output[0]!.vias).toEqual(output[1]!.vias)
  expect(hdRoutes).toEqual(input)
})
