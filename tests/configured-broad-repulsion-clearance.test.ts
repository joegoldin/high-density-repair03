import { expect, test } from "bun:test"
import { applyBroadRepulsionForces } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { HighDensityRoute, SimpleRouteJson } from "../lib"

test("broad repulsion separates via copper using the requested trace clearance", () => {
  const routes: HighDensityRoute[] = [
    {
      connectionName: "a", traceThickness: 0.15, viaDiameter: 0.5, vias: [],
      route: [{ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
    },
    {
      connectionName: "b", traceThickness: 0.15, viaDiameter: 0.5,
      vias: [{ x: 0, y: 0.44 }],
      route: [
        { x: -1, y: 1, z: 0 }, { x: 0, y: 0.44, z: 0 },
        { x: 0, y: 0.44, z: 1 }, { x: 1, y: 1, z: 1 },
      ],
    },
  ]
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: -3, maxX: 3, minY: -2, maxY: 2 },
    obstacles: [],
    connections: routes.map((route) => ({
      name: route.connectionName,
      pointsToConnect: [route.route[0]!, route.route.at(-1)!].map((point) => ({
        ...point, layer: point.z === 0 ? "top" : "bottom",
      })),
    })),
  }
  const repaired = applyBroadRepulsionForces(srj, routes, 1)
  expect(repaired).not.toBe(routes)
  const via = repaired[1]!.vias[0]!
  expect(via.y - 0.25 - 0.075).toBeGreaterThanOrEqual(0.15)
})
