import { expect, test } from "bun:test"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import {
  AutoroutingDrcEngine,
  type SimpleRouteJson,
  type SimplifiedPcbTraces,
} from "../lib"
import { getDrcErrors } from "../lib/solvers/GlobalDrcForceImproveSolver/getDrcErrors"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"
import {
  getCompiledObstacles,
  getCompiledPrimitiveSet,
} from "./fixtures/obstacle-primitives"
import normalized from "./fixtures/rotated-pad-normalized-primitives.json"

test("retains every normalized rectangle of one publicly owned rotated pad", (): void => {
  const srj = structuredClone(normalized) as SimpleRouteJson
  const last = srj.obstacles.at(-1)!
  const traces: SimplifiedPcbTraces = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_signal",
      connection_name: "signal",
      route: [
        {
          route_type: "wire",
          x: last.center.x - 0.05,
          y: last.center.y,
          width: 0.1,
          layer: "top",
        },
        {
          route_type: "wire",
          x: last.center.x + 0.05,
          y: last.center.y,
          width: 0.1,
          layer: "top",
        },
      ],
    },
  ]
  expect(srj.obstacles).toHaveLength(8)
  const engine = new AutoroutingDrcEngine(srj)
  expect(engine.evaluate(traces).errors.length).toBeGreaterThan(0)
  const expected = srj.obstacles.map((obstacle) => JSON.stringify({
    owner: "pcb_smtpad_rotated",
    type: "pcb_smtpad",
    x: obstacle.center.x,
    y: obstacle.center.y,
    width: obstacle.width,
    height: obstacle.height,
    layers: ["top"],
    aliases: [...obstacle.connectedTo].sort(),
  })).sort()
  expect(getCompiledPrimitiveSet(engine)).toEqual(expected)
  expect(getCompiledObstacles(engine).every(
    (obstacle) => obstacle.obstacleId === "pcb_smtpad_rotated",
  )).toBe(true)
  const circuit = convertToCircuitJson(srj, traces)
  const pads = circuit.filter((element) => element.type === "pcb_smtpad")
  expect(pads).toHaveLength(8)
  expect(new Set(pads.map((pad) => pad.pcb_smtpad_id)).size).toBe(8)
  expect(pads.every((pad) => pad.pcb_port_id === "pcb_port_rotated")).toBe(true)
  const connectionMap = getFullConnectivityMapFromCircuitJson(circuit)
  for (const pad of pads) {
    expect(connectionMap.areIdsConnected(pad.pcb_smtpad_id, "foreign")).toBe(true)
    expect(connectionMap.areIdsConnected(pad.pcb_smtpad_id, "signal")).toBe(false)
  }
  expect(getDrcErrors(circuit, { traceClearance: 0.1 }).errors.length).toBeGreaterThan(0)
  traces[0]!.connection_name = "foreign"
  expect(engine.evaluate(traces).errors).toEqual([])
  expect(getDrcErrors(convertToCircuitJson(srj, traces), { traceClearance: 0.1 }).errors).toEqual([])
  const reordered = structuredClone(srj)
  reordered.obstacles.reverse()
  for (const obstacle of reordered.obstacles) obstacle.connectedTo.reverse()
  expect(getCompiledPrimitiveSet(new AutoroutingDrcEngine(reordered))).toEqual(expected)
  expect(convertToCircuitJson(reordered, [])
    .filter((element) => element.type === "pcb_smtpad")
    .map((pad) => JSON.stringify(pad)).sort(),
  ).toEqual(pads.map((pad) => JSON.stringify(pad)).sort())
  expect(srj).toEqual(normalized as SimpleRouteJson)
})
