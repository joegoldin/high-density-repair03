import { expect, test } from "bun:test"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getDrcErrors } from "../lib/solvers/GlobalDrcForceImproveSolver/getDrcErrors"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"
import {
  createAliasedPadFixture,
  createPadCrossingTrace,
} from "./fixtures/obstacle-primitives"

test("keeps explicit reference connectivity when both endpoints lie inside foreign copper", (): void => {
  const srj = createAliasedPadFixture()
  srj.obstacles.splice(0, 1)
  const traces = createPadCrossingTrace()
  traces[0]!.route = [
    { route_type: "wire", x: 0.95, y: 0, width: 0.1, layer: "top" },
    { route_type: "wire", x: 1.05, y: 0, width: 0.1, layer: "top" },
  ]
  const circuit = convertToCircuitJson(srj, traces)
  const input = structuredClone(circuit)
  expect(getFullConnectivityMapFromCircuitJson(circuit).areIdsConnected(
    "trace_signal", "foreign",
  )).toBe(false)
  expect(getDrcErrors(circuit, { traceClearance: 0.1 }).errors).toHaveLength(1)
  expect(circuit).toEqual(input)
  expect(getFullConnectivityMapFromCircuitJson(circuit).areIdsConnected(
    "trace_signal", "foreign",
  )).toBe(false)
})
