import { expect } from "bun:test"
import {
  AutoroutingDrcEngine,
  GlobalDrcForceImproveSolver,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../../lib"
import {
  applyDrcErrorForces,
  cloneRoutes,
  getDrcSnapshot,
  materializeRoutes,
} from "../../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

export const checkBoundedViaPadRepair = (
  fixture: { srj: SimpleRouteJson; routes: HighDensityRoute[] },
  count: number,
): void => {
  const { srj, routes } = fixture
  const input = structuredClone(fixture)
  const engine = new AutoroutingDrcEngine(srj)
  const before = getDrcSnapshot(srj, routes, undefined, undefined, engine)
  expect(before.errors).toHaveLength(count)
  expect(before.errors.every(
    (error) => error.type === "pcb_pad_pad_clearance_error",
  )).toBe(true)
  const candidate = cloneRoutes(routes)
  expect(applyDrcErrorForces(
    srj, candidate, before.errors, before.traceRouteIndexById, 1,
  )).toBe(true)
  const output = materializeRoutes(candidate)
  expect(
    getDrcSnapshot(srj, output, undefined, undefined, engine).errors,
  ).toEqual([])
  const solver = new GlobalDrcForceImproveSolver({
    srj,
    hdRoutes: routes,
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
  expect(solver.stats.globalDrcForceImproveTargetedForceAccepted).toBe(true)
  expect(solver.getOutput()).toEqual(output)
  const pad = srj.obstacles[0]!
  let movedSites = 0
  for (const [index, route] of output.entries()) {
    const original = routes[index]!
    expect(route.route).toHaveLength(original.route.length)
    expect(route.route.map((point) => point.z)).toEqual(
      original.route.map((point) => point.z),
    )
    expect(route.route[0]).toEqual(original.route[0])
    expect(route.route.at(-1)).toEqual(original.route.at(-1))
    expect({ ...route, route: [], vias: [] }).toEqual(
      { ...original, route: [], vias: [] },
    )
    expect(route.vias).toHaveLength(original.vias.length)
    for (const [viaIndex, via] of route.vias.entries()) {
      const oldVia = original.vias[viaIndex]!
      const movement = Math.hypot(via.x - oldVia.x, via.y - oldVia.y)
      if (movement === 0) continue
      movedSites++
      expect(movement).toBeLessThan(0.02)
      const gap = Math.hypot(
        Math.max(Math.abs(via.x - pad.center.x) - pad.width / 2, 0),
        Math.max(Math.abs(via.y - pad.center.y) - pad.height / 2, 0),
      ) - route.viaDiameter / 2
      expect(gap).toBeCloseTo(0.100001, 10)
      for (const [pointIndex, point] of original.route.entries()) {
        if (point.x !== oldVia.x || point.y !== oldVia.y) continue
        expect(route.route[pointIndex]).toEqual(
          { ...point, x: via.x, y: via.y },
        )
      }
    }
  }
  expect(movedSites).toBe(count)
  expect(fixture).toEqual(input)
}
