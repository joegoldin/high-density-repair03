import { expect, test } from "bun:test"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { AutoroutingDrcEngine, type HighDensityRoute, type SimpleRouteJson } from "../lib"

test("clearance severity measures the deficit against the error's declared rule", () => {
  const route: HighDensityRoute = {
    connectionName: "signal", traceThickness: 0.15, viaDiameter: 0.5, vias: [],
    route: [{ x: -1, y: 0.7, z: 0 }, { x: 1, y: 0.7, z: 0 }],
  }
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
    obstacles: [{
      type: "rect", center: { x: 0, y: 0 }, width: 0.5, height: 1,
      layers: ["top"], connectedTo: ["pcb_smtpad_foreign"],
    }],
    connections: [{
      name: "signal",
      pointsToConnect: route.route.map((point) => ({ ...point, layer: "top" })),
    }],
  }
  const engine = new AutoroutingDrcEngine(srj, { traceClearance: 0.15, viaClearance: 0.15 })
  const snapshot = getDrcSnapshot(srj, [route], undefined, undefined, engine)
  expect(snapshot.count).toBe(1)
  expect(snapshot.issueScore).toBeCloseTo(0.025, 6)
})
