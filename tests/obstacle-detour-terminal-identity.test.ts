import { expect, test } from "bun:test"
import {
  applyDrcErrorForces,
  cloneRoutes,
  doRoutesPreservePcbPortTerminals,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { HighDensityRoute, SimpleRouteJson } from "../lib"

test("obstacle detours retain PCB identities only at the original terminals", () => {
  const input: HighDensityRoute[] = [{
    connectionName: "signal",
    traceThickness: 0.15,
    viaDiameter: 0.5,
    route: [
      { x: -1, y: 0, z: 0, pcb_port_id: "a" },
      { x: 1, y: 0, z: 0, pcb_port_id: "b" },
    ],
    vias: [],
  }]
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: -3, maxX: 3, minY: -3, maxY: 3 },
    connections: [],
    obstacles: [{
      type: "rect", layers: ["top"], center: { x: 0, y: -0.1 },
      width: 0.4, height: 0.4, connectedTo: ["foreign"],
    }],
  }
  const original = structuredClone(input)
  const routes = cloneRoutes(input)
  expect(applyDrcErrorForces(srj, routes, [{
    type: "pcb_trace_error",
    pcb_trace_id: "signal_0",
    message: 'PCB trace signal_0 overlaps with pcb_smtpad "foreign" (accidental contact)',
    center: { x: 0, y: -0.1 },
  }], new Map([["signal_0", 0]]), 1)).toBe(true)
  expect(routes[0]!.route.length).toBeGreaterThan(2)
  expect(routes[0]!.route[0]).toEqual(input[0]!.route[0])
  expect(routes[0]!.route.at(-1)).toEqual(input[0]!.route.at(-1))
  expect(routes[0]!.route.slice(1, -1).every(point => !point.pcb_port_id)).toBe(true)
  expect(doRoutesPreservePcbPortTerminals(input, routes)).toBe(true)
  expect(input).toEqual(original)
})
