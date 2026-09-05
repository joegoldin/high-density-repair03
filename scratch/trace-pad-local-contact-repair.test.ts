import { expect, test } from "bun:test"
import { AutoroutingDrcEngine, type HighDensityRoute, type SimpleRouteJson } from "../lib"
import { applyDrcErrorForces, cloneRoutes, getDrcSnapshot, materializeRoutes } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

test("reproduction: isolated pad repulsion must not worsen clearance to a neighboring trace", () => {
  const route: HighDensityRoute = {
    connectionName: "signal", traceThickness: 0.15, viaDiameter: 0.5,
    vias: [{ x: 4.715, y: 1.1150015582258574 }],
    route: [
      { x: 4.606008672429025, y: 1.0976906346250164, z: 1 },
      { x: 4.715, y: 1.1150015582258574, z: 1 },
      { x: 4.715, y: 1.1150015582258574, z: 0 },
      { x: 4.683, y: 1.3362447261667765, z: 0 },
      { x: 4.35452350371261, y: 1.6585191253289255, z: 0 },
      { x: 4.048305520726764, y: 1.821932813056818, z: 0 },
      { x: 3.7817407643681795, y: 1.081024653748314, z: 0 },
      { x: 3.7950027854124384, y: 1.055365525905887, z: 0 },
      { x: 3.8, y: 0.95, z: 0 },
    ],
  }
  const rail: HighDensityRoute = {
    connectionName: "rail", traceThickness: 0.15, viaDiameter: 0.5, vias: [],
    route: [
      { x: 3.4, y: 0.95, z: 0 },
      { x: 3.3591781896862023, y: 1.3922735551067384, z: 0 },
      { x: 3.9477774397881524, y: 2.1834470478036017, z: 0 },
    ],
  }
  const srj: SimpleRouteJson = {
    layerCount: 2, minTraceWidth: 0.15, minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: 2, maxX: 5, minY: 0, maxY: 3 },
    obstacles: [3.4, 3.8, 4.2].map((x, index) => ({
      type: "rect", center: { x, y: 0.95 }, width: 0.2, height: 0.85,
      layers: ["top"], connectedTo: [`pcb_smtpad_${index}`, ...(index === 1 ? ["signal"] : index === 0 ? ["rail"] : [])],
    })),
    connections: [route, rail].map((r) => ({ name: r.connectionName, pointsToConnect: [r.route[0]!, r.route.at(-1)!].map((point) => ({ ...point, layer: point.z === 0 ? "top" : "bottom" })) })),
  }
  const engine = new AutoroutingDrcEngine(srj, { traceClearance: 0.15, viaClearance: 0.15 })
  const before = getDrcSnapshot(srj, [route, rail], undefined, undefined, engine)
  expect(before.count).toBe(1)
  const routes = cloneRoutes([route, rail])
  applyDrcErrorForces(srj, routes, before.errors, before.traceRouteIndexById, 1)
  const after = getDrcSnapshot(srj, materializeRoutes(routes), undefined, undefined, engine)
  expect(after.count).toBeLessThanOrEqual(before.count)
  expect(after.issueScore).toBeLessThan(before.issueScore)
})
