import { expect, test } from "bun:test"
import {
  AutoroutingDrcEngine,
  type HighDensityRoute,
  type SimpleRouteJson,
  type SimplifiedPcbTraces,
} from "../lib"
import {
  applyBroadRepulsionForces,
  getDrcSnapshot,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

type CopperRoutePoint = HighDensityRoute["route"][number] & {
  traceThickness?: number
}

type CopperRoute = Omit<HighDensityRoute, "route"> & {
  route: CopperRoutePoint[]
}

const getLayerName = (z: number) => (z === 0 ? "top" : "bottom")

const toExactTraces = (routes: HighDensityRoute[]): SimplifiedPcbTraces =>
  routes.map((route) => {
    const simplifiedRoute: SimplifiedPcbTraces[number]["route"] = []

    for (let index = 0; index < route.route.length; index += 1) {
      const point = route.route[index] as CopperRoutePoint
      const previous = route.route[index - 1]
      const layer = getLayerName(point.z)

      if (previous && previous.z !== point.z) {
        simplifiedRoute.push({
          route_type: "via",
          x: point.x,
          y: point.y,
          from_layer: getLayerName(previous.z),
          to_layer: layer,
          via_diameter: route.viaDiameter,
        })
      }

      simplifiedRoute.push({
        route_type: "wire",
        x: point.x,
        y: point.y,
        width: point.traceThickness ?? route.traceThickness,
        layer,
      })
    }

    return {
      type: "pcb_trace",
      pcb_trace_id: `${route.connectionName}_0`,
      connection_name: route.connectionName,
      route: simplifiedRoute,
    }
  })

test("broad repulsion uses actual tapered trace and via copper near pads", () => {
  const cases: Array<{
    name: string
    srj: SimpleRouteJson
    routes: CopperRoute[]
  }> = [
    {
      name: "tapered trace",
      srj: {
        layerCount: 2,
        minTraceWidth: 0.1,
        minViaDiameter: 0.3,
        minTraceToPadEdgeClearance: 0.15,
        bounds: { minX: -2, maxX: 3, minY: -2, maxY: 2 },
        obstacles: [
          {
            type: "rect",
            center: { x: 0.5, y: 0.4 },
            width: 0.4,
            height: 0.2,
            layers: ["top"],
            connectedTo: ["pad", "pcb_smtpad_foreign"],
          },
        ],
        connections: [
          { name: "trace", pointsToConnect: [] },
          { name: "pad", pointsToConnect: [] },
        ],
      },
      routes: [
        {
          connectionName: "trace",
          traceThickness: 0.1,
          viaDiameter: 0.3,
          vias: [],
          route: [
            { x: -1, y: 0, z: 0, traceThickness: 0.1 },
            { x: 0, y: 0, z: 0, traceThickness: 0.5 },
            { x: 1, y: 0, z: 0, traceThickness: 0.3 },
            { x: 2, y: 0, z: 0, traceThickness: 0.1 },
          ],
        },
      ],
    },
    {
      name: "via",
      srj: {
        layerCount: 2,
        minTraceWidth: 0.1,
        minViaDiameter: 0.3,
        minTraceToPadEdgeClearance: 0.15,
        minViaEdgeToPadEdgeClearance: 0.15,
        bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
        obstacles: [
          {
            type: "rect",
            center: { x: 0.45, y: 0 },
            width: 0.2,
            height: 0.2,
            layers: ["top"],
            connectedTo: ["pad", "pcb_smtpad_foreign"],
          },
        ],
        connections: [
          { name: "trace", pointsToConnect: [] },
          { name: "pad", pointsToConnect: [] },
        ],
      },
      routes: [
        {
          connectionName: "trace",
          traceThickness: 0.1,
          viaDiameter: 0.5,
          vias: [{ x: 0, y: 0 }],
          route: [
            { x: -1, y: 1, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: -1, y: -1, z: 1 },
          ],
        },
      ],
    },
  ]

  const results = cases.map(({ name, srj, routes }) => {
    const originalRoutes = structuredClone(routes)
    const engine = new AutoroutingDrcEngine(srj, {
      traceClearance: 0.15,
      viaClearance: 0.15,
    })
    const getExactSnapshot = (candidateRoutes: HighDensityRoute[]) =>
      getDrcSnapshot(srj, candidateRoutes, ({ routes: evaluatedRoutes }) =>
        engine.evaluate(toExactTraces(evaluatedRoutes ?? [])),
      )
    const before = getExactSnapshot(routes)
    const repaired = applyBroadRepulsionForces(srj, routes, 1)

    return {
      name,
      before,
      after: getExactSnapshot(repaired),
      routes,
      originalRoutes,
    }
  })

  expect(
    Object.fromEntries(
      results.map(({ name, before }) => [name, before.count]),
    ),
  ).toEqual({
    "tapered trace": 1,
    via: 1,
  })
  expect(
    Object.fromEntries(results.map(({ name, after }) => [name, after.count])),
  ).toEqual({
    "tapered trace": 0,
    via: 0,
  })
  expect(
    results.every(({ before, after }) => after.issueScore < before.issueScore),
  ).toBe(true)
  for (const { name, routes, originalRoutes } of results) {
    expect(routes, `${name} input routes stay unchanged`).toEqual(originalRoutes)
  }
})
