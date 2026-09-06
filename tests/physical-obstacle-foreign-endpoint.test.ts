import { expect, test } from "bun:test"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { AutoroutingDrcEngine } from "../lib"
import { getDrcErrors } from "../lib/solvers/GlobalDrcForceImproveSolver/getDrcErrors"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"
import {
  createAliasedPadFixture,
  createPadCrossingTrace,
} from "./fixtures/obstacle-primitives"

test("does not infer pad ownership from a foreign trace endpoint inside copper", (): void => {
  const srj = createAliasedPadFixture()
  srj.obstacles.splice(0, 1)
  srj.obstacles[0]!.connectedTo = ["pcb_smtpad_1", "foreign"]
  const traces = createPadCrossingTrace()
  const endpoint = traces[0]!.route[0]!
  if (endpoint.route_type !== "wire") throw new Error("Expected wire endpoint")
  endpoint.x = 1
  expect(new AutoroutingDrcEngine(srj).evaluate(traces).errors).toHaveLength(1)
  const circuit = convertToCircuitJson(srj, traces)
  expect(getFullConnectivityMapFromCircuitJson(circuit).areIdsConnected(
    "trace_signal", "pcb_smtpad_1",
  )).toBe(false)
  expect(getDrcErrors(circuit, { traceClearance: 0.1 }).errors).toHaveLength(1)
})
